"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { getSocket } from "@/lib/socket";
import { fetchApi } from "@/lib/api";
import { playNotificationSound } from "@/lib/audio";
import { NotificationPayload } from "@/types/monitoring";

export interface SystemNotificationToast {
  id: string;
  title: string;
  detail?: string;
  location?: string;
  time: string;
  icon?: string;
}

interface NotificationContextType {
  notificationsEnabled: boolean;
  isSyncing: boolean;
  toastAlert: SystemNotificationToast | null;
  toggleFeedback: string | null;
  toggleNotifications: () => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

const STORAGE_KEY = "daashtics_admin_notifications_enabled";

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toastAlert, setToastAlert] = useState<SystemNotificationToast | null>(null);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);

  const notificationsEnabledRef = useRef<boolean>(true);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Selalu sinkronkan ref dengan state
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // 1. Inisialisasi awal dari LocalStorage & Backend API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached !== null) {
        const parsed = cached === "true";
        setNotificationsEnabledState(parsed);
        notificationsEnabledRef.current = parsed;
      }
    }

    let isMounted = true;
    const syncStatusFromServer = async () => {
      try {
        const res = await fetchApi<{ enabled: boolean }>(
          "/api/v1/monitoring/notifications/status"
        );
        if (isMounted && res.success && res.data && typeof res.data.enabled === "boolean") {
          setNotificationsEnabledState(res.data.enabled);
          notificationsEnabledRef.current = res.data.enabled;
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, String(res.data.enabled));
          }
        }
      } catch (err) {
        console.debug("Sinkronisasi status notifikasi dari server dilewati:", err);
      }
    };

    syncStatusFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Socket.IO Listeners (Status Update & New Notification Interceptor)
  useEffect(() => {
    const socket = getSocket();

    // Listener pembaruan status global dari server atau admin lain
    const handleStatusUpdate = (data: { enabled: boolean }) => {
      if (typeof data?.enabled === "boolean") {
        setNotificationsEnabledState(data.enabled);
        notificationsEnabledRef.current = data.enabled;
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, String(data.enabled));
        }
      }
    };

    // Listener notifikasi real-time
    const handleNewNotification = (data: NotificationPayload) => {
      // 💥 BLOKIR NOTIFIKASI JIKA TOMBOL DALAM POSISI OFF (DINONAKTIFKAN)
      if (!notificationsEnabledRef.current) {
        console.debug("Pemberitahuan Socket.IO dibisukan karena toggle OFF.");
        return;
      }

      // Putar nada notifikasi sintetis
      playNotificationSound();

      const newToast: SystemNotificationToast = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: data.title || "🚨 Peringatan Sistem!",
        detail: data.detail || (data.location ? `Terdeteksi di ${data.location}` : undefined),
        location: data.location,
        time: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        icon: data.icon || "warning",
      };

      setToastAlert(newToast);

      // Auto-dismiss alert setelah 6 detik
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setToastAlert(null);
      }, 6000);
    };

    socket.on("notification_status_update", handleStatusUpdate);
    socket.on("notifikasi_baru", handleNewNotification);

    // Minta status terbaru saat socket terkoneksi
    if (socket.connected) {
      socket.emit("get_notification_status");
    }

    return () => {
      socket.off("notification_status_update", handleStatusUpdate);
      socket.off("notifikasi_baru", handleNewNotification);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const dismissToast = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setToastAlert(null);
  }, []);

  const setNotificationsEnabled = useCallback(async (targetState: boolean) => {
    setIsSyncing(true);
    setNotificationsEnabledState(targetState);
    notificationsEnabledRef.current = targetState;

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(targetState));
    }

    // Tampilkan feedback toast ringkas
    setToggleFeedback(
      targetState
        ? "Notifikasi Sistem: Aktif"
        : "Notifikasi Sistem: Dinonaktifkan (Muted)"
    );
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setToggleFeedback(null);
    }, 3000);

    // Jika diaktifkan, bunyikan nada konfirmasi lembut
    if (targetState) {
      playNotificationSound();
    }

    // Kirim sinyal Socket.IO & REST API
    try {
      const socket = getSocket();
      socket.emit("toggle_all_notifications");

      await fetchApi("/api/v1/monitoring/notifications/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled: targetState }),
      });
    } catch (err) {
      console.warn("Sinkronisasi toggle notifikasi ke backend gagal:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const toggleNotifications = useCallback(async () => {
    const nextState = !notificationsEnabledRef.current;
    await setNotificationsEnabled(nextState);
  }, [setNotificationsEnabled]);

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        isSyncing,
        toastAlert,
        toggleFeedback,
        toggleNotifications,
        setNotificationsEnabled,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification harus digunakan di dalam komponen turunan <NotificationProvider>"
    );
  }
  return context;
}
