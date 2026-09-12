"""
Skrip Bantuan Otomatis Reset Password PostgreSQL
Gunakan skrip ini setelah mengubah 'scram-sha-256' menjadi 'trust' di pg_hba.conf dan restart service PostgreSQL.
"""

import sys
import os

NEW_PASSWORD = "postgres"
DB_NAME = "dastik"

def reset_password():
    print("=" * 55)
    print(" MERESET PASSWORD USER 'postgres' MENJADI: " + NEW_PASSWORD)
    print("=" * 55)

    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("❌ Library psycopg2 belum terinstal di python environment.")
        return

    try:
        # Koneksi tanpa password (berhasil jika pg_hba.conf diset ke 'trust')
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="postgres",
            dbname="postgres",
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # 1. Update Password
        print(f"⏳ Menjalankan: ALTER USER postgres WITH PASSWORD '{NEW_PASSWORD}'...")
        cursor.execute(f"ALTER USER postgres WITH PASSWORD '{NEW_PASSWORD}';")
        print(f"✅ Password user 'postgres' BERHASIL diubah menjadi '{NEW_PASSWORD}'!")

        # 2. Cek atau Buat Database 'dastik'
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}';")
        exists = cursor.fetchone()
        if not exists:
            print(f"⏳ Database '{DB_NAME}' belum ada, membuat database '{DB_NAME}'...")
            cursor.execute(f"CREATE DATABASE {DB_NAME};")
            print(f"✅ Database '{DB_NAME}' BERHASIL dibuat!")
        else:
            print(f"✅ Database '{DB_NAME}' sudah tersedia.")

        cursor.close()
        conn.close()

        print("\n" + "=" * 55)
        print("🎉 SELESAI!")
        print("Langkah terakhir:")
        print("1. Kembalikan 'trust' di pg_hba.conf ke 'scram-sha-256' (atau md5).")
        print("2. Restart service PostgreSQL.")
        print("3. Jalankan: python scripts/test_db_connection.py")
        print("=" * 55)

    except psycopg2.OperationalError as e:
        print(f"❌ Gagal koneksi: {e}")
        print("\n💡 Kemungkinan penyebab:")
        print("1. File pg_hba.conf belum diubah ke 'trust' atau belum disimpan.")
        print("2. Service PostgreSQL di services.msc belum di-restart setelah mengedit pg_hba.conf.")

if __name__ == "__main__":
    reset_password()
