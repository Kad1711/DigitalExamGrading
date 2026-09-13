import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
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
} from "lucide-react";
import { formatExamStatus } from "../utils/enum-map";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const res = await api.get("/admin/dashboard");
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
  }, []);

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-500 font-normal">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Năm học {overview?.academicYear || "2026-2027"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tổng quan hệ thống
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Báo cáo thống kê thời gian thực toàn bộ hoạt động giảng dạy, thi cử và chấm thi OMR
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${
                  refreshing ? "animate-spin text-blue-600" : ""
                }`}
              />
              <span>{refreshing ? "Đang cập nhật..." : "Làm mới"}</span>
            </button>

            <Button
              variant="primary"
              size="sm"
              icon={Users}
              onClick={() => navigate("/admin/teachers")}
            >
              Quản lý giáo viên
            </Button>
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
              {/* Card 1: Teachers */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Giáo viên
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {overview?.teachers.total || 0}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
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
                      {overview?.students.enrolled || 0}
                    </span>{" "}
                    đã xếp lớp
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
                      {overview?.classes.thcs || 0} THCS
                    </span>
                    <span>•</span>
                    <span className="font-medium text-slate-600">
                      {overview?.classes.thpt || 0} THPT
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
                      Phân bổ học sinh và lớp học trên toàn bộ hệ thống THCS (Khối 6-9) & THPT (Khối 10-12)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg">
                      THCS: {tierStats?.thcs.students || 0} HS ({tierStats?.thcs.classes || 0} lớp)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg">
                      THPT: {tierStats?.thpt.students || 0} HS ({tierStats?.thpt.classes || 0} lớp)
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
                {/* System Infrastructure Health Card */}
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
