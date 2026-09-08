import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Target,
  Sliders,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { getErrorMessage } from "../utils/error-map";
import { formatExamStatus } from "../utils/enum-map";

export default function ExamAnalyticsPage() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [filterDifficultOnly, setFilterDifficultOnly] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [examId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get(`/exams/${examId}/analytics`);
      setData(res.data.data);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, msg || "Không thể tải số liệu thống kê kỳ thi."));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AppHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-500">Đang tổng hợp dữ liệu thống kê...</span>
        </main>
      </div>
    );
  }

  const overview = data?.overview;
  const scoreStats = data?.scoreStats;
  const scoreDistribution = data?.scoreDistribution || [];
  const questionAnalytics = data?.questionAnalytics || [];
  const examCodeComparison = data?.examCodeComparison || [];
  const reviewWorkload = data?.reviewWorkload;

  const maxDistributionCount = Math.max(...scoreDistribution.map((d) => d.count), 1);

  const displayedQuestions = filterDifficultOnly
    ? questionAnalytics.filter((q) => q.correctRate < 40)
    : questionAnalytics;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Kỳ thi", to: "/exams" },
            { label: overview?.examTitle || "Chi tiết kỳ thi", to: `/exams/${examId}` },
            { label: "Thống kê" },
          ]}
        />

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {overview?.subject?.name || "Môn thi"}
              </span>
              {overview?.className && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {overview?.className}
                </span>
              )}
              <Badge variant={overview?.status === "ARCHIVED" ? "slate" : "blue"} size="sm">
                {formatExamStatus(overview?.status)}
              </Badge>
              {overview?.isPublished ? (
                <Badge variant="green" size="sm">
                  Đã công bố kết quả
                </Badge>
              ) : (
                <Badge variant="amber" size="sm">
                  Kết quả chưa công bố
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              <span>Thống kê kết quả: {overview?.examTitle}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to={`/exams/${examId}/submissions`}>
              <Button variant="secondary" size="sm">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                <span>Danh sách bài thi</span>
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={fetchAnalytics}>
              Làm mới
            </Button>
          </div>
        </div>

        {errorMsg && (
          <Alert variant="danger" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {data?.consistencyWarning && (
          <Alert variant="warning">
            {data.consistencyDetail || "Cảnh báo: Dữ liệu bài thi có sự không đồng nhất về thang điểm hoặc số câu hỏi."}
          </Alert>
        )}

        {!overview?.isPublished && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-800">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Kết quả của kỳ thi này hiện <strong>chưa công bố</strong> cho học sinh. Các số liệu thống kê dưới đây dựa trên dữ liệu bài thi hoàn tất (FINAL) phục vụ công tác rà soát chuyên môn của giáo viên.
            </span>
          </div>
        )}

        {/* 1. Score & Submissions Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
          <Card className="p-3.5 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Tổng số bài
            </span>
            <span className="text-xl font-bold text-slate-900">{overview?.totalSubmissions}</span>
          </Card>

          <Card className="p-3.5 border border-slate-200 bg-emerald-50/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
              Đã hoàn tất
            </span>
            <span className="text-xl font-bold text-emerald-800">{overview?.finalCount}</span>
          </Card>

          <Card className="p-3.5 border border-slate-200 bg-amber-50/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 block mb-1">
              Cần duyệt
            </span>
            <span className="text-xl font-bold text-amber-800">{overview?.provisionalCount}</span>
          </Card>

          <Card className="p-3.5 border border-slate-200 bg-blue-50/50 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 block mb-1">
              Điểm TB
            </span>
            <span className="text-xl font-extrabold text-blue-700">
              {scoreStats?.averageFinalScore !== null ? scoreStats.averageFinalScore.toFixed(2) : "—"}
            </span>
          </Card>

          <Card className="p-3.5 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Trung vị
            </span>
            <span className="text-xl font-bold text-slate-800">
              {scoreStats?.medianFinalScore !== null ? scoreStats.medianFinalScore.toFixed(2) : "—"}
            </span>
          </Card>

          <Card className="p-3.5 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Cao nhất
            </span>
            <span className="text-xl font-bold text-emerald-600">
              {scoreStats?.highestFinalScore !== null ? scoreStats.highestFinalScore.toFixed(2) : "—"}
            </span>
          </Card>

          <Card className="p-3.5 border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Thấp nhất
            </span>
            <span className="text-xl font-bold text-rose-600">
              {scoreStats?.lowestFinalScore !== null ? scoreStats.lowestFinalScore.toFixed(2) : "—"}
            </span>
          </Card>
        </div>

        {/* 2. Score Distribution (Bar Chart & Table) */}
        <Card className="p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Phân bố điểm thi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Biểu đồ số lượng bài nộp theo từng dải điểm (chỉ tính các bài đã hoàn tất)
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Tổng số bài hoàn tất: <strong>{overview?.finalCount}</strong>
            </span>
          </div>

          {overview?.finalCount === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa có bài thi nào ở trạng thái hoàn tất (FINAL) để tính phân bố điểm.
            </div>
          ) : (
            <div className="space-y-6">
              {/* SVG / CSS Bar Chart */}
              <div className="pt-6 pb-2">
                <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 items-end h-48 border-b border-slate-200 px-2">
                  {scoreDistribution.map((bucket, idx) => {
                    const heightPercent =
                      maxDistributionCount > 0
                        ? Math.max((bucket.count / maxDistributionCount) * 100, bucket.count > 0 ? 8 : 0)
                        : 0;

                    return (
                      <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                          Dải {bucket.label}: {bucket.count} bài (
                          {overview.finalCount > 0
                            ? Math.round((bucket.count / overview.finalCount) * 100)
                            : 0}
                          %)
                        </div>

                        {/* Count label above bar */}
                        <span className="text-[11px] font-bold text-slate-700 mb-1">
                          {bucket.count > 0 ? bucket.count : ""}
                        </span>

                        {/* Visual Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            bucket.count > 0
                              ? "bg-blue-600 group-hover:bg-blue-700 shadow-xs"
                              : "bg-slate-100"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 px-2 pt-2 text-[10px] sm:text-xs text-slate-500 font-mono text-center">
                  {scoreDistribution.map((bucket, idx) => (
                    <div key={idx} className="truncate">
                      {bucket.min}
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border-t border-slate-100 pt-4">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="py-2 px-2">Khoảng điểm</th>
                      {scoreDistribution.map((b, i) => (
                        <th key={i} className="py-2 px-2 text-center font-mono font-medium">
                          {b.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2.5 px-2 font-semibold text-slate-700">Số lượng</td>
                      {scoreDistribution.map((b, i) => (
                        <td key={i} className="py-2.5 px-2 text-center font-bold text-blue-600">
                          {b.count}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 px-2 text-slate-500">Tỷ lệ (%)</td>
                      {scoreDistribution.map((b, i) => (
                        <td key={i} className="py-2 px-2 text-center text-slate-500 font-mono">
                          {overview.finalCount > 0
                            ? Math.round((b.count / overview.finalCount) * 100)
                            : 0}
                          %
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* 3. Question-Level Analytics */}
        <Card className="p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hiệu quả từng câu hỏi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Đánh giá tỷ lệ làm đúng, tỷ lệ chọn sai và phân bố các phương án A/B/C/D
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterDifficultOnly(!filterDifficultOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  filterDifficultOnly
                    ? "bg-rose-50 border-rose-200 text-rose-700 font-semibold"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {filterDifficultOnly ? "✓ Đang lọc câu khó (< 40%)" : "Chỉ xem câu khó (< 40%)"}
              </button>
            </div>
          </div>

          {questionAnalytics.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa có dữ liệu câu hỏi được phân tích.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Câu</th>
                    <th className="py-2.5 px-3">Đáp án</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Tỷ lệ làm đúng</th>
                    <th className="py-2.5 px-2 text-center">Đúng</th>
                    <th className="py-2.5 px-2 text-center">Sai</th>
                    <th className="py-2.5 px-2 text-center">Trống</th>
                    <th className="py-2.5 px-2 text-center">Tô nhiều ô</th>
                    <th className="py-2.5 px-3 text-center border-l border-slate-200">A</th>
                    <th className="py-2.5 px-3 text-center">B</th>
                    <th className="py-2.5 px-3 text-center">C</th>
                    <th className="py-2.5 px-3 text-center">D</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedQuestions.map((q) => {
                    const isDifficult = q.correctRate < 40;
                    return (
                      <tr
                        key={q.questionNumber}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isDifficult ? "bg-rose-50/30" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          Câu {q.questionNumber}
                          {isDifficult && (
                            <span className="ml-1.5 inline-block text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded font-medium">
                              Khó
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold font-mono text-blue-700">
                          {q.correctAnswer || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                style={{ width: `${q.correctRate}%` }}
                                className={`h-full rounded-full ${
                                  isDifficult
                                    ? "bg-rose-500"
                                    : q.correctRate > 75
                                    ? "bg-emerald-500"
                                    : "bg-blue-600"
                                }`}
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-700 w-10 text-right">
                              {q.correctRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                          {q.correctCount}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-700">
                          {q.incorrectCount}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-mono">
                          {q.blankCount}
                        </td>
                        <td className="py-2.5 px-2 text-center text-amber-700 font-mono">
                          {q.invalidMultipleCount}
                        </td>

                        {/* Options distribution */}
                        <td className={`py-2.5 px-3 text-center font-mono border-l border-slate-200 ${q.correctAnswer === "A" ? "font-bold text-blue-700 bg-blue-50/40" : "text-slate-600"}`}>
                          {q.answerDistribution?.A || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-center font-mono ${q.correctAnswer === "B" ? "font-bold text-blue-700 bg-blue-50/40" : "text-slate-600"}`}>
                          {q.answerDistribution?.B || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-center font-mono ${q.correctAnswer === "C" ? "font-bold text-blue-700 bg-blue-50/40" : "text-slate-600"}`}>
                          {q.answerDistribution?.C || 0}
                        </td>
                        <td className={`py-2.5 px-3 text-center font-mono ${q.correctAnswer === "D" ? "font-bold text-blue-700 bg-blue-50/40" : "text-slate-600"}`}>
                          {q.answerDistribution?.D || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 4. Bottom Grid: ExamCode Comparison & Recognition Quality */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ExamCode Comparison */}
          <Card className="p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">So sánh theo mã đề thi</h3>
            <p className="text-xs text-slate-500 mb-4">
              Thống kê số lượng thí sinh và mức điểm giữa các mã đề (chỉ tính bài FINAL)
            </p>

            {examCodeComparison.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có dữ liệu so sánh mã đề.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                      <th className="py-2 px-3">Mã đề</th>
                      <th className="py-2 px-3 text-center">Số bài</th>
                      <th className="py-2 px-3 text-right">Điểm TB</th>
                      <th className="py-2 px-3 text-right">Cao nhất</th>
                      <th className="py-2 px-3 text-right">Thấp nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {examCodeComparison.map((codeItem) => (
                      <tr key={codeItem.code} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold font-mono text-blue-700">
                          {codeItem.code}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-800">
                          {codeItem.candidateCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {codeItem.averageScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">
                          {codeItem.highestScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-700 font-mono">
                          {codeItem.lowestScore.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* OMR Recognition & Review Workload Quality */}
          <Card className="p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Chất lượng nhận diện OMR & Khối lượng duyệt
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Theo dõi độ chính xác của AI/OMR và mức độ can thiệp duyệt bài của giáo viên
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  Bài thi cần can thiệp duyệt
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {reviewWorkload?.submissionsNeedingManualReview ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  Số câu giáo viên đã xử lý
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {reviewWorkload?.teacherReviewedAnswerCount ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  Bài thi cần duyệt lại SBD
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {reviewWorkload?.identityReviewCount ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  Câu tô nhiều ô (không hợp lệ)
                </span>
                <span className="text-lg font-bold text-amber-700">
                  {reviewWorkload?.invalidMultipleCount ?? 0}
                </span>
              </div>
            </div>

            {/* OMR initial status counts */}
            {reviewWorkload?.omrStatusCounts && (
              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-600 block mb-2">
                  Trạng thái nhận diện OMR ban đầu (tất cả các câu):
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-100">
                    <span className="block text-[10px] text-emerald-600">Tô rõ (MARKED)</span>
                    <strong className="text-sm font-bold">
                      {reviewWorkload.omrStatusCounts.MARKED || 0}
                    </strong>
                  </div>
                  <div className="bg-slate-100 text-slate-700 p-2 rounded-lg border border-slate-200">
                    <span className="block text-[10px] text-slate-500">Trống (BLANK)</span>
                    <strong className="text-sm font-bold">
                      {reviewWorkload.omrStatusCounts.BLANK || 0}
                    </strong>
                  </div>
                  <div className="bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100">
                    <span className="block text-[10px] text-amber-600">Nghi vấn (UNCERTAIN)</span>
                    <strong className="text-sm font-bold">
                      {reviewWorkload.omrStatusCounts.UNCERTAIN || 0}
                    </strong>
                  </div>
                  <div className="bg-rose-50 text-rose-800 p-2 rounded-lg border border-rose-100">
                    <span className="block text-[10px] text-rose-600">Tô nhiều ô (MULTIPLE)</span>
                    <strong className="text-sm font-bold">
                      {reviewWorkload.omrStatusCounts.MULTIPLE || 0}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
