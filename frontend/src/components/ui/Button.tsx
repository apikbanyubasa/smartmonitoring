import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 focus:ring-indigo-500 focus:ring-offset-slate-950",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 focus:ring-slate-500 focus:ring-offset-slate-950",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 focus:ring-rose-500 focus:ring-offset-slate-950",
    ghost:
      "bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white focus:ring-slate-500",
    outline:
      "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700 focus:ring-slate-500",
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
