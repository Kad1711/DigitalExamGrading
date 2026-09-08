import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import {
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCheck,
} from "lucide-react";
import { getErrorMessage } from "../utils/error-map";

export default function StudentResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await api.get("/student/results");
      setResults(res.data.data || []);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msg = err.response?.data?.error?.message;
      setErrorMsg(getErrorMessage(code, msg || "Không thể tải danh sách kết quả thi."));
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Award className="w-7 h-7 text-blue-600" />
              <span>Kết quả thi của tôi</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Xem điểm số và kết quả chính thức các kỳ thi đã được nhà trường công bố
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchResults} loading={loading}>
            Làm mới
          </Button>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="mb-6" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Đang tải kết quả thi...</span>
          </div>
        ) : results.length === 0 ? (
          <Card className="p-12 text-center">
            <EmptyState
              icon={FileCheck}
              title="Chưa có kết quả nào được công bố"
              description="Hiện tại bạn chưa có bài thi nào được giáo viên công bố kết quả chính thức. Vui lòng quay lại sau."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {results.map((item) => (
              <Card
                key={item.examId}
                className="p-5 hover:shadow-md transition-shadow border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top metadata */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {item.subject?.name || "Môn thi"}
                        </span>
                        {item.className && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {item.className}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-slate-900 line-clamp-1">
                        {item.examTitle}
                      </h3>
                    </div>
                    <Badge variant="green" size="sm">
                      Đã công bố
                    </Badge>
                  </div>

                  {/* Date & SBD */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(item.publishedAt)}
                    </span>
                    <span>
                      SBD: <strong className="text-slate-700 font-mono">{item.studentNumber}</strong>
                    </span>
                    <span>
                      Mã đề: <strong className="text-slate-700 font-mono">{item.examCode}</strong>
                    </span>
                  </div>

                  {/* Score hero */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 mb-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Điểm chính thức
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl font-black text-blue-600">
                          {item.score !== null ? item.score.toFixed(2) : "0.00"}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          / {item.maxScore !== null ? item.maxScore.toFixed(0) : 10}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{item.correctCount} đúng</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-700">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{item.incorrectCount} sai</span>
                      </div>
                      {item.blankCount > 0 && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{item.blankCount} trống</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <Link to={`/student/results/${item.examId}`} className="block">
                  <Button variant="secondary" size="sm" className="w-full justify-center">
                    <span>Xem chi tiết bài làm</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
