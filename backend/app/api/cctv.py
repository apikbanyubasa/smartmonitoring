"""
Enterprise REST API - CCTV Camera Management Service
Menyediakan operasi CRUD, soft-delete, restore, impor (preview & commit),
ekspor (CSV & Excel), unduh template, dan bulk actions untuk Next.js client.
"""

import io
from datetime import datetime
import pandas as pd
from flask import request, send_file, current_app
from app import db
from app.models import CCTV
from app.engine.workers_manager import reload_workers_thread
from app.security import (
    api_auth_required,
    api_response,
    api_error,
)
from . import api_bp


def _cctv_to_dict(c):
    return {
        "id": c.id,
        "lokasi": c.lokasi,
        "status": c.status,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "video_url": c.video_url,
        "stream_url": c.stream_url,
        "type": c.type or "CCTV",
        "camera_type": c.camera_type,
        "is_deleted": bool(c.is_deleted),
        "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
        "created_at": c.created_at.isoformat() if hasattr(c, "created_at") and c.created_at else None,
        "updated_at": c.updated_at.isoformat() if hasattr(c, "updated_at") and c.updated_at else None,
    }


def _read_tabular_file(file_storage):
    """Membaca file stream berekstensi .csv, .xlsx, atau .xls menjadi pandas DataFrame terstandarisasi."""
    filename = (file_storage.filename or "").lower()
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise ValueError("Format file tidak didukung. Harap gunakan file berekstensi .csv, .xlsx, atau .xls.")

    file_bytes = file_storage.read()
    if not file_bytes:
        raise ValueError("File yang diunggah kosong.")

    if filename.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin1")
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    # Standardisasi header kolom: trim, lowercase, ganti spasi dengan underscore
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
    return df


@api_bp.route("/cctv", methods=["GET"])
def api_get_cctv_list():
    """Mengambil daftar kamera CCTV dengan filter pencarian dan status."""
    search = request.args.get("search", "").strip().lower()
    status = request.args.get("status", "").strip().lower()
    include_deleted = request.args.get("include_deleted", "false").lower() in ["true", "1"]

    query = CCTV.query

    if not include_deleted:
        query = query.filter(db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)))

    if status and status != "all":
        query = query.filter(db.func.lower(CCTV.status) == status)

    if search:
        query = query.filter(db.func.lower(CCTV.lokasi).contains(search))

    cameras = query.order_by(CCTV.lokasi.asc()).all()

    return api_response(
        data=[_cctv_to_dict(c) for c in cameras],
        meta={"total": len(cameras), "filter_status": status or "all"}
    )


@api_bp.route("/cctv/summary", methods=["GET"])
def api_get_cctv_summary():
    """Mengambil ringkasan metrik kamera (aktif, nonaktif, total)."""
    base_query = CCTV.query.filter(db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)))
    total = base_query.count()
    aktif = base_query.filter(db.func.lower(CCTV.status) == "aktif").count()
    nonaktif = total - aktif
    deleted = CCTV.query.filter(CCTV.is_deleted.is_(True)).count()

    return api_response(data={
        "total": total,
        "aktif": aktif,
        "nonaktif": nonaktif,
        "deleted": deleted
    })


@api_bp.route("/cctv/<int:cctv_id>", methods=["GET"])
def api_get_cctv_detail(cctv_id):
    """Mengambil detail satu CCTV berdasarkan ID."""
    c = CCTV.query.get(cctv_id)
    if not c:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)
    return api_response(data=_cctv_to_dict(c))


