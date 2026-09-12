export interface CrowdStats {
  status: "active" | "idle";
  camera_id: number;
  location: string;
  people_count: number;
  motion_events: number;
  crowd_size: number;
  total_vehicles: number;
  is_crowd_detected: boolean;
  grand_total: number;
  timestamp: number;
}

export interface ParkingViolation {
  id: number;
  cctv_id: number;
  lokasi: string;
  duration_sec: number;
  vehicle_type: string;
  object_id?: number | null;
  timestamp: string;
}

export interface OdolDetection {
  id: number;
  cctv_id: number;
  lokasi: string;
  vehicle_type: string;
  aspect_ratio: number;
  area: number;
  timestamp: string;
}


export interface NotificationPayload {
  title: string;
  detail?: string;
  location?: string;
  people_count?: number;
  icon?: string;
  timestamp?: string;
}
