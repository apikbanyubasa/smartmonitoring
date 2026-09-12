"""
Modul Sentral Orkestrasi Deteksi & Streaming Video (Facade Pattern).
Mengintegrasikan modul Tracker, Detector, StreamReader, dan Persistence.
"""

import os
import cv2
import time
import math
import threading
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict, deque

# Impor dari submodul terpisah
from .context import (
    GLOBAL_APP_INSTANCE,
    set_global_app_instance,
    get_flask_app_context,
    GLOBAL_NOTIFICATION_ENABLED,
    get_notification_enabled,
)
from .tracker import (
    SimpleObjectTracker,
    get_point_side,
    ZONE_JAUH,
    ZONE_TENGAH,
    ZONE_DEKAT,
)
from .persistence import (
    get_cctv_id_by_location_name,
    cleanup_old_data,
    reset_location_data as _reset_location_data,
    init_database,
    save_counting_data,
    save_parking_violation,
    save_crowd_detection,
    save_odol_detection,
    delete_all_analytic_data,
)
from .detector import (
    model,
    plate_model,
    READER_OCR,
    DETECTION_CLASSES,
    COLORS,
    DEFAULT_LINE_1_Y,
    DEFAULT_LINE_2_Y,
    DEFAULT_REAL_DISTANCE,
    get_model_path,
    detect_objects,
    recognize_plate,
    recognize_plate_from_crop,
    detect_crowd,
    draw_bounding_boxes,
)
from .stream_reader import (
    get_stream,
    get_stream_from_m3u8,
    generate_frames_preview_only,
)

from app.models import CCTV, CountingData, ParkingViolation, CrowdDetection, OdolDetection

# Impor SocketIO dari Server
try:
    from app import socketio
except ImportError:
    class DummySocketIO:
        def emit(self, *args, **kwargs):
            pass
    socketio = DummySocketIO()

# Global State Worker & Stats
GLOBAL_TRACKED_OBJECTS = {}
LOCATION_TRACKERS = {}
LATEST_DETECTION_STATS = {}

# Asynchronous OCR Thread Pool (Single background worker to prevent CPU starvation)
OCR_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="PlateOCRWorker")
OCR_PENDING_OBJECTS = set()

# Asynchronous YOLO Detector Thread Pool (Decoupled from 25 FPS video streaming loop)
AI_DETECTOR_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="AIDetectorWorker")


def reset_location_data(location_name):
    """Mereset state tracker di memori dan data analitik terkait di database."""
    return _reset_location_data(
        location_name,
        location_trackers=LOCATION_TRACKERS,
        latest_detection_stats=LATEST_DETECTION_STATS,
        global_tracked_objects=GLOBAL_TRACKED_OBJECTS,
    )


