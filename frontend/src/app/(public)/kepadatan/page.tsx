"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Search,
  Video,
  VideoOff,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Table,
  CheckCircle2,
  AlertCircle,
  Radio,
  Car,
  Truck,
  Bike,
  Bus,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { CCTV } from "@/types/cctv";
import { Skeleton } from "@/components/ui/Skeleton";

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dynamic Leaflet Map Component (ssr: false)
const LeafletMap = dynamic(
  () => import("@/components/LeafletMap").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#141B35] rounded-xl">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
    ),
  }
);

interface TableRowData {
  cctv_id: number;
  lokasi: string;
  motor_dekat: number;
  motor_jauh: number;
  car_dekat: number;
  car_jauh: number;
  bus_dekat: number;
  bus_jauh: number;
  truck_dekat: number;
  truck_jauh: number;
  total: number;
}

export default function KepadatanPage() {
  // CCTV State
  const [cameras, setCameras] = useState<CCTV[]>([]);
  const [activeCCTV, setActiveCCTV] = useState<CCTV | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Video Stream State (4 UI States)
  const [streamState, setStreamState] = useState<"loading" | "success" | "error" | "empty">("empty");
  const [streamErrorMsg, setStreamErrorMsg] = useState("");
  const [streamKey, setStreamKey] = useState(0);

  // Analytics State
  const [metrics, setMetrics] = useState<{
    totals: { grand_total: number; motorcycle: number; car: number; bus: number; truck: number };
    percentages: { motorcycle: number; car: number; bus: number; truck: number };
    hourly_volume: { hour: string; volume: number }[];
    directional: {
      dekat: { motorcycle: number; car: number; bus: number; truck: number };
      jauh: { motorcycle: number; car: number; bus: number; truck: number };
    };
    table_data: TableRowData[];
  }>({
    totals: { grand_total: 0, motorcycle: 0, car: 0, bus: 0, truck: 0 },
    percentages: { motorcycle: 0, car: 0, bus: 0, truck: 0 },
    hourly_volume: Array.from({ length: 24 }).map((_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      volume: 0,
    })),
    directional: {
      dekat: { motorcycle: 0, car: 0, bus: 0, truck: 0 },
      jauh: { motorcycle: 0, car: 0, bus: 0, truck: 0 },
    },
    table_data: [],
  });

  // Real-time Live Vehicle counts on active camera
  const [liveVehicleCounts, setLiveVehicleCounts] = useState({
    motorcycle: 0,
    car: 0,
    bus: 0,
    truck: 0,
  });

  // 1. Initial Load: Cameras & Metrics
  useEffect(() => {
    const loadInitialData = async () => {
      const [camRes, metRes] = await Promise.all([
        fetchApi<CCTV[]>("/api/v1/cctv"),
        fetchApi<any>("/api/v1/kepadatan/metrics"),
      ]);

      if (camRes.success && Array.isArray(camRes.data) && camRes.data.length > 0) {
        setCameras(camRes.data);
        const featured = camRes.data.find((c) => c.status?.toLowerCase() === "aktif" && c.stream_url) || camRes.data[0];
        setActiveCCTV(featured);
        setStreamState("loading");
      }

      if (metRes.success && metRes.data) {
        setMetrics({
          totals: metRes.data.totals || { grand_total: 0, motorcycle: 0, car: 0, bus: 0, truck: 0 },
          percentages: metRes.data.composition_percentages || { motorcycle: 0, car: 0, bus: 0, truck: 0 },
          hourly_volume: metRes.data.hourly_volume || [],
          directional: metRes.data.directional_volume || {
            dekat: { motorcycle: 0, car: 0, bus: 0, truck: 0 },
            jauh: { motorcycle: 0, car: 0, bus: 0, truck: 0 },
          },
          table_data: metRes.data.table_data || [],
        });
      }
    };

    loadInitialData();
  }, []);

  // 2. Load Real-time counts for Active Camera
  useEffect(() => {
    if (!activeCCTV) {
      setStreamState("empty");
      return;
    }

    setStreamState("loading");

    const fetchLive = async () => {
      const res = await fetchApi<any>(`/api/v1/kepadatan/live/${activeCCTV.id}`);
      if (res.success && res.data && res.data.live_counts) {
        setLiveVehicleCounts({
          motorcycle: res.data.live_counts.motorcycle || 0,
          car: res.data.live_counts.car || 0,
          bus: res.data.live_counts.bus || 0,
          truck: res.data.live_counts.truck || 0,
        });
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 4000);
    return () => clearInterval(interval);
  }, [activeCCTV]);

  // 3. Socket.IO Listener for background YOLO worker
  useEffect(() => {
    const socket = getSocket();

    const handleUpdateCounts = (data: any) => {
      if (data && data.location === activeCCTV?.lokasi) {
        if (data.counts) {
          setLiveVehicleCounts({
            motorcycle: data.counts.motorcycle || 0,
            car: data.counts.car || 0,
            bus: data.counts.bus || 0,
            truck: data.counts.truck || 0,
          });
        }
      }
    };

    socket.on("update_counts", handleUpdateCounts);
    return () => {
      socket.off("update_counts", handleUpdateCounts);
    };
  }, [activeCCTV]);

  // Handle Select CCTV
  const handleSelectCCTV = (cctv: CCTV) => {
    setActiveCCTV(cctv);
    setIsSearchOpen(false);
    setSearchQuery("");
    setStreamState("loading");
    setStreamKey((k) => k + 1);
  };

  // Filtered cameras for search dropdown
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return cameras.filter((c) =>
      c.lokasi.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [cameras, searchQuery]);

  // Chart Data: Real-time Bar Chart
  const barChartData = {
    labels: ["Motor", "Mobil", "Bus", "Truk"],
    datasets: [
      {
        label: "Lajur Dekat",
        data: [
          metrics.directional.dekat.motorcycle || liveVehicleCounts.motorcycle,
          metrics.directional.dekat.car || liveVehicleCounts.car,
          metrics.directional.dekat.bus || liveVehicleCounts.bus,
          metrics.directional.dekat.truck || liveVehicleCounts.truck,
        ],
        backgroundColor: "rgba(99, 102, 241, 0.85)",
        borderColor: "rgb(99, 102, 241)",
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: "Lajur Jauh",
        data: [
          metrics.directional.jauh.motorcycle,
          metrics.directional.jauh.car,
          metrics.directional.jauh.bus,
          metrics.directional.jauh.truck,
        ],
        backgroundColor: "rgba(16, 185, 129, 0.85)",
        borderColor: "rgb(16, 185, 129)",
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  // Chart Data: 24-Hour Trend Line Chart
  const lineChartData = {
    labels: metrics.hourly_volume.map((h) => h.hour),
    datasets: [
      {
        label: "Volume Kendaraan (24 Jam)",
        data: metrics.hourly_volume.map((h) => h.volume),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#a855f7",
        pointBorderColor: "#fff",
        pointHoverRadius: 6,
      },
    ],
  };

  return (
    <div className="max-w-[1540px] mx-auto px-4 sm:px-6 py-4 space-y-6">
      {/* 1. SEKSI TITIK LOKASI CCTV & PETA LEAFLET (Persis kepadatan.html) */}
      <div className="bg-[#141B35] p-5 rounded-2xl shadow-xl border border-slate-800/80">
        {/* Header Seksi Peta */}
        <div className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <span>Titik Lokasi CCTV:</span>
          <span className="text-yellow-400 font-bold truncate">
            {activeCCTV ? activeCCTV.lokasi : "Pilih Titik CCTV"}
          </span>
        </div>

        {/* Input Pencarian CCTV dengan Dropdown */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Cari lokasi CCTV di peta Kota Bogor..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 text-white placeholder-slate-400 rounded-xl border border-slate-700/80 focus:border-yellow-400 focus:outline-none text-xs sm:text-sm shadow-inner"
            />
          </div>

          {/* Autocomplete Results Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#141B35] border border-slate-700 rounded-xl max-h-56 overflow-y-auto z-30 shadow-2xl divide-y divide-slate-800">
              {searchResults.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCCTV(c)}
                  className="p-3 cursor-pointer hover:bg-[#2d3561] text-xs text-slate-200 flex items-center justify-between transition-colors"
                >
                  <span className="font-semibold">{c.lokasi}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      c.status?.toLowerCase() === "aktif"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Peta Leaflet Batas Wilayah & Titik CCTV */}
        <div className="h-[460px] w-full rounded-xl overflow-hidden border border-slate-800 bg-[#0e1222] relative">
          <LeafletMap
            selectedCCTVId={activeCCTV?.id || null}
            onSelectCCTV={(cctv) => handleSelectCCTV(cctv as CCTV)}
          />
        </div>
      </div>

      {/* 2. SEKSI PERKEMBANGAN KEPADATAN (Split 2 Kolom Kiri: Player Video, 1 Kolom Kanan: Chart) */}
      <div className="bg-[#141B35] p-5 rounded-2xl shadow-xl border border-slate-800/80 space-y-4">
        <div className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>Perkembangan Kepadatan:</span>
          <span className="text-yellow-400 font-bold truncate">
            {activeCCTV ? activeCCTV.lokasi : "Pilih CCTV"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[420px]">
          {/* Kolom Kiri (2 Kolom): Live Stream Player dengan 4 UI States */}
          <div className="lg:col-span-2 bg-black rounded-xl overflow-hidden shadow-2xl relative flex flex-col justify-center border border-slate-800 aspect-video lg:aspect-auto">
            {activeCCTV ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* 4 UI State Overlay */}
                {streamState === "loading" && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-10 text-center p-4">
                    <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-3" />
                    <p className="text-xs font-semibold text-slate-200">
                      Menghubungkan ke siaran langsung CCTV AI...
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Menginisialisasi stream multipart & deteksi objek
                    </p>
                  </div>
                )}

                {streamState === "error" && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10 text-center p-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                      <VideoOff className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">
                      Siaran Tidak Tersedia
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mb-3">
                      {streamErrorMsg || "Koneksi ke kamera terputus atau URL stream RTSP tidak merespon."}
                    </p>
                    <button
                      onClick={() => {
                        setStreamState("loading");
                        setStreamKey((k) => k + 1);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-md"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                    </button>
                  </div>
                )}

                {/* Gambar Stream Multipart MJPEG */}
                <img
                  key={streamKey}
                  src={`/api/v1/monitoring/stream/${activeCCTV.id}?mode=simple&k=${streamKey}`}
                  alt={`Stream ${activeCCTV.lokasi}`}
                  onLoad={() => setStreamState("success")}
                  onError={() => {
                    setStreamState("error");
                    setStreamErrorMsg("Gagal memuat feed kamera langsung.");
                  }}
                  className="w-full h-full object-contain max-h-[460px]"
                />

                {/* Status Badge */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-rose-600/90 text-white font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-md">
                    <Radio className="w-3 h-3 animate-pulse" /> LIVE
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur text-slate-300 font-mono text-[10px] border border-slate-700">
                    {activeCCTV.camera_type || "Vision AI"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <Video className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Pilih CCTV</p>
                <p className="text-[11px] text-slate-500">
                  Klik titik kamera pada peta di atas untuk melihat siaran langsung deteksi.
                </p>
              </div>
            )}
          </div>

          {/* Kolom Kanan (1 Kolom): Real-time Volume Detection Chart (Chart.js Bar) */}
          <div className="bg-[#2d3561] p-4 rounded-xl shadow-inner border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                  Deteksi Real-time
                </h4>
                <span className="text-[10px] text-slate-300 font-mono bg-slate-900/50 px-2 py-0.5 rounded">
                  Lajur Dekat & Jauh
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 mb-4">
                Statistik klasifikasi kendaraan yang melintas pada titik CCTV terpilih saat ini.
              </p>
            </div>

            <div className="h-64 w-full relative">
              <Bar
                data={barChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      grid: { color: "rgba(255,255,255,0.06)" },
                      ticks: { color: "#cbd5e1", font: { size: 10 } },
                    },
                    y: {
                      beginAtZero: true,
                      grid: { color: "rgba(255,255,255,0.06)" },
                      ticks: { color: "#cbd5e1", font: { size: 10 } },
                    },
                  },
                  plugins: {
                    legend: {
                      position: "top",
                      labels: { color: "#fff", font: { size: 10 } },
                    },
                  },
                }}
              />
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">Total Aktif:</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {liveVehicleCounts.motorcycle +
                  liveVehicleCounts.car +
                  liveVehicleCounts.bus +
                  liveVehicleCounts.truck}{" "}
                Unit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEKSI 4 KARTU METRIK DONUT (Persis kepadatan.html) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card Motor */}
        <div className="bg-[#2d3561] p-5 rounded-2xl border border-white/10 text-center shadow-lg hover:border-indigo-400 transition-all">
          <div className="w-24 h-24 mx-auto mb-3 rounded-full border-8 border-indigo-500 flex flex-col items-center justify-center bg-[#141B35]">
            <span className="text-lg font-bold text-white font-mono">
              {metrics.percentages.motorcycle}%
            </span>
          </div>
          <h5 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
            <Bike className="w-4 h-4 text-indigo-400" /> Sepeda Motor
          </h5>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {metrics.totals.motorcycle.toLocaleString()} Kendaraan
          </p>
        </div>

        {/* Card Mobil */}
        <div className="bg-[#2d3561] p-5 rounded-2xl border border-white/10 text-center shadow-lg hover:border-emerald-400 transition-all">
          <div className="w-24 h-24 mx-auto mb-3 rounded-full border-8 border-emerald-500 flex flex-col items-center justify-center bg-[#141B35]">
            <span className="text-lg font-bold text-white font-mono">
              {metrics.percentages.car}%
            </span>
          </div>
          <h5 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
            <Car className="w-4 h-4 text-emerald-400" /> Mobil Penumpang
          </h5>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {metrics.totals.car.toLocaleString()} Kendaraan
          </p>
        </div>

        {/* Card Bus */}
        <div className="bg-[#2d3561] p-5 rounded-2xl border border-white/10 text-center shadow-lg hover:border-amber-400 transition-all">
          <div className="w-24 h-24 mx-auto mb-3 rounded-full border-8 border-amber-500 flex flex-col items-center justify-center bg-[#141B35]">
            <span className="text-lg font-bold text-white font-mono">
              {metrics.percentages.bus}%
            </span>
          </div>
          <h5 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
            <Bus className="w-4 h-4 text-amber-400" /> Bus Angkutan
          </h5>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {metrics.totals.bus.toLocaleString()} Kendaraan
          </p>
        </div>

        {/* Card Truk */}
        <div className="bg-[#2d3561] p-5 rounded-2xl border border-white/10 text-center shadow-lg hover:border-rose-400 transition-all">
          <div className="w-24 h-24 mx-auto mb-3 rounded-full border-8 border-rose-500 flex flex-col items-center justify-center bg-[#141B35]">
            <span className="text-lg font-bold text-white font-mono">
              {metrics.percentages.truck}%
            </span>
          </div>
          <h5 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
            <Truck className="w-4 h-4 text-rose-400" /> Truk & Angkutan Barang
          </h5>
          <p className="text-xs text-slate-300 mt-1 font-mono">
            {metrics.totals.truck.toLocaleString()} Kendaraan
          </p>
        </div>
      </div>

      {/* 4. SEKSI GRAFIK PERKEMBANGAN VOLUME 24 JAM (Chart.js Line) */}
      <div className="bg-[#141B35] p-5 rounded-2xl shadow-xl border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Tren Perkembangan Lalu Lintas Harian (24 Jam)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fluktuasi volume akumulasi kendaraan di titik-titik pengawasan utama Kota Bogor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Grand Total:</span>
            <span className="text-sm font-extrabold text-emerald-400 font-mono">
              {metrics.totals.grand_total.toLocaleString()} Unit
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <Line
            data={lineChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  grid: { color: "rgba(255,255,255,0.06)" },
                  ticks: { color: "#94a3b8", font: { size: 10 } },
                },
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(255,255,255,0.06)" },
                  ticks: { color: "#94a3b8", font: { size: 10 } },
                },
              },
              plugins: {
                legend: { labels: { color: "#fff", font: { size: 11 } } },
              },
            }}
          />
        </div>
      </div>

      {/* 5. SEKSI TABEL REKAPITULASI COUNTING KENDARAAN (Persis kepadatan.html) */}
      <div className="bg-[#141B35] p-5 rounded-2xl shadow-xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Table className="w-5 h-5 text-yellow-400" />
              Tabel Rekapitulasi Data Counting Kendaraan
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Rincian penghitungan kendaraan menurut lajur Dekat dan Jauh per titik kamera CCTV
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {metrics.table_data.length} Titik CCTV Terdata
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs text-slate-200">
            <thead className="bg-[#2d3561] text-[11px] font-bold text-yellow-400 uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="p-3 text-left">Lokasi Titik CCTV</th>
                <th className="p-3 text-center" colSpan={2}>
                  Sepeda Motor
                </th>
                <th className="p-3 text-center" colSpan={2}>
                  Mobil
                </th>
                <th className="p-3 text-center" colSpan={2}>
                  Bus
                </th>
                <th className="p-3 text-center" colSpan={2}>
                  Truk
                </th>
                <th className="p-3 text-right">Total</th>
              </tr>
              <tr className="bg-[#1a1f3a] text-[10px] text-slate-300 border-b border-white/10">
                <th className="p-2"></th>
                <th className="p-2 text-center text-indigo-300">Dekat</th>
                <th className="p-2 text-center text-indigo-300">Jauh</th>
                <th className="p-2 text-center text-emerald-300">Dekat</th>
                <th className="p-2 text-center text-emerald-300">Jauh</th>
                <th className="p-2 text-center text-amber-300">Dekat</th>
                <th className="p-2 text-center text-amber-300">Jauh</th>
                <th className="p-2 text-center text-rose-300">Dekat</th>
                <th className="p-2 text-center text-rose-300">Jauh</th>
                <th className="p-2 text-right text-yellow-300">Akumulasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#141B35]">
              {metrics.table_data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    Memuat data rekapitulasi counting...
                  </td>
                </tr>
              ) : (
                metrics.table_data.map((row) => (
                  <tr
                    key={row.cctv_id}
                    className="hover:bg-[#2d3561]/60 transition-colors font-mono text-[11px]"
                  >
                    <td className="p-3 font-sans font-semibold text-white">
                      {row.lokasi}
                    </td>
                    <td className="p-3 text-center text-indigo-200">
                      {row.motor_dekat.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-indigo-200">
                      {row.motor_jauh.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-emerald-200">
                      {row.car_dekat.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-emerald-200">
                      {row.car_jauh.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-amber-200">
                      {row.bus_dekat.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-amber-200">
                      {row.bus_jauh.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-rose-200">
                      {row.truck_dekat.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-rose-200">
                      {row.truck_jauh.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-yellow-400 text-xs">
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {metrics.table_data.length > 0 && (
              <tfoot className="bg-[#2d3561] text-xs font-bold text-white border-t-2 border-yellow-400">
                <tr>
                  <td className="p-3 font-bold text-yellow-400">GRAND TOTAL:</td>
                  <td className="p-3 text-center font-mono text-indigo-300" colSpan={2}>
                    {metrics.totals.motorcycle.toLocaleString()} Motor
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300" colSpan={2}>
                    {metrics.totals.car.toLocaleString()} Mobil
                  </td>
                  <td className="p-3 text-center font-mono text-amber-300" colSpan={2}>
                    {metrics.totals.bus.toLocaleString()} Bus
                  </td>
                  <td className="p-3 text-center font-mono text-rose-300" colSpan={2}>
                    {metrics.totals.truck.toLocaleString()} Truk
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-emerald-400">
                    {metrics.totals.grand_total.toLocaleString()} Unit
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
