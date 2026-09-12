import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-800/80 border border-slate-700/40 ${className}`}
    />
  );
}
