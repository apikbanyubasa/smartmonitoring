"""
Enterprise REST API - Emergency Dispatch & WhatsApp Communication Service
Menangani daftar kontak darurat instansi, riwayat dispatch, dan integrasi WhatsApp Fonnte.
"""

from flask import request, g
from sqlalchemy.orm import joinedload
from app import db
from app.models import Kontak, Dispatch
from app.services import send_whatsapp_message
from app.security import (
    api_auth_required,
    rate_limit,
    api_response,
    api_error,
)
from . import api_bp


@api_bp.route("/dispatch/contacts", methods=["GET"])
def api_get_contacts():
    """Mengambil daftar seluruh kontak darurat instansi (Dishub, Damkar, Polresta, dll)."""
    kontak_list = Kontak.query.order_by(Kontak.instansi.asc()).all()
    data = [
        {
            "id": k.id,
            "instansi": k.instansi,
            "nomor_telp": k.nomor_telp,
            "deskripsi": getattr(k, "deskripsi", "") or "",
        }
        for k in kontak_list
    ]
    return api_response(data=data, meta={"total": len(data)})


@api_bp.route("/dispatch/history", methods=["GET"])
@api_auth_required(["admin", "operator"])
def api_get_dispatch_history():
    """Mengambil riwayat log pengiriman dispatch darurat."""
    limit = min(100, int(request.args.get("limit", 50)))
    kontak_id = request.args.get("kontak_id")

    query = (
        Dispatch.query.options(
            joinedload(Dispatch.kontak),
            joinedload(Dispatch.operator)
        )
        .order_by(Dispatch.waktu_kirim.desc())
    )

    if kontak_id:
        query = query.filter(Dispatch.kontak_id == kontak_id)

    dispatches = query.limit(limit).all()

    data = [
        {
            "id": d.id,
            "kontak_id": d.kontak_id,
            "instansi": d.kontak.instansi if d.kontak else "Instansi Tidak Dikenal",
            "nomor_telp": d.kontak.nomor_telp if d.kontak else "-",
            "tipe_kejadian": d.tipe_dispatch,
            "instruksi": d.instruksi,
            "status": d.status,
            "waktu_kirim": d.waktu_kirim.isoformat() if d.waktu_kirim else None,
            "operator": d.operator.username if d.operator else "Sistem",
        }
        for d in dispatches
    ]

    return api_response(data=data, meta={"total": len(data)})


@api_bp.route("/dispatch/send", methods=["POST"])
@api_auth_required(["admin", "operator"])
@rate_limit(limit=10, period=60, by="user", message="Batas kuota kirim pesan tercapai (maks 10 per menit). Tunggu sebentar.")
def api_send_dispatch():
    """Mencatat instruksi dispatch ke database dan mengirimkannya via WhatsApp API."""
    data = request.get_json(silent=True) or {}
    kontak_id = data.get("kontak_id")
    tipe_kejadian = data.get("tipe_kejadian", "Darurat")
    instruksi = data.get("instruksi", "").strip()

    if not kontak_id or not instruksi:
        return api_error(code="VALIDATION_ERROR", message="Instansi tujuan dan instruksi wajib diisi.")

    kontak = Kontak.query.get(kontak_id)
    if not kontak:
        return api_error(code="NOT_FOUND", message="Instansi kontak tidak ditemukan.", status=404)

    try:
        new_dispatch = Dispatch(
            kontak_id=kontak.id,
            user_id=g.current_user.id,
            tipe_dispatch=tipe_kejadian,
            instruksi=instruksi,
        )
        db.session.add(new_dispatch)
        db.session.commit()

        # Kirim pesan via WhatsApp Gateway (Fonnte)
        msg_payload = {
            "tipe_kejadian": tipe_kejadian,
            "instruksi": instruksi,
            "instansi_nama": kontak.instansi,
        }
        wa_success, wa_message = send_whatsapp_message(kontak.nomor_telp, msg_payload)

        result_payload = {
            "id": new_dispatch.id,
            "kontak_id": kontak.id,
            "instansi": kontak.instansi,
            "nomor_telp": kontak.nomor_telp,
            "tipe_kejadian": tipe_kejadian,
            "instruksi": instruksi,
            "waktu_kirim": new_dispatch.waktu_kirim.isoformat(),
            "operator": g.current_user.username,
            "wa_delivered": wa_success,
            "wa_detail": wa_message,
        }

        msg = f"Dispatch ke {kontak.instansi} berhasil dicatat."
        if not wa_success:
            msg += f" (Peringatan WA: {wa_message})"

        return api_response(data=result_payload, message=msg, status=201)

    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal mencatat dispatch: {str(e)}", status=500)


@api_bp.route("/dispatch/contacts", methods=["POST"])
@api_auth_required(["admin", "operator"])
def api_create_contact():
    """Menambahkan kontak instansi darurat baru."""
    data = request.get_json(silent=True) or {}
    instansi = data.get("instansi", "").strip()
    nomor_telp = data.get("nomor_telp", "").strip()

    if not instansi or not nomor_telp:
        return api_error(code="VALIDATION_ERROR", message="Nama instansi dan nomor telepon wajib diisi.")

    try:
        new_k = Kontak(instansi=instansi, nomor_telp=nomor_telp)
        db.session.add(new_k)
        db.session.commit()
        return api_response(
            data={"id": new_k.id, "instansi": new_k.instansi, "nomor_telp": new_k.nomor_telp},
            message="Kontak instansi berhasil ditambahkan.",
            status=201
        )
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menyimpan kontak: {str(e)}", status=500)


@api_bp.route("/dispatch/contacts/<int:kontak_id>", methods=["DELETE"])
@api_auth_required(["admin"])
def api_delete_contact(kontak_id: int):
    """Menghapus kontak instansi darurat."""
    k = Kontak.query.get(kontak_id)
    if not k:
        return api_error(code="NOT_FOUND", message="Kontak tidak ditemukan.", status=404)
    try:
        db.session.delete(k)
        db.session.commit()
        return api_response(message=f"Kontak {k.instansi} berhasil dihapus.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus kontak: {str(e)}", status=500)


@api_bp.route("/dispatch/history/<int:dispatch_id>", methods=["DELETE"])
@api_auth_required(["admin"])
def api_delete_dispatch_history(dispatch_id: int):
    """Menghapus catatan log pengiriman dispatch."""
    d = Dispatch.query.get(dispatch_id)
    if not d:
        return api_error(code="NOT_FOUND", message="Log dispatch tidak ditemukan.", status=404)
    try:
        db.session.delete(d)
        db.session.commit()
        return api_response(message="Log riwayat dispatch berhasil dihapus.")
    except Exception as e:
        db.session.rollback()
        return api_error(code="DB_ERROR", message=f"Gagal menghapus log dispatch: {str(e)}", status=500)

