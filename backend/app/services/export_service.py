"""
Service untuk ekspor data (Excel dan CSV).
Memisahkan pemrosesan file buffer dan pandas dari layer controller/routes.
"""

import io
from typing import List, Any
import pandas as pd

def build_cctv_dataframe(cctv_records: List[Any]) -> pd.DataFrame:
    """
    Mengubah list objek model CCTV menjadi pandas DataFrame.
    """
    data = [
        {
            "ID": c.id,
            "LOKASI": c.lokasi,
            "STATUS": c.status,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "VIDEO_URL": c.video_url,
            "CAMERA_TYPE": c.camera_type,
            "STREAM_URL": c.stream_url,
            "TYPE": c.type,
            "LINE1_Y": getattr(c, "line1_y", None),
            "LINE2_Y": getattr(c, "line2_y", None),
            "REAL_DISTANCE_M": getattr(c, "real_distance_m", None),
        }
        for c in cctv_records
    ]
    return pd.DataFrame(data)

def generate_cctv_excel(cctv_records: List[Any]) -> io.BytesIO:
    """
    Menghasilkan file in-memory Excel (.xlsx) dari data CCTV.
    """
    df = build_cctv_dataframe(cctv_records)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="CCTV")
    output.seek(0)
    return output

def generate_cctv_csv(cctv_records: List[Any]) -> io.BytesIO:
    """
    Menghasilkan file in-memory CSV dari data CCTV.
    """
    df = build_cctv_dataframe(cctv_records)
    string_io = io.StringIO()
    df.to_csv(string_io, index=False)
    bytes_io = io.BytesIO(string_io.getvalue().encode("utf-8"))
    bytes_io.seek(0)
    return bytes_io
