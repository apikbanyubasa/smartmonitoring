"""
Flask Central Application Context Provider untuk Engine Computer Vision.
Menyediakan akses thread-safe ke database SQLAlchemy dan konfigurasi Flask.
"""

import threading
from flask import Flask

GLOBAL_APP_INSTANCE = None
DB_CLEANUP_LOCK = threading.Lock()
NOTIFICATION_LOCK = threading.Lock()
GLOBAL_NOTIFICATION_ENABLED = True


def get_notification_enabled() -> bool:
    """Mengambil status aktif/non-aktif notifikasi secara thread-safe."""
    global GLOBAL_NOTIFICATION_ENABLED
    with NOTIFICATION_LOCK:
        return bool(GLOBAL_NOTIFICATION_ENABLED)


def set_notification_enabled(enabled: bool) -> bool:
    """Mengatur status aktif/non-aktif notifikasi secara thread-safe."""
    global GLOBAL_NOTIFICATION_ENABLED
    with NOTIFICATION_LOCK:
        GLOBAL_NOTIFICATION_ENABLED = bool(enabled)
        return GLOBAL_NOTIFICATION_ENABLED


def toggle_notification_enabled() -> bool:
    """Membalik status notifikasi secara thread-safe dan mengembalikan nilai baru."""
    global GLOBAL_NOTIFICATION_ENABLED
    with NOTIFICATION_LOCK:
        GLOBAL_NOTIFICATION_ENABLED = not GLOBAL_NOTIFICATION_ENABLED
        return GLOBAL_NOTIFICATION_ENABLED


def set_global_app_instance(app_instance: Flask):
    """Menginjeksi instance aplikasi Flask sentral ke modul engine."""
    global GLOBAL_APP_INSTANCE
    GLOBAL_APP_INSTANCE = app_instance
    print(f"[{threading.current_thread().name}] Global Flask App instance set.")


def get_flask_app_context():
    """Mendapatkan konteks aplikasi sentral yang diinisialisasi di run.py."""
    global GLOBAL_APP_INSTANCE
    if GLOBAL_APP_INSTANCE is None:
        raise RuntimeError(
            "Flask app instance belum diinisialisasi. Panggil set_global_app_instance() dari thread utama."
        )
    return GLOBAL_APP_INSTANCE.app_context()

