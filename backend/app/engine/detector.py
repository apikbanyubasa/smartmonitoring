"""
Modul Deteksi Objek, Plat Nomor, Kerumunan & Anotasi Visual OpenCV.
Mengintegrasikan YOLOv8n untuk klasifikasi kendaraan/pejalan kaki,
model kustom YOLO plat nomor + EasyOCR, serta clustering kerumunan.
"""

import os
import re
import math
import threading
import cv2
import numpy as np
import easyocr
from ultralytics import YOLO

# Konfigurasi deteksi kelas COCO
DETECTION_CLASSES = {
    0: "person",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

COLORS = {
    "person": (30, 144, 255),
    "car": (30, 255, 144),
    "motorcycle": (255, 255, 30),
    "bus": (144, 30, 255),
    "truck": (255, 165, 0),
    "crowd": (0, 0, 255),
    "parking": (255, 0, 0),
    "odol": (0, 255, 255),
}

DEFAULT_LINE_1_Y = 198
DEFAULT_LINE_2_Y = 244
DEFAULT_REAL_DISTANCE = 3.5


def get_model_path(filename):
    """Mencari path bobot model di folder weights atau models."""
    engine_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(engine_dir)
    backend_dir = os.path.dirname(app_dir)
    root_dir = os.path.dirname(backend_dir)

    candidates = []
    for folder in ["weights", "models"]:
        candidates.extend([
            os.path.join(backend_dir, folder, filename),
            os.path.join(root_dir, folder, filename),
            os.path.join(root_dir, "backend", folder, filename),
            os.path.join(folder, filename),
            os.path.join("backend", folder, filename),
        ])

    for path in candidates:
        if os.path.exists(path):
            return path

    return os.path.join("weights", filename)


# Inisialisasi Model YOLOv8 Objek
try:
    model = YOLO(get_model_path("yolov8n.pt"))
    print("✅ YOLOv8n object model loaded successfully.")
except Exception as e:
    print(f"⚠️ Warning loading YOLOv8n: {e}")
    model = None

# Inisialisasi Model YOLO Plat Nomor
try:
    plate_model = YOLO(get_model_path("best.pt"))
    print("✅ YOLO Plate model loaded successfully.")
except Exception as e:
    print(f"⚠️ Warning loading plate model: {e}")
    plate_model = None

# Inisialisasi EasyOCR Reader
try:
    READER_OCR = easyocr.Reader(["id", "en"], gpu=False)
    print("✅ EasyOCR reader siap.")
except Exception as e:
    print(f"⚠️ Warning loading EasyOCR: {e}")
    READER_OCR = None


def detect_objects(frame, confidence_threshold=0.4, classes_to_detect=None):
    """Mendeteksi objek kendaraan dan manusia pada satu frame gambar."""
    if model is None:
        return []
    try:
        # Menggunakan imgsz=480 untuk optimasi latensi inferensi di CPU
        results = model(
            frame,
            conf=confidence_threshold,
            classes=classes_to_detect,
            imgsz=480,
            verbose=False,
        )
        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    class_id = int(box.cls[0])
                    if classes_to_detect is None or class_id in classes_to_detect:
                        confidence = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        detection = {
                            "class_id": class_id,
                            "class_name": DETECTION_CLASSES.get(class_id, "unknown"),
                            "confidence": confidence,
                            "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                            "center": [int((x1 + x2) / 2), int((y1 + y2) / 2)],
                            "aspect_ratio": (
                                (y2 - y1) / (x2 - x1) if (x2 - x1) > 0 else 0
                            ),
                            "area": (x2 - x1) * (y2 - y1),
                        }
                        detections.append(detection)
        return detections
    except Exception as e:
        print(f"[{threading.current_thread().name}] Detection error: {e}")
        return []


def recognize_plate_from_crop(vehicle_crop):
    """Mendeteksi plat nomor pada potongan kendaraan lalu membacanya via OCR."""
    if READER_OCR is None or plate_model is None:
        return "System Error"
    if vehicle_crop is None or vehicle_crop.size == 0:
        return "Gagal Crop"

    try:
        results = plate_model(vehicle_crop, conf=0.25, verbose=False)
        for result in results:
            boxes = result.boxes
            if len(boxes) > 0:
                best_box = boxes[0]
                px1, py1, px2, py2 = best_box.xyxy[0].tolist()
                plate_img = vehicle_crop[int(py1):int(py2), int(px1):int(px2)]
                if plate_img.size == 0:
                    continue

                gray_plate = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
                _, binary_plate = cv2.threshold(
                    gray_plate, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
                )

                ocr_result = READER_OCR.readtext(
                    binary_plate,
                    detail=0,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                )

                if ocr_result:
                    raw_text = "".join(ocr_result).upper().replace(" ", "")
                    pola_plat = r"^[A-Z]{1,2}\d{1,4}[A-Z]{1,3}$"
                    if re.match(pola_plat, raw_text):
                        return raw_text

        return "Tidak Terbaca"
    except Exception as e:
        print(f"Error proses plat: {e}")
        return "Error"


def recognize_plate(frame, vehicle_bbox):
    """Mendeteksi plat nomor menggunakan model plat lalu membacanya via OCR."""
    x, y, w, h = vehicle_bbox
    h_img, w_img, _ = frame.shape

    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(w_img, x + w), min(h_img, y + h)

    vehicle_crop = frame[y1:y2, x1:x2]
    return recognize_plate_from_crop(vehicle_crop)


def detect_crowd(tracked_objects, min_crowd_size=2, crowd_radius_threshold=100):
    """Mendeteksi kerumunan dari objek person yang saling berdekatan."""
    people_objects = {
        oid: obj
        for oid, obj in tracked_objects.items()
        if obj["class_name"] == "person"
    }

    if len(people_objects) < min_crowd_size:
        return False, set()

    centers = []
    obj_ids = []
    for obj_id, obj in people_objects.items():
        centers.append(obj["center"])
        obj_ids.append(obj_id)

    n = len(centers)
    adj_matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            dist = math.sqrt(
                (centers[i][0] - centers[j][0]) ** 2
                + (centers[i][1] - centers[j][1]) ** 2
            )
            if dist < crowd_radius_threshold:
                adj_matrix[i][j] = 1
                adj_matrix[j][i] = 1

    visited = [False] * n
    crowd_member_ids = set()
    for i in range(n):
        if not visited[i]:
            component = []
            queue = [i]
            visited[i] = True
            idx = 0
            while idx < len(queue):
                u = queue[idx]
                idx += 1
                component.append(u)
                for v in range(n):
                    if adj_matrix[u][v] == 1 and not visited[v]:
                        visited[v] = True
                        queue.append(v)
            if len(component) >= min_crowd_size:
                for idx_in_component in component:
                    crowd_member_ids.add(obj_ids[idx_in_component])

    return len(crowd_member_ids) > 0, crowd_member_ids


def draw_bounding_boxes(
    frame,
    tracked_objects,
    tracker,
    location_name="unknown",
    crowd_member_ids=None,
    is_crowd=False,
    config=None,
    speed_data=None,
):
    """Menggambar kotak deteksi, label kecepatan, dan overlay tabel analitik pada frame."""
    if crowd_member_ids is None:
        crowd_member_ids = set()
    output_frame = frame.copy()

    config = config if config is not None else {}
    line1_y = config.get("line1_y", DEFAULT_LINE_1_Y)
    line2_y = config.get("line2_y", DEFAULT_LINE_2_Y)

    # Garis Pembatas Deteksi
    cv2.line(output_frame, (0, line1_y), (600, line1_y), (0, 255, 255), 2)
    cv2.line(output_frame, (0, line2_y), (600, line2_y), (0, 255, 255), 2)

    ARROW_SIZE = 15
    ARROW_COLOR_JAUH = (0, 255, 0)
    ARROW_COLOR_DEKAT = (0, 0, 255)

    triangle_jauh_coords = np.array(
        [
            [200 - ARROW_SIZE, line1_y],
            [200 + ARROW_SIZE, line1_y],
            [200, line1_y - ARROW_SIZE],
        ],
        np.int32,
    )
    cv2.fillPoly(output_frame, [triangle_jauh_coords], ARROW_COLOR_JAUH)

    triangle_dekat_coords = np.array(
        [
            [450 - ARROW_SIZE, line2_y],
            [450 + ARROW_SIZE, line2_y],
            [450, line2_y + ARROW_SIZE],
        ],
        np.int32,
    )
    cv2.fillPoly(output_frame, [triangle_dekat_coords], ARROW_COLOR_DEKAT)

    # Tabel Ringkasan Counting Pojok Kiri Atas
    COL_LABELS = ["Arah", "MOBIL", "MOTOR", "BUS", "TRUK"]
    START_X = 10
    START_Y = 12
    COL_WIDTH = 50
    ROW_HEIGHT = 16
    FONT_SCALE = 0.35
    FONT_THICKNESS = 1
    CENTER_OFFSET = 15
    TEXT_HEIGHT_PAD = 3

    TABLE_X_END = START_X + len(COL_LABELS) * COL_WIDTH
    TABLE_Y_END = 5 + 3 * ROW_HEIGHT + 3
    BORDER_COLOR = (100, 100, 100)

    cv2.rectangle(output_frame, (5, 5), (TABLE_X_END, TABLE_Y_END), (0, 0, 0), -1)
    cv2.line(output_frame, (5, START_Y + 4), (TABLE_X_END, START_Y + 4), BORDER_COLOR, FONT_THICKNESS)
    cv2.line(output_frame, (5, START_Y + ROW_HEIGHT + 4), (TABLE_X_END, START_Y + ROW_HEIGHT + 4), BORDER_COLOR, FONT_THICKNESS)
    cv2.line(output_frame, (5, TABLE_Y_END), (TABLE_X_END, TABLE_Y_END), BORDER_COLOR, FONT_THICKNESS)

    for i in range(len(COL_LABELS) + 1):
        x_pos = START_X + i * COL_WIDTH
        cv2.line(output_frame, (x_pos, 5), (x_pos, TABLE_Y_END), BORDER_COLOR, FONT_THICKNESS)

    for i, label in enumerate(COL_LABELS):
        x_pos = START_X + i * COL_WIDTH
        cv2.putText(
            output_frame,
            label,
            (x_pos + 3, START_Y),
            cv2.FONT_HERSHEY_SIMPLEX,
            FONT_SCALE,
            (255, 255, 255),
            FONT_THICKNESS,
        )

    Y_ROW_ATAS = START_Y + ROW_HEIGHT
    counts_jauh = tracker.counts_menuju_jauh if tracker else {}
    cv2.putText(
        output_frame,
        "ATAS",
        (START_X + 3, Y_ROW_ATAS + TEXT_HEIGHT_PAD),
        cv2.FONT_HERSHEY_SIMPLEX,
        FONT_SCALE,
        (0, 255, 0),
        FONT_THICKNESS,
    )
    categories = ["car", "motorcycle", "bus", "truck"]
    for i, category in enumerate(categories):
        x_pos = START_X + (i + 1) * COL_WIDTH + CENTER_OFFSET
        count_val = counts_jauh.get(category, 0)
        cv2.putText(
            output_frame,
            str(count_val),
            (x_pos, Y_ROW_ATAS + TEXT_HEIGHT_PAD),
            cv2.FONT_HERSHEY_SIMPLEX,
            FONT_SCALE,
            (0, 255, 0),
            FONT_THICKNESS,
        )

    Y_ROW_BAWAH = START_Y + 2 * ROW_HEIGHT
    counts_dekat = tracker.counts_menuju_dekat if tracker else {}
    cv2.putText(
        output_frame,
        "BAWAH",
        (START_X + 3, Y_ROW_BAWAH + TEXT_HEIGHT_PAD),
        cv2.FONT_HERSHEY_SIMPLEX,
        FONT_SCALE,
        (0, 255, 255),
        FONT_THICKNESS,
    )
    for i, category in enumerate(categories):
        x_pos = START_X + (i + 1) * COL_WIDTH + CENTER_OFFSET
        count_val = counts_dekat.get(category, 0)
        cv2.putText(
            output_frame,
            str(count_val),
            (x_pos, Y_ROW_BAWAH + TEXT_HEIGHT_PAD),
            cv2.FONT_HERSHEY_SIMPLEX,
            FONT_SCALE,
            (0, 255, 255),
            FONT_THICKNESS,
        )

    local_speed = speed_data or {}

    for object_id, obj in tracked_objects.items():
        bbox = obj["bbox"]
        class_name = obj["class_name"]
        x, y, w, h = bbox

        color = COLORS.get(class_name, (255, 255, 255))
        speed = local_speed.get(object_id, {}).get("speed", 0)

        plat_nomor = None
        if tracker and object_id in tracker.objects:
            plat_nomor = tracker.objects[object_id].get("plate_number")

        if plat_nomor:
            label_text = f"{object_id} [{speed:.1f} km/h] {plat_nomor}"
            color = (0, 255, 0)
        else:
            label_text = f"{object_id} [{speed:.1f} km/h]"

        if class_name == "person" and object_id in crowd_member_ids:
            color = COLORS["crowd"]

        if tracker:
            if tracker.is_parked.get(object_id, False):
                color = COLORS["parking"]
                label_text = "PARKIR LIAR"
            elif tracker.is_odol_logged.get(object_id, False):
                color = COLORS["odol"]
                label_text = "ODOL"

        font_scale = 0.28
        padding = 2
        font_thickness = 1
        (text_width, text_height), baseline = cv2.getTextSize(
            label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
        )
        label_bg_y1 = max(0, y - text_height - padding * 2)
        label_bg_y2 = y
        if y - text_height - padding * 2 < 0:
            label_bg_y1 = y
            label_bg_y2 = y + text_height + padding * 2

        cv2.rectangle(
            output_frame,
            (x, label_bg_y1),
            (x + text_width + padding, label_bg_y2),
            color,
            -1,
        )
        cv2.putText(
            output_frame,
            label_text,
            (x + int(padding / 2), y - padding if y - text_height - padding * 2 >= 0 else y + text_height + padding),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0, 0, 0),
            font_thickness,
        )
        cv2.rectangle(output_frame, (x, y), (x + w, y + h), color, 1)

    return output_frame
