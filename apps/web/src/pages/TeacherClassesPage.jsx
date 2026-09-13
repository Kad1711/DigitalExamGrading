import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/client";
import AppHeader from "../components/AppHeader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import {
  Users,
  GraduationCap,
  Plus,
  Upload,
  FileSpreadsheet,
  Trash2,
  Search,
  Loader2,
  ChevronRight,
  Sparkles,
  Layers,
  Pencil,
  Eye,
  EyeOff,
  Copy,
  Check,
  ArrowUpDown,
  AlertTriangle,
} from "lucide-react";

/**
 * Helper to compute suggested 6-digit SBD (KKLLSS):
 * KK: Grade level (06, 09, 12...)
 * LL: Class number (9C06 -> 06, 12A01 -> 01, 6A -> 01)
 * SS: Student index (01, 02...)
 */
export function getSuggestedSbd(className = "", gradeLevel = null, nextIndex = 1) {
  let kk = "00";
  if (gradeLevel && !isNaN(parseInt(gradeLevel, 10))) {
    kk = String(parseInt(gradeLevel, 10)).padStart(2, "0");
  } else {
    const mGrade = (className || "").match(/^(\d{1,2})/);
    if (mGrade) {
      kk = String(parseInt(mGrade[1], 10)).padStart(2, "0");
    }
  }

  let ll = "01";
  const mClassNum = (className || "").match(/^(\d{1,2})[A-Za-z_-]*(\d+)/);
  if (mClassNum && mClassNum[2]) {
    ll = String(parseInt(mClassNum[2], 10)).padStart(2, "0");
  } else {
    const mLetter = (className || "").match(/^(\d{1,2})([A-Za-z])/);
    if (mLetter && mLetter[2]) {
      const code = mLetter[2].toUpperCase().charCodeAt(0) - 64;
      if (code >= 1 && code <= 99) {
        ll = String(code).padStart(2, "0");
      }
    }
  }

  const ss = String(Math.max(1, parseInt(nextIndex, 10) || 1)).padStart(2, "0");
  return `${kk}${ll}${ss}`;
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [studentSearch, setStudentSearch] = useState("");

  // Student table password visibility & sorting states
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [studentSortField, setStudentSortField] = useState("NAME"); // "NAME" (Tên A-Z) or "CODE" (SBD)
  const [studentSortOrder, setStudentSortOrder] = useState("asc");

  // Selection & Bulk Deletion States (Students)
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showBulkDeleteStudentsModal, setShowBulkDeleteStudentsModal] = useState(false);
  const [deletingBulkStudents, setDeletingBulkStudents] = useState(false);

  // Clear All Students Modal
  const [showClearStudentsModal, setShowClearStudentsModal] = useState(false);
  const [clearingStudents, setClearingStudents] = useState(false);

  // Class Selection & Bulk Deletion States (Classes)
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [showBulkDeleteClassesModal, setShowBulkDeleteClassesModal] = useState(false);
  const [deletingBulkClasses, setDeletingBulkClasses] = useState(false);

  // Smart SBD Standardization States
  const [showStandardizeModal, setShowStandardizeModal] = useState(false);
  const [standardizingSbd, setStandardizingSbd] = useState(false);

  // Grade Filter & Accordion Grouping States
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("ALL"); // "ALL" or gradeId
  const [classSearch, setClassSearch] = useState("");
  const [expandedGradeIds, setExpandedGradeIds] = useState({});

  // Regex validation rules
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const CODE_REGEX = /^[A-Za-z0-9_-]+$/;

  // Create Class Modal
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [createClassMode, setCreateClassMode] = useState("BATCH"); // "BATCH" or "SINGLE"
  const [newClassName, setNewClassName] = useState("");
  const [batchClassNamesInput, setBatchClassNamesInput] = useState("");
  const [seriesPrefix, setSeriesPrefix] = useState("12A");
  const [seriesFrom, setSeriesFrom] = useState(1);
  const [seriesTo, setSeriesTo] = useState(12);
  const [seriesPadZeroes, setSeriesPadZeroes] = useState(true); // default pad '01', '02'...
  const [newClassGradeId, setNewClassGradeId] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [createClassError, setCreateClassError] = useState("");

  // Edit Class Modal
  const [classToEdit, setClassToEdit] = useState(null);
  const [editClassName, setEditClassName] = useState("");
  const [editClassGradeId, setEditClassGradeId] = useState("");
  const [updatingClass, setUpdatingClass] = useState(false);
  const [editClassError, setEditClassError] = useState("");

  // Add Student Modal
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [studentFullName, setStudentFullName] = useState("");
  const [studentDob, setStudentDob] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("123456");
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");

  // Edit Student Modal
  const [studentToEdit, setStudentToEdit] = useState(null);
  const [editStudentCode, setEditStudentCode] = useState("");
  const [editStudentFullName, setEditStudentFullName] = useState("");
  const [editStudentDob, setEditStudentDob] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentPassword, setEditStudentPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState("");

  // Smart Excel Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);

  // Mapping Form State
  const [nameMode, setNameMode] = useState("SINGLE"); // "SINGLE" or "SPLIT"
  const [mappingStudentCodeCol, setMappingStudentCodeCol] = useState("");
  const [mappingFullNameCol, setMappingFullNameCol] = useState("");
  const [mappingLastNameCol, setMappingLastNameCol] = useState("");
  const [mappingFirstNameCol, setMappingFirstNameCol] = useState("");
  const [mappingDobCol, setMappingDobCol] = useState("");

  // Delete Class Confirmation Modal
  const [classToDelete, setClassToDelete] = useState(null);
  const [deletingClass, setDeletingClass] = useState(false);

  // Load Classes & Grades
  const loadClassesAndGrades = useCallback(async () => {
    try {
      setLoadingClasses(true);
      setErrorMsg("");

      const [clsRes, grRes] = await Promise.all([
        api.get("/classes"),
        api.get("/grades").catch(() => ({ data: { data: [] } })),
      ]);

      const clsList = clsRes.data?.data || [];
      const grList = grRes.data?.data || [];

      setClasses(clsList);
      setGrades(grList);

      if (grList.length > 0 && !newClassGradeId) {
        setNewClassGradeId(grList[0].id);
      }

      if (clsList.length > 0 && !selectedClassId) {
        setSelectedClassId(clsList[0].id);
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể tải danh sách lớp học."
      );
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedClassId, newClassGradeId]);

  useEffect(() => {
    loadClassesAndGrades();
  }, [loadClassesAndGrades]);

  // Load Students when selectedClassId changes
  const loadClassStudents = useCallback(async (classId) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    try {
      setLoadingStudents(true);
      const res = await api.get(`/classes/${classId}/students`);
      setStudents(res.data?.data || []);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể tải danh sách học sinh của lớp."
      );
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadClassStudents(selectedClassId);
    }
  }, [selectedClassId, loadClassStudents]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Toggle password visibility for a single student
  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleAllPasswords = () => {
    setShowAllPasswords((prev) => !prev);
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current));
    }, 2000);
  };

  const handleSort = (field) => {
    if (studentSortField === field) {
      setStudentSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setStudentSortField(field);
      setStudentSortOrder("asc");
    }
  };

  // Vietnamese Name comparator (Tên A-Z, then Họ đệm)
  const compareVietnameseNames = (aFullName = "", bFullName = "") => {
    const cleanA = (aFullName || "").trim();
    const cleanB = (bFullName || "").trim();
    if (!cleanA && !cleanB) return 0;
    if (!cleanA) return 1;
    if (!cleanB) return -1;
    const aParts = cleanA.split(/\s+/);
    const bParts = cleanB.split(/\s+/);
    const aFirst = aParts[aParts.length - 1] || "";
    const bFirst = bParts[bParts.length - 1] || "";
    const cmp = aFirst.localeCompare(bFirst, "vi", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return cleanA.localeCompare(cleanB, "vi", { sensitivity: "base" });
  };

  // Filtered & sorted students by search and chosen column
  const filteredStudents = useMemo(() => {
    let result = [...students];
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.fullName?.toLowerCase().includes(q) ||
          s.studentCode?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (studentSortField === "NAME") {
        cmp = compareVietnameseNames(a.fullName, b.fullName);
      } else if (studentSortField === "CODE") {
        const numA = parseInt(a.studentCode, 10);
        const numB = parseInt(b.studentCode, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          cmp = numA - numB;
        } else {
          cmp = (a.studentCode || "").localeCompare(b.studentCode || "", "vi", { numeric: true });
        }
      }
      return studentSortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [students, studentSearch, studentSortField, studentSortOrder]);

  // Parsed unique class names from batch input
  const parsedBatchNames = useMemo(() => {
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

  // Set of existing class names for duplicate detection & safety
  const existingClassNamesSet = useMemo(() => {
    const set = new Set();
    classes.forEach((c) => set.add(c.name.trim().toLowerCase()));
    return set;
  }, [classes]);

  const duplicateBatchNames = useMemo(() => {
    return parsedBatchNames.filter((n) => existingClassNamesSet.has(n.toLowerCase()));
  }, [parsedBatchNames, existingClassNamesSet]);

  const handleFilterOutDuplicates = () => {
    const nonDuplicates = parsedBatchNames.filter(
      (n) => !existingClassNamesSet.has(n.toLowerCase())
    );
    setBatchClassNamesInput(nonDuplicates.join(", "));
  };

  // Quick preset selector for THCS and THPT series
  const handleSelectPrefixPreset = (pfx, level) => {
    setSeriesPrefix(pfx);
    const gr = grades.find((g) => g.level === level);
    if (gr) {
      setNewClassGradeId(gr.id);
    }
  };

  const handleSingleNameInput = (val) => {
    setNewClassName(val);
    const m = val.trim().match(/^(\d{1,2})/);
    if (m) {
      const level = parseInt(m[1], 10);
      const matchedGrade = grades.find((g) => g.level === level);
      if (matchedGrade) {
        setNewClassGradeId(matchedGrade.id);
      }
    }
  };

  // Handle batch input with auto-grade detection
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

  // Quick series generator with optional zero-padding (01, 02... vs 1, 2...)
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

  // Handler: Open Edit Class
  const handleOpenEditClass = (cls) => {
    setClassToEdit(cls);
    setEditClassName(cls.name);
    setEditClassGradeId(cls.gradeId);
    setEditClassError("");
  };

  // Handler: Update Class
  const handleUpdateClass = async (e) => {
    if (e) e.preventDefault();
    if (!editClassName.trim()) {
      setEditClassError("Vui lòng nhập tên lớp học.");
      return;
    }
    if (!editClassGradeId) {
      setEditClassError("Vui lòng chọn khối học.");
      return;
    }

    try {
      setUpdatingClass(true);
      setEditClassError("");
      const res = await api.patch(`/classes/${classToEdit.id}`, {
        name: editClassName.trim(),
        gradeId: editClassGradeId,
      });

      const updated = res.data.data;
      setClasses((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
      setSuccessMsg(`Đã cập nhật thông tin lớp "${updated.name}" thành công.`);
      setClassToEdit(null);
    } catch (err) {
      setEditClassError(
        err.response?.data?.error?.message || "Lỗi cập nhật lớp học. Vui lòng thử lại."
      );
    } finally {
      setUpdatingClass(false);
    }
  };

  // Handler: Open Edit Student
  const handleOpenEditStudent = (s) => {
    setStudentToEdit(s);
    setEditStudentCode(s.studentCode || "");
    setEditStudentFullName(s.fullName || "");
    setEditStudentDob(s.dateOfBirth ? s.dateOfBirth.split("T")[0] : "");
    setEditStudentEmail(s.email || "");
    setEditStudentPassword(s.initialPassword || "123456");
    setShowEditPassword(false);
    setEditStudentError("");
  };

  // Toggle select single student
  const toggleSelectStudent = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Toggle select all filtered students
  const toggleSelectAllStudents = () => {
    if (filteredStudents.length === 0) return;
    const allFilteredIds = filteredStudents.map((s) => s.studentId);
    const isAllSelected = allFilteredIds.every((id) => selectedStudentIds.includes(id));
    if (isAllSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Bulk remove selected students from class
  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.length === 0 || !selectedClassId) return;
    try {
      setDeletingBulkStudents(true);
      const res = await api.post(`/classes/${selectedClassId}/students/bulk-delete`, {
        studentIds: selectedStudentIds,
      });
      const deletedCount = res.data?.data?.deletedCount ?? selectedStudentIds.length;
      setStudents((prev) => prev.filter((s) => !selectedStudentIds.includes(s.studentId)));
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId
            ? { ...c, studentCount: Math.max(0, c.studentCount - deletedCount) }
            : c
        )
      );
      setSuccessMsg(`Đã xóa ${deletedCount} học sinh khỏi lớp "${selectedClass?.name}".`);
      setSelectedStudentIds([]);
      setShowBulkDeleteStudentsModal(false);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể xóa danh sách học sinh đã chọn."
      );
    } finally {
      setDeletingBulkStudents(false);
    }
  };

  // Clear all students in current class
  const handleClearClassStudents = async () => {
    if (!selectedClassId) return;
    try {
      setClearingStudents(true);
      const res = await api.delete(`/classes/${selectedClassId}/students`);
      const deletedCount = res.data?.data?.deletedCount ?? students.length;
      setStudents([]);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId ? { ...c, studentCount: 0 } : c
        )
      );
      setSuccessMsg(`Đã xóa toàn bộ ${deletedCount} học sinh khỏi lớp "${selectedClass?.name}".`);
      setSelectedStudentIds([]);
      setShowClearStudentsModal(false);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể xóa toàn bộ học sinh trong lớp."
      );
    } finally {
      setClearingStudents(false);
    }
  };

  // Class Selection handlers
  const toggleSelectClass = (classId) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length && classes.length > 0) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  // Bulk delete selected classes
  const handleBulkDeleteClasses = async () => {
    if (selectedClassIds.length === 0) return;
    try {
      setDeletingBulkClasses(true);
      const res = await api.post("/classes/bulk-delete", {
        classIds: selectedClassIds,
      });
      const deletedCount = res.data?.data?.deletedCount ?? selectedClassIds.length;
      const remainingClasses = classes.filter((c) => !selectedClassIds.includes(c.id));
      setClasses(remainingClasses);
      if (selectedClassIds.includes(selectedClassId)) {
        setSelectedClassId(remainingClasses.length > 0 ? remainingClasses[0].id : null);
      }
      setSuccessMsg(`Đã xóa thành công ${deletedCount} lớp học.`);
      setSelectedClassIds([]);
      setShowBulkDeleteClassesModal(false);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể xóa các lớp học đã chọn."
      );
    } finally {
      setDeletingBulkClasses(false);
    }
  };

  // Grade list with counts for filter chips
  const gradeListWithCounts = useMemo(() => {
    const gradeMap = new Map();
    grades.forEach((g) => {
      gradeMap.set(g.id, { id: g.id, name: g.name, level: g.level, classCount: 0, studentCount: 0 });
    });
    classes.forEach((c) => {
      if (c.gradeId && gradeMap.has(c.gradeId)) {
        const item = gradeMap.get(c.gradeId);
        item.classCount++;
        item.studentCount += c.studentCount || 0;
      } else if (c.gradeId) {
        gradeMap.set(c.gradeId, {
          id: c.gradeId,
          name: c.gradeName || `Khối ${c.gradeLevel || ""}`,
          level: c.gradeLevel ?? 99,
          classCount: 1,
          studentCount: c.studentCount || 0,
        });
      }
    });
    return Array.from(gradeMap.values())
      .filter((g) => g.classCount > 0)
      .sort((a, b) => a.level - b.level);
  }, [grades, classes]);

  // Grouped and filtered classes by grade
  const groupedClasses = useMemo(() => {
    let filtered = classes;

    // 1. Filter by grade if not ALL
    if (selectedGradeFilter !== "ALL") {
      filtered = filtered.filter((c) => c.gradeId === selectedGradeFilter);
    }

    // 2. Filter by search keyword
    if (classSearch.trim()) {
      const q = classSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.gradeName && c.gradeName.toLowerCase().includes(q))
      );
    }

    // 3. Group by Grade
    const map = new Map();
    for (const cls of filtered) {
      const gId = cls.gradeId || "unknown";
      if (!map.has(gId)) {
        map.set(gId, {
          gradeId: gId,
          gradeName: cls.gradeName || `Khối ${cls.gradeLevel || ""}`,
          gradeLevel: cls.gradeLevel ?? 99,
          classes: [],
          totalStudents: 0,
        });
      }
      const gObj = map.get(gId);
      gObj.classes.push(cls);
      gObj.totalStudents += cls.studentCount || 0;
    }

    return Array.from(map.values()).sort((a, b) => a.gradeLevel - b.gradeLevel);
  }, [classes, selectedGradeFilter, classSearch]);

  // All visible class IDs
  const allVisibleClassIds = useMemo(() => {
    return groupedClasses.flatMap((g) => g.classes.map((c) => c.id));
  }, [groupedClasses]);

  const isAllVisibleSelected =
    allVisibleClassIds.length > 0 &&
    allVisibleClassIds.every((id) => selectedClassIds.includes(id));

  const toggleSelectVisibleClasses = () => {
    if (isAllVisibleSelected) {
      setSelectedClassIds((prev) =>
        prev.filter((id) => !allVisibleClassIds.includes(id))
      );
    } else {
      setSelectedClassIds((prev) =>
        Array.from(new Set([...prev, ...allVisibleClassIds]))
      );
    }
  };

  // Expand / collapse helpers
  const toggleGradeExpand = (gradeId) => {
    setExpandedGradeIds((prev) => ({
      ...prev,
      [gradeId]: !prev[gradeId],
    }));
  };

  const handleExpandAllGrades = () => {
    const next = {};
    groupedClasses.forEach((g) => {
      next[g.gradeId] = true;
    });
    setExpandedGradeIds(next);
  };

  const handleCollapseAllGrades = () => {
    setExpandedGradeIds({});
  };

  // Toggle select all classes in a specific grade
  const toggleSelectGradeClasses = (gradeClasses) => {
    const gradeClassIds = gradeClasses.map((c) => c.id);
    const allSelected = gradeClassIds.every((id) => selectedClassIds.includes(id));
    if (allSelected) {
      setSelectedClassIds((prev) => prev.filter((id) => !gradeClassIds.includes(id)));
    } else {
      setSelectedClassIds((prev) => Array.from(new Set([...prev, ...gradeClassIds])));
    }
  };

  // Initialize expanded grades when classes load
  useEffect(() => {
    if (classes.length > 0) {
      setExpandedGradeIds((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const initial = {};
        classes.forEach((c) => {
          if (c.gradeId) initial[c.gradeId] = true;
        });
        return initial;
      });
    }
  }, [classes]);

  // Auto-expand active class's grade
  useEffect(() => {
    if (selectedClass?.gradeId) {
      setExpandedGradeIds((prev) => ({
        ...prev,
        [selectedClass.gradeId]: true,
      }));
    }
  }, [selectedClass?.gradeId]);

  // Auto-expand all matching grades when user searches
  useEffect(() => {
    if (classSearch.trim()) {
      const next = {};
      groupedClasses.forEach((g) => {
        next[g.gradeId] = true;
      });
      setExpandedGradeIds((prev) => ({ ...prev, ...next }));
    }
  }, [classSearch, groupedClasses]);

  // Open Add Student Modal with smart SBD prefill
  const handleOpenAddStudent = () => {
    setAddStudentError("");
    const suggested = getSuggestedSbd(
      selectedClass?.name,
      selectedClass?.gradeLevel,
      students.length + 1
    );
    setStudentCode(suggested);
    setStudentFullName("");
    setStudentDob("");
    setStudentEmail("");
    setStudentPassword("123456");
    setShowAddStudentModal(true);
  };

  // Standardize SBD for entire class
  const handleConfirmStandardizeSbd = async () => {
    if (!selectedClassId) return;
    try {
      setStandardizingSbd(true);
      const res = await api.post(`/classes/${selectedClassId}/standardize-sbd`);
      const { students: updatedList, message } = res.data.data;
      setStudents(updatedList);
      setSuccessMsg(message || `Đã chuẩn hóa SBD 6 số cho học sinh lớp "${selectedClass?.name}".`);
      setShowStandardizeModal(false);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể chuẩn hóa Số Báo Danh."
      );
    } finally {
      setStandardizingSbd(false);
    }
  };

  // Handler: Update Student
  const handleUpdateStudent = async (e) => {
    if (e) e.preventDefault();
    const code = editStudentCode.trim();
    const name = editStudentFullName.trim();
    const email = editStudentEmail.trim();
    const pwd = editStudentPassword.trim();

    if (!code) {
      setEditStudentError("Vui lòng nhập Mã học sinh / SBD.");
      return;
    }
    if (!CODE_REGEX.test(code)) {
      setEditStudentError("Mã học sinh / SBD chỉ được chứa chữ cái, số, gạch nối (-) hoặc gạch dưới (_).");
      return;
    }
    if (!name || name.length < 2) {
      setEditStudentError("Họ và tên học sinh phải có ít nhất 2 ký tự.");
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      setEditStudentError("Email tài khoản không đúng định dạng (ví dụ: student@example.com).");
      return;
    }
    if (pwd && pwd.length < 6) {
      setEditStudentError("Mật khẩu học sinh phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      setUpdatingStudent(true);
      setEditStudentError("");
      const payload = {
        studentCode: code,
        fullName: name,
        dateOfBirth: editStudentDob || null,
        email: email || null,
      };
      if (pwd) {
        payload.password = pwd;
      }

      const res = await api.patch(`/classes/${selectedClassId}/students/${studentToEdit.studentId}`, payload);

      const updated = res.data.data;
      setStudents((prev) =>
        prev.map((s) => (s.studentId === updated.studentId ? { ...s, ...updated } : s))
      );
      setSuccessMsg(`Đã cập nhật thông tin học sinh "${updated.fullName}" thành công.`);
      setStudentToEdit(null);
    } catch (err) {
      setEditStudentError(
        err.response?.data?.error?.message || "Lỗi cập nhật học sinh. Vui lòng thử lại."
      );
    } finally {
      setUpdatingStudent(false);
    }
  };

  // Handler: Create Class
  const handleCreateClass = async (e) => {
    if (e) e.preventDefault();
    if (!newClassGradeId) {
      setCreateClassError("Vui lòng chọn khối học.");
      return;
    }

    if (createClassMode === "BATCH") {
      if (parsedBatchNames.length === 0) {
        setCreateClassError("Vui lòng nhập danh sách tên lớp học (ví dụ: 12A1, 12A2...).");
        return;
      }

      try {
        setCreatingClass(true);
        setCreateClassError("");

        const res = await api.post("/classes/batch", {
          names: parsedBatchNames,
          gradeId: newClassGradeId,
        });

        const { created, skipped, totalCreated, totalSkipped } = res.data.data;
        if (created && created.length > 0) {
          setClasses((prev) => [...created, ...prev]);
          setSelectedClassId(created[0].id);
        }

        let msg = `Đã tạo thành công ${totalCreated} lớp học mới!`;
        if (totalSkipped > 0) {
          msg += ` (Bỏ qua ${totalSkipped} lớp đã tồn tại: ${skipped.join(", ")})`;
        }
        setSuccessMsg(msg);
        setBatchClassNamesInput("");
        setShowCreateClassModal(false);
      } catch (err) {
        setCreateClassError(
          err.response?.data?.error?.message || "Lỗi tạo danh sách lớp học. Vui lòng thử lại."
        );
      } finally {
        setCreatingClass(false);
      }
    } else {
      const clsName = newClassName.trim();
      if (!clsName || clsName.length < 2) {
        setCreateClassError("Vui lòng nhập tên lớp học hợp lệ (ít nhất 2 ký tự).");
        return;
      }

      try {
        setCreatingClass(true);
        setCreateClassError("");

        const res = await api.post("/classes", {
          name: clsName,
          gradeId: newClassGradeId,
        });

        const created = res.data.data;
        setClasses((prev) => [created, ...prev]);
        setSelectedClassId(created.id);
        setNewClassName("");
        setShowCreateClassModal(false);
        setSuccessMsg(`Đã tạo lớp học "${created.name}" thành công.`);
      } catch (err) {
        setCreateClassError(
          err.response?.data?.error?.message || "Lỗi tạo lớp học. Vui lòng thử lại."
        );
      } finally {
        setCreatingClass(false);
      }
    }
  };

  // Handler: Delete Class
  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      setDeletingClass(true);
      await api.delete(`/classes/${classToDelete.id}`);
      const remaining = classes.filter((c) => c.id !== classToDelete.id);
      setClasses(remaining);
      if (selectedClassId === classToDelete.id) {
        setSelectedClassId(remaining.length > 0 ? remaining[0].id : null);
      }
      setSelectedClassIds((prev) => prev.filter((id) => id !== classToDelete.id));
      setClassToDelete(null);
      setSuccessMsg(`Đã xóa lớp "${classToDelete.name}" thành công.`);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể xóa lớp học."
      );
    } finally {
      setDeletingClass(false);
    }
  };

  // Handler: Add Student Manually
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const code = studentCode.trim();
    const name = studentFullName.trim();
    const email = studentEmail.trim();
    const pwd = studentPassword.trim();

    if (!code) {
      setAddStudentError("Vui lòng nhập Mã học sinh / Số báo danh.");
      return;
    }
    if (!CODE_REGEX.test(code)) {
      setAddStudentError("Mã học sinh / SBD chỉ được chứa chữ cái, số, gạch nối (-) hoặc gạch dưới (_).");
      return;
    }
    if (!name || name.length < 2) {
      setAddStudentError("Họ và tên học sinh phải có ít nhất 2 ký tự.");
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      setAddStudentError("Email tài khoản không đúng định dạng (ví dụ: student@example.com).");
      return;
    }
    if (pwd && pwd.length < 6) {
      setAddStudentError("Mật khẩu học sinh phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      setAddingStudent(true);
      setAddStudentError("");

      const res = await api.post(`/classes/${selectedClassId}/students`, {
        studentCode: code,
        fullName: name,
        dateOfBirth: studentDob || null,
        email: email || null,
        password: pwd || "123456",
      });

      const newStudent = res.data.data;
      setStudents((prev) => [newStudent, ...prev]);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId ? { ...c, studentCount: c.studentCount + 1 } : c
        )
      );

      setStudentCode("");
      setStudentFullName("");
      setStudentDob("");
      setStudentEmail("");
      setStudentPassword("123456");
      setShowAddStudentModal(false);
      setSuccessMsg(`Đã thêm học sinh "${newStudent.fullName}" vào lớp thành công.`);
    } catch (err) {
      setAddStudentError(
        err.response?.data?.error?.message || "Lỗi thêm học sinh. Vui lòng kiểm tra lại."
      );
    } finally {
      setAddingStudent(false);
    }
  };

  // Handler: Remove Student from Class
  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${student.fullName}" khỏi lớp ${selectedClass?.name}?`)) {
      return;
    }

    try {
      await api.delete(`/classes/${selectedClassId}/students/${student.studentId}`);
      setStudents((prev) => prev.filter((s) => s.studentId !== student.studentId));
      setSelectedStudentIds((prev) => prev.filter((id) => id !== student.studentId));
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c
        )
      );
      setSuccessMsg(`Đã xóa học sinh "${student.fullName}" khỏi lớp.`);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error?.message || "Không thể xóa học sinh khỏi lớp."
      );
    }
  };

  // Handler: Select File for Smart Excel Import
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setPreviewData(null);
    setImportResult(null);
    setImportError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setAnalyzingFile(true);
      const res = await api.post(`/classes/${selectedClassId}/students/import-preview`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const pData = res.data?.data;
      setPreviewData(pData);

      // Initialize mapping form state based on heuristic detection
      const dMap = pData?.detectedMapping || {};
      setMappingStudentCodeCol(dMap.studentCodeCol ? String(dMap.studentCodeCol) : "");

      if (dMap.lastNameCol && dMap.firstNameCol) {
        setNameMode("SPLIT");
        setMappingLastNameCol(String(dMap.lastNameCol));
        setMappingFirstNameCol(String(dMap.firstNameCol));
        setMappingFullNameCol("");
      } else {
        setNameMode("SINGLE");
        setMappingFullNameCol(dMap.fullNameCol ? String(dMap.fullNameCol) : "");
        setMappingLastNameCol("");
        setMappingFirstNameCol("");
      }

      setMappingDobCol(dMap.dobCol ? String(dMap.dobCol) : "");
    } catch (err) {
      setImportError(
        err.response?.data?.error?.message || "Không thể phân tích file Excel. Vui lòng kiểm tra định dạng."
      );
    } finally {
      setAnalyzingFile(false);
    }
  };

  // Handler: Execute Import
  const handleExecuteImport = async () => {
    if (!importFile || !previewData) return;

    if (!mappingStudentCodeCol) {
      setImportError("Vui lòng chọn cột Số báo danh / Mã học sinh.");
      return;
    }

    if (nameMode === "SINGLE" && !mappingFullNameCol) {
      setImportError("Vui lòng chọn cột Họ và tên.");
      return;
    }

    if (nameMode === "SPLIT" && (!mappingLastNameCol || !mappingFirstNameCol)) {
      setImportError("Vui lòng chọn đầy đủ cột Họ đệm và cột Tên.");
      return;
    }

    const mapping = {
      headerRowIndex: previewData.headerRowIndex,
      studentCodeCol: Number(mappingStudentCodeCol),
      fullNameCol: nameMode === "SINGLE" ? Number(mappingFullNameCol) : null,
      lastNameCol: nameMode === "SPLIT" ? Number(mappingLastNameCol) : null,
      firstNameCol: nameMode === "SPLIT" ? Number(mappingFirstNameCol) : null,
      dobCol: mappingDobCol ? Number(mappingDobCol) : null,
    };

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("mapping", JSON.stringify(mapping));

    try {
      setImportingStudents(true);
      setImportError("");

      const res = await api.post(`/classes/${selectedClassId}/students/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const result = res.data?.data;
      setImportResult(result);
      setSuccessMsg(res.data?.message || "Nhập danh sách học sinh thành công!");

      // Reload students for this class
      await loadClassStudents(selectedClassId);
      // Update class studentCount
      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClassId
            ? { ...c, studentCount: c.studentCount + (result.importedCount || 0) }
            : c
        )
      );
    } catch (err) {
      setImportError(
        err.response?.data?.error?.message || "Lỗi khi import học sinh vào lớp học."
      );
    } finally {
      setImportingStudents(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumbs & Header */}
        <div className="space-y-2">
          <Breadcrumbs
            items={[
              { label: "Trang chủ", href: "/exams" },
              { label: "Lớp học" },
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                <Users className="w-7 h-7 text-blue-600" />
                Quản lý Lớp học & Học sinh
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Tạo lớp học, phân loại theo khối và quản lý danh sách học sinh dễ dàng qua form hoặc file Excel.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => {
                setCreateClassError("");
                setShowCreateClassModal(true);
              }}
            >
              Tạo lớp mới
            </Button>
          </div>
        </div>

        {/* Global Feedback */}
        {errorMsg && (
          <Alert variant="danger" onClose={() => setErrorMsg("")}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert variant="success" onClose={() => setSuccessMsg("")}>
            {successMsg}
          </Alert>
        )}

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Classes List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
              {/* Header: Title & Actions */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  {classes.length > 0 && (
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={toggleSelectVisibleClasses}
                      title="Chọn tất cả các lớp đang hiển thị"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  )}
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Danh sách lớp ({classes.length})
                  </h2>
                </div>
                {selectedClassIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteClassesModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md border border-rose-200 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa ({selectedClassIds.length})</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Năm học 2026-2027</span>
                )}
              </div>

              {/* Grade Filter Bar: Pills & Search */}
              {classes.length > 0 && (
                <div className="pt-3 space-y-2.5">
                  {/* Grade Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setSelectedGradeFilter("ALL")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-all cursor-pointer ${
                        selectedGradeFilter === "ALL"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      }`}
                    >
                      Tất cả ({classes.length})
                    </button>
                    {gradeListWithCounts.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGradeFilter(g.id);
                          setExpandedGradeIds((prev) => ({ ...prev, [g.id]: true }));
                        }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-all cursor-pointer ${
                          selectedGradeFilter === g.id
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {g.name} ({g.classCount})
                      </button>
                    ))}
                  </div>

                  {/* Search and Expand/Collapse Controls */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        placeholder="Tìm theo tên lớp (12A01, 9C06...)"
                        className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 focus:bg-white transition-all"
                      />
                      {classSearch && (
                        <button
                          type="button"
                          onClick={() => setClassSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={
                        groupedClasses.every((g) => expandedGradeIds[g.gradeId])
                          ? handleCollapseAllGrades
                          : handleExpandAllGrades
                      }
                      title={
                        groupedClasses.every((g) => expandedGradeIds[g.gradeId])
                          ? "Thu gọn tất cả các khối"
                          : "Mở rộng tất cả các khối"
                      }
                      className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg border border-slate-200 shrink-0 transition-all cursor-pointer"
                    >
                      {groupedClasses.every((g) => expandedGradeIds[g.gradeId])
                        ? "Thu gọn"
                        : "Mở rộng"}
                    </button>
                  </div>
                </div>
              )}

              {/* Classes Accordion List */}
              {loadingClasses ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-xs">Đang tải danh sách lớp...</span>
                </div>
              ) : classes.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-slate-500">Chưa có lớp học nào.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => setShowCreateClassModal(true)}
                  >
                    Tạo lớp đầu tiên
                  </Button>
                </div>
              ) : groupedClasses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy lớp học nào phù hợp với bộ lọc.
                </div>
              ) : (
                <div className="mt-3 space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                  {groupedClasses.map((group) => {
                    const isExpanded = !!expandedGradeIds[group.gradeId];
                    const gradeClassIds = group.classes.map((c) => c.id);
                    const isGradeAllSelected =
                      gradeClassIds.length > 0 &&
                      gradeClassIds.every((id) => selectedClassIds.includes(id));
                    const isGradeSomeSelected =
                      !isGradeAllSelected &&
                      gradeClassIds.some((id) => selectedClassIds.includes(id));

                    return (
                      <div
                        key={group.gradeId}
                        className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs transition-all"
                      >
                        {/* Grade Accordion Header - Click to expand/collapse into classes */}
                        <div
                          onClick={() => toggleGradeExpand(group.gradeId)}
                          className={`flex items-center justify-between p-2.5 cursor-pointer select-none transition-colors ${
                            isExpanded
                              ? "bg-slate-50/90 border-b border-slate-100"
                              : "bg-slate-50/50 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isGradeAllSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = isGradeSomeSelected;
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelectGradeClasses(group.classes);
                              }}
                              title={`Chọn tất cả lớp trong ${group.gradeName}`}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <ChevronRight
                              className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                                isExpanded ? "rotate-90 text-blue-600" : ""
                              }`}
                            />
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {group.gradeName}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                              {group.classes.length} lớp
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-500 font-medium">
                              {group.totalStudents} học sinh
                            </span>
                          </div>
                        </div>

                        {/* Classes inside Grade ("nới ra lớp") */}
                        {isExpanded && (
                          <div className="p-1.5 space-y-1 bg-slate-50/20">
                            {group.classes.map((cls) => {
                              const isSelected = cls.id === selectedClassId;
                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => setSelectedClassId(cls.id)}
                                  className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-xs"
                                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={selectedClassIds.includes(cls.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelectClass(cls.id);
                                      }}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                                      title="Chọn lớp này"
                                    />
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isSelected
                                          ? "bg-blue-600 text-white shadow-xs"
                                          : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                                      }`}
                                    >
                                      {cls.name}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-bold text-slate-900 block truncate">
                                        Lớp {cls.name}
                                      </span>
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                        <span className="text-blue-600 font-semibold">
                                          {cls.studentCount} học sinh
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditClass(cls);
                                      }}
                                      title="Sửa tên lớp hoặc khối"
                                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setClassToDelete(cls);
                                      }}
                                      title="Xóa lớp học này"
                                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronRight
                                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                                        isSelected
                                          ? "text-blue-600 translate-x-0.5"
                                          : "text-slate-300"
                                      }`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Class Students Workspace (8 cols) */}
          <div className="lg:col-span-8">
            {!selectedClass ? (
              <EmptyState
                icon={Users}
                title="Chưa chọn lớp học"
                description="Chọn một lớp học ở danh sách bên trái hoặc tạo lớp mới để quản lý danh sách học sinh."
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                {/* Header of Workspace */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-slate-900">
                        Lớp {selectedClass.name}
                      </h2>
                      <Badge variant="primary" size="sm">
                        {selectedClass.gradeName}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {students.length} học sinh
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Danh sách học sinh chính thức của lớp. Khi tạo bài thi cho lớp {selectedClass.name}, học sinh sẽ tự động được thêm vào danh sách thí sinh.
                    </p>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    {students.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Sparkles}
                          onClick={() => setShowStandardizeModal(true)}
                          className="text-blue-700 bg-blue-50/70 hover:bg-blue-100 border-blue-200"
                          title="Chuẩn hóa SBD 6 số (Khối-Lớp-STT) cho toàn bộ học sinh trong lớp"
                        >
                          Chuẩn hóa SBD 6 số
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Trash2}
                          onClick={() => setShowClearStudentsModal(true)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                          title="Xóa toàn bộ học sinh trong lớp học này"
                        >
                          Xóa tất cả ({students.length})
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Pencil}
                      onClick={() => handleOpenEditClass(selectedClass)}
                    >
                      Sửa lớp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Upload}
                      onClick={() => {
                        setImportFile(null);
                        setPreviewData(null);
                        setImportResult(null);
                        setImportError("");
                        setShowImportModal(true);
                      }}
                    >
                      Import Excel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Plus}
                      onClick={handleOpenAddStudent}
                    >
                      Thêm học sinh
                    </Button>
                  </div>
                </div>

                {/* Bulk Student Actions Banner */}
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-xs font-semibold">
                        Đã chọn <strong>{selectedStudentIds.length}</strong> / {students.length} học sinh
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStudentIds([])}
                        className="text-xs text-rose-700 hover:bg-rose-100"
                      >
                        Bỏ chọn
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setShowBulkDeleteStudentsModal(true)}
                      >
                        Xóa {selectedStudentIds.length} học sinh đã chọn
                      </Button>
                    </div>
                  </div>
                )}

                {/* Filter, Search & Password Action Bar */}
                {students.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Tìm kiếm theo Tên, Số báo danh / Mã HS, Email..."
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleToggleAllPasswords}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-xs"
                      >
                        {showAllPasswords ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ẩn tất cả mật khẩu</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Hiện tất cả mật khẩu</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 rounded-lg text-[11px] font-medium text-slate-600">
                        <span>Sắp xếp:</span>
                        <span className="font-bold text-blue-700">
                          {studentSortField === "NAME"
                            ? `Tên (${studentSortOrder === "asc" ? "A → Z" : "Z → A"})`
                            : `SBD (${studentSortOrder === "asc" ? "Tăng dần" : "Giảm dần"})`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Students Table */}
                {loadingStudents ? (
                  <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs">Đang tải danh sách học sinh...</span>
                  </div>
                ) : students.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Chưa có học sinh nào trong lớp {selectedClass.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Bạn có thể thêm từng học sinh thủ công hoặc tải lên file Excel (hỗ trợ file từ vnEdu, SMAS, file điểm danh trường).
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={handleOpenAddStudent}
                      >
                        Thêm học sinh
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Upload}
                        onClick={() => setShowImportModal(true)}
                      >
                        Import từ Excel
                      </Button>
                    </div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Không tìm thấy học sinh nào khớp với từ khóa &ldquo;{studentSearch}&rdquo;.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredStudents.length > 0 &&
                                filteredStudents.every((s) => selectedStudentIds.includes(s.studentId))
                              }
                              onChange={toggleSelectAllStudents}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              title="Chọn tất cả học sinh đang hiển thị"
                            />
                          </th>
                          <th className="py-2.5 px-3 w-12 text-center">STT</th>
                          <th
                            className="py-2.5 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                            onClick={() => handleSort("CODE")}
                            title="Bấm để đổi chiều sắp xếp theo Số báo danh"
                          >
                            <div className="flex items-center gap-1">
                              <span>Mã HS / SBD</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th
                            className="py-2.5 px-3 cursor-pointer select-none hover:text-blue-600 transition-colors"
                            onClick={() => handleSort("NAME")}
                            title="Bấm để đổi chiều sắp xếp theo Tên chuẩn ABC tiếng Việt"
                          >
                            <div className="flex items-center gap-1">
                              <span>Họ và tên</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-2.5 px-3">Ngày sinh</th>
                          <th className="py-2.5 px-3">Tài khoản tra cứu</th>
                          <th className="py-2.5 px-3">Mật khẩu</th>
                          <th className="py-2.5 px-3 w-16 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((s, idx) => {
                          const isPwdVisible = showAllPasswords || visiblePasswords[s.studentId];
                          const pwdValue = s.initialPassword || "123456";
                          return (
                            <tr key={s.studentId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(s.studentId)}
                                  onChange={() => toggleSelectStudent(s.studentId)}
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-semibold font-mono text-blue-700">
                                {s.studentCode}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900">
                                {s.fullName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {s.dateOfBirth
                                  ? new Date(s.dateOfBirth).toLocaleDateString("vi-VN")
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] text-slate-700 select-all">
                                    {s.email || "—"}
                                  </span>
                                  {s.email && (
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(s.email, `email_${s.studentId}`)}
                                      title="Sao chép tài khoản"
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                      {copiedId === `email_${s.studentId}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs text-slate-800 font-semibold min-w-[70px] select-all">
                                    {isPwdVisible ? pwdValue : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(s.studentId)}
                                    title={isPwdVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    {isPwdVisible ? (
                                      <EyeOff className="w-3.5 h-3.5 text-blue-600" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(pwdValue, `pwd_${s.studentId}`)}
                                    title="Sao chép mật khẩu"
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    {copiedId === `pwd_${s.studentId}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditStudent(s)}
                                    title="Chỉnh sửa thông tin học sinh"
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStudent(s)}
                                    title="Xóa học sinh khỏi lớp này"
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===================================================== */}
      {/* MODAL 1: Create Class (Single or Batch) */}
      {/* ===================================================== */}
      <Modal
        isOpen={showCreateClassModal}
        onClose={() => !creatingClass && setShowCreateClassModal(false)}
        title="Tạo Lớp Học Mới"
        description="Thêm một hoặc nhiều lớp học cùng lúc vào hệ thống một cách nhanh chóng."
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
              <span>Tạo nhiều lớp cùng lúc (Nhanh)</span>
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
              <span>Tạo 1 lớp đơn lẻ</span>
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
                  {duplicateBatchNames.length > 0 && (
                    <button
                      type="button"
                      onClick={handleFilterOutDuplicates}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                    >
                      Lọc bỏ các lớp trùng
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  disabled={creatingClass}
                  value={batchClassNamesInput}
                  onChange={(e) => handleBatchInput(e.target.value)}
                  placeholder="Nhập hoặc dán danh sách tên lớp, ngăn cách bằng dấu phẩy hoặc xuống dòng..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
                />
              </div>

              {/* Live Tag Preview */}
              {parsedBatchNames.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Sẽ tạo <strong>{parsedBatchNames.length}</strong> lớp học
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Bấm &times; để bỏ lớp không muốn tạo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {parsedBatchNames.map((name) => {
                      const isDup = existingClassNamesSet.has(name.toLowerCase());
                      return (
                        <span
                          key={name}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${
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
                onChange={(e) => handleSingleNameInput(e.target.value)}
                placeholder="Ví dụ: 6A1, 9A2, 12A1..."
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
            <p className="text-[11px] text-slate-500 mt-1">
              Các lớp học sẽ được xếp vào khối này (hệ thống tự động phát hiện khối theo tên lớp).
            </p>
          </div>
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 1B: Edit Class */}
      {/* ===================================================== */}
      <Modal
        isOpen={Boolean(classToEdit)}
        onClose={() => !updatingClass && setClassToEdit(null)}
        title={`Chỉnh sửa lớp học: ${classToEdit?.name}`}
        description="Thay đổi tên lớp học hoặc khối học của lớp."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClassToEdit(null)}
              disabled={updatingClass}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdateClass}
              loading={updatingClass}
            >
              {updatingClass ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateClass} className="space-y-4 text-xs">
          {editClassError && (
            <Alert variant="danger" onClose={() => setEditClassError("")}>
              {editClassError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên lớp học <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              disabled={updatingClass}
              value={editClassName}
              onChange={(e) => setEditClassName(e.target.value)}
              placeholder="Ví dụ: 12A01"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Khối học <span className="text-rose-500">*</span>
            </label>
            <select
              required
              disabled={updatingClass}
              value={editClassGradeId}
              onChange={(e) => setEditClassGradeId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
            >
              {grades.map((gr) => (
                <option key={gr.id} value={gr.id}>
                  {gr.name} (Khối {gr.level})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 2: Add Student Manually */}
      {/* ===================================================== */}
      <Modal
        isOpen={showAddStudentModal}
        onClose={() => !addingStudent && setShowAddStudentModal(false)}
        title={`Thêm học sinh vào lớp ${selectedClass?.name}`}
        description="Nhập thông tin học sinh để lưu vào danh sách và cấp tài khoản tra cứu."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddStudentModal(false)}
              disabled={addingStudent}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddStudent}
              loading={addingStudent}
            >
              {addingStudent ? "Đang lưu..." : "Thêm vào lớp"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
          {addStudentError && (
            <Alert variant="danger" onClose={() => setAddStudentError("")}>
              {addStudentError}
            </Alert>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Số báo danh (SBD 6 số) / Mã học sinh <span className="text-rose-500">*</span>
              </label>
              {selectedClass && (
                <button
                  type="button"
                  onClick={() => setStudentCode(getSuggestedSbd(selectedClass.name, selectedClass.gradeLevel, students.length + 1))}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Gợi ý SBD chuẩn ({getSuggestedSbd(selectedClass.name, selectedClass.gradeLevel, students.length + 1)})
                </button>
              )}
            </div>
            <input
              type="text"
              required
              autoFocus
              disabled={addingStudent}
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Ví dụ: 090601 (Chuẩn 6 số: Khối + Lớp + STT)"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Định dạng 6 số chuẩn phiếu tô OMR: 2 số Khối + 2 số Lớp + 2 số STT (Ví dụ: <strong>090601</strong> cho Lớp 9C06, học sinh 01).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên học sinh <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={addingStudent}
              value={studentFullName}
              onChange={(e) => setStudentFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ngày sinh (Tùy chọn)
            </label>
            <input
              type="date"
              disabled={addingStudent}
              value={studentDob}
              onChange={(e) => setStudentDob(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập (Tùy chọn)
            </label>
            <input
              type="email"
              disabled={addingStudent}
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="Để trống hệ thống sẽ tự sinh: [Lớp]_[SBD]@digitalexam.edu.vn"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu khởi tạo
            </label>
            <input
              type="text"
              disabled={addingStudent}
              value={studentPassword}
              onChange={(e) => setStudentPassword(e.target.value)}
              placeholder="Mặc định: 123456"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Mật khẩu mặc định: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">123456</code> (giáo viên có thể xem và ẩn/hiện bằng icon mắt).
            </span>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 2B: Edit Student */}
      {/* ===================================================== */}
      <Modal
        isOpen={Boolean(studentToEdit)}
        onClose={() => !updatingStudent && setStudentToEdit(null)}
        title={`Chỉnh sửa học sinh: ${studentToEdit?.fullName}`}
        description="Cập nhật Mã học sinh, Họ tên, Ngày sinh hoặc Email tra cứu."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStudentToEdit(null)}
              disabled={updatingStudent}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdateStudent}
              loading={updatingStudent}
            >
              {updatingStudent ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateStudent} className="space-y-4 text-xs">
          {editStudentError && (
            <Alert variant="danger" onClose={() => setEditStudentError("")}>
              {editStudentError}
            </Alert>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã học sinh / Số báo danh <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              disabled={updatingStudent}
              value={editStudentCode}
              onChange={(e) => setEditStudentCode(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên học sinh <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={updatingStudent}
              value={editStudentFullName}
              onChange={(e) => setEditStudentFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngày sinh
              </label>
              <input
                type="date"
                disabled={updatingStudent}
                value={editStudentDob}
                onChange={(e) => setEditStudentDob(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email tra cứu (Tùy chọn)
              </label>
              <input
                type="email"
                disabled={updatingStudent}
                value={editStudentEmail}
                onChange={(e) => setEditStudentEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu đăng nhập
            </label>
            <div className="relative">
              <input
                type={showEditPassword ? "text" : "password"}
                disabled={updatingStudent}
                value={editStudentPassword}
                onChange={(e) => setEditStudentPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới nếu muốn thay đổi (Mặc định: 123456)"
                className="w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowEditPassword(!showEditPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title={showEditPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Mật khẩu dùng để học sinh đăng nhập vào cổng tra cứu điểm thi.
            </p>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 3: Smart Excel Import with Heuristic Preview */}
      {/* ===================================================== */}
      <Modal
        isOpen={showImportModal}
        onClose={() => !importingStudents && setShowImportModal(false)}
        title={`Import danh sách học sinh vào lớp ${selectedClass?.name}`}
        description="Tải lên file Excel (.xlsx, .xls). Hệ thống tự động nhận diện và ghép cột thông minh."
        size="lg"
        footer={
          previewData ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportFile(null);
                  setPreviewData(null);
                  setImportResult(null);
                }}
                disabled={importingStudents}
              >
                Chọn file khác
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteImport}
                loading={importingStudents}
              >
                {importingStudents
                  ? "Đang nhập dữ liệu..."
                  : `Xác nhận nhập ${previewData.totalRows} học sinh`}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(false)}
            >
              Đóng
            </Button>
          )
        }
      >
        <div className="space-y-5 text-xs">
          {importError && (
            <Alert variant="danger" onClose={() => setImportError("")}>
              {importError}
            </Alert>
          )}

          {importResult && (
            <Alert variant="success">
              <p className="font-semibold">{importResult.message || "Import hoàn tất!"}</p>
              <p className="mt-0.5">
                Thành công: <strong>{importResult.importedCount}</strong> học sinh &bull; Bỏ qua:{" "}
                <strong>{importResult.skippedCount}</strong> (đã có trong lớp).
              </p>
              {importResult.errors?.length > 0 && (
                <div className="mt-2 text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 max-h-24 overflow-y-auto font-mono text-[11px]">
                  {importResult.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}
            </Alert>
          )}

          {/* STEP 1: Upload File */}
          {!previewData && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all block text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    Kéo thả hoặc bấm để chọn file Excel
                  </span>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Hỗ trợ định dạng .xlsx và .xls (Tối đa 10MB)
                  </span>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={analyzingFile}
                />
              </label>

              {analyzingFile && (
                <div className="flex items-center justify-center gap-2 py-4 text-blue-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium text-xs">Đang quét và nhận diện cấu trúc file Excel...</span>
                </div>
              )}

              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-amber-800 text-[11px] leading-relaxed">
                <strong>Hỗ trợ file Excel không chuẩn:</strong> File tải về từ vnEdu, SMAS hoặc file trường có nhiều dòng tiêu đề ở trên, tách cột <em>Họ và tên đệm</em> + <em>Tên</em> hệ thống đều tự động nhận diện và gộp chuẩn xác!
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Column Mapping Form */}
          {previewData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 p-3 rounded-lg text-blue-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold">Đã nhận diện tiêu đề tại Dòng {previewData.headerRowIndex}</span>
                    <span className="text-[11px] text-blue-700 block mt-0.5">
                      Tổng số {previewData.totalRows} dòng dữ liệu học sinh được phát hiện.
                    </span>
                  </div>
                </div>
              </div>

              {/* Column Mapping Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Cấu hình ánh xạ cột
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Student Code / SBD */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Cột Số báo danh / Mã HS <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mappingStudentCodeCol}
                      onChange={(e) => setMappingStudentCodeCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn cột SBD / Mã HS --</option>
                      {previewData.headers.map((h) => (
                        <option key={h.colIndex} value={h.colIndex}>
                          Cột {h.colIndex}: {h.headerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DOB Column */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Cột Ngày sinh (Tùy chọn)
                    </label>
                    <select
                      value={mappingDobCol}
                      onChange={(e) => setMappingDobCol(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Không có ngày sinh --</option>
                      {previewData.headers.map((h) => (
                        <option key={h.colIndex} value={h.colIndex}>
                          Cột {h.colIndex}: {h.headerName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Name Mode Selection */}
                <div className="pt-2 border-t border-slate-200/80 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Định dạng cột Họ tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="nameMode"
                        checked={nameMode === "SINGLE"}
                        onChange={() => setNameMode("SINGLE")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">1 cột Họ và tên gộp chung</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="nameMode"
                        checked={nameMode === "SPLIT"}
                        onChange={() => setNameMode("SPLIT")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs">Tách 2 cột (Họ đệm + Tên)</span>
                    </label>
                  </div>

                  {nameMode === "SINGLE" ? (
                    <div>
                      <select
                        value={mappingFullNameCol}
                        onChange={(e) => setMappingFullNameCol(e.target.value)}
                        className="w-full sm:w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Chọn cột Họ và tên --</option>
                        {previewData.headers.map((h) => (
                          <option key={h.colIndex} value={h.colIndex}>
                            Cột {h.colIndex}: {h.headerName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <select
                          value={mappingLastNameCol}
                          onChange={(e) => setMappingLastNameCol(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Chọn cột Họ và đệm --</option>
                          {previewData.headers.map((h) => (
                            <option key={h.colIndex} value={h.colIndex}>
                              Cột {h.colIndex}: {h.headerName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={mappingFirstNameCol}
                          onChange={(e) => setMappingFirstNameCol(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Chọn cột Tên --</option>
                          {previewData.headers.map((h) => (
                            <option key={h.colIndex} value={h.colIndex}>
                              Cột {h.colIndex}: {h.headerName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                  Xem trước dữ liệu mẫu (5 dòng đầu)
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-48">
                  <table className="w-full text-left text-[11px] border-collapse bg-white">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5 w-10 text-center text-slate-400">Dòng</th>
                        {previewData.headers.map((h) => (
                          <th key={h.colIndex} className="py-2 px-2.5 font-semibold text-slate-700 whitespace-nowrap">
                            Cột {h.colIndex}: {h.headerName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {previewData.previewRows.map((row) => (
                        <tr key={row._rowNumber} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 text-center text-slate-400">
                            {row._rowNumber}
                          </td>
                          {previewData.headers.map((h) => (
                            <td key={h.colIndex} className="py-1.5 px-2.5 whitespace-nowrap text-slate-800">
                              {row[h.colIndex] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 4: Delete Single Class Confirmation */}
      {/* ===================================================== */}
      <Modal
        isOpen={Boolean(classToDelete)}
        onClose={() => !deletingClass && setClassToDelete(null)}
        title={`Xóa lớp học "${classToDelete?.name}"?`}
        description="Xác nhận xóa vĩnh viễn lớp học khỏi hệ thống."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClassToDelete(null)}
              disabled={deletingClass}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteClass}
              loading={deletingClass}
            >
              Xác nhận xóa lớp
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Bạn có chắc chắn muốn xóa lớp học <strong className="text-slate-900">{classToDelete?.name}</strong> khỏi năm học 2026-2027 không?
          </p>
          {(classToDelete?.studentCount > 0 || classToDelete?.examCount > 0) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cảnh báo dữ liệu lớp học:</span>
              </div>
              <div>&bull; Lớp hiện có <strong>{classToDelete?.studentCount}</strong> học sinh và <strong>{classToDelete?.examCount}</strong> kỳ thi liên quan.</div>
              <div>&bull; Việc xóa lớp sẽ giải phóng liên kết học sinh và xóa các dữ liệu kỳ thi thuộc lớp này.</div>
            </div>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 5: Bulk Delete Classes Confirmation */}
      {/* ===================================================== */}
      <Modal
        isOpen={showBulkDeleteClassesModal}
        onClose={() => !deletingBulkClasses && setShowBulkDeleteClassesModal(false)}
        title={`Xóa ${selectedClassIds.length} lớp học đã chọn?`}
        description="Hệ thống sẽ xóa toàn bộ các lớp học được chọn cùng dữ liệu liên kết."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDeleteClassesModal(false)}
              disabled={deletingBulkClasses}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleBulkDeleteClasses}
              loading={deletingBulkClasses}
            >
              Xác nhận xóa {selectedClassIds.length} lớp
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Bạn có chắc chắn muốn xóa <strong>{selectedClassIds.length}</strong> lớp học đã chọn không?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Hành động này không thể hoàn tác!</span>
            </div>
            <div>&bull; Toàn bộ liên kết học sinh trong các lớp này sẽ bị xóa.</div>
            <div>&bull; Các kỳ thi và bảng điểm phụ thuộc các lớp này sẽ được làm sạch.</div>
          </div>
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 6: Bulk Delete Students Confirmation */}
      {/* ===================================================== */}
      <Modal
        isOpen={showBulkDeleteStudentsModal}
        onClose={() => !deletingBulkStudents && setShowBulkDeleteStudentsModal(false)}
        title={`Xóa ${selectedStudentIds.length} học sinh khỏi lớp?`}
        description={`Xác nhận xóa các học sinh đã chọn khỏi danh sách lớp "${selectedClass?.name}".`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkDeleteStudentsModal(false)}
              disabled={deletingBulkStudents}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleBulkDeleteStudents}
              loading={deletingBulkStudents}
            >
              Xác nhận xóa {selectedStudentIds.length} học sinh
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Hệ thống sẽ gỡ bỏ <strong>{selectedStudentIds.length}</strong> học sinh đã chọn ra khỏi lớp <strong className="text-slate-900">{selectedClass?.name}</strong>.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Lưu ý:</span>
            </div>
            <div>&bull; Học sinh sẽ không còn trong danh sách của lớp này khi tạo bài thi mới.</div>
            <div>&bull; Tài khoản tra cứu của học sinh vẫn tồn tại trong hệ thống.</div>
          </div>
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 7: Clear All Students Confirmation */}
      {/* ===================================================== */}
      <Modal
        isOpen={showClearStudentsModal}
        onClose={() => !clearingStudents && setShowClearStudentsModal(false)}
        title={`Xóa toàn bộ học sinh lớp "${selectedClass?.name}"?`}
        description={`Thao tác này sẽ làm rỗng danh sách học sinh của lớp ${selectedClass?.name}.`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearStudentsModal(false)}
              disabled={clearingStudents}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleClearClassStudents}
              loading={clearingStudents}
            >
              Xác nhận xóa tất cả ({students.length})
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            Bạn có chắc chắn muốn xóa <strong>toàn bộ {students.length} học sinh</strong> trong lớp <strong className="text-slate-900">{selectedClass?.name}</strong> không?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Cảnh báo xóa toàn bộ:</span>
            </div>
            <div>&bull; Tất cả {students.length} học sinh sẽ bị gỡ bỏ khỏi lớp ngay lập tức.</div>
            <div>&bull; Sau khi xóa, bạn có thể nhập lại danh sách mới qua file Excel hoặc form thêm thủ công.</div>
          </div>
        </div>
      </Modal>

      {/* Modal 8: Chuẩn hóa SBD 6 số */}
      <Modal
        isOpen={showStandardizeModal}
        onClose={() => !standardizingSbd && setShowStandardizeModal(false)}
        title={`Chuẩn hóa SBD 6 số lớp "${selectedClass?.name}"`}
        description="Đánh lại số báo danh 6 chữ số thông minh và đồng bộ tài khoản tra cứu"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStandardizeModal(false)}
              disabled={standardizingSbd}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={handleConfirmStandardizeSbd}
              loading={standardizingSbd}
            >
              Tiến hành chuẩn hóa ({students.length} học sinh)
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-slate-600">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Quy tắc chuẩn hóa Số Báo Danh 6 chữ số (KKLLSS):</span>
            </div>
            <div className="space-y-1 text-slate-700 text-[11px] leading-relaxed">
              <div>&bull; <strong className="font-mono text-blue-700">KK</strong> (2 số đầu): Khối học (ví dụ: khối 9 là <strong>09</strong>, khối 12 là <strong>12</strong>).</div>
              <div>&bull; <strong className="font-mono text-blue-700">LL</strong> (2 số tiếp): Mã lớp (ví dụ: 9C06 là <strong>06</strong>, 12A01 là <strong>01</strong>).</div>
              <div>&bull; <strong className="font-mono text-blue-700">SS</strong> (2 số cuối): Thứ tự học sinh theo danh sách A-B-C (ví dụ: <strong>01</strong>, <strong>02</strong>, ...).</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="font-semibold text-slate-800">Ví dụ minh họa lớp {selectedClass?.name}:</div>
            <div className="flex items-center gap-2 font-mono text-sm bg-white p-2 rounded border border-slate-200 text-blue-800 font-bold justify-center">
              <span>Học sinh số 1: {getSuggestedSbd(selectedClass?.name || '', selectedClass?.gradeLevel || 9, 1)}</span>
              <span className="text-slate-400">&rarr;</span>
              <span>Học sinh số {students.length || 10}: {getSuggestedSbd(selectedClass?.name || '', selectedClass?.gradeLevel || 9, students.length || 10)}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Hệ thống sẽ tự động sắp xếp học sinh theo bảng chữ cái tiếng Việt, gán SBD mới 6 số, và cập nhật tài khoản tra cứu định dạng <code>[TênLớp]_[SBD]@digitalexam.edu.vn</code>.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
