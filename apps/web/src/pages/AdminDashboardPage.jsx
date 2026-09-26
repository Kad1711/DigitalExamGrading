import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import {
  Users,
  GraduationCap,
  FileText,
  ScanLine,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  BarChart3,
  Server,
  Database,
  Cpu,
  RefreshCw,
  School,
  BookOpen,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Layers,
  Landmark,
  Filter,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { formatExamStatus } from "../utils/enum-map";

/**
 * =========================================================================
 * 1. GIAO DIỆN THỐNG KÊ DÀNH RIÊNG CHO GIÁO VIÊN & TỔ TRƯỞNG CHUYÊN MÔN
 * Chỉ hiển thị các lớp mình được phân công phụ trách & môn học của tổ mình.
 * Tuyệt đối không hiển thị dữ liệu toàn trường của Admin.
 * =========================================================================
 */
function TeacherClassStatisticsView({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [activeTab, setActiveTab] = useState("MY_CLASSES"); // "MY_CLASSES" | "SUBJECT_LEADER"

  const fetchData = useCallback(
    async (isSilent = false, classId = selectedClassId) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await api.get("/teacher/class-statistics", {
          params: classId && classId !== "ALL" ? { classId } : {},
        });
        setData(res.data.data);
      } catch (err) {
        console.error("Failed to load teacher class stats:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedClassId]
  );

  useEffect(() => {
    fetchData(false, selectedClassId);
  }, [selectedClassId, fetchData]);

  const teacherInfo = data?.teacherInfo;
  const isSubjectLeader = teacherInfo?.isSubjectLeader;
  const assignedClasses = data?.assignedClasses || [];
  const stats = data?.stats;
  const exams = data?.exams || [];
  const subjectLeaderData = data?.subjectLeaderData;

  const dist = stats?.scoreDistribution || { excellent: 0, good: 0, average: 0, belowAvg: 0 };
  const totalGraded = stats?.totalGradedSubmissions || 0;
  const pExcellent = totalGraded > 0 ? Math.round((dist.excellent / totalGraded) * 100) : 0;
  const pGood = totalGraded > 0 ? Math.round((dist.good / totalGraded) * 100) : 0;
  const pAvg = totalGraded > 0 ? Math.round((dist.average / totalGraded) * 100) : 0;
  const pBelow = totalGraded > 0 ? Math.round((dist.belowAvg / totalGraded) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <School className="w-4 h-4" />
              <span>
                {isSubjectLeader
                  ? `TỔ TRƯỞNG CHUYÊN MÔN • TỔ ${teacherInfo?.primarySubjectName?.toUpperCase() || "BỘ MÔN"}`
                  : "GIÁO VIÊN BỘ MÔN • LỚP PHỤ TRÁCH"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">
                {teacherInfo?.fullName || user?.fullName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isSubjectLeader && activeTab === "SUBJECT_LEADER"
                ? `Thống Kê Chuyên Môn Môn ${teacherInfo?.primarySubjectName || ""}`
                : "Thống Kê Lớp Học Phụ Trách"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isSubjectLeader && activeTab === "SUBJECT_LEADER"
                ? `Theo dõi chất lượng dạy và học môn ${teacherInfo?.primarySubjectName || ""} trên toàn trường.`
                : "Theo dõi kết quả thi cử, phổ điểm và tiến độ học tập của các lớp học bạn được phân công giảng dạy."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true, selectedClassId)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin text-blue-600" : ""}`}
              />
              <span>{refreshing ? "Đang cập nhật..." : "Làm mới"}</span>
            </button>
          </div>
        </div>

        {/* Tab switch for Subject Leader */}
        {isSubjectLeader && (
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6">
            <button
              onClick={() => setActiveTab("MY_CLASSES")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "MY_CLASSES"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <School className="w-4 h-4" />
              <span>Lớp học tôi phụ trách</span>
            </button>
            <button
              onClick={() => setActiveTab("SUBJECT_LEADER")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "SUBJECT_LEADER"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Báo cáo Tổ bộ môn {teacherInfo?.primarySubjectName}</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-500">Đang tổng hợp dữ liệu lớp học...</p>
          </div>
        ) : activeTab === "SUBJECT_LEADER" && isSubjectLeader ? (
          /* SUBJECT LEADER VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Tổng số bài thi môn</span>
                <div className="text-3xl font-black text-slate-900 mt-2">
                  {subjectLeaderData?.totalSubjectExams || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">Bài thi được tổ chức toàn trường</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Bài nộp đã chấm</span>
                <div className="text-3xl font-black text-slate-900 mt-2">
                  {subjectLeaderData?.totalGradedSubmissions || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">Bài thi học sinh toàn trường</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Điểm trung bình toàn trường</span>
                <div className="text-3xl font-black text-blue-600 mt-2">
                  {subjectLeaderData?.schoolWideAverageScore ?? "---"}
                </div>
                <div className="text-xs text-slate-500 mt-1">Thang điểm 10</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                So sánh điểm trung bình giữa các lớp học (Môn {teacherInfo?.primarySubjectName})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Lớp học</th>
                      <th className="py-3 px-4 text-center">Số bài thi đã chấm</th>
                      <th className="py-3 px-4 text-center">Điểm trung bình</th>
                      <th className="py-3 px-4 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(subjectLeaderData?.classesComparison || []).map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.className}</td>
                        <td className="py-3 px-4 text-center text-slate-600">{c.gradedCount} bài</td>
                        <td className="py-3 px-4 text-center font-black text-slate-900">
                          {c.averageScore !== null ? `${c.averageScore} / 10` : "---"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.averageScore >= 8.0 ? (
                            <Badge variant="success">Xuất sắc</Badge>
                          ) : c.averageScore >= 6.5 ? (
                            <Badge variant="info">Khá giỏi</Badge>
                          ) : c.averageScore >= 5.0 ? (
                            <Badge variant="warning">Đạt chuẩn</Badge>
                          ) : (
                            <Badge variant="danger">Cần cải thiện</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TEACHER CLASS VIEW */
          <div className="space-y-6">
            {/* Class Selector Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-blue-600" />
                  Chọn lớp phụ trách:
                </span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="ALL">Tất cả lớp phụ trách ({assignedClasses.length} lớp)</option>
                  {assignedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} HS) - {c.subjectName || "Bộ môn"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Hiển thị số liệu của:{" "}
                <strong className="text-slate-800 font-semibold">
                  {selectedClassId === "ALL"
                    ? `Tất cả ${assignedClasses.length} lớp được phân công`
                    : assignedClasses.find((c) => c.id === selectedClassId)?.name}
                </strong>
              </div>
            </div>

            {assignedClasses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-base mb-1">
                  Bạn chưa được phân công lớp học nào
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Vui lòng liên hệ Hiệu phó chuyên môn để được xếp lớp giảng dạy.
                </p>
              </div>
            ) : (
              <>
                {/* 4 Cards KPI of assigned classes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Học sinh phụ trách</span>
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-3">
                      {stats?.totalStudents || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Sĩ số thực tế trong lớp</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Số bài kiểm tra</span>
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-3">
                      {stats?.totalExams || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {stats?.totalGradedSubmissions || 0} bài thi đã chấm
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Điểm trung bình</span>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Award className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-blue-600 mt-3">
                      {stats?.averageScore !== null ? `${stats.averageScore} / 10` : "---"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Điểm TB các bài kiểm tra</div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Tỷ lệ đạt chuẩn</span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-3">
                      {stats?.passRate || 0}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Học sinh đạt từ 5.0 trở lên</div>
                  </div>
                </div>

                {/* Score Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Phổ điểm & Phân loại học lực lớp phụ trách
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tổng số {totalGraded} bài kiểm tra đã được chấm
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-xs font-bold text-emerald-800">Giỏi (8.0 - 10.0)</span>
                      <div className="text-2xl font-black text-emerald-700 mt-1">
                        {dist.excellent} <span className="text-xs font-normal">({pExcellent}%)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
                      <span className="text-xs font-bold text-blue-800">Khá (6.5 - 7.9)</span>
                      <div className="text-2xl font-black text-blue-700 mt-1">
                        {dist.good} <span className="text-xs font-normal">({pGood}%)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                      <span className="text-xs font-bold text-amber-800">Trung bình (5.0 - 6.4)</span>
                      <div className="text-2xl font-black text-amber-700 mt-1">
                        {dist.average} <span className="text-xs font-normal">({pAvg}%)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100">
                      <span className="text-xs font-bold text-rose-800">Dưới TB (&lt; 5.0)</span>
                      <div className="text-2xl font-black text-rose-700 mt-1">
                        {dist.belowAvg} <span className="text-xs font-normal">({pBelow}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress visualizer */}
                  {totalGraded > 0 && (
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mt-2">
                      <div
                        style={{ width: `${pExcellent}%` }}
                        className="bg-emerald-500 h-full"
                        title={`Giỏi: ${pExcellent}%`}
                      />
                      <div
                        style={{ width: `${pGood}%` }}
                        className="bg-blue-500 h-full"
                        title={`Khá: ${pGood}%`}
                      />
                      <div
                        style={{ width: `${pAvg}%` }}
                        className="bg-amber-500 h-full"
                        title={`TB: ${pAvg}%`}
                      />
                      <div
                        style={{ width: `${pBelow}%` }}
                        className="bg-rose-500 h-full"
                        title={`Dưới TB: ${pBelow}%`}
                      />
                    </div>
                  )}
                </div>

                {/* Exam List of assigned classes */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Danh sách bài kiểm tra & kỳ thi
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Các bài kiểm tra áp dụng cho lớp bạn phụ trách
                      </p>
                    </div>
                  </div>

                  {exams.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Chưa có bài kiểm tra nào được tổ chức cho lớp này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Tên bài kiểm tra</th>
                            <th className="py-3 px-4">Môn học</th>
                            <th className="py-3 px-4">Lớp thi</th>
                            <th className="py-3 px-4 text-center">Số bài đã chấm</th>
                            <th className="py-3 px-4 text-center">Điểm TB</th>
                            <th className="py-3 px-4 text-right">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {exams.map((ex) => (
                            <tr key={ex.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-900">{ex.title}</td>
                              <td className="py-3 px-4 font-semibold text-slate-700">
                                {ex.subjectName}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{ex.className}</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-800">
                                {ex.submissionsCount}
                              </td>
                              <td className="py-3 px-4 text-center font-black text-blue-600">
                                {ex.averageScore !== null ? `${ex.averageScore} / 10` : "---"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {formatExamStatus(ex.status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * =========================================================================
 * 2. GIAO DIỆN THỐNG KÊ QUẢN TRỊ VIÊN & BAN GIÁM HIỆU TOÀN TRƯỜNG
 * =========================================================================
 */
function AdminDashboardView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isBGH = user?.role === "PRINCIPAL" || user?.role === "VICE_PRINCIPAL";

  const [data, setData] = useState(null);
  const scopeInfo = data?.scopeInfo;
  const isTeacher = user?.role === "TEACHER" || scopeInfo?.isTeacher;
  const isSubjectLeader = scopeInfo?.isSubjectLeader;
  const subjectName = scopeInfo?.subjectName;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Multi-dimensional filter states
  const [selectedGradeId, setSelectedGradeId] = useState("ALL");
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState("ALL");
  const [selectedTeacherId, setSelectedTeacherId] = useState("ALL");

  const fetchDashboardData = useCallback(
    async (isSilent = false, overrides = {}) => {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      try {
        const params = {};
        const gId = overrides.gradeId !== undefined ? overrides.gradeId : selectedGradeId;
        const cId = overrides.classId !== undefined ? overrides.classId : selectedClassId;
        const sId = overrides.subjectId !== undefined ? overrides.subjectId : selectedSubjectId;
        const tId = overrides.teacherId !== undefined ? overrides.teacherId : selectedTeacherId;

        if (gId && gId !== "ALL") params.gradeId = gId;
        if (cId && cId !== "ALL") params.classId = cId;
        if (sId && sId !== "ALL") params.subjectId = sId;
        if (tId && tId !== "ALL") params.teacherId = tId;

        const res = await api.get("/admin/dashboard", { params });
        setData(res.data.data);
      } catch (err) {
        console.error("Failed to load admin dashboard data:", err);
        setError(
          err.response?.data?.error?.message ||
            "Không thể tải dữ liệu thống kê hệ thống. Vui lòng thử lại sau."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedGradeId, selectedClassId, selectedSubjectId, selectedTeacherId]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const overview = data?.overview;
  const tierStats = data?.tierStats;
  const grades = data?.grades || [];
  const subjects = data?.subjects || [];
  const omrStats = data?.omrStats;
  const scoring = overview?.scoring;
  const recentExams = data?.recentExams || [];
  const recentSubmissions = data?.recentSubmissions || [];
  const topTeachers = data?.topTeachers || [];
  const systemHealth = data?.systemHealth;

  // Filter options from API
  const filterGrades = data?.filterOptions?.grades || [];
  const filterClasses = data?.filterOptions?.classes || [];
  const filterSubjects = data?.filterOptions?.subjects || [];
  const filterTeachers = data?.filterOptions?.teachers || [];

  // Filter classes according to selectedGradeId
  const availableClasses = useMemo(() => {
    if (selectedGradeId === "ALL") return filterClasses;
    return filterClasses.filter((c) => c.gradeId === selectedGradeId);
  }, [filterClasses, selectedGradeId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGradeId !== "ALL") count++;
    if (selectedClassId !== "ALL") count++;
    if (selectedSubjectId !== "ALL") count++;
    if (selectedTeacherId !== "ALL") count++;
    return count;
  }, [selectedGradeId, selectedClassId, selectedSubjectId, selectedTeacherId]);

  const handleGradeChange = (newGradeId) => {
    setSelectedGradeId(newGradeId);
    let nextClassId = selectedClassId;
    if (newGradeId !== "ALL") {
      const clsInGrade = filterClasses.filter((c) => c.gradeId === newGradeId);
      if (!clsInGrade.some((c) => c.id === selectedClassId)) {
        nextClassId = "ALL";
        setSelectedClassId("ALL");
      }
    }
    fetchDashboardData(true, { gradeId: newGradeId, classId: nextClassId });
  };

  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    fetchDashboardData(true, { classId: newClassId });
  };

  const handleSubjectChange = (newSubjectId) => {
    setSelectedSubjectId(newSubjectId);
    fetchDashboardData(true, { subjectId: newSubjectId });
  };

  const handleTeacherChange = (newTeacherId) => {
    setSelectedTeacherId(newTeacherId);
    fetchDashboardData(true, { teacherId: newTeacherId });
  };

  const handleResetFilters = () => {
    setSelectedGradeId("ALL");
    setSelectedClassId("ALL");
    setSelectedSubjectId("ALL");
    setSelectedTeacherId("ALL");
    fetchDashboardData(true, {
      gradeId: "ALL",
      classId: "ALL",
      subjectId: "ALL",
      teacherId: "ALL",
    });
  };

  const totalScoreSubmissions = scoring?.gradedCount || 0;
  const dist = scoring?.distribution || {
    excellent: 0,
    good: 0,
    average: 0,
    belowAvg: 0,
  };

  const pExcellent =
    totalScoreSubmissions > 0
      ? Math.round((dist.excellent / totalScoreSubmissions) * 100)
      : 0;
  const pGood =
    totalScoreSubmissions > 0
      ? Math.round((dist.good / totalScoreSubmissions) * 100)
      : 0;
  const pAvg =
    totalScoreSubmissions > 0
      ? Math.round((dist.average / totalScoreSubmissions) * 100)
      : 0;
  const pBelow =
    totalScoreSubmissions > 0
      ? Math.round((dist.belowAvg / totalScoreSubmissions) * 100)
      : 0;

  const totalOmr = omrStats?.total || 0;
  const pCorrect =
    totalOmr > 0 ? Math.round((omrStats.correct / totalOmr) * 100) : 0;
  const pIncorrect =
    totalOmr > 0 ? Math.round((omrStats.incorrect / totalOmr) * 100) : 0;
  const pBlank =
    totalOmr > 0 ? Math.round((omrStats.blank / totalOmr) * 100) : 0;
  const pUnresolved =
    totalOmr > 0 ? Math.round((omrStats.unresolved / totalOmr) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isAdmin
                  ? "BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN"
                  : isTeacher && isSubjectLeader
                  ? `TỔ TRƯỞNG CHUYÊN MÔN - TỔ ${subjectName?.toUpperCase() || "BỘ MÔN"}`
                  : isTeacher
                  ? "GIÁO VIÊN BỘ MÔN - LỚP PHỤ TRÁCH"
                  : "BÁO CÁO & THỐNG KÊ TOÀN DIỆN"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-500 font-normal">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Năm học {overview?.academicYear || "2026-2027"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isAdmin
                ? "Tổng quan & Thống kê hệ thống"
                : isTeacher && isSubjectLeader
                ? `Thống kê Chuyên môn Môn ${subjectName || ""}`
                : isTeacher
                ? "Thống kê Kết quả Lớp phụ trách"
                : "Trung tâm Thống kê & Báo cáo kết quả"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isTeacher && isSubjectLeader
                ? `Theo dõi chất lượng dạy và học, phân bố điểm số và kết quả thi bộ môn ${subjectName || ""} trên toàn trường.`
                : isTeacher
                ? "Theo dõi kết quả thi, phân bố điểm số và tình hình học tập của các lớp được phân công giảng dạy."
                : "Thống kê kết quả thi cử, phân bố điểm số và chấm thi OMR theo khối, lớp, môn học và giáo viên."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${
                  refreshing ? "animate-spin text-blue-600" : ""
                }`}
              />
              <span>{refreshing ? "Đang cập nhật..." : "Làm mới"}</span>
            </button>

            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Landmark}
                  onClick={() => navigate("/admin/management")}
                >
                  Quản lý phòng ban
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  icon={Users}
                  onClick={() => navigate("/admin/teachers")}
                >
                  Quản lý giáo viên
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Multi-Dimensional Filter Bar Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 mb-8 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    Bộ lọc Thống kê Đa chiều
                  </h2>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs">
                      {activeFilterCount} bộ lọc
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lọc số liệu tổng quan, phổ điểm, danh sách kỳ thi và bài nộp theo khối, lớp, môn học hoặc giáo viên
                </p>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>

          {/* 4 Interactive Dropdown Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4">
            {/* Filter 1: Grade (Khối) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Theo Khối</span>
              </label>
              <select
                value={selectedGradeId}
                onChange={(e) => handleGradeChange(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">Tất cả khối học ({filterGrades.length})</option>
                {filterGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Class (Lớp) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Theo Lớp học</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">
                  Tất cả lớp ({availableClasses.length})
                </option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Subject (Môn) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Theo Môn học</span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">Tất cả môn học ({filterSubjects.length})</option>
                {filterSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Teacher (Giáo viên) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                <span>Theo Giáo viên</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="ALL">
                  Tất cả giáo viên ({filterTeachers.length})
                </option>
                {filterTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} {t.teacherCode ? `(${t.teacherCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="xs" variant="secondary" onClick={() => fetchDashboardData()}>
              Thử lại
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-500">
              Đang tổng hợp dữ liệu hệ thống...
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ===================================================== */}
            {/* 1. TOP KPI METRIC CARDS (6 Key Metrics)               */}
            {/* ===================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Card 1: Teachers or Assigned Classes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isTeacher && isSubjectLeader
                      ? `Tổ ${subjectName || "Bộ Môn"}`
                      : isTeacher
                      ? "Lớp phụ trách"
                      : "Giáo viên"}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {isTeacher && !isSubjectLeader
                      ? scopeInfo?.assignedClassCount ?? (overview?.classes.total || 0)
                      : overview?.teachers.total || 0}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    {isTeacher && !isSubjectLeader ? (
                      <span className="text-slate-600 font-medium">Lớp được phân công</span>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-emerald-700">
                          {overview?.teachers.active || 0}
                        </span>{" "}
                        hoạt động
                        {overview?.teachers.locked > 0 && (
                          <span className="text-rose-500 font-semibold ml-1">
                            • {overview?.teachers.locked} khóa
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Card 2: Students */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Học sinh
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {overview?.students.total || 0}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {overview?.students.total || 0}
                    </span>{" "}
                    thực có trong các lớp
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Card 3: Classes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Lớp học
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <School className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {overview?.classes.total || 0}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="font-medium text-slate-600">
                      Toàn bộ cấp THCS (Khối 6 - 9)
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Card 4: Exams */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Kỳ thi
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {overview?.exams.total || 0}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    <span className="font-semibold text-purple-700">
                      {overview?.exams.resultsPublished || 0}
                    </span>{" "}
                    đã công bố điểm
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Card 5: Submissions */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Bài quét OMR
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ScanLine className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {overview?.submissions.total || 0}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="font-semibold text-emerald-700">
                      {overview?.submissions.final || 0}
                    </span>{" "}
                    chính thức
                    {overview?.submissions.needsReview > 0 && (
                      <span className="text-amber-600 font-semibold ml-1">
                        • {overview?.submissions.needsReview} rà soát
                      </span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Card 6: Average Score */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Điểm TB
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {scoring?.averageScore ? `${scoring.averageScore}` : "---"}
                    <span className="text-sm font-normal text-slate-400">/10</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Từ{" "}
                    <span className="font-semibold text-slate-700">
                      {scoring?.gradedCount || 0}
                    </span>{" "}
                    bài đã chấm
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* ===================================================== */}
            {/* 2. THCS & THPT BREAKDOWN & GRADE DISTRIBUTION         */}
            {/* ===================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Grade Levels Chart & Tiers */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      Quy mô Khối lớp & Cấp học
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Phân bổ học sinh và lớp học trên toàn bộ hệ thống THCS (Khối 6, 7, 8, 9)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg">
                      Toàn trường THCS: {overview?.students.total || 0} HS ({overview?.classes.total || 0} lớp)
                    </span>
                  </div>
                </div>

                {/* Grade Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grades.map((g) => {
                    const isThcs = g.tier === "THCS";
                    const maxPossibleStudents =
                      overview?.students.total > 0 ? overview.students.total : 1;
                    const pct = Math.min(
                      100,
                      Math.round((g.studentsCount / maxPossibleStudents) * 100)
                    );

                    return (
                      <div
                        key={g.gradeId}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all group"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isThcs ? "bg-blue-500" : "bg-indigo-500"
                              }`}
                            />
                            <span className="font-extrabold text-slate-800">
                              {g.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isThcs
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-indigo-100 text-indigo-700"
                              }`}
                            >
                              {g.tier}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              {g.studentsCount}
                            </span>{" "}
                            <span className="text-slate-400">HS</span> •{" "}
                            <span className="font-bold text-slate-700">
                              {g.classesCount}
                            </span>{" "}
                            <span className="text-slate-400">lớp</span>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="mt-2.5 w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isThcs ? "bg-blue-500" : "bg-indigo-500"
                            }`}
                            style={{ width: `${Math.max(pct, g.studentsCount > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 1 Col: Score Distribution */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        Phổ điểm toàn trường
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Phân loại kết quả {totalScoreSubmissions} bài chấm OMR
                      </p>
                    </div>
                  </div>

                  {/* Visual Multi-Segment Bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex my-4">
                    <div
                      style={{ width: `${pExcellent}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Giỏi: ${dist.excellent} bài (${pExcellent}%)`}
                    />
                    <div
                      style={{ width: `${pGood}%` }}
                      className="bg-blue-500 h-full transition-all"
                      title={`Khá: ${dist.good} bài (${pGood}%)`}
                    />
                    <div
                      style={{ width: `${pAvg}%` }}
                      className="bg-amber-400 h-full transition-all"
                      title={`Trung bình: ${dist.average} bài (${pAvg}%)`}
                    />
                    <div
                      style={{ width: `${pBelow}%` }}
                      className="bg-rose-500 h-full transition-all"
                      title={`Dưới TB: ${dist.belowAvg} bài (${pBelow}%)`}
                    />
                  </div>

                  {/* Distribution Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          Giỏi (8.0 - 10.0)
                        </span>
                      </div>
                      <div className="text-xs font-black text-emerald-700">
                        {dist.excellent} bài{" "}
                        <span className="font-medium text-slate-400">
                          ({pExcellent}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          Khá (6.5 - 7.9)
                        </span>
                      </div>
                      <div className="text-xs font-black text-blue-700">
                        {dist.good} bài{" "}
                        <span className="font-medium text-slate-400">
                          ({pGood}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          Trung bình (5.0 - 6.4)
                        </span>
                      </div>
                      <div className="text-xs font-black text-amber-700">
                        {dist.average} bài{" "}
                        <span className="font-medium text-slate-400">
                          ({pAvg}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          Dưới TB (&lt; 5.0)
                        </span>
                      </div>
                      <div className="text-xs font-black text-rose-700">
                        {dist.belowAvg} bài{" "}
                        <span className="font-medium text-slate-400">
                          ({pBelow}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Tỷ lệ đạt chuẩn (&ge; 5.0):{" "}
                    <strong className="text-slate-700">
                      {totalScoreSubmissions > 0
                        ? `${100 - pBelow}%`
                        : "---"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* ===================================================== */}
            {/* 3. OMR ACCURACY STATS & SUBJECTS BREAKDOWN            */}
            {/* ===================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* OMR Answers Metrics */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-emerald-600" />
                    Chỉ số Nhận dạng OMR & Đáp án
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tổng hợp {totalOmr.toLocaleString()} câu trắc nghiệm được chấm qua hệ thống AI OMR
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase">
                      Đúng
                    </span>
                    <div className="text-xl font-black text-emerald-800 mt-1">
                      {omrStats?.correct || 0}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {pCorrect}%
                    </span>
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-rose-700 uppercase">
                      Sai
                    </span>
                    <div className="text-xl font-black text-rose-800 mt-1">
                      {omrStats?.incorrect || 0}
                    </div>
                    <span className="text-[11px] font-semibold text-rose-600">
                      {pIncorrect}%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-slate-600 uppercase">
                      Bỏ trống
                    </span>
                    <div className="text-xl font-black text-slate-800 mt-1">
                      {omrStats?.blank || 0}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {pBlank}%
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-amber-700 uppercase">
                      Tô lỗi / Mờ
                    </span>
                    <div className="text-xl font-black text-amber-800 mt-1">
                      {omrStats?.unresolved || 0}
                    </div>
                    <span className="text-[11px] font-semibold text-amber-600">
                      {pUnresolved}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
                  <span>Trạng thái bài nộp cần rà soát SBD:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded ${
                      overview?.submissions.needsReview > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {overview?.submissions.needsReview > 0
                      ? `${overview?.submissions.needsReview} bài cần duyệt`
                      : "0 bài (Toàn bộ đã khớp)"}
                  </span>
                </div>
              </div>

              {/* Subjects breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Cơ cấu Kỳ thi theo Môn học
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Số lượng kỳ thi đã được tổ chức theo từng môn trong hệ thống
                  </p>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {subjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 text-[10px] font-bold text-slate-400 uppercase">
                          {sub.code}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {sub.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, sub.examPercentage * 2)}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 w-14 text-right">
                          {sub.examsCount} đề
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ===================================================== */}
            {/* 4. RECENT ACTIVITIES & SYSTEM HEALTH                  */}
            {/* ===================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Exams (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      Kỳ thi mới tạo gần đây
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Danh sách các kỳ thi trắc nghiệm được khởi tạo gần nhất
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {recentExams.length} kỳ thi
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3">Tên kỳ thi</th>
                        <th className="px-4 py-3">Môn & Lớp</th>
                        <th className="px-4 py-3">Giáo viên</th>
                        <th className="px-4 py-3 text-center">Đã nộp</th>
                        <th className="px-4 py-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentExams.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-8 text-slate-400 italic"
                          >
                            Chưa có kỳ thi nào trong hệ thống
                          </td>
                        </tr>
                      ) : (
                        recentExams.map((ex) => (
                          <tr
                            key={ex.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-4 py-3 font-bold text-slate-900 max-w-xs truncate">
                              {ex.title}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <span className="font-semibold text-slate-800">
                                {ex.subjectName}
                              </span>
                              <span className="text-slate-400 ml-1">
                                ({ex.className})
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {ex.teacherName}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-800">
                              {ex.submissionsCount}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatExamStatus(ex.status)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* System Health & Top Teachers (1 col) */}
              <div className="space-y-6">
                {/* System Infrastructure Health Card (Chỉ hiển thị cho Ban Giám hiệu / Quản trị viên) */}
                {systemHealth && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-blue-600" />
                      Hạ tầng & Trạng thái dịch vụ
                    </h3>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">
                            Express API Server
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Online (Port 5000)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">
                            PostgreSQL Database
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {systemHealth?.dbStatus || "CONNECTED"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">
                            AI OMR Engine
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Ready (Port 8000)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                      <span>Môi trường: development</span>
                      <span>Node: {systemHealth?.nodeVersion}</span>
                    </div>
                  </div>
                )}

                {/* Top Teachers Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      Giáo viên tạo nhiều kỳ thi
                    </h3>
                    <Link
                      to="/admin/teachers"
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {topTeachers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        Chưa có dữ liệu giáo viên
                      </p>
                    ) : (
                      topTeachers.map((tc, idx) => (
                        <div
                          key={tc.id}
                          className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-slate-100 font-black text-slate-500 text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">
                                {tc.fullName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {tc.teacherCode}
                              </div>
                            </div>
                          </div>
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {tc.examsCount} đề
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * =========================================================================
 * 3. ROUTE WRAPPER: PHÂN NHÁNH TRANG THỐNG KÊ
 * - Giáo viên -> TeacherClassStatisticsView (Chỉ thống kê lớp phụ trách)
 * - Ban Giám Hiệu / Quản trị viên -> AdminDashboardView (Toàn trường)
 * =========================================================================
 */
export default function AdminDashboardPage() {
  const { user } = useAuth();

  if (user?.role === "TEACHER") {
    return <Navigate to="/teacher/statistics" replace />;
  }

  return <AdminDashboardView />;
}
