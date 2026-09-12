"""
Service untuk integrasi WhatsApp API (Fonnte).
Mematuhi Enterprise Guidelines:
- Outbound HTTP Timeout eksplisit (10 detik) untuk mencegah event loop / thread starvation.
- Validasi parameter dan konfigurasi.
- Kontrak response yang konsisten: (success: bool, message: str).
"""

from typing import Dict, Any, Tuple, Union
import requests
from flask import current_app

def format_phone_number(raw_number: str) -> str:
    """
    Format nomor telepon ke standar internasional Indonesia tanpa tanda plus (e.g. 62812345678).
    """
    clean = str(raw_number).strip().replace(" ", "").replace("-", "")
    if clean.startswith("+62"):
        return clean.replace("+", "")
    elif clean.startswith("0"):
        return "62" + clean[1:]
    return clean

def send_whatsapp_message(
    target_number: str,
    message_content: Union[Dict[str, Any], str]
) -> Tuple[bool, str]:
    """
    Mengirim pesan WhatsApp via Fonnte API dengan timeout 10 detik.
    
    :param target_number: Nomor tujuan (e.g. '08123456789')
    :param message_content: Dict berisi metadata dispatch atau string pesan langsung
    :return: (is_success, status_message)
    """
    api_url = current_app.config.get("WA_API_URL")
    api_token = current_app.config.get("WA_API_TOKEN")

    if not api_url or not api_token:
        return False, "Konfigurasi WhatsApp API (WA_API_URL / WA_API_TOKEN) belum diset di .env."

    formatted_number = format_phone_number(target_number)

    if isinstance(message_content, dict):
        tipe = message_content.get("tipe_kejadian", "Umum")
        instruksi = message_content.get("instruksi", "-")
        instansi = message_content.get("instansi_nama", "Terkait")
        body_text = f"🚨 DISPATCH BARU - Tipe: {tipe} | Instansi: {instansi}\nInstruksi: {instruksi}"
    else:
        body_text = str(message_content)

    payload = {
        "target": formatted_number,
        "message": body_text,
    }
    headers = {
        "Authorization": api_token,
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        # Menetapkan timeout 10 detik sesuai standar enterprise
        response = requests.post(api_url, data=payload, headers=headers, timeout=10)
        response.raise_for_status()

        result = response.json()
        if result.get("status") in [True, "true", "success"]:
            return True, f"Pesan WhatsApp berhasil dikirim ke {formatted_number}."
        else:
            reason = result.get("reason") or result.get("message") or "Tidak ada alasan spesifik."
            return False, f"Gagal kirim WA (Fonnte API): {reason}"

    except requests.exceptions.Timeout:
        return False, "Koneksi ke server WhatsApp API timed out (melebihi 10 detik)."
    except requests.exceptions.RequestException as e:
        return False, f"Kesalahan koneksi WhatsApp API: {e}"
    except Exception as e:
        return False, f"Kesalahan internal saat memproses pesan WA: {e}"
