from flask import Flask, redirect, url_for
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_migrate import Migrate
from flask_socketio import SocketIO
from dotenv import load_dotenv  # 💥 BARU
import os  # 💥 BARU

# --- MUAT VARIABEL LINGKUNGAN DI AWAL MODUL ---
# Cari file .env di folder backend/ atau root workspace
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_dotenv_backend = os.path.join(_backend_dir, ".env")
_dotenv_root = os.path.abspath(os.path.join(_backend_dir, "..", ".env"))

if os.path.exists(_dotenv_backend):
    load_dotenv(dotenv_path=_dotenv_backend, override=True)
elif os.path.exists(_dotenv_root):
    load_dotenv(dotenv_path=_dotenv_root, override=True)
else:
    load_dotenv(override=True)
# ----------------------------------------------

from config import Config  # Config diimpor SETELAH load_dotenv

# --- 1. INISIALISASI EKSTENSI (GLOBAL) ---
db = SQLAlchemy()
mail = Mail()
login_manager = LoginManager()
login_manager.login_view = "api.api_login"
login_manager.login_message = "Silakan login untuk mengakses halaman ini."
login_manager.login_message_category = "info"

# Deklarasi global untuk SocketIO dan Migrate
socketio = SocketIO(cors_allowed_origins="*")
migrate = Migrate()

# JANGAN impor model 'User' di sini.


def create_app():
    """
    Application Factory Pattern: Membuat dan mengkonfigurasi instance aplikasi Flask.
    """
    app = Flask(__name__, static_folder="static")

    # --- 2. KONFIGURASI APLIKASI ---
    app.config.from_object(Config)

    # --- 3. PROXY SANITIZATION & SECURITY MIDDLEWARE ---
    # Melindungi dari manipulasi header X-Forwarded-For dan spoofing IP
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    # --- 4. HUBUNGKAN EKSTENSI DENGAN APLIKASI ---
    db.init_app(app)
    mail.init_app(app)
    login_manager.init_app(app)

    # Whitelist origin untuk Next.js Frontend
    allowed_origins = os.environ.get(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

    # HUBUNGKAN SOCKETIO KE APLIKASI DENGAN ORIGIN TERSANITASI
    socketio.init_app(app, cors_allowed_origins=allowed_origins)

    # HUBUNGKAN FLASK-MIGRATE DENGAN APLIKASI DAN DB
    migrate.init_app(app, db)

    # --- KONFIGURASI CORS UNTUK NEXT.JS FRONTEND ---
    from flask_cors import CORS
    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True,
    )

    # --- PINDAHKAN IMPOR 'User' KE SINI ---
    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        try:
            return User.query.get(int(user_id))
        except Exception as err:
            print(f"⚠️ Gagal memuat user id {user_id} dari DB: {err}")
            return None

    # Gunakan app_context untuk mendaftarkan blueprint dan membuat tabel
    with app.app_context():
        from .api import api_bp  # <-- ENTERPRISE REST API BLUEPRINT
        from .seed import seed_bp

        # Daftarkan Blueprint REST API dan Seed Data
        app.register_blueprint(api_bp)  # Otomatis menggunakan /api/v1
        app.register_blueprint(seed_bp)

    # --- 6. DAFTARKAN RUTE LEVEL APLIKASI (HEADLESS API HEALTHCHECK) ---
    @app.route("/")
    def home():
        from flask import jsonify
        return jsonify({
            "service": "DaashTics Enterprise REST API & AI Engine",
            "status": "online",
            "version": "1.0",
            "frontend_app": "http://localhost:3000",
            "api_endpoints": "/api/v1",
            "architecture": "Decoupled Next.js Frontend + Flask Headless Engine"
        })

    return app
