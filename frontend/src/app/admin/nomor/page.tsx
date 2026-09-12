"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  Plus,
  Trash2,
  Building2,
  CheckCircle2,
  AlertCircle,
  Search,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface ContactItem {
  id: number;
  instansi: string;
  nomor_telp: string;
  deskripsi?: string;
}

export default function NomorKontakPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [formData, setFormData] = useState({
    instansi: "",
    nomor_telp: "",
  });

  const loadContacts = async () => {
    setIsLoading(true);
    const res = await fetchApi<ContactItem[]>("/api/v1/dispatch/contacts");
    setIsLoading(false);

    if (res.success && Array.isArray(res.data)) {
      setContacts(res.data);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.instansi.trim() || !formData.nomor_telp.trim()) return;

    setIsSubmitting(true);
    const res = await fetchApi("/api/v1/dispatch/contacts", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", msg: "Kontak instansi berhasil ditambahkan." });
      setIsModalOpen(false);
      setFormData({ instansi: "", nomor_telp: "" });
      loadContacts();
      setTimeout(() => setFeedback(null), 4000);
    } else {
      alert("Gagal menambahkan kontak: " + res.message);
    }
  };

  const handleDeleteContact = async (id: number, instansi: string) => {
    if (!confirm(`Hapus kontak darurat "${instansi}"?`)) return;

    const res = await fetchApi(`/api/v1/dispatch/contacts/${id}`, { method: "DELETE" });
    if (res.success) {
      loadContacts();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.instansi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nomor_telp.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Phone className="w-5 h-5 text-amber-400" />
            Manajemen Kontak Instansi Darurat
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Daftar nomor WhatsApp instansi terkait (Dishub, Polresta, Damkar, BPBD) untuk integrasi dispatch.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="text-xs shadow-amber-500/20">
          <Plus className="w-4 h-4 mr-1.5" /> Tambah Kontak Baru
        </Button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama instansi atau nomor telepon..."
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Contacts Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-4 w-1/2">Nama Instansi / Unit</th>
              <th className="p-4 w-1/3">Nomor Telepon (WhatsApp)</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={3} className="p-4">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center">
                  <EmptyState
                    title="Tidak Ada Kontak"
                    description="Belum ada kontak instansi darurat yang tersimpan."
                  />
                </td>
              </tr>
            ) : (
              filteredContacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-white text-xs">{c.instansi}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-300">{c.nomor_telp}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDeleteContact(c.id, c.instansi)}
                      className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      title="Hapus Kontak"
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

      {/* Modal Tambah Kontak */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Tambah Kontak Instansi Baru</h3>

            <form onSubmit={handleSaveContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Instansi
                </label>
                <input
                  type="text"
                  required
                  value={formData.instansi}
                  onChange={(e) => setFormData({ ...formData, instansi: e.target.value })}
                  placeholder="Contoh: Dishub Kota Bogor / Posko 112"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp (dengan kode negara)
                </label>
                <input
                  type="text"
                  required
                  value={formData.nomor_telp}
                  onChange={(e) => setFormData({ ...formData, nomor_telp: e.target.value })}
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="text-xs">
                  Simpan Kontak
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
