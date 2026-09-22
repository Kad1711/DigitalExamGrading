import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import TeacherModals from "../components/admin/TeacherModals";
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
  School,
  CheckSquare,
  Square,
  Save,
} from "lucide-react";
import { formatUserStatus, getInitials } from "../utils/enum-map";

function maskEmail(email) {
  if (!email) return "—";
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return "••••••••";
  const user = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (user.length <= 3) {
    return `${user.slice(0, 1)}***${domain}`;
  }
  return `${user.slice(0, 3)}***${domain}`;
}

function maskPhone(phone) {
  if (!phone) return "—";
  const clean = String(phone).trim();
  if (clean.length <= 4) return "••••••";
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

export default function AdminTeacherListPage() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [alert, setAlert] = useState(null);

  // Assignment modal states
  const [assignTeacher, setAssignTeacher] = useState(null);
  const [assignedClassIds, setAssignedClassIds] = useState([]);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Masked contact info states
  const [visibleEmails, setVisibleEmails] = useState({});
  const [visiblePhones, setVisiblePhones] = useState({});

  const toggleEmailVisibility = (id) => {
    setVisibleEmails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePhoneVisibility = (id) => {
    setVisiblePhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLockOpen, setIsLockOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedLockedTeacherIds, setSelectedLockedTeacherIds] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: "",
    subject: "",
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
    title: "Giáo viên",
    primarySubjectId: "",
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

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [subRes, clsRes] = await Promise.all([
          api.get("/subjects"),
          api.get("/classes"),
        ]);
        setSubjects(subRes.data.data || []);
        setClasses(clsRes.data.data || []);
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    }
    loadMetadata();
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setCreateForm({
      fullName: "",
      subject: "",
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

  const handleSubjectChange = async (subjectCode) => {
    setCreateForm((prev) => ({
      ...prev,
      subject: subjectCode,
    }));

    if (subjectCode) {
      try {
        const res = await api.get(`/auth/next-teacher-code?subject=${encodeURIComponent(subjectCode)}`);
        if (res.data?.data?.nextTeacherCode) {
          setCreateForm((prev) => ({
            ...prev,
            subject: subjectCode,
            teacherCode: res.data.data.nextTeacherCode,
          }));
        }
      } catch (err) {
        console.warn("Could not fetch next teacher code:", err);
      }
    }
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
        subject: createForm.subject?.trim() || null,
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
      title: t.title || "Giáo viên",
      primarySubjectId: t.primarySubjectId || "",
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
        title: editForm.title?.trim() || "Giáo viên",
        primarySubjectId: editForm.primarySubjectId || null,
      });

      setIsEditOpen(false);
      setAlert({
        type: "success",
        message: `Đã cập nhật thông tin và chuyên môn giáo viên "${fullName}".`,
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

  // Open Assignment Modal
  const handleOpenAssign = async (t) => {
    setAssignTeacher(t);
    setAssignError("");
    try {
      const res = await api.get(`/admin/teachers/${t.id}/assignments`);
      const data = res.data.data || {};
      const existingClassIds = (data.assignments || []).map((a) => a.classId);
      setAssignedClassIds(existingClassIds);
      setAssignSubjectId(
        data.assignments?.[0]?.subjectId || t.primarySubjectId || ""
      );
    } catch {
      setAssignedClassIds([]);
      setAssignSubjectId(t.primarySubjectId || "");
    }
  };

  const toggleAssignClass = (classId) => {
    setAssignedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!assignSubjectId) {
      setAssignError("Vui lòng chọn môn học cho phân công.");
      return;
    }
    try {
      setSavingAssign(true);
      setAssignError("");
      await api.put(`/admin/teachers/${assignTeacher.id}/assignments`, {
        classIds: assignedClassIds,
        subjectId: assignSubjectId,
      });
      setAlert({
        type: "success",
        message: `Đã cập nhật phân công lớp cho giáo viên "${assignTeacher.fullName}".`,
      });
      setAssignTeacher(null);
      fetchTeachers();
    } catch (err) {
      setAssignError(
        err.response?.data?.error?.message || "Không thể cập nhật phân công."
      );
    } finally {
      setSavingAssign(false);
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

  // Open Approve Modal
  const handleOpenApprove = (t) => {
    setSelectedTeacher(t);
    setModalError("");
    setIsApproveOpen(true);
  };

  const handleConfirmApprove = async () => {
    try {
      setModalLoading(true);
      await api.post(`/admin/teachers/${selectedTeacher.id}/approve`);
      setIsApproveOpen(false);
      setAlert({
        type: "success",
        message: `Đã phê duyệt thành công tài khoản giáo viên "${selectedTeacher.fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message || "Không thể phê duyệt tài khoản giáo viên."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (t) => {
    setSelectedTeacher(t);
    setModalError("");
    setIsRejectOpen(true);
  };

  const handleConfirmReject = async () => {
    try {
      setModalLoading(true);
      await api.post(`/admin/teachers/${selectedTeacher.id}/reject`);
      setIsRejectOpen(false);
      setAlert({
        type: "warning",
        message: `Đã từ chối yêu cầu đăng ký của "${selectedTeacher.fullName}".`,
      });
      fetchTeachers();
    } catch (err) {
      setModalError(
        err.response?.data?.error?.message || "Không thể từ chối tài khoản giáo viên."
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
              onClick={() => setStatusFilter("PENDING_APPROVAL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                statusFilter === "PENDING_APPROVAL"
                  ? "bg-white text-amber-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chờ phê duyệt
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
                    <th className="py-3.5 px-4 text-center">Chức danh</th>
                    <th className="py-3.5 px-4 text-center">Môn chuyên môn</th>
                    <th className="py-3.5 px-4 text-center">Phân công lớp</th>
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
                    const assignmentCount = t.assignments?.length || 0;

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
                            </div>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Badge variant="blue" size="sm">
                            {t.title || "Giáo viên"}
                          </Badge>
                        </td>

                        {/* Primary Subject */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {t.primarySubject ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <BookOpen className="w-3 h-3" />
                              {t.primarySubject.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Chưa đặt
                            </span>
                          )}
                        </td>

                        {/* Class Assignment */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAssign(t)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Bấm để chỉnh sửa phân công lớp"
                          >
                            <School className="w-3.5 h-3.5" />
                            <span>
                              {assignmentCount > 0 ? `${assignmentCount} lớp` : "Phân công"}
                            </span>
                          </button>
                        </td>

                        {/* Teacher Code */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {t.teacherCode}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {t.email ? (
                            <div className="flex items-center gap-1.5">
                              <span>
                                {visibleEmails[t.id] ? t.email : maskEmail(t.email)}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleEmailVisibility(t.id)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                                title={visibleEmails[t.id] ? "Ẩn email" : "Hiện email"}
                              >
                                {visibleEmails[t.id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {t.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span>
                                {visiblePhones[t.id] ? t.phone : maskPhone(t.phone)}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePhoneVisibility(t.id)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                                title={visiblePhones[t.id] ? "Ẩn số điện thoại" : "Hiện số điện thoại"}
                              >
                                {visiblePhones[t.id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
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
                            variant={
                              t.status === "PENDING_APPROVAL"
                                ? "amber"
                                : isLocked
                                ? "red"
                                : "green"
                            }
                            size="sm"
                          >
                            {formatUserStatus(t.status)}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          {t.status === "PENDING_APPROVAL" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="success"
                                onClick={() => handleOpenApprove(t)}
                              >
                                Phê duyệt
                              </Button>
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => handleOpenReject(t)}
                              >
                                Từ chối
                              </Button>
                            </div>
                          ) : (
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
                          )}
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
                        variant={
                          t.status === "PENDING_APPROVAL"
                            ? "amber"
                            : isLocked
                            ? "red"
                            : "green"
                        }
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
                      {t.status === "PENDING_APPROVAL" ? (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleOpenApprove(t)}
                          >
                            Phê duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleOpenReject(t)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* All Teacher Management Modals */}
      <TeacherModals
        isCreateOpen={isCreateOpen}
        setIsCreateOpen={setIsCreateOpen}
        createForm={createForm}
        setCreateForm={setCreateForm}
        handleCreateSubmit={handleCreateSubmit}
        handleSubjectChange={handleSubjectChange}
        showCreatePassword={showCreatePassword}
        setShowCreatePassword={setShowCreatePassword}

        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        handleEditSubmit={handleEditSubmit}
        subjects={subjects}

        isResetPasswordOpen={isResetPasswordOpen}
        setIsResetPasswordOpen={setIsResetPasswordOpen}
        resetForm={resetForm}
        setResetForm={setResetForm}
        handleConfirmResetPassword={handleConfirmResetPassword}
        showResetPassword={showResetPassword}
        setShowResetPassword={setShowResetPassword}

        isLockOpen={isLockOpen}
        setIsLockOpen={setIsLockOpen}
        handleConfirmLock={handleConfirmLock}

        isUnlockOpen={isUnlockOpen}
        setIsUnlockOpen={setIsUnlockOpen}
        handleConfirmUnlock={handleConfirmUnlock}

        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        handleConfirmDelete={handleConfirmDelete}

        isBulkDeleteOpen={isBulkDeleteOpen}
        setIsBulkDeleteOpen={setIsBulkDeleteOpen}
        selectedLockedTeacherIds={selectedLockedTeacherIds}
        handleBulkDeleteLocked={handleBulkDeleteLocked}

        isApproveOpen={isApproveOpen}
        setIsApproveOpen={setIsApproveOpen}
        handleConfirmApprove={handleConfirmApprove}

        isRejectOpen={isRejectOpen}
        setIsRejectOpen={setIsRejectOpen}
        handleConfirmReject={handleConfirmReject}

        selectedTeacher={selectedTeacher}
        modalLoading={modalLoading}
        modalError={modalError}
      />

      {/* Teaching Assignment Modal */}
      <Modal
        isOpen={Boolean(assignTeacher)}
        onClose={() => !savingAssign && setAssignTeacher(null)}
        title={`Phân công giảng dạy: ${assignTeacher?.fullName || ""}`}
        description="Chọn môn học và các lớp được phân công cho giáo viên."
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAssignTeacher(null)}
              disabled={savingAssign}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              icon={Save}
              loading={savingAssign}
              onClick={handleSaveAssignments}
            >
              Lưu phân công
            </Button>
          </>
        }
      >
        {assignError && (
          <Alert variant="danger" className="mb-4">
            {assignError}
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Môn học phân công <span className="text-rose-500">*</span>
            </label>
            <select
              value={assignSubjectId}
              onChange={(e) => setAssignSubjectId(e.target.value)}
              className="block w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="">-- Chọn môn học --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Chọn các lớp giảng dạy ({assignedClassIds.length} lớp đã chọn)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAssignedClassIds(classes.map((c) => c.id))}
                  className="text-blue-600 hover:underline cursor-pointer font-medium"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setAssignedClassIds([])}
                  className="text-slate-500 hover:underline cursor-pointer"
                >
                  Bỏ chọn hết
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
              {classes.map((c) => {
                const checked = assignedClassIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleAssignClass(c.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold border text-left transition-all cursor-pointer ${
                      checked
                        ? "bg-blue-50 text-blue-800 border-blue-300 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
