# ==============================================================================
# Production Dockerfile for DaashTics Flask REST API & YOLO AI Engine
# Python 3.11-slim, OpenCV/Torch runtime, Zero-Trust Healthcheck
# ==============================================================================

FROM python:3.11-slim

# Pasang dependensi C/C++ sistem yang dibutuhkan oleh OpenCV, PyTorch, dan EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Nonaktifkan buffering output log Python & caching bytecode
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Pasang dependensi python terlebih dahulu (memanfaatkan layer caching Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Buat pengguna non-root demi keamanan kontainer
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Salin source code aplikasi
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 5000

# Healthcheck berbasis HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

CMD ["python", "run.py"]
