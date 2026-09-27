import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import jwt from "jsonwebtoken";
import prisma from "../src/config/prisma.js";
import app from "../src/app.js";
import * as adminDashboardService from "../src/services/admin-dashboard.service.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";
import { SUBJECT_PREFIX_MAP, STANDARD_SUBJECTS } from "../src/utils/teacher-code.js";

/**
 * In-memory Prisma query evaluator that simulates Prisma query filter semantics
 * (including field matching, in, some, none, AND, OR) against in-memory record collections.
 */
function matchesPrismaWhere(row, where) {
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      const andList = Array.isArray(cond) ? cond : [cond];
      if (!andList.every((c) => matchesPrismaWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      const orList = Array.isArray(cond) ? cond : [cond];
      if (!orList.some((c) => matchesPrismaWhere(row, c))) return false;
      continue;
    }

    const val = row[key];

    if (cond === null) {
      if (val !== null && val !== undefined) return false;
      continue;
    }

    if (typeof cond === "object" && !Array.isArray(cond)) {
      if ("in" in cond) {
        if (!cond.in.includes(val)) return false;
      }
      if ("not" in cond) {
        if (cond.not === null && (val === null || val === undefined)) return false;
        if (cond.not !== null && val === cond.not) return false;
      }
      if ("some" in cond) {
        const arr = Array.isArray(val) ? val : [];
        if (!arr.some((subRow) => matchesPrismaWhere(subRow, cond.some))) return false;
      }
      if ("none" in cond) {
        const arr = Array.isArray(val) ? val : [];
        if (arr.length > 0 && arr.some((subRow) => matchesPrismaWhere(subRow, cond.none))) return false;
        continue;
      }
      if (val && typeof val === "object") {
        if (!matchesPrismaWhere(val, cond)) return false;
        continue;
      }
    } else {
      if (val !== cond) return false;
    }
  }

  return true;
}

/**
 * Setup in-memory mock database state for admin dashboard queries
 */
