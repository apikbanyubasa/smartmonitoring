"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { fetchApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Mohon lengkapi username dan password Anda.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await fetchApi("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: username.trim(), password }),
    });

    setIsLoading(false);

    if (res.success) {
      // Login sukses, redirect ke Command Center Admin
      router.push("/admin/monitoring");
    } else {
      setErrorMessage(res.message || "Gagal masuk. Periksa kembali kredensial Anda.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-[#0b0f19] via-[#0f172a] to-[#0b0f19] relative">
      {/* Glow Effect */}
      <div className="absolute w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Beranda
        </Link>

        {/* Login Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner w-14 h-14">
              <img
                src="/static/img/logo_bogor.svg"
                alt="Logo Kota Bogor"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Command Center Login
            </h1>
            <p className="text-xs text-slate-400">
              Masuk untuk mengakses konsol pengawasan lalu lintas Kota Bogor
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username atau Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin / operator"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full py-3 mt-2 text-sm font-semibold shadow-indigo-600/25"
            >
              Masuk ke Konsol
            </Button>
          </form>

          {/* Footer Info */}
          <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
            Akses dibatasi hanya untuk staf operator & administrator terdaftar.
          </div>
        </div>
      </div>
    </div>
  );
}
