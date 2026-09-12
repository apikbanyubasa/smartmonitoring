from .base import BaseTestCase


class TestApiEndpoints(BaseTestCase):
    """Core REST API endpoints & contract verification test suite."""

    def test_healthcheck_root(self):
        """Root API healthcheck responds with online status and service metadata."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("service", data)
        self.assertIn("api_endpoints", data)

    def test_get_cctv_list(self):
        """GET /api/v1/cctv returns standard payload contract with data array."""
        res = self.client.get("/api/v1/cctv")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIsInstance(data.get("data"), list)

    def test_get_cctv_summary(self):
        """GET /api/v1/cctv/summary returns metrics object with camera counters."""
        res = self.client.get("/api/v1/cctv/summary")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        summary = data.get("data")
        self.assertIn("total", summary)
        self.assertIn("aktif", summary)
        self.assertIn("nonaktif", summary)
        self.assertIn("deleted", summary)

    def test_get_monitoring_cameras(self):
        """GET /api/v1/monitoring/cameras returns stream-ready camera list."""
        res = self.client.get("/api/v1/monitoring/cameras")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIsInstance(data.get("data"), list)

    def test_get_monitoring_violations(self):
        """GET /api/v1/monitoring/violations returns eager-loaded violation events."""
        res = self.client.get("/api/v1/monitoring/violations")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        violations = data.get("data")
        self.assertIn("odol_detections", violations)
        self.assertIn("parking_violations", violations)
        self.assertIn("totals", violations)
        self.assertIsInstance(violations["odol_detections"], list)
        self.assertIsInstance(violations["parking_violations"], list)

    def test_get_dispatch_contacts(self):
        """GET /api/v1/dispatch/contacts returns public emergency contact directory."""
        res = self.client.get("/api/v1/dispatch/contacts")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIsInstance(data.get("data"), list)

    def test_get_kepadatan_metrics(self):
        """GET /api/v1/kepadatan/metrics returns pure SQL aggregated time-series."""
        res = self.client.get("/api/v1/kepadatan/metrics")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        metrics = data.get("data")
        self.assertIn("totals", metrics)
        self.assertIn("directional_volume", metrics)
        self.assertIn("composition_percentages", metrics)
        self.assertIn("hourly_volume", metrics)
        self.assertIn("table_data", metrics)
        self.assertEqual(len(metrics["hourly_volume"]), 24)

    def test_get_gis_map_data(self):
        """GET /api/v1/gis/map_data returns GeoJSON boundaries and spatial CCTV markers."""
        res = self.client.get("/api/v1/gis/map_data")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        gis_data = data.get("data")
        self.assertIn("geojson_boundaries", gis_data)
        self.assertIn("cctv_markers", gis_data)
        self.assertIsInstance(gis_data["cctv_markers"], list)

    def test_notification_engine_functions(self):
        """Unit test accessor fungsi engine notifikasi thread-safe."""
        from app.engine import (
            get_notification_enabled,
            set_notification_enabled,
            toggle_notification_enabled,
        )

        set_notification_enabled(True)
        self.assertTrue(get_notification_enabled())

        new_val = toggle_notification_enabled()
        self.assertFalse(new_val)
        self.assertFalse(get_notification_enabled())

        set_notification_enabled(True)
        self.assertTrue(get_notification_enabled())

    def test_unauthenticated_notification_status_returns_401(self):
        """Zero-Trust: Endpoint status notifikasi membutuhkan autentikasi."""
        res = self.client.get("/api/v1/monitoring/notifications/status")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "UNAUTHORIZED")

    def test_authenticated_notification_status_and_toggle(self):
        """REST API: Authed admin dapat membaca status dan mengubah toggle notifikasi."""
        from app.models import User
        from app.security import generate_auth_token
        from app.engine import set_notification_enabled

        # Pastikan ada user admin atau buat dummy token untuk user id yang ada di DB
        user = User.query.first()
        if not user:
            self.skipTest("Tidak ada user di database untuk pengujian token.")

        token = generate_auth_token(user.id, user.role, user.username)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Reset state ke True
        set_notification_enabled(True)

        # 2. Get status
        res = self.client.get("/api/v1/monitoring/notifications/status", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("data", {}).get("enabled"), True)

        # 3. Toggle via POST
        res = self.client.post("/api/v1/monitoring/notifications/toggle", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("data", {}).get("enabled"), False)

        # 4. Set explicit via POST
        res = self.client.post(
            "/api/v1/monitoring/notifications/toggle",
            headers=headers,
            json={"enabled": True},
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("data", {}).get("enabled"), True)

