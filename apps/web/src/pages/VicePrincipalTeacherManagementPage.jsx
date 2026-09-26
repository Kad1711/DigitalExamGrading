import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  Search,
  Edit2,
  BookOpen,
  GraduationCap,
  School,
  CheckSquare,
  Square,
  Save,
  Loader2,
  X,
  Info,
  Award,
  UserCheck,
} from "lucide-react";
import { getInitials } from "../utils/enum-map";

const TEACHER_TITLES = [
  "Giáo viên",
  "Tổ trưởng chuyên môn",
];

export default function VicePrincipalTeacherManagementPage() {
  const { user } = useAuth();
  const isVicePrincipal = user?.role === "VICE_PRINCIPAL";
  const isAdmin = user?.role === "SUPER_ADMIN";

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState(null);

  // Professional info modal
  const [profModal, setProfModal] = useState(null); // { teacher }
  const [profForm, setProfForm] = useState({ title: "", primarySubjectId: "" });
  const [savingProf, setSavingProf] = useState(false);
  const [profError, setProfError] = useState("");

  // Assignment modal
  const [assignModal, setAssignModal] = useState(null); // { teacher }
  const [assignedClassIds, setAssignedClassIds] = useState([]);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignError, setAssignError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [teacherRes, subjectRes, classRes] = await Promise.all([
        api.get("/admin/teachers"),
        api.get("/subjects"),
        api.get("/classes"),
      ]);
      setTeachers(teacherRes.data.data || []);
      setSubjects(subjectRes.data.data || []);
      setClasses(classRes.data.data || []);
    } catch (err) {
      setAlert({
        type: "danger",
        message:
          err.response?.data?.error?.message ||
          "Không thể tải dữ liệu. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (alert && (alert.type === "success" || alert.variant === "success")) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // ─── Professional Modal ────────────────────────────────────────────────────
  const openProfModal = (teacher) => {
    setProfModal(teacher);
    setProfForm({
      title: teacher.title || "Giáo viên",
      primarySubjectId: teacher.primarySubjectId || "",
    });
    setProfError("");
  };

  const handleSaveProf = async () => {
    if (!profForm.title.trim()) {
      setProfError("Chức danh không được để trống.");
      return;
    }
    try {
      setSavingProf(true);
      setProfError("");
      const isLeader = profForm.title.includes("Tổ trưởng");
      await api.patch(`/admin/teachers/${profModal.id}`, {
        title: profForm.title.trim(),
        isSubjectLeader: isLeader,
        primarySubjectId: profForm.primarySubjectId || null,
      });
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === profModal.id
            ? {
                ...t,
                title: profForm.title.trim(),
                isSubjectLeader: isLeader,
                primarySubjectId: profForm.primarySubjectId || null,
                primarySubject: subjects.find(
                  (s) => s.id === profForm.primarySubjectId
                ) || null,
              }
            : t
        )
      );
      setAlert({
        type: "success",
        message: `Đã cập nhật chuyên môn cho giáo viên "${profModal.fullName}".`,
      });
      setProfModal(null);
    } catch (err) {
      setProfError(
        err.response?.data?.error?.message || "Không thể cập nhật chuyên môn."
      );
    } finally {
      setSavingProf(false);
    }
  };

  // ─── Assignment Modal ──────────────────────────────────────────────────────
  const openAssignModal = async (teacher) => {
    setAssignModal(teacher);
    setAssignError("");
    const subjectIdForTeacher = teacher.primarySubjectId || "";
    setAssignSubjectId(subjectIdForTeacher);
    try {
      const res = await api.get(`/admin/teachers/${teacher.id}/assignments`);
      const data = res.data.data || {};
      const allAssignments = data.assignments || [];
      const relevantClassIds = subjectIdForTeacher
        ? allAssignments.filter((a) => a.subjectId === subjectIdForTeacher).map((a) => a.classId)
        : allAssignments.map((a) => a.classId);
      setAssignedClassIds(relevantClassIds);
      if (!subjectIdForTeacher && allAssignments[0]?.subjectId) {
        setAssignSubjectId(allAssignments[0].subjectId);
      }
    } catch {
      setAssignedClassIds([]);
    }
  };

  const toggleClass = (classId) => {
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
      await api.put(`/admin/teachers/${assignModal.id}/assignments`, {
        classIds: assignedClassIds,
        subjectId: assignSubjectId,
        removeOtherSubjects: true,
      });
      // Refresh teacher data
      await fetchAll();
      setAlert({
        type: "success",
        message: `Đã cập nhật phân công lớp cho giáo viên "${assignModal.fullName}".`,
      });
      setAssignModal(null);
    } catch (err) {
      setAssignError(
        err.response?.data?.error?.message || "Không thể cập nhật phân công."
      );
    } finally {
      setSavingAssign(false);
    }
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filteredTeachers = teachers.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (t.fullName || "").toLowerCase().includes(term) ||
      (t.teacherCode || "").toLowerCase().includes(term) ||
      (t.primarySubject?.name || "").toLowerCase().includes(term) ||
      (t.title || "").toLowerCase().includes(term)
    );
  });

  // Group classes by grade for assignment modal
  const classesByGrade = classes.reduce((acc, cls) => {
    const gradeLabel = cls.grade?.name
      ? `Khối ${cls.grade.name}`
      : "Không xác định";
    if (!acc[gradeLabel]) acc[gradeLabel] = [];
    acc[gradeLabel].push(cls);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            Quản lý Chuyên môn Giáo viên
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật chức danh, môn chuyên môn và phân công giảng dạy cho từng
            giáo viên.
          </p>
        </div>

        {alert && (alert.message || alert.title) && (
          <div className="mb-5">
            <Alert
              variant={alert.type || alert.variant || "info"}
              onClose={() => setAlert(null)}
            >
              {alert.message}
            </Alert>
          </div>
        )}

        {/* Info banner for VICE_PRINCIPAL */}
        {isVicePrincipal && (
          <div className="mb-5 flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
            <div>
              <p className="font-semibold">Quyền của Phó Hiệu trưởng (Chuyên môn)</p>
              <p className="text-xs mt-0.5 text-indigo-700">
                Bạn có thể cập nhật{" "}
                <strong>chức danh, môn chuyên môn và phân công lớp</strong>{" "}
                cho giáo viên. Để quản lý tài khoản (khóa/mở, đổi mật khẩu),
                vui lòng liên hệ Quản trị viên.
              </p>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã GV, môn học, chức danh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
            {filteredTeachers.length} giáo viên
          </span>
        </div>

        {/* Teacher Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">
              Đang tải danh sách giáo viên...
            </span>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Không tìm thấy giáo viên"
            description="Không có giáo viên nào phù hợp với từ khóa tìm kiếm."
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Giáo viên</th>
                    <th className="py-3.5 px-4 text-center">Chức danh</th>
                    <th className="py-3.5 px-4 text-center">Môn chuyên môn</th>
                    <th className="py-3.5 px-4 text-center">Lớp phân công</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTeachers.map((teacher) => {
                    const initials = getInitials(
                      teacher.fullName,
                      teacher.user?.email
                    );
                    const assignmentCount = teacher.assignments?.length || 0;
                    return (
                      <tr
                        key={teacher.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Teacher Info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 leading-tight">
                                {teacher.fullName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {teacher.teacherCode || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-4 px-4 text-center">
                          {teacher.isSubjectLeader ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                              ⭐ Tổ trưởng chuyên môn
                            </span>
                          ) : (
                            <Badge variant="blue" size="sm">
                              Giáo viên
                            </Badge>
                          )}
                        </td>

                        {/* Primary Subject */}
                        <td className="py-4 px-4 text-center">
                          {teacher.primarySubject ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                              <BookOpen className="w-3 h-3" />
                              {teacher.primarySubject.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Chưa đặt
                            </span>
                          )}
                        </td>

                        {/* Assigned Classes */}
                        <td className="py-4 px-4 text-center">
                          {assignmentCount > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-slate-700">
                                {assignmentCount} lớp
                              </span>
                              <div className="flex flex-wrap justify-center gap-1 max-w-[200px]">
                                {(teacher.assignments || [])
                                  .slice(0, 3)
                                  .map((a) => (
                                    <span
                                      key={a.classId || a.id}
                                      className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-medium"
                                    >
                                      {a.class?.name || a.className}
                                    </span>
                                  ))}
                                {assignmentCount > 3 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{assignmentCount - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Chưa phân công
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Edit2}
                              onClick={() => openProfModal(teacher)}
                              title="Chỉnh sửa chức danh và môn chuyên môn"
                            >
                              Chuyên môn
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon={School}
                              onClick={() => openAssignModal(teacher)}
                              title="Phân công lớp giảng dạy"
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                            >
                              Phân công
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* Professional Info Modal                                              */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {profModal && (
        <Modal
          isOpen={!!profModal}
          onClose={() => !savingProf && setProfModal(null)}
          title={`Chỉnh sửa chuyên môn — ${profModal.fullName}`}
        >
          <div className="space-y-5 py-1">
            {profError && (
              <Alert
                variant="danger"
                onClose={() => setProfError("")}
              >
                {profError}
              </Alert>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <Award className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                Chức danh
              </label>
              <select
                value={profForm.title}
                onChange={(e) =>
                  setProfForm((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {TEACHER_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Chức danh chuyên môn — không ảnh hưởng đến quyền hệ thống.
              </p>
            </div>

            {/* Primary Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <BookOpen className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                Môn chuyên môn chính
              </label>
              <select
                value={profForm.primarySubjectId}
                onChange={(e) =>
                  setProfForm((p) => ({
                    ...p,
                    primarySubjectId: e.target.value,
                  }))
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Chưa chọn —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Xác định môn thi mà giáo viên có thể tạo đề kiểm tra.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProfModal(null)}
                disabled={savingProf}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                loading={savingProf}
                onClick={handleSaveProf}
              >
                Lưu chuyên môn
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* Teaching Assignment Modal                                            */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {assignModal && (
        <Modal
          isOpen={!!assignModal}
          onClose={() => !savingAssign && setAssignModal(null)}
          title={`Phân công lớp — ${assignModal.fullName}`}
          size="lg"
        >
          <div className="space-y-5 py-1">
            {assignError && (
              <Alert
                variant="danger"
                onClose={() => setAssignError("")}
              >
                {assignError}
              </Alert>
            )}

            {/* Subject for assignment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <BookOpen className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                Môn học phân công {assignModal?.primarySubject ? `(Môn chính: ${assignModal.primarySubject.name})` : ""}
              </label>
              <select
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Chọn môn học —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""} {s.id === assignModal?.primarySubjectId ? "★ (Môn chuyên môn chính)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Class checkboxes grouped by grade */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                <School className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                Lớp được phân công ({assignedClassIds.length} đã chọn)
              </label>

              {Object.keys(classesByGrade).length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  Không có lớp nào trong hệ thống.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-4 border border-slate-200 rounded-lg p-3">
                  {Object.entries(classesByGrade)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([grade, gradeClasses]) => (
                      <div key={grade}>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          {grade}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {gradeClasses
                            .sort((a, b) =>
                              (a.name || "").localeCompare(b.name || "")
                            )
                            .map((cls) => {
                              const checked = assignedClassIds.includes(cls.id);
                              return (
                                <button
                                  key={cls.id}
                                  type="button"
                                  onClick={() => toggleClass(cls.id)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-left ${
                                    checked
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-800"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {checked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                  <span className="truncate">{cls.name}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <p className="text-[11px] text-slate-400 mt-1.5">
                Tất cả phân công hiện có của giáo viên sẽ được thay thế bằng danh
                sách này.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModal(null)}
                disabled={savingAssign}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                loading={savingAssign}
                onClick={handleSaveAssignments}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Lưu phân công
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
