"use client";

import Link from "next/link";
import { ShieldCheck, BarChart3, Radio, ArrowRight, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-[#0b0f19] via-[#0f172a] to-[#0b0f19]">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl w-full text-center relative z-10 space-y-8">
        {/* Emblem Logo Kota Bogor */}
        <div className="flex justify-center mb-1">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
            <img
              src="/static/img/logo_bogor.svg"
              alt="Logo Kota Bogor"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
              }}
            />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
          <span>Sistem Pemantauan Cerdas Kota Bogor</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Daash<span className="text-indigo-500">Tics</span> Smart Traffic
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Platform pemantauan terpadu berbasis Vision AI untuk deteksi kerumunan,
            penertiban parkir liar, pelanggaran dimensi ODOL, dan analisis kepadatan lalu lintas.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 max-w-2xl mx-auto text-left">
          {/* Card 1: Portal Publik */}
          <Link
            href="/kepadatan"
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all hover:scale-[1.02] group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                Portal Publik Kepadatan
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Pantau grafik volume kendaraan harian dan persebaran CCTV Kota Bogor secara terbuka.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
              Lihat Analisis <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          {/* Card 2: Command Center Admin */}
          <Link
            href="/login"
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all hover:scale-[1.02] group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">
                Command Center Admin
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Konsol pemantauan live stream, log tilang AI, dan koordinasi dispatch WhatsApp instansi.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
              Masuk Konsol <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <p className="text-xs text-slate-500 pt-8">
          Powered by Flask Vision AI Engine & Next.js Enterprise Architecture
        </p>
      </div>
    </main>
  );
}
