# DaashTics - Intelligent Traffic Analytics System

Sistem Analisis Lalu Lintas Berbasis Computer Vision, YOLOv8, Flask Headless REST API, dan Next.js 14 App Router.

---

## 🏗️ Struktur Arsitektur Monorepo

Proyek ini telah direstrukturisasi mengikuti standar **Enterprise Senior Fullstack Developer**:

```text
analisis/
├── .env.example                # Templat konfigurasi lingkungan
├── docker-compose.yml          # Orkestrasi Docker (DB + Backend + Frontend)
├── run.py                      # Root forwarder runner
│
├── backend/                    # FLASK REST API & AI ENGINE (:5000)
│   ├── Dockerfile              # Production Python 3.11 container
│   ├── run.py                  # Entrypoint Flask & Socket.IO
│   ├── config.py               # Konfigurasi aplikasi & database
│   ├── requirements.txt        # Dependensi Python (PyTorch, YOLO, OpenCV)
│   ├── weights/                # Berkas bobot AI (yolov8n.pt, best.pt)
│   ├── tests/                  # Automated Test Suite (14 unit/integration tests)
│   │   ├── base.py             # Test client fixture
│   │   ├── test_auth_security.py # Zero-Trust auth & RBAC tests
│   │   └── test_api_endpoints.py # REST API contract & SQL aggregation tests
│   └── app/
│       ├── __init__.py         # Application Factory & Security Middleware
│       ├── models.py           # ORM PostgreSQL dengan Composite Time-Series Index
│       ├── security.py         # Zero-Trust JWT Auth, Sliding Window Rate Limiter
│       ├── api/                # Sub-controller REST API (/api/v1/*)
│       └── engine/             # Modular Computer Vision Subsystem
│           ├── context.py      # App context & thread locking
│           ├── tracker.py      # Euclidean centroid tracking & Homography
│           ├── persistence.py  # Database saving helpers
│           ├── stream_reader.py# RTSP/M3U8 stream connection manager
│           ├── detector.py     # YOLOv8, plate detector, EasyOCR reader
│           └── analyzer.py     # Main AI orchestrator facade
│
└── frontend/                   # NEXT.JS 14 FRONTEND (:3000)
    ├── Dockerfile              # Multi-stage standalone production container
    ├── package.json            # React 18, Next 14, Lucide, Tailwind, Leaflet
    ├── tsconfig.json           # TypeScript configuration
    └── src/
        ├── middleware.ts       # Edge Runtime Route Guard (/admin/* protection)
        ├── app/                # Next.js App Router (Public & Admin Command Center)
        ├── components/         # Reusable UI library, VideoPlayer, LeafletMap
        ├── lib/                # API client with credentials & Socket.IO
        └── types/              # TypeScript interface definitions
```

---

## 🚀 Panduan Menjalankan Aplikasi

### Opsi A: Menjalankan Menggunakan Docker Compose (Direkomendasikan untuk Production)

Pastikan Docker Engine dan Docker Compose telah terpasang:
```bash
# 1. Salin templat variabel lingkungan
cp .env.example .env

# 2. Bangun dan jalankan seluruh container (PostgreSQL + Backend + Frontend)
docker compose up --build -d

# 3. Pantau status container
docker compose ps
```
Aplikasi akan tersedia di:
- **Frontend Next.js**: `http://localhost:3000`
- **Backend Headless REST API**: `http://localhost:5000`
- **PostgreSQL Database**: `localhost:5432`

---

### Opsi B: Menjalankan Secara Lokal (Development)

#### 1. Persiapan Backend
```bash
cd backend
cp .env.example .env
# Lengkapi DATABASE_URL dan SECRET_KEY di backend/.env

# Pasang dependensi python
pip install -r requirements.txt

# Jalankan server API & AI Engine
python run.py
```
> Server backend akan aktif di `http://localhost:5000`.

#### 2. Persiapan Frontend
Buka terminal kedua:
```bash
cd frontend
npm install
npm run dev
```
> Frontend Next.js akan aktif di `http://localhost:3000`.

---

## 🧪 Menjalankan Automated Test Suite

Pengujian terotomasi mencakup Zero-Trust authentication, proteksi RBAC, sliding window rate limiting, dan integritas agregasi SQL:

```bash
# Dari root proyek atau folder backend:
python -m unittest discover -t backend -s backend/tests -p "test_*.py" -v
```

Hasil pengujian:
```text
test_get_cctv_list ... ok
test_get_cctv_summary ... ok
test_get_dispatch_contacts ... ok
test_get_gis_map_data ... ok
test_get_kepadatan_metrics ... ok
test_get_monitoring_cameras ... ok
test_get_monitoring_violations ... ok
test_healthcheck_root ... ok
test_invalid_token_returns_401 ... ok
test_login_invalid_credentials ... ok
test_login_validation_missing_credentials ... ok
test_unauthenticated_dispatch_history_returns_401 ... ok
test_unauthenticated_gis_delete_returns_401 ... ok
test_unauthenticated_me_returns_401 ... ok
----------------------------------------------------------------------
Ran 14 tests in 12.4s - OK
```

---

## 🔒 Fitur Keamanan & Best Practice

1. **Zero-Trust Security**:
   - Next.js Edge Middleware memverifikasi token pada setiap navigasi `/admin/*`.
   - API dilindungi decorator `@api_auth_required` dengan verifikasi Role-Based Access Control (RBAC).
   - Cookie sesi bertipe `HttpOnly; SameSite=Lax` dengan flag `Secure` dinamis.
2. **Database Performance**:
   - Composite index `(cctv_id, timestamp)` pada seluruh tabel transaksi time-series.
   - Eliminasi masalah N+1 queries dengan SQLAlchemy `joinedload()`.
   - Agregasi SQL murni (`SUM`, `GROUP BY hour`) langsung di database tanpa memory bottleneck di Python.
3. **Clean Architecture**:
   - Pemisahan tanggung jawab penuh (*Separation of Concerns*) antara computer vision engine, persistensi database, dan controller REST API.
