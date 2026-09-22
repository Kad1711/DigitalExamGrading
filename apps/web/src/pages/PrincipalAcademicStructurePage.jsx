import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Alert from "../components/ui/Alert";
import {
  BookOpen,
  GraduationCap,
  Users,
  Search,
  RefreshCw,
  Crown,
  Layers,
  Phone,
  Mail,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { getInitials } from "../utils/enum-map";

export default function PrincipalAcademicStructurePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("SUBJECTS"); // "SUBJECTS" | "GRADES"

  const fetchStructure = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get("/principal/academic-structure");
      setData(res.data.data);
    } catch (err) {
      console.error("Failed to load academic structure:", err);
      setErrorMsg(
        err.response?.data?.error?.message ||
          "Không thể tải dữ liệu cơ cấu chuyên môn. Vui lòng thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  const summary = data?.summary || {
    totalTeachers: 0,
    totalSubjects: 0,
    totalClasses: 0,
    totalSubjectLeaders: 0,
  };

  const filteredSubjects = (data?.subjectsBreakdown || []).filter((subj) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = subj.name.toLowerCase().includes(q) || subj.code.toLowerCase().includes(q);
    const leaderMatch = subj.leader?.fullName?.toLowerCase().includes(q);
    const teacherMatch = subj.teachers?.some((t) => t.fullName?.toLowerCase().includes(q));
    return nameMatch || leaderMatch || teacherMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumbs
          items={[
            { label: "Trang chủ", href: "/exams" },
            { label: "Cơ cấu chuyên môn" },
          ]}
        />

        {/* Page Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
                <Crown className="w-6 h-6" />
              </span>
              <span>Cơ cấu chuyên môn & Phân công giảng dạy</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Báo cáo tổng hợp cơ cấu tổ bộ môn, tổ trưởng chuyên môn và phân bổ giảng dạy khối 6–9.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStructure}
            disabled={loading}
            className="gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : ""}`} />
            <span>Làm mới số liệu</span>
          </Button>
        </div>

        {errorMsg && (
          <Alert variant="danger" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                Tổ chuyên môn
              </span>
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <BookOpen className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{summary.totalSubjects}</div>
            <div className="text-xs text-slate-500 mt-1">Bộ môn giảng dạy</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Tổ trưởng bộ môn
              </span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Crown className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{summary.totalSubjectLeaders}</div>
            <div className="text-xs text-slate-500 mt-1">Phụ trách chuyên môn tổ</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                Đội ngũ giáo viên
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <GraduationCap className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{summary.totalTeachers}</div>
            <div className="text-xs text-slate-500 mt-1">Giáo viên đang công tác</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Tổng số lớp học
              </span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Users className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">{summary.totalClasses}</div>
            <div className="text-xs text-slate-500 mt-1">Các lớp thuộc khối 6 đến 9</div>
          </div>
        </div>

        {/* View Selection Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("SUBJECTS")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "SUBJECTS"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Tổ chuyên môn & Giáo viên</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("GRADES")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "GRADES"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Cơ cấu Khối lớp (6–9)</span>
            </button>
          </div>

          {activeTab === "SUBJECTS" && (
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tổ, tổ trưởng hoặc GV..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
              />
            </div>
          )}
        </div>

        {/* CONTENT TAB 1: SUBJECTS / TỔ CHUYÊN MÔN */}
        {activeTab === "SUBJECTS" && (
          <div className="space-y-6">
            {loading ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Đang tổng hợp dữ liệu cơ cấu chuyên môn...</p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Không tìm thấy tổ chuyên môn phù hợp"
                description="Không có môn học hoặc giáo viên nào khớp với từ khóa tìm kiếm."
              />
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredSubjects.map((subj) => (
                  <div
                    key={subj.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                  >
                    {/* Subject Header */}
                    <div className="bg-linear-to-r from-slate-50 to-purple-50/30 p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-lg font-bold text-slate-900">
                            Tổ Bộ Môn: {subj.name}
                          </h2>
                          <Badge variant="neutral" size="sm">
                            {subj.code}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Tổng số: <strong className="text-slate-800">{subj.teacherCount}</strong> giáo viên phụ trách | Phân công tại <strong className="text-slate-800">{subj.assignedClassCount}</strong> lớp
                        </p>
                      </div>

                      {/* Leader Highlight */}
                      <div>
                        {subj.leader ? (
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                            <span className="p-1 rounded-lg bg-amber-100 text-amber-700">
                              <Crown className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                                Tổ trưởng chuyên môn
                              </div>
                              <div className="text-xs font-bold text-slate-900">
                                {subj.leader.fullName}
                                <span className="font-mono font-normal text-slate-500 ml-1.5">
                                  ({subj.leader.teacherCode})
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic bg-slate-100 px-3 py-1.5 rounded-xl">
                            Chưa phân công Tổ trưởng
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Teachers Table in this Subject */}
                    {subj.teachers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Chưa có giáo viên nào được phân công hoặc đặt làm môn chính cho tổ này.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-50/60 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                            <tr>
                              <th className="py-3 px-4 sm:px-6">Giáo viên</th>
                              <th className="py-3 px-4">Chức danh</th>
                              <th className="py-3 px-4">Các lớp đang giảng dạy ({subj.name})</th>
                              <th className="py-3 px-4 text-right">Liên hệ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {subj.teachers.map((t) => {
                              const initials = getInitials(t.fullName, t.email);
                              return (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 sm:px-6">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0">
                                        {initials}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                          <span>{t.fullName}</span>
                                          {t.isLeaderOfThisSubject && (
                                            <Crown className="w-3.5 h-3.5 text-amber-500" title="Tổ trưởng chuyên môn" />
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                          {t.teacherCode}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {t.isLeaderOfThisSubject ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                                        ⭐ Tổ trưởng chuyên môn
                                      </span>
                                    ) : (
                                      <Badge variant="blue" size="sm">
                                        Giáo viên
                                      </Badge>
                                    )}
                                  </td>

                                  <td className="py-3 px-4">
                                    {t.assignedClasses.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {t.assignedClasses.map((c) => (
                                          <span
                                            key={c.id}
                                            className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                                          >
                                            {c.name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">
                                        Chưa phân công lớp dạy môn này
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-3 text-xs text-slate-600">
                                      {t.phone && (
                                        <span className="inline-flex items-center gap-1 text-slate-500">
                                          <Phone className="w-3 h-3 text-slate-400" />
                                          {t.phone}
                                        </span>
                                      )}
                                      <span className="font-mono text-slate-500">{t.email}</span>
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENT TAB 2: GRADES / KHỐI LỚP 6-9 */}
        {activeTab === "GRADES" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(data?.grades || []).map((grade) => (
                <div
                  key={grade.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-base">
                        K{grade.level}
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          Khối {grade.level} (THCS)
                        </h3>
                        <p className="text-xs text-slate-500">
                          {grade.classes?.length || 0} lớp học chính khóa
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(grade.classes || []).map((cls) => (
                      <div
                        key={cls.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-purple-50/40 hover:border-purple-200 transition-all"
                      >
                        <div className="font-bold text-slate-900 text-sm">{cls.name}</div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{cls._count?.students || 0} học sinh</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          <span>{cls._count?.teachingAssignments || 0} môn phân công</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
