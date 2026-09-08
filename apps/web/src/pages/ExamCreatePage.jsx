import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import { getErrorMessage } from "../utils/error-map";
import { examDetailPath } from "../utils/slug";
import {
  ArrowLeft,
  BookOpen,
  Users,
  CheckCircle,
  HelpCircle,
  Award,
  Calculator,
  Loader2,
} from "lucide-react";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Breadcrumbs from "../components/ui/Breadcrumbs";

export default function ExamCreatePage() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [questionCount, setQuestionCount] = useState(40);
  const [maxScore, setMaxScore] = useState(10);
  const [scoringType, setScoringType] = useState("EQUAL");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoadingData(true);
      setErrorMsg("");

      const [subRes, clsRes] = await Promise.all([
        api.get("/subjects"),
        api.get("/classes"),
      ]);

      const subs = subRes.data.data || [];
      const clsList = clsRes.data.data || [];

      setSubjects(subs);
      setClasses(clsList);

      if (subs.length > 0) setSubjectId(subs[0].id);
      if (clsList.length > 0) setClassId(clsList[0].id);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(
          code,
          raw || "Không thể tải danh sách môn học hoặc lớp học."
        )
      );
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên kỳ thi.");
      return;
    }

    if (!subjectId) {
      setErrorMsg("Vui lòng chọn môn học.");
      return;
    }

    if (!classId) {
      setErrorMsg("Vui lòng chọn lớp học.");
      return;
    }

    const qCount = Number(questionCount);
    if (isNaN(qCount) || qCount <= 0 || !Number.isInteger(qCount)) {
      setErrorMsg("Số câu hỏi phải là số nguyên lớn hơn 0.");
      return;
    }

    const mScore = Number(maxScore);
    if (isNaN(mScore) || mScore <= 0 || mScore > 10) {
      setErrorMsg("Thang điểm tối đa phải lớn hơn 0 và không vượt quá 10.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        subjectId,
        classId,
        questionCount: qCount,
        maxScore: mScore,
        scoringType,
      };

      const res = await api.post("/exams", payload);
      const createdExam = res.data.data;

      navigate(examDetailPath(createdExam));
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const raw = err.response?.data?.error?.message;
      setErrorMsg(
        getErrorMessage(code, raw || "Không thể tạo kỳ thi. Vui lòng thử lại.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={[{ label: "Tạo kỳ thi mới" }]} />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tạo Kỳ thi Mới
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kỳ thi sẽ được tạo ở trạng thái{" "}
            <span className="font-semibold text-slate-700">Nháp (DRAFT)</span>.
            Sau khi tạo, bạn sẽ thiết lập mã đề, nhập đáp án và tạo mẫu phiếu
            trả lời OMR.
          </p>
        </div>

        {errorMsg && (
          <Alert
            variant="danger"
            className="mb-6"
            onClose={() => setErrorMsg("")}
          >
            {errorMsg}
          </Alert>
        )}

        {loadingData ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
            <span className="text-sm font-medium">
              Đang tải danh mục môn học và lớp...
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {/* Exam Title */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Tên kỳ thi <span className="text-rose-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  disabled={submitting}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra 1 tiết Toán 11 - Học kỳ 2"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Ghi chú / Mô tả (tùy chọn)
                </label>
                <textarea
                  id="description"
                  rows={2}
                  disabled={submitting}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Phạm vi bài thi, phòng thi, giáo viên phụ trách..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                />
              </div>

              {/* Subject & Class (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="subjectId"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Môn học <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="subjectId"
                    required
                    disabled={submitting}
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="classId"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Lớp học <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="classId"
                    required
                    disabled={submitting}
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.grade?.name || "Khối"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Question Count & Max Score */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="questionCount"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Số câu hỏi trắc nghiệm{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="questionCount"
                    type="number"
                    min={1}
                    max={100}
                    required
                    disabled={submitting}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Phiếu OMR 1 trang hỗ trợ tối đa 50 câu.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="maxScore"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Thang điểm tối đa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="maxScore"
                    type="number"
                    step="0.1"
                    min={1}
                    max={10}
                    required
                    disabled={submitting}
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Thang điểm tiêu chuẩn THPT là 10.0 điểm.
                  </p>
                </div>
              </div>

              {/* Scoring Type Radio Cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Hình thức tính điểm <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* EQUAL */}
                  <label
                    className={`relative flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                      scoringType === "EQUAL"
                        ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scoringType"
                      value="EQUAL"
                      checked={scoringType === "EQUAL"}
                      onChange={() => setScoringType("EQUAL")}
                      disabled={submitting}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-semibold text-slate-900">
                        Chia đều điểm số (EQUAL)
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Mỗi câu hỏi có trọng số bằng nhau:{" "}
                        <code className="text-slate-700 font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">
                          (Số câu đúng / Tổng số câu) &times; Thang điểm
                        </code>
                      </span>
                    </div>
                  </label>

                  {/* CUSTOM */}
                  <label
                    className={`relative flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                      scoringType === "CUSTOM"
                        ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scoringType"
                      value="CUSTOM"
                      checked={scoringType === "CUSTOM"}
                      onChange={() => setScoringType("CUSTOM")}
                      disabled={submitting}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="block text-sm font-semibold text-slate-900">
                        Điểm tùy chỉnh từng câu (CUSTOM)
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                        Chỉ định điểm số riêng cho từng câu hỏi. Tổng điểm các
                        câu phải bằng đúng thang điểm tối đa.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate("/exams")}
                  disabled={submitting}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={submitting}
                >
                  {submitting
                    ? "Đang khởi tạo..."
                    : "Tạo kỳ thi & Tiếp tục thiết lập"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
