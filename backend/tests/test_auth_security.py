import json
from .base import BaseTestCase


class TestAuthSecurity(BaseTestCase):
    """Zero-Trust Authentication & RBAC security test suite."""

    def test_unauthenticated_me_returns_401(self):
        """Zero-Trust: Session check without token must return 401."""
        res = self.client.get("/api/v1/auth/me")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("error", data)
        self.assertEqual(data["error"].get("code"), "UNAUTHORIZED")

    def test_unauthenticated_dispatch_history_returns_401(self):
        """Zero-Trust: Sensitive dispatch history must be blocked without auth."""
        res = self.client.get("/api/v1/dispatch/history")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "UNAUTHORIZED")

    def test_unauthenticated_gis_delete_returns_401(self):
        """Zero-Trust: Deleting spatial boundaries must require admin auth."""
        res = self.client.delete("/api/v1/gis/boundaries/999999")
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "UNAUTHORIZED")

    def test_invalid_token_returns_401(self):
        """Zero-Trust: Forged or malformed bearer tokens must be rejected."""
        headers = {"Authorization": "Bearer forged_or_expired_jwt_signature"}
        res = self.client.get("/api/v1/auth/me", headers=headers)
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "INVALID_TOKEN")

    def test_login_validation_missing_credentials(self):
        """Validation: Login payload without username/password returns 400."""
        res = self.client.post(
            "/api/v1/auth/login",
            data=json.dumps({}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "VALIDATION_ERROR")

    def test_login_invalid_credentials(self):
        """Security: Non-existent username or wrong password returns 401."""
        res = self.client.post(
            "/api/v1/auth/login",
            data=json.dumps({
                "username": "non_existent_fake_user_12345",
                "password": "wrong_password_999"
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data["error"].get("code"), "INVALID_CREDENTIALS")
