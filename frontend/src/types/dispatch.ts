export interface EmergencyContact {
  id: number;
  instansi: string;
  nomor_telp: string;
  deskripsi?: string;
}

export interface DispatchRecord {
  id: number;
  kontak_id: number;
  instansi: string;
  nomor_telp: string;
  tipe_kejadian: string;
  instruksi: string;
  status: string;
  waktu_kirim: string;
  operator: string;
}

export interface NoteItem {
  id: string;
  title: string;
  text: string;
  isPinned: boolean;
  updatedAt?: string;
}
