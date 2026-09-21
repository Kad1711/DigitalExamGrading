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
  Plus,
  Layers,
  Sparkles,
} from "lucide-react";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import Breadcrumbs from "../components/ui/Breadcrumbs";

export default function ExamCreatePage() {
  const navigate = useNavigate();

  const [loadingData, setLoadingData] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);

  // Quick Create Class Modal State
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [createClassMode, setCreateClassMode] = useState("BATCH"); // "BATCH" or "SINGLE"
  const [newClassName, setNewClassName] = useState("");
  const [batchClassNamesInput, setBatchClassNamesInput] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("12A");
  const [seriesFrom, setSeriesFrom] = useState(1);
  const [seriesTo, setSeriesTo] = useState(12);
  const [seriesPadZeroes, setSeriesPadZeroes] = useState(true);
  const [newClassGradeId, setNewClassGradeId] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [customDuration, setCustomDuration] = useState(false);
  const [customQuestionCount, setCustomQuestionCount] = useState(false);
  const [sheetPreset, setSheetPreset] = useState("PRESET_45MIN_40Q");
  const [questionCount, setQuestionCount] = useState(40);
  const [maxScore, setMaxScore] = useState(10);
  const [scoringType, setScoringType] = useState("EQUAL");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const PRESET_OPTIONS = [
    {
      id: "PRESET_15MIN_30Q",
      label: "15 phút - 30 câu",
      subLabel: "Kiểm tra 15 phút (2 cột x 15 dòng)",
      duration: 15,
      questions: 30,
      badge: "15 phút",
    },
    {
      id: "PRESET_15MIN_20Q",
      label: "15 phút - 20 câu",
      subLabel: "Kiểm tra nhanh (2 cột x 10 dòng)",
      duration: 15,
      questions: 20,
      badge: "15 phút",
    },
    {
      id: "PRESET_45MIN_40Q",
      label: "45 phút - 40 câu",
      subLabel: "Kiểm tra 1 tiết (2 cột x 20 dòng)",
      duration: 45,
      questions: 40,
      badge: "45 phút",
    },
    {
      id: "PRESET_TERM_50Q",
      label: "Học kỳ - 50 câu",
      subLabel: "Khảo sát chung / Chuẩn (2 cột x 25 dòng)",
      duration: 60,
      questions: 50,
      badge: "60 phút",
    },
    {
      id: "PRESET_45MIN_60Q",
      label: "45 phút - 60 câu",
      subLabel: "Đề tốc độ 60 câu (3 cột x 20 dòng)",
      duration: 45,
      questions: 60,
      badge: "45 phút",
    },
    {
      id: "PRESET_90MIN_60Q",
      label: "90 phút - 60 câu",
      subLabel: "Thi học kỳ 90 phút (3 cột x 20 dòng)",
      duration: 90,
      questions: 60,
      badge: "90 phút",
    },
    {
      id: "PRESET_CUSTOM",
      label: "Tùy chỉnh số câu / thời gian",
      subLabel: "Tự do nhập số câu và thời gian thi",
      duration: null,
      questions: null,
      badge: "Tự chọn",
    },
  ];

  const handleSelectPreset = (p) => {
    setSheetPreset(p.id);
    if (p.id !== "PRESET_CUSTOM") {
      setDurationMinutes(p.duration);
      setQuestionCount(p.questions);
      setCustomDuration(false);
      setCustomQuestionCount(false);
    } else {
      setCustomDuration(true);
      setCustomQuestionCount(true);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoadingData(true);
      setErrorMsg("");

      const [subRes, clsRes, grRes] = await Promise.all([
        api.get("/subjects"),
        api.get("/classes"),
        api.get("/grades").catch(() => ({ data: { data: [] } })),
      ]);

      const subs = subRes.data.data || [];
      const clsList = clsRes.data.data || [];
      const grList = grRes.data?.data || [];

      setSubjects(subs);
      setClasses(clsList);
      setGrades(grList);

      if (subs.length > 0) setSubjectId(subs[0].id);
      if (clsList.length > 0) {
        setClassId(clsList[0].id);
        setSelectedClassIds([clsList[0].id]);
      }
      if (grList.length > 0) {
        setNewClassGradeId(grList[0].id);
        setSelectedGradeId(grList[0].id);
      }
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

  const parsedBatchNames = React.useMemo(() => {
    if (!batchClassNamesInput) return [];
    const raw = batchClassNamesInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = [];
    const seen = new Set();
    for (const item of raw) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(item);
      }
    }
    return unique;
  }, [batchClassNamesInput]);

  const existingClassNamesSet = React.useMemo(() => {
    const set = new Set();
    classes.forEach((c) => set.add(c.name.trim().toLowerCase()));
    return set;
  }, [classes]);

  const duplicateBatchNames = React.useMemo(() => {
    return parsedBatchNames.filter((n) => existingClassNamesSet.has(n.toLowerCase()));
  }, [parsedBatchNames, existingClassNamesSet]);

  const handleFilterOutDuplicates = () => {
    const nonDuplicates = parsedBatchNames.filter(
      (n) => !existingClassNamesSet.has(n.toLowerCase())
    );
    setBatchClassNamesInput(nonDuplicates.join(", "));
  };

  const handleSelectPrefixPreset = (pfx, level) => {
    setSeriesPrefix(pfx);
    const gr = grades.find((g) => g.level === level);
    if (gr) {
      setNewClassGradeId(gr.id);
    }
  };

  const handleBatchInput = (val) => {
    setBatchClassNamesInput(val);
    const firstWord = val.trim().split(/[\n,;\s]+/)[0];
    if (firstWord) {
      const m = firstWord.match(/^(\d{1,2})/);
      if (m) {
        const level = parseInt(m[1], 10);
        const matchedGrade = grades.find((g) => g.level === level);
        if (matchedGrade) {
          setNewClassGradeId(matchedGrade.id);
        }
      }
    }
  };

  const handleGenerateSeries = () => {
    const from = parseInt(seriesFrom, 10) || 1;
    const to = parseInt(seriesTo, 10) || 1;
    if (from > to) {
      setCreateClassError("Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc.");
      return;
    }
    if (to - from > 50) {
      setCreateClassError("Tối đa tạo dãy 50 lớp cùng lúc.");
      return;
    }
    const pfx = (seriesPrefix || "").trim();
    const generated = [];
    for (let i = from; i <= to; i++) {
      const numStr = seriesPadZeroes ? String(i).padStart(2, "0") : String(i);
      generated.push(`${pfx}${numStr}`);
    }
    const combined = Array.from(new Set([...parsedBatchNames, ...generated]));
    setBatchClassNamesInput(combined.join(", "));

    const m = pfx.match(/^(\d{1,2})/);
    if (m) {
      const level = parseInt(m[1], 10);
      const matchedGrade = grades.find((g) => g.level === level);
      if (matchedGrade) {
        setNewClassGradeId(matchedGrade.id);
      }
    }
    setCreateClassError("");
  };

  const handleRemoveBatchTag = (tagToRemove) => {
    const remaining = parsedBatchNames.filter((n) => n !== tagToRemove);
    setBatchClassNamesInput(remaining.join(", "));
  };

  const handleCreateClass = async (e) => {
    if (e) e.preventDefault();
    if (!newClassGradeId) {
      setCreateClassError("Vui lòng chọn khối học.");
      return;
    }

    if (createClassMode === "BATCH") {
      if (parsedBatchNames.length === 0) {
        setCreateClassError("Vui lòng nhập danh sách tên lớp (ví dụ: 12A1, 12A2...).");
        return;
      }

      try {
        setCreatingClass(true);
        setCreateClassError("");

        const res = await api.post("/classes/batch", {
          names: parsedBatchNames,
          gradeId: newClassGradeId,
        });

        const { created } = res.data.data;
        if (created && created.length > 0) {
          setClasses((prev) => [...created, ...prev]);
          setClassId(created[0].id);
        }

        setBatchClassNamesInput("");
        setShowCreateClassModal(false);
      } catch (err) {
        const msg =
          err.response?.data?.error?.message ||
          "Không thể tạo danh sách lớp học. Vui lòng thử lại.";
        setCreateClassError(msg);
      } finally {
        setCreatingClass(false);
      }
    } else {
      if (!newClassName.trim()) {
        setCreateClassError("Vui lòng nhập tên lớp (ví dụ: 12A1).");
        return;
      }

      try {
        setCreatingClass(true);
        setCreateClassError("");

        const res = await api.post("/classes", {
          name: newClassName.trim(),
          gradeId: newClassGradeId,
        });

        const created = res.data.data;
        setClasses((prev) => [created, ...prev]);
        setClassId(created.id);
        setNewClassName("");
        setShowCreateClassModal(false);
      } catch (err) {
        const msg =
          err.response?.data?.error?.message ||
          "Không thể tạo lớp học. Vui lòng thử lại.";
        setCreateClassError(msg);
      } finally {
        setCreatingClass(false);
      }
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

    const classIdsToSend = selectedClassIds.length > 0 ? selectedClassIds : (classId ? [classId] : []);
    if (classIdsToSend.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một lớp học tham gia kỳ thi.");
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
        classId: classIdsToSend[0],
        classIds: classIdsToSend,
        gradeId: selectedGradeId || undefined,
        durationMinutes: Number(durationMinutes) || 45,
        sheetPreset,
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

              {/* Subject & Grade Selection */}
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
                    htmlFor="gradeId"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Khối học (Tùy chọn)
                  </label>
                  <select
                    id="gradeId"
                    disabled={submitting}
                    value={selectedGradeId}
                    onChange={(e) => setSelectedGradeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
                  >
                    <option value="">Tất cả các khối</option>
                    {grades.map((gr) => (
                      <option key={gr.id} value={gr.id}>
                        {gr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Class Assignment */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Lớp học tham gia kỳ thi <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chọn một hoặc nhiều lớp. Giáo viên được phân công giảng dạy môn này ở các lớp đã chọn sẽ cùng truy cập đề thi để chấm bài.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedGradeId && (
                      <button
                        type="button"
                        onClick={() => {
                          const inGrade = classes.filter(
                            (c) => (c.gradeId || c.grade?.id) === selectedGradeId
                          );
                          const inGradeIds = inGrade.map((c) => c.id);
                          const allSelected = inGradeIds.every((id) =>
                            selectedClassIds.includes(id)
                          );
                          if (allSelected) {
                            setSelectedClassIds((prev) =>
                              prev.filter((id) => !inGradeIds.includes(id))
                            );
                          } else {
                            setSelectedClassIds((prev) => [
                              ...new Set([...prev, ...inGradeIds]),
                            ]);
                          }
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Chọn toàn khối
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCreateClassError("");
                        setShowCreateClassModal(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tạo lớp mới
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {classes
                    .filter((cls) => {
                      if (!selectedGradeId) return true;
                      return (cls.gradeId || cls.grade?.id) === selectedGradeId;
                    })
                    .map((cls) => {
                      const isSelected = selectedClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setSelectedClassIds((prev) =>
                              prev.includes(cls.id)
                                ? prev.filter((id) => id !== cls.id)
                                : [...prev, cls.id]
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {isSelected ? (
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 inline-block" />
                          )}
                          {cls.name}
                        </button>
                      );
                    })}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  Đã chọn:{" "}
                  <strong className="text-blue-700 font-bold">
                    {selectedClassIds.length}
                  </strong>{" "}
                  lớp ({classes.filter((c) => selectedClassIds.includes(c.id)).map((c) => c.name).join(", ") || "Chưa chọn lớp nào"})
                </div>
              </div>

              {/* Presets & Answer Sheet Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Mẫu Phiếu Trắc nghiệm Chuẩn THCS (Presets)
                  </label>
                  <span className="text-xs text-blue-600 font-medium">
                    Tự động cấu hình số câu & phiếu OMR
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PRESET_OPTIONS.map((p) => {
                    const isSelected = sheetPreset === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPreset(p)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-bold text-slate-900 line-clamp-1">
                              {p.label}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            {p.subLabel}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Pills for Duration and Question Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Thời gian làm bài
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[15, 45, 60, 90].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => {
                          setDurationMinutes(dur);
                          setCustomDuration(false);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          durationMinutes === dur && !customDuration
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {dur} phút
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomDuration(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        customDuration
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Khác...
                    </button>
                  </div>
                  {customDuration && (
                    <div className="flex items-center gap-2 animate-in fade-in duration-150">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="Nhập số phút"
                        className="w-28 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                      />
                      <span className="text-xs text-slate-500 font-medium">phút</span>
                    </div>
                  )}
                </div>

                {/* Question Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Số câu hỏi trắc nghiệm <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[20, 30, 40, 50, 60].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setQuestionCount(count);
                          setCustomQuestionCount(false);
                          if (count === 30) setSheetPreset("PRESET_15MIN_30Q");
                          else if (count === 20) setSheetPreset("PRESET_15MIN_20Q");
                          else if (count === 40) setSheetPreset("PRESET_45MIN_40Q");
                          else if (count === 50) setSheetPreset("PRESET_TERM_50Q");
                          else if (count === 60) setSheetPreset("PRESET_45MIN_60Q");
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          Number(questionCount) === count && !customQuestionCount
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {count} câu
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomQuestionCount(true);
                        setSheetPreset("PRESET_CUSTOM");
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        customQuestionCount
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Khác...
                    </button>
                  </div>
                  {customQuestionCount ? (
                    <div className="flex items-center gap-2 animate-in fade-in duration-150">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={questionCount}
                        onChange={(e) => setQuestionCount(e.target.value)}
                        placeholder="Nhập số câu"
                        className="w-28 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                      />
                      <span className="text-xs text-slate-500 font-medium">câu (1 - 100)</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Khóa chặt đúng <strong>{questionCount}</strong> câu theo mẫu phiếu trả lời OMR.
                    </p>
                  )}
                </div>
              </div>

              {/* Max Score */}
              <div className="w-full sm:w-1/2">
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
                  Thang điểm tiêu chuẩn bậc THCS là 10.0 điểm.
                </p>
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

      {/* Quick Create Class Modal */}
      <Modal
        isOpen={showCreateClassModal}
        onClose={() => !creatingClass && setShowCreateClassModal(false)}
        title="Tạo Lớp Học Mới"
        description="Thêm một hoặc nhiều lớp học cùng lúc vào hệ thống để tổ chức thi."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateClassModal(false)}
              disabled={creatingClass}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateClass}
              loading={creatingClass}
              disabled={createClassMode === "BATCH" && parsedBatchNames.length === 0}
            >
              {creatingClass
                ? "Đang tạo lớp..."
                : createClassMode === "BATCH"
                ? parsedBatchNames.length > 0
                  ? `Tạo ${parsedBatchNames.length} lớp học`
                  : "Tạo danh sách lớp"
                : "Tạo lớp học"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {createClassError && (
            <Alert variant="danger" onClose={() => setCreateClassError("")}>
              {createClassError}
            </Alert>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCreateClassMode("BATCH")}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                createClassMode === "BATCH"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Tạo nhiều lớp (Nhanh)</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateClassMode("SINGLE")}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                createClassMode === "SINGLE"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Tạo 1 lớp</span>
            </button>
          </div>

          {createClassMode === "BATCH" ? (
            <div className="space-y-3.5">
              {/* Quick Series Generator Tool */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Công cụ tạo nhanh theo dãy số
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-blue-900 cursor-pointer select-none font-medium">
                    <input
                      type="checkbox"
                      checked={seriesPadZeroes}
                      onChange={(e) => setSeriesPadZeroes(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span>Thêm số 0 ở đầu (01, 02...)</span>
                  </label>
                </div>

                {/* THCS & THPT Quick Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-200/60 text-[11px]">
                  <span className="text-slate-500 font-medium">Chọn nhanh khối:</span>
                  {[
                    { label: "6A", level: 6 },
                    { label: "7A", level: 7 },
                    { label: "8A", level: 8 },
                    { label: "9A", level: 9 },
                    { label: "10A", level: 10 },
                    { label: "11A", level: 11 },
                    { label: "12A", level: 12 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectPrefixPreset(preset.label, preset.level)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                        seriesPrefix === preset.label
                          ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      }`}
                    >
                      {preset.label} (K{preset.level})
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[11px]">Tiền tố:</span>
                    <input
                      type="text"
                      value={seriesPrefix}
                      onChange={(e) => setSeriesPrefix(e.target.value)}
                      placeholder="12A"
                      className="w-16 px-2 py-1 text-xs font-semibold bg-white border border-blue-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 text-[11px]">Từ:</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={seriesFrom}
                      onChange={(e) => setSeriesFrom(e.target.value)}
                      className="w-14 px-2 py-1 text-xs bg-white border border-blue-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 text-[11px]">Đến:</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={seriesTo}
                      onChange={(e) => setSeriesTo(e.target.value)}
                      className="w-14 px-2 py-1 text-xs bg-white border border-blue-200 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSeries}
                    className="!py-1 !text-xs !bg-white hover:!bg-blue-100 !border-blue-300 !text-blue-700 font-semibold cursor-pointer"
                  >
                    + Điền dãy {seriesPrefix}
                    {seriesPadZeroes
                      ? String(seriesFrom).padStart(2, "0")
                      : seriesFrom}{" "}
                    → {seriesPrefix}
                    {seriesPadZeroes
                      ? String(seriesTo).padStart(2, "0")
                      : seriesTo}
                  </Button>
                </div>
              </div>

              {/* Multi-class Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Danh sách tên lớp học <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Phân cách bằng dấu phẩy (,), chấm phẩy (;) hoặc xuống dòng
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  disabled={creatingClass}
                  value={batchClassNamesInput}
                  onChange={(e) => handleBatchInput(e.target.value)}
                  placeholder="Ví dụ: 12A01, 12A02, 12A03, 12A04, 12A05... (hoặc dán từ Excel)"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
                />
              </div>

              {/* Duplicate classes alert */}
              {duplicateBatchNames.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">⚠️ Có {duplicateBatchNames.length} lớp đã tồn tại: </span>
                    <span>{duplicateBatchNames.join(", ")}. Dữ liệu lớp cũ được bảo toàn tuyệt đối, hệ thống sẽ không ghi đè.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFilterOutDuplicates}
                    className="shrink-0 px-2 py-1 bg-white border border-amber-300 rounded text-amber-800 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Lọc bỏ các lớp trùng
                  </button>
                </div>
              )}

              {/* Tags Preview */}
              {parsedBatchNames.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">
                      Sẽ tạo <span className="text-blue-600 font-bold">{parsedBatchNames.length}</span> lớp học:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBatchClassNamesInput("")}
                      className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {parsedBatchNames.map((name) => {
                      const isDup = existingClassNamesSet.has(name.toLowerCase());
                      return (
                        <span
                          key={name}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border shadow-2xs ${
                            isDup
                              ? "bg-amber-50 border-amber-300 text-amber-800"
                              : "bg-white border-blue-200 text-blue-800"
                          }`}
                        >
                          {name}
                          {isDup && (
                            <span className="text-[10px] font-normal text-amber-600">
                              (Đã có)
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchTag(name)}
                            title={`Bỏ lớp ${name}`}
                            className="text-slate-400 hover:text-rose-600 text-sm leading-none cursor-pointer"
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên lớp học <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                disabled={creatingClass}
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Ví dụ: 12A1, 10A3..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Khối học <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={creatingClass}
              value={newClassGradeId}
              onChange={(e) => setNewClassGradeId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
            >
              {grades.map((gr) => (
                <option key={gr.id} value={gr.id}>
                  {gr.name} (Khối {gr.level})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
