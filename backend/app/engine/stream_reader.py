"""
Modul Pembaca Stream Video Real-Time untuk OpenCV.
Menangani koneksi dan decoding feed kamera RTSP, HLS/M3U8, dan video files
menggunakan background thread penguras buffer (anti-lag / zero latency).
"""

import time
import threading
import cv2


def _open_raw_m3u8(m3u8_url, max_retries=3):
    """Membuka stream HLS/M3U8 dengan mekanisme percobaan ulang (retry)."""
    for attempt in range(max_retries):
        cap = None
        try:
            cap = cv2.VideoCapture(m3u8_url)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            ret, test_frame = cap.read()
            if ret and test_frame is not None:
                print(f"[{threading.current_thread().name}] Stream M3U8 terhubung: {m3u8_url}")
                return cap
            else:
                if cap:
                    cap.release()
        except Exception as e:
            print(f"[{threading.current_thread().name}] Percobaan koneksi M3U8 ({attempt + 1}) gagal: {e}")
            if cap:
                try:
                    cap.release()
                except Exception:
                    pass
            if attempt < max_retries - 1:
                time.sleep(1.5)

    print(f"[{threading.current_thread().name}] Gagal menghubungkan ke stream setelah {max_retries} percobaan.")
    return None


def _open_raw_stream(stream_url):
    """Membuka stream video mentah berdasarkan protokol URL."""
    if stream_url.startswith("rtsp://"):
        print(f"[{threading.current_thread().name}] Membuka RTSP stream: {stream_url}")
        cap = cv2.VideoCapture(stream_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        ret, test_frame = cap.read()
        if ret and test_frame is not None:
            print(f"[{threading.current_thread().name}] RTSP terhubung.")
            return cap
        else:
            print(f"[{threading.current_thread().name}] RTSP gagal dibuka.")
            if cap:
                cap.release()
            return None

    elif stream_url.endswith(".m3u8") or ".m3u8?" in stream_url or "http://" in stream_url or "https://" in stream_url:
        return _open_raw_m3u8(stream_url)

    else:
        # Fallback coba buka langsung (misal MP4 atau webcam device index)
        try:
            device = int(stream_url) if str(stream_url).isdigit() else stream_url
            cap = cv2.VideoCapture(device)
            if cap.isOpened():
                return cap
        except Exception:
            pass

        print(f"[{threading.current_thread().name}] Format stream tidak dikenal: {stream_url}")
        return None


class FreshStreamReader:
    """
    Wrapper VideoCapture multi-threaded yang menguras buffer network stream secara asinkron.
    Memastikan pemanggilan .read() SELALU menghasilkan frame terbaru (real-time/zero latency)
    tanpa terpengaruh penumpukan buffer FFmpeg/HLS/RTSP.
    """

    def __init__(self, stream_url):
        self.stream_url = stream_url
        self.cap = None
        self.latest_frame = None
        self.ret = False
        self.running = True
        self.lock = threading.Lock()
        self._init_capture()
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def _init_capture(self):
        self.cap = _open_raw_stream(self.stream_url)
        if self.cap:
            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.latest_frame = frame
                    self.ret = True

    def _capture_loop(self):
        while self.running:
            cap_local = self.cap
            if cap_local is None or not cap_local.isOpened():
                time.sleep(1.5)
                if not self.running:
                    break
                self._init_capture()
                continue

            try:
                ret, frame = cap_local.read()
            except Exception:
                break

            if ret and frame is not None:
                with self.lock:
                    self.latest_frame = frame
                    self.ret = True
                time.sleep(0.01)  # Jeda mikro agar capture thread tetap stabil di ~25-30 FPS
            else:
                time.sleep(0.04)

    def read(self):
        with self.lock:
            if self.ret and self.latest_frame is not None:
                return True, self.latest_frame.copy()
            return False, None

    def release(self):
        self.running = False
        cap_to_release = self.cap
        self.cap = None
        if cap_to_release:
            try:
                cap_to_release.release()
            except Exception:
                pass

    def isOpened(self):
        return self.running and (self.cap is not None and self.cap.isOpened())


def get_stream(stream_url):
    """Membuka stream video real-time dengan background buffer flusher."""
    reader = FreshStreamReader(stream_url)
    # Beri waktu hingga 4 detik untuk mendapatkan frame pertama
    for _ in range(40):
        if reader.ret and reader.latest_frame is not None:
            return reader
        time.sleep(0.1)

    reader.release()
    return None


def get_stream_from_m3u8(m3u8_url, max_retries=3):
    """Kompatibilitas: Membuka stream HLS/M3U8 via get_stream."""
    return get_stream(m3u8_url)


def generate_frames_preview_only(stream_url):
    """Generator frame sederhana tanpa deteksi YOLO untuk preview cepat."""
    cap = get_stream(stream_url)
    if not cap:
        return

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            ret_encode, buffer = cv2.imencode(".jpg", frame)
            if not ret_encode:
                continue
            frame_bytes = buffer.tobytes()
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
            time.sleep(0.04)
    finally:
        cap.release()
