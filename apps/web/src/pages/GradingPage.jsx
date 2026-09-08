import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { getErrorMessage, mapQualityWarning } from "../utils/error-map";

export default function GradingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
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

  // Clean up preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Check auth and load published exams
  useEffect(() => {
    const rawUser = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("accessToken");
    if (!token || !rawUser) {
      navigate("/login");
      return;
    }
    try {
      setCurrentUser(JSON.parse(rawUser));
    } catch {
      navigate("/login");
      return;
    }

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
        setSelectedExamId(list[0].id);
      }
    } catch {
      setErrorMsg("Không thể tải danh sách kỳ thi đã phát hành.");
    } finally {
      setLoadingExams(false);
    }
  };

  // Check template readiness whenever selectedExamId changes (with AbortController to prevent stale async overwrite)
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
          // Request aborted due to rapid exam switching; ignore stale result
          return;
        }
        setTemplateData(null);
        if (err.response?.status === 404) {
          setTemplateStatus("missing");
        } else {
          setTemplateStatus("error");
          setTemplateErrorMsg(
            err.response?.data?.error?.message || "Lỗi kiểm tra mẫu phiếu trả lời."
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedExamId]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (templateStatus !== "ready") {
      setErrorMsg("Kỳ thi này chưa có phiếu trả lời OMR hoặc không hợp lệ để chấm.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    const ext = (file.name || "").toLowerCase();
    const isValidExt = ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".png");

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

    // Clear previous grading result to avoid showing stale state
    setGradingResult(null);

    // Revoke previous object URL to prevent memory leak
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }

    const url = window.URL.createObjectURL(file);
    setPreviewUrl(url);

    // Format size
    const sizeStr =
      file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
        : Math.round(file.size / 1024) + " KB";

    // Read image dimensions
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

  // Download real Answer Sheet PDF from DB
  const handleDownloadPdf = async () => {
    if (!selectedExamId || templateStatus === "missing") return;

    try {
      setDownloadingPdf(true);
      setPdfErrorMsg("");

      const res = await api.get(`/exams/${selectedExamId}/answer-sheet-template/pdf`, {
        responseType: "blob",
      });

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
      link.setAttribute("download", `answer-sheet-${cleanTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (err.response?.status === 404) {
        setPdfErrorMsg("Kỳ thi này chưa có mẫu phiếu trả lời được tạo trong hệ thống.");
      } else {
        setPdfErrorMsg("Không thể tải file PDF mẫu phiếu. Vui lòng thử lại sau.");
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
      setErrorMsg("Kỳ thi này chưa có phiếu trả lời OMR. Hãy tạo phiếu trả lời trước khi chấm bài.");
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

      const res = await api.post(`/exams/${selectedExamId}/grade-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGradingResult(res.data.data);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const rawMsg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, rawMsg));
    } finally {
      setGradingLoading(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="brand-title">
          <span>📝</span>
          <span>Digital Exam Grading (OMR)</span>
        </div>
        <div className="user-nav">
          <span className="user-badge">
            👤 {currentUser?.email} ({currentUser?.role})
          </span>
          <button onClick={handleLogout} className="btn-logout">
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout (Wide ~1500px) */}
      <main className="main-container">
        <div className="grid-dashboard">
          {/* Left Panel (~35%): Exam & Upload */}
          <div>
            {/* Exam Selector Panel */}
            <div className="card">
              <h2 className="card-title">1. Chọn kỳ thi</h2>
              <div className="form-group">
                <label className="form-label">Kỳ thi đang phát hành (PUBLISHED)</label>
                {loadingExams ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--gray-500)" }}>Đang tải danh sách...</p>
                ) : exams.length === 0 ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
                    Chưa có kỳ thi nào được phát hành để chấm bài.
                  </p>
                ) : (
                  <select
                    className="form-select"
                    value={selectedExamId}
                    onChange={(e) => {
                      setSelectedExamId(e.target.value);
                    }}
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subject?.name || "Môn"} - {ex.class?.name || "Lớp"} | {ex.questionCount} câu)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedExam && (
                <div style={{ fontSize: "0.85rem", color: "var(--gray-600)", background: "var(--gray-50)", padding: "0.85rem", borderRadius: "6px", border: "1px solid var(--gray-200)" }}>
                  <div><strong>Môn học:</strong> {selectedExam.subject?.name}</div>
                  <div><strong>Lớp:</strong> {selectedExam.class?.name}</div>
                  <div><strong>Số câu hỏi:</strong> {selectedExam.questionCount} câu</div>
                  <div><strong>Hình thức tính điểm:</strong> {selectedExam.scoringType} (Tối đa: {Number(selectedExam.maxScore)}đ)</div>

                  {/* Template Readiness Status */}
                  {templateStatus === "loading" && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.825rem", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span>⏳</span>
                      <span>Đang kiểm tra mẫu phiếu OMR...</span>
                    </div>
                  )}

                  {templateStatus === "ready" && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span className="badge badge-correct" style={{ fontSize: "0.825rem", padding: "0.25rem 0.6rem" }}>
                          ✓ Sẵn sàng chấm OMR
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--gray-500)" }}>
                          (Mẫu v{templateData?.version} • {selectedExam.questionCount} câu)
                        </span>
                      </div>

                      {/* Real Answer Sheet PDF Download */}
                      <button
                        className="btn-pdf-download"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                      >
                        <span>📄</span>
                        <span>{downloadingPdf ? "Đang tải PDF..." : "TẢI PHIẾU TRẢ LỜI PDF (OMR)"}</span>
                      </button>
                    </div>
                  )}

                  {templateStatus === "missing" && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div className="alert alert-warning" style={{ margin: 0, fontSize: "0.825rem", padding: "0.6rem 0.8rem" }}>
                        ⚠️ <strong>Kỳ thi này chưa có phiếu trả lời OMR.</strong> Hãy tạo phiếu trả lời trước khi chấm bài.
                      </div>
                      <button
                        className="btn-pdf-download"
                        disabled
                        style={{ opacity: 0.5, cursor: "not-allowed", backgroundColor: "var(--gray-100)", borderColor: "var(--gray-300)", color: "var(--gray-500)", marginTop: "0.5rem" }}
                      >
                        <span>📄</span>
                        <span>Chưa có file PDF phiếu</span>
                      </button>
                    </div>
                  )}

                  {templateStatus === "multipage" && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div className="alert alert-warning" style={{ margin: 0, fontSize: "0.825rem", padding: "0.6rem 0.8rem" }}>
                        ⚠️ <strong>Phiếu thi có {templateData?.pageCount} trang.</strong> Chế độ chấm một ảnh hiện chỉ hỗ trợ phiếu một trang.
                      </div>
                      <button
                        className="btn-pdf-download"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        style={{ marginTop: "0.5rem" }}
                      >
                        <span>📄</span>
                        <span>{downloadingPdf ? "Đang tải PDF..." : "TẢI PHIẾU TRẢ LỜI PDF (OMR)"}</span>
                      </button>
                    </div>
                  )}

                  {templateStatus === "error" && (
                    <div className="alert alert-danger" style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.825rem", padding: "0.6rem 0.8rem" }}>
                      ⚠️ {templateErrorMsg || "Không thể tải thông tin phiếu trả lời."}
                    </div>
                  )}

                  {pdfErrorMsg && (
                    <p style={{ fontSize: "0.8rem", color: "var(--danger)", marginTop: "0.4rem" }}>{pdfErrorMsg}</p>
                  )}
                </div>
              )}
            </div>

            {/* Image Upload Panel */}
            <div className="card">
              <div className="card-title">
                <span>2. Tải ảnh bài thi</span>
                {previewUrl && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      if (templateStatus === "ready") {
                        fileInputRef.current?.click();
                      }
                    }}
                    disabled={templateStatus !== "ready"}
                  >
                    Chọn ảnh khác
                  </button>
                )}
              </div>

              <div
                className={`dropzone ${isDragActive ? "drag-active" : ""} ${templateStatus !== "ready" ? "disabled" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (templateStatus === "ready") {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/jpeg,image/png,image/jpg"
                  disabled={templateStatus !== "ready"}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
                <div className="dropzone-icon">📷</div>
                <p style={{ fontWeight: 600, color: templateStatus === "ready" ? "var(--gray-700)" : "var(--gray-400)" }}>
                  {templateStatus === "ready"
                    ? "Nhấp để chọn ảnh hoặc kéo thả ảnh vào đây"
                    : templateStatus === "missing"
                    ? "Kỳ thi chưa có phiếu trả lời OMR"
                    : "Đang kiểm tra trạng thái phiếu..."}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: "0.25rem" }}>
                  {templateStatus === "ready"
                    ? "Hỗ trợ định dạng JPG, PNG (tối đa 15MB)"
                    : "Vui lòng chọn kỳ thi có phiếu OMR hợp lệ"}
                </p>
              </div>

              {/* Large Image Preview with Dimensions and Size */}
              {previewUrl && (
                <div className="preview-card">
                  <div className="preview-header">
                    <span style={{ fontWeight: 600 }}>Ảnh bài thi đã chọn</span>
                    <div className="preview-meta">
                      {imageMeta?.width && <span>{imageMeta.width} × {imageMeta.height} px</span>}
                      {imageMeta?.sizeStr && <span>{imageMeta.sizeStr}</span>}
                    </div>
                  </div>
                  <div className="preview-container">
                    <img src={previewUrl} alt="Preview" className="preview-img" />
                  </div>
                </div>
              )}

              {/* Photo Guidance Checklist */}
              <div className="checklist-card">
                <div className="checklist-title">
                  <span>💡</span>
                  <span>Để nhận diện OMR tốt nhất:</span>
                </div>
                <ul className="checklist-list">
                  <li>Chụp toàn bộ tờ giấy, không bị mất góc hoặc mép.</li>
                  <li>Thấy rõ đủ 4 marker vuông màu đen ở 4 góc phiếu.</li>
                  <li>Không để ngón tay hoặc vật cản che khuất mã QR.</li>
                  <li>Hạn chế bóng đổ, đảm bảo chụp đủ ánh sáng.</li>
                  <li>Không crop sát mép viền của phiếu thi.</li>
                </ul>
              </div>

              {errorMsg && (
                <div className="alert alert-danger" style={{ marginTop: "1rem" }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ marginTop: "1.25rem" }}>
                <button
                  className="btn-primary"
                  onClick={handleGrade}
                  disabled={templateStatus !== "ready" || gradingLoading || !selectedFile || !selectedExamId}
                  title={
                    templateStatus !== "ready"
                      ? "Kỳ thi chưa có phiếu OMR hợp lệ để chấm"
                      : !selectedFile
                      ? "Vui lòng tải ảnh bài thi trước khi chấm"
                      : ""
                  }
                >
                  <span>{gradingLoading ? "⏳" : "🔍"}</span>
                  <span>{gradingLoading ? "Đang nhận diện bài thi..." : "CHẤM BÀI"}</span>
                </button>
                {gradingLoading && (
                  <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--gray-500)", marginTop: "0.5rem" }}>
                    Đang gửi ảnh và xử lý OMR...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel (~65%): Result Dashboard */}
          <div>
            {!gradingResult && !gradingLoading && (
              <div className="card" style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--gray-500)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
                <h3>Chưa có kết quả chấm bài</h3>
                <p style={{ fontSize: "0.9rem", marginTop: "0.5rem", maxWidth: "480px", margin: "0.5rem auto 0" }}>
                  Chọn kỳ thi ở khung bên trái, tải ảnh phiếu thi đã tô và bấm <strong>"CHẤM BÀI"</strong>. Kết quả điểm số và phân tích từng câu sẽ hiển thị tại đây.
                </p>
              </div>
            )}

            {gradingLoading && (
              <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚙️</div>
                <h3>Đang nhận diện và chấm điểm...</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", marginTop: "0.5rem" }}>
                  Hệ thống đang đọc mã QR, số báo danh, mã đề và quét các ô tròn trắc nghiệm.
                </p>
              </div>
            )}

            {gradingResult && (
              <div>
                {/* 1. Final Result Banner */}
                {gradingResult.grading?.status === "FINAL" && (
                  <div className="result-banner-final">
                    <div>
                      <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#ffffff", marginBottom: "0.5rem" }}>
                        ✓ KẾT QUẢ CHÍNH THỨC (ĐÃ HOÀN TẤT)
                      </span>
                      <div className="score-number">
                        {gradingResult.grading.finalScore.toFixed(2)} / {gradingResult.exam.maxScore}
                      </div>
                      <div className="score-caption">Bài thi nhận diện rõ ràng, không có câu cần kiểm tra</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.1rem" }}><strong>SBD:</strong> {gradingResult.omr.studentNumber?.value || "Chưa rõ"}</div>
                      <div style={{ fontSize: "1.1rem" }}><strong>Mã đề:</strong> {gradingResult.omr.examCode?.value || "Chưa rõ"}</div>
                    </div>
                  </div>
                )}

                {/* 2. Provisional Result Banner */}
                {gradingResult.grading?.status === "PROVISIONAL" && (
                  <div className="result-banner-provisional">
                    <div>
                      <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "#ffffff", marginBottom: "0.5rem" }}>
                        ⚠️ KẾT QUẢ TẠM TÍNH (PROVISIONAL)
                      </span>
                      <div className="score-number">
                        {gradingResult.grading.provisionalScore.toFixed(2)} / {gradingResult.exam.maxScore}
                      </div>
                      <div className="score-caption">
                        <strong>Kết quả tạm tính:</strong> Còn {gradingResult.grading.unresolvedCount} câu cần giáo viên kiểm tra.
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.1rem" }}><strong>SBD:</strong> {gradingResult.omr.studentNumber?.value || "Chưa rõ"}</div>
                      <div style={{ fontSize: "1.1rem" }}><strong>Mã đề:</strong> {gradingResult.omr.examCode?.value || "Chưa rõ"}</div>
                    </div>
                  </div>
                )}

                {/* 3. Exam Code Uncertain Alert */}
                {gradingResult.status === "NEEDS_REVIEW" && (
                  <div className="alert alert-danger" style={{ fontSize: "1rem", padding: "1.25rem" }}>
                    <h3 style={{ marginBottom: "0.5rem" }}>⚠️ KHÔNG THỂ XÁC ĐỊNH CHẮC CHẮN MÃ ĐỀ</h3>
                    <p>Hệ thống không thể xác định chính xác mã đề từ phiếu thi (Mã đề chưa rõ ràng hoặc bị tô mờ/nhiều ô).</p>
                    <p style={{ marginTop: "0.5rem", fontWeight: 600 }}>
                      Cần kiểm tra mã đề trước khi hệ thống có thể chấm điểm.
                    </p>
                    {gradingResult.omr.examCode?.candidateValue && (
                      <p style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "var(--gray-700)" }}>
                        Gợi ý nhận diện: <code>{gradingResult.omr.examCode.candidateValue}</code>
                      </p>
                    )}
                  </div>
                )}

                {/* 4. SBD Uncertain Alert */}
                {gradingResult.omr.identityNeedsReview && (
                  <div className="alert alert-warning">
                    ⚠️ <strong>Lưu ý về Số báo danh:</strong> Không xác định chắc chắn số báo danh.
                    {gradingResult.omr.studentNumber?.candidateValue ? (
                      <span> Gợi ý nhận diện: <strong>{gradingResult.omr.studentNumber.candidateValue}</strong>.</span>
                    ) : null}
                    <span> Giáo viên cần kiểm tra và xác nhận thủ công.</span>
                  </div>
                )}

                {/* 5. Quality Warnings */}
                {gradingResult.omr.quality?.warnings?.length > 0 && (
                  <div className="alert alert-warning">
                    <strong>Cảnh báo chất lượng ảnh chụp:</strong>
                    <ul style={{ paddingLeft: "1.25rem", marginTop: "0.25rem" }}>
                      {gradingResult.omr.quality.warnings.map((w, idx) => (
                        <li key={idx}>{mapQualityWarning(w)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 6. Technical Observability Accordion */}
                <details className="accordion-details">
                  <summary className="accordion-summary">
                    ⚙️ Thông tin kỹ thuật & Thời gian xử lý (Observability)
                  </summary>
                  <div className="accordion-body">
                    <div className="tech-grid">
                      {gradingResult.meta?.processingTimeMs !== undefined && (
                        <div className="tech-item">
                          <div className="tech-label">Tổng thời gian xử lý</div>
                          <div className="tech-val">{gradingResult.meta.processingTimeMs} ms</div>
                        </div>
                      )}
                      {gradingResult.meta?.omrTimeMs !== undefined && (
                        <div className="tech-item">
                          <div className="tech-label">Thời gian OMR (FastAPI)</div>
                          <div className="tech-val">{gradingResult.meta.omrTimeMs} ms</div>
                        </div>
                      )}
                      {gradingResult.meta?.gradingTimeMs !== undefined && (
                        <div className="tech-item">
                          <div className="tech-label">Thời gian chấm (Node)</div>
                          <div className="tech-val">{gradingResult.meta.gradingTimeMs} ms</div>
                        </div>
                      )}
                      {gradingResult.omr.quality?.width && (
                        <div className="tech-item">
                          <div className="tech-label">Kích thước ảnh OMR</div>
                          <div className="tech-val">
                            {gradingResult.omr.quality.width} × {gradingResult.omr.quality.height} px
                          </div>
                        </div>
                      )}
                      {gradingResult.omr.quality?.blurScore !== undefined && (
                        <div className="tech-item">
                          <div className="tech-label">Độ nét (Blur Score)</div>
                          <div className="tech-val">{gradingResult.omr.quality.blurScore.toFixed(0)}</div>
                        </div>
                      )}
                      {gradingResult.omr.quality?.brightness !== undefined && (
                        <div className="tech-item">
                          <div className="tech-label">Độ sáng (Brightness)</div>
                          <div className="tech-val">{gradingResult.omr.quality.brightness.toFixed(0)} / 255</div>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* 7. Stats Breakdown Grid */}
                {gradingResult.grading && (
                  <div className="card">
                    <h3 className="card-title">Thống kê chi tiết</h3>
                    <div className="stats-grid">
                      <div className="stat-box">
                        <div className="stat-value" style={{ color: "var(--success)" }}>
                          {gradingResult.grading.correctCount}
                        </div>
                        <div className="stat-label">Số câu đúng</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value" style={{ color: "var(--danger)" }}>
                          {gradingResult.grading.incorrectCount}
                        </div>
                        <div className="stat-label">Số câu sai</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value" style={{ color: "var(--gray-500)" }}>
                          {gradingResult.grading.blankCount}
                        </div>
                        <div className="stat-label">Câu để trống</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value" style={{ color: "var(--warning)" }}>
                          {gradingResult.grading.unresolvedCount}
                        </div>
                        <div className="stat-label">Cần kiểm tra</div>
                      </div>
                    </div>

                    {/* Question Breakdown Table */}
                    <h3 className="card-title" style={{ marginTop: "1rem" }}>Bảng kết quả từng câu</h3>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Câu</th>
                            <th>Nhận diện</th>
                            <th>Gợi ý AI</th>
                            <th>Đáp án đúng</th>
                            <th>Trạng thái</th>
                            <th>Độ tin cậy</th>
                            <th>Kết quả</th>
                            <th>Điểm</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gradingResult.grading.questions.map((q) => {
                            let badgeClass = "badge-blank";
                            let statusText = "Trống";

                            if (q.omrStatus === "MARKED") {
                              if (q.isCorrect) {
                                badgeClass = "badge-correct";
                                statusText = "✓ Đúng";
                              } else {
                                badgeClass = "badge-incorrect";
                                statusText = "✗ Sai";
                              }
                            } else if (q.omrStatus === "MULTIPLE") {
                              badgeClass = "badge-multiple";
                              statusText = "Tô nhiều đáp án";
                            } else if (q.omrStatus === "UNCERTAIN") {
                              badgeClass = "badge-uncertain";
                              statusText = "Cần kiểm tra";
                            }

                            return (
                              <tr key={q.questionNumber}>
                                <td><strong>Câu {q.questionNumber}</strong></td>
                                <td><strong>{q.detectedAnswer || "—"}</strong></td>
                                <td>{q.candidate || "—"}</td>
                                <td><strong>{q.correctAnswer || "—"}</strong></td>
                                <td>{q.omrStatus}</td>
                                <td>{(q.confidence * 100).toFixed(0)}%</td>
                                <td>
                                  <span className={`badge ${badgeClass}`}>{statusText}</span>
                                </td>
                                <td>
                                  {q.scoreEarned !== null && q.scoreEarned !== undefined
                                    ? q.scoreEarned.toFixed(2)
                                    : "—"}
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
      </main>
    </div>
  );
}
