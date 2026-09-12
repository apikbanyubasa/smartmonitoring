"""
DaashTics Enterprise REST API Package (/api/v1)
Menyediakan antarmuka REST API murni berstandar Zero-Trust untuk konsumsi Next.js Frontend.
"""

from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api/v1")

# Daftarkan sub-rute API
from . import auth
from . import cctv
from . import monitoring
from . import dispatch
from . import kepadatan
from . import gis
