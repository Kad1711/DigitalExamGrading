import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import {
  BookOpen,
  Award,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
  Search,
  FileQuestion,
  User,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../utils/error-map";

export default function StudentExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PUBLISHED, GRADING, PENDING

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get("/student/exams");
      setExams(res.data.data || []);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, msg || "Không thể tải danh sách kỳ thi của bạn."));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  // Filtered exams
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        !searchTerm.trim() ||
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.subject?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.className?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exam.studentNumber && exam.studentNumber.includes(searchTerm.trim()));

      if (!matchesSearch) return false;

      if (statusFilter === "PUBLISHED") {
        return exam.isResultsPublished;
      }
      if (statusFilter === "GRADING") {
        return exam.hasSubmitted && !exam.isResultsPublished;
      }
      if (statusFilter === "PENDING") {
        return !exam.hasSubmitted && !exam.isResultsPublished;
      }
      return true;
    });
  }, [exams, searchTerm, statusFilter]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = exams.length;
    const published = exams.filter((e) => e.isResultsPublished).length;
    const grading = exams.filter((e) => e.hasSubmitted && !e.isResultsPublished).length;
    const pending = exams.filter((e) => !e.hasSubmitted && !e.isResultsPublished).length;
    return { total, published, grading, pending };
  }, [exams]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <BookOpen className="w-7 h-7 text-blue-600" />
              <span>Kỳ thi của tôi</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi danh sách kỳ thi được chỉ định, số báo danh và tiến độ chấm bài
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchExams} loading={loading}>
            Làm mới
          </Button>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="mb-6" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Quick Stat Cards */}
        {!loading && exams.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
            <div
              onClick={() => setStatusFilter("ALL")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === "ALL"
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-semibold text-slate-500 mb-1">Tất cả kỳ thi</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>

            <div
              onClick={() => setStatusFilter("PUBLISHED")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === "PUBLISHED"
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-semibold text-emerald-700 mb-1">Đã có điểm</div>
              <div className="text-2xl font-bold text-emerald-700">{stats.published}</div>
            </div>

            <div
              onClick={() => setStatusFilter("GRADING")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === "GRADING"
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-semibold text-amber-700 mb-1">Đang chấm điểm</div>
              <div className="text-2xl font-bold text-amber-700">{stats.grading}</div>
            </div>

            <div
              onClick={() => setStatusFilter("PENDING")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === "PENDING"
                  ? "bg-slate-100 border-slate-300 ring-2 ring-slate-400/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-semibold text-slate-600 mb-1">Chưa nộp / Sắp thi</div>
              <div className="text-2xl font-bold text-slate-700">{stats.pending}</div>
            </div>
          </div>
        )}

        {/* Filter bar & Search */}
        {!loading && exams.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên bài thi, môn học, SBD..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter("PUBLISHED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  statusFilter === "PUBLISHED"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Đã có điểm ({stats.published})
              </button>
              <button
                onClick={() => setStatusFilter("GRADING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  statusFilter === "GRADING"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Đang chấm ({stats.grading})
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  statusFilter === "PENDING"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Chưa nộp ({stats.pending})
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Đang tải danh sách kỳ thi...</span>
          </div>
        ) : errorMsg ? (
          <Card className="p-8 text-center border border-rose-200 bg-rose-50/20">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Không thể tải danh sách kỳ thi</h2>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
              {errorMsg}
            </p>
            <div className="mt-5">
              <Button variant="secondary" size="sm" onClick={fetchExams} loading={loading}>
                Thử lại
              </Button>
            </div>
          </Card>
        ) : exams.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center border border-slate-200">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Bạn chưa có kỳ thi nào</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
              Tài khoản <strong className="text-slate-700 font-mono">{user?.email}</strong> hiện chưa được thêm vào lớp học hoặc kỳ thi nào. Vui lòng liên hệ giáo viên bộ môn hoặc nhà trường để kiểm tra danh sách lớp.
            </p>
            <div className="mt-5">
              <Button variant="outline" size="sm" onClick={fetchExams} loading={loading}>
                Kiểm tra lại
              </Button>
            </div>
          </Card>
        ) : filteredExams.length === 0 ? (
          <Card className="p-8 text-center border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy kỳ thi phù hợp</p>
            <p className="text-xs text-slate-500 mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                }}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredExams.map((exam) => {
              return (
                <Card
                  key={exam.id}
                  className="p-5 hover:shadow-md transition-shadow border border-slate-200 flex flex-col justify-between"
                >
                  <div>
                    {/* Top tags & status badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {exam.subject?.name || "Môn thi"}
                        </span>
                        {exam.className && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            Lớp {exam.className}
                          </span>
                        )}
                        {exam.studentNumber && (
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            SBD: {exam.studentNumber}
                          </span>
                        )}
                      </div>

                      {exam.isResultsPublished ? (
                        <Badge variant="green" size="sm">
                          Đã có điểm
                        </Badge>
                      ) : exam.hasSubmitted ? (
                        <Badge variant="amber" size="sm">
                          Đang chấm điểm
                        </Badge>
                      ) : (
                        <Badge variant="slate" size="sm">
                          Chưa nộp bài
                        </Badge>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-base text-slate-900 line-clamp-2 mb-2 leading-snug">
                      {exam.title}
                    </h3>

                    {/* Metadata summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{exam.questionCount} câu hỏi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Thang {exam.maxScore} điểm</span>
                      </div>
                      {exam.teacherName && (
                        <div className="flex items-center gap-2 col-span-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">GV: {exam.teacherName}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress / Status banner */}
                    {exam.isResultsPublished ? (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl mb-4 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-medium text-emerald-800">
                            Kết quả bài thi của bạn:
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-2xl font-black text-emerald-700">
                              {exam.score !== null ? exam.score.toFixed(2) : "—"}
                            </span>
                            <span className="text-xs text-emerald-600 font-medium">
                              / {exam.maxScore} điểm
                            </span>
                          </div>
                        </div>
                        {exam.correctCount !== null && (
                          <div className="text-right">
                            <div className="text-xs font-bold text-emerald-800">
                              {exam.correctCount} / {exam.questionCount}
                            </div>
                            <div className="text-[10px] text-emerald-600">câu đúng</div>
                          </div>
                        )}
                      </div>
                    ) : exam.hasSubmitted ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-800 flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Đã nhận bài làm:</strong> Giáo viên đang chấm và rà soát kết quả. Điểm sẽ được cập nhật ngay khi công bố.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl mb-4 text-xs text-slate-600 flex items-start gap-2">
                        <ClipboardCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <strong>Chưa có bài nộp:</strong> Hãy tô đúng số báo danh <strong>{exam.studentNumber || "của bạn"}</strong> trên phiếu trả lời trắc nghiệm khi làm bài.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(exam.resultsPublishedAt || exam.publishedAt || exam.createdAt)}
                    </span>

                    {exam.isResultsPublished ? (
                      <Link
                        to={`/student/results/${exam.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                      >
                        <span>Xem chi tiết bài làm</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">
                        {exam.hasSubmitted ? "Chờ công bố điểm" : "Chờ làm bài"}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
