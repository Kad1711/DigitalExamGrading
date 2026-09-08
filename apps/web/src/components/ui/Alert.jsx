import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export default function Alert({
  variant = "info",
  title,
  children,
  onClose,
  className = "",
}) {
  const config = {
    info: {
      bg: "bg-blue-50 border-blue-200 text-blue-900",
      iconColor: "text-blue-600",
      Icon: Info,
    },
    success: {
      bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
      iconColor: "text-emerald-600",
      Icon: CheckCircle2,
    },
    warning: {
      bg: "bg-amber-50 border-amber-200 text-amber-900",
      iconColor: "text-amber-600",
      Icon: AlertTriangle,
    },
    danger: {
      bg: "bg-rose-50 border-rose-200 text-rose-900",
      iconColor: "text-rose-600",
      Icon: AlertCircle,
    },
  }[variant] || {
    bg: "bg-blue-50 border-blue-200 text-blue-900",
    iconColor: "text-blue-600",
    Icon: Info,
  };

  const { bg, iconColor, Icon } = config;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border ${bg} ${className}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div className="flex-1 text-sm leading-relaxed">
        {title && <h5 className="font-semibold mb-1 text-inherit">{title}</h5>}
        <div className="text-inherit">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
