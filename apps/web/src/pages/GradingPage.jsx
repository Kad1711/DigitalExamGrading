import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function GradingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

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
    } catch (err) {
      setErrorMsg("Không thể tải danh sách kỳ thi đã phát hành.");
    } finally {
      setLoadingExams(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  const handleFileChange = (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    const ext = (file.name || "").toLowerCase();
    const isValidExt = ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".png");

    if (!allowedTypes.includes(file.type) && !isValidExt) {
      setErrorMsg("Chỉ chấp nhận file ảnh định dạng .jpg, .jpeg, hoặc .png.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("Dung lượng ảnh vượt quá giới hạn cho phép (15MB).");
      return;
    }

    setErrorMsg("");
    setSelectedFile(file);
    setGradingResult(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleGrade = async () => {
    if (!selectedExamId) {
      setErrorMsg("Vui lòng chọn kỳ thi cần chấm.");
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

      // Map to clear Vietnamese error messages
      if (code === "OMR_SERVICE_UNAVAILABLE" || err.response?.status === 503) {
        setErrorMsg("Dịch vụ AI chấm thi (FastAPI OMR) hiện không khả dụng. Vui lòng thử lại sau.");
      } else if (code === "OMR_EXAM_MISMATCH") {
        setErrorMsg("Mã kỳ thi trên mã QR của phiếu không khớp với kỳ thi đang chọn.");
      } else if (code === "OMR_TEMPLATE_MISMATCH") {
        setErrorMsg("Mẫu phiếu trả lời không khớp với mẫu đề thi chuẩn trong hệ thống.");
      } else if (code === "OMR_EXAM_CODE_NOT_FOUND") {
        setErrorMsg(rawMsg || "Mã đề nhận diện từ phiếu không tồn tại trong kỳ thi này.");
      } else if (code === "MULTI_PAGE_GRADING_NOT_SUPPORTED_YET") {
        setErrorMsg("Phiếu nhiều trang chưa được hỗ trợ trong chế độ chấm một ảnh.");
      } else if (code === "CORNER_MARKERS_NOT_FOUND" || code === "MARKERS_NOT_FOUND") {
        setErrorMsg("Không tìm thấy đủ 4 marker trên phiếu. Hãy chụp lại toàn bộ tờ giấy.");
      } else if (code === "QR_NOT_FOUND") {
        setErrorMsg("Không tìm thấy mã QR định danh trên phiếu. Hãy đảm bảo góc trên bên phải không bị che khuất.");
      } else if (code === "EXAM_NOT_AVAILABLE_FOR_GRADING") {
        setErrorMsg("Kỳ thi này hiện chưa thể chấm bài (chỉ hỗ trợ kỳ thi ở trạng thái PUBLISHED).");
      } else {
        setErrorMsg(rawMsg || "Có lỗi xảy ra trong quá trình chấm bài thi.");
      }
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
          <span>Hệ Thống Chấm Điểm Bài Thi Trắc Nghiệm THPT (OMR)</span>
        </div>
        <div className="user-nav">
          <span style={{ fontSize: "0.875rem", color: "var(--gray-600)" }}>
            {currentUser?.email} ({currentUser?.role})
          </span>
          <button onClick={handleLogout} className="btn-logout">
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        <div className="grid-two-cols">
          {/* Left Column: Exam & Upload Form */}
          <div>
            <div className="card">
              <h2 className="card-title">1. Chọn kỳ thi</h2>
              <div className="form-group">
                <label className="form-label">Kỳ thi đang phát hành (PUBLISHED)</label>
                {loadingExams ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--gray-500)" }}>Đang tải danh sách...</p>
                ) : exams.length === 0 ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
                    Không có kỳ thi nào đang ở trạng thái PUBLISHED.
                  </p>
                ) : (
                  <select
                    className="form-select"
                    value={selectedExamId}
                    onChange={(e) => {
                      setSelectedExamId(e.target.value);
                      setGradingResult(null);
                    }}
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subject?.name || "Môn học"} - {ex.class?.name || "Lớp"} | {ex.questionCount} câu)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedExam && (
                <div style={{ fontSize: "0.85rem", color: "var(--gray-600)", background: "var(--gray-50)", padding: "0.75rem", borderRadius: "6px" }}>
                  <div><strong>Môn học:</strong> {selectedExam.subject?.name}</div>
                  <div><strong>Lớp:</strong> {selectedExam.class?.name}</div>
                  <div><strong>Số câu hỏi:</strong> {selectedExam.questionCount} câu</div>
                  <div><strong>Hình thức tính điểm:</strong> {selectedExam.scoringType} (Tối đa: {Number(selectedExam.maxScore)}đ)</div>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="card-title">2. Tải ảnh phiếu thi</h2>
              <div
                className={`dropzone ${isDragActive ? "drag-active" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
                <div className="dropzone-icon">📷</div>
                <p style={{ fontWeight: 600, color: "var(--gray-700)" }}>
                  Nhấp để chọn ảnh hoặc kéo thả ảnh vào đây
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--gray-500)", marginTop: "0.25rem" }}>
                  Hỗ trợ JPG, PNG (tối đa 15MB)
                </p>
              </div>

              {previewUrl && (
                <div className="preview-container">
                  <img src={previewUrl} alt="Preview" className="preview-img" />
                </div>
              )}

              {errorMsg && (
                <div className="alert alert-danger" style={{ marginTop: "1rem" }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ marginTop: "1.25rem" }}>
                <button
                  className="btn-primary"
                  onClick={handleGrade}
                  disabled={gradingLoading || !selectedFile || !selectedExamId}
                >
                  {gradingLoading ? "Đang nhận diện bài thi..." : "CHẤM BÀI"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Grading Results */}
          <div>
            {!gradingResult && !gradingLoading && (
              <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--gray-500)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📋</div>
                <h3>Chưa có kết quả chấm bài</h3>
                <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  Hãy chọn kỳ thi, tải ảnh phiếu trả lời và bấm "CHẤM BÀI" để xem kết quả chi tiết.
                </p>
              </div>
            )}

            {gradingLoading && (
              <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
                <h3>Đang nhận diện và chấm điểm...</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--gray-500)", marginTop: "0.5rem" }}>
                  Hệ thống đang đọc mã QR, số báo danh, mã đề và các ô tô trắc nghiệm.
                </p>
              </div>
            )}

            {gradingResult && (
              <div>
                {/* Result Status Banner */}
                {gradingResult.grading?.status === "FINAL" && (
                  <div className="result-header-final">
                    <div>
                      <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#ffffff", marginBottom: "0.5rem" }}>
                        ✓ KẾT QUẢ CHÍNH THỨC (FINAL)
                      </span>
                      <div className="score-display">
                        {gradingResult.grading.finalScore.toFixed(2)} / {gradingResult.exam.maxScore}
                      </div>
                      <div className="score-sub">Điểm bài thi hoàn tất nhận diện</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div><strong>SBD:</strong> {gradingResult.omr.studentNumber?.value || "Chưa rõ"}</div>
                      <div><strong>Mã đề:</strong> {gradingResult.omr.examCode?.value || "Chưa rõ"}</div>
                    </div>
                  </div>
                )}

                {gradingResult.grading?.status === "PROVISIONAL" && (
                  <div className="result-header-provisional">
                    <div>
                      <span className="badge" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#ffffff", marginBottom: "0.5rem" }}>
                        ⚠️ KẾT QUẢ TẠM TÍNH (PROVISIONAL)
                      </span>
                      <div className="score-display">
                        {gradingResult.grading.provisionalScore.toFixed(2)} / {gradingResult.exam.maxScore}
                      </div>
                      <div className="score-sub">
                        Kết quả tạm tính: Còn {gradingResult.grading.unresolvedCount} câu cần giáo viên kiểm tra.
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div><strong>SBD:</strong> {gradingResult.omr.studentNumber?.value || "Chưa rõ"}</div>
                      <div><strong>Mã đề:</strong> {gradingResult.omr.examCode?.value || "Chưa rõ"}</div>
                    </div>
                  </div>
                )}

                {gradingResult.status === "NEEDS_REVIEW" && (
                  <div className="alert alert-danger" style={{ fontSize: "1rem", padding: "1.25rem" }}>
                    <h3 style={{ marginBottom: "0.5rem" }}>⚠️ CẦN GIÁO VIÊN KIỂM TRA MÃ ĐỀ</h3>
                    <p>Hệ thống không thể xác định chính xác mã đề từ phiếu thi (Mã đề chưa rõ ràng hoặc bị tô mờ/nhiều ô).</p>
                    <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                      Gợi ý nhận diện: <code>{gradingResult.omr.examCode?.candidateValue || "Không rõ"}</code>
                    </p>
                  </div>
                )}

                {/* Identity Alert */}
                {gradingResult.omr.identityNeedsReview && (
                  <div className="alert alert-warning">
                    ⚠️ <strong>Lưu ý:</strong> Số báo danh (SBD) chưa được nhận diện rõ ràng (Giá trị gợi ý: {gradingResult.omr.studentNumber?.candidateValue || "Không rõ"}). Giáo viên cần kiểm tra lại thủ công.
                  </div>
                )}

                {/* Quality Warnings */}
                {gradingResult.omr.quality?.warnings?.length > 0 && (
                  <div className="alert alert-warning">
                    <strong>Cảnh báo chất lượng ảnh:</strong> {gradingResult.omr.quality.warnings.join(", ")}
                  </div>
                )}

                {/* Stats Breakdown */}
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

                    <h3 className="card-title" style={{ marginTop: "1rem" }}>Bảng kết quả từng câu</h3>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Câu</th>
                            <th>Đáp án tô</th>
                            <th>Gợi ý AI</th>
                            <th>Đáp án đúng</th>
                            <th>Trạng thái OMR</th>
                            <th>Độ tin cậy</th>
                            <th>Kết quả</th>
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
                              statusText = "Nhiều đáp án";
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
