import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
}: BadgeProps) {
  const variantStyles = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    info: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
  }[variant];

  const dotStyles = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-indigo-400",
    neutral: "bg-slate-400",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles} animate-pulse`} />}
      {children}
    </span>
  );
}