@api_bp.route("/cctv", methods=["POST"])
@api_auth_required(["admin", "operator"])
def api_create_cctv():
    """Menambahkan kamera CCTV baru ke database."""
    data = request.get_json(silent=True) or {}
    lokasi = data.get("lokasi", "").strip()

    if not lokasi:
        return api_error(code="VALIDATION_ERROR", message="Nama/Lokasi kamera wajib diisi.")

    new_cctv = CCTV(
        lokasi=lokasi,
        status=data.get("status", "Aktif"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        video_url=data.get("video_url"),
        stream_url=data.get("stream_url"),
        type=data.get("type", "CCTV"),
        camera_type=data.get("camera_type", "Fixed"),
        is_deleted=False
    )

    try:
        db.session.add(new_cctv)
        db.session.commit()
        # Trigger reload thread jika aktif
        if new_cctv.status.lower() == "aktif" and new_cctv.stream_url:
            reload_workers_thread(current_app._get_current_object())
        return api_response(
            data=_cctv_to_dict(new_cctv),
            message="Kamera CCTV berhasil ditambahkan.",
            status=201
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menyimpan kamera: {str(e)}", status=500)


@api_bp.route("/cctv/<int:cctv_id>", methods=["PUT", "PATCH"])
@api_auth_required(["admin", "operator"])
def api_update_cctv(cctv_id):
    """Memperbarui informasi kamera CCTV."""
    c = CCTV.query.get(cctv_id)
    if not c:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)

    data = request.get_json(silent=True) or {}
    if "lokasi" in data and data["lokasi"].strip():
        c.lokasi = data["lokasi"].strip()
    if "status" in data:
        c.status = data["status"]
    if "latitude" in data:
        c.latitude = data["latitude"]
    if "longitude" in data:
        c.longitude = data["longitude"]
    if "video_url" in data:
        c.video_url = data["video_url"]
    if "stream_url" in data:
        c.stream_url = data["stream_url"]
    if "type" in data:
        c.type = data["type"]
    if "camera_type" in data:
        c.camera_type = data["camera_type"]

    try:
        db.session.commit()
        reload_workers_thread(current_app._get_current_object())
        return api_response(data=_cctv_to_dict(c), message="Data CCTV berhasil diperbarui.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal memperbarui data: {str(e)}", status=500)


@api_bp.route("/cctv/<int:cctv_id>", methods=["DELETE"])
@api_auth_required(["admin"])
def api_delete_cctv(cctv_id):
    """Soft-delete kamera CCTV (data historis aman)."""
    c = CCTV.query.get(cctv_id)
    if not c:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)

    try:
        c.is_deleted = True
        c.deleted_at = datetime.utcnow()
        c.status = "Non-Aktif"
        db.session.commit()
        reload_workers_thread(current_app._get_current_object())
        return api_response(message=f"Kamera '{c.lokasi}' berhasil diarsipkan (soft-delete).")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus kamera: {str(e)}", status=500)


@api_bp.route("/cctv/<int:cctv_id>/restore", methods=["POST"])
@api_auth_required(["admin"])
def api_restore_cctv(cctv_id):
    """Memulihkan kamera CCTV yang sebelumnya diarsipkan."""
    c = CCTV.query.get(cctv_id)
    if not c:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)

    try:
        c.is_deleted = False
        c.deleted_at = None
        c.status = "Aktif"
        db.session.commit()
        reload_workers_thread(current_app._get_current_object())
        return api_response(data=_cctv_to_dict(c), message=f"Kamera '{c.lokasi}' berhasil dipulihkan.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal memulihkan kamera: {str(e)}", status=500)


# =========================================================================
# FITUR IMPOR DATA (PREVIEW & COMMIT)
# =========================================================================

