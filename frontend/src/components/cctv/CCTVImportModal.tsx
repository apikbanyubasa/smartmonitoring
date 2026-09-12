"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  X,
  ArrowRight,
  Info,
} from "lucide-react";
import { fetchApi, downloadFile } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PreviewRow {
  row_number: number;
  lokasi: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  stream_url: string | null;
  video_url: string | null;
  type: string;
  camera_type: string;
  action: "new" | "update" | "invalid";
  message: string;
}

interface PreviewSummary {
  total: number;
  new_count: number;
  update_count: number;
  invalid_count: number;
  rows: PreviewRow[];
}

interface CCTVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CCTVImportModal({
  isOpen,
  onClose,
  onSuccess,
}: CCTVImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    added: number;
    updated: number;
    total: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setError("Hanya mendukung file dengan ekstensi .csv, .xlsx, atau .xls.");
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccessResult(null);
    await uploadForPreview(file);
  };

  const uploadForPreview = async (file: File) => {
    setIsLoadingPreview(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetchApi<PreviewSummary>("/api/v1/cctv/import-preview", {
      method: "POST",
      body: formData,
    });

    setIsLoadingPreview(false);

    if (res.success && res.data) {
      setPreviewData(res.data);
    } else {
      setError(res.message || "Gagal memproses pratinjau file.");
      setPreviewData(null);
    }
  };

  const handleCommit = async () => {
    if (!previewData || previewData.rows.length === 0) return;

    setIsCommitting(true);
    setError(null);

    const validRows = previewData.rows.filter((r) => r.action !== "invalid");
    if (validRows.length === 0) {
      setError("Tidak ada baris data valid yang dapat disimpan.");
      setIsCommitting(false);
      return;
    }

    const res = await fetchApi<{ added: number; updated: number; total: number }>(
      "/api/v1/cctv/import-commit",
      {
        method: "POST",
        body: JSON.stringify({ rows: validRows }),
      }
    );

    setIsCommitting(false);

    if (res.success && res.data) {
      setSuccessResult(res.data);
      onSuccess();
    } else {
      setError(res.message || "Gagal menyimpan data ke database.");
    }
  };

  const handleDownloadTemplate = async (format: "csv" | "excel") => {
    const filename = format === "excel" ? "template_cctv.xlsx" : "template_cctv.csv";
    await downloadFile(`/api/v1/cctv/template?format=${format}`, filename);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setError(null);
    setSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Impor Data Kamera CCTV
              </h2>
              <p className="text-xs text-slate-400">
                Unggah berkas CSV atau Excel dengan sistem validasi dan pratinjau data otomatis.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Result View */}
          {successResult ? (
            <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">
                Impor Data Berhasil Disimpan!
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Sebanyak <span className="font-bold text-emerald-400">{successResult.total}</span> data
                CCTV berhasil diproses ke database ({successResult.added} data baru, {successResult.updated} data diperbarui).
                Worker pemantauan kamera telah disinkronkan.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Button onClick={onClose} className="text-xs">
                  Selesai & Tutup
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="text-xs"
                >
                  Impor Berkas Lain
                </Button>
              </div>
            </div>
          ) : !previewData ? (
            /* Upload Dropzone & Templates */
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    {isLoadingPreview ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {isLoadingPreview
                        ? "Membaca dan memvalidasi berkas..."
                        : "Tarik & lepas file CSV / Excel ke sini"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Atau klik di area ini untuk memilih file (.csv, .xlsx, .xls)
                    </p>
                  </div>
                </div>
              </div>

              {/* Template Download & Guidelines */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-300">
                    <p className="font-semibold text-white">Panduan Format Kolom:</p>
                    <p className="text-slate-400 mt-0.5">
                      Kolom wajib: <code className="text-cyan-400">lokasi</code>.
                      Kolom opsional: <code className="text-slate-300">status</code>,{" "}
                      <code className="text-slate-300">latitude</code>,{" "}
                      <code className="text-slate-300">longitude</code>,{" "}
                      <code className="text-slate-300">stream_url</code>,{" "}
                      <code className="text-slate-300">type</code>,{" "}
                      <code className="text-slate-300">camera_type</code>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadTemplate("csv")}
                    className="text-xs py-1.5 px-2.5"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Template CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadTemplate("excel")}
                    className="text-xs py-1.5 px-2.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-green-400" />
                    Template Excel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Live Preview & Row Management */
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">
                    Total: <strong className="text-white">{previewData.total}</strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <Badge variant="success">
                    {previewData.new_count} Data Baru
                  </Badge>
                  <Badge variant="warning">
                    {previewData.update_count} Pembaruan
                  </Badge>
                  {previewData.invalid_count > 0 && (
                    <Badge variant="danger">
                      {previewData.invalid_count} Tidak Valid
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    className="text-xs py-1.5"
                  >
                    Ganti Berkas
                  </Button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-3 w-12">#</th>
                      <th className="p-3">Lokasi Kamera</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Koordinat</th>
                      <th className="p-3">Stream URL</th>
                      <th className="p-3">Tipe</th>
                      <th className="p-3 text-right">Status Impor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {previewData.rows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.action === "invalid"
                            ? "bg-rose-500/5 hover:bg-rose-500/10"
                            : r.action === "update"
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "hover:bg-slate-800/30"
                        }
                      >
                        <td className="p-3 font-mono text-slate-500 text-[11px]">
                          {r.row_number}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {r.lokasi}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">
                          {r.latitude && r.longitude
                            ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`
                            : "-"}
                        </td>
                        <td className="p-3 max-w-[160px] truncate font-mono text-[11px] text-slate-500">
                          {r.stream_url || "-"}
                        </td>
                        <td className="p-3 text-slate-400">
                          {r.type} ({r.camera_type})
                        </td>
                        <td className="p-3 text-right">
                          {r.action === "new" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Baru
                            </span>
                          ) : r.action === "update" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <RefreshCw className="w-3 h-3" /> Update
                            </span>
                          ) : (
                            <span
                              title={r.message}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            >
                              <XCircle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs"
          >
            Batal
          </Button>

          {previewData && !successResult && (
            <Button
              type="button"
              isLoading={isCommitting}
              disabled={previewData.new_count + previewData.update_count === 0}
              onClick={handleCommit}
              className="text-xs shadow-indigo-600/20"
            >
              Simpan {previewData.new_count + previewData.update_count} Data ke Sistem
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
