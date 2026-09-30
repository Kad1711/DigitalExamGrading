import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit Test Suite for Teaching Assignment Consistency
 * Verifies business logic, contracts, filtering, and state transitions
 * without requiring external DB connection.
 */

// 1. Logic for listClasses mapping & academic year filter
function mapClassesDTO(classes) {
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    gradeId: c.gradeId,
    gradeName: c.grade?.name,
    gradeLevel: c.grade?.level,
    academicYearId: c.academicYearId,
    academicYearName: c.academicYear?.name,
    studentCount: c._count?.enrollments ?? 0,
    examCount: c._count?.exams ?? 0,
    assignedTeacherIds: (c.assignments || []).map((a) => a.teacherId),
    assignedTeachers: (c.assignments || []).map((a) => a.teacher?.fullName).filter(Boolean),
    assignments: (c.assignments || []).filter(
      (a) => !c.academicYearId || !a.academicYearId || a.academicYearId === c.academicYearId
    ),
    createdAt: c.createdAt,
  }));
}

// 2. Logic for getAssignmentForSubject (from ExamCreatePage)
function getAssignmentForSubject({ cls, subjectId, selectedSubjectObj, subjects }) {
  if (!cls?.assignments || !Array.isArray(cls.assignments)) return null;

  // 1. Ưu tiên đối chiếu ID môn học chuẩn và xác minh cùng năm học
  if (subjectId) {
    const idMatch = cls.assignments.find((a) => {
      if (a.subjectId !== subjectId) return false;
      if (cls.academicYearId && a.academicYearId && a.academicYearId !== cls.academicYearId) {
        return false;
      }
      return true;
    });
    if (idMatch) return idMatch;
  }

  // 2. Chỉ fallback theo mã môn khi thực sự cần và mã môn là duy nhất trong danh mục
  if (selectedSubjectObj?.code) {
    const codeMatchingSubjects = subjects.filter((s) => s.code === selectedSubjectObj.code);
    if (codeMatchingSubjects.length === 1) {
      const codeMatch = cls.assignments.find((a) => {
        const aCode = a.subject?.code || a.subjectCode;
        if (aCode !== selectedSubjectObj.code) return false;
        if (cls.academicYearId && a.academicYearId && a.academicYearId !== cls.academicYearId) {
          return false;
        }
        return true;
      });
      if (codeMatch) return codeMatch;
    }
  }

  return null;
}

// 3. Logic for updateTeacherAssignments calculation (from admin-teacher.service.js)
function calculateAssignmentDiff({
  currentAssignmentsForTargetSubject,
  targetSubjectId,
  validClassIds,
  removeOtherSubjects,
  allTeacherAssignments,
}) {
  const currentClassIds = currentAssignmentsForTargetSubject.map((a) => a.classId);
  const toAdd = validClassIds.filter((cid) => !currentClassIds.includes(cid));
  const toRemove = currentAssignmentsForTargetSubject.filter((a) => !validClassIds.includes(a.classId));

  let finalAssignments = [...allTeacherAssignments];

  if (removeOtherSubjects) {
    finalAssignments = finalAssignments.filter((a) => a.subjectId === targetSubjectId);
  }

  if (toRemove.length > 0) {
    const removeIds = new Set(toRemove.map((r) => r.id));
    finalAssignments = finalAssignments.filter((a) => !removeIds.has(a.id));
  }

  for (const cid of toAdd) {
    finalAssignments = finalAssignments.filter(
      (a) => !(a.classId === cid && a.subjectId === targetSubjectId)
    );
    finalAssignments.push({
      id: `new_${cid}_${targetSubjectId}`,
      classId: cid,
      subjectId: targetSubjectId,
    });
  }

  return { toAdd, toRemove, finalAssignments };
}

