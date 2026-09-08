import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  FileText,
  ScanLine,
  LogOut,
  User,
  Users,
  KeyRound,
  ChevronDown,
  Menu,
  X,
  Award,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatUserRole, getInitials } from "../utils/enum-map";
import Badge from "./ui/Badge";

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = user?.role === "ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const isStudent = user?.role === "STUDENT";

  const isExamsActive = location.pathname.startsWith("/exams");
  const isGradeActive = location.pathname.startsWith("/grade");
  const isAdminTeachersActive = location.pathname.startsWith("/admin/teachers");
  const isProfileActive = location.pathname.startsWith("/profile");
  const isStudentResultsActive = location.pathname.startsWith("/student/results");

  const displayName = user?.fullName || user?.teacher?.fullName || user?.student?.fullName || user?.email || "Người dùng";
  const initials = getInitials(displayName, user?.email);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Nav */}
          <div className="flex items-center gap-8">
            <Link
              to={isAdmin ? "/admin/teachers" : isStudent ? "/student/results" : "/exams"}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30 group-hover:bg-blue-700 transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-slate-900 leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                  Digital Exam Grading
                </span>
                <span className="text-[11px] font-medium text-slate-500 tracking-wide">
                  {isAdmin ? "Hệ thống Quản trị" : isStudent ? "Cổng thông tin học sinh" : "Hệ thống chấm thi OMR"}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {isTeacher && (
                <>
                  <Link
                    to="/exams"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isExamsActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Kỳ thi</span>
                  </Link>
                  <Link
                    to="/grade"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGradeActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <ScanLine className="w-4 h-4" />
                    <span>Chấm bài</span>
                  </Link>
                </>
              )}

              {isStudent && (
                <Link
                  to="/student/results"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isStudentResultsActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Kết quả của tôi</span>
                </Link>
              )}

              {isAdmin && (
                <Link
                  to="/admin/teachers"
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isAdminTeachersActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Quản lý giáo viên</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Right: User Profile & Dropdown Menu (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100/70 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {/* Avatar Initials */}
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {initials}
                  </div>

                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[160px]">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatUserRole(user.role)}
                    </span>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Card */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {user.email}
                        </p>
                        <div className="mt-1">
                          <Badge variant="blue" size="sm">
                            {formatUserRole(user.role)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Menu items for Teacher */}
                    {isTeacher && (
                      <div className="py-1">
                        <Link
                          to="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors ${
                            isProfileActive ? "text-blue-600 font-semibold bg-blue-50/50" : ""
                          }`}
                        >
                          <User className="w-4 h-4 text-slate-500" />
                          <span>Hồ sơ cá nhân</span>
                        </Link>
                        <Link
                          to="/profile#change-password"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-slate-500" />
                          <span>Đổi mật khẩu</span>
                        </Link>
                      </div>
                    )}

                    {/* Menu items for Admin */}
                    {isAdmin && (
                      <div className="py-1">
                        <Link
                          to="/admin/teachers"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Users className="w-4 h-4 text-slate-500" />
                          <span>Quản lý giáo viên</span>
                        </Link>
                      </div>
                    )}

                    {/* Logout */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-3 shadow-lg animate-in slide-in-from-top duration-150">
          <nav className="space-y-1">
            {isTeacher && (
              <>
                <Link
                  to="/exams"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isExamsActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Kỳ thi</span>
                </Link>
                <Link
                  to="/grade"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isGradeActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <ScanLine className="w-5 h-5 text-blue-600" />
                  <span>Chấm bài</span>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isProfileActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <User className="w-5 h-5 text-blue-600" />
                  <span>Hồ sơ cá nhân</span>
                </Link>
              </>
            )}

            {isStudent && (
              <Link
                to="/student/results"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isStudentResultsActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Award className="w-5 h-5 text-blue-600" />
                <span>Kết quả của tôi</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/teachers"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isAdminTeachersActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Users className="w-5 h-5 text-blue-600" />
                <span>Quản lý giáo viên</span>
              </Link>
            )}
          </nav>

          {user && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[190px]">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatUserRole(user.role)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Thoát</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