def run_detection_worker(
    stream_url, location_name, detection_mode="all", stop_event=None
):
    """
    Worker thread utama untuk satu kamera CCTV.
    Menjalankan loop pembacaan frame, inferensi YOLO, tracking, estimasi kecepatan,
    deteksi pelanggaran, dan publikasi statistik real-time via Socket.IO.
    """
    thread_name = threading.current_thread().name
    print(f"[{thread_name}] WORKER DIMULAI: Memulai deteksi untuk: {location_name}")
    init_database()

    last_odol_notification_time = {}
    last_parking_notification_time = {}
    last_crowd_notification_time = {}

    # Memuat konfigurasi dinamis CCTV
    cctv_config_data = {
        "line1_y": DEFAULT_LINE_1_Y,
        "line2_y": DEFAULT_LINE_2_Y,
        "real_distance_m": DEFAULT_REAL_DISTANCE,
        "pixel_distance": abs(DEFAULT_LINE_2_Y - DEFAULT_LINE_1_Y),
        "homography_src_pts": [
            [200, 250],
            [440, 250],
            [580, 480],
            [60, 480],
        ],
        "real_width_m": 7.0,
    }

    try:
        with get_flask_app_context():
            cctv_obj = CCTV.query.filter_by(lokasi=location_name).first()
            if cctv_obj:
                l1 = getattr(cctv_obj, "line1_y", DEFAULT_LINE_1_Y)
                l2 = getattr(cctv_obj, "line2_y", DEFAULT_LINE_2_Y)
                dist = getattr(cctv_obj, "real_distance_m", DEFAULT_REAL_DISTANCE)

                cctv_config_data["line1_y"] = l1
                cctv_config_data["line2_y"] = l2
                cctv_config_data["real_distance_m"] = dist
                cctv_config_data["pixel_distance"] = max(1, abs(l2 - l1))
    except Exception as e:
        print(f"[{thread_name}] WARNING: Gagal memuat config CCTV dari DB: {e}. Menggunakan default.")

    # Inisialisasi Tracker & Speed Data
    if location_name not in LOCATION_TRACKERS:
        tracker = SimpleObjectTracker(max_disappeared=80, max_distance=280, fps=10)
        LOCATION_TRACKERS[location_name] = tracker
        print(f"[{thread_name}] WORKER INFO: Tracker baru dibuat untuk {location_name}.")
    else:
        tracker = LOCATION_TRACKERS[location_name]
        print(f"[{thread_name}] WORKER INFO: Menggunakan tracker yang sudah ada untuk {location_name}.")

    if location_name not in GLOBAL_TRACKED_OBJECTS:
        GLOBAL_TRACKED_OBJECTS[location_name] = {}
    local_speed_data = GLOBAL_TRACKED_OBJECTS[location_name]

    if location_name not in LATEST_DETECTION_STATS:
        LATEST_DETECTION_STATS[location_name] = {
            "latest_frame": np.zeros((480, 640, 3), dtype=np.uint8),
            "current_tracked_objects": {},
            "crowd_member_ids": set(),
            "is_crowd_detected": False,
            "total_counts": {},
            "stat_parkir": 0,
            "stat_odol": 0,
            "stat_peringatan_aktif": 0,
            "stat_total_pelanggaran": 0,
        }

    frame_count = 0
    crowd_currently_logged = False
    is_crowd = False
    session_parking_count = 0
    session_odol_count = 0
    cap = None

    # Asynchronous YOLO State
    is_detecting = False
    latest_detections = []
    has_new_detections = False
    det_lock = threading.Lock()

    def _bg_yolo(frame_copy):
        nonlocal is_detecting, latest_detections, has_new_detections
        try:
            dets = detect_objects(
                frame_copy, confidence_threshold=0.5, classes_to_detect=[0, 2, 3, 5]
            )
            with det_lock:
                latest_detections = dets
                has_new_detections = True
        except Exception as err:
            pass
        finally:
            is_detecting = False

    try:
        while True:
            if stop_event and stop_event.is_set():
                print(f"[{thread_name}] WORKER INFO: Menerima sinyal berhenti untuk {location_name}.")
                break

            if cap is None:
                print(f"[{thread_name}] WORKER INFO: Mencoba koneksi ke stream {location_name}...")
                cap = get_stream(stream_url)

                if cap is None:
                    time.sleep(2)
                    continue
                else:
                    print(f"[{thread_name}] WORKER INFO: Koneksi stream {location_name} berhasil.")
                    try:
                        socketio.emit(
                            "stream_ready",
                            {"location": location_name, "status": "ready"},
                        )
                    except Exception as e:
                        print(f"[{thread_name}] SocketIO emit error (ready): {e}")

            start_time = time.time()
            ret, frame = cap.read()

            if not ret or frame is None:
                print(f"[{thread_name}] WORKER ERROR: Stream {location_name} terputus. Mencoba reconnect...")
                cap.release()
                cap = None
                time.sleep(5)
                continue

            if frame.shape[1] > 600:
                h_orig, w_orig = frame.shape[:2]
                frame = cv2.resize(frame, (600, int(h_orig * 600 / w_orig)))

            # 1. Trigger background YOLO inference if idle (Asynchronous Decoupled)
            if not is_detecting:
                is_detecting = True
                AI_DETECTOR_EXECUTOR.submit(_bg_yolo, frame.copy())

            # 2. Update tracker when new AI detections are available, or preserve existing tracker objects
            with det_lock:
                if has_new_detections:
                    tracked_objects = tracker.update(
                        latest_detections, cctv_config_data, local_speed_data
                    )
                    has_new_detections = False
                else:
                    tracked_objects = tracker.objects

            # 3. Auto-Scan Plat Nomor Kendaraan (Non-Blocking / Asynchronous)
            if frame_count % 5 == 0:
                for obj_id, obj in tracked_objects.items():
                    if obj["class_name"] in ["car", "motorcycle", "bus", "truck"]:
                        if "plate_number" in tracker.objects[obj_id] or obj_id in OCR_PENDING_OBJECTS:
                            continue
                        area_objek = obj["bbox"][2] * obj["bbox"][3]
                        if area_objek > 3000:
                            x, y, w, h = obj["bbox"]
                            h_f, w_f = frame.shape[:2]
                            x1, y1 = max(0, x), max(0, y)
                            x2, y2 = min(w_f, x + w), min(h_f, y + h)
                            vehicle_crop = frame[y1:y2, x1:x2].copy()

                            OCR_PENDING_OBJECTS.add(obj_id)

                            def _async_ocr_worker(crop, target_id, target_tracker):
                                try:
                                    plat = recognize_plate_from_crop(crop)
                                    if plat and plat not in ["Tidak Terbaca", "Error", "System Error", "Gagal Crop"] and len(plat) > 2:
                                        if target_id in target_tracker.objects:
                                            target_tracker.objects[target_id]["plate_number"] = plat
                                            print(f"✅ [Async OCR] PLAT TERDETEKSI: ID {target_id} -> {plat}")
                                finally:
                                    OCR_PENDING_OBJECTS.discard(target_id)

                            OCR_EXECUTOR.submit(_async_ocr_worker, vehicle_crop, obj_id, tracker)

            # Deteksi Kerumunan
            is_crowd, crowd_ids = detect_crowd(
                tracked_objects, min_crowd_size=5, crowd_radius_threshold=40
            )

            if is_crowd and not crowd_currently_logged:
                current_time = time.time()
                last_notification_time = last_crowd_notification_time.get(location_name, 0)

                if (current_time - last_notification_time) > 30:
                    first_seen_time = (
                        tracker.first_seen.get(list(crowd_ids)[0], current_time)
                        if crowd_ids
                        else current_time
                    )
                    duration = current_time - first_seen_time
                    save_crowd_detection(location_name, len(crowd_ids), duration)
                    crowd_currently_logged = True
                    last_crowd_notification_time[location_name] = current_time

                    if get_notification_enabled():
                        try:
                            socketio.emit(
                                "notifikasi_baru",
                                {
                                    "title": "🚨 Kerumunan Terdeteksi!",
                                    "detail": f"Terdeteksi {len(crowd_ids)} orang berkumpul di {location_name}.",
                                    "icon": "warning",
                                    "location": location_name,
                                },
                            )
                        except Exception as e:
                            print(f"[{thread_name}] SocketIO emit error (crowd): {e}")
            elif not is_crowd:
                crowd_currently_logged = False

            # Deteksi Parkir Liar & ODOL
            current_time = time.time()
            for obj_id, obj in tracked_objects.items():
                if obj["class_name"] in ["car", "motorcycle", "bus"]:
                    last_move = tracker.last_moved.get(obj_id, current_time)
                    parked_duration = current_time - last_move
                    was_parked = tracker.is_parked.get(obj_id, False)
                    now_parked = parked_duration > 50

                    if not was_parked and now_parked:
                        detected_plate = tracker.objects[obj_id].get("plate_number", "Tidak Terbaca")

                        current_time = time.time()
                        last_notification_time = last_parking_notification_time.get(location_name, 0)

                        if (current_time - last_notification_time) > 20:
                            save_parking_violation(
                                location_name,
                                obj["class_name"],
                                parked_duration,
                                obj_id,
                            )
                            session_parking_count += 1
                            last_parking_notification_time[location_name] = current_time

                            if get_notification_enabled():
                                try:
                                    socketio.emit(
                                        "notifikasi_baru",
                                        {
                                            "title": "🅿️ Parkir Liar Terdeteksi!",
                                            "detail": f'{obj["class_name"]} (Plat: {detected_plate}) parkir liar di {location_name}.',
                                            "icon": "error",
                                            "location": location_name,
                                        },
                                    )
                                except Exception as e:
                                    print(f"SocketIO error: {e}")

                        tracker.is_parked[obj_id] = now_parked

                if obj["class_name"] == "bus":
                    aspect_ratio = obj.get("aspect_ratio", 0)
                    area = obj["bbox"][2] * obj["bbox"][3]
                    is_odol = aspect_ratio > 0.8 or area > 10000
                    was_odol_logged = tracker.is_odol_logged.get(obj_id, False)

                    if is_odol and not was_odol_logged:
                        current_time = time.time()
                        last_notification_time = last_odol_notification_time.get(location_name, 0)

                        if (current_time - last_notification_time) > 15:
                            save_odol_detection(
                                location_name, obj["class_name"], aspect_ratio, area
                            )
                            tracker.is_odol_logged[obj_id] = True
                            session_odol_count += 1
                            last_odol_notification_time[location_name] = current_time

                            if get_notification_enabled():
                                try:
                                    socketio.emit(
                                        "notifikasi_baru",
                                        {
                                            "title": "🚚 Deteksi ODOL!",
                                            "detail": f'Kendaraan {obj["class_name"]} (ID: {obj_id}) terindikasi ODOL di {location_name}.',
                                            "icon": "info",
                                            "location": location_name,
                                        },
                                    )
                                except Exception as e:
                                    print(f"[{thread_name}] SocketIO emit error (odol): {e}")

            frame_count += 1

            # Penyimpanan Data Counting Berkala ke Database (setiap 60 frame)
            if frame_count % 60 == 0:
                counts_jauh_data = dict(tracker.counts_menuju_jauh)
                counts_dekat_data = dict(tracker.counts_menuju_dekat)
                save_counting_data(location_name, counts_jauh_data, counts_dekat_data)

            output_frame = draw_bounding_boxes(
                frame,
                tracked_objects,
                tracker,
                location_name=location_name,
                crowd_member_ids=crowd_ids,
                is_crowd=is_crowd,
                config=cctv_config_data,
                speed_data=local_speed_data,
            )

            counts_jauh = dict(tracker.counts_menuju_jauh)
            counts_dekat = dict(tracker.counts_menuju_dekat)

            active_parked_count = sum(1 for parked in tracker.is_parked.values() if parked)
            active_odol_count = sum(1 for odol in tracker.is_odol_logged.values() if odol)
            active_crowd_count = 1 if is_crowd else 0
            session_peringatan_aktif = active_parked_count + active_odol_count + active_crowd_count

            ret_enc, jpeg_buffer = cv2.imencode(
                ".jpg", output_frame, [cv2.IMWRITE_JPEG_QUALITY, 75]
            )
            frame_bytes_untuk_dikirim = jpeg_buffer.tobytes() if ret_enc else None

            current_stats = {
                "frame_id": frame_count,
                "latest_frame": frame_bytes_untuk_dikirim,
                "current_tracked_objects": tracked_objects,
                "crowd_member_ids": list(crowd_ids),
                "is_crowd_detected": is_crowd,
                "counts_jauh": counts_jauh,
                "counts_dekat": counts_dekat,
                "stat_parkir": session_parking_count,
                "stat_odol": session_odol_count,
                "stat_peringatan_aktif": session_peringatan_aktif,
                "stat_total_pelanggaran": session_parking_count + session_odol_count,
            }

            LATEST_DETECTION_STATS[location_name] = current_stats

            if frame_count % 10 == 0:
                speed_values = []
                for obj_id, obj in tracked_objects.items():
                    if obj["class_name"] in ["car", "motorcycle", "bus", "truck"]:
                        if obj_id in local_speed_data and "speed" in local_speed_data[obj_id]:
                            speed_values.append(local_speed_data[obj_id]["speed"])
                        else:
                            speed_values.append(0)

                valid_speed_values = [s for s in speed_values if s > 0]
                avg_speed = (
                    sum(valid_speed_values) / len(valid_speed_values)
                    if valid_speed_values
                    else 0
                )

                speed_jauh = []
                speed_dekat = []
                line1_y_local = cctv_config_data["line1_y"]
                line2_y_local = cctv_config_data["line2_y"]

                for obj_id, obj in local_speed_data.items():
                    try:
                        last_y = obj["last_y"]
                        if last_y < line1_y_local and obj["speed"] > 0:
                            speed_jauh.append(obj["speed"])
                        elif last_y > line2_y_local and obj["speed"] > 0:
                            speed_dekat.append(obj["speed"])
                    except Exception:
                        pass

                avg_speed_jauh = sum(speed_jauh) / len(speed_jauh) if speed_jauh else 0
                avg_speed_dekat = sum(speed_dekat) / len(speed_dekat) if speed_dekat else 0

                stats_packet = {
                    "location": location_name,
                    "is_crowd_detected": is_crowd,
                    "counts_jauh_mobil": counts_jauh.get("car", 0),
                    "counts_jauh_motor": counts_jauh.get("motorcycle", 0),
                    "counts_jauh_bus": counts_jauh.get("bus", 0),
                    "counts_jauh_truck": counts_jauh.get("truck", 0),
                    "counts_jauh_orang": counts_jauh.get("person", 0),
                    "counts_dekat_mobil": counts_dekat.get("car", 0),
                    "counts_dekat_motor": counts_dekat.get("motorcycle", 0),
                    "counts_dekat_bus": counts_dekat.get("bus", 0),
                    "counts_dekat_truck": counts_dekat.get("truck", 0),
                    "counts_dekat_orang": counts_dekat.get("person", 0),
                    "avg_speed": avg_speed,
                    "speed_jauh": avg_speed_jauh,
                    "speed_dekat": avg_speed_dekat,
                    "stat_parkir": session_parking_count,
                    "stat_odol": session_odol_count,
                }

                socketio.emit("update_stats_realtime", stats_packet)

            end_time = time.time()
            elapsed_time = end_time - start_time
            target_fps = 25  # Kecepatan penuh native kamera (Lancar Jaya 25 FPS)
            target_delay = 1.0 / target_fps
            if elapsed_time < target_delay:
                time.sleep(target_delay - elapsed_time)

    except Exception as e:
        print(f"[{thread_name}] Error Kritis di WORKER {location_name}: {e}")
    finally:
        if cap:
            cap.release()
        if location_name in LATEST_DETECTION_STATS:
            del LATEST_DETECTION_STATS[location_name]
        print(f"[{thread_name}] WORKER {location_name} telah berhenti.")


