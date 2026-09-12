"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  Plus,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Edit2,
  CheckCircle2,
  XCircle,
  Archive,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
} from "lucide-react";
import { fetchApi, downloadFile } from "@/lib/api";
import { CCTV, CCTVSummary } from "@/types/cctv";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { CCTVImportModal } from "@/components/cctv/CCTVImportModal";

export default function CCTVManagementPage() {
  const [cameras, setCameras] = useState<CCTV[]>([]);
  const [summary, setSummary] = useState<CCTVSummary>({
    total: 0,
    aktif: 0,
    nonaktif: 0,
    deleted: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    lokasi: "",
    status: "Aktif",
    type: "CCTV",
    stream_url: "",
    latitude: "",
    longitude: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Selection & Export States
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Fetch Data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    const [cctvRes, summaryRes] = await Promise.all([
      fetchApi<CCTV[]>(
        `/api/v1/cctv?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`
      ),
      fetchApi<CCTVSummary>("/api/v1/cctv/summary"),
    ]);

    setIsLoading(false);

    if (cctvRes.success && Array.isArray(cctvRes.data)) {
      setCameras(cctvRes.data);
    } else {
      setError(cctvRes.message || "Gagal memuat data CCTV.");
    }

    if (summaryRes.success && summaryRes.data) {
      setSummary(summaryRes.data);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  // Handle Create CCTV
  const handleSaveCCTV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lokasi.trim()) return;

    setIsSubmitting(true);
    const payload = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    const res = await fetchApi("/api/v1/cctv", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      setFormData({
        lokasi: "",
        status: "Aktif",
        type: "CCTV",
        stream_url: "",
        latitude: "",
        longitude: "",
      });
      loadData();
    } else {
      alert("Gagal menambahkan CCTV: " + res.message);
    }
  };

  // Handle Soft-Delete Single
  const handleDelete = async (id: number, lokasi: string) => {
    if (
      !confirm(
        `Arsipkan kamera "${lokasi}"? Riwayat tilang dan counting akan tetap aman di database.`
      )
    ) {
      return;
    }

    const res = await fetchApi(`/api/v1/cctv/${id}`, { method: "DELETE" });
    if (res.success) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      loadData();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  };

  // Handle Bulk Delete Selected
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Apakah Anda yakin ingin mengarsipkan ${selectedIds.length} kamera CCTV terpilih?`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    const res = await fetchApi("/api/v1/cctv/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: selectedIds }),
    });
    setIsBulkDeleting(false);

    if (res.success) {
      setSelectedIds([]);
      loadData();
    } else {
      alert("Gagal menghapus massal: " + res.message);
    }
  };

  // Handle Delete All
  const handleDeleteAll = async () => {
    setIsBulkDeleting(true);
    const res = await fetchApi("/api/v1/cctv/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ delete_all: true }),
    });
    setIsBulkDeleting(false);
    setIsDeleteAllModalOpen(false);

    if (res.success) {
      setSelectedIds([]);
      loadData();
    } else {
      alert("Gagal menghapus seluruh data: " + res.message);
    }
  };

  // Handle Exports
  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    const url = `/api/v1/cctv/export?format=csv&status=${statusFilter}`;
    const res = await downloadFile(url, "cctv_data.csv");
    setIsExportingCSV(false);
    if (!res.success) alert(res.message);
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    const url = `/api/v1/cctv/export?format=excel&status=${statusFilter}`;
    const res = await downloadFile(url, "cctv_data.xlsx");
    setIsExportingExcel(false);
    if (!res.success) alert(res.message);
  };

  // Selection Checkbox Helpers
  const isAllSelected =
    cameras.length > 0 && cameras.every((c) => selectedIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cameras.map((c) => c.id));
    }
  };

  const handleToggleRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            Manajemen Kamera CCTV
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Konfigurasi titik kamera, impor-ekspor data massal, pratinjau spreadsheet, dan sinkronisasi worker.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tambah Manual */}
          <Button
            onClick={() => setIsModalOpen(true)}
            className="shadow-indigo-600/20 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Tambah CCTV Baru
          </Button>

          {/* Impor CSV / Excel */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Impor Data
          </Button>

          {/* Ekspor CSV */}
          <Button
            type="button"
            variant="outline"
            isLoading={isExportingCSV}
            onClick={handleExportCSV}
            className="text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> CSV
          </Button>

          {/* Ekspor Excel */}
          <Button
            type="button"
            variant="outline"
            isLoading={isExportingExcel}
            onClick={handleExportExcel}
            className="text-xs border-green-500/30 hover:bg-green-500/10 text-green-300"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Excel
          </Button>

          {/* Hapus Semua */}
          <Button
            type="button"
            variant="danger"
            disabled={cameras.length === 0}
            onClick={() => setIsDeleteAllModalOpen(true)}
            className="text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hapus Semua
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Total Kamera</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400">Aktif</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.aktif}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Non-Aktif</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{summary.nonaktif}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Diarsipkan</p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{summary.deleted}</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadData} />}

      {/* Floating Bulk Action Bar (Visible When Rows Are Selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-indigo-950/70 border border-indigo-500/30 p-3 rounded-2xl animate-fade-in shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="text-xs font-semibold text-indigo-200">
              <strong className="text-white">{selectedIds.length}</strong> kamera CCTV dipilih
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-xs py-1.5 text-indigo-300 hover:text-white"
            >
              Batal Pilihan
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isBulkDeleting}
              onClick={handleBulkDelete}
              className="text-xs py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus Terpilih ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari lokasi kamera CCTV..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Semua Status</option>
            <option value="aktif">Aktif Saja</option>
            <option value="nonaktif">Non-Aktif Saja</option>
          </select>
        </div>
      </div>

      {/* CCTV Data Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-4">Lokasi Kamera</th>
                <th className="p-4">Tipe</th>
                <th className="p-4">Status</th>
                <th className="p-4">Koordinat</th>
                <th className="p-4">Stream URL</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="p-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : cameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <EmptyState
                      title="Tidak Ada Kamera"
                      description="Tidak ditemukan kamera CCTV yang cocok dengan filter atau database masih kosong."
                    />
                  </td>
                </tr>
              ) : (
                cameras.map((c) => {
                  const isChecked = selectedIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isChecked ? "bg-indigo-950/30" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(c.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 font-bold text-white">{c.lokasi}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium uppercase">
                          {c.type || "CCTV"}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={c.status.toLowerCase() === "aktif" ? "success" : "danger"}
                          dot
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-slate-400">
                        {c.latitude && c.longitude
                          ? `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`
                          : "-"}
                      </td>
                      <td className="p-4 max-w-xs truncate font-mono text-[11px] text-slate-500">
                        {c.stream_url || "-"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(c.id, c.lokasi)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Arsipkan Kamera"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah CCTV Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in">
            <h3 className="text-base font-bold text-white">Tambah Titik CCTV Baru</h3>

            <form onSubmit={handleSaveCCTV} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama / Lokasi Titik
                </label>
                <input
                  type="text"
                  required
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                  placeholder="Contoh: Simpang Tugu Kujang"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status Operasional
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipe Kamera
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="CCTV / Dishub"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stream URL (M3U8 / RTSP / Video)
                </label>
                <input
                  type="text"
                  value={formData.stream_url}
                  onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                  placeholder="https://.../stream.m3u8"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="-6.5971"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="106.8060"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="text-xs">
                  Simpan Kamera
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impor CSV & Excel Interaktif */}
      <CCTVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          setIsImportModalOpen(false);
          loadData();
        }}
      />

      {/* Modal Konfirmasi Hapus Semua Data */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Hapus Seluruh Data CCTV?</h3>
              <p className="text-xs text-slate-400">
                Tindakan ini akan mengarsipkan seluruh titik kamera pengawasan di sistem dan menghentikan worker streaming. Riwayat deteksi terdahulu akan tetap aman di database.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="text-xs"
              >
                Batalkan
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={isBulkDeleting}
                onClick={handleDeleteAll}
                className="text-xs"
              >
                Ya, Arsipkan Semua
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

