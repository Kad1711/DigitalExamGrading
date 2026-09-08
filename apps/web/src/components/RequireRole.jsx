import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Route guard dua tren vai tro nguoi dung (Role-Based Route Guard).
 * Bao ve giao dien phia client. Backend authorization van luon la chot chan quyet dinh.
 */
export default function RequireRole({ roles, children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-500">
            Đang tải dữ liệu...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // Neu khong dung quyen, chuyen huong ve trang mac dinh theo vai tro cua ho
    if (user.role === "ADMIN") {
      return <Navigate to="/admin/teachers" replace />;
    }
    if (user.role === "TEACHER") {
      return <Navigate to="/exams" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}
