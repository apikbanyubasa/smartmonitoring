"""
Enterprise REST API - Traffic Density & Vehicle Analytics Service
Menyediakan agregasi volume kendaraan harian, distribusi klasifikasi objek (motor, mobil, bus, truk),
dan penghitungan lalu lintas real-time untuk Next.js client.
"""

from datetime import datetime
from flask import request
from app import db
from app.models import CCTV, CountingData
from app.engine import LATEST_DETECTION_STATS
from app.security import api_response, api_error
from . import api_bp


@api_bp.route("/kepadatan/metrics", methods=["GET"])
def api_get_kepadatan_metrics():
    """
    Mengambil metrik volume kendaraan harian dan data distribusi untuk visualisasi Chart.js.
    Menggunakan agregasi SQL murni (SUM, GROUP BY) untuk performa tingkat enterprise.
    """
    cctv_id = request.args.get("cctv_id")

    # 1. Agregasi Total dan Volume Arah Menggunakan SQL SUM
    totals_query = db.session.query(
        db.func.coalesce(db.func.sum(CountingData.counts_dekat_motorcycle), 0).label("motor_dekat"),
        db.func.coalesce(db.func.sum(CountingData.counts_jauh_motorcycle), 0).label("motor_jauh"),
        db.func.coalesce(db.func.sum(CountingData.counts_dekat_car), 0).label("car_dekat"),
        db.func.coalesce(db.func.sum(CountingData.counts_jauh_car), 0).label("car_jauh"),
        db.func.coalesce(db.func.sum(CountingData.counts_dekat_bus), 0).label("bus_dekat"),
        db.func.coalesce(db.func.sum(CountingData.counts_jauh_bus), 0).label("bus_jauh"),
        db.func.coalesce(db.func.sum(CountingData.counts_dekat_truck), 0).label("truck_dekat"),
        db.func.coalesce(db.func.sum(CountingData.counts_jauh_truck), 0).label("truck_jauh"),
        db.func.coalesce(db.func.sum(CountingData.grand_total), 0).label("grand_total"),
    )
    if cctv_id:
        totals_query = totals_query.filter(CountingData.cctv_id == cctv_id)

    tot = totals_query.first()

    motor_dekat = int(tot.motor_dekat) if tot else 0
    motor_jauh = int(tot.motor_jauh) if tot else 0
    car_dekat = int(tot.car_dekat) if tot else 0
    car_jauh = int(tot.car_jauh) if tot else 0
    bus_dekat = int(tot.bus_dekat) if tot else 0
    bus_jauh = int(tot.bus_jauh) if tot else 0
    truck_dekat = int(tot.truck_dekat) if tot else 0
    truck_jauh = int(tot.truck_jauh) if tot else 0

    total_motor = motor_dekat + motor_jauh
    total_car = car_dekat + car_jauh
    total_bus = bus_dekat + bus_jauh
    total_truck = truck_dekat + truck_jauh
    grand_total = int(tot.grand_total) if tot and tot.grand_total > 0 else (total_motor + total_car + total_bus + total_truck)

    # 2. Agregasi Distribusi 24 Jam Menggunakan SQL GROUP BY
    hourly_query = db.session.query(
        db.func.extract("hour", CountingData.timestamp).label("hour"),
        db.func.coalesce(db.func.sum(CountingData.grand_total), 0).label("volume"),
    )
    if cctv_id:
        hourly_query = hourly_query.filter(CountingData.cctv_id == cctv_id)

    hourly_records = (
        hourly_query.filter(CountingData.timestamp.isnot(None))
        .group_by("hour")
        .all()
    )
    hourly_map = {int(r.hour): int(r.volume) for r in hourly_records if r.hour is not None}
    hourly_volume = [
        {"hour": f"{str(h).zfill(2)}:00", "volume": hourly_map.get(h, 0)}
        for h in range(24)
    ]

    # 3. Rincian Rekapitulasi per CCTV Menggunakan SQL JOIN (Zero N+1 Query)
    table_query = (
        db.session.query(
            CountingData.cctv_id,
            CCTV.lokasi,
            db.func.coalesce(db.func.sum(CountingData.counts_dekat_motorcycle), 0).label("motor_dekat"),
            db.func.coalesce(db.func.sum(CountingData.counts_jauh_motorcycle), 0).label("motor_jauh"),
            db.func.coalesce(db.func.sum(CountingData.counts_dekat_car), 0).label("car_dekat"),
            db.func.coalesce(db.func.sum(CountingData.counts_jauh_car), 0).label("car_jauh"),
            db.func.coalesce(db.func.sum(CountingData.counts_dekat_bus), 0).label("bus_dekat"),
            db.func.coalesce(db.func.sum(CountingData.counts_jauh_bus), 0).label("bus_jauh"),
            db.func.coalesce(db.func.sum(CountingData.counts_dekat_truck), 0).label("truck_dekat"),
            db.func.coalesce(db.func.sum(CountingData.counts_jauh_truck), 0).label("truck_jauh"),
            db.func.coalesce(db.func.sum(CountingData.grand_total), 0).label("total"),
        )
        .join(CCTV, CountingData.cctv_id == CCTV.id)
    )
    if cctv_id:
        table_query = table_query.filter(CountingData.cctv_id == cctv_id)

    table_rows = table_query.group_by(CountingData.cctv_id, CCTV.lokasi).order_by(CCTV.lokasi.asc()).all()
    table_data = [
        {
            "cctv_id": r.cctv_id,
            "lokasi": r.lokasi,
            "motor_dekat": int(r.motor_dekat),
            "motor_jauh": int(r.motor_jauh),
            "car_dekat": int(r.car_dekat),
            "car_jauh": int(r.car_jauh),
            "bus_dekat": int(r.bus_dekat),
            "bus_jauh": int(r.bus_jauh),
            "truck_dekat": int(r.truck_dekat),
            "truck_jauh": int(r.truck_jauh),
            "total": int(r.total),
        }
        for r in table_rows
    ]

    return api_response(data={
        "totals": {
            "grand_total": grand_total,
            "motorcycle": total_motor,
            "car": total_car,
            "bus": total_bus,
            "truck": total_truck,
        },
        "directional_volume": {
            "dekat": {
                "motorcycle": motor_dekat,
                "car": car_dekat,
                "bus": bus_dekat,
                "truck": truck_dekat,
            },
            "jauh": {
                "motorcycle": motor_jauh,
                "car": car_jauh,
                "bus": bus_jauh,
                "truck": truck_jauh,
            },
        },
        "composition_percentages": {
            "motorcycle": round((total_motor / grand_total * 100), 1) if grand_total > 0 else 0,
            "car": round((total_car / grand_total * 100), 1) if grand_total > 0 else 0,
            "bus": round((total_bus / grand_total * 100), 1) if grand_total > 0 else 0,
            "truck": round((total_truck / grand_total * 100), 1) if grand_total > 0 else 0,
        },
        "hourly_volume": hourly_volume,
        "table_data": table_data,
    })


