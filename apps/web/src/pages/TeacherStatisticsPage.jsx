import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  RefreshCw,
  School,
  BookOpen,
  Filter,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { formatExamStatus } from "../utils/enum-map";

/**
 * =========================================================================
 * GIAO DIỆN THỐNG KÊ GIẢNG DẠY DÀNH RIÊNG CHO GIÁO VIÊN & TỔ TRƯỞNG CHUYÊN MÔN
 * - Chỉ thống kê kết quả học tập của các lớp học giáo viên được phân công.
 * - Tổ trưởng bộ môn có thêm báo cáo chuyên môn toàn trường cho môn học của mình.
 * - Tách biệt 100% khỏi Dashboard kỹ thuật / hệ thống của Quản trị viên.
 * =========================================================================
 */
export default function TeacherStatisticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const isSubjectLeader = Boolean(teacherInfo?.isSubjectLeader);
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
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full mx-auto">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <School className="w-4 h-4" />
              <span>
                {isSubjectLeader
                  ? `TỔ TRƯỞNG CHUYÊN MÔN • TỔ ${teacherInfo?.primarySubjectName?.toUpperCase() || "BỘ MÔN"}`
                  : "GIÁO VIÊN BỘ MÔN"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-normal">
                {teacherInfo?.fullName || user?.fullName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isSubjectLeader && activeTab === "SUBJECT_LEADER"
                ? `Báo Cáo Chuyên Môn Môn ${teacherInfo?.primarySubjectName || ""}`
                : "Thống Kê Giảng Dạy & Lớp Phụ Trách"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isSubjectLeader && activeTab === "SUBJECT_LEADER"
                ? `Theo dõi chất lượng thi cử và phổ điểm môn ${teacherInfo?.primarySubjectName || ""} trên toàn trường.`
                : "Theo dõi kết quả học tập, phổ điểm kiểm tra và tiến độ chấm thi của các lớp bạn được phân công."}
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

        {/* Tab Switch for Subject Leader */}
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
              <span>Lớp học tôi phụ trách ({assignedClasses.length} lớp)</span>
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
              <span>Báo cáo Toàn trường Môn {teacherInfo?.primarySubjectName}</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-500">Đang tổng hợp dữ liệu lớp học...</p>
          </div>
        ) : activeTab === "SUBJECT_LEADER" && isSubjectLeader ? (
          /* =========================================================================
           * TAB 2: BÁO CÁO TỔ TRƯỞNG BỘ MÔN (TOÀN TRƯỜNG)
           * ========================================================================= */
          <div className="space-y-6 animate-in fade-in duration-150">
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
                <div className="text-xs text-slate-500 mt-1">Học sinh đã làm bài trên toàn trường</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-400 uppercase">Điểm trung bình toàn trường</span>
                <div className="text-3xl font-black text-blue-600 mt-2">
                  {subjectLeaderData?.schoolWideAverageScore !== null ? `${subjectLeaderData?.schoolWideAverageScore} / 10` : "---"}
                </div>
                <div className="text-xs text-slate-500 mt-1">Môn {teacherInfo?.primarySubjectName}</div>
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
                      <th className="py-3 px-4 text-right">Đánh giá chung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(subjectLeaderData?.classesComparison || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                          Chưa có dữ liệu bài thi được chấm cho môn {teacherInfo?.primarySubjectName}.
                        </td>
                      </tr>
                    ) : (
                      (subjectLeaderData?.classesComparison || []).map((c, idx) => (
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
                            ) : c.averageScore !== null ? (
                              <Badge variant="danger">Cần cải thiện</Badge>
                            ) : (
                              <Badge variant="neutral">Chưa có điểm</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
           * TAB 1: THỐNG KÊ LỚP HỌC PHỤ TRÁCH (GIÁO VIÊN)
           * ========================================================================= */
          <div className="space-y-6 animate-in fade-in duration-150">
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
                  Vui lòng liên hệ Hiệu phó chuyên môn để được xếp lớp giảng dạy trên hệ thống.
                </p>
              </div>
            ) : (
              <>
                {/* 4 Cards KPI of assigned classes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Students */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {selectedClassId === "ALL" ? "Lớp & Sĩ số phụ trách" : "Sĩ số lớp"}
                      </span>
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {selectedClassId === "ALL"
                        ? `${assignedClasses.length} lớp`
                        : `${stats?.totalStudents || 0} học sinh`}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {selectedClassId === "ALL"
                        ? `Tổng cộng ${stats?.totalStudents || 0} học sinh`
                        : `Lớp ${assignedClasses.find((c) => c.id === selectedClassId)?.name}`}
                    </div>
                  </div>

                  {/* Card 2: Exams */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Bài kiểm tra</span>
                      <FileText className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {stats?.totalExams || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">15 phút, 1 tiết, giữa kỳ...</div>
                  </div>

                  {/* Card 3: Graded Submissions & Review */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Tiến độ chấm OMR</span>
                      <ScanLine className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {stats?.totalGradedSubmissions || 0}
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-1.5">
                      {stats?.pendingReviewCount > 0 ? (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Còn {stats.pendingReviewCount} bài cần duyệt
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã hoàn tất chấm
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card 4: Quality & Pass rate */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">Điểm trung bình</span>
                      <Award className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-blue-600">
                      {stats?.averageScore !== null ? `${stats?.averageScore} / 10` : "---"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tỷ lệ đạt (≥ 5.0):{" "}
                      <strong className="text-slate-800 font-bold">{stats?.passRate || 0}%</strong>
                    </div>
                  </div>
                </div>

                {/* Score Distribution Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Phổ điểm học tập của học sinh
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Thống kê trên tổng số {totalGraded} bài thi đã được chấm điểm của các lớp phụ trách.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <div className="flex justify-between items-center text-xs font-bold text-emerald-800">
                        <span>Giỏi (8.0 - 10)</span>
                        <span>{pExcellent}%</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-700 mt-2">
                        {dist.excellent} <span className="text-xs font-normal text-emerald-600">bài</span>
                      </div>
                      <div className="w-full bg-emerald-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pExcellent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                      <div className="flex justify-between items-center text-xs font-bold text-blue-800">
                        <span>Khá (6.5 - 7.9)</span>
                        <span>{pGood}%</span>
                      </div>
                      <div className="text-2xl font-black text-blue-700 mt-2">
                        {dist.good} <span className="text-xs font-normal text-blue-600">bài</span>
                      </div>
                      <div className="w-full bg-blue-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pGood}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                      <div className="flex justify-between items-center text-xs font-bold text-amber-800">
                        <span>Trung bình (5.0 - 6.4)</span>
                        <span>{pAvg}%</span>
                      </div>
                      <div className="text-2xl font-black text-amber-700 mt-2">
                        {dist.average} <span className="text-xs font-normal text-amber-600">bài</span>
                      </div>
                      <div className="w-full bg-amber-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pAvg}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                      <div className="flex justify-between items-center text-xs font-bold text-rose-800">
                        <span>Dưới TB (&lt; 5.0)</span>
                        <span>{pBelow}%</span>
                      </div>
                      <div className="text-2xl font-black text-rose-700 mt-2">
                        {dist.belowAvg} <span className="text-xs font-normal text-rose-600">bài</span>
                      </div>
                      <div className="w-full bg-rose-100 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pBelow}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exams List Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Danh sách các bài kiểm tra & Tình trạng chấm bài
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Plus}
                      onClick={() => navigate("/exams/new")}
                    >
                      Tạo bài kiểm tra mới
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Tên bài kiểm tra</th>
                          <th className="py-3 px-4">Môn học</th>
                          <th className="py-3 px-4">Lớp áp dụng</th>
                          <th className="py-3 px-4 text-center">Số bài đã nộp</th>
                          <th className="py-3 px-4 text-center">Điểm trung bình</th>
                          <th className="py-3 px-4 text-center">Trạng thái</th>
                          <th className="py-3 px-4 text-right">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exams.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                              Chưa có bài kiểm tra nào được tạo cho các lớp phụ trách này.
                            </td>
                          </tr>
                        ) : (
                          exams.map((ex) => (
                            <tr key={ex.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4">
                                <Link
                                  to={`/exams/${ex.id}`}
                                  className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                                >
                                  {ex.title}
                                </Link>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(ex.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600 text-xs font-medium">
                                {ex.subjectName}
                              </td>
                              <td className="py-3 px-4 text-slate-800 text-xs font-semibold">
                                {ex.className}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-600 text-xs">
                                <span className="font-bold text-slate-900">{ex.submissionsCount}</span> bài
                                {ex.pendingReviewCount > 0 && (
                                  <span className="block text-[10px] text-amber-600 font-semibold">
                                    ({ex.pendingReviewCount} cần duyệt)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-blue-600">
                                {ex.averageScore !== null ? `${ex.averageScore} / 10` : "---"}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                    ex.status === "PUBLISHED"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : ex.status === "CLOSED"
                                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {formatExamStatus(ex.status)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Link
                                    to={`/exams/${ex.id}/analytics`}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem phân tích & phổ điểm chi tiết của bài thi này"
                                  >
                                    <BarChart3 className="w-4 h-4" />
                                  </Link>
                                  <Link
                                    to={`/exams/${ex.id}/submissions`}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem danh sách bài thi đã nộp & chấm điểm"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
