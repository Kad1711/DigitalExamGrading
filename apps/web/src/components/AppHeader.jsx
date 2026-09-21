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
  BookOpen,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  LayoutDashboard,
  Landmark,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatUserRole, getInitials, getAvatarUrl } from "../utils/enum-map";

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
  const isPrincipal = user?.role === "PRINCIPAL";
  const isVicePrincipal = user?.role === "VICE_PRINCIPAL";
  const isExamBoard = user?.role === "EXAM_BOARD";
  const isAcademicBoard = user?.role === "ACADEMIC_BOARD";
  const isManagement = isPrincipal || isVicePrincipal || isExamBoard || isAcademicBoard;

  const isExamsActive = location.pathname.startsWith("/exams");
  const isClassesActive = location.pathname.startsWith("/classes");
  const isGradeActive = location.pathname.startsWith("/grade");
  const isAdminDashboardActive = location.pathname === "/admin/dashboard" || location.pathname === "/admin";
  const isAdminManagementActive = location.pathname.startsWith("/admin/management");
  const isAdminTeachersActive = location.pathname.startsWith("/admin/teachers");
  const isProfileActive = location.pathname.startsWith("/profile");
  const isStudentExamsActive = location.pathname.startsWith("/student/exams");
  const isStudentResultsActive = location.pathname.startsWith("/student/results");
  const isApprovalQueueActive = location.pathname.startsWith("/exams/approval-queue") ||
    location.pathname.startsWith("/publication/approval-queue");
  const isVicePrincipalTeachersActive = location.pathname.startsWith("/vice-principal/teachers");

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
      label: "Kỳ thi",
      href: "/student/exams",
      icon: BookOpen,
      active: isStudentExamsActive,
    },
    {
      label: "Kết quả",
      href: "/student/results",
      icon: Award,
      active: isStudentResultsActive,
    },
    {
      label: "Hồ sơ học sinh",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
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
      label: "Ban giám hiệu & Chuyên môn",
      href: "/admin/management",
      icon: Landmark,
      active: isAdminManagementActive,
    },
    {
      label: "Quản lý giáo viên",
      href: "/admin/teachers",
      icon: UserCheck,
      active: isAdminTeachersActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Giám sát Kỳ thi",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Hồ sơ quản trị",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  // Nav for PRINCIPAL — oversight + approval queue for MIDTERM/FINAL
  const principalNavItems = [
    {
      label: "Kỳ thi & Đề thi",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Chờ phê duyệt",
      href: "/exams?tab=approval-queue",
      icon: ShieldCheck,
      active: isApprovalQueueActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Giáo viên",
      href: "/admin/teachers",
      icon: UserCheck,
      active: isAdminTeachersActive,
    },
    {
      label: "Hồ sơ",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  // Nav for VICE_PRINCIPAL — teacher professional management
  const vicePrincipalNavItems = [
    {
      label: "Kỳ thi & Đề thi",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Chuyên môn GV",
      href: "/vice-principal/teachers",
      icon: GraduationCap,
      active: isVicePrincipalTeachersActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Giáo viên",
      href: "/admin/teachers",
      icon: UserCheck,
      active: isAdminTeachersActive,
    },
    {
      label: "Hồ sơ",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  // Nav for EXAM_BOARD — can create official exams + grade
  const examBoardNavItems = [
    {
      label: "Kỳ thi chính thức",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Chấm bài OMR",
      href: "/grade",
      icon: ScanLine,
      active: isGradeActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Hồ sơ",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  // Nav for ACADEMIC_BOARD — can approve publication requests
  const academicBoardNavItems = [
    {
      label: "Kỳ thi & Đề thi",
      href: "/exams",
      icon: FileText,
      active: isExamsActive,
    },
    {
      label: "Hàng đợi phê duyệt",
      href: "/exams?tab=approval-queue",
      icon: ShieldCheck,
      active: isApprovalQueueActive,
    },
    {
      label: "Lớp học & Học sinh",
      href: "/classes",
      icon: Users,
      active: isClassesActive,
    },
    {
      label: "Hồ sơ",
      href: "/profile",
      icon: UserCheck,
      active: isProfileActive,
    },
  ];

  const currentNavItems = isTeacher
    ? teacherNavItems
    : isStudent
    ? studentNavItems
    : isAdmin
    ? adminNavItems
    : isPrincipal
    ? principalNavItems
    : isVicePrincipal
    ? vicePrincipalNavItems
    : isExamBoard
    ? examBoardNavItems
    : isAcademicBoard
    ? academicBoardNavItems
    : [];

  // Home redirect per role
  const homeHref = isAdmin
    ? "/admin/dashboard"
    : isStudent
    ? "/student/exams"
    : "/exams";

  // Sidebar section label per role
  const sectionLabel = isAdmin
    ? "Quản trị hệ thống"
    : isStudent
    ? "Cổng học sinh"
    : isManagement
    ? "Ban quản lý"
    : "Thao tác chính";


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
              to={homeHref}
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
              {sectionLabel}
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
          <Link
            to="/profile"
            className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs mb-2 hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            {user?.avatarUrl ? (
              <img
                src={getAvatarUrl(user.avatarUrl)}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 group-hover:bg-blue-700 transition-colors">
                {initials}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-blue-600 transition-colors">
                {displayName}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {formatUserRole(user?.role)}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <Link
              to="/profile"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Hồ sơ & Bảo mật</span>
            </Link>

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

        <Link to="/profile" className="flex items-center">
          {user?.avatarUrl ? (
            <img
              src={getAvatarUrl(user.avatarUrl)}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {initials}
            </div>
          )}
        </Link>
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
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200"
              >
                {user?.avatarUrl ? (
                  <img
                    src={getAvatarUrl(user.avatarUrl)}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatUserRole(user?.role)}
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hồ sơ & Bảo mật</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
