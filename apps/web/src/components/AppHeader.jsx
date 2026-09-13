import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  FileText,
  ScanLine,
  LogOut,
  Users,
  Menu,
  X,
  Award,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatUserRole, getInitials } from "../utils/enum-map";

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const isStudent = user?.role === "STUDENT";

  const isExamsActive = location.pathname.startsWith("/exams");
  const isClassesActive = location.pathname.startsWith("/classes");
  const isGradeActive = location.pathname.startsWith("/grade");
  const isAdminDashboardActive = location.pathname === "/admin/dashboard" || location.pathname === "/admin";
  const isAdminTeachersActive = location.pathname.startsWith("/admin/teachers");
  const isProfileActive = location.pathname.startsWith("/profile");
  const isStudentResultsActive = location.pathname.startsWith("/student/results");

  const displayName =
    user?.fullName ||
    user?.teacher?.fullName ||
    user?.student?.fullName ||
    user?.email ||
    "Người dùng";
  const initials = getInitials(displayName, user?.email);

  const teacherNavItems = [
    {
      label: "Kỳ thi & Đề thi",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Chấm bài OMR",
      href: "/grade",
      icon: ScanLine,
      active: isGradeActive,
    },
    {
      label: "Hồ sơ giáo viên",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  const studentNavItems = [
    {
      label: "Kết quả của tôi",
      href: "/student/results",
      icon: Award,
      active: isStudentResultsActive,
    },
  ];

  const adminNavItems = [
    {
      label: "Tổng quan",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      active: isAdminDashboardActive,
    },
    {
      label: "Quản lý giáo viên",
      href: "/admin/teachers",
      icon: Users,
      active: isAdminTeachersActive,
    },
  ];

  const currentNavItems = isTeacher
    ? teacherNavItems
    : isStudent
    ? studentNavItems
    : isAdmin
    ? adminNavItems
    : [];

  return (
    <>
      {/* ===================================================== */}
      {/* 1. DESKTOP VERTICAL SIDEBAR (Azota Style)             */}
      {/* ===================================================== */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30 flex-col justify-between shadow-xs">
        {/* Top: Brand Header & School Level Badge */}
        <div>
          <div className="p-5 border-b border-slate-100">
            <Link
              to={isAdmin ? "/admin/dashboard" : isStudent ? "/student/results" : "/exams"}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30 group-hover:bg-blue-700 transition-colors shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm text-slate-900 leading-tight tracking-tight group-hover:text-blue-600 transition-colors truncate">
                  Digital Exam
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  Chấm thi OMR tự động
                </span>
              </div>
            </Link>

            {/* School System Scope Badge: THCS & THPT */}
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-semibold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Hệ thống THCS & THPT</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isAdmin ? "Quản trị hệ thống" : isStudent ? "Cổng học sinh" : "Thao tác chính"}
            </div>

            <nav className="space-y-1">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      item.active
                        ? "bg-blue-50 text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {item.active && (
                      <ChevronRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom: User Card & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs mb-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {initials}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-900 truncate leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {formatUserRole(user?.role)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isTeacher && (
              <Link
                to="/profile"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Bảo mật</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ===================================================== */}
      {/* 2. MOBILE TOPBAR & DRAWER (< md screens)               */}
      {/* ===================================================== */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">
              Digital Exam
            </span>
          </Link>
        </div>

        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {initials}
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-900">Digital Exam</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <div className="p-3 space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Menu chức năng
                </div>
                {currentNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        item.active
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatUserRole(user?.role)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
