"""
Root Runner Forwarder for DaashTics Monorepo.
Mengarahkan eksekusi otomatis ke backend/run.py.
"""
import os
import sys

basedir = os.path.abspath(os.path.dirname(__file__))
backend_path = os.path.join(basedir, "backend")

if os.path.exists(backend_path):
    sys.path.insert(0, backend_path)
    os.chdir(backend_path)
    
    # Jalankan run.py backend
    import run
    run.main()
else:
    print("❌ Folder backend/ tidak ditemukan.")
