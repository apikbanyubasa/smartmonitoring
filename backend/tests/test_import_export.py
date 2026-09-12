import io
import os
import sys
import json
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tests.base import BaseTestCase
from app.models import CCTV, User
from app.security import generate_auth_token


class TestImportExportEndpoints(BaseTestCase):
    def setUp(self):
        super().setUp()
        from app import db
        user = User.query.filter_by(email="admin_import@test.com").first()
        if not user:
            self.admin = User(
                username="admin_test",
                email="admin_import@test.com",
                role="admin"
            )
            self.admin.set_password("AdminPass123!")
            db.session.add(self.admin)
            db.session.commit()
        else:
            self.admin = user

        self.token = generate_auth_token(self.admin.id, self.admin.role, self.admin.username)
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_cctv_template_download(self):
        """Test template download endpoint for both CSV and Excel."""
        # CSV Template
        res_csv = self.client.get("/api/v1/cctv/template?format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn("text/csv", res_csv.content_type)
        self.assertIn(b"lokasi", res_csv.data)

        # Excel Template
        res_excel = self.client.get("/api/v1/cctv/template?format=excel")
        self.assertEqual(res_excel.status_code, 200)
        self.assertIn("spreadsheetml", res_excel.content_type)

    def test_cctv_import_preview_and_commit(self):
        """Test CCTV import preview and commit flow."""
        # Prepare sample CSV
        csv_content = (
            "lokasi,status,latitude,longitude,stream_url,type\n"
            "Lokasi Uji Coba 1,Aktif,-6.591,106.791,https://test.com/stream1.m3u8,CCTV\n"
            "Lokasi Uji Coba 2,Non-Aktif,-6.592,106.792,,Dishub\n"
        )
        data = {
            "file": (io.BytesIO(csv_content.encode("utf-8")), "test_cameras.csv")
        }

        # 1. Preview
        res_preview = self.client.post(
            "/api/v1/cctv/import-preview",
            data=data,
            headers=self.headers,
            content_type="multipart/form-data"
        )
        self.assertEqual(res_preview.status_code, 200)
        preview_json = res_preview.get_json()
        self.assertTrue(preview_json["success"])
        self.assertEqual(preview_json["data"]["total"], 2)
        self.assertEqual(preview_json["data"]["new_count"], 2)

        # 2. Commit
        res_commit = self.client.post(
            "/api/v1/cctv/import-commit",
            json={"rows": preview_json["data"]["rows"]},
            headers=self.headers
        )
        self.assertEqual(res_commit.status_code, 200)
        commit_json = res_commit.get_json()
        self.assertTrue(commit_json["success"])
        self.assertEqual(commit_json["data"]["added"], 2)

        # Verify in DB
        cctv1 = CCTV.query.filter_by(lokasi="Lokasi Uji Coba 1").first()
        self.assertIsNotNone(cctv1)
        self.assertEqual(cctv1.status, "Aktif")

    def test_cctv_export(self):
        """Test CCTV export endpoint for CSV and Excel."""
        from app import db
        c = CCTV(lokasi="Lokasi Export Test", status="Aktif", latitude=-6.59, longitude=106.80)
        db.session.add(c)
        db.session.commit()

        # CSV Export
        res_csv = self.client.get("/api/v1/cctv/export?format=csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn(b"Lokasi Export Test", res_csv.data)

        # Excel Export
        res_excel = self.client.get("/api/v1/cctv/export?format=excel")
        self.assertEqual(res_excel.status_code, 200)
        self.assertIn("spreadsheetml", res_excel.content_type)

    def test_cctv_bulk_delete(self):
        """Test CCTV bulk delete endpoint."""
        from app import db
        c1 = CCTV(lokasi="Bulk Delete 1", status="Aktif")
        c2 = CCTV(lokasi="Bulk Delete 2", status="Aktif")
        db.session.add_all([c1, c2])
        db.session.commit()

        # Delete selected
        res = self.client.post(
            "/api/v1/cctv/bulk-delete",
            json={"ids": [c1.id, c2.id]},
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)

        # Check soft-deleted
        self.assertTrue(c1.is_deleted)
        self.assertTrue(c2.is_deleted)


if __name__ == "__main__":
    import unittest
    unittest.main()

