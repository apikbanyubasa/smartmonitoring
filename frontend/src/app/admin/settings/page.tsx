"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  User,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  Shield,
  KeyRound,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);

    const res = await fetchApi<UserProfile>("/api/v1/auth/me");
    setIsLoading(false);

    if (res.success && res.data) {
      setProfile(res.data);
      setFormData((prev) => ({
        ...prev,
        username: res.data.username,
        email: res.data.email,
      }));
    } else {
      setError(res.message || "Gagal memuat informasi akun.");
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi password jika diisi
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        alert("Masukkan password saat ini untuk memverifikasi penggantian password.");
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        alert("Konfirmasi password baru tidak cocok.");
        return;
      }
      if (formData.newPassword.length < 6) {
        alert("Password baru minimal 6 karakter.");
        return;
      }
    }

    setIsSubmitting(true);
    setNotification(null);

    const payload: any = {
      username: formData.username.trim(),
      email: formData.email.trim(),
    };

    if (formData.newPassword) {
      payload.current_password = formData.currentPassword;
      payload.new_password = formData.newPassword;
    }

    const res = await fetchApi<UserProfile>("/api/v1/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      setProfile(res.data);
      setNotification({
        type: "success",
        message: res.message || "Pengaturan akun Anda berhasil diperbarui.",
      });
      // Bersihkan input password
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setTimeout(() => setNotification(null), 5000);
    } else {
      setNotification({
        type: "error",
        message: res.message || "Gagal memperbarui profil akun.",
      });
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white tracking-tight">
            Pengaturan Akun Operator
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          Perbarui identitas profil dan kata sandi keamanan Anda di Command Center DaashTics.
        </p>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between animate-in fade-in duration-300 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* State: Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl bg-slate-800/60" />
          <Skeleton className="h-60 w-full rounded-2xl bg-slate-800/60" />
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadProfile} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Informasi Akun */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Informasi Akun</h3>
                <p className="text-xs text-slate-400">
                  Data kredensial pengguna yang terdaftar pada sistem
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Peran: {profile?.role || "operator"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Username</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Alamat Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Ubah Password */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="border-b border-slate-800/80 pb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-rose-400" />
                <span>Ubah Password Keamanan</span>
              </h3>
              <p className="text-xs text-slate-400">
                Kosongkan bidang ini jika Anda tidak ingin memperbarui kata sandi.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password Saat Ini
                </label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPassword: e.target.value })
                  }
                  placeholder="Masukkan kata sandi lama Anda"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="Ketik ulang kata sandi baru"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
