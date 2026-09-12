import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({
  title = "Terjadi Kesalahan",
  message,
  onRetry,
}: ErrorBannerProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-rose-200">{title}</h4>
          <p className="text-xs text-rose-300/80 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="danger"
          size="sm"
          onClick={onRetry}
          className="flex-shrink-0 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 shadow-none"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
