# Panduan Menjalankan DaashTics Monorepo (Flask REST API + Next.js Frontend)

Arsitektur DaashTics telah berhasil dipisahkan menjadi dua lapisan mandiri berstandar **Senior Fullstack Enterprise**:

```
analisis/ (Root)
│
├── app/                  # FLASK BACKEND REST API (:5000)
│   ├── api/              # Endpoint RESTful JSON (/api/v1/*)
│   ├── engine/           # Computer Vision / YOLO / OpenCV AI
│   ├── models.py         # Database PostgreSQL & SQLAlchemy
│   └── security.py       # Zero-Trust JWT Auth, CORS & Rate Limiter
│
└── frontend/             # NEXT.JS FRONTEND (:3000)
    ├── src/
    │   ├── app/          # Next.js App Router (Admin & Public)
    │   ├── components/   # UI Library, VideoPlayer, LeafletMap
    │   ├── lib/          # API Client & WebSocket Client
    │   └── types/        # TypeScript Interfaces
    └── package.json      # Dependencies Frontend
```

---

## 🚀 Langkah Eksekusi Restrukturisasi (Satu Kali)

Jalankan perintah ini di terminal Anda untuk merapikan seluruh file backend ke dalam folder `backend/`:
```powershell
python scripts/reorganize_to_backend.py
```

Setelah perintah di atas dijalankan, struktur proyek akan menjadi simetris sempurna:
```
analisis/
├── backend/          # Seluruh Python, Flask REST API, YOLO, DB, Weights, .env
└── frontend/         # Seluruh Next.js 14 App Router, TypeScript, Tailwind
```

---

## 💻 Langkah Menjalankan Aplikasi Sehari-hari

Buka **dua jendela terminal** (atau split terminal di VS Code):

### 1. Terminal 1: Menjalankan Backend Flask (Port 5000)
Anda bisa langsung menjalankan dari root (berkat root runner forwarder):
```powershell
python run.py
```
*Atau masuk ke dalam folder `backend`:*
```powershell
cd backend
python run.py
```

Untuk memverifikasi seluruh REST API berstatus 100% [PASS]:
```powershell
python backend/scripts/verify_api_v1.py
```

---

### 2. Terminal 2: Menjalankan Frontend Next.js (Port 3000)
Buka folder `frontend`, instal dependensi (hanya perlu sekali di awal), lalu jalankan:
```powershell
cd frontend
npm install
npm run dev
```
> Aplikasi Next.js akan aktif di `http://localhost:3000`.


---

## 🌐 Daftar Halaman Aplikasi Next.js

Buka browser dan akses URL berikut:

| Halaman | URL | Keterangan |
|---|---|---|
| **Beranda** | `http://localhost:3000/` | Pilihan portal publik atau masuk ke Command Center |
| **Login Staf** | `http://localhost:3000/login` | Form login modern dengan verifikasi token & cookie |
| **Command Center** | `http://localhost:3000/admin/monitoring` | Live stream multi-kamera, notifikasi Socket.IO, metrik pelanggaran |
| **Manajemen CCTV** | `http://localhost:3000/admin/cctv` | Tabel kamera, filter status, pencarian ter-debounce, modal tambah CCTV |
| **Emergency Dispatch** | `http://localhost:3000/admin/dispatch` | Chat console, instruksi WhatsApp instansi, modul catatan tersimpan |
| **Portal Kepadatan** | `http://localhost:3000/kepadatan` | Analitika klasifikasi kendaraan dan grafik volume 24 jam |
| **Peta Spasial GIS** | `http://localhost:3000/peta` | Peta Leaflet batas wilayah Kota Bogor & interaksi marker CCTV |

---

## 🔒 Catatan Keamanan Zero-Trust
1. **Otentikasi Cookie HttpOnly**: Token sesi disimpan dalam cookie `HttpOnly; SameSite=Lax` sehingga kebal dari serangan pencurian token via JavaScript XSS.
2. **Rate Limiting**: Endpoint sensitif (`/api/v1/auth/login` dan `/api/v1/dispatch/send`) dilindungi algoritma *Sliding Window* untuk mencegah serangan brute force dan spam pesan.
3. **Peta Leaflet Bebas Error SSR**: Menggunakan pemuatan dinamis (`dynamic import`) dengan `ssr: false` untuk memastikan peramban me-render peta tanpa kendala server-side rendering.
