"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Trash2,
  Map,
  CheckCircle2,
  AlertCircle,
  Search,
  Building,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

interface BoundaryItem {
  id: number;
  nama: string;
  jenis: string;
  keterangan: string;
}

export default function BatasWilayahPage() {
  const [boundaries, setBoundaries] = useState<BoundaryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"Kota" | "Kabupaten">("Kota");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadBoundaries = async () => {
    setIsLoading(true);
    const res = await fetchApi<BoundaryItem[]>("/api/v1/gis/boundaries");
    setIsLoading(false);

    if (res.success && Array.isArray(res.data)) {
      setBoundaries(res.data);
    }
  };

  useEffect(() => {
    loadBoundaries();
  }, []);

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Hapus batas wilayah "${nama}"?`)) return;

    const res = await fetchApi(`/api/v1/gis/boundaries/${id}`, { method: "DELETE" });
    if (res.success) {
      loadBoundaries();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  };

  const filteredBoundaries = boundaries
    .filter((b) => b.jenis.toLowerCase() === activeTab.toLowerCase())
    .filter((b) => b.nama.toLowerCase().includes(searchQuery.toLowerCase()));

  const kotaCount = boundaries.filter((b) => b.jenis.toLowerCase() === "kota").length;
  const kabCount = boundaries.filter((b) => b.jenis.toLowerCase() === "kabupaten").length;

  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("csv_file", file);

    const res = await fetchApi(
      `/api/v1/gis/boundaries/import/${activeTab.toLowerCase()}`,
      {
        method: "POST",
        body: formData,
      }
    );
    setIsUploading(false);

    if (e.target) e.target.value = "";

    if (res.success) {
      alert(res.message || `Berhasil mengimpor data batas ${activeTab} Bogor.`);
      loadBoundaries();
    } else {
      alert("Gagal mengimpor: " + res.message);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus SEMUA data batas wilayah ${activeTab} Bogor?`
      )
    ) {
      return;
    }

    setIsDeletingAll(true);
    const res = await fetchApi(
      `/api/v1/gis/boundaries/delete-all/${activeTab.toLowerCase()}`,
      {
        method: "POST",
      }
    );
    setIsDeletingAll(false);

    if (res.success) {
      alert(res.message || `Semua data batas ${activeTab} telah dihapus.`);
      loadBoundaries();
    } else {
      alert("Gagal menghapus semua: " + res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            Manajemen Batas Wilayah Administratif
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data poligon batas geografis Kota dan Kabupaten Bogor untuk visualisasi peta spasial GIS.
          </p>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload CSV */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 transition-all flex items-center gap-1.5"
          >
            {isUploading ? "Mengunggah..." : `Upload CSV (${activeTab})`}
          </button>

          {/* Hapus Semua */}
          <button
            type="button"
            disabled={isDeletingAll || (activeTab === "Kota" ? kotaCount === 0 : kabCount === 0)}
            onClick={handleDeleteAll}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeletingAll ? "Menghapus..." : `Hapus Semua (${activeTab})`}
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 ml-1">
            <button
              onClick={() => setActiveTab("Kota")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "Kota"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Kota Bogor ({kotaCount})
            </button>
            <button
              onClick={() => setActiveTab("Kabupaten")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "Kabupaten"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Kabupaten Bogor ({kabCount})
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Cari nama wilayah di ${activeTab} Bogor...`}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-4 w-16">ID</th>
              <th className="p-4">Nama Wilayah / Kelurahan / Kecamatan</th>
              <th className="p-4">Jenis Administratif</th>
              <th className="p-4">Keterangan</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="p-4">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : filteredBoundaries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <EmptyState
                    title="Tidak Ada Data"
                    description={`Belum ada data batas wilayah ${activeTab} Bogor.`}
                  />
                </td>
              </tr>
            ) : (
              filteredBoundaries.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-mono text-slate-500 text-xs">#{item.id}</td>
                  <td className="p-4 font-bold text-white text-xs">
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{item.nama}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="info">{item.jenis}</Badge>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {item.keterangan || "-"}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(item.id, item.nama)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Hapus Batas Wilayah"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
