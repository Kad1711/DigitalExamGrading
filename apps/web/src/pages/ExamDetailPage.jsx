import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import ExamStatusBadge from "../components/ExamStatusBadge";
import { formatScoringType } from "../utils/enum-map";
import { getErrorMessage } from "../utils/error-map";
import { slugifyVietnamese, examDetailPath } from "../utils/slug";
import {
  FileText,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Upload,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  Lock,
  Archive,
  Send,
  Loader2,
  FileCheck,
  RefreshCw,
  Copy,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import EmptyState from "../components/ui/EmptyState";

export default function ExamDetailPage() {
  const { examId, slug } = useParams();
  const navigate = useNavigate();

  // Core Data
  const [exam, setExam] = useState(null);
  const [examCodes, setExamCodes] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Metadata Editing
  const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Selected Exam Code & Answer Key
  const [selectedCodeId, setSelectedCodeId] = useState("");
  const [answers, setAnswers] = useState([]); // [{ questionNumber, correctAnswer, score }]
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [savingAnswers, setSavingAnswers] = useState(false);

  // New Exam Code input
  const [newCodeInput, setNewCodeInput] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null); // { id, code }

  // Template Actions
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Confirmation Modals
  const [confirmCloneOpen, setConfirmCloneOpen] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  useEffect(() => {
    if (selectedCodeId) {
      loadAnswerKey(selectedCodeId);
    } else {
      setAnswers([]);
    }
  }, [selectedCodeId]);

  const loadExamData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const [examRes, codesRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/codes`),
      ]);

      const examData = examRes.data.data;
      const codesData = codesRes.data.data || [];

      setExam(examData);
      setExamCodes(codesData);
      setEditTitle(examData.title || "");
      setEditDescription(examData.description || "");

      if (codesData.length > 0 && !selectedCodeId) {
        setSelectedCodeId(codesData[0].id);
      }

      // Check template
      try {
        const tplRes = await api.get(`/exams/${examId}/answer-sheet-template`);
        setTemplate(tplRes.data.data);
      } catch (tErr) {
        if (tErr.response?.status === 404) {
          setTemplate(null);
        }
      }

      // Friendly URL Canonicalization:
      // If the current route is missing a slug or has an outdated slug, replace with canonical slug smoothly
      const canonicalSlug = slugifyVietnamese(examData.title);
      if (slug !== canonicalSlug) {
        navigate(`/exams/${examData.id}/${canonicalSlug}`, { replace: true });
      }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(code, raw || "Không thể tải thông tin kỳ thi.")
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAnswerKey = async (codeId) => {
    try {
      setLoadingAnswers(true);
      const res = await api.get(`/exams/${examId}/codes/${codeId}/answer-key`);
      const existingAnswers = res.data.data?.answers || [];

      const count = exam?.questionCount || 40;
      const equalScore =
        exam?.scoringType === "EQUAL"
          ? Math.round((Number(exam.maxScore) / count) * 10000) / 10000
          : null;

      const map = new Map();
      for (const a of existingAnswers) {
        map.set(a.questionNumber, a);
      }

      const rows = [];
      for (let i = 1; i <= count; i++) {
        const existing = map.get(i);
        rows.push({
          questionNumber: i,
          correctAnswer: existing ? existing.correctAnswer : "",
          score: existing
            ? existing.score
            : exam?.scoringType === "EQUAL"
            ? equalScore
            : 0.25,
        });
      }

      setAnswers(rows);
    } catch (err) {
      console.error("Error loading answer key:", err);
    } finally {
      setLoadingAnswers(false);
    }
  };

  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setErrorMsg("Tên kỳ thi không được để trống.");
      return;
    }

    try {
      setSavingMetadata(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await api.patch(`/exams/${examId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      });

      const updated = res.data.data;
      setExam(updated);
      setShowEditMetadataModal(false);
      setSuccessMsg("Đã cập nhật thông tin kỳ thi thành công.");

      // Canonicalize URL to new title slug
      const newSlug = slugifyVietnamese(updated.title);
      navigate(`/exams/${examId}/${newSlug}`, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(code, raw || "Không thể cập nhật thông tin kỳ thi.")
      );
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleClone = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await api.post(`/exams/${examId}/clone`);
      const cloned = res.data.data;
      setConfirmCloneOpen(false);

      // Navigate to the newly cloned DRAFT exam page
      navigate(examDetailPath(cloned));
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(code, raw || "Không thể nhân bản kỳ thi.")
      );
      setConfirmCloneOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    const trimmed = newCodeInput.trim();
    if (!trimmed) return;

    if (!/^\d+$/.test(trimmed)) {
      setErrorMsg("Mã đề OMR phải là các chữ số từ 0-9 (Ví dụ: 101, 102).");
      return;
    }

    if (trimmed.length > 3) {
      setErrorMsg("Mã đề OMR tối đa 3 chữ số.");
      return;
    }

    try {
      setCreatingCode(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await api.post(`/exams/${examId}/codes`, { code: trimmed });
      const created = res.data.data;

      setExamCodes((prev) => [...prev, created]);
      setSelectedCodeId(created.id);
      setNewCodeInput("");
      setSuccessMsg(`Đã tạo mã đề ${trimmed}.`);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể tạo mã đề."));
    } finally {
      setCreatingCode(false);
    }
  };

  const confirmDeleteCodeAction = async () => {
    if (!codeToDelete) return;
    const { id: codeId, code: codeName } = codeToDelete;

    try {
      setActionLoading(true);
      setErrorMsg("");
      setSuccessMsg("");
      await api.delete(`/exams/${examId}/codes/${codeId}`);

      const remaining = examCodes.filter((c) => c.id !== codeId);
      setExamCodes(remaining);
      if (selectedCodeId === codeId) {
        setSelectedCodeId(remaining.length > 0 ? remaining[0].id : "");
      }
      setSuccessMsg(`Đã xóa mã đề '${codeName}'.`);
      setCodeToDelete(null);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể xóa mã đề."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAnswer = (questionNumber, option) => {
    if (isLocked) return;
    setAnswers((prev) =>
      prev.map((a) =>
        a.questionNumber === questionNumber
          ? { ...a, correctAnswer: option }
          : a
      )
    );
  };

  const handleScoreChange = (questionNumber, newScore) => {
    if (isLocked) return;
    const num = parseFloat(newScore) || 0;
    setAnswers((prev) =>
      prev.map((a) =>
        a.questionNumber === questionNumber ? { ...a, score: num } : a
      )
    );
  };

  const handleSaveAnswers = async () => {
    if (!selectedCodeId) return;

    // Validation: All questions must be selected
    const missing = answers.filter((a) => !a.correctAnswer);
    if (missing.length > 0) {
      setErrorMsg(
        `Vui lòng chọn đáp án cho tất cả câu hỏi. Còn thiếu ${
          missing.length
        } câu (${missing
          .slice(0, 5)
          .map((m) => `Câu ${m.questionNumber}`)
          .join(", ")}${missing.length > 5 ? "..." : ""}).`
      );
      return;
    }

    // CUSTOM: Validate sum
    if (exam.scoringType === "CUSTOM") {
      const sum = answers.reduce((total, a) => total + Number(a.score || 0), 0);
      const rounded = Math.round(sum * 10000) / 10000;
      const max = Number(exam.maxScore);
      if (Math.abs(rounded - max) > 0.0001) {
        setErrorMsg(
          `Tổng điểm các câu (${rounded}đ) chưa bằng thang điểm tối đa (${max}đ). Chênh lệch: ${(
            max - rounded
          ).toFixed(2)}đ.`
        );
        return;
      }
    }

    try {
      setSavingAnswers(true);
      setErrorMsg("");
      setSuccessMsg("");

      const payload = {
        answers: answers.map((a) => ({
          questionNumber: a.questionNumber,
          correctAnswer: a.correctAnswer,
          score: exam.scoringType === "CUSTOM" ? Number(a.score) : undefined,
        })),
      };

      await api.put(
        `/exams/${examId}/codes/${selectedCodeId}/answer-key`,
        payload
      );
      setSuccessMsg("Đã lưu bảng đáp án thành công!");

      setExamCodes((prev) =>
        prev.map((c) =>
          c.id === selectedCodeId
            ? { ...c, _count: { answerKeys: answers.length } }
            : c
        )
      );
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể lưu đáp án."));
    } finally {
      setSavingAnswers(false);
    }
  };

  const handleDownloadImportTemplate = async (format) => {
    try {
      const res = await api.get(
        `/exams/${examId}/answer-key/import-template?format=${format}`,
        {
          responseType: "blob",
        }
      );
      const contentType =
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mau_dap_an_${exam?.title?.replace(/\s+/g, "_") || "exam"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  };

  const handleFilePreview = async () => {
    if (!importFile) {
      setErrorMsg("Vui lòng chọn file Excel hoặc CSV trước.");
      return;
    }

    try {
      setPreviewLoading(true);
      setErrorMsg("");

      const formData = new FormData();
      formData.append("file", importFile);

      const res = await api.post(
        `/exams/${examId}/answer-key/import/preview`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setImportPreview(res.data.data);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Lỗi kiểm tra file import."));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importFile) return;

    try {
      setImporting(true);
      setErrorMsg("");
      setSuccessMsg("");

      const formData = new FormData();
      formData.append("file", importFile);

      await api.post(`/exams/${examId}/answer-key/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      setSuccessMsg("Đã nhập đáp án từ file thành công!");

      loadExamData();
      if (selectedCodeId) {
        loadAnswerKey(selectedCodeId);
      }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Lỗi nhập đáp án."));
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateTemplate = async () => {
    try {
      setGeneratingTemplate(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await api.post(`/exams/${examId}/answer-sheet-template`, {});
      setTemplate(res.data.data);
      setSuccessMsg("Đã tạo mẫu phiếu trả lời OMR thành công!");
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể tạo mẫu phiếu OMR."));
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      setErrorMsg("");

      const res = await api.get(`/exams/${examId}/answer-sheet-template/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `phieu_omr_${exam?.title?.replace(/\s+/g, "_") || "exam"}_v${
        template?.version || 1
      }.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Không thể tải file PDF phiếu trả lời.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePublish = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");

      const res = await api.post(`/exams/${examId}/publish`);
      setExam(res.data.data);
      setConfirmPublishOpen(false);
      setSuccessMsg(
        "Kỳ thi đã được phát hành thành công! Cấu hình chấm điểm đã được khóa an toàn."
      );
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể phát hành kỳ thi."));
      setConfirmPublishOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");

      const res = await api.post(`/exams/${examId}/close`);
      setExam(res.data.data);
      setConfirmCloseOpen(false);
      setSuccessMsg("Kỳ thi đã được đóng thành công. Sẽ không nhận thêm bài chấm mới.");
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể đóng kỳ thi."));
      setConfirmCloseOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");

      const res = await api.post(`/exams/${examId}/archive`);
      setExam(res.data.data);
      setConfirmArchiveOpen(false);
      setSuccessMsg("Kỳ thi đã được chuyển vào lưu trữ.");
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể lưu trữ kỳ thi."));
      setConfirmArchiveOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");

      await api.delete(`/exams/${examId}`);
      setConfirmDeleteOpen(false);
      navigate("/exams");
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, raw || "Không thể xóa kỳ thi."));
      setConfirmDeleteOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AppHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
          <span className="text-sm font-medium">
            Đang tải thông tin thiết lập kỳ thi...
          </span>
        </main>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AppHeader />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
          <Alert variant="danger" className="mb-4">
            Kỳ thi không tồn tại hoặc đã bị xóa.
          </Alert>
          <Button variant="outline" size="sm" onClick={() => navigate("/exams")}>
            Quay lại danh sách kỳ thi
          </Button>
        </main>
      </div>
    );
  }

  const isDraft = exam.status === "DRAFT";
  const isPublished = exam.status === "PUBLISHED";
  const isClosed = exam.status === "CLOSED";
  const isArchived = exam.status === "ARCHIVED";
  const isLocked = !isDraft;

  // Readiness calculation
  const hasExamCodes = examCodes.length > 0;
  const allCodesComplete =
    hasExamCodes &&
    examCodes.every((ec) => (ec._count?.answerKeys || 0) === exam.questionCount);
  const hasTemplate = !!template;
  const isReadyToPublish =
    isDraft && hasExamCodes && allCodesComplete && hasTemplate;

  // Running total calculation for CUSTOM
  const currentTotalScore = answers.reduce(
    (sum, a) => sum + Number(a.score || 0),
    0
  );
  const roundedTotalScore = Math.round(currentTotalScore * 10000) / 10000;
  const maxScore = Number(exam.maxScore);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={[{ label: exam.title }]} />

        {/* Header Title & Status Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {exam.title}
                </h1>
                <ExamStatusBadge status={exam.status} />
              </div>

              {exam.description && (
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                  {exam.description}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 flex-wrap">
                <Badge variant="blue" size="sm">
                  {exam.subject?.name || "Môn học"}
                </Badge>
                <Badge variant="gray" size="sm">
                  {exam.class?.name || "Lớp"}
                </Badge>
                <span>&bull;</span>
                <span className="font-semibold text-slate-800">
                  {exam.questionCount} câu
                </span>
                <span>&bull;</span>
                <span>
                  Thang <strong>{Number(exam.maxScore)}đ</strong>
                </span>
                <span>&bull;</span>
                <span className="text-slate-500">
                  {formatScoringType(exam.scoringType)}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons per Lifecycle */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* DRAFT Actions */}
              {isDraft && (
                <>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Pencil}
                    onClick={() => {
                      setEditTitle(exam.title);
                      setEditDescription(exam.description || "");
                      setShowEditMetadataModal(true);
                    }}
                  >
                    Sửa thông tin
                  </Button>
                  <Button
                    variant="success"
                    size="md"
                    icon={Send}
                    disabled={!isReadyToPublish}
                    onClick={() => setConfirmPublishOpen(true)}
                    title={
                      !hasExamCodes
                        ? "Cần tạo ít nhất một mã đề trước khi phát hành"
                        : !allCodesComplete
                        ? "Cần hoàn tất đủ đáp án cho tất cả mã đề trước khi phát hành"
                        : !hasTemplate
                        ? "Cần tạo mẫu phiếu OMR trước khi phát hành"
                        : "Phát hành kỳ thi để tiến hành chấm bài"
                    }
                  >
                    Phát hành kỳ thi
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Trash2}
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                  >
                    Xóa kỳ thi
                  </Button>
                </>
              )}

              {/* PUBLISHED Actions */}
              {isPublished && (
                <>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Pencil}
                    onClick={() => {
                      setEditTitle(exam.title);
                      setEditDescription(exam.description || "");
                      setShowEditMetadataModal(true);
                    }}
                    title="Chỉnh sửa tên và mô tả kỳ thi"
                  >
                    Sửa thông tin
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={ScanLine}
                    onClick={() => navigate(`/grade?examId=${exam.id}`)}
                  >
                    Chấm bài ngay
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Copy}
                    onClick={() => setConfirmCloneOpen(true)}
                    title="Nhân bản để tạo một bản Nháp mới"
                  >
                    Nhân bản
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Lock}
                    onClick={() => setConfirmCloseOpen(true)}
                  >
                    Đóng kỳ thi
                  </Button>
                </>
              )}

              {/* CLOSED Actions */}
              {isClosed && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    icon={Copy}
                    onClick={() => setConfirmCloneOpen(true)}
                  >
                    Nhân bản kỳ thi
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    icon={Archive}
                    onClick={() => setConfirmArchiveOpen(true)}
                  >
                    Lưu trữ kỳ thi
                  </Button>
                </>
              )}

              {/* ARCHIVED Actions */}
              {isArchived && (
                <Button
                  variant="primary"
                  size="md"
                  icon={Copy}
                  onClick={() => setConfirmCloneOpen(true)}
                >
                  Nhân bản kỳ thi
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <Alert
            variant="danger"
            className="mb-6"
            onClose={() => setErrorMsg("")}
          >
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert
            variant="success"
            className="mb-6"
            onClose={() => setSuccessMsg("")}
          >
            {successMsg}
          </Alert>
        )}

        {/* PUBLISHED Lock Explanation Banner */}
        {isPublished && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-semibold">
                  Kỳ thi đã được phát hành. Các cấu hình ảnh hưởng trực tiếp đến chấm điểm và phiếu OMR đã được khóa để đảm bảo tính toàn vẹn.
                </p>
                <p className="text-amber-800">
                  Nếu cần thay đổi số câu, thang điểm, mã đề hoặc đáp án, hãy nhân bản kỳ thi để tạo một bản Nháp mới.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={Copy}
              onClick={() => setConfirmCloneOpen(true)}
              className="shrink-0 bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60"
            >
              Nhân bản kỳ thi
            </Button>
          </div>
        )}

        {/* Two-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (4 cols on lg): Setup Checklist, OMR Template, Exam Codes */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Setup Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Quy trình thiết lập
              </h2>

              <div className="space-y-3 text-xs">
                {/* Step 1 */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                  <div className="flex items-center gap-2 font-medium text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>1. Thông tin kỳ thi</span>
                  </div>
                  <Badge variant="emerald" size="sm">
                    Đã tạo
                  </Badge>
                </div>

                {/* Step 2 */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    hasExamCodes
                      ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
                      : "bg-amber-50/70 border-amber-200/80 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {hasExamCodes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>2. Mã đề thi</span>
                  </div>
                  <Badge variant={hasExamCodes ? "emerald" : "amber"} size="sm">
                    {hasExamCodes ? `${examCodes.length} mã` : "Chưa có"}
                  </Badge>
                </div>

                {/* Step 3 */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    allCodesComplete
                      ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
                      : "bg-amber-50/70 border-amber-200/80 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {allCodesComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>3. Bảng đáp án</span>
                  </div>
                  <Badge
                    variant={allCodesComplete ? "emerald" : "amber"}
                    size="sm"
                  >
                    {allCodesComplete ? "Đủ đáp án" : "Chưa đủ"}
                  </Badge>
                </div>

                {/* Step 4 */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    hasTemplate
                      ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
                      : "bg-amber-50/70 border-amber-200/80 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {hasTemplate ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>4. Mẫu phiếu OMR</span>
                  </div>
                  <Badge variant={hasTemplate ? "emerald" : "amber"} size="sm">
                    {hasTemplate ? `Mẫu v${template.version}` : "Chưa tạo"}
                  </Badge>
                </div>

                {/* Step 5 */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    exam.status === "PUBLISHED"
                      ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {exam.status === "PUBLISHED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>5. Phát hành</span>
                  </div>
                  <Badge
                    variant={exam.status === "PUBLISHED" ? "emerald" : "gray"}
                    size="sm"
                  >
                    {exam.status === "PUBLISHED" ? "Đã phát hành" : "Nháp"}
                  </Badge>
                </div>
              </div>

              {isDraft && !hasTemplate && (
                <p className="text-[11px] text-slate-500 mt-3 italic leading-relaxed">
                  Gợi ý: Hãy tạo phiếu OMR và tải file PDF in thử trước khi phát
                  hành kỳ thi.
                </p>
              )}
            </div>

            {/* 2. OMR Template Panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Phiếu trả lời OMR
              </h2>

              {!template ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Chưa có phiếu trả lời OMR nào được tạo cho kỳ thi này. Hệ
                    thống sẽ sinh layout chuẩn ({exam.questionCount} câu) có
                    mã QR nhận diện.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={handleGenerateTemplate}
                    loading={generatingTemplate}
                    disabled={!isDraft}
                    className="w-full"
                  >
                    Tạo phiếu trả lời OMR
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phiên bản:</span>
                      <span className="font-semibold text-slate-800">
                        v{template.version} ({template.templateVersion})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Số trang:</span>
                      <span className="font-semibold text-slate-800">
                        {template.pageCount} trang ({template.questionsPerPage}{" "}
                        câu/trang)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mã định danh QR:</span>
                      <span className="font-mono text-slate-700 text-[11px]">
                        Tích hợp DB
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    onClick={handleDownloadPdf}
                    loading={downloadingPdf}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {downloadingPdf ? "Đang tải PDF..." : "Tải phiếu OMR PDF"}
                  </Button>

                  {isDraft && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={RefreshCw}
                      onClick={handleGenerateTemplate}
                      loading={generatingTemplate}
                      className="w-full text-xs"
                      title="Tạo lại phiếu sẽ sinh phiên bản mới."
                    >
                      Tạo lại phiếu OMR
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 3. Exam Code List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Mã đề thi ({examCodes.length})
                </h2>
              </div>

              {isDraft && (
                <form onSubmit={handleCreateCode} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Mã đề (VD: 001)"
                    value={newCodeInput}
                    onChange={(e) => setNewCodeInput(e.target.value)}
                    disabled={creatingCode}
                    className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    loading={creatingCode}
                    disabled={!newCodeInput.trim()}
                  >
                    Thêm
                  </Button>
                </form>
              )}

              {examCodes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 italic">
                  Chưa có mã đề nào. Vui lòng thêm ít nhất một mã đề.
                </p>
              ) : (
                <div className="space-y-2">
                  {examCodes.map((ec) => {
                    const isSelected = ec.id === selectedCodeId;
                    const answersCount = ec._count?.answerKeys || 0;
                    const isComplete = answersCount === exam.questionCount;

                    return (
                      <div
                        key={ec.id}
                        onClick={() => setSelectedCodeId(ec.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 ring-1 ring-blue-500 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {ec.code}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-800 block">
                              Mã đề {ec.code}
                            </span>
                            <span
                              className={`text-[11px] font-medium flex items-center gap-1 ${
                                isComplete
                                  ? "text-emerald-600"
                                  : "text-amber-600"
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertCircle className="w-3 h-3" />
                              )}
                              {answersCount}/{exam.questionCount} đáp án
                            </span>
                          </div>
                        </div>

                        {isDraft && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCodeToDelete(ec);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa mã đề này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (8 cols on lg): Answer Key Workspace */}
          <div className="lg:col-span-8">
            {!selectedCodeId ? (
              <EmptyState
                icon={FileText}
                title="Chưa chọn mã đề"
                description="Chọn một mã đề ở khung bên trái hoặc tạo mã đề mới để xem và nhập bảng đáp án."
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                {/* Header for Answer Key Workspace */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      Đáp án Mã đề{" "}
                      <span className="text-blue-600">
                        {examCodes.find((c) => c.id === selectedCodeId)?.code}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {exam.scoringType === "EQUAL" ? (
                        <>
                          Chia đều điểm:{" "}
                          <span className="font-semibold text-slate-700">
                            {(maxScore / exam.questionCount).toFixed(2)}đ / câu
                          </span>
                        </>
                      ) : (
                        <>
                          Điểm tùy biến: Hiện tại{" "}
                          <span className="font-bold text-slate-800">
                            {roundedTotalScore}
                          </span>{" "}
                          / {maxScore}đ{" "}
                          {Math.abs(roundedTotalScore - maxScore) < 0.0001 ? (
                            <span className="text-emerald-600 font-semibold">
                              (Hợp lệ)
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">
                              (Chưa khớp {maxScore}đ)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Actions: Import & Save */}
                  <div className="flex items-center gap-2">
                    {isDraft && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Upload}
                        onClick={() => setShowImportModal(true)}
                      >
                        Nhập từ File
                      </Button>
                    )}

                    {isDraft && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Save}
                        onClick={handleSaveAnswers}
                        loading={savingAnswers}
                      >
                        {savingAnswers ? "Đang lưu..." : "Lưu đáp án"}
                      </Button>
                    )}
                  </div>
                </div>

                {isLocked && (
                  <Alert variant="warning">
                    Kỳ thi đã phát hành. Bảng đáp án đang ở chế độ{" "}
                    <strong>chỉ đọc</strong> nhằm đảm bảo tính bảo mật và công
                    bằng khi chấm bài.
                  </Alert>
                )}

                {/* Compact Multi-Column Question Bubble Matrix */}
                {loadingAnswers ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
                    <span className="text-sm font-medium">
                      Đang tải bảng đáp án...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      className={`grid gap-3 ${
                        exam.scoringType === "CUSTOM"
                          ? "grid-cols-1 sm:grid-cols-2"
                          : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                      }`}
                    >
                      {answers.map((ans) => (
                        <div
                          key={ans.questionNumber}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            ans.correctAnswer
                              ? "bg-slate-50/70 border-slate-200"
                              : "bg-white border-dashed border-slate-300"
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-700 w-14 shrink-0">
                            Câu {ans.questionNumber}
                          </span>

                          {/* Bubble Buttons A, B, C, D */}
                          <div className="flex items-center gap-1.5">
                            {["A", "B", "C", "D"].map((opt) => {
                              const isSelected = ans.correctAnswer === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() =>
                                    handleSelectAnswer(ans.questionNumber, opt)
                                  }
                                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center cursor-pointer select-none ${
                                    isSelected
                                      ? "bg-blue-600 text-white shadow-xs scale-105"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:hover:bg-slate-100"
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {/* Per-question score input for CUSTOM */}
                          {exam.scoringType === "CUSTOM" && (
                            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 ml-2">
                              <input
                                type="number"
                                step="0.05"
                                min={0.05}
                                max={10}
                                disabled={isLocked}
                                value={ans.score}
                                onChange={(e) =>
                                  handleScoreChange(
                                    ans.questionNumber,
                                    e.target.value
                                  )
                                }
                                className="w-14 px-1.5 py-1 text-xs text-center border border-slate-300 rounded bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-[11px] text-slate-400">
                                đ
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {isDraft && (
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                        <Button
                          variant="primary"
                          size="md"
                          icon={Save}
                          onClick={handleSaveAnswers}
                          loading={savingAnswers}
                        >
                          {savingAnswers
                            ? "Đang lưu bảng đáp án..."
                            : "Lưu toàn bộ đáp án"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===================================================== */}
      {/* MODAL: Edit Safe Metadata */}
      {/* ===================================================== */}
      <Modal
        isOpen={showEditMetadataModal}
        onClose={() => !savingMetadata && setShowEditMetadataModal(false)}
        title="Chỉnh sửa thông tin kỳ thi"
        description={
          isPublished
            ? "Chỉnh sửa tên và ghi chú kỳ thi. Các cấu hình thang điểm và chấm thi đã được khóa an toàn."
            : "Chỉnh sửa thông tin cơ bản của kỳ thi."
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditMetadataModal(false)}
              disabled={savingMetadata}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveMetadata}
              loading={savingMetadata}
            >
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveMetadata} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên kỳ thi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={savingMetadata}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mô tả / Ghi chú
            </label>
            <textarea
              rows={3}
              disabled={savingMetadata}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Ghi chú về kỳ thi..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Display locked fields for teacher clarity */}
          {isPublished && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-500">
              <span className="font-semibold text-slate-700 block uppercase tracking-wider text-[11px]">
                Các trường cấu hình đã khóa (Không thể chỉnh sửa sau khi phát hành):
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Môn học: <strong className="text-slate-700">{exam.subject?.name}</strong></div>
                <div>Lớp: <strong className="text-slate-700">{exam.class?.name}</strong></div>
                <div>Số câu: <strong className="text-slate-700">{exam.questionCount} câu</strong></div>
                <div>Thang điểm: <strong className="text-slate-700">{Number(exam.maxScore)}đ</strong></div>
                <div className="col-span-2">Hình thức tính điểm: <strong className="text-slate-700">{formatScoringType(exam.scoringType)}</strong></div>
              </div>
              <p className="text-[10px] text-amber-700 italic pt-1 border-t border-slate-200">
                Nếu cần điều chỉnh các trường trên, hãy sử dụng tính năng "Nhân bản kỳ thi".
              </p>
            </div>
          )}
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Clone Exam Confirmation */}
      {/* ===================================================== */}
      <Modal
        isOpen={confirmCloneOpen}
        onClose={() => !actionLoading && setConfirmCloneOpen(false)}
        title="Nhân bản kỳ thi?"
        description="Hệ thống sẽ tạo một kỳ thi mới ở trạng thái Nháp, sao chép mã đề và đáp án. Phiếu OMR cũ sẽ không được sao chép."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmCloneOpen(false)}
              disabled={actionLoading}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Copy}
              onClick={handleClone}
              loading={actionLoading}
            >
              Nhân bản
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Bạn có muốn nhân bản kỳ thi <strong>"{exam.title}"</strong> thành một bản Nháp mới?
          </p>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div>&bull; Kỳ thi mới sẽ mang tên: <strong className="text-slate-800">{exam.title} - Bản sao</strong></div>
            <div>&bull; Giữ nguyên số câu hỏi ({exam.questionCount} câu), môn học, lớp và hình thức chấm.</div>
            <div>&bull; Sao chép toàn bộ <strong>{examCodes.length} mã đề</strong> và bảng đáp án hiện tại.</div>
            <div>&bull; <strong>Lưu ý:</strong> Mẫu phiếu OMR cũ sẽ không sao chép để đảm bảo an toàn mã QR. Bạn cần tạo mẫu phiếu mới sau khi nhân bản.</div>
          </div>
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Import Answer Key from Excel / CSV */}
      {/* ===================================================== */}
      <Modal
        isOpen={showImportModal}
        onClose={() => !importing && setShowImportModal(false)}
        title="Nhập đáp án từ file Excel / CSV"
        description="Hệ thống hỗ trợ nhập hàng loạt đáp án cho tất cả mã đề thông qua file bảng tính."
        maxWidth="max-w-xl"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(false)}
              disabled={importing}
            >
              Đóng
            </Button>
            {importPreview?.valid && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyImport}
                loading={importing}
              >
                {importing ? "Đang áp dụng..." : "Xác nhận nhập đáp án"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {/* Download Sample Files */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 block mb-2">
              Tải file mẫu chuẩn định dạng:
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="xs"
                icon={Download}
                onClick={() => handleDownloadImportTemplate("xlsx")}
              >
                Mẫu Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="xs"
                icon={Download}
                onClick={() => handleDownloadImportTemplate("csv")}
              >
                Mẫu CSV (.csv)
              </Button>
            </div>
          </div>

          {/* File Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn file đáp án của bạn
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              disabled={previewLoading || importing}
              onChange={(e) => {
                setImportFile(e.target.files[0] || null);
                setImportPreview(null);
              }}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          {/* Preview Button */}
          {importFile && !importPreview && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFilePreview}
              loading={previewLoading}
              className="w-full"
            >
              {previewLoading
                ? "Đang kiểm tra cấu trúc..."
                : "Kiểm tra tính hợp lệ (Preview)"}
            </Button>
          )}

          {/* Preview Feedback */}
          {importPreview && (
            <div>
              {importPreview.valid ? (
                <Alert variant="success" title="File hợp lệ để nhập dữ liệu">
                  <div className="space-y-1 mt-1 text-xs">
                    <div>
                      &bull; Tìm thấy{" "}
                      <strong>{importPreview.summary?.rows}</strong> dòng dữ liệu
                      cho{" "}
                      <strong>{importPreview.summary?.examCodes}</strong> mã đề.
                    </div>
                    <div>
                      &bull; Mã đề phát hiện:{" "}
                      {importPreview.codes
                        ?.map((c) => `${c.code} (${c.answerCount} câu)`)
                        .join(", ")}
                    </div>
                  </div>
                </Alert>
              ) : (
                <Alert variant="danger" title="File chứa lỗi không thể nhập">
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                    {importPreview.errors?.slice(0, 5).map((err, idx) => (
                      <li key={idx}>
                        {err.row ? `Dòng ${err.row}: ` : ""}
                        {err.message}
                      </li>
                    ))}
                    {importPreview.errors?.length > 5 && (
                      <li>
                        ...và {importPreview.errors.length - 5} lỗi khác.
                      </li>
                    )}
                  </ul>
                </Alert>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Confirmation Publish */}
      {/* ===================================================== */}
      <Modal
        isOpen={confirmPublishOpen}
        onClose={() => !actionLoading && setConfirmPublishOpen(false)}
        title="Xác nhận Phát hành kỳ thi"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmPublishOpen(false)}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handlePublish}
              loading={actionLoading}
            >
              Đồng ý phát hành
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Bạn có chắc chắn muốn phát hành kỳ thi{" "}
            <strong>"{exam.title}"</strong>?
          </p>
          <Alert variant="warning" title="Lưu ý quan trọng">
            Sau khi phát hành, cấu hình số câu, thang điểm, mã đề và bảng đáp án
            sẽ bị <strong>khóa an toàn</strong> để đảm bảo tính pháp lý và toàn
            vẹn khi chấm thi.
          </Alert>
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Confirmation Close */}
      {/* ===================================================== */}
      <Modal
        isOpen={confirmCloseOpen}
        onClose={() => !actionLoading && setConfirmCloseOpen(false)}
        title="Đóng kỳ thi"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmCloseOpen(false)}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClose}
              loading={actionLoading}
            >
              Xác nhận đóng
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Sau khi đóng, kỳ thi <strong>"{exam.title}"</strong> sẽ không nhận thêm
          bài chấm mới. Bạn có chắc chắn muốn đóng kỳ thi?
        </p>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Confirmation Archive */}
      {/* ===================================================== */}
      <Modal
        isOpen={confirmArchiveOpen}
        onClose={() => !actionLoading && setConfirmArchiveOpen(false)}
        title="Lưu trữ kỳ thi"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmArchiveOpen(false)}
              disabled={actionLoading}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleArchive}
              loading={actionLoading}
            >
              Lưu trữ kỳ thi
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Kỳ thi <strong>"{exam.title}"</strong> sẽ được chuyển vào lưu trữ và
          ẩn khỏi danh sách làm việc mặc định.
        </p>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL: Confirmation Delete Exam (DRAFT ONLY) */}
      {/* ===================================================== */}
      {isDraft && (
        <Modal
          isOpen={confirmDeleteOpen}
          onClose={() => !actionLoading && setConfirmDeleteOpen(false)}
          title="Xóa vĩnh viễn kỳ thi?"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={actionLoading}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteExam}
                loading={actionLoading}
              >
                Xóa vĩnh viễn
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Bạn có chắc chắn muốn xóa kỳ thi <strong>"{exam.title}"</strong>?
            </p>
            <Alert variant="danger">
              Hành động này sẽ xóa cấu hình kỳ thi, mã đề, đáp án và mẫu phiếu
              chưa sử dụng. Không thể hoàn tác.
            </Alert>
          </div>
        </Modal>
      )}

      {/* ===================================================== */}
      {/* MODAL: Confirmation Delete Code (DRAFT ONLY) */}
      {/* ===================================================== */}
      {isDraft && (
        <Modal
          isOpen={!!codeToDelete}
          onClose={() => !actionLoading && setCodeToDelete(null)}
          title="Xóa mã đề thi"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCodeToDelete(null)}
                disabled={actionLoading}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDeleteCodeAction}
                loading={actionLoading}
              >
                Xác nhận xóa
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            Bạn có chắc muốn xóa mã đề <strong>{codeToDelete?.code}</strong>? Toàn
            bộ đáp án của mã đề này sẽ bị xóa.
          </p>
        </Modal>
      )}
    </div>
  );
}
