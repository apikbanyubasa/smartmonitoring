"""
Enterprise REST API - Authentication & RBAC Service
Menyediakan endpoint otentikasi berbasis Token/JWT dan HttpOnly Cookie untuk Next.js client.
"""

from flask import request, g, current_app
from app import db
from app.models import User
from app.security import (
    rate_limit,
    generate_auth_token,
    api_auth_required,
    api_response,
    api_error,
)
from . import api_bp


@api_bp.route("/auth/login", methods=["POST"])
@rate_limit(limit=5, period=60, by="ip", message="Terlalu banyak percobaan login. Tunggu 1 menit.")
def api_login():
    """Autentikasi pengguna dan mengembalikan token serta HttpOnly cookie."""
    data = request.get_json(silent=True) or {}
    username_or_email = data.get("username", "").strip()
    password = data.get("password", "")

    if not username_or_email or not password:
        return api_error(
            code="VALIDATION_ERROR",
            message="Username dan password wajib diisi.",
            status=400
        )

    # Cari user berdasarkan username atau email
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if not user or not user.check_password(password):
        return api_error(
            code="INVALID_CREDENTIALS",
            message="Username atau password yang Anda masukkan salah.",
            status=401
        )

    # Buat token bertanda tangan kriptografis (masa berlaku 24 jam)
    token = generate_auth_token(
        user_id=user.id,
        role=user.role,
        username=user.username,
        expires_in=86400
    )

    user_payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    }

    resp, status_code = api_response(
        data={"token": token, "user": user_payload},
        message="Login berhasil. Selamat datang kembali."
    )

    # Pasang token ke dalam HttpOnly cookie untuk Zero-Trust security
    is_prod = not current_app.debug and not current_app.testing
    resp.set_cookie(
        "access_token",
        token,
        max_age=86400,
        httponly=True,
        samesite="Lax",
        secure=is_prod or request.is_secure
    )

    return resp, status_code


@api_bp.route("/auth/me", methods=["GET"])
@api_auth_required()
def api_me():
    """Mengambil profil dan hak akses pengguna yang sedang aktif."""
    user = g.current_user
    return api_response(
        data={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        },
        message="Sesi terverifikasi."
    )


@api_bp.route("/auth/logout", methods=["POST"])
def api_logout():
    """Mengakhiri sesi dan menghapus cookie otentikasi."""
    resp, status_code = api_response(message="Logout berhasil.")
    resp.delete_cookie("access_token", samesite="Lax")
    return resp, status_code


@api_bp.route("/auth/users", methods=["GET"])
@api_auth_required(["admin"])
def api_get_users():
    """Mengambil seluruh daftar pengguna dan perannya (RBAC)."""
    users = User.query.order_by(User.id.asc()).all()
    data = [
        {"id": u.id, "username": u.username, "email": u.email, "role": u.role}
        for u in users
    ]
    return api_response(data=data, meta={"total": len(data)})


@api_bp.route("/auth/users", methods=["POST"])
@api_auth_required(["admin"])
def api_create_user():
    """Membuat pengguna baru dengan peran tertentu."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "operator").strip().lower()

    if not username or not email or not password:
        return api_error(code="VALIDATION_ERROR", message="Username, email, dan password wajib diisi.")

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return api_error(code="CONFLICT", message="Username atau email sudah digunakan.")

    try:
        new_u = User(username=username, email=email, role=role)
        new_u.set_password(password)
        db.session.add(new_u)
        db.session.commit()
        return api_response(
            data={"id": new_u.id, "username": new_u.username, "email": new_u.email, "role": new_u.role},
            message=f"Pengguna {new_u.username} ({role}) berhasil dibuat.",
            status=201
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal membuat pengguna: {str(e)}", status=500)


@api_bp.route("/auth/users/<int:user_id>", methods=["DELETE"])
@api_auth_required(["admin"])
def api_delete_user(user_id: int):
    """Menghapus akun pengguna."""
    if g.current_user.id == user_id:
        return api_error(code="FORBIDDEN", message="Anda tidak dapat menghapus akun Anda sendiri.")

    u = User.query.get(user_id)
    if not u:
        return api_error(code="NOT_FOUND", message="Pengguna tidak ditemukan.", status=404)

    try:
        db.session.delete(u)
        db.session.commit()
        return api_response(message=f"Pengguna {u.username} berhasil dihapus.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus pengguna: {str(e)}", status=500)


@api_bp.route("/auth/profile", methods=["PUT"])
@api_auth_required()
def api_update_profile():
    """Memperbarui informasi profil pengguna dan password."""
    data = request.get_json(silent=True) or {}
    user = g.current_user

    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    current_password = data.get("current_password", "").strip()
    new_password = data.get("new_password", "").strip()

    if username:
        existing = User.query.filter(User.username == username, User.id != user.id).first()
        if existing:
            return api_error(code="CONFLICT", message="Username sudah digunakan pengguna lain.")
        user.username = username

    if email:
        existing = User.query.filter(User.email == email, User.id != user.id).first()
        if existing:
            return api_error(code="CONFLICT", message="Email sudah digunakan pengguna lain.")
        user.email = email

    if new_password:
        if not current_password or not user.check_password(current_password):
            return api_error(code="INVALID_PASSWORD", message="Password saat ini tidak sesuai.")
        user.set_password(new_password)

    try:
        db.session.commit()
        return api_response(
            data={"id": user.id, "username": user.username, "email": user.email, "role": user.role},
            message="Pengaturan akun berhasil disimpan."
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal memperbarui profil: {str(e)}", status=500)

