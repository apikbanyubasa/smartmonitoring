"""
Modul Tracking Objek & Homography Perspektif untuk DaashTics.
Menangani pelacakan kendaraan antarfram, estimasi kecepatan via Homography Bird's Eye,
dan deteksi perpindahan zona/arah.
"""

import math
import time
import threading
from collections import defaultdict, deque
import cv2
import numpy as np

ZONE_JAUH = 1
ZONE_TENGAH = 2
ZONE_DEKAT = 3


def get_point_side(point_x, point_y, line_x1, line_y1, line_x2, line_y2):
    """Menentukan sisi posisi titik relatif terhadap garis pemisah lintasan."""
    return (point_x - line_x1) * (line_y2 - line_y1) - (point_y - line_y1) * (
        line_x2 - line_x1
    )


class SimpleObjectTracker:
    def __init__(
        self, max_disappeared=30, max_distance=50, initial_counts=None, fps=20
    ):
        self.next_object_id = 0
        self.objects = {}
        self.disappeared = defaultdict(int)
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        self.object_zone = defaultdict(int)
        self.counts_menuju_jauh = defaultdict(int)
        self.counts_menuju_dekat = defaultdict(int)
        self.first_seen = defaultdict(float)
        self.counted = defaultdict(bool)
        self.last_moved = defaultdict(float)
        self.is_parked = defaultdict(bool)
        self.is_odol_logged = defaultdict(bool)
        self.plate_logged = defaultdict(bool)
        self.history = defaultdict(lambda: deque(maxlen=10))
        self.fps = fps
        self.speed_history = defaultdict(lambda: deque(maxlen=5))

        self.perspective_matrix = None
        self.pixels_per_meter = None
        self.dst_size = (500, 600)

    def init_perspective(self, src_pts_list, real_width_m=3.5):
        """
        src_pts_list: List 4 koordinat [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] dari config
        real_width_m: Lebar asli jalan (meter) yang diwakili oleh lebar dst_size
        """
        if src_pts_list is not None:
            self.src_pts = np.array(src_pts_list, dtype=np.float32)
            w, h = self.dst_size
            dst_pts = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)

            try:
                self.perspective_matrix = cv2.getPerspectiveTransform(self.src_pts, dst_pts)
                self.pixels_per_meter = w / real_width_m
            except Exception as e:
                print(f"[Tracker] Gagal init perspective: {e}")
                self.perspective_matrix = None

    def transform_to_birdseye(self, point):
        """Konversi titik koordinat kamera ke titik Bird-Eye View."""
        if self.perspective_matrix is None:
            return point

        pt_np = np.array([[[point[0], point[1]]]], dtype=np.float32)
        warped = cv2.perspectiveTransform(pt_np, self.perspective_matrix)
        return (float(warped[0][0][0]), float(warped[0][0][1]))

    def reset_completely(self):
        """Mereset seluruh data pelacakan di memori."""
        self.next_object_id = 0
        self.objects.clear()
        self.disappeared.clear()
        self.history.clear()
        self.speed_history.clear()
        self.plate_logged.clear()
        self.is_parked.clear()
        self.is_odol_logged.clear()
        self.last_moved.clear()
        self.first_seen.clear()
        self.counted.clear()
        self.object_zone.clear()
        self.counts_menuju_jauh.clear()
        self.counts_menuju_dekat.clear()

    def calculate_distance(self, point1, point2):
        return math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2)

    def register(self, detection):
        class_name = detection["class_name"]
        obj_id = self.next_object_id
        self.objects[obj_id] = {
            "center": detection["center"],
            "bbox": detection["bbox"],
            "class_name": class_name,
            "class_id": detection["class_id"],
            "confidence": detection["confidence"],
            "counted": False,
            "prev_center": detection["center"],
        }
        self.disappeared[obj_id] = 0
        current_time = time.time()
        self.first_seen[obj_id] = current_time
        self.counted[obj_id] = False
        self.last_moved[obj_id] = current_time
        self.is_parked[obj_id] = False
        self.is_odol_logged[obj_id] = False
        self.plate_logged[obj_id] = False
        self.next_object_id += 1

    def deregister(self, object_id):
        for d in [
            self.objects,
            self.disappeared,
            self.history,
            self.speed_history,
            self.is_odol_logged,
            self.plate_logged,
            self.is_parked,
            self.last_moved,
            self.first_seen,
            self.counted,
            self.object_zone,
        ]:
            d.pop(object_id, None)

    def update(self, detections, config, local_speed_data):
        if self.perspective_matrix is None and "homography_src_pts" in config:
            self.init_perspective(config["homography_src_pts"], config.get("real_width_m", 3.5))

        line1_y = config["line1_y"]
        line2_y = config["line2_y"]

        if len(detections) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
                    local_speed_data.pop(object_id, None)
            return self.objects

        if len(self.objects) == 0:
            for detection in detections:
                self.register(detection)
            return self.objects

        object_ids = list(self.objects.keys())
        used_detection_indices = set()
        used_object_ids = set()

        for detection_idx, detection in enumerate(detections):
            min_distance = float("inf")
            min_object_id = None
            for object_id in object_ids:
                if object_id in used_object_ids:
                    continue
                dist = self.calculate_distance(detection["center"], self.objects[object_id]["center"])
                if dist < min_distance and dist < self.max_distance:
                    min_distance = dist
                    min_object_id = object_id

            if min_object_id is not None:
                self.objects[min_object_id]["center"] = detection["center"]
                self.objects[min_object_id]["bbox"] = detection["bbox"]
                self.objects[min_object_id]["confidence"] = detection["confidence"]
                self.disappeared[min_object_id] = 0

                obj_id = min_object_id
                center_x, center_y = self.objects[obj_id]["center"]
                class_name = self.objects[obj_id]["class_name"]

                self.history[obj_id].append((center_x, center_y, time.time()))

                # Logika Penghitungan Zona
                side_1 = get_point_side(center_x, center_y, 0, line1_y, 600, line1_y)
                side_2 = get_point_side(center_x, center_y, 0, line2_y, 600, line2_y)

                current_zone = 0
                if side_1 > 0:
                    current_zone = ZONE_JAUH
                elif side_1 < 0 and side_2 > 0:
                    current_zone = ZONE_TENGAH
                elif side_2 < 0:
                    current_zone = ZONE_DEKAT

                previous_zone = self.object_zone[obj_id]
                if current_zone != 0 and previous_zone != current_zone:
                    if previous_zone == ZONE_DEKAT and current_zone == ZONE_TENGAH:
                        self.object_zone[obj_id] = ZONE_TENGAH
                    elif previous_zone == ZONE_TENGAH and current_zone == ZONE_JAUH:
                        self.counts_menuju_jauh[class_name] += 1
                        self.object_zone[obj_id] = ZONE_JAUH
                    elif previous_zone == ZONE_JAUH and current_zone == ZONE_TENGAH:
                        self.object_zone[obj_id] = ZONE_TENGAH
                    elif previous_zone == ZONE_TENGAH and current_zone == ZONE_DEKAT:
                        self.counts_menuju_dekat[class_name] += 1
                        self.object_zone[obj_id] = ZONE_DEKAT
                    elif previous_zone == 0:
                        self.object_zone[obj_id] = current_zone

                # Logika Kecepatan Berbasis Homography
                if class_name in ["car", "motorcycle", "bus", "truck"]:
                    now_ts = time.time()
                    curr_be_point = self.transform_to_birdseye((center_x, center_y))

                    if obj_id not in local_speed_data:
                        local_speed_data[obj_id] = {
                            "birdseye_pos": curr_be_point,
                            "last_y": center_y,
                            "timestamp": now_ts,
                            "speed": 0.0,
                        }
                    else:
                        prev_data = local_speed_data[obj_id]
                        prev_be_point = prev_data.get("birdseye_pos", curr_be_point)
                        prev_ts = prev_data["timestamp"]
                        dt = now_ts - prev_ts

                        if dt > 0.02:
                            dx = curr_be_point[0] - prev_be_point[0]
                            dy = curr_be_point[1] - prev_be_point[1]
                            dist_px = math.hypot(dx, dy)

                            if self.pixels_per_meter:
                                dist_m = dist_px / self.pixels_per_meter
                            else:
                                pixel_dist_ref = config["pixel_distance"]
                                real_dist_ref = config["real_distance_m"]
                                dist_m = (dist_px / max(1, pixel_dist_ref)) * real_dist_ref

                            speed_ms = dist_m / dt
                            speed_kmh = speed_ms * 3.6

                            self.speed_history[obj_id].append(speed_kmh)
                            smoothed_speed = float(np.median(list(self.speed_history[obj_id])))

                            local_speed_data[obj_id]["speed"] = smoothed_speed
                            local_speed_data[obj_id]["birdseye_pos"] = curr_be_point
                            local_speed_data[obj_id]["last_y"] = center_y
                            local_speed_data[obj_id]["timestamp"] = now_ts

                used_detection_indices.add(detection_idx)
                used_object_ids.add(min_object_id)

        for detection_idx, detection in enumerate(detections):
            if detection_idx not in used_detection_indices:
                self.register(detection)

        for object_id in object_ids:
            if object_id not in used_object_ids:
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
                    local_speed_data.pop(object_id, None)
            else:
                current_center = self.objects[object_id]["center"]
                prev_center = self.objects[object_id].get("prev_center", current_center)
                move_dist = self.calculate_distance(current_center, prev_center)

                if move_dist > 5:
                    self.last_moved[object_id] = time.time()
                    self.is_parked[object_id] = False
                    self.is_odol_logged[object_id] = False
                    self.plate_logged[object_id] = False

                self.objects[object_id]["prev_center"] = current_center

        return self.objects