test("Teaching Assignment Consistency Suite", async (t) => {
  await t.test("1. mapClassesDTO preserves assignments and strictly filters by class academicYearId", () => {
    const mockClasses = [
      {
        id: "cls_9A",
        name: "9A",
        gradeId: "gr_9",
        academicYearId: "ay_2026",
        grade: { id: "gr_9", name: "Khối 9", level: 9 },
        academicYear: { id: "ay_2026", name: "2026-2027" },
        _count: { enrollments: 35, exams: 2 },
        assignments: [
          {
            id: "as_1",
            teacherId: "t_chieu",
            subjectId: "sub_it",
            academicYearId: "ay_2026",
            teacher: { id: "t_chieu", fullName: "Nguyễn Thị Bích Chiêu", title: "Giáo viên" },
            subject: { id: "sub_it", name: "Tin học", code: "TINHOC" },
          },
          {
            id: "as_old",
            teacherId: "t_old",
            subjectId: "sub_it",
            academicYearId: "ay_2025", // Prior year assignment
            teacher: { id: "t_old", fullName: "Cựu Giáo Viên", title: "Giáo viên" },
            subject: { id: "sub_it", name: "Tin học", code: "TINHOC" },
          },
        ],
      },
    ];

    const result = mapClassesDTO(mockClasses);
    assert.equal(result.length, 1);
    const cls = result[0];

    assert.ok(Array.isArray(cls.assignments), "assignments must be an array");
    assert.equal(cls.assignments.length, 1, "Must exclude stale prior academic year assignment");
    assert.equal(cls.assignments[0].id, "as_1");
    assert.equal(cls.assignments[0].teacher.fullName, "Nguyễn Thị Bích Chiêu");
    assert.equal(cls.assignments[0].subject.code, "TINHOC");
  });

  await t.test("2. getAssignmentForSubject prioritizes ID and enforces matching academic year", () => {
    const subjects = [
      { id: "sub_it_id", name: "Tin học", code: "TINHOC" },
      { id: "sub_math_id", name: "Toán", code: "TOAN" },
    ];

    const cls = {
      id: "cls_9D",
      name: "9D",
      academicYearId: "ay_2026",
      assignments: [
        {
          id: "as_9d_it",
          teacherId: "t_chieu",
          subjectId: "sub_it_id",
          academicYearId: "ay_2026",
          teacher: { id: "t_chieu", fullName: "Nguyễn Thị Bích Chiêu", title: "Giáo viên" },
          subject: { id: "sub_it_id", name: "Tin học", code: "TINHOC" },
        },
      ],
    };

    // Correct subject ID
    const match = getAssignmentForSubject({
      cls,
      subjectId: "sub_it_id",
      selectedSubjectObj: subjects[0],
      subjects,
    });
    assert.ok(match, "Must find matching assignment by ID");
    assert.equal(match.teacher.fullName, "Nguyễn Thị Bích Chiêu");

    // Unassigned subject (Math)
    const noMatch = getAssignmentForSubject({
      cls,
      subjectId: "sub_math_id",
      selectedSubjectObj: subjects[1],
      subjects,
    });
    assert.equal(noMatch, null, "Must return null for unassigned subject");
  });

  await t.test("3. getAssignmentForSubject rejects cross-academic-year assignments even if ID matches", () => {
    const subjects = [{ id: "sub_it_id", name: "Tin học", code: "TINHOC" }];

    const cls = {
      id: "cls_9D",
      name: "9D",
      academicYearId: "ay_2026",
      assignments: [
        {
          id: "as_9d_old",
          teacherId: "t_old",
          subjectId: "sub_it_id",
          academicYearId: "ay_2025", // Different year!
          teacher: { id: "t_old", fullName: "Giáo Viên Năm Ngoái" },
        },
      ],
    };

    const match = getAssignmentForSubject({
      cls,
      subjectId: "sub_it_id",
      selectedSubjectObj: subjects[0],
      subjects,
    });
    assert.equal(match, null, "Must reject assignment belonging to a different academic year");
  });

  await t.test("4. getAssignmentForSubject fallback by code only triggers if code is unique", () => {
    const duplicateCodeSubjects = [
      { id: "sub_it_1", name: "Tin học 1", code: "TINHOC" },
      { id: "sub_it_2", name: "Tin học 2", code: "TINHOC" },
    ];

    const cls = {
      id: "cls_9D",
      name: "9D",
      academicYearId: "ay_2026",
      assignments: [
        {
          id: "as_9d_it",
          teacherId: "t_chieu",
          subjectId: "other_id", // ID does not match
          academicYearId: "ay_2026",
          subject: { code: "TINHOC" },
        },
      ],
    };

    // When code is duplicated in catalog, fallback is aborted to prevent ambiguous matches
    const match = getAssignmentForSubject({
      cls,
      subjectId: "sub_it_1",
      selectedSubjectObj: duplicateCodeSubjects[0],
      subjects: duplicateCodeSubjects,
    });
    assert.equal(match, null, "Must abort fallback if subject code is not unique");
  });

  await t.test("5. Multi-subject assignment: saving Subject A preserves Subject B with removeOtherSubjects: false", () => {
    const teacherId = "t_chieu";
    const subjectA = "sub_tinhoc";
    const subjectB = "sub_toan";

    // Teacher currently teaches 9D, 9E in Tin học AND 9A in Toán
    const allAssignments = [
      { id: "as_1", teacherId, classId: "cls_9D", subjectId: subjectA },
      { id: "as_2", teacherId, classId: "cls_9E", subjectId: subjectA },
      { id: "as_3", teacherId, classId: "cls_9A", subjectId: subjectB },
    ];

    const currentAssignmentsForSubjectA = allAssignments.filter((a) => a.subjectId === subjectA);

    // User edits Tin học: removes 9E, adds 9B => selected: [cls_9D, cls_9B]
    const diff = calculateAssignmentDiff({
      currentAssignmentsForTargetSubject: currentAssignmentsForSubjectA,
      targetSubjectId: subjectA,
      validClassIds: ["cls_9D", "cls_9B"],
      removeOtherSubjects: false, // Must be false!
      allTeacherAssignments: allAssignments,
    });

    assert.equal(diff.toAdd.length, 1);
    assert.equal(diff.toAdd[0], "cls_9B");

    assert.equal(diff.toRemove.length, 1);
    assert.equal(diff.toRemove[0].classId, "cls_9E");

    // Verify final state: Subject B (9A) is completely intact!
    const subjectBAssignments = diff.finalAssignments.filter((a) => a.subjectId === subjectB);
    assert.equal(subjectBAssignments.length, 1);
    assert.equal(subjectBAssignments[0].classId, "cls_9A");

    // Subject A now has 9D and 9B
    const subjectAAssignments = diff.finalAssignments.filter((a) => a.subjectId === subjectA);
    assert.equal(subjectAAssignments.length, 2);
    assert.deepEqual(subjectAAssignments.map((a) => a.classId).sort(), ["cls_9B", "cls_9D"].sort());
  });

  await t.test("6. Multi-subject assignment: unchecking ALL classes of Subject A deletes only Subject A assignments", () => {
    const teacherId = "t_chieu";
    const subjectA = "sub_tinhoc";
    const subjectB = "sub_toan";

    const allAssignments = [
      { id: "as_1", teacherId, classId: "cls_9D", subjectId: subjectA },
      { id: "as_2", teacherId, classId: "cls_9E", subjectId: subjectA },
      { id: "as_3", teacherId, classId: "cls_9A", subjectId: subjectB },
    ];

    const currentAssignmentsForSubjectA = allAssignments.filter((a) => a.subjectId === subjectA);

    // User unchecks ALL classes of Tin học => selected: []
    const diff = calculateAssignmentDiff({
      currentAssignmentsForTargetSubject: currentAssignmentsForSubjectA,
      targetSubjectId: subjectA,
      validClassIds: [],
      removeOtherSubjects: false,
      allTeacherAssignments: allAssignments,
    });

    assert.equal(diff.toAdd.length, 0);
    assert.equal(diff.toRemove.length, 2, "Both 9D and 9E should be queued for removal");

    // Subject B remains intact
    const subjectBAssignments = diff.finalAssignments.filter((a) => a.subjectId === subjectB);
    assert.equal(subjectBAssignments.length, 1);
    assert.equal(subjectBAssignments[0].classId, "cls_9A");

    // Subject A has 0 assignments left
    const subjectAAssignments = diff.finalAssignments.filter((a) => a.subjectId === subjectA);
    assert.equal(subjectAAssignments.length, 0);
  });
});