@api_bp.route("/kepadatan/live/<int:cctv_id>", methods=["GET"])
def api_get_cctv_live_stats(cctv_id: int):
    """Mengambil statistik deteksi kendaraan langsung dari memori AI worker."""
    cctv = CCTV.query.get(cctv_id)
    if not cctv:
        return api_error(code="NOT_FOUND", message="Kamera CCTV tidak ditemukan.", status=404)

    stats = LATEST_DETECTION_STATS.get(cctv.lokasi, {})
    counts_jauh = stats.get("counts_jauh", {})
    counts_dekat = stats.get("counts_dekat", {})

    live_counts = {
        "person": counts_jauh.get("person", 0) + counts_dekat.get("person", 0),
        "car": counts_jauh.get("car", 0) + counts_dekat.get("car", 0),
        "motorcycle": counts_jauh.get("motorcycle", 0) + counts_dekat.get("motorcycle", 0),
        "bus": counts_jauh.get("bus", 0) + counts_dekat.get("bus", 0),
        "truck": counts_jauh.get("truck", 0) + counts_dekat.get("truck", 0),
    }

    return api_response(data={
        "cctv_id": cctv.id,
        "lokasi": cctv.lokasi,
        "status": cctv.status,
        "live_counts": live_counts,
        "total_active_vehicles": live_counts["car"] + live_counts["motorcycle"] + live_counts["bus"] + live_counts["truck"],
    })
