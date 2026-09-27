import assert from "node:assert/strict";
import prisma, { getDatabaseUrl } from "../src/config/prisma.js";
import { getAdminSystemDashboard } from "../src/services/admin-dashboard.service.js";

async function runPostgresDashboardLiveTests() {
  console.log("===============================================================================");
  console.log("      POSTGRESQL LIVE INTEGRATION TEST SUITE (REAL PRISMA ON TEST DB)         ");
  console.log("===============================================================================\n");

  // 1. Safety verification
  assert.equal(process.env.NODE_ENV, "test", "Must run strictly in NODE_ENV=test");
  const activeDbUrl = getDatabaseUrl();
  const dbName = new URL(activeDbUrl).pathname.replace(/^\//, "").split("?")[0].toLowerCase();
  assert.ok(dbName.includes("test"), `Safety Check: Connected DB "${dbName}" must be a test database!`);
  console.log(`[SAFETY CHECK] Verified connected database: ${dbName} (${activeDbUrl.replace(/:[^:@]+@/, ":***@")})\n`);

  const RUN_ID = `T_${Date.now()}`;
  const createdIds = {
    submissions: [],
    candidates: [],
    templates: [],
    examCodes: [],
    examClasses: [],
    exams: [],
    enrollments: [],
    students: [],
    assignments: [],
    teachers: [],
    users: [],
    classes: [],
    grades: [],
    subjects: [],
    academicYears: [],
  };

  const results = [];
  function record(name, status, detail = "") {
    results.push({ name, status, detail });
    const tag = `[${status}]`.padEnd(9);
    console.log(`${tag} ${name}`);
    if (detail && status !== "PASS") {
      console.log(`          ↳ ${detail}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // STEP 1: PROVISION ISOLATED TEST FIXTURES ON REAL POSTGRESQL
    // -------------------------------------------------------------------------
    console.log("--- [FIXTURE SETUP] Provisioning isolated test fixtures with tag:", RUN_ID);

    // Academic Year
    const ay = await prisma.academicYear.create({
      data: { name: `Năm học 2026-2027 ${RUN_ID}` },
    });
    createdIds.academicYears.push(ay.id);

    // Grade 6
    let grade6 = await prisma.grade.findUnique({ where: { level: 6 } });
    if (!grade6) {
      grade6 = await prisma.grade.create({
        data: { name: `Khối 6 ${RUN_ID}`, level: 6 },
      });
      createdIds.grades.push(grade6.id);
    }

    // Classes 6A, 6B, 6C
    const class6A = await prisma.class.create({
      data: { name: `6A_${RUN_ID}`, gradeId: grade6.id, academicYearId: ay.id },
    });
    createdIds.classes.push(class6A.id);

    const class6B = await prisma.class.create({
      data: { name: `6B_${RUN_ID}`, gradeId: grade6.id, academicYearId: ay.id },
    });
    createdIds.classes.push(class6B.id);

    const class6C = await prisma.class.create({
      data: { name: `6C_${RUN_ID}`, gradeId: grade6.id, academicYearId: ay.id },
    });
    createdIds.classes.push(class6C.id);

    // Subjects: Math, IT, Literature
    const subMath = await prisma.subject.create({
      data: { name: `Toán ${RUN_ID}`, code: `TOAN_${RUN_ID}` },
    });
    createdIds.subjects.push(subMath.id);

    const subIT = await prisma.subject.create({
      data: { name: `Tin học ${RUN_ID}`, code: `TIN_${RUN_ID}` },
    });
    createdIds.subjects.push(subIT.id);

    const subLit = await prisma.subject.create({
      data: { name: `Ngữ văn ${RUN_ID}`, code: `VAN_${RUN_ID}` },
    });
    createdIds.subjects.push(subLit.id);

    // Users and Teachers:
    // Teacher A: User A
    const userA = await prisma.user.create({
      data: {
        email: `teacher_a_${RUN_ID}@school.test`,
        passwordHash: "dummy-test-hash",
        role: "TEACHER",
        status: "ACTIVE",
        fullName: `GV A ${RUN_ID}`,
      },
    });
    createdIds.users.push(userA.id);

    const teacherA = await prisma.teacher.create({
      data: {
        userId: userA.id,
        fullName: userA.fullName,
        teacherCode: `GVA_${RUN_ID}`,
      },
    });
    createdIds.teachers.push(teacherA.id);

    // Teacher B: User B
    const userB = await prisma.user.create({
      data: {
        email: `teacher_b_${RUN_ID}@school.test`,
        passwordHash: "dummy-test-hash",
        role: "TEACHER",
        status: "ACTIVE",
        fullName: `GV B ${RUN_ID}`,
      },
    });
    createdIds.users.push(userB.id);

    const teacherB = await prisma.teacher.create({
      data: {
        userId: userB.id,
        fullName: userB.fullName,
        teacherCode: `GVB_${RUN_ID}`,
      },
    });
    createdIds.teachers.push(teacherB.id);

    // Teacher C: User C (Multi-subject: Math 6A, IT 6B)
    const userC = await prisma.user.create({
      data: {
        email: `teacher_c_${RUN_ID}@school.test`,
        passwordHash: "dummy-test-hash",
        role: "TEACHER",
        status: "ACTIVE",
        fullName: `GV C ${RUN_ID}`,
      },
    });
    createdIds.users.push(userC.id);

    const teacherC = await prisma.teacher.create({
      data: {
        userId: userC.id,
        fullName: userC.fullName,
        teacherCode: `GVC_${RUN_ID}`,
      },
    });
    createdIds.teachers.push(teacherC.id);

    // Teaching Assignments:
    // Teacher A -> Math 6A
    const taA = await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherA.id,
        classId: class6A.id,
        subjectId: subMath.id,
        academicYearId: ay.id,
      },
    });
    createdIds.assignments.push(taA.id);

    // Teacher B -> Math 6B
    const taB = await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherB.id,
        classId: class6B.id,
        subjectId: subMath.id,
        academicYearId: ay.id,
      },
    });
    createdIds.assignments.push(taB.id);

    // Teacher C -> Math 6C AND IT 6B (Preserving school model: one teacher per subject per class)
    const taC1 = await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherC.id,
        classId: class6C.id,
        subjectId: subMath.id,
        academicYearId: ay.id,
      },
    });
    createdIds.assignments.push(taC1.id);

    const taC2 = await prisma.teachingAssignment.create({
      data: {
        teacherId: teacherC.id,
        classId: class6B.id,
        subjectId: subIT.id,
        academicYearId: ay.id,
      },
    });
    createdIds.assignments.push(taC2.id);

    // Students with 1-to-1 User relation
    const stuA = await prisma.student.create({
      data: {
        studentCode: `HS_A_${RUN_ID}`,
        fullName: `Học sinh A ${RUN_ID}`,
        user: {
          create: {
            email: `student_a_${RUN_ID}@school.test`,
            passwordHash: "dummy-test-hash",
            role: "STUDENT",
            status: "ACTIVE",
            fullName: `Học sinh A ${RUN_ID}`,
          },
        },
      },
      include: { user: true },
    });
    createdIds.students.push(stuA.id);
    createdIds.users.push(stuA.user.id);

    const stuB = await prisma.student.create({
      data: {
        studentCode: `HS_B_${RUN_ID}`,
        fullName: `Học sinh B ${RUN_ID}`,
        user: {
          create: {
            email: `student_b_${RUN_ID}@school.test`,
            passwordHash: "dummy-test-hash",
            role: "STUDENT",
            status: "ACTIVE",
            fullName: `Học sinh B ${RUN_ID}`,
          },
        },
      },
      include: { user: true },
    });
    createdIds.students.push(stuB.id);
    createdIds.users.push(stuB.user.id);

    const stuC = await prisma.student.create({
      data: {
        studentCode: `HS_C_${RUN_ID}`,
        fullName: `Học sinh C ${RUN_ID}`,
        user: {
          create: {
            email: `student_c_${RUN_ID}@school.test`,
            passwordHash: "dummy-test-hash",
            role: "STUDENT",
            status: "ACTIVE",
            fullName: `Học sinh C ${RUN_ID}`,
          },
        },
      },
      include: { user: true },
    });
    createdIds.students.push(stuC.id);
    createdIds.users.push(stuC.user.id);

    // Enrollments
    const enrA = await prisma.studentEnrollment.create({
      data: {
        studentId: stuA.id,
        classId: class6A.id,
        academicYearId: ay.id,
      },
    });
    createdIds.enrollments.push(enrA.id);

    const enrB = await prisma.studentEnrollment.create({
      data: {
        studentId: stuB.id,
        classId: class6B.id,
        academicYearId: ay.id,
      },
    });
    createdIds.enrollments.push(enrB.id);

    const enrC = await prisma.studentEnrollment.create({
      data: {
        studentId: stuC.id,
        classId: class6C.id,
        academicYearId: ay.id,
      },
    });
    createdIds.enrollments.push(enrC.id);

    // Helper: Create exam with code and template
    const createExamWithAssets = async (title, subjectId, classIds) => {
      const exam = await prisma.exam.create({
        data: {
          title,
          subjectId,
          classId: classIds.length === 1 ? classIds[0] : null,
          status: "PUBLISHED",
          questionCount: 10,
          maxScore: 10.0,
          scoringType: "EQUAL",
          examClasses: {
            create: classIds.map((cid) => ({ classId: cid })),
          },
        },
        include: { examClasses: true },
      });
      createdIds.exams.push(exam.id);
      exam.examClasses.forEach((ec) => createdIds.examClasses.push(ec.id));

      const examCode = await prisma.examCode.create({
        data: { examId: exam.id, code: "101" },
      });
      createdIds.examCodes.push(examCode.id);

      const template = await prisma.answerSheetTemplate.create({
        data: { examId: exam.id, version: 1, layoutJson: {} },
      });
      createdIds.templates.push(template.id);

      return { exam, examCode, template };
    };

    // Helper: Create submission
    const createSubmission = async (examObj, studentNumber, score) => {
      const sub = await prisma.examSubmission.create({
        data: {
          examId: examObj.exam.id,
          examCodeId: examObj.examCode.id,
          answerSheetTemplateId: examObj.template.id,
          gradedByUserId: userA.id,
          status: "FINAL",
          studentNumberOmrStatus: "VALID",
          detectedStudentNumber: studentNumber,
          resolvedStudentNumber: studentNumber,
          candidateStudentNumber: studentNumber,
          identityNeedsReview: false,
          originalImageStorageKey: `img_${RUN_ID}_${Math.random()}`,
          originalImageSha256: `sha_${Math.random()}`,
          originalImageMimeType: "image/jpeg",
          originalImageSizeBytes: 1024,
          omrOverallStatus: "SUCCESS",
          questionCountSnapshot: 10,
          maxScoreSnapshot: 10.0,
          scoringTypeSnapshot: "EQUAL",
          examCodeSnapshot: "101",
          correctCount: Math.round(score),
          incorrectCount: 10 - Math.round(score),
          blankCount: 0,
          unresolvedCount: 0,
          provisionalScore: score,
          finalScore: score,
        },
      });
      createdIds.submissions.push(sub.id);
      return sub;
    };

    // -------------------------------------------------------------------------
    // SCENARIO 1: COMMON MATH EXAM (6A + 6B)
    // 6A has score 10.0 (Student A, SBD 001)
    // 6B has score 4.0 (Student B, SBD 002)
    // -------------------------------------------------------------------------
    const commonMath = await createExamWithAssets(
      `Toán Khối 6 Đa Lớp ${RUN_ID}`,
      subMath.id,
      [class6A.id, class6B.id, class6C.id]
    );

    const candA = await prisma.examCandidate.create({
      data: { examId: commonMath.exam.id, studentId: stuA.id, studentNumber: "001" },
    });
    createdIds.candidates.push(candA.id);

    const candB = await prisma.examCandidate.create({
      data: { examId: commonMath.exam.id, studentId: stuB.id, studentNumber: "002" },
    });
    createdIds.candidates.push(candB.id);

    const candC = await prisma.examCandidate.create({
      data: { examId: commonMath.exam.id, studentId: stuC.id, studentNumber: "003" },
    });
    createdIds.candidates.push(candC.id);

    await createSubmission(commonMath, "001", 10.0); // 6A Math: 10.0
    await createSubmission(commonMath, "002", 4.0);  // 6B Math: 4.0
    await createSubmission(commonMath, "003", 10.0); // 6C Math: 10.0

    console.log("--- [FIXTURE SETUP] Fixtures successfully committed to PostgreSQL test DB.\n");

    // -------------------------------------------------------------------------
    // TEST 1: TEACHER A DEFAULT SCOPE (NO teacherId) ON REAL POSTGRESQL
    // -------------------------------------------------------------------------
    try {
      const res = await getAdminSystemDashboard(
        {},
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(res.overview.submissions.total, 1, "Teacher A in own scope must see strictly 1 submission (from 6A)");
      assert.equal(res.overview.scoring.averageScore, 10.00, "Teacher A average score must be strictly 10.00");
      assert.equal(res.overview.students.withResults, 1, "Students with results must be strictly 1");
      assert.equal(res.recentSubmissions.length, 1, "Recent submissions must contain only 6A submission");
      assert.equal(res.recentSubmissions[0].score, 10.0, "Recent submission score must be 10.0");
      assert.equal(res.recentSubmissions[0].studentNumber, "001", "Recent submission SBD must be 001");

      record(
        "Live PostgreSQL: Teacher A Default Scope (6A Math only, score 10.0)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Teacher A Default Scope", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 2: TEACHER A SPECIFYING OWN teacherId
    // -------------------------------------------------------------------------
    try {
      const res = await getAdminSystemDashboard(
        { teacherId: teacherA.id },
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(res.overview.submissions.total, 1);
      assert.equal(res.overview.scoring.averageScore, 10.00);
      assert.equal(res.recentSubmissions[0].score, 10.0);

      record(
        "Live PostgreSQL: Teacher A Passing Own teacherId (Consistent scope)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Teacher A Passing Own teacherId", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 3: TEACHER A PASSING TEACHER B'S teacherId (CROSS-TEACHER TAMPERING CHECK)
    // -------------------------------------------------------------------------
    try {
      const res = await getAdminSystemDashboard(
        { teacherId: teacherB.id },
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(res.overview.submissions.total, 0, "Colleague scope: submissions must be 0");
      assert.equal(res.overview.scoring.averageScore, null, "Colleague scope: averageScore must be null");
      assert.equal(res.overview.students.withResults, 0, "Colleague scope: students with results must be 0");
      assert.equal(res.recentSubmissions.length, 0, "Recent submissions must be empty (0 colleague data leaked)");
      assert.equal(res.recentExams.length, 0, "Recent exams must be empty");

      record(
        "Live PostgreSQL: Cross-Teacher Tampering Blocked (Teacher A passing Teacher B's ID yields empty dataset)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Cross-Teacher Tampering Blocked", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 4: TEACHER A FILTERING UNASSIGNED CLASS (6B OR 6C)
    // -------------------------------------------------------------------------
    try {
      const res6B = await getAdminSystemDashboard(
        { classId: class6B.id },
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(res6B.overview.submissions.total, 0, "Filtering 6B yields 0 submissions for Teacher A");
      assert.equal(res6B.overview.scoring.averageScore, null, "Filtering 6B yields null average score");
      assert.equal(res6B.recentSubmissions.length, 0);

      const res6C = await getAdminSystemDashboard(
        { classId: class6C.id },
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(res6C.overview.submissions.total, 0);
      assert.equal(res6C.overview.scoring.averageScore, null);

      record(
        "Live PostgreSQL: Unassigned Class Filter Strictly Excluded (6B/6C yield 0 data)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Unassigned Class Filter", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 5: TEACHER A FILTERING UNASSIGNED SUBJECT (LITERATURE)
    // -------------------------------------------------------------------------
    try {
      const resLit = await getAdminSystemDashboard(
        { subjectId: subLit.id },
        { id: userA.id, role: "TEACHER" }
      );
      assert.equal(resLit.overview.submissions.total, 0, "Unassigned subject yields 0 submissions");
      assert.equal(resLit.overview.scoring.averageScore, null);
      assert.equal(resLit.recentSubmissions.length, 0);

      record(
        "Live PostgreSQL: Unassigned Subject Filter Strictly Excluded (Literature yields 0 data)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Unassigned Subject Filter", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 6: SBD DUPLICATE COLLISION ACROSS SEPARATE EXAMS
    // E1 (6A Math): Student A has SBD "COLLIDE_01", score 9.0
    // E2 (6B Math): Student B has SBD "COLLIDE_01", score 3.0
    // Teacher A (teaching 6A Math only): must NOT count Student B's score 3.0!
    // -------------------------------------------------------------------------
    try {
      const examE1 = await createExamWithAssets(
        `E1_Toán_6A_${RUN_ID}`,
        subMath.id,
        [class6A.id]
      );
      const examE2 = await createExamWithAssets(
        `E2_Toán_6B_${RUN_ID}`,
        subMath.id,
        [class6B.id]
      );

      const candE1 = await prisma.examCandidate.create({
        data: { examId: examE1.exam.id, studentId: stuA.id, studentNumber: "COLLIDE_01" },
      });
      createdIds.candidates.push(candE1.id);

      const candE2 = await prisma.examCandidate.create({
        data: { examId: examE2.exam.id, studentId: stuB.id, studentNumber: "COLLIDE_01" },
      });
      createdIds.candidates.push(candE2.id);

      await createSubmission(examE1, "COLLIDE_01", 9.0);
      await createSubmission(examE2, "COLLIDE_01", 3.0);

      // Query Teacher A on exam E1
      const resE1 = await getAdminSystemDashboard(
        { classId: class6A.id },
        { id: userA.id, role: "TEACHER" }
      );
      // In 6A, there are 2 submissions: commonMath (score 10) and examE1 (score 9)
      // Average score = (10 + 9) / 2 = 9.50. Student B's 3.0 score with same SBD MUST NOT leak!
      assert.equal(resE1.overview.submissions.total, 2, "6A must have exactly 2 submissions");
      assert.equal(resE1.overview.scoring.averageScore, 9.50, "Average score must be strictly 9.50 ((10+9)/2), excluding E2's 3.0");

      record(
        "Live PostgreSQL: SBD Duplicate Collision Across Exams (Same SBD 'COLLIDE_01' isolated per exam)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: SBD Duplicate Collision", "FAIL", err.stack);
    }

    // -------------------------------------------------------------------------
    // TEST 7: TEACHING ASSIGNMENT PAIR PRESERVATION (MATH 6A / IT 6B) FOR TEACHER C
    // Common Exam Math (6A + 6B)
    // Common Exam IT (6A + 6B)
    // Submissions:
    //   Math 6A: 10.0 (Student A)
    //   Math 6B: 4.0  (Student B) -> excluded for Teacher C
    //   IT 6A:   2.0  (Student A) -> excluded for Teacher C
    //   IT 6B:   8.0  (Student B) -> included for Teacher C
    // Expected for Teacher C:
    //   Math counts only 6A (10.0)
    //   IT counts only 6B (8.0)
    //   Average score = (10.0 + 8.0) / 2 = 9.00!
    // -------------------------------------------------------------------------
    try {
      const commonIT = await createExamWithAssets(
        `Tin học Khối 6 Đa Lớp ${RUN_ID}`,
        subIT.id,
        [class6A.id, class6B.id]
      );

      const candITA = await prisma.examCandidate.create({
        data: { examId: commonIT.exam.id, studentId: stuA.id, studentNumber: "IT_001" },
      });
      createdIds.candidates.push(candITA.id);

      const candITB = await prisma.examCandidate.create({
        data: { examId: commonIT.exam.id, studentId: stuB.id, studentNumber: "IT_002" },
      });
      createdIds.candidates.push(candITB.id);

      await createSubmission(commonIT, "IT_001", 2.0); // 6A IT: 2.0
      await createSubmission(commonIT, "IT_002", 8.0); // 6B IT: 8.0

      const resTeacherC = await getAdminSystemDashboard(
        {},
        { id: userC.id, role: "TEACHER" }
      );

      // Teacher C has (6C Math) and (6B IT).
      // Submissions in scope:
      // - commonMath: sub for 6C Math (10.0) -> MATCH (6A Math and 6B Math are excluded)
      // - commonIT: sub for 6B IT (8.0) -> MATCH (6A IT is excluded)
      // - examE1 (6A Math) and examE2 (6B Math) -> EXCLUDED (taught by A and B)
      // Total = 2 submissions.
      // Sum = 10.0 + 8.0 = 18.0 -> Average = 18.0 / 2 = 9.00!
      assert.equal(resTeacherC.overview.submissions.total, 2, "Teacher C must match strictly 2 submissions matching assigned pairs");
      assert.equal(resTeacherC.overview.scoring.averageScore, 9.00, "Teacher C average score must be strictly 9.00");

      record(
        "Live PostgreSQL: Teaching Assignment Pair Preservation (Math 6C / IT 6B verified with real joins)",
        "PASS"
      );
    } catch (err) {
      record("Live PostgreSQL: Teaching Assignment Pair Preservation", "FAIL", err.stack);
    }
  } finally {
    // -------------------------------------------------------------------------
    // STEP 2: SAFE CLEANUP - PURGE ONLY FIXTURES CREATED BY THIS RUN
    // -------------------------------------------------------------------------
    console.log("\n--- [SAFE TEARDOWN] Cleaning up only records created by test run:", RUN_ID);
    try {
      if (createdIds.submissions.length > 0) {
        await prisma.examSubmission.deleteMany({ where: { id: { in: createdIds.submissions } } });
      }
      if (createdIds.candidates.length > 0) {
        await prisma.examCandidate.deleteMany({ where: { id: { in: createdIds.candidates } } });
      }
      if (createdIds.templates.length > 0) {
        await prisma.answerSheetTemplate.deleteMany({ where: { id: { in: createdIds.templates } } });
      }
      if (createdIds.examCodes.length > 0) {
        await prisma.examCode.deleteMany({ where: { id: { in: createdIds.examCodes } } });
      }
      if (createdIds.examClasses.length > 0) {
        await prisma.examClass.deleteMany({ where: { id: { in: createdIds.examClasses } } });
      }
      if (createdIds.exams.length > 0) {
        await prisma.exam.deleteMany({ where: { id: { in: createdIds.exams } } });
      }
      if (createdIds.enrollments.length > 0) {
        await prisma.studentEnrollment.deleteMany({ where: { id: { in: createdIds.enrollments } } });
      }
      if (createdIds.students.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: createdIds.students } } });
      }
      if (createdIds.assignments.length > 0) {
        await prisma.teachingAssignment.deleteMany({ where: { id: { in: createdIds.assignments } } });
      }
      if (createdIds.teachers.length > 0) {
        await prisma.teacher.deleteMany({ where: { id: { in: createdIds.teachers } } });
      }
      if (createdIds.users.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
      }
      if (createdIds.classes.length > 0) {
        await prisma.class.deleteMany({ where: { id: { in: createdIds.classes } } });
      }
      if (createdIds.grades.length > 0) {
        await prisma.grade.deleteMany({ where: { id: { in: createdIds.grades } } });
      }
      if (createdIds.subjects.length > 0) {
        await prisma.subject.deleteMany({ where: { id: { in: createdIds.subjects } } });
      }
      if (createdIds.academicYears.length > 0) {
        await prisma.academicYear.deleteMany({ where: { id: { in: createdIds.academicYears } } });
      }
      console.log("--- [SAFE TEARDOWN] Cleanup completed cleanly. Zero user demo data touched.\n");
    } catch (cleanupErr) {
      console.error("[SAFE TEARDOWN ERROR] Failed to clean up test fixtures:", cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log("===============================================================================");
  console.log("             POSTGRESQL LIVE INTEGRATION EXECUTION SUMMARY                    ");
  console.log("===============================================================================");
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL LIVE TESTS: ${results.length}`);
  console.log(`PASS:             ${passCount}`);
  console.log(`FAIL:             ${failCount}`);
  console.log("===============================================================================\n");

  if (failCount > 0) process.exit(1);
}

runPostgresDashboardLiveTests();
