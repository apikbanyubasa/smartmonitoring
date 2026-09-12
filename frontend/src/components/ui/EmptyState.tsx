import React from "react";
import { FolderSearch } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "Tidak ada data ditemukan",
  description = "Belum ada rekaman data yang tersedia untuk kriteria ini.",
  icon,
  action,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
        {icon || <FolderSearch className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-1">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-4">{description}</p>
      {action ? (
        <div>{action}</div>
      ) : actionText && onAction ? (
        <button
          onClick={onAction}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-500/20"
        >
          {actionText}
        </button>
      ) : null}
    </div>
  );
}
