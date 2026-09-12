"""
Security & Anti-Abuse Layer (Zero-Trust)
Menyediakan Rate Limiter thread-safe berbasis Sliding Window Memory,
proteksi brute force auth, IP resolver aman, dan standardisasi respons error HTTP.
"""

import time
import threading
from functools import wraps
from flask import request, jsonify, flash, redirect, render_template

# Storage in-memory rate limiter: { "bucket_name:key": [timestamp1, timestamp2, ...] }
_RATE_LIMIT_CACHE = {}
_CACHE_LOCK = threading.Lock()


def get_client_ip():
    """
    Mengambil alamat IP klien dengan aman.
    Werkzeug ProxyFix telah memvalidasi dan mensanitasi hop proxy pada wsgi_app level,
    sehingga request.remote_addr kebal terhadap header spoofing.
    """
    return request.remote_addr or "127.0.0.1"


def rate_limit(limit=10, period=60, by="ip", message=None):
    """
    Decorator Rate Limiter berbasis Sliding Window.
    
    :param limit: Jumlah request maksimum yang diizinkan dalam rentang waktu.
    :param period: Durasi rentang waktu dalam detik (default: 60 detik).
    :param by: Basis identifikasi ('ip' atau 'user').
    :param message: Pesan error kustom untuk ditampilkan saat limit terlampaui.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            now = time.time()
            cutoff = now - period

            # Tentukan identitas request
            if by == "ip":
                identity = get_client_ip()
            elif by == "user":
                from flask_login import current_user
                identity = str(current_user.id) if current_user.is_authenticated else get_client_ip()
            else:
                identity = get_client_ip()

            bucket_key = f"{f.__module__}.{f.__name__}:{identity}"

            with _CACHE_LOCK:
                timestamps = _RATE_LIMIT_CACHE.get(bucket_key, [])
                # Buang request yang sudah melewati rentang waktu (expired)
                valid_timestamps = [t for t in timestamps if t > cutoff]

                if len(valid_timestamps) >= limit:
                    retry_after = int(period - (now - valid_timestamps[0]))
                    err_msg = message or f"Terlalu banyak permintaan. Silakan tunggu {max(1, retry_after)} detik sebelum mencoba kembali."

                    # Jika request mengharapkan JSON atau rute API
                    if request.is_json or request.path.startswith("/admin/api") or request.path.startswith("/user/api"):
                        response = jsonify({
                            "success": False,
                            "error": {
                                "code": "RATE_LIMIT_EXCEEDED",
                                "message": err_msg,
                                "retry_after_seconds": max(1, retry_after)
                            }
                        })
                        response.status_code = 429
                        response.headers["Retry-After"] = str(max(1, retry_after))
                        return response

                    # Jika request berbasis form HTML
                    flash(err_msg, "danger")
                    response = redirect(request.referrer or request.url)
                    # Catatan: redirect Flask membawa status code 302, flash ditampilkan di halaman tujuan
                    return response

                # Catat timestamp request saat ini
                valid_timestamps.append(now)
                _RATE_LIMIT_CACHE[bucket_key] = valid_timestamps

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def clear_rate_limit_cache():
    """Membersihkan seluruh cache limiter (berguna untuk testing)."""
    with _CACHE_LOCK:
        _RATE_LIMIT_CACHE.clear()


# ==========================================================
# ENTERPRISE REST API TOKEN AUTH & STANDARDIZED RESPONSES
# ==========================================================

from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app, g


def get_auth_serializer():
    secret_key = current_app.config.get("SECRET_KEY")
    if not secret_key:
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: SECRET_KEY wajib diatur di file .env!"
        )
    return URLSafeTimedSerializer(secret_key, salt="daashtics-auth-token-v1")


def generate_auth_token(user_id, role, username, expires_in=86400):
    """Membuat token bertanda tangan kriptografis dengan masa kedaluwarsa."""
    serializer = get_auth_serializer()
    payload = {
        "user_id": user_id,
        "role": role,
        "username": username,
        "exp": time.time() + expires_in
    }
    return serializer.dumps(payload)


def verify_auth_token(token, max_age=86400):
    """Memvalidasi dan mendekripsi isi token."""
    serializer = get_auth_serializer()
    try:
        data = serializer.loads(token, max_age=max_age)
        return data
    except (SignatureExpired, BadSignature, Exception):
        return None


def api_response(data=None, message="Berhasil", meta=None, status=200):
    """Standardized API Success Response Contract."""
    res = {
        "success": True,
        "message": message,
        "data": data if data is not None else {}
    }
    if meta:
        res["meta"] = meta
    return jsonify(res), status


def api_error(code="BAD_REQUEST", message="Permintaan tidak valid", details=None, status=400):
    """Standardized API Error Response Contract."""
    res = {
        "success": False,
        "error": {
            "code": code,
            "message": message
        }
    }
    if details:
        res["error"]["details"] = details
    return jsonify(res), status


def api_auth_required(roles=None):
    """
    Decorator proteksi REST API untuk Next.js frontend client.
    Mendukung pembacaan token dari Authorization: Bearer <token>
    ATAU dari HttpOnly cookie 'access_token'.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1].strip()
            elif "access_token" in request.cookies:
                token = request.cookies.get("access_token")

            if not token:
                return api_error(
                    code="UNAUTHORIZED",
                    message="Token otentikasi tidak ditemukan. Silakan login terlebih dahulu.",
                    status=401
                )

            payload = verify_auth_token(token)
            if not payload:
                return api_error(
                    code="INVALID_TOKEN",
                    message="Token tidak valid atau sesi Anda telah berakhir.",
                    status=401
                )

            from app.models import User
            user = User.query.get(payload.get("user_id"))
            if not user:
                return api_error(
                    code="USER_NOT_FOUND",
                    message="Pengguna tidak ditemukan di sistem.",
                    status=401
                )

            # Role verification (RBAC)
            if roles:
                allowed_roles = [r.lower() for r in roles] if isinstance(roles, (list, tuple)) else [roles.lower()]
                if user.role.lower() not in allowed_roles:
                    return api_error(
                        code="FORBIDDEN",
                        message="Akses ditolak: level otoritas akun Anda tidak mencukupi.",
                        status=403
                    )

            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator

