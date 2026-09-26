import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import {
  Landmark,
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  UserCheck,
  Crown,
  FileCheck2,
  GraduationCap,
  Sparkles,
  UserPlus,
  Trash2,
  AlertTriangle,
  School,
} from "lucide-react";
import { formatUserStatus, getInitials } from "../utils/enum-map";

function getRoleBadge(role) {
  switch (role) {
    case "PRINCIPAL":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Crown className="w-3.5 h-3.5 text-purple-600" />
          Hiệu trưởng
        </span>
      );
    case "VICE_PRINCIPAL":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
          Hiệu phó chuyên môn
        </span>
      );
    case "EXAM_OFFICER":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
          Cán bộ khảo thí
        </span>
      );
    case "TEACHER":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <School className="w-3.5 h-3.5 text-emerald-600" />
          Giáo viên
        </span>
      );
    default:
      return <Badge variant="neutral">{role}</Badge>;
  }
}

export default function AdminManagementPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [alert, setAlert] = useState(null);

  // Modals state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Reset password form state
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [copiedNew, setCopiedNew] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create account form state
  const [createRole, setCreateRole] = useState("EXAM_OFFICER");
  const [createFullName, setCreateFullName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createTeacherCode, setCreateTeacherCode] = useState("");
  const [createShowPassword, setCreateShowPassword] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/management-accounts");
      setAccounts(res.data.data || []);
    } catch (err) {
      console.error("Failed to load management accounts:", err);
      setAlert({
        type: "error",
        message: err.response?.data?.error?.message || "Không thể tải danh sách tài khoản nhân sự.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCopyNewPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopiedNew(true);
    setTimeout(() => setCopiedNew(false), 2000);
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "Mgmt@";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const generateRandomCreatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "Admin@";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreatePassword(pwd);
  };

  // Reset password handler
  const openResetPassword = (account) => {
    setSelectedAccount(account);
    setNewPassword("");
    setShowPassword(true);
    setCopiedNew(false);
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 6) {
      setAlert({
        type: "error",
        message: "Mật khẩu mới phải có tối thiểu 6 ký tự.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/admin/management-accounts/${selectedAccount.id}/reset-password`, {
        newPassword: newPassword.trim(),
      });
      setIsResetPasswordOpen(false);
      setAlert({
        type: "success",
        message: res.data?.message || "Đã đặt lại mật khẩu thành công.",
      });
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error?.message || "Không thể đặt lại mật khẩu.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Lock / Unlock handler
  const openToggleStatus = (account) => {
    setSelectedAccount(account);
    setIsLockModalOpen(true);
  };

  const handleToggleStatusSubmit = async () => {
    if (!selectedAccount) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/management-accounts/${selectedAccount.id}/toggle-status`);
      setIsLockModalOpen(false);
      setAlert({
        type: "success",
        message: res.data?.message || "Cập nhật trạng thái tài khoản thành công.",
      });
      await fetchAccounts();
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error?.message || "Không thể thay đổi trạng thái tài khoản.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete locked account handler
  const openDeleteModal = (account) => {
    setSelectedAccount(account);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedAccount) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/admin/management-accounts/${selectedAccount.id}`);
      setIsDeleteModalOpen(false);
      setAlert({
        type: "success",
        message: res.data?.message || "Đã xóa vĩnh viễn tài khoản thành công.",
      });
      await fetchAccounts();
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error?.message || "Không thể xóa tài khoản đã khóa.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Create account handler
  const openCreateModal = () => {
    setCreateRole("EXAM_OFFICER");
    setCreateFullName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateTeacherCode("");
    generateRandomCreatePassword();
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createEmail || !createPassword || createPassword.length < 6) {
      setAlert({
        type: "error",
        message: "Vui lòng nhập email và mật khẩu tối thiểu 6 ký tự.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post("/admin/management-accounts", {
        fullName: createFullName.trim(),
        email: createEmail.trim(),
        phone: createPhone.trim() || undefined,
        password: createPassword.trim(),
        role: createRole,
        teacherCode: createRole === "TEACHER" ? createTeacherCode.trim() : undefined,
      });

      setIsCreateModalOpen(false);
      setAlert({
        type: "success",
        message: res.data?.message || "Đã tạo tài khoản và phân quyền thành công.",
      });
      await fetchAccounts();
    } catch (err) {
      setAlert({
        type: "error",
        message: err.response?.data?.error?.message || "Không thể tạo tài khoản mới.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const [activeGroupTab, setActiveGroupTab] = useState("ALL");

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchSearch =
      !search ||
      acc.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      acc.email?.toLowerCase().includes(search.toLowerCase());

    let matchGroup = true;
    if (activeGroupTab === "LEADERSHIP") {
      matchGroup = acc.role === "PRINCIPAL" || acc.role === "VICE_PRINCIPAL";
    } else if (activeGroupTab === "PROFESSIONAL_BOARDS") {
      matchGroup = acc.role === "EXAM_OFFICER";
    } else if (activeGroupTab === "TEACHERS") {
      matchGroup = acc.role === "TEACHER";
    }

    const matchRole = roleFilter === "ALL" || acc.role === roleFilter;
    const matchStatus = statusFilter === "ALL" || acc.status === statusFilter;
    return matchSearch && matchGroup && matchRole && matchStatus;
  });

  const countPrincipal = accounts.filter((a) => a.role === "PRINCIPAL").length;
  const countVicePrincipal = accounts.filter((a) => a.role === "VICE_PRINCIPAL").length;
  const countExamOfficer = accounts.filter((a) => a.role === "EXAM_OFFICER").length;
  const countTeacher = accounts.filter((a) => a.role === "TEACHER").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      {/* Main container without mx-auto max-w-7xl to prevent detached empty space */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full space-y-6">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Landmark className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Ban Giám Hiệu & Phân Quyền Nhân Sự
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Quản lý, tạo tài khoản và phân quyền cho Ban Giám hiệu, Cán bộ khảo thí và Giáo viên.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAccounts}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              Tạo tài khoản & Cấp quyền
            </Button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert && (
          <Alert
            variant={alert.type}
            onClose={() => setAlert(null)}
            className="animate-in fade-in duration-200"
          >
            {alert.message}
          </Alert>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700">Hiệu trưởng</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <Crown className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{countPrincipal}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Phê duyệt kết quả cao nhất</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700">Hiệu phó chuyên môn</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <GraduationCap className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{countVicePrincipal}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Quản lý chuyên môn & phân công</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700">Cán bộ khảo thí</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <FileCheck2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{countExamOfficer}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tổ chức thi & chấm OMR</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700">Giáo viên</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <School className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{countTeacher}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Giảng dạy & chấm bài</div>
          </div>
        </div>

        {/* Navigation Section Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveGroupTab("ALL"); setRoleFilter("ALL"); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeGroupTab === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Tất cả nhân sự ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveGroupTab("LEADERSHIP"); setRoleFilter("ALL"); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeGroupTab === "LEADERSHIP"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            Ban Giám hiệu ({countPrincipal + countVicePrincipal})
          </button>
          <button
            type="button"
            onClick={() => { setActiveGroupTab("PROFESSIONAL_BOARDS"); setRoleFilter("ALL"); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeGroupTab === "PROFESSIONAL_BOARDS"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Cán bộ khảo thí ({countExamOfficer})
          </button>
          <button
            type="button"
            onClick={() => { setActiveGroupTab("TEACHERS"); setRoleFilter("ALL"); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeGroupTab === "TEACHERS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <School className="w-3.5 h-3.5" />
            Giáo viên ({countTeacher})
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo họ tên hoặc email tài khoản..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả chức vụ</option>
              <option value="PRINCIPAL">Hiệu trưởng</option>
              <option value="VICE_PRINCIPAL">Hiệu phó chuyên môn</option>
              <option value="EXAM_OFFICER">Cán bộ khảo thí</option>
              <option value="TEACHER">Giáo viên</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã bị khóa</option>
            </select>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span>Đang tải danh sách tài khoản nhân sự...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Landmark}
                title="Không tìm thấy tài khoản"
                description="Không có tài khoản nào phù hợp với bộ lọc tìm kiếm hiện tại."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[850px]">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Nhân sự / Tài khoản</th>
                    <th className="py-3.5 px-4">Chức vụ hệ thống</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Ngày tạo</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAccounts.map((acc) => {
                    const initials = getInitials(acc.fullName || acc.email, acc.email);
                    const isLocked = acc.status === "LOCKED";

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                                <span>{acc.fullName || "Chưa đặt tên"}</span>
                                {acc.teacher?.teacherCode && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    {acc.teacher.teacherCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate font-mono">
                                {acc.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getRoleBadge(acc.role)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {acc.status === "ACTIVE" ? (
                            <Badge variant="success">Đang hoạt động</Badge>
                          ) : (
                            <Badge variant="danger">Đã bị khóa</Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500">
                          {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString("vi-VN") : "—"}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResetPassword(acc)}
                              className="gap-1 text-xs py-1 px-2.5 h-8 font-medium"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                              <span>Đặt lại MK</span>
                            </Button>

                            <Button
                              variant={isLocked ? "success" : "danger"}
                              size="sm"
                              onClick={() => openToggleStatus(acc)}
                              className="gap-1 text-xs py-1 px-2.5 h-8 font-medium"
                            >
                              {isLocked ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Mở khóa</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Khóa</span>
                                </>
                              )}
                            </Button>

                            {/* Delete Locked Account */}
                            {isLocked && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => openDeleteModal(acc)}
                                className="gap-1 text-xs py-1 px-2.5 h-8 font-medium bg-rose-600 hover:bg-rose-700 text-white"
                                title="Xóa vĩnh viễn tài khoản đã khóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: Reset Password */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => !actionLoading && setIsResetPasswordOpen(false)}
        title="Đặt Lại Mật Khẩu Mới"
        description={`Cập nhật mật khẩu bảo mật mới cho tài khoản: ${selectedAccount?.fullName} (${selectedAccount?.email})`}
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-3 pr-20 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopyNewPassword}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                    title="Sao chép mật khẩu vừa nhập"
                  >
                    {copiedNew ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Nhấn vào biểu tượng con mắt để xem rõ ký tự mật khẩu trước khi lưu.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={generateRandomPassword}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Tự động sinh mật khẩu ngẫu nhiên an toàn
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetPasswordOpen(false)}
              disabled={actionLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={actionLoading || !newPassword || newPassword.length < 6}
            >
              {actionLoading ? "Đang lưu..." : "Xác nhận đổi mật khẩu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Toggle Account Status (Lock / Unlock) */}
      <Modal
        isOpen={isLockModalOpen}
        onClose={() => !actionLoading && setIsLockModalOpen(false)}
        title={selectedAccount?.status === "ACTIVE" ? "Khóa Tài Khoản Quản Lý" : "Mở Khóa Tài Khoản Quản Lý"}
        description={`Bạn có chắc chắn muốn ${selectedAccount?.status === "ACTIVE" ? "khóa" : "mở khóa"} tài khoản ${selectedAccount?.fullName} (${selectedAccount?.email})?`}
      >
        <div className="space-y-4 pt-2">
          <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
            selectedAccount?.status === "ACTIVE"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>
            {selectedAccount?.status === "ACTIVE" ? (
              <p>
                Khi bị khóa, tài khoản này sẽ bị thu hồi phiên đăng nhập ngay lập tức và không thể truy cập vào hệ thống cho tới khi quản trị viên mở khóa trở lại.
              </p>
            ) : (
              <p>
                Khi mở khóa, nhân sự có thể đăng nhập bình thường vào hệ thống với vai trò và quyền hạn được phân công.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLockModalOpen(false)}
              disabled={actionLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant={selectedAccount?.status === "ACTIVE" ? "danger" : "success"}
              onClick={handleToggleStatusSubmit}
              disabled={actionLoading}
            >
              {actionLoading
                ? "Đang xử lý..."
                : selectedAccount?.status === "ACTIVE"
                ? "Xác nhận khóa tài khoản"
                : "Xác nhận mở khóa tài khoản"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Delete Locked Account Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !actionLoading && setIsDeleteModalOpen(false)}
        title="Xóa Vĩnh Viễn Tài Khoản Đã Khóa"
        description={`Hành động này sẽ xóa hoàn toàn tài khoản khỏi hệ thống và không thể khôi phục.`}
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Cảnh báo xóa vĩnh viễn:
            </div>
            <p>
              Bạn đang chuẩn bị xóa tài khoản: <strong>{selectedAccount?.fullName}</strong> ({selectedAccount?.email}).
            </p>
            <p>
              Tài khoản này hiện đang trong trạng thái <strong>Đã bị khóa</strong>. Mọi quyền truy cập và dữ liệu liên quan sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteSubmit}
              disabled={actionLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {actionLoading ? "Đang xóa..." : "Xác nhận xóa tài khoản"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Create Account with Role Assignment */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !actionLoading && setIsCreateModalOpen(false)}
        title="Tạo Tài Khoản Nhân Sự & Phân Quyền"
        description="Khởi tạo tài khoản mới và cấp quyền truy cập theo chức danh trong nhà trường."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cấp quyền vai trò chức danh <span className="text-red-500">*</span>
            </label>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800 font-medium cursor-pointer"
            >
              <option value="PRINCIPAL">👑 Hiệu trưởng (Phê duyệt kết quả cao nhất)</option>
              <option value="VICE_PRINCIPAL">🎓 Hiệu phó chuyên môn (Quản lý chuyên môn & phân công)</option>
              <option value="EXAM_OFFICER">📋 Cán bộ khảo thí (Tổ chức thi & chấm OMR)</option>
              <option value="TEACHER">🏫 Giáo viên (Giảng dạy, tạo đề & chấm bài)</option>
            </select>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Họ và tên nhân sự <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: Thầy Nguyễn Văn A..."
              value={createFullName}
              onChange={(e) => setCreateFullName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email đăng nhập <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="VD: giaovien@digitalexam.local..."
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
            />
          </div>

          {/* Phone & Teacher Code (if TEACHER) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                placeholder="VD: 0912345678"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            {createRole === "TEACHER" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mã giáo viên (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Để trống tự sinh mã (VD: GV010)"
                  value={createTeacherCode}
                  onChange={(e) => setCreateTeacherCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono uppercase"
                />
              </div>
            )}
          </div>

          {/* Initial Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mật khẩu khởi tạo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={createShowPassword ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự..."
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-3 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setCreateShowPassword(!createShowPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {createShowPassword ? (
                  <EyeOff className="w-4 h-4 text-blue-600" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between pt-1.5">
              <button
                type="button"
                onClick={generateRandomCreatePassword}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sinh mật khẩu ngẫu nhiên
              </button>
              <span className="text-[11px] text-slate-400">
                Mật khẩu: {createPassword || "Chưa nhập"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={actionLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={actionLoading || !createEmail || !createPassword || createPassword.length < 6}
            >
              {actionLoading ? "Đang tạo..." : "Xác nhận tạo & Cấp quyền"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
