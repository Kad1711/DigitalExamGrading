import React from "react";

export default function Badge({
  children,
  variant = "gray",
  size = "md",
  icon: Icon,
  className = "",
  ...props
}) {
  const baseStyles =
    "inline-flex items-center gap-1.5 font-medium rounded-full shrink-0";

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  }[size] || "text-xs px-2.5 py-1";

  const variantStyles = {
    gray: "bg-slate-100 text-slate-700 border border-slate-200",
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
    red: "bg-rose-50 text-rose-700 border border-rose-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
    indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  }[variant] || "bg-slate-100 text-slate-700 border border-slate-200";

  return (
    <span
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </span>
  );
}
