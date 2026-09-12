"""
Script Migrasi Database PostgreSQL - Soft Delete & Audit Columns pada Tabel CCTV
Menambahkan kolom is_deleted, deleted_at, created_at, dan updated_at secara idempotent (aman jika dijalankan berulang).
"""

import sys
import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from dotenv import load_dotenv
load_dotenv(override=True)

from app import create_app, db
from sqlalchemy import text

def run_migration():
    print("======================================================")
    print("  DaashTics - Migrasi PostgreSQL: Soft Delete Support ")
    print("======================================================")
    
    app = create_app()
    with app.app_context():
        try:
            with db.engine.connect() as conn:
                print("\n[1/4] Menambahkan kolom 'is_deleted' ke tabel cctv...")
                conn.execute(text("ALTER TABLE cctv ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;"))
                conn.execute(text("UPDATE cctv SET is_deleted = FALSE WHERE is_deleted IS NULL;"))
                conn.execute(text("ALTER TABLE cctv ALTER COLUMN is_deleted SET NOT NULL;"))

                print("[2/4] Menambahkan kolom 'deleted_at' ke tabel cctv...")
                conn.execute(text("ALTER TABLE cctv ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;"))

                print("[3/4] Menambahkan kolom audit 'created_at' & 'updated_at'...")
                conn.execute(text("ALTER TABLE cctv ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
                conn.execute(text("ALTER TABLE cctv ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))

                print("[4/4] Membuat index efisiensi query 'ix_cctv_is_deleted'...")
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_cctv_is_deleted ON cctv (is_deleted);"))

                conn.commit()
                print("\n[OK] Migrasi database berhasil 100%! Soft Delete kini aktif di PostgreSQL.")
        except Exception as e:
            print(f"\n[GAGAL] Error saat menjalankan migrasi SQL: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_migration()
