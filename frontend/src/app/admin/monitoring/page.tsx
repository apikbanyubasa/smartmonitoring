"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Users,
  Ban,
  Truck,
  Search,
  AlertCircle,
  Bell,
  BellOff,
  Check,
  Radio,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useNotification } from "@/context/NotificationContext";
import { CCTV } from "@/types/cctv";
import { CrowdStats, NotificationPayload } from "@/types/monitoring";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MonitoringPage() {
  // State
  const { notificationsEnabled } = useNotification();
  const notificationsEnabledRef = React.useRef(notificationsEnabled);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const [cameras, setCameras] = useState<CCTV[]>([]);
  const [activeCamera, setActiveCamera] = useState<CCTV | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time Traffic Counts
  const [crowdCount, setCrowdCount] = useState<number>(0);
  const [parkingCount, setParkingCount] = useState<number>(0);
  const [odolCount, setOdolCount] = useState<number>(0);

  // Flash highlight state
  const [flashCard, setFlashCard] = useState<string | null>(null);


  // Notification Logs
  const [notifications, setNotifications] = useState<
    (NotificationPayload & { id: number; time: string })[]
  >([]);

  // 1. Fetch Camera Data
  const loadCameras = async () => {
    setIsLoading(true);
    setError(null);

    const res = await fetchApi<CCTV[]>("/api/v1/monitoring/cameras");
    setIsLoading(false);

    if (res.success && Array.isArray(res.data)) {
      setCameras(res.data);
      if (res.data.length > 0 && !activeCamera) {
        setActiveCamera(res.data[0]);
      }
    } else {
      setError(res.message || "Gagal memuat daftar kamera dari server.");
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  // 2. Fetch Crowd Stats for Active Camera
  useEffect(() => {
    if (!activeCamera) return;

    let isSubscribed = true;

    const fetchStats = async () => {
      const res = await fetchApi<CrowdStats>(
        `/api/v1/monitoring/stats/${activeCamera.id}`
      );
      if (isSubscribed && res.success && res.data) {
        setCrowdCount(res.data.people_count || 0);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeCamera]);

  // 3. Socket.IO Real-time Notifications Listener
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (data: NotificationPayload) => {
      // Abaikan jika notifikasi dinonaktifkan oleh admin
      if (!notificationsEnabledRef.current) {
        return;
      }

      const newNotif = {
        ...data,
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]);

      const title = (data.title || "").toLowerCase();
      const detail = (data.detail || "").toLowerCase();

      if (title.includes("kerumunan")) {
        if (data.people_count !== undefined) {
          setCrowdCount(data.people_count);
        }
        triggerFlash("crowd");
      } else if (title.includes("parkir") || detail.includes("parkir")) {
        setParkingCount((prev) => prev + 1);
        triggerFlash("parking");
      } else if (title.includes("odol") || detail.includes("odol")) {
        setOdolCount((prev) => prev + 1);
        triggerFlash("odol");
      }
    };

    socket.on("notifikasi_baru", handleNewNotification);

    return () => {
      socket.off("notifikasi_baru", handleNewNotification);
    };
  }, []);

  // 4. Measure Center Column Height for Perfect 3-Column Symmetrical Alignment
  const centerColRef = React.useRef<HTMLDivElement>(null);
  const [centerHeight, setCenterHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!centerColRef.current) return;
    const updateHeight = () => {
      if (centerColRef.current) {
        const h = centerColRef.current.offsetHeight;
        if (h > 200) {
          setCenterHeight(h);
        }
      }
    };

    updateHeight();
    const rafId = requestAnimationFrame(updateHeight);
    const timer = setTimeout(updateHeight, 200);

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(centerColRef.current);
    window.addEventListener("resize", updateHeight);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [activeCamera]);

  const triggerFlash = (cardKey: string) => {
    setFlashCard(cardKey);
    setTimeout(() => setFlashCard(null), 700);
  };

  const dismissNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredCameras = cameras.filter((c) =>
    c.lokasi.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-indigo-500 animate-pulse" />
            Monitoring Terpadu Vision AI
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau arus lalu lintas, analisis kerumunan, dan penertiban pelanggaran secara real-time.
          </p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadCameras} />}

      {/* Grid Container 3 Kolom - Symmetrical & Balanced */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI: Daftar Kamera (Col 3) - Sejajar & Scroll Internal */}
        <div
          style={
            centerHeight
              ? { height: `${centerHeight}px`, maxHeight: `${centerHeight}px` }
              : undefined
          }
          className="col-span-12 lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[560px] lg:h-[600px]"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 flex-shrink-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              Daftar Kamera
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {cameras.length} CCTV
            </span>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-800/80 flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari lokasi kamera..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Camera List - Scrolls smoothly with matching height */}
          <div className="p-2 space-y-1.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredCameras.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada kamera ditemukan
              </div>
            ) : (
              filteredCameras.map((cam) => {
                const isActive = activeCamera?.id === cam.id;
                return (
                  <button
                    key={cam.id}
                    onClick={() => setActiveCamera(cam)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/25"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold truncate leading-tight">
                          {cam.lokasi}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${
                            isActive ? "text-indigo-200" : "text-slate-500"
                          } uppercase font-medium`}
                        >
                          {cam.type || "CCTV"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isActive ? "bg-emerald-300" : "bg-emerald-500"
                      } animate-pulse`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* KOLOM TENGAH: Live Stream Player & Stats (Col 6) - Natural Top Position */}
        <div ref={centerColRef} className="col-span-12 lg:col-span-6 space-y-4">
          <VideoPlayer
            cameraId={activeCamera?.id || null}
            locationName={activeCamera?.lokasi || "Pilih Kamera"}
          />

          {/* 3 Metrics Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Card Kerumunan */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all duration-300 ${
                flashCard === "crowd"
                  ? "bg-indigo-500/20 border-indigo-400 ring-2 ring-indigo-400"
                  : "bg-slate-900/90 border-slate-800"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white leading-none mb-1">
                {crowdCount}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Kerumunan
              </p>
            </div>

            {/* Card Parkir Liar */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all duration-300 ${
                flashCard === "parking"
                  ? "bg-rose-500/20 border-rose-400 ring-2 ring-rose-400"
                  : "bg-slate-900/90 border-slate-800"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-2">
                <Ban className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white leading-none mb-1">
                {parkingCount}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Parkir Liar
              </p>
            </div>

            {/* Card ODOL */}
            <div
              className={`p-4 rounded-2xl border text-center transition-all duration-300 ${
                flashCard === "odol"
                  ? "bg-amber-500/20 border-amber-400 ring-2 ring-amber-400"
                  : "bg-slate-900/90 border-slate-800"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Truck className="w-4 h-4" />
              </div>
              <div className="text-2xl font-extrabold text-white leading-none mb-1">
                {odolCount}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Muatan ODOL
              </p>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Real-time Socket.IO Alert Logs (Col 3) - Sejajar & Scroll Internal */}
        <div
          style={
            centerHeight
              ? { height: `${centerHeight}px`, maxHeight: `${centerHeight}px` }
              : undefined
          }
          className="col-span-12 lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[560px] lg:h-[600px]"
        >
          <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 flex-shrink-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              {notificationsEnabled ? (
                <Bell className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-slate-500" />
              )}
              Log Peringatan Real-time
            </h3>
            <div className="flex items-center gap-1.5">
              {!notificationsEnabled && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Dibisukan
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {notifications.length} Event
              </span>
            </div>
          </div>

          <div className="p-3 space-y-2.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {!notificationsEnabled && (
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                <BellOff className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>Pemberitahuan dinonaktifkan via tombol sidebar. Alert disenyapkan.</span>
              </div>
            )}
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Bell className="w-7 h-7 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs">Menunggu event deteksi AI...</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2 animate-fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">
                        {notif.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 break-words leading-relaxed">
                        {notif.detail || notif.location || "Terdeteksi oleh AI"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-500">
                      {notif.time}
                    </span>
                    <button
                      onClick={() => dismissNotification(notif.id)}
                      className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-indigo-500/10 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> OK
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