@api_bp.route("/cctv/import-preview", methods=["POST"])
@api_auth_required(["admin", "operator"])
def api_cctv_import_preview():
    """
    Menerima file CSV atau Excel, memvalidasi kolom dan baris data,
    serta memberikan pratinjau apakah baris berstatus data baru (new),
    pembaruan (update), atau tidak valid (invalid).
    """
    file = request.files.get("file") or request.files.get("csv_file")
    if not file or not file.filename:
        return api_error(code="NO_FILE", message="Tidak ada file yang dipilih untuk diunggah.")

    try:
        df = _read_tabular_file(file)
    except Exception as e:
        return api_error(code="FILE_PARSE_ERROR", message=str(e), status=400)

    if "lokasi" not in df.columns:
        return api_error(
            code="MISSING_COLUMN",
            message=f"File harus memiliki kolom 'lokasi'. Kolom yang terdeteksi: {', '.join(df.columns)}",
            status=400
        )

    # Ambil semua data CCTV yang ada untuk penentuan status new vs update
    existing_cctvs = CCTV.query.all()
    existing_lookup = {c.lokasi.strip().lower(): c for c in existing_cctvs}

    rows_preview = []
    new_count = 0
    update_count = 0
    invalid_count = 0

    for idx, raw_row in df.iterrows():
        row_num = idx + 2  # baris di spreadsheet (baris 1 adalah header)
        lokasi_raw = raw_row.get("lokasi")
        lokasi = str(lokasi_raw).strip() if pd.notna(lokasi_raw) else ""

        if not lokasi or lokasi.lower() == "nan":
            invalid_count += 1
            rows_preview.append({
                "row_number": row_num,
                "lokasi": "-",
                "status": "-",
                "latitude": None,
                "longitude": None,
                "stream_url": "-",
                "type": "-",
                "camera_type": "-",
                "action": "invalid",
                "message": "Nama lokasi kosong / tidak valid."
            })
            continue

        # Status CCTV (default Aktif)
        status_raw = raw_row.get("status")
        status_val = str(status_raw).strip() if pd.notna(status_raw) else "Aktif"
        if status_val.lower() not in ["aktif", "non-aktif", "nonaktif", "maintenance", "rusak"]:
            status_val = "Aktif"

        # Parsing latitude & longitude
        lat_val = pd.to_numeric(raw_row.get("latitude"), errors="coerce")
        lng_val = pd.to_numeric(raw_row.get("longitude"), errors="coerce")
        lat = float(lat_val) if pd.notna(lat_val) else None
        lng = float(lng_val) if pd.notna(lng_val) else None

        stream_url_raw = raw_row.get("stream_url")
        stream_url = str(stream_url_raw).strip() if pd.notna(stream_url_raw) and str(stream_url_raw).lower() != "nan" else None

        video_url_raw = raw_row.get("video_url")
        video_url = str(video_url_raw).strip() if pd.notna(video_url_raw) and str(video_url_raw).lower() != "nan" else None

        type_raw = raw_row.get("type")
        cctv_type = str(type_raw).strip() if pd.notna(type_raw) and str(type_raw).lower() != "nan" else "CCTV"

        cam_type_raw = raw_row.get("camera_type")
        camera_type = str(cam_type_raw).strip() if pd.notna(cam_type_raw) and str(cam_type_raw).lower() != "nan" else "Fixed"

        # Cek apakah lokasi sudah ada di database
        is_existing = lokasi.lower() in existing_lookup
        if is_existing:
            update_count += 1
            action = "update"
            msg = f"Akan memperbarui data CCTV ID #{existing_lookup[lokasi.lower()].id}"
        else:
            new_count += 1
            action = "new"
            msg = "Akan ditambahkan sebagai titik CCTV baru."

        rows_preview.append({
            "row_number": row_num,
            "lokasi": lokasi,
            "status": status_val,
            "latitude": lat,
            "longitude": lng,
            "stream_url": stream_url,
            "video_url": video_url,
            "type": cctv_type,
            "camera_type": camera_type,
            "action": action,
            "message": msg
        })

    return api_response(
        data={
            "total": len(rows_preview),
            "new_count": new_count,
            "update_count": update_count,
            "invalid_count": invalid_count,
            "rows": rows_preview
        },
        message=f"Pratinjau impor berhasil: {new_count} baru, {update_count} pembaruan, {invalid_count} baris tidak valid."
    )


