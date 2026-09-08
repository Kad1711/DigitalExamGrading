import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
} from "lucide-react";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";

export default function GradingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");

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

  // Teacher manual review workflow state
  const [reviewOverrides, setReviewOverrides] = useState({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [tableFilter, setTableFilter] = useState("ALL");

  // Clean up preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
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

  // Check template readiness whenever selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setTemplateStatus("missing");
      setTemplateData(null);
      return;
    }

    // Clear previous file, image preview, results, and errors
    setSelectedFile(null);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setImageMeta(null);
    setGradingResult(null);
    setErrorMsg("");
    setPdfErrorMsg("");
    setTemplateErrorMsg("");
    setReviewOverrides({});
    setIsReviewModalOpen(false);
    setReviewIndex(0);
    setTableFilter("ALL");

    const controller = new AbortController();
    setTemplateStatus("loading");

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
  }, [selectedExamId]);

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
      setGradingResult(null);

      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await api.post(
        `/exams/${selectedExamId}/grade-image`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setGradingResult(res.data.data);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, rawMsg));
    } finally {
      setGradingLoading(false);
    }
  };

  // Submit manual teacher reviews and re-grade
  const handleApplyReview = async () => {
    if (!selectedExamId || !selectedFile) return;

    try {
      setIsSubmittingReview(true);
      setReviewError("");

      const formData = new FormData();
      formData.append("image", selectedFile);

      const list = Object.entries(reviewOverrides).map(([num, val]) => {
        const qn = Number(num);
        if (val.resolution === "ANSWER") {
          return { questionNumber: qn, resolution: "ANSWER", answer: val.answer };
        }
        return { questionNumber: qn, resolution: val.resolution };
      });
      formData.append("reviewOverrides", JSON.stringify(list));

      const res = await api.post(
        `/exams/${selectedExamId}/grade-image`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setGradingResult(res.data.data);
      setIsReviewModalOpen(false);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      setReviewError(getErrorMessage(code, rawMsg));
    } finally {
      setIsSubmittingReview(false);
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

  // Question table counts & filter
  const countAll = questionsList.length;
  const countIncorrect = questionsList.filter(
    (q) => !q.isCorrect && q.omrStatus !== "BLANK" && !q.needsReview
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
      return !q.isCorrect && q.omrStatus !== "BLANK" && !q.needsReview;
    }
    if (tableFilter === "BLANK") return q.omrStatus === "BLANK";
    if (tableFilter === "REVIEW") {
      return (
        q.needsReview ||
        q.omrStatus === "MULTIPLE" ||
        q.omrStatus === "UNCERTAIN"
      );
    }
    if (tableFilter === "RESOLVED") return Boolean(q.resolvedByTeacher);
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
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subject?.name || "Môn"} -{" "}
                        {ex.class?.name || "Lớp"} | {ex.questionCount} câu)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedExam && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Môn học / Lớp:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedExam.subject?.name} &bull; {selectedExam.class?.name}
                    </span>
                  </div>
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Tải ảnh bài thi
                </h2>
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
                  {errorMsg}
                </Alert>
              )}

              {/* Grade Submit Button */}
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
            </div>
          </div>

          {/* Right Column (8 cols on lg): Grading Result Dashboard */}
          <div className="lg:col-span-8 space-y-6">
            {!gradingResult && !gradingLoading && (
              <EmptyState
                icon={FileSpreadsheet}
                title="Chưa có kết quả chấm bài"
                description="Chọn kỳ thi ở khung bên trái, tải ảnh phiếu thi đã tô và bấm 'Chấm bài thi'. Kết quả điểm số, độ tin cậy và phân tích từng câu sẽ hiển thị tại đây."
              />
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
                            {gradingResult.omr.studentNumber?.value || "Chưa rõ"}
                          </span>
                        </div>
                        <div>
                          Mã đề:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.omr.examCode?.value || "Chưa rõ"}
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
                            {gradingResult.omr.studentNumber?.value || "Chưa rõ"}
                          </span>
                        </div>
                        <div>
                          Mã đề:{" "}
                          <span className="font-bold font-mono">
                            {gradingResult.omr.examCode?.value || "Chưa rõ"}
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
                    {gradingResult.omr.examCode?.candidateValue && (
                      <p className="text-xs font-mono font-semibold mt-1">
                        Gợi ý nhận diện: {gradingResult.omr.examCode.candidateValue}
                      </p>
                    )}
                  </Alert>
                )}

                {/* SBD Uncertain Alert */}
                {gradingResult.omr.identityNeedsReview && (
                  <Alert
                    variant="warning"
                    title="Lưu ý về Số báo danh thí sinh"
                  >
                    <p className="text-xs mt-1">
                      Điểm đã chấm xong — danh tính thí sinh chưa được xác nhận.
                      {gradingResult.omr.studentNumber?.candidateValue ? (
                        <span>
                          {" "}
                          Gợi ý SBD nhận diện:{" "}
                          <strong>
                            {gradingResult.omr.studentNumber.candidateValue}
                          </strong>
                        </span>
                      ) : null}
                    </p>
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
                            } else if (q.isCorrect) {
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
                                    {q.correctAnswer || "—"}
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
          </div>
        </div>

        {/* Teacher Manual Review Queue Modal */}
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title="Xác nhận kết quả bài thi OMR"
          description="Giáo viên xác nhận các câu hỏi trắc nghiệm tô nhiều ô hoặc không chắc chắn."
          maxWidth="max-w-2xl"
          footer={
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ArrowLeft}
                  disabled={safeReviewIndex === 0}
                  onClick={() =>
                    setReviewIndex((prev) => Math.max(0, prev - 1))
                  }
                >
                  Câu trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeReviewIndex === reviewQueue.length - 1}
                  onClick={() =>
                    setReviewIndex((prev) =>
                      Math.min(reviewQueue.length - 1, prev + 1)
                    )
                  }
                >
                  Câu tiếp <ArrowRight className="w-4 h-4 ml-1 inline" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReviewModalOpen(false)}
                >
                  Đóng
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  loading={isSubmittingReview}
                  disabled={Object.keys(reviewOverrides).length === 0}
                  onClick={handleApplyReview}
                >
                  Xác nhận & Chấm lại (
                  {Object.keys(reviewOverrides).length} câu)
                </Button>
              </div>
            </div>
          }
        >
          {reviewQueue.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Không có câu hỏi nào cần kiểm tra.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Horizontal Question Navigation Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
                {reviewQueue.map((item, idx) => {
                  const isCurrent = idx === safeReviewIndex;
                  const hasChosen =
                    reviewOverrides[item.questionNumber] !== undefined;
                  const isResolved = item.resolvedByTeacher;

                  return (
                    <button
                      key={item.questionNumber}
                      type="button"
                      onClick={() => setReviewIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-200"
                          : hasChosen || isResolved
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>Câu {item.questionNumber}</span>
                      {(hasChosen || isResolved) && (
                        <Check className="w-3 h-3 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {currentReviewQuestion && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900">
                        Câu {currentReviewQuestion.questionNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({safeReviewIndex + 1} / {reviewQueue.length} câu cần duyệt)
                      </span>
                    </div>
                    <div>
                      {(() => {
                        const overrideVal =
                          reviewOverrides[
                            currentReviewQuestion.questionNumber
                          ];
                        const resType = overrideVal
                          ? overrideVal.resolution
                          : currentReviewQuestion.teacherResolution;
                        const resAns = overrideVal
                          ? overrideVal.answer
                          : currentReviewQuestion.resolvedAnswer;

                        if (
                          currentReviewQuestion.resolvedByTeacher ||
                          overrideVal
                        ) {
                          if (resType === "MULTIPLE_INVALID") {
                            return (
                              <Badge variant="red" size="sm">
                                GV đã chọn: Tô nhiều ô / K.hợp lệ (0đ)
                              </Badge>
                            );
                          }
                          if (resType === "BLANK") {
                            return (
                              <Badge variant="gray" size="sm">
                                GV đã chọn: Bỏ trống (0đ)
                              </Badge>
                            );
                          }
                          if (resType === "ANSWER") {
                            return (
                              <Badge variant="blue" size="sm">
                                GV đã chọn: Phương án {resAns}
                              </Badge>
                            );
                          }
                          if (resType === "UNRESOLVED") {
                            return (
                              <Badge variant="amber" size="sm">
                                Chưa thể xác định
                              </Badge>
                            );
                          }
                        }

                        if (currentReviewQuestion.omrStatus === "MULTIPLE") {
                          return (
                            <Badge variant="purple" size="sm">
                              Tô nhiều ô (
                              {currentReviewQuestion.candidates?.join(", ") ||
                                currentReviewQuestion.candidate ||
                                ""}
                              )
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="amber" size="sm">
                            Không chắc chắn / Mờ
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Crop Image Display */}
                  {currentReviewQuestion.reviewCropDataUrl ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Ảnh trích xuất vùng câu{" "}
                        {currentReviewQuestion.questionNumber}
                      </span>
                      <img
                        src={currentReviewQuestion.reviewCropDataUrl}
                        alt={`Vùng tô câu ${currentReviewQuestion.questionNumber}`}
                        className="max-h-24 w-auto rounded-lg border border-slate-300 shadow-xs bg-white object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      (Không có ảnh trích xuất cho câu này)
                    </div>
                  )}

                  {/* Objectivity Note & AI Detection Suggestion */}
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs text-amber-900 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      Đáp án chính thức bị ẩn nhằm đảm bảo tính khách quan của
                      giáo viên.
                    </div>
                    {currentReviewQuestion.candidate && (
                      <p className="text-[11px] text-amber-800">
                        Gợi ý nhận diện AI:{" "}
                        <strong>{currentReviewQuestion.candidate}</strong> (độ tin
                        cậy{" "}
                        {(currentReviewQuestion.confidence * 100).toFixed(0)}%)
                      </p>
                    )}
                  </div>

                  {/* Teacher Selection Buttons */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        1. Xác nhận 1 đáp án hợp lệ duy nhất:
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {["A", "B", "C", "D"].map((opt) => {
                          const overrideVal =
                            reviewOverrides[
                              currentReviewQuestion.questionNumber
                            ];
                          const isSelected =
                            overrideVal !== undefined
                              ? overrideVal.resolution === "ANSWER" &&
                                overrideVal.answer === opt
                              : currentReviewQuestion.resolvedByTeacher &&
                                currentReviewQuestion.teacherResolution ===
                                  "ANSWER" &&
                                currentReviewQuestion.resolvedAnswer === opt;

                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setReviewOverrides((prev) => ({
                                  ...prev,
                                  [currentReviewQuestion.questionNumber]: {
                                    resolution: "ANSWER",
                                    answer: opt,
                                  },
                                }));
                              }}
                              className={`py-3 px-4 rounded-xl font-bold text-base border-2 transition-all flex items-center justify-center cursor-pointer ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200"
                                  : "bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        2. Hoặc xác nhận trạng thái đặc biệt khác:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* BLANK */}
                        {(() => {
                          const overrideVal =
                            reviewOverrides[
                              currentReviewQuestion.questionNumber
                            ];
                          const isSelected =
                            overrideVal !== undefined
                              ? overrideVal.resolution === "BLANK"
                              : currentReviewQuestion.resolvedByTeacher &&
                                currentReviewQuestion.teacherResolution ===
                                  "BLANK";
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewOverrides((prev) => ({
                                  ...prev,
                                  [currentReviewQuestion.questionNumber]: {
                                    resolution: "BLANK",
                                  },
                                }));
                              }}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                                isSelected
                                  ? "bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-300"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              <span>Học sinh để trống</span>
                              <span className="text-[10px] opacity-75 font-normal">
                                (0 điểm)
                              </span>
                            </button>
                          );
                        })()}

                        {/* MULTIPLE_INVALID */}
                        {(() => {
                          const overrideVal =
                            reviewOverrides[
                              currentReviewQuestion.questionNumber
                            ];
                          const isSelected =
                            overrideVal !== undefined
                              ? overrideVal.resolution === "MULTIPLE_INVALID"
                              : currentReviewQuestion.resolvedByTeacher &&
                                currentReviewQuestion.teacherResolution ===
                                  "MULTIPLE_INVALID";
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewOverrides((prev) => ({
                                  ...prev,
                                  [currentReviewQuestion.questionNumber]: {
                                    resolution: "MULTIPLE_INVALID",
                                  },
                                }));
                              }}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                                isSelected
                                  ? "bg-rose-700 text-white border-rose-700 shadow-xs ring-2 ring-rose-300"
                                  : "bg-white text-rose-700 border-rose-200 hover:border-rose-400 hover:bg-rose-50/40"
                              }`}
                            >
                              <span>Tô nhiều ô / Không hợp lệ</span>
                              <span className="text-[10px] opacity-75 font-normal">
                                (0 điểm)
                              </span>
                            </button>
                          );
                        })()}

                        {/* UNRESOLVED */}
                        {(() => {
                          const overrideVal =
                            reviewOverrides[
                              currentReviewQuestion.questionNumber
                            ];
                          const isSelected =
                            overrideVal !== undefined
                              ? overrideVal.resolution === "UNRESOLVED"
                              : currentReviewQuestion.teacherResolution ===
                                "UNRESOLVED";
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewOverrides((prev) => ({
                                  ...prev,
                                  [currentReviewQuestion.questionNumber]: {
                                    resolution: "UNRESOLVED",
                                  },
                                }));
                              }}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                                isSelected
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200"
                                  : "bg-white text-amber-800 border-amber-200 hover:border-amber-400 hover:bg-amber-50/40"
                              }`}
                            >
                              <span>Chưa thể xác định</span>
                              <span className="text-[10px] opacity-75 font-normal">
                                (Giữ tạm tính)
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {(reviewOverrides[
                      currentReviewQuestion.questionNumber
                    ] !== undefined ||
                      currentReviewQuestion.resolvedByTeacher) && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewOverrides((prev) => {
                              const next = { ...prev };
                              delete next[currentReviewQuestion.questionNumber];
                              return next;
                            });
                          }}
                          className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                        >
                          Xóa lựa chọn cho câu này
                        </button>
                      </div>
                    )}
                  </div>

                  {reviewError && (
                    <Alert variant="danger" className="text-xs">
                      {reviewError}
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
