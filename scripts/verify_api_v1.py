"""
Root Forwarder for REST API Verification.
Menjalankan backend/scripts/verify_api_v1.py dari root direktori.
"""
import os
import sys

basedir = os.path.abspath(os.path.dirname(__file__))
backend_path = os.path.join(basedir, "..", "backend")

if os.path.exists(backend_path):
    sys.path.insert(0, backend_path)
    os.chdir(backend_path)
    from scripts.verify_api_v1 import test_api_endpoints
    test_api_endpoints()
else:
    print("❌ Folder backend/ tidak ditemukan.")
