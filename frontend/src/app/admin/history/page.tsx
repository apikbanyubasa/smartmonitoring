"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Trash2,
  Clock,
  Building2,
  Shield,
  Search,
  CheckCircle2,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

interface DispatchHistoryItem {
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

export default function DispatchHistoryPage() {
  const [history, setHistory] = useState<DispatchHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    setIsLoading(true);
    const res = await fetchApi<DispatchHistoryItem[]>("/api/v1/dispatch/history?limit=100");
    setIsLoading(false);

    if (res.success && Array.isArray(res.data)) {
      setHistory(res.data);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus catatan log dispatch ini?")) return;

    const res = await fetchApi(`/api/v1/dispatch/history/${id}`, { method: "DELETE" });
    if (res.success) {
      loadHistory();
    } else {
      alert("Gagal menghapus log dispatch: " + res.message);
    }
  };

  const filteredHistory = history.filter(
    (h) =>
      h.instansi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.instruksi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.operator.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Riwayat Log Pengiriman Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Rekam jejak seluruh instruksi darurat lapangan dan koordinasi instansi via WhatsApp Gateway.
          </p>
        </div>

        <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          Total Log: <b className="text-white">{history.length}</b>
        </span>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari instruksi, unit instansi, atau operator..."
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* History Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Waktu Kirim</th>
                <th className="p-4">Unit Terkait</th>
                <th className="p-4">Tipe Kejadian</th>
                <th className="p-4">Instruksi Lapangan</th>
                <th className="p-4">Operator</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      title="Tidak Ada Riwayat"
                      description="Belum ada riwayat pengiriman dispatch yang tersimpan."
                    />
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {item.waktu_kirim
                        ? new Date(item.waktu_kirim).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "-"}
                    </td>
                    <td className="p-4 font-semibold text-white whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs">
                        {item.instansi}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <Badge
                        variant={item.tipe_kejadian.toLowerCase().includes("darurat") ? "danger" : "info"}
                      >
                        {item.tipe_kejadian}
                      </Badge>
                    </td>
                    <td className="p-4 max-w-sm truncate text-slate-300" title={item.instruksi}>
                      {item.instruksi}
                    </td>
                    <td className="p-4 text-slate-400 font-medium whitespace-nowrap">
                      {item.operator}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                        title="Hapus Log"
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
    </div>
  );
}