def generate_frames(stream_url, location_name, detection_mode="simple"):
    """
    Menghasilkan stream multipart MJPEG langsung dari LATEST_DETECTION_STATS
    untuk dikonsumsi oleh Next.js tag <img> secara efisien (anti-duplikasi).
    """
    location_name = str(location_name).strip()
    print(f"[{threading.current_thread().name}] STREAM DIMULAI: Menyalurkan video untuk: {location_name}")

    error_frame_bytes = None
    try:
        error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            error_frame,
            "Menghubungkan ke stream...",
            (50, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 255),
            2,
        )
        ret, buffer = cv2.imencode(".jpg", error_frame)
        if ret:
            error_frame_bytes = buffer.tobytes()
    except Exception as e:
        print(f"Error membuat frame error: {e}")

    last_yielded_frame_id = None
    last_yield_time = 0

    try:
        while True:
            frame_to_yield = None
            current_frame_id = None

            if location_name in LATEST_DETECTION_STATS:
                stats = LATEST_DETECTION_STATS[location_name]
                frame_data = stats.get("latest_frame")
                current_frame_id = stats.get("frame_id", 0)

                now = time.time()
                is_new_frame = (current_frame_id != last_yielded_frame_id)
                is_heartbeat = (now - last_yield_time > 1.0)

                if (is_new_frame or is_heartbeat) and frame_data is not None:
                    if isinstance(frame_data, np.ndarray):
                        ret, buffer = cv2.imencode(".jpg", frame_data)
                        if ret:
                            frame_to_yield = buffer.tobytes()
                    elif isinstance(frame_data, bytes):
                        frame_to_yield = frame_data

                    if frame_to_yield:
                        last_yielded_frame_id = current_frame_id
                        last_yield_time = now
                        yield (
                            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                            + frame_to_yield
                            + b"\r\n"
                        )
            else:
                if error_frame_bytes:
                    yield (
                        b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                        + error_frame_bytes
                        + b"\r\n"
                    )
                time.sleep(0.015)
                continue

            time.sleep(0.015)

    except GeneratorExit:
        print(f"[{threading.current_thread().name}] STREAM DIHENTIKAN: Klien menutup koneksi {location_name}.")
    except Exception as e:
        print(f"[{threading.current_thread().name}] Error di generate_frames untuk {location_name}: {e}")
    finally:
        print(f"[{threading.current_thread().name}] Sesi STREAMING untuk {location_name} selesai.")


def get_counting_summary(location, hours=24):
    """Stub utilitas pelaporan histori counting."""
    pass


if __name__ == "__main__":
    print("Analyzer module ready. Must be run via run.py.")
