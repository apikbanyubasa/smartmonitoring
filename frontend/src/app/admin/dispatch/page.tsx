"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Building2,
  Phone,
  FileText,
  Pin,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { EmergencyContact, DispatchRecord, NoteItem } from "@/types/dispatch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

export default function DispatchPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [activeContact, setActiveContact] = useState<EmergencyContact | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dispatch Form State
  const [selectedInstansi, setSelectedInstansi] = useState<EmergencyContact | null>(null);
  const [tipeKejadian, setTipeKejadian] = useState("Lalu Lintas / Kemacetan");
  const [instruksi, setInstruksi] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Notes State (with LocalStorage persistence)
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [searchContact, setSearchContact] = useState("");
  const [searchNote, setSearchNote] = useState("");
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);

  // 1. Load Contacts & Initial Dispatches
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      const [contactsRes, historyRes] = await Promise.all([
        fetchApi<EmergencyContact[]>("/api/v1/dispatch/contacts"),
        fetchApi<DispatchRecord[]>("/api/v1/dispatch/history"),
      ]);
      setIsLoading(false);

      if (contactsRes.success && Array.isArray(contactsRes.data)) {
        setContacts(contactsRes.data);
        if (contactsRes.data.length > 0) {
          setActiveContact(contactsRes.data[0]);
          setSelectedInstansi(contactsRes.data[0]);
        }
      }

      if (historyRes.success && Array.isArray(historyRes.data)) {
        setDispatches(historyRes.data);
      }
    };

    loadInitialData();

    // Load LocalStorage Notes
    try {
      const stored = localStorage.getItem("daashtics_nextjs_notes");
      if (stored) {
        setNotes(JSON.parse(stored));
      } else {
        const defaultNotes: NoteItem[] = [
          {
            id: "1",
            title: "SOP Pengalihan Arus Otista",
            text: "Saat arus padat akhir pekan, segera hubungi Dishub Kota Bogor untuk pembukaan jalur alternatif.",
            isPinned: true,
          },
          {
            id: "2",
            title: "Kontak Piket Damkar",
            text: "Nomor darurat respon cepat 112 atau posko Sukasari.",
            isPinned: false,
          },
        ];
        setNotes(defaultNotes);
        localStorage.setItem("daashtics_nextjs_notes", JSON.stringify(defaultNotes));
      }
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, []);

  const saveNotesToStorage = (updatedNotes: NoteItem[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem("daashtics_nextjs_notes", JSON.stringify(updatedNotes));
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Send Dispatch
  const handleSendDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstansi || !instruksi.trim()) return;

    setIsSending(true);
    setFeedback(null);

    const res = await fetchApi("/api/v1/dispatch/send", {
      method: "POST",
      body: JSON.stringify({
        kontak_id: selectedInstansi.id,
        tipe_kejadian: tipeKejadian,
        instruksi: instruksi.trim(),
      }),
    });

    setIsSending(false);

    if (res.success && res.data) {
      setFeedback({ type: "success", msg: res.message || "Dispatch berhasil dikirim via WhatsApp." });
      setDispatches((prev) => [res.data, ...prev]);
      setInstruksi("");
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({ type: "error", msg: res.message || "Gagal mengirim dispatch WhatsApp." });
    }
  };

  // 3. Notes Handlers
  const handleSaveNote = () => {
    if (!noteTitle.trim()) return;

    if (activeNote) {
      const updated = notes.map((n) =>
        n.id === activeNote.id ? { ...n, title: noteTitle, text: noteText } : n
      );
      saveNotesToStorage(updated);
      setActiveNote({ ...activeNote, title: noteTitle, text: noteText });
    } else {
      const newNote: NoteItem = {
        id: Date.now().toString(),
        title: noteTitle,
        text: noteText,
        isPinned: false,
      };
      saveNotesToStorage([newNote, ...notes]);
      setActiveNote(newNote);
    }
    setIsEditingNote(false);
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotesToStorage(updated);
    if (activeNote?.id === id) {
      setActiveNote(null);
      setIsEditingNote(false);
    }
  };

  const handleTogglePin = (id: string) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n));
    saveNotesToStorage(updated);
    if (activeNote?.id === id) {
      setActiveNote({ ...activeNote, isPinned: !activeNote.isPinned });
    }
  };

  // Filter dispatches for active contact
  const activeDispatches = dispatches
    .filter((d) => activeContact && d.kontak_id === activeContact.id)
    .sort((a, b) => new Date(a.waktu_kirim).getTime() - new Date(b.waktu_kirim).getTime());

  const filteredContacts = contacts.filter(
    (k) =>
      k.instansi.toLowerCase().includes(searchContact.toLowerCase()) ||
      k.nomor_telp.includes(searchContact)
  );

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchNote.toLowerCase()) ||
      n.text.toLowerCase().includes(searchNote.toLowerCase())
  );

  // Symmetrical 3-Column Height Measurement
  const centerColRef = React.useRef<HTMLDivElement>(null);
  const [centerHeight, setCenterHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!centerColRef.current) return;
    const updateHeight = () => {
      if (centerColRef.current) {
        setCenterHeight(centerColRef.current.offsetHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(() => updateHeight());
    ro.observe(centerColRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          Emergency Dispatch & WhatsApp Console
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Pusat koordinasi darurat antar instansi dan pengiriman instruksi lapangan via WhatsApp Gateway.
        </p>
      </div>

      {/* 3 Column Grid - Symmetrical & Balanced */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI: Daftar Kontak Instansi (Col 3) */}
        <div
          style={centerHeight ? { height: `${centerHeight}px` } : undefined}
          className="col-span-12 lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[480px] max-h-[620px] lg:max-h-none"
        >
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              Kontak Instansi
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
              {contacts.length} Kontak
            </span>
          </div>

          {/* Search Contacts */}
          <div className="p-3 border-b border-slate-800/80 flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                placeholder="Cari nama instansi / nomor..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Kontak tidak ditemukan
              </div>
            ) : (
              filteredContacts.map((k) => {
                const isActive = activeContact?.id === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => {
                      setActiveContact(k);
                      setSelectedInstansi(k);
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-800 text-indigo-400"
                      }`}
                    >
                      {k.instansi.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate leading-tight">{k.instansi}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isActive ? "text-indigo-200" : "text-slate-400"
                        } flex items-center gap-1 font-mono`}
                      >
                        <Phone className="w-2.5 h-2.5" /> {k.nomor_telp}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* KOLOM TENGAH: Chat Bubbles & Form Dispatch (Col 5) */}
        <div ref={centerColRef} className="col-span-12 lg:col-span-5 space-y-4">
          {/* Chat Bubble Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-[340px]">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="text-xs font-bold text-white">
                  {activeContact ? activeContact.instansi : "Pilih Kontak"}
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {activeContact?.nomor_telp}
              </span>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-950/40">
              {activeDispatches.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Belum ada riwayat dispatch dengan instansi ini.</p>
                </div>
              ) : (
                activeDispatches.map((d) => (
                  <div key={d.id} className="flex flex-col items-end">
                    <div className="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-tr-xs shadow-md max-w-sm space-y-1">
                      <div className="flex items-center justify-between gap-3 text-[10px] text-indigo-200 pb-1 border-b border-indigo-400/20">
                        <span>{d.operator}</span>
                        <span className="bg-indigo-700/60 px-1.5 py-0.5 rounded font-mono">
                          {d.tipe_kejadian}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{d.instruksi}</p>
                      <span className="text-[9px] text-indigo-200 block text-right font-mono">
                        {new Date(d.waktu_kirim).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Form Kirim Dispatch */}
          <form
            onSubmit={handleSendDispatch}
            className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-400" /> Form Dispatch Cepat
              </h4>
              {selectedInstansi && (
                <Badge variant="info">Tujuan: {selectedInstansi.instansi}</Badge>
              )}
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{feedback.msg}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tipe Kejadian
              </label>
              <select
                value={tipeKejadian}
                onChange={(e) => setTipeKejadian(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Lalu Lintas / Kemacetan">Lalu Lintas / Kemacetan</option>
                <option value="Kecelakaan Lalu Lintas">Kecelakaan Lalu Lintas</option>
                <option value="Penertiban Parkir Liar">Penertiban Parkir Liar</option>
                <option value="Penanganan ODOL">Penanganan Muatan ODOL</option>
                <option value="Kerumunan Massa">Kerumunan Massa</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Instruksi Lapangan
              </label>
              <textarea
                required
                rows={3}
                value={instruksi}
                onChange={(e) => setInstruksi(e.target.value)}
                placeholder="Tuliskan instruksi koordinasi yang akan dikirim ke nomor WhatsApp instansi..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <Button
              type="submit"
              isLoading={isSending}
              disabled={!selectedInstansi}
              className="w-full text-xs font-semibold py-2.5 shadow-indigo-600/25"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> Kirim Instruksi WhatsApp
            </Button>
          </form>
        </div>

        {/* KOLOM KANAN: Catatan Lapangan / Scratchpad (Col 4) */}
        <div
          style={centerHeight ? { height: `${centerHeight}px` } : undefined}
          className="col-span-12 lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[480px] max-h-[620px] lg:max-h-none"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              Catatan Operator
            </h3>
            <button
              onClick={() => {
                setActiveNote(null);
                setNoteTitle("");
                setNoteText("");
                setIsEditingNote(true);
              }}
              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Tambah
            </button>
          </div>

          {/* Search Notes */}
          <div className="p-3 border-b border-slate-800/80 flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchNote}
                onChange={(e) => setSearchNote(e.target.value)}
                placeholder="Cari catatan tersimpan..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notes Content or Editor */}
          <div className="flex-1 min-h-0 p-3 overflow-y-auto custom-scrollbar space-y-2">
            {isEditingNote ? (
              <div className="space-y-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Judul Catatan..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none"
                />
                <textarea
                  rows={5}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Isi catatan..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNote(false)}
                    className="text-xs"
                  >
                    Batal
                  </Button>
                  <Button size="sm" onClick={handleSaveNote} className="text-xs">
                    Simpan
                  </Button>
                </div>
              </div>
            ) : (
              filteredNotes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    setActiveNote(n);
                    setNoteTitle(n.title);
                    setNoteText(n.text);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all space-y-1.5 ${
                    activeNote?.id === n.id
                      ? "bg-purple-950/30 border-purple-500/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                      {n.isPinned && <Pin className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                      <span className="truncate">{n.title}</span>
                    </h5>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(n.id);
                        }}
                        className="text-slate-500 hover:text-purple-400 p-1"
                        title="Pin ke atas"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(n.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Hapus"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{n.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
