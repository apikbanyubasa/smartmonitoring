"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Video,
  Camera,
  MessageSquare,
  Shield,
  LogOut,
  Clock,
  Radio,
  Menu,
  X,
  Phone,
  MapPin,
  History,
  Users,
  Sliders,
  Bell,
  BellOff,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import {
  NotificationProvider,
  useNotification,
} from "@/context/NotificationContext";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  role: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </NotificationProvider>
  );
}

function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [clockTime, setClockTime] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const {
    notificationsEnabled,
    toggleNotifications,
    isSyncing,
    toastAlert,
    toggleFeedback,
    dismissToast,
  } = useNotification();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  // Digital Clock WIB
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString("id-ID", { hour12: false }) + " WIB"
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Client-Side Session Verification (Zero-Trust Guard)
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      setIsVerifyingSession(true);
      const res = await fetchApi<UserProfile>("/api/v1/auth/me");
      if (!isMounted) return;

      if (res.success && res.data) {
        setCurrentUser(res.data);
        setIsVerifyingSession(false);
      } else {
        // Token tidak valid atau sesi berakhir
        router.push("/login?error=session_expired");
      }
    };

    verifySession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar dari sesi admin?")) {
      await fetchApi("/api/v1/auth/logout", { method: "POST" });
      router.push("/login");
    }
  };

  const navSections = [
    {
      title: "Operasional Utama",
      items: [
        {
          label: "Deteksi Real-time",
          href: "/admin/monitoring",
          icon: <Video className="w-4 h-4 text-indigo-400" />,
        },
        {
          label: "Chat & Dispatch",
          href: "/admin/dispatch",
          icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
        },
      ],
    },
    {
      title: "Data & Wilayah",
      items: [
        {
          label: "Kelola CCTV",
          href: "/admin/cctv",
          icon: <Camera className="w-4 h-4 text-purple-400" />,
        },
        {
          label: "Kontak Instansi",
          href: "/admin/nomor",
          icon: <Phone className="w-4 h-4 text-amber-400" />,
        },
        {
          label: "Peta & Batas",
          href: "/admin/batas",
          icon: <MapPin className="w-4 h-4 text-cyan-400" />,
        },
        {
          label: "Riwayat Dispatch",
          href: "/admin/history",
          icon: <History className="w-4 h-4 text-blue-400" />,
        },
      ],
    },
    {
      title: "Konfigurasi",
      items: [
        {
          label: "Pengguna & Role",
          href: "/admin/users",
          icon: <Users className="w-4 h-4 text-rose-400" />,
        },
        {
          label: "Pengaturan Akun",
          href: "/admin/settings",
          icon: <Sliders className="w-4 h-4 text-slate-400" />,
        },
      ],
    },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b0f19] text-slate-100 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 h-full bg-slate-900/95 border-r border-slate-800 flex-shrink-0 hidden md:flex flex-col justify-between z-40">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo Brand */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/40 flex-shrink-0">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex-shrink-0">
              <img
                src="/static/img/logo_bogor.svg"
                alt="Logo Kota Bogor"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                  Command Center
                </span>
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight leading-tight">
                SMART MONITORING
              </h2>
              <p className="text-[10px] text-slate-400">Kota Bogor</p>
            </div>
          </div>

          {/* Navigation Links with Group Sections */}
          <nav className="p-3 space-y-3.5 flex-1 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-800/80">
                        {item.icon}
                      </div>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* System Health Pill */}
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">PostgreSQL</span>
                <span className="text-emerald-400 font-semibold flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" /> Aktif
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">YOLOv8 Engine</span>
                <span className="text-indigo-400 font-semibold flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1 animate-pulse" /> Running
                </span>
              </div>
            </div>
          </nav>
        </div>

        {/* Active User Info Card */}
        {currentUser && (
          <div className="px-3 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs flex-shrink-0">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser.username}
              </p>
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider font-semibold border border-indigo-500/30">
                {currentUser.role}
              </span>
            </div>
          </div>
        )}

        {/* Bottom User Controls */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleNotifications}
            disabled={isSyncing}
            className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer relative group ${
              notificationsEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
            }`}
            title={
              notificationsEnabled
                ? "Notifikasi Sistem: Aktif (Klik untuk matikan/bisukan)"
                : "Notifikasi Sistem: Dinonaktifkan (Klik untuk aktifkan kembali)"
            }
          >
            {notificationsEnabled ? (
              <>
                <Bell className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Sesi</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar Header */}
        <header className="h-14 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 md:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300">
                Sistem Operasional Real-time
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {clockTime && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{clockTime}</span>
              </div>
            )}
            <Link
              href="/kepadatan"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors hidden sm:block"
            >
              Lihat Portal Publik &rarr;
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isVerifyingSession ? (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Memverifikasi kredensial sesi...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden flex">
          <div className="w-72 bg-slate-900 border-r border-slate-800 h-full p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/static/img/logo_bogor.svg"
                    alt="Logo Kota Bogor"
                    className="w-7 h-7 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Lambang_Kota_Bogor.png";
                    }}
                  />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Command Center
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-4 overflow-y-auto max-h-[75vh]">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {section.title}
                    </p>
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                          pathname === item.href
                            ? "bg-indigo-600 text-white"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={toggleNotifications}
                disabled={isSyncing}
                className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer relative ${
                  notificationsEnabled
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
                title={
                  notificationsEnabled
                    ? "Notifikasi: Aktif"
                    : "Notifikasi: Dinonaktifkan"
                }
              >
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast Singkat saat Klik Tombol Toggle */}
      {toggleFeedback && (
        <div className="fixed bottom-16 left-4 z-50 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-xs font-medium text-slate-200 shadow-xl backdrop-blur flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span
            className={`w-2 h-2 rounded-full ${
              notificationsEnabled ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          <span>{toggleFeedback}</span>
        </div>
      )}

      {/* Floating Real-time Detection Alert Toast */}
      {toastAlert && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 max-w-sm w-full bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white truncate">
                    {toastAlert.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {toastAlert.time}
                  </span>
                </div>
                {toastAlert.detail && (
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-2">
                    {toastAlert.detail}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <Link
                    href="/admin/monitoring"
                    onClick={dismissToast}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Buka Live Monitor</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
            <button
              onClick={dismissToast}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Peringatan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