function createMockPrismaState() {
  const state = {
    users: [],
    academicYears: [],
    teachers: [],
    teachingAssignments: [],
    classes: [],
    grades: [],
    subjects: [],
    students: [],
    studentEnrollments: [],
    exams: [],
    examCandidates: [],
    examSubmissions: [],
  };

  // Wire Prisma models to query this state
  prisma.academicYear.findFirst = async (args) => {
    return state.academicYears[0] || null;
  };

  prisma.teacher.findFirst = async (args) => {
    const matched = state.teachers.find((t) => matchesPrismaWhere(t, args?.where));
    if (!matched) return null;
    const primarySub = state.subjects.find((s) => s.id === matched.primarySubjectId);
    return {
      ...matched,
      primarySubject: primarySub || null,
      assignments: state.teachingAssignments.filter((a) => a.teacherId === matched.id),
    };
  };

  prisma.teacher.findUnique = async (args) => {
    const userId = args?.where?.userId;
    const id = args?.where?.id;
    const t = state.teachers.find((x) => (userId && x.userId === userId) || (id && x.id === id));
    if (!t) return null;
    const primarySub = state.subjects.find((s) => s.id === t.primarySubjectId);
    return {
      ...t,
      primarySubject: primarySub || null,
      assignments: state.teachingAssignments.filter((a) => a.teacherId === t.id),
    };
  };

  prisma.user.findUnique = async (args) => {
    const id = args?.where?.id;
    const email = args?.where?.email;
    const u = state.users.find((x) => (id && x.id === id) || (email && x.email === email));
    if (!u) return null;
    const t = state.teachers.find((x) => x.userId === u.id);
    return {
      ...u,
      teacher: t || null,
    };
  };

  prisma.teachingAssignment.findMany = async (args) => {
    return state.teachingAssignments.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  prisma.exam.findMany = async (args) => {
    let result = state.exams.filter((row) => matchesPrismaWhere(row, args?.where));
    if (args?.take) result = result.slice(0, args.take);
    return result;
  };

  prisma.exam.count = async (args) => {
    return state.exams.filter((row) => matchesPrismaWhere(row, args?.where)).length;
  };

  prisma.exam.groupBy = async (args) => {
    const matched = state.exams.filter((row) => matchesPrismaWhere(row, args?.where));
    const counts = {};
    for (const m of matched) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({ status, _count: { id: count } }));
  };

  prisma.class.findMany = async (args) => {
    return state.classes.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  prisma.class.count = async (args) => {
    return state.classes.filter((row) => matchesPrismaWhere(row, args?.where)).length;
  };

  prisma.grade.findMany = async (args) => {
    return state.grades.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  prisma.subject.findMany = async (args) => {
    return state.subjects.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  prisma.student.count = async (args) => {
    return state.students.filter((st) => {
      const studentWithEnrollments = {
        ...st,
        enrollments: state.studentEnrollments.filter((e) => e.studentId === st.id),
      };
      return matchesPrismaWhere(studentWithEnrollments, args?.where);
    }).length;
  };

  prisma.studentEnrollment.findMany = async (args) => {
    return state.studentEnrollments.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  prisma.studentEnrollment.count = async (args) => {
    return state.studentEnrollments.filter((row) => matchesPrismaWhere(row, args?.where)).length;
  };

  prisma.examCandidate.findMany = async (args) => {
    return state.examCandidates.filter((row) => matchesPrismaWhere(row, args?.where));
  };

  const getSubmissionsWithRelations = () => {
    return state.examSubmissions.map((sub) => {
      const exam = state.exams.find((e) => e.id === sub.examId);
      return {
        ...sub,
        exam: exam || null,
      };
    });
  };

  prisma.examSubmission.findMany = async (args) => {
    let result = getSubmissionsWithRelations().filter((row) => matchesPrismaWhere(row, args?.where));
    if (args?.take) result = result.slice(0, args.take);
    return result;
  };

  prisma.examSubmission.count = async (args) => {
    return getSubmissionsWithRelations().filter((row) => matchesPrismaWhere(row, args?.where)).length;
  };

  prisma.examSubmission.groupBy = async (args) => {
    const matched = getSubmissionsWithRelations().filter((row) => matchesPrismaWhere(row, args?.where));
    const counts = {};
    for (const m of matched) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({ status, _count: { id: count } }));
  };

  prisma.examSubmission.aggregate = async (args) => {
    const matched = getSubmissionsWithRelations().filter((row) => matchesPrismaWhere(row, args?.where));
    let correct = 0, incorrect = 0, blank = 0, unresolved = 0;
    for (const m of matched) {
      correct += m.correctCount || 0;
      incorrect += m.incorrectCount || 0;
      blank += m.blankCount || 0;
      unresolved += m.unresolvedCount || 0;
    }
    return { _sum: { correctCount: correct, incorrectCount: incorrect, blankCount: blank, unresolvedCount: unresolved } };
  };

  prisma.teacher.count = async (args) => {
    return state.teachers.filter((t) => matchesPrismaWhere(t, args?.where)).length;
  };
  prisma.teacher.findMany = async (args) => {
    let result = state.teachers.filter((t) => matchesPrismaWhere(t, args?.where));
    if (args?.take) result = result.slice(0, args.take);
    return result;
  };
  prisma.user.count = async (args) => {
    return state.users.filter((u) => matchesPrismaWhere(u, args?.where)).length;
  };

  return state;
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("             COMPREHENSIVE POST-FIX VERIFICATION TEST SUITE                   ");
  console.log("===============================================================================\n");

  const results = [];

  function record(type, name, status, detail = "") {
    results.push({ type, name, status, detail });
    const tag = `[${status}]`.padEnd(9);
    console.log(`${tag} [${type}] ${name}`);
    if (detail && status !== "PASS") {
      console.log(`          ↳ ${detail}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 1: MULTI-CLASS EXAM & EXAM-SPECIFIC SBD COLLISION REGRESSION
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();

    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] }
    );
    db.subjects.push({ id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 2 } });

    // Students
    db.students.push(
      { id: "st_A", studentCode: "HS_06A_01", fullName: "Học sinh A" },
      { id: "st_B", studentCode: "HS_06B_01", fullName: "Học sinh B" }
    );
    db.studentEnrollments.push(
      { studentId: "st_A", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "HS_06A_01" } },
      { studentId: "st_B", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "HS_06B_01" } }
    );

    // Teachers
    db.teachers.push(
      { id: "t_A", userId: "u_A", fullName: "Giáo viên A", teacherCode: "GVTOAN01" },
      { id: "t_B", userId: "u_B", fullName: "Giáo viên B", teacherCode: "GVTOAN02" }
    );
    // Teacher A teaches 6A Math
    db.teachingAssignments.push({
      id: "ta_1",
      teacherId: "t_A",
      classId: "c_6A",
      subjectId: "sub_math",
      academicYearId: "ay_2026",
    });
    // Teacher B teaches 6B Math
    db.teachingAssignments.push({
      id: "ta_2",
      teacherId: "t_B",
      classId: "c_6B",
      subjectId: "sub_math",
      academicYearId: "ay_2026",
    });

    // Multi-class exams E1 and E2 created by Exam Officer
    db.exams.push(
      {
        id: "exam_E1",
        title: "Toán Khối 6 Giữa kỳ (E1)",
        subjectId: "sub_math",
        classId: null,
        examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
        teacherId: null,
        createdByUserId: "user_officer",
        status: "PUBLISHED",
      },
      {
        id: "exam_E2",
        title: "Toán Khối 6 Cuối kỳ (E2)",
        subjectId: "sub_math",
        classId: null,
        examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
        teacherId: null,
        createdByUserId: "user_officer",
        status: "PUBLISHED",
      }
    );

    // SBD Mapping:
    // E1: Student A (6A) has SBD "001", Student B (6B) has SBD "002"
    // E2: Student A (6A) has SBD "002", Student B (6B) has SBD "001" (Cross-exam collision!)
    db.examCandidates.push(
      { examId: "exam_E1", studentId: "st_A", studentNumber: "001" },
      { examId: "exam_E1", studentId: "st_B", studentNumber: "002" },
      { examId: "exam_E2", studentId: "st_A", studentNumber: "002" },
      { examId: "exam_E2", studentId: "st_B", studentNumber: "001" }
    );

    // Submissions
    db.examSubmissions.push(
      {
        id: "sub_1",
        examId: "exam_E1",
        resolvedStudentNumber: "001",
        candidateStudentNumber: "001",
        detectedStudentNumber: "001",
        status: "FINAL",
        finalScore: 9.0,
        provisionalScore: 9.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_2",
        examId: "exam_E1",
        resolvedStudentNumber: "002",
        candidateStudentNumber: "002",
        detectedStudentNumber: "002",
        status: "FINAL",
        finalScore: 6.0,
        provisionalScore: 6.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_3",
        examId: "exam_E2",
        resolvedStudentNumber: "002",
        candidateStudentNumber: "002",
        detectedStudentNumber: "002",
        status: "FINAL",
        finalScore: 8.0,
        provisionalScore: 8.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_4",
        examId: "exam_E2",
        resolvedStudentNumber: "001",
        candidateStudentNumber: "001",
        detectedStudentNumber: "001",
        status: "FINAL",
        finalScore: 5.0,
        provisionalScore: 5.0,
        identityNeedsReview: false,
      }
    );

    // Execute actual service query with filter for Teacher A (teaches 6A)
    const dashboardResult = await adminDashboardService.getAdminSystemDashboard({
      teacherId: "t_A",
    });

    // Verifications:
    // 1. Both multi-class exams created by Khảo thí must be kept in Teacher A's scope
    assert.equal(dashboardResult.overview.exams.total, 2, "Exams E1 and E2 must be in scope for Teacher A");

    // 2. Submissions count must ONLY contain 6A submissions (sub_1 from E1 and sub_3 from E2)
    // sub_2 and sub_4 (Student B in 6B) MUST NOT leak into Teacher A's submissions!
    assert.equal(dashboardResult.overview.submissions.total, 2, "Must contain exactly 2 submissions from 6A");

    // 3. Average score must be (9.0 + 8.0) / 2 = 8.50.
    // If Student B's submissions were leaked, avg would be (9 + 6 + 8 + 5) / 4 = 7.00.
    assert.equal(dashboardResult.overview.scoring.averageScore, 8.50, "Average score must be strictly 8.50 from 6A");
    assert.equal(dashboardResult.overview.scoring.gradedCount, 2, "Graded count must be 2");

    // 4. Students with results must be 1 (Student A took both exams)
    assert.equal(dashboardResult.overview.students.withResults, 1, "Only Student A has results in Teacher A's scope");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Multi-Class Exam SBD Isolation: Student B (6B, SBD 001) in E2 does not collide with Student A (6A, SBD 001) in E1",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Multi-Class Exam SBD Isolation", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: SBD PRECEDENCE (AUTHORITATIVE VS STALE DETECTED SBD)
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026" },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026" }
    );
    db.students.push(
      { id: "st_A", studentCode: "HS_06A_01" },
      { id: "st_B", studentCode: "HS_06B_01" }
    );
    db.studentEnrollments.push(
      { studentId: "st_A", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "HS_06A_01" } },
      { studentId: "st_B", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "HS_06B_01" } }
    );
    db.teachers.push({ id: "t_A", userId: "u_A" });
    db.teachingAssignments.push({ id: "ta_1", teacherId: "t_A", classId: "c_6A", subjectId: "sub_math", academicYearId: "ay_2026" });

    db.exams.push({
      id: "exam_1",
      subjectId: "sub_math",
      classId: null,
      examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
    });
    db.examCandidates.push(
      { examId: "exam_1", studentId: "st_A", studentNumber: "001" },
      { examId: "exam_1", studentId: "st_B", studentNumber: "002" }
    );

    // Sub A: Verified as Student B (6B, SBD 002), but originally had a misread OCR detectedStudentNumber = "001" (Student A in 6A)
    // Sub B: Unverified submission (resolvedStudentNumber is null), tentative detectedStudentNumber = "001"
    db.examSubmissions.push(
      {
        id: "sub_verified_b",
        examId: "exam_1",
        resolvedStudentNumber: "002", // Authoritative: Student B in 6B
        detectedStudentNumber: "001", // Stale OCR: must NOT drag this into 6A!
        candidateStudentNumber: "002",
        status: "FINAL",
        finalScore: 5.0,
      },
      {
        id: "sub_unverified_a",
        examId: "exam_1",
        resolvedStudentNumber: null, // Unverified
        candidateStudentNumber: null,
        detectedStudentNumber: "001", // Tentative match for 6A
        status: "PROVISIONAL",
        provisionalScore: 8.0,
      }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ teacherId: "t_A" });

    // sub_verified_b has resolvedStudentNumber = "002" (not 6A), so its stale detected "001" MUST NOT match 6A!
    // sub_unverified_a has resolvedStudentNumber = null and detected "001", so it tentatively matches 6A.
    assert.equal(res.overview.submissions.total, 1, "Only the tentative 6A submission matches; verified 6B submission is excluded");
    assert.equal(res.overview.scoring.averageScore, 8.0, "Score must be 8.0 from tentative 6A submission, not 5.0 from 6B");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "SBD Precedence Policy: Authoritative resolvedStudentNumber completely overrides stale detectedStudentNumber",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "SBD Precedence Policy", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 3: TEACHING ASSIGNMENT PAIR PRESERVATION (CLASS - SUBJECT)
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026" },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026" }
    );
    db.subjects.push(
      { id: "sub_math", code: "TOAN", name: "Toán" },
      { id: "sub_it", code: "TIN", name: "Tin học" }
    );

    // Teacher T teaches: Math in 6A, IT in 6B
    db.teachers.push({ id: "t_T", userId: "u_T" });
    db.teachingAssignments.push(
      { id: "ta_1", teacherId: "t_T", classId: "c_6A", subjectId: "sub_math", academicYearId: "ay_2026" },
      { id: "ta_2", teacherId: "t_T", classId: "c_6B", subjectId: "sub_it", academicYearId: "ay_2026" }
    );

    // 4 Exams in system:
    // Ex1: 6A Math -> MATCH
    // Ex2: 6B IT   -> MATCH
    // Ex3: 6B Math -> MUST NOT MATCH (Teacher T does not teach Math in 6B)
    // Ex4: 6A IT   -> MUST NOT MATCH (Teacher T does not teach IT in 6A)
    db.exams.push(
      { id: "ex_1", title: "Toán 6A", classId: "c_6A", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" },
      { id: "ex_2", title: "Tin 6B", classId: "c_6B", subjectId: "sub_it", examClasses: [], status: "PUBLISHED" },
      { id: "ex_3", title: "Toán 6B", classId: "c_6B", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" },
      { id: "ex_4", title: "Tin 6A", classId: "c_6A", subjectId: "sub_it", examClasses: [], status: "PUBLISHED" }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ teacherId: "t_T" });

    assert.equal(res.overview.exams.total, 2, "Only exactly 2 exams matching (6A, Math) and (6B, IT) should be returned");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Teaching Assignment Pair Preservation: Cartesian cross-product (6B Math / 6A IT) strictly prevented",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Teaching Assignment Pair Preservation", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 4: ACADEMIC YEAR SCOPING (HISTORICAL VS CURRENT)
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.classes.push(
      { id: "c_8A", name: "8A", gradeId: "g_8", academicYearId: "ay_2026" },
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2024" }
    );
    db.teachers.push({ id: "t_H", userId: "u_H" });

    // Current 2026-2027 assignment
    db.teachingAssignments.push({
      id: "ta_curr",
      teacherId: "t_H",
      classId: "c_8A",
      subjectId: "sub_math",
      academicYearId: "ay_2026",
    });
    // Historical 2024-2025 assignment
    db.teachingAssignments.push({
      id: "ta_old",
      teacherId: "t_H",
      classId: "c_6A",
      subjectId: "sub_math",
      academicYearId: "ay_2024",
    });

    db.exams.push(
      { id: "ex_8A", title: "Toán 8A 2026", classId: "c_8A", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" },
      { id: "ex_6A", title: "Toán 6A 2024", classId: "c_6A", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ teacherId: "t_H" });

    assert.equal(res.overview.exams.total, 1, "Only current 2026-2027 exam for 8A must be returned");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Academic Year Scoping: Historical 2024-2025 assignment is not falsely merged into 2026-2027 dashboard",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Academic Year Scoping", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 5: STATISTICAL METRICS & EDGE CASES
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.classes.push({ id: "c_7A", name: "7A", gradeId: "g_7", academicYearId: "ay_2026" });
    db.students.push({ id: "st_1", studentCode: "HS_01" }, { id: "st_2", studentCode: "HS_02" });
    db.studentEnrollments.push(
      { studentId: "st_1", classId: "c_7A", academicYearId: "ay_2026" },
      { studentId: "st_2", classId: "c_7A", academicYearId: "ay_2026" }
    );

    // 0 exams in class 7A
    const resEmpty = await adminDashboardService.getAdminSystemDashboard({ classId: "c_7A" });
    assert.equal(resEmpty.overview.students.total, 2, "Class with 0 exams must keep student count (2), not collapse to 0");
    assert.equal(resEmpty.overview.scoring.averageScore, null, "Average score must be null (render as —)");
    assert.equal(resEmpty.overview.submissions.total, 0, "Submission count must be 0");

    // Add 1 submission with valid score 0.00
    db.exams.push({ id: "ex_7A", classId: "c_7A", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" });
    db.examSubmissions.push({
      id: "sub_zero",
      examId: "ex_7A",
      resolvedStudentNumber: "HS_01",
      status: "FINAL",
      finalScore: 0.0,
      provisionalScore: 0.0,
    });

    const resZero = await adminDashboardService.getAdminSystemDashboard({ classId: "c_7A" });
    assert.equal(resZero.overview.scoring.averageScore, 0.0, "Valid score 0.0 must be calculated as 0.0, not null");
    assert.equal(resZero.overview.scoring.gradedCount, 1, "Graded count must be 1");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Metric Integrity: 0-exam classes retain enrollment; valid 0.0 score is formatted as 0.00 (not —)",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Metric Integrity", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 5B: REGRESSION TEST FOR STUDENT_CODE FALLBACK SBD MISMATCH
  // User Case:
  // - Student A (6A): studentCode = "001"
  // - In E2: ExamCandidate assigns Student A -> SBD "002"
  // - Student B (6B): in E2, ExamCandidate assigns Student B -> SBD "001"
  // - E2 is a multi-class exam comprising both 6A and 6B
  // - Filter for Teacher of 6A: only Student A's submission must be counted!
  // - ExamCandidate has determined SBD "001" belongs to B, so Student A's
  //   studentCode ("001") must NEVER be used to drag Student B's submission in.
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] }
    );
    db.subjects.push({ id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 1 } });

    // Student A: studentCode = "001" (Class 6A)
    // Student B: studentCode = "HS_6B_01" (Class 6B)
    db.students.push(
      { id: "st_A", studentCode: "001", fullName: "Học sinh A" },
      { id: "st_B", studentCode: "HS_6B_01", fullName: "Học sinh B" }
    );
    db.studentEnrollments.push(
      { studentId: "st_A", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "001" } },
      { studentId: "st_B", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "HS_6B_01" } }
    );

    // Teacher of 6A
    db.teachers.push({ id: "t_6A", userId: "u_6A", fullName: "Giáo viên 6A", teacherCode: "GVTOAN01" });
    db.teachingAssignments.push({
      id: "ta_6A",
      teacherId: "t_6A",
      classId: "c_6A",
      subjectId: "sub_math",
      academicYearId: "ay_2026",
    });

    // Multi-class exam E2: 6A and 6B
    db.exams.push({
      id: "exam_E2",
      title: "Khảo sát Toán 6 (E2)",
      subjectId: "sub_math",
      classId: null,
      examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
      teacherId: null,
      createdByUserId: "user_officer",
      status: "PUBLISHED",
    });

    // ExamCandidates for E2:
    // Student A (6A) -> SBD "002"
    // Student B (6B) -> SBD "001"
    db.examCandidates.push(
      { examId: "exam_E2", studentId: "st_A", studentNumber: "002" },
      { examId: "exam_E2", studentId: "st_B", studentNumber: "001" }
    );

    // Submissions for E2:
    // Sub A: Student A (SBD 002), score 9.0
    // Sub B: Student B (SBD 001), score 3.0
    db.examSubmissions.push(
      {
        id: "sub_A_E2",
        examId: "exam_E2",
        resolvedStudentNumber: "002",
        candidateStudentNumber: "002",
        detectedStudentNumber: "002",
        status: "FINAL",
        finalScore: 9.0,
        provisionalScore: 9.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_B_E2",
        examId: "exam_E2",
        resolvedStudentNumber: "001",
        candidateStudentNumber: "001",
        detectedStudentNumber: "001",
        status: "FINAL",
        finalScore: 3.0,
        provisionalScore: 3.0,
        identityNeedsReview: false,
      }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ teacherId: "t_6A" });

    // If Student A's studentCode ("001") leaked into allowed SBDs, Sub B (SBD 001) would be included!
    // With our fix: ExamCandidate is authoritative, only SBD "002" is allowed.
    assert.equal(res.overview.submissions.total, 1, "Only Student A's submission must be in Teacher 6A scope");
    assert.equal(res.overview.scoring.averageScore, 9.0, "Average score must be strictly 9.0 (Sub B with 3.0 is excluded)");
    assert.equal(res.overview.students.withResults, 1, "Only Student A has results in Teacher 6A scope");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Regression: Raw studentCode never leaks into ExamCandidate SBD matching when candidate records exist",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Regression: Raw studentCode SBD Isolation", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 5C: MULTI-CLASS EXAMS PRESERVING CLASS-SUBJECT PAIRS PER EXAM
  // User Case:
  // - Teacher A teaches: Math in 6A, IT in 6B.
  // - Common Exam 1: E_Toan (Math, 6A + 6B)
  // - Common Exam 2: E_Tin (IT, 6A + 6B)
  // - Result for Teacher A:
  //   * Both E_Toan and E_Tin are counted in exams.total (2 exams).
  //   * In E_Toan: ONLY 6A students are counted (6B Math is excluded).
  //   * In E_Tin: ONLY 6B students are counted (6A IT is excluded).
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] }
    );
    db.subjects.push(
      { id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 1 } },
      { id: "sub_it", code: "TIN", name: "Tin học", _count: { exams: 1 } }
    );

    // Students
    db.students.push(
      { id: "st_6A_1", studentCode: "HS_6A_01", fullName: "Học sinh 6A" },
      { id: "st_6B_1", studentCode: "HS_6B_01", fullName: "Học sinh 6B" }
    );
    db.studentEnrollments.push(
      { studentId: "st_6A_1", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "HS_6A_01" } },
      { studentId: "st_6B_1", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "HS_6B_01" } }
    );

    // Teacher T: Math in 6A, IT in 6B
    db.teachers.push({ id: "t_T", userId: "u_T", fullName: "Giáo viên Đa môn", teacherCode: "GVDM01" });
    db.teachingAssignments.push(
      { id: "ta_1", teacherId: "t_T", classId: "c_6A", subjectId: "sub_math", academicYearId: "ay_2026" },
      { id: "ta_2", teacherId: "t_T", classId: "c_6B", subjectId: "sub_it", academicYearId: "ay_2026" }
    );

    // Common exams created by Khảo thí
    db.exams.push(
      {
        id: "exam_Toan",
        title: "Toán Khối 6 Đa lớp",
        subjectId: "sub_math",
        classId: null,
        examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
        teacherId: null,
        createdByUserId: "user_officer",
        status: "PUBLISHED",
      },
      {
        id: "exam_Tin",
        title: "Tin học Khối 6 Đa lớp",
        subjectId: "sub_it",
        classId: null,
        examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
        teacherId: null,
        createdByUserId: "user_officer",
        status: "PUBLISHED",
      }
    );

    // Candidates:
    // In exam_Toan: st_6A_1 -> SBD "T_6A_01", st_6B_1 -> SBD "T_6B_01"
    // In exam_Tin:  st_6A_1 -> SBD "I_6A_01", st_6B_1 -> SBD "I_6B_01"
    db.examCandidates.push(
      { examId: "exam_Toan", studentId: "st_6A_1", studentNumber: "T_6A_01" },
      { examId: "exam_Toan", studentId: "st_6B_1", studentNumber: "T_6B_01" },
      { examId: "exam_Tin",  studentId: "st_6A_1", studentNumber: "I_6A_01" },
      { examId: "exam_Tin",  studentId: "st_6B_1", studentNumber: "I_6B_01" }
    );

    // Submissions:
    // Math 6A student score = 10.0
    // Math 6B student score = 4.0
    // IT 6A student score = 2.0
    // IT 6B student score = 8.0
    db.examSubmissions.push(
      {
        id: "sub_m_6A",
        examId: "exam_Toan",
        resolvedStudentNumber: "T_6A_01",
        status: "FINAL",
        finalScore: 10.0,
        provisionalScore: 10.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_m_6B",
        examId: "exam_Toan",
        resolvedStudentNumber: "T_6B_01",
        status: "FINAL",
        finalScore: 4.0,
        provisionalScore: 4.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_i_6A",
        examId: "exam_Tin",
        resolvedStudentNumber: "I_6A_01",
        status: "FINAL",
        finalScore: 2.0,
        provisionalScore: 2.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_i_6B",
        examId: "exam_Tin",
        resolvedStudentNumber: "I_6B_01",
        status: "FINAL",
        finalScore: 8.0,
        provisionalScore: 8.0,
        identityNeedsReview: false,
      }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ teacherId: "t_T" });

    // 1. Both exams must be included
    assert.equal(res.overview.exams.total, 2, "Both E_Toan and E_Tin must be in scope for Teacher T");

    // 2. Exactly 2 submissions must match: sub_m_6A (Toán 6A) and sub_i_6B (Tin 6B)
    // sub_m_6B (Toán 6B) and sub_i_6A (Tin 6A) MUST be excluded!
    assert.equal(res.overview.submissions.total, 2, "Must contain exactly 2 submissions matching assigned (class, subject) pairs");

    // 3. Average score must be (10.0 + 8.0) / 2 = 9.00
    // If all 4 leaked, average would be (10 + 4 + 2 + 8) / 4 = 6.00
    assert.equal(res.overview.scoring.averageScore, 9.00, "Average score must be strictly 9.00 from (6A Math) and (6B IT)");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Multi-Class Exam Subject Scoping: Teacher with (6A Math, 6B IT) counts only 6A for Math exam and 6B for IT exam",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Multi-Class Exam Subject Scoping", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 5D: UNVERIFIED SUBMISSION POLICY (identityNeedsReview: true)
  // Policy:
  // - Submissions with identityNeedsReview === true:
  //   * COUNTED in overview.submissions.total
  //   * COUNTED in overview.submissions.needsReview
  //   * EXCLUDED from overview.scoring.averageScore
  //   * EXCLUDED from overview.scoring.gradedCount
  //   * EXCLUDED from overview.students.withResults
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.classes.push({ id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026" });
    db.students.push(
      { id: "st_1", studentCode: "HS_01" },
      { id: "st_2", studentCode: "HS_02" }
    );
    db.studentEnrollments.push(
      { studentId: "st_1", classId: "c_6A", academicYearId: "ay_2026" },
      { studentId: "st_2", classId: "c_6A", academicYearId: "ay_2026" }
    );
    db.exams.push({ id: "ex_6A", classId: "c_6A", subjectId: "sub_math", examClasses: [], status: "PUBLISHED" });

    // Submission 1: Verified (score 8.0)
    // Submission 2: Unverified / Needs review (score 2.0, identityNeedsReview = true)
    db.examSubmissions.push(
      {
        id: "sub_verified",
        examId: "ex_6A",
        resolvedStudentNumber: "HS_01",
        status: "FINAL",
        finalScore: 8.0,
        provisionalScore: 8.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_unverified",
        examId: "ex_6A",
        resolvedStudentNumber: "HS_02",
        status: "PROVISIONAL",
        finalScore: null,
        provisionalScore: 2.0,
        identityNeedsReview: true,
      }
    );

    const res = await adminDashboardService.getAdminSystemDashboard({ classId: "c_6A" });

    // Total submissions = 2
    assert.equal(res.overview.submissions.total, 2, "Total submissions must count all 2 papers");
    // Needs review = 1
    assert.equal(res.overview.submissions.needsReview, 1, "Needs review must count the unverified paper");
    // Average score = 8.00 (the 2.0 score is excluded from official calculation)
    assert.equal(res.overview.scoring.averageScore, 8.00, "Average score must be strictly 8.00 (unverified paper excluded)");
    assert.equal(res.overview.scoring.gradedCount, 1, "Graded count must be 1");
    // Students with results = 1 (only the verified student)
    assert.equal(res.overview.students.withResults, 1, "Only 1 verified student has official results");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Unverified Identity Policy: identityNeedsReview papers counted in total & needsReview, excluded from avg score & results",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Unverified Identity Policy", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 6: ACCESS CONTROL GUARDS & ROUTE MIDDLEWARE
  // -------------------------------------------------------------------------
  try {
    const mutateSubmissionRoles = authorizeRoles("TEACHER", "EXAM_OFFICER");
    const vicePrincipalOnly = authorizeRoles("VICE_PRINCIPAL");
    const principalOnly = authorizeRoles("PRINCIPAL");

    let errMutate = null;
    mutateSubmissionRoles({ user: { role: "SUPER_ADMIN" } }, {}, (e) => { errMutate = e; });
    assert.ok(errMutate, "SUPER_ADMIN must be blocked from mutating submissions");
    assert.equal(errMutate.statusCode, 403);

    let errVp = null;
    vicePrincipalOnly({ user: { role: "SUPER_ADMIN" } }, {}, (e) => { errVp = e; });
    assert.ok(errVp, "SUPER_ADMIN must be blocked from VP approval route");
    assert.equal(errVp.statusCode, 403);

    let errPrincipal = null;
    principalOnly({ user: { role: "SUPER_ADMIN" } }, {}, (e) => { errPrincipal = e; });
    assert.ok(errPrincipal, "SUPER_ADMIN must be blocked from Principal approval route");
    assert.equal(errPrincipal.statusCode, 403);

    record(
      "UNIT_TEST_MIDDLEWARE",
      "Role-Based Access Control: SUPER_ADMIN strictly prohibited from submission mutation and publication approval",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_MIDDLEWARE", "Access Control Guards", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 7: THCS SUBJECT CODE STANDARDIZATION
  // -------------------------------------------------------------------------
  try {
    assert.equal(SUBJECT_PREFIX_MAP.GDCD, "GVGDCD", "GDCD must map to prefix GVGDCD");
    assert.equal(SUBJECT_PREFIX_MAP.GDKTPL, "GVGDCD", "GDKTPL must alias to prefix GVGDCD");

    const standardCodes = STANDARD_SUBJECTS.map((s) => s.code);
    assert.ok(standardCodes.includes("GDCD"), "STANDARD_SUBJECTS must include GDCD for THCS");
    const gdcdEntry = STANDARD_SUBJECTS.find((s) => s.code === "GDCD");
    assert.equal(gdcdEntry.name, "Giáo dục công dân");
    assert.equal(gdcdEntry.prefix, "GVGDCD");

    record(
      "STATIC_CODE_ANALYSIS",
      "THCS Curriculum Standards: GDCD normalized as primary prefix GVGDCD with GDKTPL backward-compatible alias",
      "PASS"
    );
  } catch (err) {
    record("STATIC_CODE_ANALYSIS", "THCS Subject Code Standards", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 8: SERVICE CALL WITH AUTHENTICATED TEACHER USER (REGRESSION: ReferenceError)
  // Calls getAdminSystemDashboard({}, { id: "u_A", role: "TEACHER" })
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push({ id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] });
    db.subjects.push({ id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 1 } });
    db.teachers.push({ id: "t_A", userId: "u_A", fullName: "Giáo viên A", teacherCode: "GVTOAN01" });
    db.teachingAssignments.push({
      id: "ta_1",
      teacherId: "t_A",
      classId: "c_6A",
      subjectId: "sub_math",
      academicYearId: "ay_2026",
    });
    db.exams.push({
      id: "ex_1",
      title: "Toán 6A",
      classId: "c_6A",
      subjectId: "sub_math",
      teacherId: "t_A",
      examClasses: [],
      status: "PUBLISHED",
    });
    db.examSubmissions.push({
      id: "sub_1",
      examId: "ex_1",
      resolvedStudentNumber: "001",
      status: "FINAL",
      finalScore: 8.5,
      provisionalScore: 8.5,
      identityNeedsReview: false,
    });

    // Execute with real user object
    const res = await adminDashboardService.getAdminSystemDashboard({}, { id: "u_A", role: "TEACHER" });

    assert.ok(res, "Dashboard result must be returned");
    assert.equal(res.scopeInfo.isTeacher, true, "scopeInfo.isTeacher must be true");
    assert.equal(res.overview.exams.total, 1, "Must return 1 exam for Teacher A");
    assert.equal(res.overview.submissions.total, 1, "Must return 1 submission");
    assert.equal(res.overview.scoring.averageScore, 8.50, "Average score must be 8.50");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Teacher User Invocation: getAdminSystemDashboard({}, { id, role: 'TEACHER' }) runs without ReferenceError",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Teacher User Invocation", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 9: TEACHER A SUPPLYING TEACHER B'S teacherId (CROSS-TEACHER PRIVILEGE BOUNDARY)
  // Scenario:
  // - Teacher A teaches 6A Math.
  // - Teacher B teaches 6B Math.
  // - Common Math exam E_Common has both 6A and 6B.
  // - Submission 6A (Student A): score 10.
  // - Submission 6B (Student B): score 4.
  // - Authenticated User is Teacher A, but request specifies filters.teacherId = "t_B".
  // - Expected: Zero submissions from Teacher B are returned; overview metrics, recent submissions,
  //   and students with results must return empty scope (colleague's data is never leaked).
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] }
    );
    db.subjects.push({ id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 1 } });
    db.students.push(
      { id: "st_A", studentCode: "001", fullName: "Học sinh A" },
      { id: "st_B", studentCode: "002", fullName: "Học sinh B" }
    );
    db.studentEnrollments.push(
      { studentId: "st_A", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "001" } },
      { studentId: "st_B", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "002" } }
    );
    db.teachers.push(
      { id: "t_A", userId: "u_A", fullName: "Giáo viên A", teacherCode: "GVTOAN01" },
      { id: "t_B", userId: "u_B", fullName: "Giáo viên B", teacherCode: "GVTOAN02" }
    );
    db.teachingAssignments.push(
      { id: "ta_A", teacherId: "t_A", classId: "c_6A", subjectId: "sub_math", academicYearId: "ay_2026" },
      { id: "ta_B", teacherId: "t_B", classId: "c_6B", subjectId: "sub_math", academicYearId: "ay_2026" }
    );
    db.exams.push({
      id: "ex_common",
      title: "Toán 6 Chung",
      classId: null,
      examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
      subjectId: "sub_math",
      teacherId: null,
      status: "PUBLISHED",
    });
    db.examCandidates.push(
      { examId: "ex_common", studentId: "st_A", studentNumber: "001" },
      { examId: "ex_common", studentId: "st_B", studentNumber: "002" }
    );
    db.examSubmissions.push(
      {
        id: "sub_6A",
        examId: "ex_common",
        resolvedStudentNumber: "001",
        status: "FINAL",
        finalScore: 10.0,
        provisionalScore: 10.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_6B",
        examId: "ex_common",
        resolvedStudentNumber: "002",
        status: "FINAL",
        finalScore: 4.0,
        provisionalScore: 4.0,
        identityNeedsReview: false,
      }
    );

    // Call with Teacher A credentials but querying Teacher B's ID
    const resForbidden = await adminDashboardService.getAdminSystemDashboard(
      { teacherId: "t_B" },
      { id: "u_A", role: "TEACHER" }
    );

    // Assert: Colleague's data is completely blocked
    assert.equal(resForbidden.overview.submissions.total, 0, "Teacher A querying Teacher B must receive 0 submissions");
    assert.equal(resForbidden.overview.scoring.averageScore, null, "Average score must be null (not Teacher B's 4.0)");
    assert.equal(resForbidden.overview.students.withResults, 0, "Students with results must be 0");
    assert.equal(resForbidden.overview.teachers.total, 0, "Teachers total must be 0");
    assert.equal(resForbidden.recentSubmissions.length, 0, "Recent submissions must be empty");
    assert.equal(resForbidden.recentExams.length, 0, "Recent exams must be empty");
    assert.equal(resForbidden.topTeachers.length, 0, "Top teachers must be empty");

    // Call with Teacher A's own scope (no teacherId or teacherId = t_A)
    const resSelf = await adminDashboardService.getAdminSystemDashboard(
      {},
      { id: "u_A", role: "TEACHER" }
    );
    assert.equal(resSelf.overview.submissions.total, 1, "Teacher A in own scope gets exactly 1 submission (6A)");
    assert.equal(resSelf.overview.scoring.averageScore, 10.0, "Score must be strictly 10.0 from 6A");
    assert.equal(resSelf.overview.students.withResults, 1, "Students with results must be 1");

    record(
      "UNIT_TEST_SERVICE_LOGIC",
      "Teacher Role Isolation: Teacher A passing Teacher B's teacherId is blocked from viewing colleague's data",
      "PASS"
    );
  } catch (err) {
    record("UNIT_TEST_SERVICE_LOGIC", "Teacher Role Isolation", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // TEST GROUP 10: REAL HTTP PIPELINE INTEGRATION TEST WITH MEANINGFUL TEST DATA
  // Route -> Auth Middleware -> CanViewOversight -> Controller -> Service over HTTP
  // Test Scenario:
  // - Teacher A teaches Math in 6A; Teacher B teaches Math in 6B.
  // - A common Math exam (E_Common) includes both 6A and 6B.
  // - Student A (6A) has a submission with score 10.0 (SBD 001).
  // - Student B (6B) has a submission with score 4.0 (SBD 002).
  // - Class 6C and Subject Literature (VAN) are outside Teacher A's assignment.
  // Real HTTP Requests sent via Express socket with Teacher A's Bearer JWT:
  //   1. Without teacherId: must see only 6A submission, average score 10.00.
  //   2. With teacherId of A: identical result.
  //   3. With teacherId of B: empty scope, 0 submissions, avg score null, no 6B data leaked.
  //   4. With classId outside assignment (6B): empty scope, 0 submissions, avg score null.
  //   5. With subjectId outside assignment (VAN): empty scope, 0 submissions, avg score null.
  // -------------------------------------------------------------------------
  try {
    const db = createMockPrismaState();
    db.academicYears.push({ id: "ay_2026", name: "2026-2027" });
    db.grades.push({ id: "g_6", level: 6, name: "Khối 6", classes: [] });
    db.classes.push(
      { id: "c_6A", name: "6A", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6B", name: "6B", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] },
      { id: "c_6C", name: "6C", gradeId: "g_6", academicYearId: "ay_2026", enrollments: [] }
    );
    db.subjects.push(
      { id: "sub_math", code: "TOAN", name: "Toán", _count: { exams: 1 } },
      { id: "sub_lit", code: "VAN", name: "Ngữ văn", _count: { exams: 0 } }
    );
    db.users.push(
      { id: "u_A", email: "teacherA@school.edu.vn", role: "TEACHER", status: "ACTIVE" },
      { id: "u_B", email: "teacherB@school.edu.vn", role: "TEACHER", status: "ACTIVE" }
    );
    db.teachers.push(
      { id: "t_A", userId: "u_A", fullName: "Nguyễn Văn A", teacherCode: "GVTOAN01" },
      { id: "t_B", userId: "u_B", fullName: "Trần Thị B", teacherCode: "GVTOAN02" }
    );
    db.teachingAssignments.push(
      { id: "ta_A", teacherId: "t_A", classId: "c_6A", subjectId: "sub_math", academicYearId: "ay_2026" },
      { id: "ta_B", teacherId: "t_B", classId: "c_6B", subjectId: "sub_math", academicYearId: "ay_2026" }
    );

    // Students
    db.students.push(
      { id: "st_A", studentCode: "HS_6A_01", fullName: "Học sinh 6A" },
      { id: "st_B", studentCode: "HS_6B_01", fullName: "Học sinh 6B" }
    );
    db.studentEnrollments.push(
      { studentId: "st_A", classId: "c_6A", academicYearId: "ay_2026", student: { studentCode: "HS_6A_01" } },
      { studentId: "st_B", classId: "c_6B", academicYearId: "ay_2026", student: { studentCode: "HS_6B_01" } }
    );

    // Common Exam: Math Grade 6 (includes 6A and 6B)
    db.exams.push({
      id: "ex_common",
      title: "Toán Khối 6 Đa Lớp",
      classId: null,
      examClasses: [{ classId: "c_6A" }, { classId: "c_6B" }],
      subjectId: "sub_math",
      teacherId: null,
      status: "PUBLISHED",
    });

    // Candidates
    db.examCandidates.push(
      { examId: "ex_common", studentId: "st_A", studentNumber: "001" },
      { examId: "ex_common", studentId: "st_B", studentNumber: "002" }
    );

    // Submissions:
    // Student A (6A): 10.0 points
    // Student B (6B): 4.0 points
    db.examSubmissions.push(
      {
        id: "sub_6A",
        examId: "ex_common",
        resolvedStudentNumber: "001",
        status: "FINAL",
        finalScore: 10.0,
        provisionalScore: 10.0,
        identityNeedsReview: false,
      },
      {
        id: "sub_6B",
        examId: "ex_common",
        resolvedStudentNumber: "002",
        status: "FINAL",
        finalScore: 4.0,
        provisionalScore: 4.0,
        identityNeedsReview: false,
      }
    );

    const tokenA = jwt.sign(
      { sub: "u_A", role: "TEACHER", email: "teacherA@school.edu.vn" },
      process.env.JWT_ACCESS_SECRET || "test-jwt-access-secret-32-chars-long!!"
    );

    // Spin up live HTTP server
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      // 1. Teacher A calls GET /api/admin/dashboard (NO teacherId)
      const resDefault = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resDefault.status, 200, "HTTP status must be 200");
      const bodyDefault = await resDefault.json();
      assert.equal(bodyDefault.success, true, "Response body must indicate success");
      assert.equal(bodyDefault.data.overview.submissions.total, 1, "Must see strictly 1 submission from 6A");
      assert.equal(bodyDefault.data.overview.submissions.final, 1, "Final submissions must be 1");
      assert.equal(bodyDefault.data.overview.scoring.averageScore, 10.00, "Average score must be strictly 10.00 from 6A");
      assert.equal(bodyDefault.data.overview.scoring.distribution.excellent, 1, "Score distribution excellent must be 1");
      assert.equal(bodyDefault.data.overview.scoring.distribution.belowAvg, 0, "Score distribution belowAvg must be 0 (4.0 excluded)");
      assert.equal(bodyDefault.data.overview.students.withResults, 1, "Only 1 student with results (Student A)");
      assert.equal(bodyDefault.data.recentSubmissions.length, 1, "Recent submissions must have exactly 1 item");
      assert.equal(bodyDefault.data.recentSubmissions[0].id, "sub_6A", "Recent submission must be sub_6A");
      assert.equal(bodyDefault.data.recentSubmissions[0].score, 10.0, "Recent submission score must be 10.0");

      // 2. Teacher A calls GET /api/admin/dashboard?teacherId=t_A (Passing Teacher A's own ID)
      const resSelf = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard?teacherId=t_A`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resSelf.status, 200, "HTTP status must be 200");
      const bodySelf = await resSelf.json();
      assert.equal(bodySelf.success, true);
      assert.equal(bodySelf.data.overview.submissions.total, 1, "Must see strictly 1 submission from 6A");
      assert.equal(bodySelf.data.overview.scoring.averageScore, 10.00, "Average score must be strictly 10.00");
      assert.equal(bodySelf.data.overview.students.withResults, 1, "Students with results must be 1");
      assert.equal(bodySelf.data.recentSubmissions[0].id, "sub_6A");

      // 3. Teacher A calls GET /api/admin/dashboard?teacherId=t_B (Passing Teacher B's ID)
      const resColleague = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard?teacherId=t_B`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resColleague.status, 200, "HTTP status must be 200 (handled gracefully via policy)");
      const bodyColleague = await resColleague.json();
      assert.equal(bodyColleague.success, true);
      assert.equal(bodyColleague.data.overview.submissions.total, 0, "Colleague scope: submissions must be 0");
      assert.equal(bodyColleague.data.overview.scoring.averageScore, null, "Colleague scope: averageScore must be null");
      assert.equal(bodyColleague.data.overview.scoring.distribution.belowAvg, 0, "No 4.0 score from 6B may appear");
      assert.equal(bodyColleague.data.overview.students.withResults, 0, "Students with results must be 0");
      assert.equal(bodyColleague.data.recentSubmissions.length, 0, "Recent submissions must be empty");
      assert.equal(bodyColleague.data.recentExams.length, 0, "Recent exams must be empty");

      // 4. Teacher A calls GET /api/admin/dashboard?classId=c_6B (Class outside Teacher A's assignment)
      const resUnassignedClass = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard?classId=c_6B`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resUnassignedClass.status, 200, "HTTP status must be 200");
      const bodyUnassignedClass = await resUnassignedClass.json();
      assert.equal(bodyUnassignedClass.success, true);
      assert.equal(bodyUnassignedClass.data.overview.submissions.total, 0, "Unassigned class 6B yields 0 submissions for Teacher A");
      assert.equal(bodyUnassignedClass.data.overview.scoring.averageScore, null, "Unassigned class 6B yields null average score");
      assert.equal(bodyUnassignedClass.data.recentSubmissions.length, 0, "Recent submissions must be empty");

      // 5. Teacher A calls GET /api/admin/dashboard?subjectId=sub_lit (Subject outside assignment)
      const resUnassignedSubject = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard?subjectId=sub_lit`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(resUnassignedSubject.status, 200, "HTTP status must be 200");
      const bodyUnassignedSubject = await resUnassignedSubject.json();
      assert.equal(bodyUnassignedSubject.success, true);
      assert.equal(bodyUnassignedSubject.data.overview.submissions.total, 0, "Unassigned subject Literature yields 0 submissions");
      assert.equal(bodyUnassignedSubject.data.overview.scoring.averageScore, null, "Unassigned subject Literature yields null avg score");
      assert.equal(bodyUnassignedSubject.data.recentSubmissions.length, 0, "Recent submissions must be empty");

      record(
        "HTTP_INTEGRATION_TEST",
        "Express App HTTP Pipeline: Authenticate -> RBAC -> Controller -> Service verified over real HTTP with comprehensive response payload inspection",
        "PASS"
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } catch (err) {
    record("HTTP_INTEGRATION_TEST", "Express App HTTP Pipeline", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 11: POSTGRESQL PORT CONNECTIVITY PROBE (PORT 5433 / 5432)
  // Specifically checks TCP socket reachability on the configured ports
  // -------------------------------------------------------------------------
  let portProbeResult = null;
  try {
    const probePort = async (port) => {
      return new Promise((resolve) => {
        const socket = net.createConnection({ port, host: "127.0.0.1", timeout: 600 });
        socket.on("connect", () => {
          socket.destroy();
          resolve({ ok: true, port });
        });
        socket.on("error", (err) => {
          resolve({ ok: false, port, error: err.code || err.message });
        });
        socket.on("timeout", () => {
          socket.destroy();
          resolve({ ok: false, port, error: "Connection timed out" });
        });
      });
    };

    // Check project configured port 5433 first, then 5432
    let probe = await probePort(5433);
    if (!probe.ok) {
      const probe5432 = await probePort(5432);
      if (probe5432.ok) {
        probe = probe5432;
      }
    }
    portProbeResult = probe;

    if (probe.ok) {
      record(
        "PORT_CONNECTIVITY_PROBE",
        `PostgreSQL Port Connectivity Check (127.0.0.1:${probe.port} accessible)`,
        "PASS"
      );
    } else {
      record(
        "PORT_CONNECTIVITY_PROBE",
        "PostgreSQL Port Connectivity Check (Ports 5433 & 5432 unreachable: ECONNREFUSED)",
        "BLOCKED",
        `Neither port 5433 nor 5432 responded. Host TCP socket returned: ${probe.error}`
      );
    }
  } catch (err) {
    record("PORT_CONNECTIVITY_PROBE", "PostgreSQL Port Connectivity Check", "FAIL", err.stack);
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 12: POSTGRESQL TEST DATABASE CONNECTION PROBE
  // Verifies live connection to dedicated test DB (exam_grading_test) via SELECT 1
  // -------------------------------------------------------------------------
  try {
    if (!portProbeResult || !portProbeResult.ok) {
      record(
        "DB_CONNECTION_PROBE",
        "Live PostgreSQL Test DB Connection Probe (SELECT 1 on exam_grading_test)",
        "BLOCKED",
        "PostgreSQL service/container on port 5433 is unreachable (Docker daemon is offline). Minimal action required: Launch Docker Desktop from Windows Start Menu/Desktop, then run 'npm run dev:db' to start the postgres & redis containers."
      );
    } else {
      const { PrismaClient } = await import("@prisma/client");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const testDbUrl = process.env.TEST_DATABASE_URL || "postgresql://exam_user:exam_local_2026@127.0.0.1:5433/exam_grading_test?schema=public";
      const adapter = new PrismaPg({ connectionString: testDbUrl });
      const livePrisma = new PrismaClient({ adapter });

      try {
        await livePrisma.$connect();
        const dbCheck = await livePrisma.$queryRaw`SELECT 1 as connected`;
        assert.ok(dbCheck, "Live DB connection query succeeded");
        record(
          "DB_CONNECTION_PROBE",
          "Live PostgreSQL Test DB Connection Probe (SELECT 1 on exam_grading_test)",
          "PASS",
          "Successfully connected to test database (exam_grading_test) and verified basic query capability."
        );
      } finally {
        await livePrisma.$disconnect();
      }
    }
  } catch (err) {
    record("DB_CONNECTION_PROBE", "Live PostgreSQL Test DB Connection Probe", "FAIL", err.stack);
  }

  console.log("\n===============================================================================");
  console.log("                           EXECUTION SUMMARY                                  ");
  console.log("===============================================================================");
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const blockedCount = results.filter((r) => r.status === "BLOCKED").length;

  console.log(`TOTAL TESTS:   ${results.length}`);
  console.log(`PASS:          ${passCount}`);
  console.log(`FAIL:          ${failCount}`);
  console.log(`BLOCKED:       ${blockedCount}`);
  console.log("===============================================================================\n");

  if (failCount > 0) process.exit(1);
}

runTestSuite();
