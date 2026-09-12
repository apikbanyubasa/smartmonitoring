export interface CCTV {
  id: number;
  lokasi: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  video_url: string | null;
  stream_url: string | null;
  type: string;
  camera_type: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CCTVSummary {
  total: number;
  aktif: number;
  nonaktif: number;
  deleted: number;
}
