"""
Skrip Verifikasi Suite REST API DaashTics (/api/v1/*)
Menguji registrasi endpoint, kontrak respons standar, dan kesiapan untuk Next.js.
"""

import sys
import os

# Tambahkan direktori induk ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app

def test_api_endpoints():
    app = create_app()
    client = app.test_client()

    print("==================================================")
    print("🚀 DAASHTICS ENTERPRISE REST API VERIFICATION")
    print("==================================================")

    public_endpoints = [
        ("GET", "/api/v1/cctv", "CCTV List Endpoint"),
        ("GET", "/api/v1/cctv/summary", "CCTV Metrics Summary"),
        ("GET", "/api/v1/monitoring/cameras", "Live Stream Cameras List"),
        ("GET", "/api/v1/monitoring/violations", "Violations Feed"),
        ("GET", "/api/v1/dispatch/contacts", "Emergency Contacts"),
        ("GET", "/api/v1/kepadatan/metrics", "Traffic Density Metrics"),
        ("GET", "/api/v1/gis/map_data", "GIS Boundaries & CCTV Markers"),
    ]

    all_passed = True

    for method, path, desc in public_endpoints:
        res = client.get(path)

        is_json = res.is_json
        status_ok = res.status_code in [200, 201]

        if status_ok and is_json:
            data = res.get_json()
            has_contract = "success" in data and ("data" in data or "message" in data)
            if has_contract:
                print(f"✅ [PASS] {method} {path:32} | {desc} (Status: {res.status_code})")
            else:
                print(f"⚠️ [WARN] {method} {path:32} | Missing contract structure")
                all_passed = False
        else:
            print(f"❌ [FAIL] {method} {path:32} | Status: {res.status_code}")
            all_passed = False

    # Test Zero-Trust Auth Protection (Unauthenticated requests MUST return 401)
    protected_endpoints = [
        ("GET", "/api/v1/auth/me", "Current User Session Endpoint"),
        ("GET", "/api/v1/dispatch/history", "Sensitive Dispatch History"),
        ("DELETE", "/api/v1/gis/boundaries/1", "Protected GIS Delete Boundary"),
    ]

    for method, path, desc in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.delete(path)

        if res.status_code == 401:
            print(f"✅ [PASS] {method} {path:32} | {desc} (Zero-Trust 401 Block)")
        else:
            print(f"❌ [FAIL] {method} {path:32} | Expected 401, got {res.status_code}")
            all_passed = False

    # Test Schema Integrity for Kepadatan Metrics
    kepadatan_res = client.get("/api/v1/kepadatan/metrics")
    if kepadatan_res.status_code == 200:
        kp_data = kepadatan_res.get_json().get("data", {})
        required_keys = ["totals", "directional_volume", "hourly_volume", "table_data", "composition_percentages"]
        if all(k in kp_data for k in required_keys):
            print("✅ [PASS] GET /api/v1/kepadatan/metrics        | SQL Aggregation Schema Valid (All Keys Present)")
        else:
            print(f"❌ [FAIL] Missing expected keys in kepadatan metrics: {kp_data.keys()}")
            all_passed = False

    print("==================================================")
    if all_passed:
        print("🎉 SELURUH REST API & ZERO-TRUST AUTH GUARD SIAP DAN TERVERIFIKASI!")
    else:
        print("⚠️ Ditemukan beberapa catatan pada pengujian endpoint.")
    print("==================================================")

if __name__ == "__main__":
    test_api_endpoints()

