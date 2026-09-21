import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import { getErrorMessage, mapQualityWarning } from "../utils/error-map";
import { examDetailPath } from "../utils/slug";
import {
  formatScoringType,
  formatOmrStatus,
} from "../utils/enum-map";
import {
  ScanLine,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Settings,
  ChevronDown,
  Zap,
  Loader2,
  FileSpreadsheet,
  Check,
  ArrowLeft,
  ArrowRight,
  Eye,
  Layers,
  BarChart3,
  FileCheck,
  ExternalLink,
  Clock,
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import GradingIdentityModal from "../components/grading/GradingIdentityModal";
import GradingManualReviewModal from "../components/grading/GradingManualReviewModal";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { submissionId: routeSubmissionId } = useParams();
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const batchPollIntervalRef = useRef(null);

  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");

  // Mode: SINGLE (chấm từng bài) | BATCH (chấm hàng loạt)
  const [gradingMode, setGradingMode] = useState("SINGLE");
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [batchResults, setBatchResults] = useState([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchFallbackWarning, setBatchFallbackWarning] = useState("");

  // Template readiness state: 'loading' | 'ready' | 'missing' | 'multipage' | 'error'
  const [templateStatus, setTemplateStatus] = useState("loading");
  const [templateData, setTemplateData] = useState(null);
  const [templateErrorMsg, setTemplateErrorMsg] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageMeta, setImageMeta] = useState(null); // { name, sizeStr, width, height }
  const [isDragActive, setIsDragActive] = useState(false);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfErrorMsg, setPdfErrorMsg] = useState("");
  const [duplicateSubmissionId, setDuplicateSubmissionId] = useState(null);

  // Teacher manual review workflow state
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [tableFilter, setTableFilter] = useState("ALL");

  // Phase 6 Persistent Identity & Audit & Crops
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [sbdInput, setSbdInput] = useState("");
  const [isSubmittingIdentity, setIsSubmittingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [cropBlobUrls, setCropBlobUrls] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);

  // Exam live statistics & recent submissions
  const [examSummary, setExamSummary] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchExamStats = async (examId) => {
    if (!examId) return;
    try {
      setLoadingStats(true);
      const [summaryRes, subRes] = await Promise.allSettled([
        api.get(`/exams/${examId}/submissions/summary`),
        api.get(`/exams/${examId}/submissions?pageSize=5&sort=createdAt&order=desc`),
      ]);
      if (summaryRes.status === "fulfilled") {
        setExamSummary(summaryRes.value.data.data);
      }
      if (subRes.status === "fulfilled") {
        setRecentSubmissions(subRes.value.data.submissions || []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingStats(false);
    }
  };

  // Clean up preview object URL and batch polling on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
      if (batchPollIntervalRef.current) {
        clearInterval(batchPollIntervalRef.current);
      }
    };
  }, [previewUrl]);

  // Load published exams
  useEffect(() => {
    fetchPublishedExams();
  }, [navigate]);

  const fetchPublishedExams = async () => {
    try {
      setLoadingExams(true);
      setErrorMsg("");
      const res = await api.get("/exams?status=PUBLISHED");
      const list = res.data.data || [];
      setExams(list);
      if (list.length > 0) {
        const queryExamId = searchParams.get("examId");
        if (queryExamId && list.some((e) => e.id === queryExamId)) {
          setSelectedExamId(queryExamId);
        } else {
          setSelectedExamId(list[0].id);
        }
      }
    } catch {
      setErrorMsg("Không thể tải danh sách kỳ thi đã phát hành.");
    } finally {
      setLoadingExams(false);
    }
  };

  // Load persisted submission if route parameter is present
  useEffect(() => {
    if (!routeSubmissionId) return;

    let active = true;
    setGradingLoading(true);
    setErrorMsg("");

    api
      .get(`/submissions/${routeSubmissionId}`)
      .then(async (res) => {
        if (!active) return;
        const sub = res.data.data;
        setGradingResult(sub);
        if (sub.exam?.id) {
          setSelectedExamId(sub.exam.id);
        }
        if (sub.auditLogs) {
          setAuditLogs(sub.auditLogs);
        }

        // Fetch authenticated original image blob
        if (sub.image?.url) {
          try {
            const imgRes = await api.get(sub.image.url, { responseType: "blob" });
            if (active) {
              const url = window.URL.createObjectURL(imgRes.data);
              setPreviewUrl((prev) => {
                if (prev) window.URL.revokeObjectURL(prev);
                return url;
              });
              setImageMeta({
                name: `submission-${sub.id}.jpg`,
                sizeStr: `${Math.round(sub.image.sizeBytes / 1024)} KB`,
                width: sub.image.width,
                height: sub.image.height,
              });
            }
          } catch (imgErr) {
            console.warn("Could not load authenticated image blob:", imgErr);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        const code = err.response?.data?.error?.code;
        const rawMsg = err.response?.data?.error?.message;
        setErrorMsg(getErrorMessage(code, rawMsg || "Không thể tải thông tin bài nộp."));
      })
      .finally(() => {
        if (active) setGradingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [routeSubmissionId]);

  // Clean up crop blob URLs on unmount or change
  useEffect(() => {
    return () => {
      Object.values(cropBlobUrls).forEach((url) => {
        if (url) window.URL.revokeObjectURL(url);
      });
    };
  }, [cropBlobUrls]);

  // Check template readiness whenever selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setTemplateStatus("missing");
      setTemplateData(null);
      return;
    }

    // Clear previous file, image preview, results, and errors only when not loading a persisted submission
    if (!routeSubmissionId) {
      setSelectedFile(null);
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setImageMeta(null);
      setGradingResult(null);
      setDuplicateSubmissionId(null);
    }
    setErrorMsg("");
    setPdfErrorMsg("");
    setTemplateErrorMsg("");
    setReviewOverrides({});
    setIsReviewModalOpen(false);
    setReviewIndex(0);
    setTableFilter("ALL");

    const controller = new AbortController();
    setTemplateStatus("loading");
    fetchExamStats(selectedExamId);

    api
      .get(`/exams/${selectedExamId}/answer-sheet-template`, {
        signal: controller.signal,
      })
      .then((res) => {
        const tpl = res.data.data;
        setTemplateData(tpl);
        if (tpl && tpl.pageCount > 1) {
          setTemplateStatus("multipage");
        } else {
          setTemplateStatus("ready");
        }
      })
      .catch((err) => {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        setTemplateData(null);
        if (err.response?.status === 404) {
          setTemplateStatus("missing");
        } else {
          setTemplateStatus("error");
          setTemplateErrorMsg(
            err.response?.data?.error?.message ||
              "Lỗi kiểm tra mẫu phiếu trả lời."
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedExamId, routeSubmissionId]);

  const handleFileChange = (file) => {
    if (!file) return;

    if (templateStatus !== "ready") {
      setErrorMsg(
        "Kỳ thi này chưa có phiếu trả lời OMR hoặc không hợp lệ để chấm."
      );
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    const ext = (file.name || "").toLowerCase();
    const isValidExt =
      ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".png");

    if (!allowedTypes.includes(file.type) && !isValidExt) {
      setErrorMsg(getErrorMessage("IMAGE_TYPE_INVALID"));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg(getErrorMessage("IMAGE_TOO_LARGE"));
      return;
    }

    setErrorMsg("");
    setSelectedFile(file);
    setGradingResult(null);
    setReviewOverrides({});
    setIsReviewModalOpen(false);
    setReviewIndex(0);
    setTableFilter("ALL");

    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }

    const url = window.URL.createObjectURL(file);
    setPreviewUrl(url);

    const sizeStr =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
        : Math.round(file.size / 1024) + " KB";

    const img = new Image();
    img.onload = () => {
      setImageMeta({
        name: file.name,
        sizeStr,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = url;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (templateStatus !== "ready") return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (templateStatus !== "ready") return;
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  // Download Answer Sheet PDF
  const handleDownloadPdf = async () => {
    if (!selectedExamId || templateStatus === "missing") return;

    try {
      setDownloadingPdf(true);
      setPdfErrorMsg("");

      const res = await api.get(
        `/exams/${selectedExamId}/answer-sheet-template/pdf`,
        {
          responseType: "blob",
        }
      );

      const cleanTitle = (selectedExam?.title || "exam")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const blob = new Blob([res.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `phieu-omr-${cleanTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (err.response?.status === 404) {
        setPdfErrorMsg(
          "Kỳ thi này chưa có mẫu phiếu trả lời được tạo trong hệ thống."
        );
      } else {
        setPdfErrorMsg(
          "Không thể tải file PDF mẫu phiếu. Vui lòng thử lại sau."
        );
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleGrade = async () => {
    if (!selectedExamId) {
      setErrorMsg("Vui lòng chọn kỳ thi cần chấm.");
      return;
    }

    if (templateStatus !== "ready") {
      setErrorMsg(
        "Kỳ thi này chưa có phiếu trả lời OMR. Hãy tạo phiếu trả lời trước khi chấm bài."
      );
      return;
    }

    if (!selectedFile) {
      setErrorMsg("Vui lòng chọn hoặc kéo thả ảnh bài thi.");
      return;
    }

    try {
      setGradingLoading(true);
      setErrorMsg("");
      setDuplicateSubmissionId(null);
      setGradingResult(null);

      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await api.post(
        `/exams/${selectedExamId}/submissions`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const sub = res.data.data;
      setGradingResult(sub);
      if (sub.auditLogs) setAuditLogs(sub.auditLogs);
      navigate(`/submissions/${sub.id}`);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      if (code === "DUPLICATE_SUBMISSION_IMAGE") {
        const existingId =
          err.response?.data?.error?.details?.existingSubmissionId ||
          err.response?.data?.data?.existingSubmissionId;
        setDuplicateSubmissionId(existingId || null);
        setErrorMsg("Ảnh bài thi này đã được chấm trước đó cho kỳ thi này.");
      } else {
        setErrorMsg(getErrorMessage(code, rawMsg));
      }
    } finally {
      setGradingLoading(false);
    }
  };

  const handleBatchFilesChange = (filesList) => {
    if (!filesList || filesList.length === 0) return;
    const valid = Array.from(filesList).filter((f) =>
      ["image/jpeg", "image/png", "image/jpg"].includes(f.type)
    );
    setBatchFiles(valid);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: valid.length, percentage: 0 });
  };

  const handleBatchGrade = async () => {
    if (batchFiles.length === 0 || !selectedExamId) return;
    setIsBatchRunning(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: batchFiles.length, percentage: 0 });
    setBatchFallbackWarning("");

    try {
      // 1. Enqueue batch via BullMQ queue endpoint
      const formData = new FormData();
      batchFiles.forEach((file) => {
        formData.append("images", file);
      });

      const batchRes = await api.post(
        `/exams/${selectedExamId}/submissions/batch`,
        formData
      );

      const batchData = batchRes.data?.data;
      if (batchData?.batchId) {
        const batchId = batchData.batchId;
        const total = batchData.total || batchFiles.length;

        // Poll GET /api/exams/:examId/batches/:batchId every 1500ms
        await new Promise((resolve) => {
          batchPollIntervalRef.current = setInterval(async () => {
            try {
              const statusRes = await api.get(`/exams/${selectedExamId}/batches/${batchId}`);
              const record = statusRes.data?.data;
              if (!record) return;

              const completed = record.completed || 0;
              const failed = record.failed || 0;
              const current = completed + failed;
              const percent = record.progressPercent !== undefined
                ? record.progressPercent
                : Math.min(100, Math.round((current / total) * 100));

              setBatchProgress({
                current,
                total,
                percentage: percent,
              });

              if (Array.isArray(record.results) && record.results.length > 0) {
                const mapped = record.results.map((r, idx) => ({
                  fileName: r.filename || `Bài ${idx + 1}`,
                  status: r.status === "success" ? "SUCCESS" : "ERROR",
                  submissionId: r.submissionId || null,
                  sbd: r.studentCode || "Chưa rõ",
                  examCode: "—",
                  finalScore: r.score !== undefined && r.score !== null ? Number(r.score) : null,
                  maxScore: selectedExam?.maxScore ? Number(selectedExam.maxScore) : 10,
                  needsReview: false,
                  message: r.status === "success" ? "Hoàn tất" : (r.error || "Lỗi xử lý"),
                }));
                setBatchResults(mapped);
              }

              // Check completion
              if (
                percent >= 100 ||
                record.status === "completed" ||
                record.status === "completed_with_errors" ||
                record.status === "failed" ||
                current >= total
              ) {
                clearInterval(batchPollIntervalRef.current);
                batchPollIntervalRef.current = null;
                resolve();
              }
            } catch (pollErr) {
              console.warn("Lỗi kiểm tra tiến trình chấm bài hàng loạt:", pollErr);
            }
          }, 1500);
        });

        setIsBatchRunning(false);
        fetchExamStats(selectedExamId);
        return;
      }
    } catch (batchErr) {
      console.warn(
        "Chấm hàng loạt qua hàng đợi BullMQ không phản hồi, tự động chuyển sang chế độ chấm liên tiếp:",
        batchErr
      );
      setBatchFallbackWarning(
        "Hàng đợi xử lý (Redis/BullMQ) hiện không khả dụng. Hệ thống đang chuyển sang xử lý tuần tự."
      );
    }

    // Fallback: sequential direct uploads
    const results = [];
    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      setBatchProgress({
        current: i + 1,
        total: batchFiles.length,
        percentage: Math.round(((i + 1) / batchFiles.length) * 100),
      });

      try {
        const formData = new FormData();
        formData.append("image", file);
        const res = await api.post(`/exams/${selectedExamId}/submissions`, formData);
        const sub = res.data.data;
        const item = {
          fileName: file.name,
          status: "SUCCESS",
          submissionId: sub.id,
          sbd: sub.resolvedStudentNumber || sub.detectedStudentNumber || "Chưa rõ",
          examCode: sub.examCodeSnapshot || "—",
          finalScore: sub.finalScore !== null ? Number(sub.finalScore) : null,
          maxScore: sub.maxScoreSnapshot || 10,
          needsReview: sub.identityNeedsReview || sub.status === "PROVISIONAL",
          message: sub.identityNeedsReview ? "Cần xác nhận SBD" : "Hoàn tất",
        };
        results.push(item);
        setBatchResults([...results]);
      } catch (err) {
        const code = err.response?.data?.error?.code;
        const msg = err.response?.data?.error?.message || "Lỗi xử lý ảnh";
        const item = {
          fileName: file.name,
          status: "ERROR",
          submissionId: err.response?.data?.error?.details?.existingSubmissionId || null,
          sbd: "—",
          examCode: "—",
          finalScore: null,
          maxScore: 10,
          needsReview: false,
          message: code === "DUPLICATE_SUBMISSION_IMAGE" ? "Ảnh đã chấm trước đó" : msg,
        };
        results.push(item);
        setBatchResults([...results]);
      }
    }

    setIsBatchRunning(false);
    fetchExamStats(selectedExamId);
  };

  // Submit manual teacher reviews and re-grade
  const handleApplyReview = async () => {
    const subId = gradingResult?.id || routeSubmissionId;
    if (!subId) return;

    try {
      setIsSubmittingReview(true);
      setReviewError("");

      const list = Object.entries(reviewOverrides).map(([num, val]) => {
        const qn = Number(num);
        if (val.resolution === "ANSWER") {
          return { questionNumber: qn, resolution: "ANSWER", answer: val.answer };
        }
        return { questionNumber: qn, resolution: val.resolution };
      });

      const res = await api.patch(`/submissions/${subId}/review`, {
        reviews: list,
      });

      const updatedSub = res.data.data;
      setGradingResult(updatedSub);
      if (updatedSub.auditLogs) setAuditLogs(updatedSub.auditLogs);
      setReviewOverrides({});
      setIsReviewModalOpen(false);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      setReviewError(getErrorMessage(code, rawMsg));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Submit student candidate number (SBD) review
  const handleSaveIdentity = async () => {
    const subId = gradingResult?.id || routeSubmissionId;
    if (!subId) return;

    const cleanSbd = sbdInput.trim();
    if (!/^\d{6}$/.test(cleanSbd)) {
      setIdentityError("Số báo danh phải bao gồm đúng 6 chữ số.");
      return;
    }

    try {
      setIsSubmittingIdentity(true);
      setIdentityError("");

      const res = await api.patch(`/submissions/${subId}/identity`, {
        studentNumber: cleanSbd,
      });

      const updatedSub = res.data.data;
      setGradingResult(updatedSub);
      if (updatedSub.auditLogs) setAuditLogs(updatedSub.auditLogs);
      setIsIdentityModalOpen(false);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      setIdentityError(getErrorMessage(code, rawMsg));
    } finally {
      setIsSubmittingIdentity(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  // Review queue: all questions needing review, with uncertainty/multiple, or already reviewed
  const questionsList = gradingResult?.grading?.questions || [];
  const reviewQueue = questionsList.filter(
    (q) =>
      q.needsReview ||
      q.resolvedByTeacher ||
      q.omrStatus === "MULTIPLE" ||
      q.omrStatus === "UNCERTAIN"
  );
  const safeReviewIndex = Math.min(
    reviewIndex,
    Math.max(0, reviewQueue.length - 1)
  );
  const currentReviewQuestion = reviewQueue[safeReviewIndex] || null;

  // Helper to determine whether question was graded as correct
  const isQuestionCorrect = (q) =>
    q.isCorrect === true ||
    q.result === "CORRECT" ||
    (q.scoreEarned !== null && q.scoreEarned > 0);

  // Load review crop blob URL on demand when modal opens or question changes
  useEffect(() => {
    if (!isReviewModalOpen || !currentReviewQuestion) return;
    const qn = currentReviewQuestion.questionNumber;
    const rawCropUrl = currentReviewQuestion.reviewCropUrl;
    if (rawCropUrl && !cropBlobUrls[qn]) {
      // Strip leading /api if baseURL already includes /api to avoid /api/api double prefix
      const cleanUrl = rawCropUrl.startsWith("/api/")
        ? rawCropUrl.replace(/^\/api/, "")
        : rawCropUrl;
      api
        .get(cleanUrl, { responseType: "blob" })
        .then((res) => {
          const url = window.URL.createObjectURL(res.data);
          setCropBlobUrls((prev) => ({ ...prev, [qn]: url }));
        })
        .catch((err) => {
          console.warn(`Could not load crop for Q${qn}:`, err);
        });
    }
  }, [isReviewModalOpen, currentReviewQuestion]);

  // Question table counts & filter
  const countAll = questionsList.length;
  const countIncorrect = questionsList.filter(
    (q) => !isQuestionCorrect(q) && q.omrStatus !== "BLANK" && !q.needsReview && q.omrStatus !== "MULTIPLE_INVALID" && q.teacherResolution !== "MULTIPLE_INVALID"
  ).length;
  const countBlank = questionsList.filter((q) => q.omrStatus === "BLANK").length;
  const countReview = questionsList.filter(
    (q) =>
      q.needsReview ||
      q.omrStatus === "MULTIPLE" ||
      q.omrStatus === "UNCERTAIN"
  ).length;
  const countResolved = questionsList.filter((q) => q.resolvedByTeacher).length;

  const filteredQuestions = questionsList.filter((q) => {
    if (tableFilter === "INCORRECT") {
      return !isQuestionCorrect(q) && q.omrStatus !== "BLANK" && !q.needsReview && q.omrStatus !== "MULTIPLE_INVALID" && q.teacherResolution !== "MULTIPLE_INVALID";
    }
    if (tableFilter === "BLANK") return q.omrStatus === "BLANK";
    if (tableFilter === "REVIEW") {
      return (
        q.needsReview ||
        q.omrStatus === "MULTIPLE" ||
        q.omrStatus === "UNCERTAIN"
      );
    }
    if (tableFilter === "RESOLVED") return q.resolvedByTeacher;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ScanLine className="w-6 h-6 text-blue-600" />
              Chấm thi Trắc nghiệm OMR
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Nhận diện tự động mã QR, số báo danh, mã đề và chấm điểm theo đáp
              án chính thức.
            </p>
          </div>
        </div>

        {/* 12-Column Responsive Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (4 cols on lg): Select Exam & Upload Dropzone */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Exam Selector Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Chọn kỳ thi
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kỳ thi đã phát hành
                </label>
                {loadingExams ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Đang tải danh sách kỳ thi...</span>
                  </div>
                ) : exams.length === 0 ? (
                  <Alert variant="danger" className="text-xs py-2 px-3">
                    Chưa có kỳ thi nào được phát hành để chấm bài.
                  </Alert>
                ) : (
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
                  >
                    {exams.map((ex) => {
                      const classNames =
                        ex.examClasses && ex.examClasses.length > 0
                          ? ex.examClasses.map((ec) => ec.class?.name).filter(Boolean).join(", ")
                          : ex.class?.name || (ex.grade ? `Khối ${ex.grade.name}` : "Toàn khối");
                      return (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.subject?.name || "Môn"} - {classNames} |{" "}
                          {ex.durationMinutes ? `${ex.durationMinutes}p, ` : ""}
                          {ex.questionCount} câu)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {selectedExam && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Môn học / Lớp:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {selectedExam.subject?.name} &bull;{" "}
                      {selectedExam.examClasses && selectedExam.examClasses.length > 0
                        ? selectedExam.examClasses.map((ec) => ec.class?.name).filter(Boolean).join(", ")
                        : selectedExam.class?.name || (selectedExam.grade ? `Khối ${selectedExam.grade.name}` : "Chưa chọn")}
                    </span>
                  </div>
                  {selectedExam.durationMinutes && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Thời gian làm bài:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedExam.durationMinutes} phút
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quy mô đề:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedExam.questionCount} câu hỏi
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thang điểm:</span>
                    <span className="font-semibold text-slate-800">
                      {Number(selectedExam.maxScore)}đ (
                      {formatScoringType(selectedExam.scoringType)})
                    </span>
                  </div>

                  {/* Template Readiness Status */}
                  <div className="pt-2 mt-2 border-t border-slate-200/80">
                    {templateStatus === "loading" && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Kiểm tra mẫu phiếu OMR...</span>
                      </div>
                    )}

                    {templateStatus === "ready" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sẵn sàng chấm OMR
                          </span>
                          <span className="text-slate-500">
                            v{templateData?.version}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Download}
                          onClick={handleDownloadPdf}
                          loading={downloadingPdf}
                          className="w-full"
                        >
                          {downloadingPdf ? "Đang tải PDF..." : "Tải phiếu OMR PDF"}
                        </Button>
                      </div>
                    )}

                    {templateStatus === "missing" && (
                      <div className="space-y-2">
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Chưa có phiếu trả lời OMR
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Settings}
                          onClick={() => navigate(examDetailPath(selectedExam || selectedExamId))}
                          className="w-full"
                        >
                          Thiết lập kỳ thi
                        </Button>
                      </div>
                    )}

                    {templateStatus === "multipage" && (
                      <div className="space-y-2">
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Phiếu {templateData?.pageCount} trang (chỉ hỗ trợ 1 trang)
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          icon={Download}
                          onClick={handleDownloadPdf}
                          loading={downloadingPdf}
                          className="w-full"
                        >
                          Tải phiếu OMR PDF
                        </Button>
                      </div>
                    )}

                    {pdfErrorMsg && (
                      <p className="text-[11px] text-rose-600 mt-1">
                        {pdfErrorMsg}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Image Upload Card */}
            {/* 2. Mode & Image Upload Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Chế độ chấm bài
                </h2>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setGradingMode("SINGLE")}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    gradingMode === "SINGLE"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  Chấm từng bài
                </button>
                <button
                  type="button"
                  onClick={() => setGradingMode("BATCH")}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    gradingMode === "BATCH"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Chấm hàng loạt
                </button>
              </div>

              {/* SINGLE MODE */}
              {gradingMode === "SINGLE" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Tải ảnh phiếu thi</span>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (templateStatus === "ready") {
                            fileInputRef.current?.click();
                          }
                        }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Chọn ảnh khác
                      </button>
                    )}
                  </div>

                  {/* Dropzone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => {
                      if (templateStatus === "ready") {
                        fileInputRef.current?.click();
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      templateStatus !== "ready"
                        ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                        : isDragActive
                        ? "bg-blue-50/70 border-blue-500 scale-[1.01]"
                        : "bg-slate-50/50 hover:bg-slate-50 border-slate-300"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/jpeg,image/png,image/jpg"
                      disabled={templateStatus !== "ready"}
                      onChange={(e) => handleFileChange(e.target.files[0])}
                    />
                    <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                      <UploadCloud className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      {templateStatus === "ready"
                        ? "Kéo thả ảnh bài thi hoặc bấm để chọn"
                        : "Kỳ thi chưa sẵn sàng để chấm OMR"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Hỗ trợ định dạng JPG, PNG (tối đa 15MB)
                    </div>
                  </div>

                  {/* Image Preview */}
                  {previewUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          Ảnh đã chọn:
                        </span>
                        {imageMeta && (
                          <span className="font-mono text-[11px]">
                            {imageMeta.width} &times; {imageMeta.height} px &bull;{" "}
                            {imageMeta.sizeStr}
                          </span>
                        )}
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 max-h-80 flex items-center justify-center">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-80 w-auto object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Capture Guidance Checklist */}
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1.5">
                    <span className="font-semibold block flex items-center gap-1.5 text-blue-950">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      Gợi ý chụp ảnh đạt chuẩn:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-blue-800">
                      <li>Thấy rõ đủ 4 ô vuông định vị màu đen ở 4 góc.</li>
                      <li>Không để ngón tay hoặc vật cản che mã QR.</li>
                      <li>Đủ ánh sáng, hạn chế bóng đổ lên vùng tô câu hỏi.</li>
                    </ul>
                  </div>

                  {errorMsg && (
                    <Alert
                      variant="danger"
                      className="text-xs"
                      onClose={() => setErrorMsg("")}
                    >
                      <p>{errorMsg}</p>
                      {duplicateSubmissionId && (
                        <div className="mt-2 pt-2 border-t border-rose-200">
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => navigate(`/submissions/${duplicateSubmissionId}`)}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            Mở bài đã chấm
                          </Button>
                        </div>
                      )}
                    </Alert>
                  )}

                  {/* Single Submit Button */}
                  <Button
                    variant="primary"
                    size="lg"
                    icon={ScanLine}
                    onClick={handleGrade}
                    loading={gradingLoading}
                    disabled={
                      templateStatus !== "ready" ||
                      gradingLoading ||
                      !selectedFile ||
                      !selectedExamId
                    }
                    className="w-full"
                  >
                    {gradingLoading ? "Đang nhận diện & chấm bài..." : "Chấm bài thi"}
                  </Button>
                </>
              )}

              {/* BATCH MODE */}
              {gradingMode === "BATCH" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Tải nhiều ảnh cùng lúc</span>
                    {batchFiles.length > 0 && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        {batchFiles.length} ảnh đã chọn
                      </span>
                    )}
                  </div>

                  {/* Batch Dropzone */}
                  <div
                    onClick={() => {
                      if (templateStatus === "ready" && !isBatchRunning) {
                        batchInputRef.current?.click();
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      templateStatus !== "ready" || isBatchRunning
                        ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                        : "bg-blue-50/30 hover:bg-blue-50/60 border-blue-300"
                    }`}
                  >
                    <input
                      type="file"
                      ref={batchInputRef}
                      className="hidden"
                      multiple
                      accept="image/jpeg,image/png,image/jpg"
                      disabled={templateStatus !== "ready" || isBatchRunning}
                      onChange={(e) => handleBatchFilesChange(e.target.files)}
                    />
                    <div className="w-10 h-10 rounded-full bg-blue-100/70 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      Kéo thả hoặc bấm để chọn toàn bộ bài thi của lớp
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Có thể chọn đồng thời từ 1 đến 50 tệp ảnh JPG, PNG
                    </div>
                  </div>

                  {/* Batch Files Preview Summary */}
                  {batchFiles.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 max-h-40 overflow-y-auto">
                      <div className="font-semibold text-slate-700 flex items-center justify-between">
                        <span>Danh sách tệp chờ chấm:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchFiles([]);
                            setBatchResults([]);
                          }}
                          className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa tất cả
                        </button>
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-500 font-mono">
                        {batchFiles.slice(0, 5).map((f, i) => (
                          <div key={i} className="truncate">
                            &bull; {f.name} ({(f.size / 1024).toFixed(0)} KB)
                          </div>
                        ))}
                        {batchFiles.length > 5 && (
                          <div className="text-blue-600 font-sans font-semibold">
                            + {batchFiles.length - 5} ảnh khác...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Batch Submit Button */}
                  <Button
                    variant="primary"
                    size="lg"
                    icon={Zap}
                    onClick={handleBatchGrade}
                    loading={isBatchRunning}
                    disabled={
                      templateStatus !== "ready" ||
                      isBatchRunning ||
                      batchFiles.length === 0 ||
                      !selectedExamId
                    }
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20"
                  >
                    {isBatchRunning
                      ? `Đang chấm ${batchProgress.current}/${batchProgress.total} bài...`
                      : batchFiles.length > 0
                      ? `Bắt đầu chấm ${batchFiles.length} bài thi`
                      : "Chọn tệp ảnh để chấm hàng loạt"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right Column (8 cols on lg): Grading Result Dashboard */}
          <div className="lg:col-span-8 space-y-6">
            {/* BATCH MODE RESULTS */}
            {gradingMode === "BATCH" && (
              <>
                {!isBatchRunning && batchResults.length === 0 && (
                  <EmptyState
                    icon={Layers}
                    title="Chế độ chấm bài hàng loạt"
                    description="Chọn đồng thời các tệp ảnh bài thi của cả lớp ở khung bên trái và bấm 'Bắt đầu chấm hàng loạt'. Tiến trình nhận diện và kết quả của từng học sinh sẽ hiển thị trực tiếp tại đây."
                  />
                )}

                {(isBatchRunning || batchResults.length > 0) && (
                  <div className="space-y-5">
                    {/* Batch Progress Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-blue-600" />
                            {isBatchRunning ? "Đang xử lý hàng đợi chấm bài..." : "Hoàn tất đợt chấm hàng loạt"}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tiến độ: {batchProgress.current} / {batchProgress.total} bài thi ({batchProgress.percentage}%)
                          </p>
                        </div>
                        {isBatchRunning && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang chấm...
                          </span>
                        )}
                      </div>

                      {batchFallbackWarning && (
                        <Alert variant="warning" className="text-xs">
                          {batchFallbackWarning}
                        </Alert>
                      )}

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${batchProgress.percentage}%` }}
                        />
                      </div>

                      {/* Summary Badges */}
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                          <div className="text-lg font-extrabold text-emerald-800">
                            {batchResults.filter((r) => r.status === "SUCCESS" && !r.needsReview).length}
                          </div>
                          <div className="text-[11px] font-medium text-emerald-600">Thành công (FINAL)</div>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                          <div className="text-lg font-extrabold text-amber-800">
                            {batchResults.filter((r) => r.status === "SUCCESS" && r.needsReview).length}
                          </div>
                          <div className="text-[11px] font-medium text-amber-600">Cần xác nhận SBD</div>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-center">
                          <div className="text-lg font-extrabold text-rose-800">
                            {batchResults.filter((r) => r.status === "ERROR").length}
                          </div>
                          <div className="text-[11px] font-medium text-rose-600">Lỗi / Trùng lặp</div>
                        </div>
                      </div>
                    </div>

                    {/* Live Results Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Danh sách kết quả ({batchResults.length})
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider bg-slate-50">
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Tệp ảnh</th>
                              <th className="py-2.5 px-3">Số báo danh</th>
                              <th className="py-2.5 px-3">Mã đề</th>
                              <th className="py-2.5 px-3">Điểm số</th>
                              <th className="py-2.5 px-3">Trạng thái</th>
                              <th className="py-2.5 px-3 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                            {batchResults.map((res, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 text-slate-400 font-sans">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-900 font-sans truncate max-w-[140px]" title={res.fileName}>
                                  {res.fileName}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-blue-700">{res.sbd}</td>
                                <td className="py-2.5 px-3">{res.examCode}</td>
                                <td className="py-2.5 px-3 font-sans font-bold">
                                  {res.finalScore !== null ? (
                                    <span className="text-emerald-700">{res.finalScore.toFixed(2)} / {res.maxScore}</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-sans">
                                  {res.status === "SUCCESS" ? (
                                    res.needsReview ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        Cần duyệt
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        Hoàn tất
                                      </span>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={res.message}>
                                      {res.message}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-sans">
                                  {res.submissionId && (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/submissions/${res.submissionId}`)}
                                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                                    >
                                      Chi tiết &rarr;
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* SINGLE MODE RESULTS */}
            {gradingMode === "SINGLE" && (
              <>
                {!gradingResult && !gradingLoading && (
                  selectedExam ? (
                    <div className="space-y-6">
                      {/* 1. Header & Summary Stats */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                <BarChart3 className="w-5 h-5" />
                              </span>
                              <h3 className="text-base font-bold text-slate-900">
                                Tiến độ chấm bài: {selectedExam.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500">
                              Môn: <span className="font-medium text-slate-700">{selectedExam.subject?.name}</span>
                              {selectedExam.class?.name && (
                                <> &bull; Lớp: <span className="font-medium text-slate-700">{selectedExam.class.name}</span></>
                              )}
                              {" "}&bull; Quy mô: <span className="font-medium text-slate-700">{selectedExam.questionCount} câu</span>
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            icon={ExternalLink}
                            onClick={() => navigate(`/exams/${selectedExamId}/submissions`)}
                            className="text-xs shrink-0"
                          >
                            Quản lý toàn bộ bài làm {examSummary?.totalSubmissions != null ? `(${examSummary.totalSubmissions})` : ""}
                          </Button>
                        </div>

                        {/* Stat Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl">
                            <span className="text-xs font-semibold text-blue-700 block mb-0.5">Số bài đã chấm</span>
                            <span className="text-2xl font-extrabold text-blue-900">
                              {loadingStats ? "..." : examSummary?.totalSubmissions ?? 0}
                            </span>
                            <span className="text-[11px] text-blue-600/80 block mt-0.5">
                              {examSummary?.finalCount || 0} hoàn tất &bull; {examSummary?.provisionalCount || 0} tạm thời
                            </span>
                          </div>

                          <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl">
                            <span className="text-xs font-semibold text-emerald-700 block mb-0.5">Điểm trung bình</span>
                            <span className="text-2xl font-extrabold text-emerald-900">
                              {loadingStats
                                ? "..."
                                : examSummary?.scoreStats?.avg != null
                                ? Number(examSummary.scoreStats.avg).toFixed(2)
                                : "—"}
                            </span>
                            <span className="text-[11px] text-emerald-600/80 block mt-0.5">
                              Thang điểm {selectedExam.maxScore}đ
                            </span>
                          </div>

                          <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-xl">
                            <span className="text-xs font-semibold text-purple-700 block mb-0.5">Điểm cao nhất</span>
                            <span className="text-2xl font-extrabold text-purple-900">
                              {loadingStats
                                ? "..."
                                : examSummary?.scoreStats?.max != null
                                ? Number(examSummary.scoreStats.max).toFixed(2)
                                : "—"}
                            </span>
                            <span className="text-[11px] text-purple-600/80 block mt-0.5">Thành tích cao nhất</span>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-xs font-semibold text-slate-600 block mb-0.5">Điểm thấp nhất</span>
                            <span className="text-2xl font-extrabold text-slate-800">
                              {loadingStats
                                ? "..."
                                : examSummary?.scoreStats?.min != null
                                ? Number(examSummary.scoreStats.min).toFixed(2)
                                : "—"}
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">Cần hỗ trợ ôn tập</span>
                          </div>
                        </div>

                        {/* Quality Alerts */}
                        {examSummary?.hasDuplicateSbd && (
                          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                <strong>Cảnh báo Trùng SBD:</strong> Có <strong>{examSummary.duplicateStudentNumberGroupCount}</strong> số báo danh bị trùng ({examSummary.duplicateSubmissionCount} bài thi). Hãy kiểm duyệt hoặc xoá bài nộp thừa để bảo đảm điểm số chính xác!
                              </span>
                            </div>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => navigate(`/exams/${selectedExamId}/submissions?duplicate=true`)}
                              className="shrink-0"
                            >
                              Xử lý bài trùng ↗
                            </Button>
                          </div>
                        )}

                        {examSummary?.identityNeedsReviewCount > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                Có <strong>{examSummary.identityNeedsReviewCount}</strong> bài nộp cần xác nhận số báo danh trước khi công bố.
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => navigate(`/exams/${selectedExamId}/submissions?identityStatus=NEEDS_REVIEW`)}
                              className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
                            >
                              Duyệt SBD ↗
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 2. Recent Submissions Table */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                              Bài thi đã chấm gần đây nhất
                            </h4>
                          </div>
                          {recentSubmissions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => navigate(`/exams/${selectedExamId}/submissions`)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                            >
                              Xem tất cả ({examSummary?.totalSubmissions || recentSubmissions.length})
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {recentSubmissions.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs">
                            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                            <p className="font-medium text-slate-600">Kỳ thi này chưa có bài nào được chấm.</p>
                            <p className="mt-1 text-slate-400">
                              Hãy chọn ảnh phiếu thi ở khung bên trái và bấm "Chấm bài thi" để ghi nhận kết quả đầu tiên.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-left font-semibold">
                                <tr>
                                  <th className="px-4 py-2.5">STT</th>
                                  <th className="px-4 py-2.5">Số báo danh</th>
                                  <th className="px-4 py-2.5">Mã đề</th>
                                  <th className="px-4 py-2.5">Trạng thái</th>
                                  <th className="px-4 py-2.5 text-right">Điểm số</th>
                                  <th className="px-4 py-2.5 text-right">Đúng/Sai/Trống</th>
                                  <th className="px-4 py-2.5 text-right">Thời gian</th>
                                  <th className="px-4 py-2.5 text-center">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {recentSubmissions.map((sub, idx) => (
                                  <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800">
                                      {sub.studentNumber?.resolved || sub.studentNumber?.detected || "Chưa rõ"}
                                      {sub.isDuplicateSbd && (
                                        <Badge variant="red" size="sm" className="ml-1.5">Trùng SBD</Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-slate-600">{sub.examCode}</td>
                                    <td className="px-4 py-2.5">
                                      {sub.status === "FINAL" ? (
                                        <Badge variant="green" size="sm">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Hoàn tất
                                        </Badge>
                                      ) : (
                                        <Badge variant="amber" size="sm">
                                          <Clock className="w-3 h-3 mr-1" />
                                          Tạm thời
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                      {sub.status === "FINAL"
                                        ? sub.grading?.finalScore != null ? Number(sub.grading.finalScore).toFixed(2) : "—"
                                        : sub.grading?.provisionalScore != null ? Number(sub.grading.provisionalScore).toFixed(2) : "—"}
                                      {" "}
                                      <span className="text-slate-400 font-normal">/ {sub.grading?.maxScore}đ</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-500">
                                      <span className="text-green-700 font-semibold">{sub.grading?.correctCount}✓</span>
                                      {" / "}
                                      <span className="text-rose-600 font-semibold">{sub.grading?.incorrectCount}✗</span>
                                      {" / "}
                                      <span>{sub.grading?.blankCount}⬡</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-400">
                                      {new Date(sub.createdAt).toLocaleDateString("vi-VN")}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        icon={Eye}
                                        onClick={() => navigate(`/submissions/${sub.id}`)}
                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                      >
                                        Xem bài
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={FileSpreadsheet}
                      title="Chưa chọn kỳ thi"
                      description="Vui lòng chọn một kỳ thi ở khung bên trái để bắt đầu chấm bài hoặc xem thống kê các bài đã chấm."
                    />
                  )
                )}

                {gradingLoading && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-16 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                    <h3 className="text-base font-bold text-slate-800">
                      Đang nhận diện và chấm điểm...
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Hệ thống đang quét 4 góc định vị, đọc mã QR, nhận diện số báo
                      danh, mã đề và xử lý từng ô trắc nghiệm.
                    </p>
                  </div>
                )}

                {gradingResult && (
              <div className="space-y-6">
                {/* 1. Result Hero Banner */}
                {gradingResult.grading?.status === "FINAL" && (
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-md shadow-emerald-600/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Kết quả chính thức (FINAL)
                      </div>
                      <div className="text-4xl font-extrabold tracking-tight">
                        {gradingResult.grading.finalScore.toFixed(2)}{" "}
                        <span className="text-xl font-normal opacity-80">
                          / {gradingResult.exam.maxScore} điểm
                        </span>
                      </div>
                      <p className="text-xs opacity-90 mt-1">
                        {countResolved > 0
                          ? `Đã hoàn tất — ${countResolved} câu do giáo viên xác nhận thủ công.`
                          : "Phiếu thi nhận diện rõ ràng, hoàn toàn hợp lệ."}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2.5">
                      <div className="sm:text-right space-y-1 text-sm bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                        <div>
                          SBD:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.identity?.resolvedStudentNumber ||
                              gradingResult.omr?.studentNumber?.value ||
                              "Chưa rõ"}
                          </span>
                        </div>
                        <div>
                          Mã đề:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.examCode?.code ||
                              gradingResult.omr?.examCode?.value ||
                              "Chưa rõ"}
                          </span>
                        </div>
                      </div>

                      {reviewQueue.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewIndex(0);
                            setIsReviewModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem lại {reviewQueue.length} câu đã duyệt
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {gradingResult.grading?.status === "PROVISIONAL" && (
                  <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-6 shadow-md shadow-amber-600/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Kết quả tạm tính (PROVISIONAL)
                      </div>
                      <div className="text-4xl font-extrabold tracking-tight">
                        {gradingResult.grading.provisionalScore.toFixed(2)}{" "}
                        <span className="text-xl font-normal opacity-80">
                          / {gradingResult.exam.maxScore} điểm
                        </span>
                      </div>
                      <p className="text-xs opacity-90 mt-1">
                        Còn {gradingResult.grading.unresolvedCount} câu cần giáo
                        viên xác nhận lại.
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2.5">
                      <div className="sm:text-right space-y-1 text-sm bg-white/10 p-3 rounded-xl backdrop-blur-xs">
                        <div>
                          SBD:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.identity?.resolvedStudentNumber ||
                              gradingResult.omr?.studentNumber?.value ||
                              "Chưa rõ"}
                          </span>
                        </div>
                        <div>
                          Mã đề:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.examCode?.code ||
                              gradingResult.omr?.examCode?.value ||
                              "Chưa rõ"}
                          </span>
                        </div>
                      </div>

                      {gradingResult.grading.unresolvedCount > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => {
                            setReviewIndex(0);
                            setIsReviewModalOpen(true);
                          }}
                          className="bg-white text-amber-950 hover:bg-amber-50 border-white/50 shadow-sm font-bold"
                        >
                          Kiểm tra {gradingResult.grading.unresolvedCount} câu
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Exam Code Uncertain Alert */}
                {gradingResult.status === "NEEDS_REVIEW" && (
                  <Alert
                    variant="danger"
                    title="Không thể xác định chắc chắn mã đề"
                  >
                    <p className="text-xs mt-1">
                      Hệ thống không thể đọc rõ mã đề từ phiếu thi (tô mờ hoặc tô
                      nhiều ô). Cần xác nhận mã đề thủ công trước khi chấm điểm.
                    </p>
                    {gradingResult.omr?.examCode?.candidateValue && (
                      <p className="text-xs font-mono font-semibold mt-1">
                        Gợi ý nhận diện: {gradingResult.omr.examCode.candidateValue}
                      </p>
                    )}
                  </Alert>
                )}

                {/* SBD Uncertain Alert */}
                {(gradingResult.identity?.identityNeedsReview ||
                  gradingResult.omr?.identityNeedsReview) && (
                  <Alert
                    variant="warning"
                    title="Lưu ý về Số báo danh thí sinh"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
                      <p className="text-xs">
                        Điểm đã chấm xong — danh tính thí sinh chưa được xác nhận.
                        {(gradingResult.identity?.candidateStudentNumber ||
                          gradingResult.omr?.studentNumber?.candidateValue) ? (
                          <span>
                            {" "}
                            Gợi ý SBD nhận diện:{" "}
                            <strong>
                              {gradingResult.identity?.candidateStudentNumber ||
                                gradingResult.omr?.studentNumber?.candidateValue}
                            </strong>
                          </span>
                        ) : null}
                      </p>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setSbdInput(
                            gradingResult.identity?.resolvedStudentNumber ||
                              gradingResult.identity?.candidateStudentNumber ||
                              gradingResult.omr?.studentNumber?.candidateValue ||
                              ""
                          );
                          setIdentityError("");
                          setIsIdentityModalOpen(true);
                        }}
                        className="bg-white text-amber-900 border-amber-300 hover:bg-amber-100 whitespace-nowrap"
                      >
                        Xác nhận SBD
                      </Button>
                    </div>
                  </Alert>
                )}

                {/* Quality Warnings */}
                {gradingResult.omr.quality?.warnings?.length > 0 && (
                  <Alert variant="warning" title="Cảnh báo chất lượng ảnh chụp">
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                      {gradingResult.omr.quality.warnings.map((w, idx) => (
                        <li key={idx}>{mapQualityWarning(w)}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {/* Observability Details Accordion */}
                <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <summary className="px-5 py-3.5 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Thông tin kỹ thuật & Thời gian xử lý
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {gradingResult.meta?.processingTimeMs !== undefined && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">
                            Tổng thời gian
                          </span>
                          <span className="font-bold text-slate-800">
                            {gradingResult.meta.processingTimeMs} ms
                          </span>
                        </div>
                      )}
                      {gradingResult.meta?.omrTimeMs !== undefined && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">
                            Thời gian OMR (AI)
                          </span>
                          <span className="font-bold text-slate-800">
                            {gradingResult.meta.omrTimeMs} ms
                          </span>
                        </div>
                      )}
                      {gradingResult.meta?.gradingTimeMs !== undefined && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">
                            Thời gian chấm (Node)
                          </span>
                          <span className="font-bold text-slate-800">
                            {gradingResult.meta.gradingTimeMs} ms
                          </span>
                        </div>
                      )}
                      {gradingResult.omr.quality?.blurScore !== undefined && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">
                            Độ nét (Blur score)
                          </span>
                          <span className="font-bold text-slate-800">
                            {gradingResult.omr.quality.blurScore.toFixed(0)}
                          </span>
                        </div>
                      )}
                      {gradingResult.omr.quality?.brightness !== undefined && (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-400 text-[11px] block">
                            Độ sáng ảnh
                          </span>
                          <span className="font-bold text-slate-800">
                            {gradingResult.omr.quality.brightness.toFixed(0)} /
                            255
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* Audit History Accordion */}
                {auditLogs && auditLogs.length > 0 && (
                  <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <summary className="px-5 py-3.5 text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        Lịch sử xử lý ({auditLogs.length})
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-2.5 text-xs">
                      {auditLogs.map((log) => {
                        const timeStr = new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const actorName = log.actor?.fullName || log.actor?.email || "Hệ thống";

                        let desc = "";
                        if (log.eventType === "SUBMISSION_CREATED") {
                          desc = `Tạo bài chấm — Trạng thái: ${
                            log.afterState?.status === "FINAL" ? "Chính thức" : "Tạm tính"
                          } (${log.afterState?.finalScore || log.afterState?.provisionalScore || 0}đ)`;
                        } else if (log.eventType === "ANSWER_REVIEWED") {
                          const res = log.afterState?.teacherResolution;
                          const ansStr = log.afterState?.resolvedAnswer
                            ? ` (${log.afterState.resolvedAnswer})`
                            : "";
                          const label =
                            res === "MULTIPLE_INVALID"
                              ? "Tô nhiều ô / Không hợp lệ"
                              : res === "BLANK"
                              ? "Bỏ trống"
                              : res === "ANSWER"
                              ? `Phương án${ansStr}`
                              : "Chưa thể xác định";
                          desc = `Xác nhận câu ${log.questionNumber}: ${label}`;
                        } else if (log.eventType === "IDENTITY_REVIEWED") {
                          desc = `Xác nhận SBD: ${log.afterState?.resolvedStudentNumber}`;
                        } else if (log.eventType === "REGRADED") {
                          desc = `Hệ thống chấm lại: ${
                            log.afterState?.status === "FINAL" ? "Chính thức" : "Tạm tính"
                          } (${log.afterState?.finalScore || log.afterState?.provisionalScore || 0}đ)`;
                        }

                        return (
                          <div
                            key={log.id}
                            className="bg-white p-3 rounded-lg border border-slate-200 flex items-start justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-slate-800 mr-2">{timeStr}</span>
                              <span className="text-slate-600 mr-2">[{actorName}]</span>
                              <span className="text-slate-900 font-medium">{desc}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* 4-Stat Metric Cards */}
                {gradingResult.grading && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <span className="text-2xl font-bold text-emerald-600 block">
                        {gradingResult.grading.correctCount}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Số câu đúng
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <span className="text-2xl font-bold text-rose-600 block">
                        {gradingResult.grading.incorrectCount}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Số câu sai
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <span className="text-2xl font-bold text-slate-600 block">
                        {gradingResult.grading.blankCount}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Để trống
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <span className="text-2xl font-bold text-amber-600 block">
                        {gradingResult.grading.unresolvedCount}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Cần kiểm tra
                      </span>
                    </div>
                  </div>
                )}

                {/* Question Breakdown Table */}
                {gradingResult.grading?.questions && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                          Bảng kết quả từng câu hỏi
                        </h3>
                        <span className="text-xs text-slate-500">
                          Hiển thị {filteredQuestions.length} / {questionsList.length} câu trắc nghiệm
                        </span>
                      </div>

                      {/* Quick Filter Tabs */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTableFilter("ALL")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            tableFilter === "ALL"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Tất cả ({countAll})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("INCORRECT")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            tableFilter === "INCORRECT"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Sai ({countIncorrect})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("BLANK")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            tableFilter === "BLANK"
                              ? "bg-slate-700 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Bỏ trống ({countBlank})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter("REVIEW")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            tableFilter === "REVIEW"
                              ? "bg-amber-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          Cần kiểm tra ({countReview})
                        </button>
                        {countResolved > 0 && (
                          <button
                            type="button"
                            onClick={() => setTableFilter("RESOLVED")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              tableFilter === "RESOLVED"
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            GV xác nhận ({countResolved})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                            <th className="py-3 px-4">Câu</th>
                            <th className="py-3 px-4">Nhận diện</th>
                            <th className="py-3 px-4">Gợi ý AI</th>
                            <th className="py-3 px-4">Đáp án đúng</th>
                            <th className="py-3 px-4">Trạng thái OMR</th>
                            <th className="py-3 px-4">Độ tin cậy</th>
                            <th className="py-3 px-4">Kết quả</th>
                            <th className="py-3 px-4 text-right">Điểm số</th>
                            <th className="py-3 px-4 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {filteredQuestions.map((q) => {
                            let badgeVariant = "gray";
                            let statusText = "Để trống";

                            if (q.needsReview) {
                              badgeVariant = "amber";
                              statusText = "Cần kiểm tra";
                            } else if (
                              q.teacherResolution === "MULTIPLE_INVALID" ||
                              q.omrStatus === "MULTIPLE_INVALID"
                            ) {
                              badgeVariant = "red";
                              statusText = "Không hợp lệ";
                            } else if (q.omrStatus === "BLANK") {
                              badgeVariant = "gray";
                              statusText = "Để trống";
                            } else if (isQuestionCorrect(q)) {
                              badgeVariant = "green";
                              statusText = "Đúng";
                            } else {
                              badgeVariant = "red";
                              statusText = "Sai";
                            }

                            const canReview =
                              q.needsReview ||
                              q.resolvedByTeacher ||
                              q.omrStatus === "MULTIPLE" ||
                              q.omrStatus === "UNCERTAIN" ||
                              q.omrStatus === "MULTIPLE_INVALID";

                            return (
                              <tr
                                key={q.questionNumber}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  Câu {q.questionNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 text-sm font-mono">
                                      {q.teacherResolution === "MULTIPLE_INVALID" ||
                                      q.omrStatus === "MULTIPLE_INVALID"
                                        ? "Tô nhiều ô"
                                        : q.detectedAnswer || "—"}
                                    </span>
                                    {q.resolvedByTeacher ? (
                                      <Badge
                                        variant={
                                          q.teacherResolution === "MULTIPLE_INVALID"
                                            ? "red"
                                            : q.teacherResolution === "BLANK"
                                            ? "gray"
                                            : "blue"
                                        }
                                        size="xs"
                                        title={`Gốc OMR: ${formatOmrStatus(
                                          q.originalOmrStatus
                                        )}`}
                                      >
                                        GV xác nhận
                                      </Badge>
                                    ) : (
                                      <Badge variant="gray" size="xs">
                                        AI
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-400 font-mono">
                                  {q.candidate || "—"}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-bold text-blue-600 text-sm font-mono">
                                    {q.correctAnswerSnapshot || q.correctAnswer || "—"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {q.resolvedByTeacher ? (
                                    <span
                                      className={
                                        q.teacherResolution === "MULTIPLE_INVALID"
                                          ? "text-rose-700 font-medium"
                                          : q.teacherResolution === "BLANK"
                                          ? "text-slate-600 font-medium"
                                          : "text-blue-700 font-medium"
                                      }
                                    >
                                      {q.teacherResolution === "MULTIPLE_INVALID"
                                        ? "Đã duyệt (Tô nhiều ô / K.hợp lệ)"
                                        : q.teacherResolution === "BLANK"
                                        ? "Đã duyệt (Bỏ trống)"
                                        : `Đã duyệt (${formatOmrStatus(
                                            q.originalOmrStatus
                                          )})`}
                                    </span>
                                  ) : (
                                    formatOmrStatus(q.omrStatus)
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {(q.confidence * 100).toFixed(0)}%
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant={badgeVariant} size="sm">
                                    {statusText}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-slate-900">
                                  {q.scoreEarned !== null &&
                                  q.scoreEarned !== undefined
                                    ? q.scoreEarned.toFixed(2)
                                    : "—"}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {canReview ? (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => {
                                        const idx = reviewQueue.findIndex(
                                          (r) =>
                                            r.questionNumber ===
                                            q.questionNumber
                                        );
                                        if (idx >= 0) setReviewIndex(idx);
                                        setIsReviewModalOpen(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      {q.resolvedByTeacher ? "Sửa" : "Duyệt"}
                                    </Button>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        </div>

        {/* Teacher Manual Review Queue Modal */}
        <GradingManualReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          reviewQueue={reviewQueue}
          reviewIndex={reviewIndex}
          setReviewIndex={setReviewIndex}
          safeReviewIndex={safeReviewIndex}
          currentReviewQuestion={currentReviewQuestion}
          cropBlobUrls={cropBlobUrls}
          reviewOverrides={reviewOverrides}
          setReviewOverrides={setReviewOverrides}
          isSubmittingReview={isSubmittingReview}
          reviewError={reviewError}
          onApplyReview={handleApplyReview}
        />

        {/* Phase 6 Student Number Confirmation Modal */}
        <GradingIdentityModal
          isOpen={isIdentityModalOpen}
          onClose={() => setIsIdentityModalOpen(false)}
          sbdInput={sbdInput}
          setSbdInput={setSbdInput}
          identityError={identityError}
          isSubmittingIdentity={isSubmittingIdentity}
          onSave={handleSaveIdentity}
        />
      </main>
    </div>
  );
}
