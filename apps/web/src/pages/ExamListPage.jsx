import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import ExamStatusBadge from "../components/ExamStatusBadge";
import { formatScoringType } from "../utils/enum-map";
import { getErrorMessage } from "../utils/error-map";
import { examDetailPath } from "../utils/slug";
import {
  Plus,
  Search,
  Settings,
  ScanLine,
  Inbox,
  Loader2,
  BookOpen,
  Users,
  HelpCircle,
  Award,
  Eye,
  Copy,
  FileCheck,
  BarChart3,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";

export default function ExamListPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Teacher Dashboard State (Phase 10)
  const [dashboard, setDashboard] = useState(null);

  const fetchDashboard = async () => {
    try {
      const res = await api.get("/teacher/dashboard");
      setDashboard(res.data.data);
    } catch {
      // Non-blocking
    }
  };

  // Clone Modal State
  const [examToClone, setExamToClone] = useState(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    fetchExams();
    fetchDashboard();
  }, [statusFilter]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      let url = "/exams?limit=100";
      if (statusFilter !== "ALL") {
        url += `&status=${statusFilter}`;
      }

      const res = await api.get(url);
      setExams(res.data.data || []);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(code, raw || "Không thể tải danh sách kỳ thi.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloneExam = async () => {
    if (!examToClone) return;

    try {
      setCloning(true);
      setErrorMsg("");

      const res = await api.post(`/exams/${examToClone.id}/clone`);
      const cloned = res.data.data;
      setExamToClone(null);

      navigate(examDetailPath(cloned));
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể nhân bản kỳ thi."));
      setExamToClone(null);
    } finally {
      setCloning(false);
    }
  };

  const filteredExams = exams.filter((ex) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = (ex.title || "").toLowerCase().includes(term);
    const subjectMatch = (ex.subject?.name || "").toLowerCase().includes(term);
    const classMatch = (ex.class?.name || "").toLowerCase().includes(term);
    return titleMatch || subjectMatch || classMatch;
  });

  const filterTabs = [
    { id: "ALL", label: "Tất cả" },
    { id: "DRAFT", label: "Nháp" },
    { id: "PUBLISHED", label: "Đã phát hành" },
    { id: "CLOSED", label: "Đã đóng" },
    { id: "ARCHIVED", label: "Đã lưu trữ" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header with non-stretching button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Quản lý Kỳ thi
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Danh sách bài thi trắc nghiệm, thiết lập mã đề, đáp án và phiếu trả lời OMR.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => navigate("/exams/new")}
              className="w-full sm:w-auto"
            >
              Tạo kỳ thi mới
            </Button>
          </div>
        </div>

        {/* Teacher Dashboard Top Cards & Actions (Phase 10) */}
        {dashboard?.summary && (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Tổng số kỳ thi
                </span>
                <span className="text-2xl font-bold text-slate-800">
                  {dashboard.summary.totalExams}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
                  Đang diễn ra (Phát hành)
                </span>
                <span className="text-2xl font-bold text-blue-700">
                  {dashboard.summary.activeExams}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Đã đóng / Lưu trữ
                </span>
                <span className="text-2xl font-bold text-slate-700">
                  {dashboard.summary.closedExams + dashboard.summary.archivedExams}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs bg-emerald-50/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
                  Tổng bài thi đã chấm
                </span>
                <span className="text-2xl font-bold text-emerald-700">
                  {dashboard.summary.totalSubmissions}
                </span>
              </div>
            </div>

            {/* Action Needed Section */}
            {dashboard.actionNeeded && dashboard.actionNeeded.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Kỳ thi cần giáo viên xử lý ({dashboard.actionNeeded.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {dashboard.actionNeeded.map((act, idx) => (
                    <div
                      key={idx}
                      className="bg-white/90 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">
                          {act.examTitle}
                        </span>
                        <span className="text-slate-500 text-[11px] block">
                          {act.message}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/exams/${act.examId}/submissions`)}
                        className="shrink-0 text-xs py-1 px-2.5 h-auto"
                      >
                        Xử lý ngay
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Filter and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {filterTabs.map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-80 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm kỳ thi, môn, lớp..."
                className="w-full pl-9 pr-3.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="mb-6" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Content Container */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <span className="text-sm font-medium">Đang tải danh sách kỳ thi...</span>
          </div>
        ) : filteredExams.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Không tìm thấy kỳ thi nào"
            description={
              searchTerm || statusFilter !== "ALL"
                ? "Không có kỳ thi nào phù hợp với bộ lọc hiện tại. Thử thay đổi từ khóa hoặc bộ lọc."
                : "Bạn chưa tạo kỳ thi nào trong hệ thống. Nhấp vào nút 'Tạo kỳ thi mới' để bắt đầu."
            }
            action={
              statusFilter !== "ALL" || searchTerm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearchTerm("");
                  }}
                >
                  Xóa bộ lọc
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  icon={Plus}
                  onClick={() => navigate("/exams/new")}
                >
                  Tạo kỳ thi ngay
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4 font-semibold">Tên kỳ thi</th>
                      <th className="py-3.5 px-4 font-semibold">Môn học</th>
                      <th className="py-3.5 px-4 font-semibold">Lớp</th>
                      <th className="py-3.5 px-4 font-semibold">Số câu</th>
                      <th className="py-3.5 px-4 font-semibold">Thang điểm</th>
                      <th className="py-3.5 px-4 font-semibold">Hình thức</th>
                      <th className="py-3.5 px-4 font-semibold">Mã đề</th>
                      <th className="py-3.5 px-4 font-semibold">Trạng thái</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredExams.map((exam) => (
                      <tr
                        key={exam.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-4 px-4 font-medium text-slate-900 max-w-xs">
                          <Link
                            to={examDetailPath(exam)}
                            className="hover:text-blue-600 line-clamp-2 leading-snug transition-colors"
                          >
                            {exam.title}
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {exam.subject?.name || "—"}
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {exam.class?.name || "—"}
                        </td>
                        <td className="py-4 px-4 text-slate-700">
                          <span className="font-semibold">{exam.questionCount}</span> câu
                        </td>
                        <td className="py-4 px-4 text-slate-700 font-medium">
                          {Number(exam.maxScore)}đ
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-500">
                          {formatScoringType(exam.scoringType)}
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="gray" size="sm">
                            {exam._count?.examCodes || 0} mã
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <ExamStatusBadge status={exam.status} size="sm" />
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {exam.status === "DRAFT" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Settings}
                                onClick={() => navigate(examDetailPath(exam))}
                              >
                                Thiết lập
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Eye}
                                onClick={() => navigate(examDetailPath(exam))}
                              >
                                Xem chi tiết
                              </Button>
                            )}

                            {exam.status === "PUBLISHED" && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={ScanLine}
                                onClick={() => navigate(`/grade?examId=${exam.id}`)}
                              >
                                Chấm bài
                              </Button>
                            )}

                            {exam.status !== "DRAFT" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={FileCheck}
                                  onClick={() => navigate(`/exams/${exam.id}/submissions`)}
                                  title="Quản lý bài đã chấm và công bố kết quả"
                                >
                                  Bài đã chấm
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={BarChart3}
                                  onClick={() => navigate(`/exams/${exam.id}/analytics`)}
                                  title="Thống kê kết quả thi"
                                >
                                  Thống kê
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={Copy}
                                  onClick={() => setExamToClone(exam)}
                                  title="Nhân bản kỳ thi để sửa cấu hình"
                                >
                                  Nhân bản
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View (<md) */}
            <div className="md:hidden space-y-3">
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={examDetailPath(exam)}
                      className="font-bold text-slate-900 hover:text-blue-600 text-base leading-snug"
                    >
                      {exam.title}
                    </Link>
                    <ExamStatusBadge status={exam.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.subject?.name || "Chưa có môn"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.class?.name || "Chưa có lớp"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        <strong>{exam.questionCount}</strong> câu trắc nghiệm
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Thang <strong>{Number(exam.maxScore)}đ</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                    <span className="text-xs text-slate-500">
                      Đã tạo: <strong>{exam._count?.examCodes || 0}</strong> mã đề
                    </span>
                    <div className="flex items-center gap-1.5">
                      {exam.status === "DRAFT" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Settings}
                          onClick={() => navigate(examDetailPath(exam))}
                        >
                          Thiết lập
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => navigate(examDetailPath(exam))}
                        >
                          Xem
                        </Button>
                      )}

                      {exam.status === "PUBLISHED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={ScanLine}
                          onClick={() => navigate(`/grade?examId=${exam.id}`)}
                        >
                          Chấm bài
                        </Button>
                      )}

                      {exam.status !== "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={() => setExamToClone(exam)}
                          title="Nhân bản kỳ thi"
                        >
                          Nhân bản
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Clone Confirmation Modal */}
      <Modal
        isOpen={!!examToClone}
        onClose={() => !cloning && setExamToClone(null)}
        title="Nhân bản kỳ thi?"
        description="Hệ thống sẽ tạo một kỳ thi mới ở trạng thái Nháp, sao chép mã đề và đáp án. Phiếu OMR cũ sẽ không được sao chép."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExamToClone(null)}
              disabled={cloning}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Copy}
              onClick={handleCloneExam}
              loading={cloning}
            >
              Nhân bản
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Bạn có muốn nhân bản kỳ thi <strong>"{examToClone?.title}"</strong> thành một bản Nháp mới?
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div>&bull; Kỳ thi mới sẽ mang tên: <strong className="text-slate-800">{examToClone?.title} - Bản sao</strong></div>
            <div>&bull; Giữ nguyên số câu hỏi ({examToClone?.questionCount} câu), môn học, lớp và hình thức chấm.</div>
            <div>&bull; Toàn bộ mã đề và bảng đáp án hiện tại sẽ được sao chép nguyên vẹn.</div>
            <div>&bull; Mẫu phiếu OMR cũ sẽ không sao chép. Bạn cần tạo mẫu phiếu mới sau khi nhân bản.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