@api_bp.route("/cctv/import-commit", methods=["POST"])
@api_auth_required(["admin", "operator"])
def api_cctv_import_commit():
    """
    Menyimpan data impor terverifikasi ke dalam database.
    Menerima payload JSON berisi array baris data dari pratinjau yang disetujui pengguna,
    atau file langsung untuk eksekusi cepat.
    """
    rows_to_save = []

    # Cek apakah kiriman berupa JSON array hasil preview
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        rows_to_save = payload.get("rows", [])
    elif "file" in request.files or "csv_file" in request.files:
        # Jika unggah file langsung tanpa pratinjau terpisah
        file = request.files.get("file") or request.files.get("csv_file")
        try:
            df = _read_tabular_file(file)
            if "lokasi" not in df.columns:
                return api_error(code="MISSING_COLUMN", message="Kolom 'lokasi' wajib ada.", status=400)
            for _, raw_row in df.iterrows():
                lokasi_raw = raw_row.get("lokasi")
                if pd.isna(lokasi_raw) or not str(lokasi_raw).strip():
                    continue
                lat_val = pd.to_numeric(raw_row.get("latitude"), errors="coerce")
                lng_val = pd.to_numeric(raw_row.get("longitude"), errors="coerce")
                rows_to_save.append({
                    "lokasi": str(lokasi_raw).strip(),
                    "status": str(raw_row.get("status", "Aktif")).strip(),
                    "latitude": float(lat_val) if pd.notna(lat_val) else None,
                    "longitude": float(lng_val) if pd.notna(lng_val) else None,
                    "stream_url": str(raw_row.get("stream_url", "")).strip() or None,
                    "video_url": str(raw_row.get("video_url", "")).strip() or None,
                    "type": str(raw_row.get("type", "CCTV")).strip() or "CCTV",
                    "camera_type": str(raw_row.get("camera_type", "Fixed")).strip() or "Fixed",
                })
        except Exception as e:
            return api_error(code="FILE_PARSE_ERROR", message=str(e), status=400)

    if not rows_to_save:
        return api_error(code="EMPTY_DATA", message="Tidak ada data valid yang dapat disimpan.", status=400)

    count_added = 0
    count_updated = 0

    try:
        for item in rows_to_save:
            # Lewati baris yang ditandai invalid saat preview
            if item.get("action") == "invalid":
                continue

            lokasi = str(item.get("lokasi", "")).strip()
            if not lokasi or lokasi.lower() == "nan":
                continue

            cctv_entry = CCTV.query.filter(
                db.func.lower(CCTV.lokasi) == lokasi.lower()
            ).first()

            status_val = item.get("status", "Aktif")
            if not status_val or status_val.lower() == "nan":
                status_val = "Aktif"

            if not cctv_entry:
                cctv_entry = CCTV(
                    lokasi=lokasi,
                    status=status_val,
                    latitude=item.get("latitude"),
                    longitude=item.get("longitude"),
                    video_url=item.get("video_url"),
                    camera_type=item.get("camera_type") or "Fixed",
                    stream_url=item.get("stream_url"),
                    type=item.get("type") or "CCTV",
                    is_deleted=False
                )
                db.session.add(cctv_entry)
                count_added += 1
            else:
                cctv_entry.status = status_val
                if item.get("latitude") is not None:
                    cctv_entry.latitude = item.get("latitude")
                if item.get("longitude") is not None:
                    cctv_entry.longitude = item.get("longitude")
                if item.get("video_url"):
                    cctv_entry.video_url = item.get("video_url")
                if item.get("stream_url"):
                    cctv_entry.stream_url = item.get("stream_url")
                if item.get("type"):
                    cctv_entry.type = item.get("type")
                if item.get("camera_type"):
                    cctv_entry.camera_type = item.get("camera_type")
                cctv_entry.is_deleted = False
                cctv_entry.deleted_at = None
                count_updated += 1

        db.session.commit()
        # Sinkronisasi worker AI dengan data CCTV terbaru
        reload_workers_thread(current_app._get_current_object())

        return api_response(
            data={
                "added": count_added,
                "updated": count_updated,
                "total": count_added + count_updated
            },
            message=f"Berhasil mengimpor {count_added + count_updated} CCTV ({count_added} data baru, {count_updated} diperbarui)."
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="COMMIT_ERROR", message=f"Gagal menyimpan ke database: {str(e)}", status=500)


# =========================================================================
# FITUR EKSPOR DATA (CSV & EXCEL)
# =========================================================================

def _get_cctv_export_dataframe(status_filter=None):
    """Menyiapkan DataFrame standar untuk ekspor data CCTV."""
    query = CCTV.query.filter(db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)))
    if status_filter and status_filter != "all":
        query = query.filter(db.func.lower(CCTV.status) == status_filter.lower())
    cameras = query.order_by(CCTV.lokasi.asc()).all()

    data = [
        {
            "ID": c.id,
            "Lokasi": c.lokasi,
            "Status": c.status,
            "Latitude": c.latitude if c.latitude is not None else "",
            "Longitude": c.longitude if c.longitude is not None else "",
            "Stream URL": c.stream_url or "",
            "Video URL": c.video_url or "",
            "Tipe Kamera": c.camera_type or "Fixed",
            "Tipe": c.type or "CCTV",
            "Waktu Ditambahkan": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(c, "created_at") and c.created_at else ""
        }
        for c in cameras
    ]
    return pd.DataFrame(data)


