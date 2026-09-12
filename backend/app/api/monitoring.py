"""
Enterprise REST API - Live Video Monitoring & AI Detection Analytics Service
Menyediakan daftar feed kamera live, statistik kerumunan real-time,
pelanggaran lalu lintas, dan stream video multipart untuk Next.js client.
"""

from flask import request, Response, current_app
from sqlalchemy.orm import joinedload
from app import db, socketio
from app.models import CCTV, ParkingViolation, OdolDetection
from app.engine import (
    generate_frames,
    LATEST_DETECTION_STATS,
    get_notification_enabled,
    set_notification_enabled,
    toggle_notification_enabled,
)
from app.security import api_response, api_error, api_auth_required
from . import api_bp


@api_bp.route("/monitoring/cameras", methods=["GET"])
def api_get_monitoring_cameras():
    """Mengambil daftar kamera aktif yang memiliki stream URL untuk live monitor."""
    cameras = (
        CCTV.query.filter(
            CCTV.status.ilike("aktif"),
            CCTV.stream_url.isnot(None),
            db.or_(CCTV.is_deleted.is_(False), CCTV.is_deleted.is_(None)),
        )
        .order_by(CCTV.lokasi.asc())
        .all()
    )

    data = [
        {
            "id": c.id,
            "name": f"Kamera {str(c.id).zfill(2)}",
            "lokasi": c.lokasi,
            "type": c.type or "CCTV",
            "camera_type": c.camera_type or "Fixed",
            "stream_url": c.stream_url,
            "latitude": c.latitude,
            "longitude": c.longitude,
        }
        for c in cameras
    ]

    return api_response(data=data, meta={"total": len(data)})


@api_bp.route("/monitoring/stats/<int:camera_id>", methods=["GET"])
def api_get_crowd_stats(camera_id: int):
    """Mengambil statistik deteksi kerumunan dan kendaraan real-time pada kamera terpilih."""
    camera = CCTV.query.get(camera_id)
    if not camera:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)

    location_name = camera.lokasi

    if location_name in LATEST_DETECTION_STATS:
        stats = LATEST_DETECTION_STATS[location_name]
        total_counts = stats.get("total_counts", {})
        total_vehicles = (
            total_counts.get("car", 0)
            + total_counts.get("motorcycle", 0)
            + total_counts.get("bus", 0)
        )
        crowd_size = stats.get("crowd_size", 0)

        data = {
            "status": "active",
            "camera_id": camera_id,
            "location": location_name,
            "people_count": total_counts.get("person", 0),
            "motion_events": stats.get("current_tracking", 0),
            "crowd_size": crowd_size,
            "total_vehicles": total_vehicles,
            "is_crowd_detected": crowd_size > 0,
            "grand_total": stats.get("grand_total", 0),
            "timestamp": stats.get("timestamp", 0),
        }
    else:
        data = {
            "status": "idle",
            "camera_id": camera_id,
            "location": location_name,
            "people_count": 0,
            "motion_events": 0,
            "crowd_size": 0,
            "total_vehicles": 0,
            "is_crowd_detected": False,
            "grand_total": 0,
            "timestamp": 0,
        }

    return api_response(data=data)


@api_bp.route("/monitoring/violations", methods=["GET"])
def api_get_violations():
    """Mengambil riwayat pelanggaran parkir liar dan kendaraan ODOL terkini."""
    limit = min(50, int(request.args.get("limit", 20)))

    parking = (
        ParkingViolation.query.options(joinedload(ParkingViolation.cctv))
        .order_by(ParkingViolation.timestamp.desc())
        .limit(limit)
        .all()
    )
    odol = (
        OdolDetection.query.options(joinedload(OdolDetection.cctv))
        .order_by(OdolDetection.timestamp.desc())
        .limit(limit)
        .all()
    )

    parking_data = [
        {
            "id": v.id,
            "cctv_id": v.cctv_id,
            "lokasi": v.cctv.lokasi if v.cctv else "Kamera Tidak Dikenal",
            "duration_sec": getattr(v, "parked_duration_sec", 0),
            "vehicle_type": v.vehicle_type,
            "object_id": getattr(v, "object_id", None),
            "timestamp": v.timestamp.isoformat() if v.timestamp else None,
        }
        for v in parking
    ]

    odol_data = [
        {
            "id": o.id,
            "cctv_id": o.cctv_id,
            "lokasi": o.cctv.lokasi if o.cctv else "Kamera Tidak Dikenal",
            "vehicle_type": o.vehicle_type,
            "aspect_ratio": getattr(o, "aspect_ratio", 0.0),
            "area": getattr(o, "area", 0.0),
            "timestamp": o.timestamp.isoformat() if o.timestamp else None,
        }
        for o in odol
    ]

    return api_response(data={
        "parking_violations": parking_data,
        "odol_detections": odol_data,
        "totals": {
            "parking": len(parking_data),
            "odol": len(odol_data)
        }
    })



@api_bp.route("/monitoring/stream/<int:camera_id>")
def api_video_stream(camera_id: int):
    """
    Stream video multipart MJPEG dari kamera CCTV yang dapat langsung
    dirender oleh Next.js Frontend menggunakan tag <img src="..." />
    """
    camera = CCTV.query.get(camera_id)
    if not camera or not camera.stream_url:
        return "CCTV tidak ditemukan atau stream URL belum dikonfigurasi.", 404

    mode = request.args.get("mode", "simple")  # simple, parking, plate

    return Response(
        generate_frames(camera.stream_url, camera.lokasi, detection_mode=mode),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@api_bp.route("/monitoring/notifications/status", methods=["GET"])
@api_auth_required()
def api_get_notification_status():
    """Mengambil status global pemberitahuan/notifikasi sistem."""
    enabled = get_notification_enabled()
    return api_response(data={"enabled": enabled})


@api_bp.route("/monitoring/notifications/toggle", methods=["POST"])
@api_auth_required()
def api_toggle_notification_status():
    """Membalik atau memperbarui status global pemberitahuan/notifikasi sistem."""
    payload = request.get_json(silent=True) or {}
    if "enabled" in payload:
        target_state = bool(payload["enabled"])
        enabled = set_notification_enabled(target_state)
    else:
        enabled = toggle_notification_enabled()

    # Broadcast perubahan ke seluruh klien yang terhubung melalui WebSocket
    try:
        socketio.emit("notification_status_update", {"enabled": enabled})
    except Exception as e:
        current_app.logger.warning(f"SocketIO broadcast notification status error: {e}")

    status_str = "diaktifkan" if enabled else "dinonaktifkan"
    return api_response(
        data={"enabled": enabled},
        message=f"Notifikasi sistem berhasil {status_str}."
    )

