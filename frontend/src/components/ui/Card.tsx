import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-sm text-slate-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
