"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PieChart,
  Video,
  Shield,
  Menu,
  X,
  Clock,
  Radio,
  ExternalLink,
} from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [clockTime, setClockTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString("id-ID", { hour12: false }) + " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* TOP MODERN NAVBAR (Persis gaya DaashTics Bogor) */}
      <header className="fixed top-0 left-0 w-full z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-md">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center px-4 sm:px-6 py-3">
          {/* Brand Header */}
          <Link href="/" className="flex items-center space-x-3.5 group">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 group-hover:scale-105 transition-transform">
              <img
                src="/static/img/logo_bogor.svg"
                alt="Logo Kota Bogor"
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
                }}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Live Intelligent Transport
                </span>
                {clockTime && (
                  <span className="text-[10px] text-slate-400 font-mono hidden md:inline-block pl-2 border-l border-slate-700">
                    {clockTime}
                  </span>
                )}
              </div>
              <span className="text-white font-bold text-base sm:text-lg leading-tight tracking-tight block group-hover:text-indigo-300 transition-colors">
                SMART MONITORING KOTA BOGOR
              </span>
              <span className="text-slate-400 text-xs hidden sm:block">
                Dashboard Analisis Lalu Lintas & Kepadatan Jalan
              </span>
            </div>
          </Link>

          {/* Quick Nav Desktop & Menu Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white rounded-xl shadow-xs transition-all"
              title="Menu Navigasi"
            >
              {isDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop Overlay for Mobile Drawer */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        />
      )}

      {/* Right Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 w-72 bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl z-50 flex flex-col p-5 transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <img
                src="/static/img/logo_bogor.svg"
                alt="Logo Kota Bogor"
                className="h-6 w-6 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
                }}
              />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Navigasi Utama
              </h3>
              <p className="text-[10px] text-slate-400">DaashTics Smart City</p>
            </div>
          </div>

          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Navigation Links */}
        <div className="py-5 flex-1 overflow-y-auto space-y-2">
          <Link
            href="/kepadatan"
            onClick={() => setIsDrawerOpen(false)}
            className={`flex items-center px-3.5 py-3 rounded-xl transition-all duration-200 group text-sm font-medium ${
              pathname === "/kepadatan"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
            }`}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <PieChart className="w-4 h-4" />
            </div>
            <span>Dashboard Kepadatan</span>
          </Link>

          <Link
            href="/peta"
            onClick={() => setIsDrawerOpen(false)}
            className={`flex items-center px-3.5 py-3 rounded-xl transition-all duration-200 group text-sm font-medium ${
              pathname === "/peta"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
            }`}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
              <Video className="w-4 h-4" />
            </div>
            <span>Peta & Titik CCTV</span>
          </Link>
        </div>

        {/* Drawer Bottom: Portal Admin */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <Link
            href="/login"
            onClick={() => setIsDrawerOpen(false)}
            className="flex items-center justify-center px-4 py-3 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-800 hover:text-white border border-slate-700/80 transition-all duration-200 gap-2"
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Portal Masuk Operator / Admin</span>
          </Link>
          <p className="text-[10px] text-center text-slate-500">
            DaashTics &bull; Versi 2.0 Modern Architecture
          </p>
        </div>
      </aside>

      {/* Main Content Area with top offset for fixed navbar */}
      <main className="flex-1 pt-20">{children}</main>

      {/* FOOTER - Full Width (Sama seperti template Flask asli) */}
      <footer className="w-full bg-gradient-to-br from-[#1a1f3a] to-[#2d3561] text-white py-8 px-6 text-center border-t-2 border-indigo-600 mt-12">
        <div className="max-w-4xl mx-auto space-y-2">
          <h4 className="text-sm font-bold tracking-tight">
            DINAS PERHUBUNGAN KOTA BOGOR - SMART CITY INITIATIVE
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sistem Pemantauan Terpadu Arus Lalu Lintas, Deteksi Kerumunan, Parkir Liar, dan Pelanggaran Dimensi ODOL Kota Bogor
          </p>
          <div className="flex justify-center flex-wrap gap-4 text-xs text-slate-400 pt-2 border-t border-white/10">
            <Link href="/kepadatan" className="hover:text-indigo-300 transition-colors">
              Dashboard Kepadatan
            </Link>
            <span>&bull;</span>
            <Link href="/peta" className="hover:text-indigo-300 transition-colors">
              Peta CCTV
            </Link>
            <span>&bull;</span>
            <Link href="/login" className="hover:text-indigo-300 transition-colors">
              Konsol Command Center
            </Link>
          </div>
          <p className="text-[11px] text-yellow-400 pt-2 font-medium">
            &copy; 2026 Pemerintah Kota Bogor &bull; Hak Cipta Dilindungi
          </p>
        </div>
      </footer>
    </div>
  );
}
