"""
Tool Pencari Koordinat Titik Deteksi Garis CCTV (600px).
"""
import cv2
import numpy as np

# --- PENGATURAN ---
IMAGE_PATH = 'live_cctv.jpg'  # Pastikan file screenshot ini tersedia
TARGET_WIDTH = 600  # Samakan dengan lebar di engine/analyzer.py
# --- AKHIR PENGATURAN ---

img_display = None
original_img = None
resize_ratio = 1.0

def print_coords(event, x, y, flags, param):
    """Callback function saat mouse di-klik"""
    global img_display
    
    if event == cv2.EVENT_LBUTTONUP:
        print(f"Koordinat BARU (untuk {TARGET_WIDTH}px): ({x}, {y})")
        # Gambar lingkaran merah di titik yang di-klik
        cv2.circle(img_display, (x, y), 3, (0, 0, 255), -1) 
        cv2.imshow(f"Klik untuk Koordinat (RESIZED {TARGET_WIDTH}px)", img_display)

def main():
    global img_display, original_img, resize_ratio
    # 1. Muat gambar
    original_img = cv2.imread(IMAGE_PATH)
    if original_img is None:
        print(f"ERROR: Gagal memuat gambar dari '{IMAGE_PATH}'")
        print("Silakan simpan satu frame CCTV dengan nama 'live_cctv.jpg' di direktori ini.")
        return

    # 2. Resize gambar ke resolusi standar analisis
    h, w = original_img.shape[:2]
    resize_ratio = TARGET_WIDTH / w
    new_h = int(h * resize_ratio)
    img_display = cv2.resize(original_img, (TARGET_WIDTH, new_h))

    # 3. Buat jendela dan pasang callback
    win_name = f"Klik untuk Koordinat (RESIZED {TARGET_WIDTH}px)"
    cv2.namedWindow(win_name)
    cv2.setMouseCallback(win_name, print_coords)

    print("--- Alat Pencari Koordinat (x,y) ---")
    print(f"Gambar telah di-resize ke lebar {TARGET_WIDTH}px.")
    print("\n1. Buka jendela gambar yang muncul.")
    print("2. Klik di ujung-ujung garis deteksi Anda.")
    print("3. Catat koordinat (x, y) yang muncul di terminal.")
    print("4. Tekan tombol 'q' di jendela gambar jika sudah selesai.\n")
    
    cv2.imshow(win_name, img_display)
    
    while True:
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
