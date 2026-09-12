"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Crown,
  UserCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "operator",
  });

  // Load current user and all users
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Ambil session user aktif
      const meRes = await fetchApi<UserItem>("/api/v1/auth/me");
      if (meRes.success && meRes.data) {
        setCurrentUser(meRes.data);
      }

      // 2. Ambil daftar users
      const usersRes = await fetchApi<UserItem[]>("/api/v1/auth/users");
      if (usersRes.success && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data);
      } else {
        setError(usersRes.message || "Gagal memuat daftar pengguna sistem.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) {
      alert("Mohon lengkapi seluruh kolom input.");
      return;
    }

    setIsSubmitting(true);
    const res = await fetchApi<UserItem>("/api/v1/auth/users", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setIsSubmitting(false);

    if (res.success) {
      setNotification({
        type: "success",
        message: res.message || "Pengguna baru berhasil ditambahkan.",
      });
      setIsModalOpen(false);
      setFormData({ username: "", email: "", password: "", role: "operator" });
      loadData();
      setTimeout(() => setNotification(null), 4000);
    } else {
      alert(res.message || "Gagal menambahkan pengguna.");
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (currentUser && user.id === currentUser.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    if (
      !confirm(
        `Anda akan menghapus user "${user.username}". Tindakan ini tidak dapat dibatalkan. Lanjutkan?`
      )
    ) {
      return;
    }

    const res = await fetchApi(`/api/v1/auth/users/${user.id}`, {
      method: "DELETE",
    });

    if (res.success) {
      setNotification({
        type: "success",
        message: res.message || `User ${user.username} berhasil dihapus.`,
      });
      loadData();
      setTimeout(() => setNotification(null), 4000);
    } else {
      alert(res.message || "Gagal menghapus user.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-rose-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Manajemen Pengguna & Role (RBAC)
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Kelola hak akses akun operator dan administrator Command Center DaashTics Kota Bogor.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between animate-in fade-in duration-300 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* UI State Handling */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl bg-slate-800" />
          <Skeleton className="h-16 w-full rounded-xl bg-slate-800/60" />
          <Skeleton className="h-16 w-full rounded-xl bg-slate-800/60" />
          <Skeleton className="h-16 w-full rounded-xl bg-slate-800/60" />
        </div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadData} />
      ) : users.length === 0 ? (
        <EmptyState
          title="Belum Ada Pengguna"
          description="Daftar akun pengguna sistem belum tersedia."
          actionText="Buat Akun Baru"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Pengguna</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-center">Hak Akses (Role)</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                              u.role === "admin"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}
                          >
                            {u.role === "admin" ? (
                              <Crown className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{u.username}</span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              ID: #{u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                        {u.email}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.role === "admin"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isCurrent ? (
                          <span className="text-[11px] text-slate-500 italic">
                            Aktif Sekarang
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">
                  Tambah Pengguna Baru
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Contoh: operator_bogor"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="operator@kotabogor.go.id"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Peran (Role Akses)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all"
                >
                  <option value="operator">Operator (Pengawasan & Dispatch)</option>
                  <option value="admin">Administrator (Akses Penuh Master Data)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