@api_bp.route("/cctv/export", methods=["GET"])
def api_cctv_export():
    """
    Mengekspor seluruh atau data CCTV terfilter ke format CSV atau Excel (.xlsx).
    Parameter query: ?format=csv|excel & ?status=all|aktif|nonaktif
    """
    export_format = request.args.get("format", "csv").strip().lower()
    status_filter = request.args.get("status", "all").strip().lower()
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    df = _get_cctv_export_dataframe(status_filter=status_filter)

    if export_format in ["excel", "xlsx"]:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Data CCTV")
        output.seek(0)
        filename = f"cctv_data_{timestamp_str}.xlsx"
        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    else:
        # Default: CSV
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        filename = f"cctv_data_{timestamp_str}.csv"
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8")),
            as_attachment=True,
            download_name=filename,
            mimetype="text/csv"
        )


@api_bp.route("/cctv/template", methods=["GET"])
def api_cctv_download_template():
    """
    Menyediakan template file contoh (.csv atau .xlsx) dengan struktur kolom resmi
    agar pengguna dapat mengisi data dengan benar sebelum diimpor.
    """
    export_format = request.args.get("format", "csv").strip().lower()
    sample_data = [
        {
            "lokasi": "Simpang Tugu Kujang",
            "status": "Aktif",
            "latitude": -6.5971,
            "longitude": 106.8060,
            "stream_url": "https://example.com/live/tugu_kujang.m3u8",
            "video_url": "",
            "camera_type": "Fixed",
            "type": "CCTV",
        },
        {
            "lokasi": "Simpang Jembatan Merah",
            "status": "Aktif",
            "latitude": -6.5912,
            "longitude": 106.7905,
            "stream_url": "https://example.com/live/jembatan_merah.m3u8",
            "video_url": "",
            "camera_type": "PTZ",
            "type": "Dishub",
        },
        {
            "lokasi": "Pos Baranangsiang",
            "status": "Non-Aktif",
            "latitude": -6.6025,
            "longitude": 106.8088,
            "stream_url": "",
            "video_url": "",
            "camera_type": "Fixed",
            "type": "Polres",
        }
    ]
    df = pd.DataFrame(sample_data)

    if export_format in ["excel", "xlsx"]:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Template CCTV")
        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="template_import_cctv.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    else:
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8")),
            as_attachment=True,
            download_name="template_import_cctv.csv",
            mimetype="text/csv"
        )


# =========================================================================
# FITUR HAPUS MASSAL (BULK DELETE / DELETE ALL)
# =========================================================================

@api_bp.route("/cctv/bulk-delete", methods=["POST"])
@api_auth_required(["admin"])
def api_cctv_bulk_delete():
    """
    Menghapus atau mengarsipkan kamera CCTV secara massal berdasarkan daftar ID
    atau menghapus seluruh kamera (delete all).
    """
    payload = request.get_json(silent=True) or {}
    ids = payload.get("ids", [])
    delete_all = payload.get("delete_all", False)
    force_hard_delete = payload.get("hard_delete", False)

    try:
        if delete_all:
            if force_hard_delete:
                CCTV.query.delete()
                msg = "Seluruh kamera CCTV berhasil dihapus permanen dari sistem."
            else:
                CCTV.query.update({
                    CCTV.is_deleted: True,
                    CCTV.deleted_at: datetime.utcnow(),
                    CCTV.status: "Non-Aktif"
                })
                msg = "Seluruh kamera CCTV berhasil diarsipkan (soft-delete)."
        elif ids and isinstance(ids, list):
            target_query = CCTV.query.filter(CCTV.id.in_(ids))
            count_target = target_query.count()
            if force_hard_delete:
                target_query.delete(synchronize_session=False)
                msg = f"{count_target} kamera CCTV berhasil dihapus permanen."
            else:
                target_query.update({
                    CCTV.is_deleted: True,
                    CCTV.deleted_at: datetime.utcnow(),
                    CCTV.status: "Non-Aktif"
                }, synchronize_session=False)
                msg = f"{count_target} kamera CCTV berhasil diarsipkan (soft-delete)."
        else:
            return api_error(code="VALIDATION_ERROR", message="Daftar ID kamera atau opsi delete_all wajib disertakan.")

        db.session.commit()
        # Reload worker threads
        reload_workers_thread(current_app._get_current_object())
        return api_response(message=msg)
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal melakukan penghapusan massal: {str(e)}", status=500)

