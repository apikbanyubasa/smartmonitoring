"""
Modul Manajemen Worker Thread untuk DaashTics.
Mengontrol daur hidup thread deteksi CCTV real-time (start, stop, reload).
"""

import time
import threading
from sqlalchemy import select
from sqlalchemy.orm import undefer_group

from app import db
from app.models import CCTV
from .analyzer import run_detection_worker

# Global State Worker
ACTIVE_WORKER_THREADS = {}
WORKER_KILL_SWITCH = {}


def stop_all_detection_threads():
    """Mengirim sinyal berhenti dan membersihkan seluruh worker thread aktif."""
    global ACTIVE_WORKER_THREADS, WORKER_KILL_SWITCH

    num_workers_to_stop = len(WORKER_KILL_SWITCH)
    print(
        f"[WorkerManager] Mengirim sinyal berhenti ke {num_workers_to_stop} worker..."
    )

    threads_to_join = []

    # 1. Mengirim sinyal berhenti ke semua worker
    for location, event in WORKER_KILL_SWITCH.items():
        event.set()
        print(f"[WorkerManager] Sinyal STOP dikirim ke: {location}")

    # 2. Kumpulkan objek Thread aktif sebelum membersihkan state
    for location, thread in list(ACTIVE_WORKER_THREADS.items()):
        if thread.is_alive():
            threads_to_join.append(thread)

    # 3. Memberi waktu agar thread lama menyelesaikan loop dan melepaskan resource kamera
    if threads_to_join:
        print(
            f"[WorkerManager] Menunggu {len(threads_to_join)} worker menyelesaikan tugas..."
        )
        for thread in threads_to_join:
            thread.join(timeout=3)
            if thread.is_alive():
                print(
                    f"[WorkerManager] PERINGATAN: Thread {thread.name} belum selesai dalam 3 detik."
                )

    # 4. Membersihkan state global
    ACTIVE_WORKER_THREADS = {}
    WORKER_KILL_SWITCH = {}
    print("[WorkerManager] Semua state worker lama dibersihkan.")


def initialize_workers_and_server(app):
    """
    Fungsi master untuk menghentikan, memuat data CCTV baru secara eager,
    dan memulai thread deteksi baru.
    """
    # Hentikan semua thread worker yang sedang berjalan
    stop_all_detection_threads()

    # 1. Ambil data CCTV dalam context aplikasi
    active_cctv_list = []
    with app.app_context():
        try:
            stmt = (
                select(CCTV)
                .filter(
                    CCTV.status.ilike("aktif"),
                    CCTV.stream_url.isnot(None),
                    db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)),
                )
                .options(undefer_group("*"))
            )
            active_cctv_list = db.session.scalars(stmt).all()
        except Exception as e:
            db.session.rollback()
            print(f"[WorkerManager] GAGAL KRITIS memuat daftar CCTV dari DB: {e}")
            return

    # 2. Inisialisasi thread worker
    if not active_cctv_list:
        print("[WorkerManager] Tidak ada CCTV aktif untuk dipantau.")
        return

    print(
        f"[WorkerManager] Ditemukan {len(active_cctv_list)} CCTV aktif untuk dipantau."
    )

    threads = []
    for cctv in active_cctv_list:
        worker_stop_event = threading.Event()
        WORKER_KILL_SWITCH[cctv.lokasi] = worker_stop_event

        print(f"[WorkerManager] Memulai worker thread untuk: {cctv.lokasi}")
        t = threading.Thread(
            target=run_detection_worker,
            args=(cctv.stream_url, cctv.lokasi, "all", worker_stop_event),
            daemon=True,
        )
        t.start()
        threads.append(t)
        ACTIVE_WORKER_THREADS[cctv.lokasi] = t
        time.sleep(0.05)  # Jeda bertahap untuk mencegah lonjakan CPU

    print(f"[WorkerManager] Berhasil memulai {len(threads)} worker deteksi.")


def reload_workers_thread(app):
    """Memicu reload seluruh worker thread di latar belakang."""
    print("[WorkerManager] Memicu reload worker thread...")
    threading.Thread(
        target=initialize_workers_and_server, args=(app,), daemon=True
    ).start()
