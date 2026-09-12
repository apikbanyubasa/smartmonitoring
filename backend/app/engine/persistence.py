"""
Modul Persistensi Basis Data untuk Engine Computer Vision.
Menangani penyimpanan hasil counting kendaraan, pelanggaran parkir, kerumunan,
dan kendaraan ODOL ke PostgreSQL melalui SQLAlchemy.
"""

import os
import threading
from app import db
from app.models import CountingData, ParkingViolation, CrowdDetection, OdolDetection, CCTV
from .context import get_flask_app_context, DB_CLEANUP_LOCK


def get_cctv_id_by_location_name(location_name):
    """Mencari ID CCTV berdasarkan nama lokasi dari database."""
    try:
        cctv_obj = CCTV.query.filter_by(lokasi=location_name).first()
        if cctv_obj:
            return cctv_obj.id
        else:
            print(f"[{threading.current_thread().name}] CCTV '{location_name}' tidak ditemukan di DB.")
            return None
    except Exception as e:
        print(f"[{threading.current_thread().name}] Database error looking up CCTV: {e}")
        return None


def cleanup_old_data(model, cctv_id, max_rows=50):
    """
    Membersihkan baris data lama dari suatu tabel untuk lokasi tertentu jika diaktifkan.
    Standar Enterprise: Secara default histori analitika dipertahankan utuh.
    Pembersihan agresif hanya aktif jika ENABLE_AGGRESSIVE_CLEANUP=true di .env.
    """
    if os.environ.get("ENABLE_AGGRESSIVE_CLEANUP", "false").lower() not in ["true", "1", "on"]:
        return

    with DB_CLEANUP_LOCK:
        try:
            current_row_count = model.query.filter_by(cctv_id=cctv_id).count()
            if current_row_count > max_rows:
                rows_to_delete = current_row_count - max_rows
                oldest_ids = (
                    db.session.query(model.id)
                    .filter_by(cctv_id=cctv_id)
                    .order_by(model.id.asc())
                    .limit(rows_to_delete)
                    .subquery()
                )
                model.query.filter(model.id.in_(oldest_ids)).delete(synchronize_session=False)
                db.session.commit()
                print(
                    f"[{threading.current_thread().name}] CLEANUP SUCCESS: Dihapus {rows_to_delete} baris dari {model.__tablename__} (CCTV {cctv_id})."
                )
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            print(f"[{threading.current_thread().name}] CLEANUP ERROR ({model.__tablename__}): {e}")


def reset_location_data(location_name, location_trackers=None, latest_detection_stats=None, global_tracked_objects=None):
    """Mereset state tracker di memori dan data analitik terkait di database."""
    print(f"[{threading.current_thread().name}] STARTING RESET FOR LOCATION: {location_name}")

    if location_trackers is not None and location_name in location_trackers:
        location_trackers[location_name].reset_completely()
        location_trackers.pop(location_name, None)
    if latest_detection_stats is not None and location_name in latest_detection_stats:
        latest_detection_stats.pop(location_name, None)
    if global_tracked_objects is not None and location_name in global_tracked_objects:
        global_tracked_objects.pop(location_name, None)

    try:
        with get_flask_app_context():
            cctv_id = get_cctv_id_by_location_name(location_name)
            if cctv_id is None:
                print(f"[{threading.current_thread().name}] ERROR: Reset DB dibatalkan karena CCTV ID tidak ditemukan.")
                return

            CountingData.query.filter_by(cctv_id=cctv_id).delete()
            ParkingViolation.query.filter_by(cctv_id=cctv_id).delete()
            CrowdDetection.query.filter_by(cctv_id=cctv_id).delete()
            OdolDetection.query.filter_by(cctv_id=cctv_id).delete()
            db.session.commit()
            print(f"[{threading.current_thread().name}] COMPLETE ADMIN RESET FINISHED FOR: {location_name}")
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[{threading.current_thread().name}] Gagal reset DB: {e}")


