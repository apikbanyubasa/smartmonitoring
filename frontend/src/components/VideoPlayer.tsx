"use client";

import React, { useState } from "react";
import { Video, VideoOff, RefreshCw } from "lucide-react";
import { Badge } from "./ui/Badge";

interface VideoPlayerProps {
  cameraId: number | null;
  locationName: string;
  streamMode?: "simple" | "parking" | "plate";
  className?: string;
}

export function VideoPlayer({
  cameraId,
  locationName,
  streamMode = "simple",
  className = "",
}: VideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const streamUrl = cameraId
    ? `/api/v1/monitoring/stream/${cameraId}?mode=${streamMode}&k=${reloadKey}`
    : null;

  const handleRetry = () => {
    setHasError(false);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <div
      className={`bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-md ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-white truncate">
            {locationName || "Kamera Tidak Terpilih"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {cameraId && !hasError && (
            <Badge variant="danger" dot>
              LIVE STREAM
            </Badge>
          )}
        </div>
      </div>

      {/* 16:9 Video Canvas */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
        {cameraId && streamUrl && !hasError ? (
          <img
            src={streamUrl}
            alt={`Live stream ${locationName}`}
            className="w-full h-full object-contain"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
              <VideoOff className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {hasError
                ? "Gagal memuat feed video RTSP / HLS kamera."
                : "Silakan pilih kamera dari daftar di sebelah kiri."}
            </p>
            {hasError && (
              <button
                onClick={handleRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Muat Ulang Stream
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
