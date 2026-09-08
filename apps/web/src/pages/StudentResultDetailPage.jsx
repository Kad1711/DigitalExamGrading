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
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ArrowLeft,
  FileText,
  User,
} from "lucide-react";
import { getErrorMessage } from "../utils/error-map";

export default function StudentResultDetailPage() {
  const { examId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchResultDetail();
  }, [examId]);

  const fetchResultDetail = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get(`/student/results/${examId}`);
      setResult(res.data.data);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, msg || "Không thể tải chi tiết kết quả thi."));
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
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const getResultBadge = (r) => {
    switch (r) {
      case "CORRECT":
        return <Badge variant="green" size="sm">Đúng</Badge>;
      case "INCORRECT":
        return <Badge variant="red" size="sm">Sai</Badge>;
      case "BLANK":
        return <Badge variant="slate" size="sm">Để trống</Badge>;
      case "INVALID_MULTIPLE":
        return <Badge variant="amber" size="sm">Tô nhiều ô</Badge>;
      default:
        return <Badge variant="slate" size="sm">{r}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: "Kết quả của tôi", to: "/student/results" },
            { label: result?.examTitle || "Chi tiết kết quả" },
          ]}
        />

        <div className="flex items-center justify-between gap-4 my-6">
          <Link to="/student/results">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>Quay lại danh sách</span>
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={fetchResultDetail} loading={loading}>
            Làm mới
          </Button>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="mb-6">
            {errorMsg}
          </Alert>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Đang tải chi tiết kết quả...</span>
          </div>
        ) : !result ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-500">Không tìm thấy dữ liệu bài thi.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Main Header & Metadata Card */}
            <Card className="p-6 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {result.subject?.name || "Môn thi"}
                    </span>
                    {result.className && (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {result.className}
                      </span>
                    )}
                    <Badge variant="green" size="sm">
                      Kết quả chính thức
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {result.examTitle}
                  </h1>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start bg-slate-50 px-3 py-1.5 rounded-lg">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Công bố: {formatDate(result.publishedAt)}</span>
                </div>
              </div>

              {/* Student and Exam Identifiers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Thí sinh</span>
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {result.studentName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Số báo danh (SBD)</span>
                  <span className="text-sm font-bold font-mono text-blue-700">
                    {result.studentNumber}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Mã đề thi</span>
                  <span className="text-sm font-bold font-mono text-slate-800">
                    {result.examCode}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Số câu hỏi</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {result.questionCount} câu
                  </span>
                </div>
              </div>
            </Card>

            {/* Score Hero Card */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="p-5 bg-blue-600 text-white col-span-1 sm:col-span-2 flex flex-col justify-between">
                <span className="text-xs font-semibold text-blue-100 uppercase tracking-wider">
                  Điểm số chính thức
                </span>
                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-4xl sm:text-5xl font-black">
                    {result.score !== null ? result.score.toFixed(2) : "0.00"}
                  </span>
                  <span className="text-lg text-blue-200 font-medium">
                    / {result.maxScore !== null ? result.maxScore.toFixed(0) : 10}
                  </span>
                </div>
                <div className="text-xs text-blue-100">
                  Tỷ lệ làm đúng:{" "}
                  <strong>
                    {result.questionCount > 0
                      ? Math.round((result.correctCount / result.questionCount) * 100)
                      : 0}
                    %
                  </strong>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-center gap-2 border border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Số câu đúng:</span>
                  <strong className="text-emerald-700 text-base font-bold">
                    {result.correctCount}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Số câu sai:</span>
                  <strong className="text-rose-700 text-base font-bold">
                    {result.incorrectCount}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Số câu để trống:</span>
                  <strong className="text-slate-700 text-base font-bold">
                    {result.blankCount}
                  </strong>
                </div>
              </Card>

              <Card className="p-4 flex flex-col justify-center border border-slate-200 bg-slate-50/50">
                <span className="text-xs text-slate-400 block mb-1">Quyền xem bài thi</span>
                <span className="text-xs font-medium text-slate-700">
                  {result.allowStudentViewAnswers
                    ? "✓ Xem chi tiết từng câu"
                    : "— Chỉ xem điểm tổng quan"}
                </span>
              </Card>
            </div>

            {/* Question Details Section */}
            {result.allowStudentViewAnswers && result.answers ? (
              <Card className="p-6 border border-slate-200">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">Chi tiết các câu hỏi</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Danh sách phương án bạn đã chọn và kết quả chấm của từng câu hỏi
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                        <th className="py-2.5 px-3">Câu</th>
                        <th className="py-2.5 px-3">Phương án bạn chọn</th>
                        <th className="py-2.5 px-3">Kết quả</th>
                        <th className="py-2.5 px-3 text-right">Điểm đạt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.answers.map((a) => (
                        <tr key={a.questionNumber} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            Câu {a.questionNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {a.studentAnswer || (
                              <span className="text-slate-400 font-normal italic">Trống</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">{getResultBadge(a.result)}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                            {a.scoreEarned !== null ? a.scoreEarned.toFixed(2) : "0.00"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-6 bg-slate-50 border border-slate-200 text-center">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Chi tiết từng câu hỏi không được hiển thị
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Theo thiết lập của giáo viên bộ môn, kỳ thi này chỉ công bố điểm tổng quan và số lượng câu đúng/sai. Nếu có thắc mắc, vui lòng liên hệ giáo viên trực tiếp.
                </p>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
