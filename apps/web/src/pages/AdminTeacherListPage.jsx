import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import {
  Users,
  UserPlus,
  Search,
  Lock,
  Unlock,
  KeyRound,
  Edit2,
  CheckCircle2,
  Eye,
  EyeOff,
  BookOpen,
  Phone,
  Mail,
  ShieldAlert,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { formatUserStatus, getInitials } from "../utils/enum-map";

export default function AdminTeacherListPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [alert, setAlert] = useState(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLockOpen, setIsLockOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedLockedTeacherIds, setSelectedLockedTeacherIds] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: "",
    teacherCode: "",
    email: "",
    phone: "",
    initialPassword: "",
    confirmPassword: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const [editForm, setEditForm] = useState({
    fullName: "",
    teacherCode: "",
    email: "",
    phone: "",
  });

  const [resetForm, setResetForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;

      const res = await api.get("/admin/teachers", { params });
      setTeachers(res.data.data || []);
    } catch (err) {
      setAlert({
        type: "danger",
        message:
          err.response?.data?.error?.message ||
          "Không thể tải danh sách giáo viên. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeachers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTeachers]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateForm({
      fullName: "",
      teacherCode: "",
      email: "",
      phone: "",
      initialPassword: "",
      confirmPassword: "",
    });
    setModalError("");
    setShowCreatePassword(false);
    setIsCreateOpen(true);
  };

  // Submit Create Teacher
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^0\d{9}$/;
  const CODE_REGEX = /^[A-Za-z0-9_-]+$/;

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    const fullName = createForm.fullName.trim();
    const teacherCode = createForm.teacherCode.trim();
    const email = createForm.email.trim();
    const phone = createForm.phone.trim();

    if (!fullName || !teacherCode || !email || !createForm.initialPassword) {
      setModalError("Vui lòng điền đầy đủ các trường bắt buộc (*).");
      return;
    }

    if (fullName.length < 2) {
      setModalError("Họ và tên giáo viên phải có ít nhất 2 ký tự.");
      return;
    }

    if (!CODE_REGEX.test(teacherCode)) {
      setModalError("Mã giáo viên chỉ được chứa chữ cái, số, dấu gạch ngang (-) hoặc gạch dưới (_).");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setModalError("Email không đúng định dạng (ví dụ: gv@example.com).");
      return;
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      setModalError("Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 0, ví dụ: 0912345678).");
      return;
    }

    if (createForm.initialPassword.length < 8) {
      setModalError("Mật khẩu ban đầu phải có ít nhất 8 ký tự.");
      return;
    }

    if (createForm.initialPassword !== createForm.confirmPassword) {
      setModalError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setModalLoading(true);
      const payload = {
        fullName,
        teacherCode,
        email,
        phone: phone || null,
        initialPassword: createForm.initialPassword,
      };

      await api.post("/admin/teachers", payload);

      setIsCreateOpen(false);
      setAlert({
        type: "success",
        message: `Đã tạo thành công tài khoản cho giáo viên "${payload.fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message ||
          "Không thể tạo tài khoản giáo viên. Vui lòng thử lại."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (t) => {
    setSelectedTeacher(t);
    setEditForm({
      fullName: t.fullName || "",
      teacherCode: t.teacherCode || "",
      email: t.email || "",
      phone: t.phone || "",
    });
    setModalError("");
    setIsEditOpen(true);
  };

  // Submit Edit Teacher
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    const fullName = editForm.fullName.trim();
    const teacherCode = editForm.teacherCode.trim();
    const email = editForm.email.trim();
    const phone = editForm.phone.trim();

    if (!fullName || !teacherCode || !email) {
      setModalError("Vui lòng điền đầy đủ họ tên, mã GV và email.");
      return;
    }

    if (fullName.length < 2) {
      setModalError("Họ và tên giáo viên phải có ít nhất 2 ký tự.");
      return;
    }

    if (!CODE_REGEX.test(teacherCode)) {
      setModalError("Mã giáo viên chỉ được chứa chữ cái, số, dấu gạch ngang (-) hoặc gạch dưới (_).");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setModalError("Email không đúng định dạng (ví dụ: gv@example.com).");
      return;
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      setModalError("Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 0, ví dụ: 0912345678).");
      return;
    }

    try {
      setModalLoading(true);
      await api.patch(`/admin/teachers/${selectedTeacher.id}`, {
        fullName,
        teacherCode,
        email,
        phone: phone || null,
      });

      setIsEditOpen(false);
      setAlert({
        type: "success",
        message: `Đã cập nhật thông tin giáo viên "${fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message ||
          "Không thể cập nhật thông tin giáo viên. Vui lòng thử lại."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Lock Modal
  const handleOpenLock = (t) => {
    setSelectedTeacher(t);
    setModalError("");
    setIsLockOpen(true);
  };

  const handleConfirmLock = async () => {
    try {
      setModalLoading(true);
      await api.post(`/admin/teachers/${selectedTeacher.id}/lock`);
      setIsLockOpen(false);
      setAlert({
        type: "warning",
        message: `Đã khóa tài khoản giáo viên "${selectedTeacher.fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message || "Không thể khóa tài khoản giáo viên."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Unlock Modal
  const handleOpenUnlock = (t) => {
    setSelectedTeacher(t);
    setModalError("");
    setIsUnlockOpen(true);
  };

  const handleConfirmUnlock = async () => {
    try {
      setModalLoading(true);
      await api.post(`/admin/teachers/${selectedTeacher.id}/unlock`);
      setIsUnlockOpen(false);
      setAlert({
        type: "success",
        message: `Đã mở khóa tài khoản giáo viên "${selectedTeacher.fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message || "Không thể mở khóa tài khoản giáo viên."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (t) => {
    setSelectedTeacher(t);
    setResetForm({ newPassword: "", confirmPassword: "" });
    setShowResetPassword(false);
    setModalError("");
    setIsResetPasswordOpen(true);
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!resetForm.newPassword) {
      setModalError("Vui lòng nhập mật khẩu mới.");
      return;
    }

    if (resetForm.newPassword.length < 8) {
      setModalError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setModalError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setModalLoading(true);
      await api.post(`/admin/teachers/${selectedTeacher.id}/reset-password`, {
        newPassword: resetForm.newPassword,
      });

      setIsResetPasswordOpen(false);
      setAlert({
        type: "success",
        message: `Đã đặt lại mật khẩu cho giáo viên "${selectedTeacher.fullName}". Các phiên đăng nhập cũ đã được thu hồi.`,
      });
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message || "Không thể đặt lại mật khẩu."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Delete Teacher Modal (2-step)
  const handleOpenDelete = (t) => {
    setSelectedTeacher(t);
    setDeleteConfirmText("");
    setModalError("");
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTeacher) return;
    try {
      setModalLoading(true);
      setModalError("");
      const res = await api.delete(`/admin/teachers/${selectedTeacher.id}`);
      setIsDeleteOpen(false);
      setSelectedLockedTeacherIds((prev) =>
        prev.filter((id) => id !== selectedTeacher.id)
      );
      setAlert({
        type: "success",
        message:
          res.data.message ||
          `Đã xóa vĩnh viễn giáo viên "${selectedTeacher.fullName}".`,
      });
      setSelectedTeacher(null);
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message ||
          "Không thể xóa tài khoản giáo viên. Vui lòng thử lại."
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleBulkDeleteLocked = async () => {
    if (selectedLockedTeacherIds.length === 0) return;
    try {
      setModalLoading(true);
      setModalError("");
      const res = await api.post("/admin/teachers/bulk-delete-locked", {
        teacherIds: selectedLockedTeacherIds,
      });
      setIsBulkDeleteOpen(false);
      setAlert({
        type: "success",
        message:
          res.data.message ||
          `Đã xóa thành công ${selectedLockedTeacherIds.length} giáo viên đã bị khóa.`,
      });
      setSelectedLockedTeacherIds([]);
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message ||
          "Không thể xóa danh sách giáo viên. Vui lòng thử lại."
      );
    } finally {
      setModalLoading(false);
    }
  };

  const lockedTeachersList = teachers.filter((t) => t.status === "LOCKED");

  const toggleSelectLockedTeacher = (teacherId) => {
    setSelectedLockedTeacherIds((prev) =>
      prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  const toggleSelectAllLocked = () => {
    if (
      lockedTeachersList.length > 0 &&
      selectedLockedTeacherIds.length === lockedTeachersList.length
    ) {
      setSelectedLockedTeacherIds([]);
    } else {
      setSelectedLockedTeacherIds(lockedTeachersList.map((t) => t.id));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-blue-600" />
              <span>Quản lý giáo viên</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý tài khoản giáo viên sử dụng hệ thống.
            </p>
          </div>

          <Button
            variant="primary"
            icon={UserPlus}
            onClick={handleOpenCreate}
            className="self-start sm:self-auto"
          >
            Tạo tài khoản giáo viên
          </Button>
        </div>

        {/* Global Alert Notification */}
        {alert && (
          <Alert
            variant={alert.type}
            className="mb-6"
            onClose={() => setAlert(null)}
          >
            {alert.message}
          </Alert>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo họ tên, email, mã giáo viên..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả ({teachers.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoạt động
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("LOCKED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === "LOCKED"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Đã khóa
            </button>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedLockedTeacherIds.length > 0 && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Đã chọn {selectedLockedTeacherIds.length} giáo viên đã bị khóa</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  setModalError("");
                  setIsBulkDeleteOpen(true);
                }}
              >
                Xóa tất cả đã chọn ({selectedLockedTeacherIds.length})
              </Button>
              <button
                type="button"
                onClick={() => setSelectedLockedTeacherIds([])}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">
              Đang tải danh sách giáo viên...
            </p>
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Không tìm thấy giáo viên"
            description={
              search
                ? `Không có kết quả nào phù hợp với từ khóa "${search}".`
                : "Chưa có tài khoản giáo viên nào trong hệ thống."
            }
            action={
              <Button variant="primary" icon={UserPlus} onClick={handleOpenCreate}>
                Tạo tài khoản giáo viên
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop Table (Visible on md and up) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 pl-4 pr-1 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          lockedTeachersList.length > 0 &&
                          selectedLockedTeacherIds.length === lockedTeachersList.length
                        }
                        onChange={toggleSelectAllLocked}
                        disabled={lockedTeachersList.length === 0}
                        title="Chọn tất cả giáo viên bị khóa"
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-30"
                      />
                    </th>
                    <th className="py-3.5 px-4 sm:px-6">Giáo viên</th>
                    <th className="py-3.5 px-4">Mã GV</th>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">Số điện thoại</th>
                    <th className="py-3.5 px-4 text-center">Kỳ thi</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {teachers.map((t) => {
                    const initials = getInitials(t.fullName, t.email);
                    const isLocked = t.status === "LOCKED";

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          selectedLockedTeacherIds.includes(t.id)
                            ? "bg-rose-50/40 hover:bg-rose-50/60"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 pl-4 pr-1 text-center">
                          {isLocked ? (
                            <input
                              type="checkbox"
                              checked={selectedLockedTeacherIds.includes(t.id)}
                              onChange={() => toggleSelectLockedTeacher(t.id)}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          ) : (
                            <span className="text-slate-200 text-xs">•</span>
                          )}
                        </td>

                        {/* Teacher Avatar & Name */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-slate-900 truncate">
                                {t.fullName || "—"}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ID: {t.id.slice(0, 10)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Teacher Code */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {t.teacherCode}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {t.email}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {t.phone || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Exam Count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/80">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            {t.examCount}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <Badge
                            variant={isLocked ? "red" : "green"}
                            size="sm"
                          >
                            {formatUserStatus(t.status)}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Sửa thông tin"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenResetPassword(t)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Đặt lại mật khẩu"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {isLocked ? (
                              <button
                                type="button"
                                onClick={() => handleOpenUnlock(t)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Mở khóa tài khoản"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenLock(t)}
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Khóa tài khoản"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete Button (Requires LOCKED status) */}
                            {isLocked ? (
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(t)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa vĩnh viễn tài khoản (2 bước)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed opacity-40"
                                title="Cần khóa tài khoản trước khi xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (Visible below md) */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {teachers.map((t) => {
                const initials = getInitials(t.fullName, t.email);
                const isLocked = t.status === "LOCKED";

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    {/* Top Row: Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {t.fullName || "—"}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {t.teacherCode}
                            </span>
                            <span className="text-[11px] text-slate-400">&bull;</span>
                            <span className="text-[11px] text-slate-500">
                              {t.examCount} kỳ thi
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={isLocked ? "red" : "green"}
                        size="sm"
                      >
                        {formatUserStatus(t.status)}
                      </Badge>
                    </div>

                    {/* Middle: Email & Phone */}
                    <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono truncate">{t.email}</span>
                      </div>
                      {t.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{t.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Edit2}
                        onClick={() => handleOpenEdit(t)}
                      >
                        Sửa
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={KeyRound}
                        onClick={() => handleOpenResetPassword(t)}
                      >
                        Đổi MK
                      </Button>

                      {isLocked ? (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Unlock}
                          onClick={() => handleOpenUnlock(t)}
                        >
                          Mở khóa
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={Lock}
                          onClick={() => handleOpenLock(t)}
                        >
                          Khóa
                        </Button>
                      )}

                      {isLocked && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          onClick={() => handleOpenDelete(t)}
                        >
                          Xóa
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ===================================================== */}
      {/* MODAL 1: CREATE TEACHER */}
      {/* ===================================================== */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !modalLoading && setIsCreateOpen(false)}
        title="Tạo tài khoản giáo viên"
        description="Nhập thông tin tài khoản để cấp quyền cho giáo viên truy cập hệ thống."
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="create-teacher-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="create-teacher-form"
          onSubmit={handleCreateSubmit}
          className="space-y-4"
        >
          {/* Read-only Role Display */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900">Vai trò hệ thống:</span>
            <Badge variant="blue" size="sm">
              Giáo viên (Bắt buộc)
            </Badge>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={createForm.fullName}
              onChange={(e) =>
                setCreateForm({ ...createForm, fullName: e.target.value })
              }
              placeholder="Ví dụ: Nguyễn Văn An"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã giáo viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={modalLoading}
                value={createForm.teacherCode}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    teacherCode: e.target.value.toUpperCase(),
                  })
                }
                placeholder="GV001"
                className="block w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                disabled={modalLoading}
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
                placeholder="0901234567"
                className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={modalLoading}
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              placeholder="giaovien@school.edu.vn"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu ban đầu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  required
                  disabled={modalLoading}
                  value={createForm.initialPassword}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      initialPassword: e.target.value,
                    })
                  }
                  placeholder="Tối thiểu 8 ký tự"
                  className="block w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCreatePassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Xác nhận mật khẩu <span className="text-rose-500">*</span>
              </label>
              <input
                type={showCreatePassword ? "text" : "password"}
                required
                disabled={modalLoading}
                value={createForm.confirmPassword}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Nhập lại mật khẩu"
                className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 2: EDIT TEACHER */}
      {/* ===================================================== */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => !modalLoading && setIsEditOpen(false)}
        title="Chỉnh sửa thông tin giáo viên"
        description="Cập nhật thông tin định danh và liên hệ của giáo viên."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="edit-teacher-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="edit-teacher-form"
          onSubmit={handleEditSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={editForm.fullName}
              onChange={(e) =>
                setEditForm({ ...editForm, fullName: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã giáo viên
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={editForm.teacherCode}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  teacherCode: e.target.value.toUpperCase(),
                })
              }
              className="block w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập
            </label>
            <input
              type="email"
              required
              disabled={modalLoading}
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Số điện thoại
            </label>
            <input
              type="tel"
              disabled={modalLoading}
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 3: LOCK TEACHER CONFIRMATION */}
      {/* ===================================================== */}
      <Modal
        isOpen={isLockOpen}
        onClose={() => !modalLoading && setIsLockOpen(false)}
        title="Khóa tài khoản giáo viên?"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLockOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              onClick={handleConfirmLock}
            >
              {modalLoading ? "Đang khóa..." : "Khóa tài khoản"}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Bạn có chắc chắn muốn khóa tài khoản của giáo viên{" "}
              <span className="text-rose-600 font-bold">
                {selectedTeacher?.fullName}
              </span>{" "}
              ({selectedTeacher?.teacherCode})?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Giáo viên sẽ không thể đăng nhập hoặc tiếp tục sử dụng hệ thống.
              Các kỳ thi và dữ liệu đã tạo vẫn được giữ nguyên.
            </p>
          </div>
        </div>

        {modalError && (
          <Alert variant="danger" className="mt-4">
            {modalError}
          </Alert>
        )}
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 4: UNLOCK TEACHER CONFIRMATION */}
      {/* ===================================================== */}
      <Modal
        isOpen={isUnlockOpen}
        onClose={() => !modalLoading && setIsUnlockOpen(false)}
        title="Mở khóa tài khoản giáo viên?"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsUnlockOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={modalLoading}
              onClick={handleConfirmUnlock}
            >
              {modalLoading ? "Đang mở..." : "Mở khóa tài khoản"}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Kích hoạt lại tài khoản của giáo viên{" "}
              <span className="text-emerald-700 font-bold">
                {selectedTeacher?.fullName}
              </span>
              ?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tài khoản sẽ được kích hoạt lại và giáo viên có thể đăng nhập.
            </p>
          </div>
        </div>

        {modalError && (
          <Alert variant="danger" className="mt-4">
            {modalError}
          </Alert>
        )}
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 5: RESET PASSWORD */}
      {/* ===================================================== */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => !modalLoading && setIsResetPasswordOpen(false)}
        title="Đặt lại mật khẩu giáo viên"
        description={`Đặt lại mật khẩu mới cho giáo viên "${selectedTeacher?.fullName}". Các phiên đăng nhập hiện tại sẽ bị hủy.`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="reset-password-form"
          onSubmit={handleConfirmResetPassword}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showResetPassword ? "text" : "password"}
                required
                disabled={modalLoading}
                value={resetForm.newPassword}
                onChange={(e) =>
                  setResetForm({ ...resetForm, newPassword: e.target.value })
                }
                placeholder="Tối thiểu 8 ký tự"
                className="block w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showResetPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <input
              type={showResetPassword ? "text" : "password"}
              required
              disabled={modalLoading}
              value={resetForm.confirmPassword}
              onChange={(e) =>
                setResetForm({ ...resetForm, confirmPassword: e.target.value })
              }
              placeholder="Nhập lại mật khẩu mới"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 6: DELETE TEACHER (2-STEP VERIFICATION)         */}
      {/* ===================================================== */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => !modalLoading && setIsDeleteOpen(false)}
        title="Xóa vĩnh viễn tài khoản giáo viên"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              disabled={
                modalLoading ||
                (deleteConfirmText.trim() !== selectedTeacher?.teacherCode &&
                  deleteConfirmText.trim().toUpperCase() !== "XÓA")
              }
              onClick={handleConfirmDelete}
            >
              {modalLoading ? "Đang xóa..." : "Xác nhận xóa vĩnh viễn"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs text-rose-800 leading-relaxed">
              <strong className="block text-sm font-bold text-rose-900 mb-1">
                Cảnh báo nguy hiểm - Bước 1:
              </strong>
              Hành động này sẽ <strong>xóa vĩnh viễn</strong> tài khoản giáo viên, thu hồi toàn bộ phiên đăng nhập và xóa sạch liên kết phân công giảng dạy. Dữ liệu này <strong>không thể khôi phục</strong>.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Họ và tên:</span>
              <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mã giáo viên:</span>
              <strong className="text-rose-700 font-mono">{selectedTeacher?.teacherCode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-700 font-mono">{selectedTeacher?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Trạng thái:</span>
              <Badge variant="red" size="sm">Đã khóa</Badge>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Xác nhận an toàn - Bước 2:
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Để xác nhận, vui lòng gõ đúng mã giáo viên{" "}
              <code className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold">
                {selectedTeacher?.teacherCode}
              </code>{" "}
              hoặc chữ{" "}
              <code className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">
                XÓA
              </code>{" "}
              vào ô bên dưới:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Nhập ${selectedTeacher?.teacherCode || "mã giáo viên"}`}
              className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-600 transition-all"
            />
          </div>

          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 7: BULK DELETE LOCKED TEACHERS                  */}
      {/* ===================================================== */}
      <Modal
        isOpen={isBulkDeleteOpen}
        onClose={() => !modalLoading && setIsBulkDeleteOpen(false)}
        title="Xác nhận xóa hàng loạt giáo viên đã khóa"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBulkDeleteOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              onClick={handleBulkDeleteLocked}
            >
              {modalLoading
                ? "Đang xóa..."
                : `Xác nhận xóa ${selectedLockedTeacherIds.length} giáo viên`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              Bạn đang chuẩn bị xóa vĩnh viễn{" "}
              <strong>{selectedLockedTeacherIds.length} tài khoản giáo viên</strong>{" "}
              đã bị khóa. Toàn bộ thông tin tài khoản và dữ liệu liên quan sẽ bị loại bỏ hoàn toàn khỏi hệ thống.
            </div>
          </div>
          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>
    </div>
  );
}
