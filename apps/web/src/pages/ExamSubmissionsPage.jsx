import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import { getErrorMessage } from "../utils/error-map";
import { PUBLICATION_APPROVAL_STATUS_LABELS } from "../utils/enum-map";
import { useAuth } from "../context/AuthContext";
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
  ShieldCheck,
  History,
  FileSpreadsheet,
  Users,
  Plus,
  Trash2,
  Zap,
  Edit,
  UserCheck,
  Send,
  XCircle,
  CheckCircle,
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import Breadcrumbs from "../components/ui/Breadcrumbs";

function SummaryCard({ label, value, color = "slate", icon: Icon }) {
  const colorMap = {
    slate: "text-slate-700 bg-slate-50 border-slate-200",
    green: "text-green-700 bg-green-50 border-green-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    red: "text-rose-700 bg-rose-50 border-rose-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
  };

  return (
    <div className={`p-4 rounded-xl border flex items-center gap-3 ${colorMap[color] || colorMap.slate}`}>
      {Icon && <Icon className="w-8 h-8 opacity-80 shrink-0" />}
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs font-medium opacity-70 mt-1">{label}</div>
      </div>
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
  const { user } = useAuth();
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
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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

  // Candidate mapping state (Phase 9)
  const [candidates, setCandidates] = useState([]);
  const [candidateMap, setCandidateMap] = useState({});
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateSaving, setCandidateSaving] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [candidateSbdInput, setCandidateSbdInput] = useState("");

  // Submission Deletion Modal
  const [subToDelete, setSubToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // In-line SBD Review / Edit Modal
  const [subToEditSbd, setSubToEditSbd] = useState(null);
  const [editingSbdInput, setEditingSbdInput] = useState("");
  const [sbdSaveLoading, setSbdSaveLoading] = useState(false);
  const [sbdSaveError, setSbdSaveError] = useState("");

  const loadCandidates = useCallback(async () => {
    try {
      setCandidateLoading(true);
      setCandidateError("");
      const res = await api.get(`/exams/${examId}/candidates`);
      const list = res.data.data || [];
      setCandidates(list);
      const map = {};
      for (const c of list) {
        map[c.studentNumber] = c;
      }
      setCandidateMap(map);
    } catch (err) {
      setCandidateError(getErrorMessage(err.response?.data?.error?.code, "Không thể tải danh sách thí sinh."));
    } finally {
      setCandidateLoading(false);
    }
  }, [examId]);

  const loadEligibleStudents = useCallback(async () => {
    try {
      const res = await api.get(`/exams/${examId}/eligible-students`);
      setEligibleStudents(res.data.data || []);
    } catch {
      // Non-blocking
    }
  }, [examId]);

  const handleAssignCandidate = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !candidateSbdInput.trim()) {
      setCandidateError("Vui lòng chọn học sinh và nhập số báo danh.");
      return;
    }
    try {
      setCandidateSaving(true);
      setCandidateError("");
      await api.post(`/exams/${examId}/candidates`, {
        studentId: selectedStudentId,
        studentNumber: candidateSbdInput.trim(),
      });
      setSelectedStudentId("");
      setCandidateSbdInput("");
      await Promise.all([loadCandidates(), loadEligibleStudents()]);
    } catch (err) {
      setCandidateError(getErrorMessage(err.response?.data?.error?.code, "Không thể gán học sinh vào số báo danh."));
    } finally {
      setCandidateSaving(false);
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    try {
      setCandidateLoading(true);
      setCandidateError("");
      await api.delete(`/exams/${examId}/candidates/${candidateId}`);
      await Promise.all([loadCandidates(), loadEligibleStudents()]);
    } catch (err) {
      setCandidateError(getErrorMessage(err.response?.data?.error?.code, "Không thể xóa liên kết thí sinh."));
    } finally {
      setCandidateLoading(false);
    }
  };

  const handleAutoAssignCandidates = async () => {
    try {
      setCandidateLoading(true);
      setCandidateError("");
      const res = await api.post(`/exams/${examId}/candidates/auto-assign`);
      await Promise.all([loadCandidates(), loadEligibleStudents(), loadSubmissions(page)]);
      const count = res.data.data?.assignedCount || 0;
      alert(`Đã tự động gán thành công ${count} học sinh vào số báo danh!`);
    } catch (err) {
      setCandidateError(getErrorMessage(err.response?.data?.error?.code, "Không thể tự động gán thí sinh."));
    } finally {
      setCandidateLoading(false);
    }
  };

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
    loadCandidates();
  }, [loadExam, loadSummary, loadPublicationStatus, loadCandidates]);

  useEffect(() => {
    loadSubmissions(1);
  }, [filterStatus, filterIdentity, filterDuplicate, filterExamCode, filterSearch, sortField, sortOrder]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilterSearch(searchInput.trim());
  };

  const handleConfirmDelete = async () => {
    if (!subToDelete) return;
    try {
      setDeleteLoading(true);
      setDeleteError("");
      await api.delete(`/submissions/${subToDelete.id}`);
      setSubToDelete(null);
      await Promise.all([loadSubmissions(page), loadSummary()]);
    } catch (err) {
      setDeleteError(getErrorMessage(err.response?.data?.error?.code, "Không thể xoá bài nộp này."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveSbd = async (e) => {
    e.preventDefault();
    if (!subToEditSbd) return;
    const clean = editingSbdInput.trim();
    if (!/^\d{6}$/.test(clean)) {
      setSbdSaveError("Số báo danh phải bao gồm đúng 6 chữ số.");
      return;
    }
    try {
      setSbdSaveLoading(true);
      setSbdSaveError("");
      await api.patch(`/submissions/${subToEditSbd.id}/identity`, { studentNumber: clean });
      setSubToEditSbd(null);
      await Promise.all([loadSubmissions(page), loadSummary(), loadCandidates()]);
    } catch (err) {
      setSbdSaveError(getErrorMessage(err.response?.data?.error?.code, "Không thể cập nhật số báo danh."));
    } finally {
      setSbdSaveLoading(false);
    }
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

  const handleRequestPublicationConfirm = async () => {
    try {
      setPubActionLoading(true);
      setPubError("");
      setPubSuccess("");
      await api.post(`/exams/${examId}/publication/request`, {
        note: requestNote.trim() || undefined,
      });
      setPubSuccess("Đã gửi yêu cầu phê duyệt công bố điểm thành công.");
      setRequestModalOpen(false);
      setRequestNote("");
      await Promise.all([loadPublicationStatus(), loadPublicationLogs()]);
    } catch (err) {
      const errData = err.response?.data?.error;
      setPubError(getErrorMessage(errData?.code, errData?.message || "Không thể gửi yêu cầu phê duyệt."));
    } finally {
      setPubActionLoading(false);
    }
  };

  const handleApprovePublicationConfirm = async () => {
    try {
      setPubActionLoading(true);
      setPubError("");
      setPubSuccess("");
      await api.post(`/exams/${examId}/publication/approve`, {
        note: approveNote.trim() || undefined,
      });
      setPubSuccess("Đã phê duyệt công bố điểm kỳ thi thành công.");
      setApproveModalOpen(false);
      setApproveNote("");
      await Promise.all([loadPublicationStatus(), loadPublicationLogs()]);
    } catch (err) {
      const errData = err.response?.data?.error;
      setPubError(getErrorMessage(errData?.code, errData?.message || "Không thể phê duyệt công bố."));
    } finally {
      setPubActionLoading(false);
    }
  };

  const handleRejectPublicationConfirm = async () => {
    if (!rejectReason.trim()) {
      setPubError("Vui lòng nhập lý do từ chối phê duyệt.");
      return;
    }
    try {
      setPubActionLoading(true);
      setPubError("");
      setPubSuccess("");
      await api.post(`/exams/${examId}/publication/reject`, {
        reason: rejectReason.trim(),
      });
      setPubSuccess("Đã từ chối yêu cầu phê duyệt công bố điểm.");
      setRejectModalOpen(false);
      setRejectReason("");
      await Promise.all([loadPublicationStatus(), loadPublicationLogs()]);
    } catch (err) {
      const errData = err.response?.data?.error;
      setPubError(getErrorMessage(errData?.code, errData?.message || "Không thể từ chối phê duyệt."));
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

  const isStaffManager = ["ADMIN", "EXAM_BOARD", "TEACHER"].includes(user?.role);
  const isExamBoardOrAdmin = ["EXAM_BOARD", "ADMIN"].includes(user?.role);
  const isAcademicBoardOrAdmin = ["ACADEMIC_BOARD", "ADMIN"].includes(user?.role);
  const isOfficial =
    publication?.isOfficialExam ||
    ["MIN_45", "MIN_60", "MIN_90", "MIDTERM", "FINAL", "OTHER"].includes(exam?.examType);
  const canApprove =
    publication?.canApprove ||
    (isAcademicBoardOrAdmin && publication?.publicationApprovalStatus === "PENDING_APPROVAL");

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
            <Link to={`/exams/${examId}/analytics`}>
              <Button variant="outline" size="sm" icon={BarChart3}>
                Thống kê chi tiết
              </Button>
            </Link>
            {isStaffManager && (
              <Button
                variant="outline"
                size="sm"
                icon={Zap}
                loading={candidateLoading}
                onClick={handleAutoAssignCandidates}
                title="Tự động đối soát và liên kết số báo danh với tài khoản học sinh"
              >
                Tự động gán SBD
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={Users}
              onClick={() => {
                setCandidateModalOpen(true);
                loadCandidates();
                loadEligibleStudents();
              }}
            >
              Quản lý thí sinh (SBD)
            </Button>
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
                  {((isOfficial && isExamBoardOrAdmin) || (!isOfficial && isStaffManager)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnpublishModalOpen(true)}
                      className="text-amber-700 border-amber-200 hover:bg-amber-50"
                    >
                      Thu hồi công bố
                    </Button>
                  )}
                </>
              ) : isOfficial ? (
                <>
                  {publication?.publicationApprovalStatus === "APPROVED" && (
                    ["EXAM_BOARD", "ACADEMIC_BOARD", "ADMIN"].includes(user?.role) ? (
                      <Button
                        variant="success"
                        size="sm"
                        icon={Globe}
                        disabled={!publication?.readiness?.ready}
                        onClick={() => setPublishModalOpen(true)}
                      >
                        Công bố kết quả
                      </Button>
                    ) : (
                      <Badge variant="green" size="sm">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Đã được duyệt công bố
                      </Badge>
                    )
                  )}

                  {publication?.publicationApprovalStatus === "PENDING_APPROVAL" && (
                    canApprove ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          icon={ShieldCheck}
                          onClick={() => setApproveModalOpen(true)}
                        >
                          Phê duyệt công bố
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={XCircle}
                          onClick={() => setRejectModalOpen(true)}
                          className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          Từ chối
                        </Button>
                      </>
                    ) : (
                      <Badge variant="amber" size="sm">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Chờ Ban giáo dục duyệt
                      </Badge>
                    )
                  )}

                  {(publication?.publicationApprovalStatus === "NOT_REQUESTED" ||
                    publication?.publicationApprovalStatus === "REJECTED" ||
                    !publication?.publicationApprovalStatus) && (
                    isExamBoardOrAdmin ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Send}
                        disabled={!publication?.readiness?.ready}
                        onClick={() => setRequestModalOpen(true)}
                      >
                        Gửi yêu cầu phê duyệt công bố
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Kỳ thi chính quy: Chờ Ban khảo thí gửi duyệt công bố.
                      </span>
                    )
                  )}
                </>
              ) : (
                ["TEACHER", "ADMIN"].includes(user?.role) && (
                  <Button
                    variant="success"
                    size="sm"
                    icon={Globe}
                    disabled={!publication?.readiness?.ready}
                    onClick={() => setPublishModalOpen(true)}
                  >
                    Công bố kết quả
                  </Button>
                )
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
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-4">
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

              {isOfficial && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Quy trình duyệt:</span>
                  {publication?.publicationApprovalStatus === "APPROVED" && (
                    <Badge variant="green" size="sm">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Đã duyệt bởi {publication?.publicationApprovedBy?.fullName || "Ban giáo dục"}
                    </Badge>
                  )}
                  {publication?.publicationApprovalStatus === "PENDING_APPROVAL" && (
                    <Badge variant="amber" size="sm">
                      <Clock className="w-3 h-3 mr-1" />
                      Chờ duyệt (Gửi bởi {publication?.publicationRequestedBy?.fullName || "Ban khảo thí"})
                    </Badge>
                  )}
                  {publication?.publicationApprovalStatus === "REJECTED" && (
                    <Badge variant="red" size="sm">
                      <XCircle className="w-3 h-3 mr-1" />
                      Bị từ chối: {publication?.publicationRejectionReason || "Không đạt yêu cầu"}
                    </Badge>
                  )}
                  {(!publication?.publicationApprovalStatus || publication?.publicationApprovalStatus === "NOT_REQUESTED") && (
                    <Badge variant="gray" size="sm">Chưa gửi duyệt</Badge>
                  )}
                </div>
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
                            <span className="inline-flex items-center gap-1">
                              <Badge variant="red" size="sm">Trùng SBD</Badge>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubToEditSbd(sub);
                                  setEditingSbdInput(sub.studentNumber.resolved || sub.studentNumber.detected || "");
                                  setSbdSaveError("");
                                  loadEligibleStudents();
                                }}
                                className="text-[10px] text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                                title="Bấm để sửa lại SBD cho bài này"
                              >
                                [Sửa SBD]
                              </button>
                            </span>
                          )}
                        </div>
                        {sub.studentNumber.resolved && (
                          candidateMap[sub.studentNumber.resolved] ? (
                            <span className="text-[11px] text-blue-600 font-medium block truncate max-w-[180px]">
                              {candidateMap[sub.studentNumber.resolved].studentName}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCandidateSbdInput(sub.studentNumber.resolved);
                                setCandidateModalOpen(true);
                                loadCandidates();
                                loadEligibleStudents();
                              }}
                              className="text-[10px] text-amber-600 hover:text-amber-700 hover:underline block italic cursor-pointer text-left font-medium"
                              title="Bấm để gán tài khoản học sinh cho SBD này"
                            >
                              Chưa gán tài khoản ↗
                            </button>
                          )
                        )}
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
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <Link
                            to={`/submissions/${sub.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-xs font-semibold inline-flex items-center transition-colors"
                            title="Xem chi tiết bài làm và lịch sử duyệt"
                          >
                            {isStaffManager ? "Chi tiết & Duyệt" : "Xem chi tiết"}
                          </Link>

                          {isStaffManager && !publication?.isPublished && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubToEditSbd(sub);
                                  setEditingSbdInput(sub.studentNumber.resolved || sub.studentNumber.detected || "");
                                  setSbdSaveError("");
                                  loadEligibleStudents();
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                  sub.isDuplicateSbd || sub.studentNumber.needsReview
                                    ? "bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold"
                                    : "hover:bg-slate-100 text-slate-600"
                                }`}
                                title="Sửa / Duyệt số báo danh nhanh"
                              >
                                <Edit className="w-3 h-3" />
                                Sửa SBD
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSubToDelete(sub);
                                  setDeleteError("");
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Xoá bài nộp này"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                              </button>
                            </>
                          )}
                        </div>
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

        {/* ===================================================== */}
        {/* MODAL: Request Publication Approval */}
        {/* ===================================================== */}
        <Modal
          isOpen={requestModalOpen}
          onClose={() => !pubActionLoading && setRequestModalOpen(false)}
          title="Gửi yêu cầu phê duyệt công bố điểm"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pubActionLoading}
                onClick={() => setRequestModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                loading={pubActionLoading}
                onClick={handleRequestPublicationConfirm}
              >
                Gửi yêu cầu
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Bạn đang yêu cầu Ban giáo dục và đào tạo phê duyệt công bố điểm cho kỳ thi chính quy <strong>"{examTitle}"</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Ghi chú đính kèm (không bắt buộc):
              </label>
              <textarea
                rows={3}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Nhập ghi chú cho Ban giáo dục và đào tạo..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Approve Publication */}
        {/* ===================================================== */}
        <Modal
          isOpen={approveModalOpen}
          onClose={() => !pubActionLoading && setApproveModalOpen(false)}
          title="Phê duyệt công bố điểm kỳ thi"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pubActionLoading}
                onClick={() => setApproveModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={ShieldCheck}
                loading={pubActionLoading}
                onClick={handleApprovePublicationConfirm}
              >
                Xác nhận phê duyệt
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Xác nhận phê duyệt công bố điểm kỳ thi <strong>"{examTitle}"</strong>?
            </p>
            <p className="text-xs text-slate-500">
              Sau khi được phê duyệt, Ban khảo thí hoặc Quản trị viên có thể tiến hành công bố điểm cho học sinh và phụ huynh xem.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Ghi chú phê duyệt (không bắt buộc):
              </label>
              <textarea
                rows={2}
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Ghi chú xác nhận..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Reject Publication */}
        {/* ===================================================== */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => !pubActionLoading && setRejectModalOpen(false)}
          title="Từ chối phê duyệt công bố điểm"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={pubActionLoading}
                onClick={() => setRejectModalOpen(false)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={XCircle}
                loading={pubActionLoading}
                onClick={handleRejectPublicationConfirm}
              >
                Xác nhận từ chối
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Từ chối yêu cầu phê duyệt công bố điểm của kỳ thi <strong>"{examTitle}"</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Lý do từ chối (bắt buộc):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do chưa đạt yêu cầu (ví dụ: cần rà soát lại bài nộp mã đề 102)..."
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Candidate Management (Phase 9) */}
        {/* ===================================================== */}
        <Modal
          isOpen={candidateModalOpen}
          onClose={() => setCandidateModalOpen(false)}
          title="Quản lý thí sinh & Gán số báo danh (SBD)"
          size="lg"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCandidateModalOpen(false)}
            >
              Đóng
            </Button>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Liên kết số báo danh (SBD) trên phiếu thi với tài khoản học sinh thuộc lớp của kỳ thi để học sinh có thể tra cứu điểm chính thức trên cổng thông tin.
            </p>

            {publication?.isPublished && (
              <Alert variant="warning">
                <strong>Kết quả kỳ thi đã công bố:</strong> Danh sách liên kết thí sinh đã bị khóa để bảo đảm tính toàn vẹn. Vui lòng thu hồi công bố nếu bạn cần điều chỉnh danh sách này.
              </Alert>
            )}

            {candidateError && (
              <Alert variant="danger" onClose={() => setCandidateError("")}>
                {candidateError}
              </Alert>
            )}

            {/* Quick Auto-Assign Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Tự động gán toàn bộ theo SBD
                </span>
                <span className="text-[11px] text-blue-700 block mt-0.5">
                  Tự động đối soát mã học sinh, email và SBD trên bài thi để gán tài khoản hàng loạt trong 1 click.
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Zap}
                loading={candidateLoading}
                onClick={handleAutoAssignCandidates}
              >
                <span>Gán tự động ngay</span>
              </Button>
            </div>

            {/* Add Candidate Form (only if unpublished) */}
            {!publication?.isPublished && (
              <form onSubmit={handleAssignCandidate} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Gán học sinh vào số báo danh
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Học sinh trong lớp:
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn học sinh --</option>
                      {eligibleStudents.map((st) => (
                        <option key={st.studentId} value={st.studentId}>
                          {st.studentName} ({st.studentCode}) {st.isAssigned ? `[Đã gán: ${st.assignedStudentNumber}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Số báo danh (SBD):
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 171101"
                      maxLength={10}
                      value={candidateSbdInput}
                      onChange={(e) => setCandidateSbdInput(e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={candidateSaving}
                    disabled={!selectedStudentId || !candidateSbdInput.trim()}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Lưu liên kết</span>
                  </Button>
                </div>
              </form>
            )}

            {/* Candidates List Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  Danh sách đã liên kết ({candidates.length} thí sinh)
                </span>
              </div>

              {candidateLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                  <span>Đang tải danh sách thí sinh...</span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Chưa có thí sinh nào được liên kết với số báo danh.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">SBD</th>
                        <th className="py-2 px-3">Mã học sinh</th>
                        <th className="py-2 px-3">Họ và tên</th>
                        {!publication?.isPublished && (
                          <th className="py-2 px-3 text-right">Xóa</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">
                            {c.studentNumber}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {c.studentCode}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {c.studentName}
                          </td>
                          {!publication?.isPublished && (
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteCandidate(c.id)}
                                className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hủy liên kết"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Delete Submission Confirmation */}
        {/* ===================================================== */}
        <Modal
          isOpen={!!subToDelete}
          onClose={() => !deleteLoading && setSubToDelete(null)}
          title="Xác nhận xoá bài nộp"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={deleteLoading}
                onClick={() => setSubToDelete(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                loading={deleteLoading}
                onClick={handleConfirmDelete}
              >
                Xác nhận xoá bài
              </Button>
            </>
          }
        >
          {subToDelete && (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                Bạn có chắc chắn muốn xoá vĩnh viễn bài nộp này?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Số báo danh:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {subToDelete.studentNumber.resolved || subToDelete.studentNumber.detected || "Chưa rõ"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã đề:</span>
                  <span className="font-mono font-bold text-slate-800">{subToDelete.examCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Điểm số:</span>
                  <span className="font-bold text-blue-600">
                    {subToDelete.status === "FINAL"
                      ? formatScore(subToDelete.grading.finalScore, subToDelete.grading.maxScore)
                      : formatScore(subToDelete.grading.provisionalScore, subToDelete.grading.maxScore)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian chấm:</span>
                  <span>{new Date(subToDelete.createdAt).toLocaleString("vi-VN")}</span>
                </div>
              </div>

              {deleteError && (
                <Alert variant="danger" className="text-xs">
                  {deleteError}
                </Alert>
              )}

              <Alert variant="warning" className="text-xs">
                <strong>Lưu ý:</strong> Hành động này sẽ xoá hoàn toàn kết quả chấm và tệp ảnh quét của bài nộp khỏi hệ thống. Nếu bài nộp này bị trùng SBD với một bài thi khác, việc xoá bài thừa sẽ giải quyết cảnh báo Trùng SBD.
              </Alert>
            </div>
          )}
        </Modal>

        {/* ===================================================== */}
        {/* MODAL: Inline SBD Review / Edit */}
        {/* ===================================================== */}
        <Modal
          isOpen={!!subToEditSbd}
          onClose={() => !sbdSaveLoading && setSubToEditSbd(null)}
          title="Kiểm duyệt & Sửa số báo danh (SBD)"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={sbdSaveLoading}
                onClick={() => setSubToEditSbd(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={UserCheck}
                loading={sbdSaveLoading}
                onClick={handleSaveSbd}
              >
                Lưu số báo danh
              </Button>
            </>
          }
        >
          {subToEditSbd && (
            <form onSubmit={handleSaveSbd} className="space-y-4 text-sm text-slate-700">
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Điều chỉnh số báo danh để liên kết đúng học sinh hoặc giải quyết lỗi tô nhầm SBD.
                </p>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số báo danh (6 chữ số):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={editingSbdInput}
                  onChange={(e) => setEditingSbdInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="VD: 090619"
                  className="w-full text-sm font-mono tracking-widest border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold"
                  autoFocus
                />
              </div>

              {eligibleStudents.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Gợi ý: Chọn nhanh học sinh trong lớp để lấy SBD:
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs bg-slate-50/50">
                    {eligibleStudents.map((st) => (
                      <button
                        key={st.studentId}
                        type="button"
                        onClick={() => {
                          if (st.assignedStudentNumber) {
                            setEditingSbdInput(st.assignedStudentNumber);
                          } else if (st.studentCode && /^\d{6}$/.test(st.studentCode)) {
                            setEditingSbdInput(st.studentCode);
                          }
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="font-medium text-slate-800">{st.studentName} ({st.studentCode})</span>
                        <span className="font-mono text-blue-600 font-semibold">
                          {st.assignedStudentNumber ? `SBD: ${st.assignedStudentNumber}` : "Bấm chọn"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sbdSaveError && (
                <Alert variant="danger" className="text-xs">
                  {sbdSaveError}
                </Alert>
              )}
            </form>
          )}
        </Modal>
      </main>
    </div>
  );
}
