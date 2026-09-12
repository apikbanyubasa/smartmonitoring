"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Map,
  Video,
  Search,
  Filter,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { CCTV } from "@/types/cctv";
import { Skeleton } from "@/components/ui/Skeleton";

// Dynamic import LeafletMap with ssr: false
const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] flex items-center justify-center bg-[#141B35] rounded-3xl">
      <Skeleton className="w-full h-full rounded-3xl" />
    </div>
  ),
});

export default function PetaPublicPage() {
  const [cameras, setCameras] = useState<CCTV[]>([]);
  const [selectedCCTV, setSelectedCCTV] = useState<CCTV | null>(null);
  const [selectedKecamatan, setSelectedKecamatan] = useState("semua");
  const [selectedType, setSelectedType] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal Video Live Stream Preview
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const res = await fetchApi<CCTV[]>("/api/v1/cctv");
      setIsLoading(false);

      if (res.success && Array.isArray(res.data)) {
        setCameras(res.data);
      }
    };
    loadData();
  }, []);

  // Filtered cameras based on Search, Kecamatan, and Type
  const filteredCameras = useMemo(() => {
    return cameras.filter((c) => {
      const matchSearch = c.lokasi.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType =
        selectedType === "semua" ||
        (c.type && c.type.toLowerCase().includes(selectedType.toLowerCase()));
      return matchSearch && matchType;
    });
  }, [cameras, searchQuery, selectedType]);

  const activeCount = useMemo(
    () => cameras.filter((c) => c.status?.toLowerCase() === "aktif").length,
    [cameras]
  );

  const handleMarkerClick = (cctv: any) => {
    const found = cameras.find((c) => c.id === cctv.id);
    if (found) {
      setSelectedCCTV(found);
      setIsPreviewModalOpen(true);
    }
  };

  return (
    <div className="max-w-[1540px] mx-auto px-4 sm:px-6 py-4 space-y-6">
      {/* Header Halaman Peta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Map className="w-6 h-6 text-emerald-400" />
            Peta Persebaran Titik CCTV Kota Bogor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualisasi spasial batas administratif wilayah dan pemantauan titik kamera CCTV terpadu.
          </p>
        </div>

        {/* Legend Status CCTV */}
        <div className="flex items-center gap-4 text-xs font-semibold bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">
              Aktif: <b className="text-emerald-400 font-mono">{activeCount}</b>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-300">
              Non-Aktif: <b className="text-rose-400 font-mono">{cameras.length - activeCount}</b>
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
            <span className="text-slate-400">
              Total: <b className="text-white font-mono">{cameras.length}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#141B35] p-3.5 rounded-2xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama jalan atau titik lokasi..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={selectedKecamatan}
            onChange={(e) => setSelectedKecamatan(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="semua">Semua Wilayah Administratif</option>
            <option value="Bogor Tengah">Kecamatan Bogor Tengah</option>
            <option value="Bogor Selatan">Kecamatan Bogor Selatan</option>
            <option value="Bogor Timur">Kecamatan Bogor Timur</option>
            <option value="Bogor Utara">Kecamatan Bogor Utara</option>
            <option value="Bogor Barat">Kecamatan Bogor Barat</option>
            <option value="Tanah Sareal">Kecamatan Tanah Sareal</option>
          </select>
        </div>

        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="semua">Semua Kategori Titik</option>
            <option value="tol">Jalan Tol / Simpang Susun</option>
            <option value="pasar">Kawasan Pasar Tradisional</option>
            <option value="taman">Taman & Ruang Terbuka Publik</option>
            <option value="cctv">Jalan Protokol / Persimpangan</option>
          </select>
        </div>
      </div>

      {/* Peta GIS Leaflet Fullscreen */}
      <div className="h-[620px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-[#0e1222] relative">
        <LeafletMap
          cctvMarkers={filteredCameras}
          onSelectCCTV={handleMarkerClick}
          height="100%"
        />
      </div>

      {/* Modal Live Stream Preview saat Marker Diklik */}
      {isPreviewModalOpen && selectedCCTV && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {selectedCCTV.lokasi}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID #{selectedCCTV.id} &bull; Tipe: {selectedCCTV.type || "CCTV"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Canvas 16:9 */}
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center relative">
              <img
                src={`/api/v1/monitoring/stream/${selectedCCTV.id}?mode=simple`}
                alt={selectedCCTV.lokasi}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 text-white font-bold text-[10px] tracking-wider uppercase shadow">
                <Radio className="w-3 h-3 animate-pulse" /> LIVE STREAM
              </div>
            </div>

            {/* Modal Footer Info */}
            <div className="flex items-center justify-between text-xs text-slate-300 pt-2">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <span className="font-bold text-emerald-400 uppercase">
                  {selectedCCTV.status}
                </span>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
