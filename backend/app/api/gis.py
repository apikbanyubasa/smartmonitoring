"""
Enterprise REST API - Geographic Information System (GIS) Service
Menyediakan poligon batas wilayah administratif Kota Bogor (GeoJSON), koordinat spasial CCTV,
impor CSV batas spasial, ekspor, dan manajemen data batas wilayah.
"""

import io
import json
import pandas as pd
from shapely.wkt import loads as wkt_loads
from shapely.geometry import mapping
from flask import request, send_file
from app import db
from app.models import BatasWilayah, CCTV
from app.security import api_response, api_error, api_auth_required
from . import api_bp


@api_bp.route("/gis/map_data", methods=["GET"])
def api_get_map_data():
    """Mengambil poligon batas wilayah dan marker spasial seluruh CCTV untuk Leaflet."""
    # 1. Batas Wilayah Polygons
    batas_records = BatasWilayah.query.all()
    features = []

    for b in batas_records:
        if not b.geojson:
            continue
        try:
            geometry = json.loads(b.geojson)
            features.append({
                "type": "Feature",
                "properties": {
                    "id": b.id,
                    "nama": b.nama,
                    "jenis": b.jenis,
                    "keterangan": b.keterangan or ""
                },
                "geometry": geometry
            })
        except Exception:
            continue

    geojson_collection = {
        "type": "FeatureCollection",
        "features": features
    }

    # 2. CCTV Markers
    cctv_records = CCTV.query.filter(
        db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)),
        CCTV.latitude.isnot(None),
        CCTV.longitude.isnot(None)
    ).all()

    markers = [
        {
            "id": c.id,
            "lokasi": c.lokasi,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "status": c.status.lower(),
            "type": c.type or "CCTV",
            "stream_url": c.stream_url,
            "video_url": c.video_url,
        }
        for c in cctv_records
    ]

    return api_response(data={
        "geojson_boundaries": geojson_collection,
        "cctv_markers": markers,
        "center": [-6.5971, 106.8060],  # Koordinat Kota Bogor
        "default_zoom": 13
    })


@api_bp.route("/gis/boundaries", methods=["GET"])
def api_get_boundaries():
    """Mengambil daftar seluruh entri batas wilayah administratif."""
    records = BatasWilayah.query.order_by(BatasWilayah.jenis.asc(), BatasWilayah.nama.asc()).all()
    data = [
        {"id": b.id, "nama": b.nama, "jenis": b.jenis, "keterangan": b.keterangan or ""}
        for b in records
    ]
    return api_response(data=data, meta={"total": len(data)})


@api_bp.route("/gis/boundaries/<int:boundary_id>", methods=["DELETE"])
@api_auth_required(["admin"])
def api_delete_boundary(boundary_id: int):
    """Menghapus entri batas wilayah."""
    b = BatasWilayah.query.get(boundary_id)
    if not b:
        return api_error(code="NOT_FOUND", message="Batas wilayah tidak ditemukan.", status=404)
    try:
        db.session.delete(b)
        db.session.commit()
        return api_response(message=f"Batas wilayah {b.nama} berhasil dihapus.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus batas wilayah: {str(e)}", status=500)


@api_bp.route("/gis/boundaries/import/<tipe_data>", methods=["POST"])
@api_auth_required(["admin", "operator"])
def api_import_boundaries(tipe_data: str):
    """
    Mengunggah dan memproses file CSV batas wilayah (WKT ke GeoJSON).
    tipe_data: 'kota' / 'batas_kota' ATAU 'kabupaten' / 'batas_kabupaten'.
    """
    file = request.files.get("csv_file") or request.files.get("file")
    if not file or not file.filename:
        return api_error(code="NO_FILE", message="Harap pilih file CSV untuk diunggah.", status=400)

    is_kota = "kota" in tipe_data.lower()
    jenis_label = "Kota" if is_kota else "Kabupaten"

    try:
        file_bytes = file.read()
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")

        df.columns = [str(c).strip().lower() for c in df.columns]

        # Validasi kolom geometris WKT (bisa geom atau wkt atau geometry)
        geom_col = next((c for c in ["geom", "geometry", "wkt"] if c in df.columns), None)
        name_col = next((c for c in ["name_3", "name_2", "nama", "name", "kelurahan", "kecamatan"] if c in df.columns), None)

        if not geom_col or not name_col:
            return api_error(
                code="INVALID_CSV_COLUMNS",
                message=f"CSV harus memiliki kolom nama ({name_col or 'nama/name_3'}) dan kolom geometri WKT (geom/geometry).",
                status=400
            )

        count_added = 0
        errors = []

        for idx, row in df.iterrows():
            nama_val = str(row.get(name_col, "")).strip()
            wkt_val = str(row.get(geom_col, "")).strip()

            if not nama_val or not wkt_val or wkt_val.lower() == "nan":
                continue

            try:
                shapely_geom = wkt_loads(wkt_val)
                geojson_str = json.dumps(mapping(shapely_geom))

                # Keterangan opsional dari type_3 atau keterangan
                keterangan_val = ""
                for desc_col in ["type_3", "type_2", "keterangan", "type"]:
                    if desc_col in df.columns and pd.notna(row.get(desc_col)):
                        keterangan_val = str(row.get(desc_col))
                        break

                new_b = BatasWilayah(
                    nama=nama_val,
                    jenis=jenis_label,
                    geojson=geojson_str,
                    keterangan=keterangan_val
                )
                db.session.add(new_b)
                count_added += 1
            except Exception as geom_err:
                errors.append(f"Baris {idx + 2}: Gagal parse geometri: {str(geom_err)}")

        db.session.commit()
        return api_response(
            data={"added": count_added, "errors": errors[:10]},
            message=f"Berhasil mengimpor {count_added} data batas wilayah {jenis_label} Bogor."
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="IMPORT_ERROR", message=f"Gagal memproses file CSV batas wilayah: {str(e)}", status=500)


@api_bp.route("/gis/boundaries/delete-all/<tipe_data>", methods=["POST"])
@api_auth_required(["admin"])
def api_delete_all_boundaries(tipe_data: str):
    """Menghapus seluruh entri batas wilayah berdasarkan kategori ('kota' atau 'kabupaten')."""
    is_kota = "kota" in tipe_data.lower()
    jenis_label = "Kota" if is_kota else "Kabupaten"

    try:
        deleted_count = BatasWilayah.query.filter(
            db.func.lower(BatasWilayah.jenis) == jenis_label.lower()
        ).delete()
        db.session.commit()
        return api_response(message=f"Semua data batas wilayah {jenis_label} Bogor ({deleted_count} entri) telah dihapus.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus data: {str(e)}", status=500)


