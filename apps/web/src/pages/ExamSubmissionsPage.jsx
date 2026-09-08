import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import { getErrorMessage } from "../utils/error-map";
import {
  FileCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCircle,
  Download,
  ArrowLeft,
  RefreshCw,
  BarChart3,
  Globe,
  Loader2,
  ShieldOff,
  History,
  FileSpreadsheet,
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import Breadcrumbs from "../components/ui/Breadcrumbs";

function SummaryCard({ label, value, color = "slate", icon: Icon }) {
  const colorMap = {
    slate: "text-slate-700 bg-slate-50 border-slate-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    green: "text-green-700 bg-green-50 border-green-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    rose: "text-rose-700 bg-rose-50 border-rose-200",
    purple: "text-purple-700 bg-purple-50 border-purple-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-4 h-4 opacity-70" />}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-xl font-bold">{value ?? "—"}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "FINAL") {
    return (
      <Badge variant="green" size="sm">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Hoàn tất
      </Badge>
    );
  }
  return (
    <Badge variant="amber" size="sm">
      <Clock className="w-3 h-3 mr-1" />
      Tạm thời
    </Badge>
  );
}

export default function ExamSubmissionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [summary, setSummary] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasDuplicateSbd, setHasDuplicateSbd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Publication state
  const [publication, setPublication] = useState(null);
  const [pubLoading, setPubLoading] = useState(false);
  const [pubActionLoading, setPubActionLoading] = useState(false);
  const [pubError, setPubError] = useState("");
  const [pubSuccess, setPubSuccess] = useState("");

  // Publication logs
  const [pubLogs, setPubLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Modals
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterIdentity, setFilterIdentity] = useState("");
  const [filterDuplicate, setFilterDuplicate] = useState("");
  const [filterExamCode, setFilterExamCode] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Export loading
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const PAGE_SIZE = 20;

  const loadExam = useCallback(async () => {
    try {
      const res = await api.get(`/exams/${examId}`);
      setExam(res.data.data);
    } catch (err) {
      setErrorMsg("Không thể tải thông tin kỳ thi.");
    }
  }, [examId]);

  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await api.get(`/exams/${examId}/submissions/summary`);
      setSummary(res.data);
    } catch (err) {
      // Non-fatal
    } finally {
      setSummaryLoading(false);
    }
  }, [examId]);

  const loadPublicationStatus = useCallback(async () => {
    try {
      setPubLoading(true);
      const res = await api.get(`/exams/${examId}/results/publication`);
      setPublication(res.data);
    } catch (err) {
      // Non-fatal
    } finally {
      setPubLoading(false);
    }
  }, [examId]);

  const loadPublicationLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await api.get(`/exams/${examId}/results/publication-logs`);
      setPubLogs(res.data || []);
    } catch (err) {
      // Non-fatal
    } finally {
      setLogsLoading(false);
    }
  }, [examId]);

  const loadSubmissions = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      setErrorMsg("");
      const params = new URLSearchParams();
      params.set("page", p);
      params.set("pageSize", PAGE_SIZE);
      params.set("sort", sortField);
      params.set("order", sortOrder);
      if (filterStatus) params.set("status", filterStatus);
      if (filterIdentity) params.set("identityStatus", filterIdentity);
      if (filterDuplicate) params.set("duplicate", filterDuplicate);
      if (filterExamCode) params.set("examCode", filterExamCode);
      if (filterSearch) params.set("search", filterSearch);

      const res = await api.get(`/exams/${examId}/submissions?${params.toString()}`);
      const data = res.data;
      setSubmissions(data.submissions || []);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setTotalPages(data.totalPages || 1);
      setHasDuplicateSbd(data.hasDuplicateSbd || false);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể tải danh sách bài nộp."));
    } finally {
      setLoading(false);
    }
  }, [examId, filterStatus, filterIdentity, filterDuplicate, filterExamCode, filterSearch, sortField, sortOrder]);

  useEffect(() => {
    loadExam();
    loadSummary();
    loadPublicationStatus();
  }, [loadExam, loadSummary, loadPublicationStatus]);

  useEffect(() => {
    loadSubmissions(1);
  }, [filterStatus, filterIdentity, filterDuplicate, filterExamCode, filterSearch, sortField, sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilterSearch(searchInput.trim());
  };

  const handlePublishConfirm = async () => {
    try {
      setPubActionLoading(true);
      setPubError("");
      setPubSuccess("");
      await api.post(`/exams/${examId}/results/publish`);
      setPubSuccess("Đã công bố kết quả kỳ thi thành công.");
      setPublishModalOpen(false);
      await Promise.all([loadPublicationStatus(), loadSummary(), loadPublicationLogs()]);
    } catch (err) {
      const errData = err.response?.data?.error;
      const issues = errData?.details?.issues;
      if (issues && issues.length > 0) {
        setPubError("Kỳ thi chưa đủ điều kiện công bố:\n" + issues.join("\n"));
      } else {
        setPubError(getErrorMessage(errData?.code, errData?.message || "Không thể công bố kết quả."));
      }
    } finally {
      setPubActionLoading(false);
    }
  };

  const handleUnpublishConfirm = async () => {
    try {
      setPubActionLoading(true);
      setPubError("");
      setPubSuccess("");
      await api.post(`/exams/${examId}/results/unpublish`, {
        note: unpublishReason.trim() || undefined,
      });
      setPubSuccess("Đã thu hồi công bố kết quả kỳ thi.");
      setUnpublishModalOpen(false);
      setUnpublishReason("");
      await Promise.all([loadPublicationStatus(), loadSummary(), loadPublicationLogs()]);
    } catch (err) {
      const errData = err.response?.data?.error;
      setPubError(getErrorMessage(errData?.code, errData?.message || "Không thể thu hồi công bố."));
    } finally {
      setPubActionLoading(false);
    }
  };

  // Section 28: Authenticated Axios blob download
  const handleExportXlsx = async () => {
    try {
      setExportingXlsx(true);
      setErrorMsg("");
      const res = await api.get(`/exams/${examId}/results/export.xlsx`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ket_qua_${examId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setErrorMsg("Không thể xuất file Excel kết quả thi.");
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      setErrorMsg("");
      const res = await api.get(`/exams/${examId}/results/export.csv`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv; charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ket_qua_${examId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setErrorMsg("Không thể xuất file CSV kết quả thi.");
    } finally {
      setExportingCsv(false);
    }
  };

  const formatScore = (score, maxScore) => {
    if (score === null || score === undefined) return "—";
    return `${Number(score).toFixed(2)} / ${Number(maxScore).toFixed(2)}`;
  };

  const examTitle = exam?.title || "Kỳ thi";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: examTitle, to: `/exams/${examId}` },
            { label: "Bài đã chấm" },
          ]}
        />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-blue-600" />
              Bài đã chấm
            </h1>
            <p className="text-sm text-slate-500 mt-1">{examTitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate(`/exams/${examId}`)}
            >
              Quay lại kỳ thi
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                loadSummary();
                loadSubmissions(page);
                loadPublicationStatus();
              }}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="mb-6" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Duplicate SBD warning banner */}
        {hasDuplicateSbd && (
          <Alert variant="warning" className="mb-6">
            <AlertTriangle className="w-4 h-4 mr-2 inline text-amber-600" />
            <strong>Cảnh báo trùng số báo danh:</strong> Phát hiện số báo danh đã được xác nhận bị trùng lặp giữa các bài thi. Vui lòng kiểm tra và xử lý trước khi công bố kết quả.
          </Alert>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard
            label="Tổng bài nộp"
            value={summaryLoading ? "…" : summary?.totalSubmissions ?? summary?.total ?? 0}
            color="slate"
            icon={FileCheck}
          />
          <SummaryCard
            label="Hoàn tất (FINAL)"
            value={summaryLoading ? "…" : summary?.finalCount ?? summary?.final ?? 0}
            color="green"
            icon={CheckCircle2}
          />
          <SummaryCard
            label="Tạm thời (PROV)"
            value={summaryLoading ? "…" : summary?.provisionalCount ?? summary?.provisional ?? 0}
            color="amber"
            icon={Clock}
          />
          <SummaryCard
            label="Chờ duyệt SBD"
            value={summaryLoading ? "…" : summary?.identityNeedsReviewCount ?? summary?.needsIdentityReview ?? 0}
            color="amber"
            icon={UserCircle}
          />
          <SummaryCard
            label="Chờ duyệt câu"
            value={summaryLoading ? "…" : summary?.needsAnswerReviewCount ?? summary?.needsAnswerReview ?? 0}
            color="rose"
            icon={AlertTriangle}
          />
          <SummaryCard
            label="SBD trùng"
            value={
              summaryLoading
                ? "…"
                : `${summary?.duplicateStudentNumberGroupCount ?? 0} nhóm (${summary?.duplicateSubmissionCount ?? 0} bài)`
            }
            color={(summary?.duplicateStudentNumberGroupCount || 0) > 0 ? "rose" : "slate"}
            icon={ShieldOff}
          />
        </div>

        {/* Score Stats for FINAL */}
        {summary?.scoreStats && summary.scoreStats.avg !== null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Thống kê điểm số (Bài đã hoàn tất)
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-slate-500 text-xs">Điểm trung bình</span>
                <div className="font-bold text-slate-800 text-lg">
                  {Number(summary.scoreStats.avg).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Điểm cao nhất</span>
                <div className="font-bold text-green-700 text-lg">
                  {Number(summary.scoreStats.max).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Điểm thấp nhất</span>
                <div className="font-bold text-rose-700 text-lg">
                  {Number(summary.scoreStats.min).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Publication Control Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                Công bố & Xuất kết quả thi
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Kỳ thi cần ở trạng thái <strong>CLOSED</strong>, tất cả bài nộp đạt <strong>FINAL</strong>, không còn SBD chờ duyệt và không trùng SBD.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {publication?.isPublished ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={FileSpreadsheet}
                    loading={exportingXlsx}
                    onClick={handleExportXlsx}
                  >
                    Xuất Excel (XLSX)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    loading={exportingCsv}
                    onClick={handleExportCsv}
                  >
                    Xuất CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUnpublishModalOpen(true)}
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    Thu hồi công bố
                  </Button>
                </>
              ) : (
                <Button
                  variant="success"
                  size="sm"
                  icon={Globe}
                  disabled={!publication?.readiness?.ready}
                  onClick={() => setPublishModalOpen(true)}
                >
                  Công bố kết quả
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                icon={History}
                onClick={() => {
                  if (!showLogs) loadPublicationLogs();
                  setShowLogs(!showLogs);
                }}
              >
                {showLogs ? "Ẩn lịch sử" : "Lịch sử công bố"}
              </Button>
            </div>
          </div>

          {pubError && (
            <Alert variant="danger" className="mt-4 text-xs whitespace-pre-line" onClose={() => setPubError("")}>
              {pubError}
            </Alert>
          )}

          {pubSuccess && (
            <Alert variant="success" className="mt-4 text-xs" onClose={() => setPubSuccess("")}>
              {pubSuccess}
            </Alert>
          )}

          {/* Current Publication State */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Trạng thái kết quả:</span>
              {publication?.isPublished ? (
                <Badge variant="green" size="sm">
                  <Globe className="w-3 h-3 mr-1" />
                  Đã công bố
                </Badge>
              ) : (
                <Badge variant="gray" size="sm">Chưa công bố</Badge>
              )}
              {publication?.publishedAt && (
                <span className="text-xs text-slate-400">
                  (Vào lúc {new Date(publication.publishedAt).toLocaleString("vi-VN")})
                </span>
              )}
            </div>

            {/* Readiness Checklist if not published */}
            {!publication?.isPublished && publication?.readiness && !publication.readiness.ready && (
              <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 w-full mt-2">
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Điều kiện chưa thỏa mãn để công bố:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {publication.readiness.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Collapsible Publication Audit History */}
          {showLogs && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Lịch sử công bố
              </h4>
              {logsLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải lịch sử...
                </div>
              ) : pubLogs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa có bản ghi công bố nào.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                  {pubLogs.map((log) => (
                    <div key={log.id} className="p-2.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-white hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        {log.action === "PUBLISHED" ? (
                          <Badge variant="green" size="sm">Công bố</Badge>
                        ) : (
                          <Badge variant="amber" size="sm">Thu hồi</Badge>
                        )}
                        <span className="text-slate-700 font-medium">
                          {log.actor?.fullName || log.actor?.email || "Giáo viên"}
                        </span>
                        {log.note && (
                          <span className="text-slate-500 italic">"{log.note}"</span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-80">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo số báo danh..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <Button variant="primary" size="sm" type="submit">
                Tìm
              </Button>
              {filterSearch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearchInput(""); setFilterSearch(""); }}
                >
                  Xóa
                </Button>
              )}
            </form>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="FINAL">Hoàn tất (FINAL)</option>
                <option value="PROVISIONAL">Tạm thời (PROV)</option>
              </select>

              {/* Identity filter */}
              <select
                value={filterIdentity}
                onChange={(e) => setFilterIdentity(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả danh tính</option>
                <option value="NEEDS_REVIEW">Chờ duyệt SBD</option>
                <option value="RESOLVED">Đã xác nhận SBD</option>
              </select>

              {/* Duplicate SBD filter */}
              <select
                value={filterDuplicate}
                onChange={(e) => setFilterDuplicate(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả bài</option>
                <option value="true">Chỉ bài SBD trùng</option>
              </select>

              {/* Exam code filter */}
              <input
                type="text"
                placeholder="Lọc mã đề..."
                value={filterExamCode}
                onChange={(e) => setFilterExamCode(e.target.value)}
                className="w-24 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Sort field */}
              <select
                value={`${sortField}:${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split(":");
                  setSortField(f);
                  setSortOrder(o);
                }}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt:desc">Mới nhất</option>
                <option value="createdAt:asc">Cũ nhất</option>
                <option value="finalScore:desc">Điểm cao nhất</option>
                <option value="finalScore:asc">Điểm thấp nhất</option>
                <option value="resolvedStudentNumber:asc">SBD tăng dần</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Đang tải danh sách bài nộp...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileCheck className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Không tìm thấy bài nộp nào phù hợp với bộ lọc.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">STT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Số báo danh</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Mã đề</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Điểm</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Đúng/Sai/Trống</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Thời gian</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((sub, idx) => (
                    <tr
                      key={sub.id}
                      className={`hover:bg-slate-50/70 transition-colors ${sub.isDuplicateSbd ? "bg-rose-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-slate-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sub.studentNumber.needsReview ? (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {sub.studentNumber.detected || "Chưa xác định"}
                              <Badge variant="amber" size="sm">Chờ duyệt SBD</Badge>
                            </span>
                          ) : (
                            <span className="font-mono font-medium text-slate-800">
                              {sub.studentNumber.resolved || sub.studentNumber.detected || "—"}
                            </span>
                          )}
                          {sub.isDuplicateSbd && (
                            <Badge variant="red" size="sm">Trùng SBD</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{sub.examCode}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sub.status} />
                        {sub.grading.unresolvedCount > 0 && (
                          <span className="ml-1 text-xs text-amber-600">
                            ({sub.grading.unresolvedCount} chờ)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {sub.status === "FINAL"
                          ? formatScore(sub.grading.finalScore, sub.grading.maxScore)
                          : formatScore(sub.grading.provisionalScore, sub.grading.maxScore)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        <span className="text-green-700 font-medium">{sub.grading.correctCount}✓</span>
                        {" / "}
                        <span className="text-rose-600 font-medium">{sub.grading.incorrectCount}✗</span>
                        {" / "}
                        <span>{sub.grading.blankCount}⬡</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {new Date(sub.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/submissions/${sub.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-semibold"
                        >
                          Chi tiết & Duyệt
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Tổng số {total} bài nộp · Trang {page} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={page <= 1}
                onClick={() => loadSubmissions(page - 1)}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => loadSubmissions(page + 1)}
              >
                Tiếp
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        {totalPages <= 1 && total > 0 && (
          <p className="text-xs text-slate-500">Tổng số {total} bài nộp</p>
        )}

        {/* ===================================================== */}
        {/* MODAL: Publish Confirmation (Section 29) */}
        {/* ===================================================== */}
        <Modal
          isOpen={publishModalOpen}
          onClose={() => !pubActionLoading && setPublishModalOpen(false)}
          title="Xác nhận công bố kết quả kỳ thi"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pubActionLoading}
                onClick={() => setPublishModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={Globe}
                loading={pubActionLoading}
                onClick={handlePublishConfirm}
              >
                Xác nhận công bố
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Bạn có chắc chắn muốn công bố kết quả cho kỳ thi <strong>"{examTitle}"</strong>?
            </p>
            <Alert variant="warning">
              <strong>Lưu ý quan trọng:</strong> Sau khi công bố kết quả, toàn bộ thao tác can thiệp duyệt đáp án và sửa đổi số báo danh sẽ bị <strong>khóa hoàn toàn</strong> để bảo đảm tính toàn vẹn của kết quả thi.
            </Alert>
          </div>
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Unpublish Confirmation (Section 30) */}
        {/* ===================================================== */}
        <Modal
          isOpen={unpublishModalOpen}
          onClose={() => !pubActionLoading && setUnpublishModalOpen(false)}
          title="Thu hồi công bố kết quả kỳ thi"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pubActionLoading}
                onClick={() => setUnpublishModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={pubActionLoading}
                onClick={handleUnpublishConfirm}
              >
                Xác nhận thu hồi
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Khi thu hồi công bố, kỳ thi sẽ quay lại trạng thái chưa công bố kết quả. Bạn có thể tiếp tục chỉnh sửa duyệt bài nộp trước khi công bố lại.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do thu hồi (không bắt buộc):
              </label>
              <input
                type="text"
                value={unpublishReason}
                onChange={(e) => setUnpublishReason(e.target.value)}
                placeholder="Ví dụ: Cần điều chỉnh duyệt lại câu hỏi..."
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
