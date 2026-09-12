"""
Skrip Diagnostik Koneksi Database PostgreSQL untuk DaashTics
Menjalankan verifikasi bertingkat:
1. Pembacaan file .env & pemformatan URL
2. Uji ketersediaan port TCP (Network/Socket)
3. Uji otentikasi user & password
4. Uji keberadaan database target (e.g. 'dastik')
"""

import os
import sys
import socket
from urllib.parse import urlparse
from dotenv import load_dotenv

# Muat file .env dari root
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
dotenv_path = os.path.join(basedir, ".env")
load_dotenv(dotenv_path, override=True)

def print_separator(title=""):
    print("\n" + "=" * 55)
    if title:
        print(f" {title.upper()} ")
        print("=" * 55)

def diagnose():
    print_separator("Diagnostik Koneksi Database PostgreSQL")
    print(f"📁 Memeriksa file .env di: {dotenv_path}")
    
    if not os.path.exists(dotenv_path):
        print("❌ File .env tidak ditemukan! Silakan salin dari .env.example.")
        return False

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL tidak diset di dalam .env!")
        return False

    print(f"🔍 Format DATABASE_URL ditemukan.")
    
    # Parse URL
    try:
        parsed = urlparse(db_url)
        username = parsed.username or "postgres"
        password = parsed.password or ""
        hostname = parsed.hostname or "localhost"
        port = parsed.port or 5432
        dbname = parsed.path.lstrip("/") or "postgres"
    except Exception as e:
        print(f"❌ Gagal mem-parse DATABASE_URL: {e}")
        return False

    # Mask password untuk keamanan tampilan
    masked_pw = "*" * len(password) if password else "(kosong)"
    print(f"   • Host     : {hostname}")
    print(f"   • Port     : {port}")
    print(f"   • User     : {username}")
    print(f"   • Password : {masked_pw}")
    print(f"   • Database : {dbname}")

    # 1. Tes Socket / Port TCP
    print("\n[Langkah 1/3] Menguji koneksi TCP ke PostgreSQL Server...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(3)
    try:
        sock.connect((hostname, port))
        sock.close()
        print(f"✅ Port {port} di '{hostname}' TERBUKA & merespons.")
    except Exception as e:
        print(f"❌ GAGAL terhubung ke {hostname}:{port} -> {e}")
        print("💡 Rekomendasi:")
        print("   - Pastikan service PostgreSQL sudah berjalan (buka services.msc -> 'postgresql-x64-..').")
        print(f"   - Periksa apakah PostgreSQL berjalan di port lain (misal: 5433 jika Anda menginstal 2 versi).")
        return False

    # 2. Tes Otentikasi User & Password
    print("\n[Langkah 2/3] Menguji otentikasi user & password ke server...")
    try:
        import psycopg2
    except ImportError:
        print("❌ Library psycopg2 belum terinstal di lingkungan Python ini.")
        return False

    # Coba konek ke database default 'postgres' terlebih dahulu untuk verifikasi user/password
    try:
        conn = psycopg2.connect(
            host=hostname,
            port=port,
            user=username,
            password=password,
            dbname="postgres",
            connect_timeout=5
        )
        conn.close()
        print(f"✅ Otentikasi BERHASIL untuk user '{username}'.")
    except psycopg2.OperationalError as e:
        err_msg = str(e)
        if "password authentication failed" in err_msg:
            print(f"❌ PASSWORD SALAH untuk user '{username}'.")
            print("💡 Solusi:")
            print(f"   1. Buka file .env dan perbaiki password pada baris DATABASE_URL.")
            print(f"   2. Jika Anda lupa password user '{username}':")
            print(f"      - Buka pg_hba.conf di folder instalasi PostgreSQL Anda.")
            print(f"      - Ubah 'scram-sha-256' menjadi 'trust' sementara.")
            print(f"      - Restart service PostgreSQL.")
            print(f"      - Masuk ke psql: psql -U postgres")
            print(f"      - Ganti password: ALTER USER postgres WITH PASSWORD '{password or 'uwow123'}';")
            print(f"      - Kembalikan ke scram-sha-256 dan restart service.")
            return False
        else:
            print(f"❌ Gagal koneksi: {e}")
            return False

    # 3. Tes Keberadaan Database Target
    print(f"\n[Langkah 3/3] Memeriksa apakah database '{dbname}' sudah dibuat...")
    try:
        conn = psycopg2.connect(
            host=hostname,
            port=port,
            user=username,
            password=password,
            dbname=dbname,
            connect_timeout=5
        )
        conn.close()
        print(f"✅ Database '{dbname}' DITEMUKAN dan siap digunakan!")
    except psycopg2.OperationalError as e:
        err_msg = str(e)
        if f'database "{dbname}" does not exist' in err_msg:
            print(f"⚠️ Database '{dbname}' BELUM DIBUAT di PostgreSQL!")
            print(f"💡 Solusi: Jalankan perintah berikut di CMD / pgAdmin:")
            print(f"   psql -U {username} -c \"CREATE DATABASE {dbname};\"")
            return False
        else:
            print(f"❌ Error saat mengakses database '{dbname}': {e}")
            return False

    print_separator("HASIL: SEMUA KONEKSI DATABASE VALID")
    print("Aplikasi DaashTics siap terhubung ke database dengan aman!\n")
    return True

if __name__ == "__main__":
    diagnose()
