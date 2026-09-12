from dotenv import load_dotenv
import os

basedir = os.path.abspath(os.path.dirname(__file__))
dotenv_path = os.path.join(basedir, ".env")
if os.path.exists(dotenv_path):

    load_dotenv(dotenv_path=dotenv_path, override=True)
    print(f"Berhasil memuat .env file dari: {dotenv_path}")
else:
    load_dotenv(override=True)

import time
import threading
from app import create_app, db, socketio
from app.models import CCTV

# Mengimpor modul engine computer vision dan worker manager
from app.engine import (
    set_global_app_instance,
    initialize_workers_and_server,
    reload_workers_thread,
    get_notification_enabled,
    toggle_notification_enabled,
)


app = create_app()

# 💥 BARIS KRITIS: INJEKSI INSTANCE APLIKASI SENTRAL KE MODUL ANALYZER
# Ini harus dilakukan sebelum thread worker dimulai!
set_global_app_instance(app)

def main():
    print("Menjalankan server Flask-SocketIO pada port 5000...")

    @socketio.on("connect")
    def handle_connect():
        # Kirim status notifikasi terkini ke klien yang baru terhubung
        socketio.emit("notification_status_update", {"enabled": get_notification_enabled()})

        if not getattr(handle_connect, "has_initialized", False):
            # initialize_workers_and_server akan menggunakan APP instance yang sudah diinjeksi
            threading.Thread(
                target=initialize_workers_and_server, args=(app,), daemon=True
            ).start()
            handle_connect.has_initialized = True

    @socketio.on("toggle_all_notifications")
    def handle_toggle_all_notifications():
        """Menerima sinyal WebSocket untuk membalik status notifikasi sistem."""
        enabled = toggle_notification_enabled()
        status_str = "Aktif" if enabled else "Non-aktif"
        print(f"Status notifikasi global diubah via Socket.IO menjadi: {status_str}")
        socketio.emit("notification_status_update", {"enabled": enabled})

    @socketio.on("get_notification_status")
    def handle_get_notification_status():
        """Mengirim status notifikasi terkini ke klien."""
        socketio.emit("notification_status_update", {"enabled": get_notification_enabled()})

    socketio.run(
        app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True
    )


if __name__ == "__main__":
    main()