def init_database():
    """Inisialisasi koneksi Flask App Context untuk thread worker."""
    try:
        with get_flask_app_context():
            pass
        print(f"[{threading.current_thread().name}] Database connection initialized for worker.")
    except Exception as e:
        print(f"[{threading.current_thread().name}] WARNING: DB connection failed on init: {e}")


def save_counting_data(location, counts_jauh, counts_dekat):
    """Menyimpan data counting ke PostgreSQL melalui SQLAlchemy."""
    try:
        with get_flask_app_context():
            cctv_id = get_cctv_id_by_location_name(location)
            if cctv_id is None:
                return

            grand_total = sum(
                counts_jauh.get(c, 0) for c in ["car", "motorcycle", "bus", "truck"]
            ) + sum(
                counts_dekat.get(c, 0) for c in ["car", "motorcycle", "bus", "truck"]
            )

            new_count = CountingData(
                cctv_id=cctv_id,
                counts_jauh_car=counts_jauh.get("car", 0),
                counts_jauh_motorcycle=counts_jauh.get("motorcycle", 0),
                counts_jauh_bus=counts_jauh.get("bus", 0),
                counts_jauh_truck=counts_jauh.get("truck", 0),
                counts_dekat_car=counts_dekat.get("car", 0),
                counts_dekat_motorcycle=counts_dekat.get("motorcycle", 0),
                counts_dekat_bus=counts_dekat.get("bus", 0),
                counts_dekat_truck=counts_dekat.get("truck", 0),
                grand_total=grand_total,
            )
            db.session.add(new_count)
            db.session.commit()

            cleanup_old_data(CountingData, cctv_id, max_rows=200)

    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[{threading.current_thread().name}] Database error (counting): {e}")


def save_parking_violation(location, vehicle_type, duration, obj_id):
    """Menyimpan data pelanggaran parkir ke PostgreSQL."""
    try:
        with get_flask_app_context():
            cctv_id = get_cctv_id_by_location_name(location)
            if cctv_id is None:
                return

            new_violation = ParkingViolation(
                cctv_id=cctv_id,
                vehicle_type=vehicle_type,
                parked_duration_sec=duration,
                object_id=obj_id,
            )
            db.session.add(new_violation)
            db.session.commit()

            cleanup_old_data(ParkingViolation, cctv_id, max_rows=50)

    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[{threading.current_thread().name}] Database error (parking): {e}")


def save_crowd_detection(location, crowd_size, duration):
    """Menyimpan data deteksi kerumunan ke PostgreSQL."""
    try:
        with get_flask_app_context():
            cctv_id = get_cctv_id_by_location_name(location)
            if cctv_id is None:
                return

            new_crowd = CrowdDetection(
                cctv_id=cctv_id,
                crowd_size=crowd_size,
                duration_sec=duration,
            )
            db.session.add(new_crowd)
            db.session.commit()

            cleanup_old_data(CrowdDetection, cctv_id, max_rows=50)

    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[{threading.current_thread().name}] Database error (crowd): {e}")


def save_odol_detection(location, vehicle_type, aspect_ratio, area):
    """Menyimpan data deteksi ODOL ke PostgreSQL."""
    try:
        with get_flask_app_context():
            cctv_id = get_cctv_id_by_location_name(location)
            if cctv_id is None:
                return

            new_odol = OdolDetection(
                cctv_id=cctv_id,
                vehicle_type=vehicle_type,
                aspect_ratio=aspect_ratio,
                area=area,
            )
            db.session.add(new_odol)
            db.session.commit()

            cleanup_old_data(OdolDetection, cctv_id, max_rows=50)

    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        print(f"[{threading.current_thread().name}] Database error (odol): {e}")


def delete_all_analytic_data():
    """Menghapus SEMUA record dari tabel analitik secara manual."""
    with get_flask_app_context():
        try:
            CountingData.query.delete()
            ParkingViolation.query.delete()
            CrowdDetection.query.delete()
            OdolDetection.query.delete()
            db.session.commit()
            print("Semua data analitik berhasil dihapus dari database.")
        except Exception as e:
            db.session.rollback()
            print(f"Gagal menghapus semua data analitik: {e}")
