import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import prisma from "../src/config/prisma.js";
import * as classService from "../src/services/class.service.js";

async function setupClassTestFixture() {
  const ts = Date.now();

  const teacher = await prisma.user.create({
    data: {
      email: `class_teacher_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `T_CLS_${ts.toString().slice(-6)}`,
          fullName: "Class Teacher",
        },
      },
    },
    include: { teacher: true },
  });

  const grade12 = await prisma.grade.findFirst({ where: { level: 12 } });

  return {
    teacher,
    grade12,
    ts,
  };
}

test("Class & Student Management Suite", async (t) => {
  const ctx = await setupClassTestFixture();

  let createdClass = null;

  await t.test("1. List available grades", async () => {
    const grades = await classService.listGrades();
    assert.ok(Array.isArray(grades));
    assert.ok(grades.length >= 3, "Must have at least 3 grades (10, 11, 12)");
  });

  await t.test("2. Create new class with valid grade", async () => {
    const className = `12_TEST_${ctx.ts.toString().slice(-4)}`;
    createdClass = await classService.createClass({
      name: className,
      gradeId: ctx.grade12.id,
      teacherUserId: ctx.teacher.id,
    });

    assert.ok(createdClass.id);
    assert.equal(createdClass.name, className);
    assert.equal(createdClass.gradeLevel, 12);
    assert.equal(createdClass.studentCount, 0);
  });

  await t.test("3. Duplicate class name in same year throws 409", async () => {
    await assert.rejects(
      async () => {
        await classService.createClass({
          name: createdClass.name,
          gradeId: ctx.grade12.id,
          teacherUserId: ctx.teacher.id,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "CLASS_ALREADY_EXISTS");
        return true;
      }
    );
  });

  await t.test("4. Manually add student to class", async () => {
    const studentCode = `HS_${ctx.ts.toString().slice(-6)}`;
    const student = await classService.addStudentToClass(createdClass.id, {
      studentCode,
      fullName: "Nguyễn Văn Kiểm Thử",
      dateOfBirth: "2008-05-20",
    });

    assert.ok(student.studentId);
    assert.equal(student.studentCode, studentCode);
    assert.equal(student.fullName, "Nguyễn Văn Kiểm Thử");

    // Verify student is enrolled
    const students = await classService.listClassStudents(createdClass.id);
    assert.equal(students.length, 1);
    assert.equal(students[0].studentCode, studentCode);
  });

  await t.test("5. Smart Excel Preview: auto-detects header row with garbage banner rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DS Lớp");

    // Row 1: School Header Banner
    ws.addRow(["SỞ GD&ĐT HÀ NỘI - TRƯỜNG THPT CHUYÊN"]);
    // Row 2: Empty line
    ws.addRow([]);
    // Row 3: Actual Header Row
    ws.addRow(["STT", "Số Báo Danh", "Họ và tên", "Ngày sinh", "Giới tính"]);
    // Row 4-6: Data rows
    ws.addRow([1, `SBD_${ctx.ts}_1`, "Lê Hoàng Nam", "15/08/2008", "Nam"]);
    ws.addRow([2, `SBD_${ctx.ts}_2`, "Trần Thị Mai", "22/11/2008", "Nữ"]);

    const buffer = await wb.xlsx.writeBuffer();

    const preview = await classService.parseExcelPreview(buffer);
    assert.equal(preview.headerRowIndex, 3, "Heuristic must correctly identify row 3 as header row");
    assert.ok(preview.detectedMapping.studentCodeCol, "Must auto-detect studentCode column");
    assert.ok(preview.detectedMapping.fullNameCol, "Must auto-detect fullName column");
    assert.equal(preview.totalRows, 2);
  });

  await t.test("6. Smart Excel Import: concatenates split Last Name and First Name columns", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DS");

    // Header row with split name
    ws.addRow(["STT", "Mã học sinh", "Họ và chữ đệm", "Tên", "Ngày sinh"]);
    ws.addRow([1, `HS_SPLIT_1_${ctx.ts.toString().slice(-4)}`, "Nguyễn Hải", "Đăng", "2008-01-10"]);
    ws.addRow([2, `HS_SPLIT_2_${ctx.ts.toString().slice(-4)}`, "Phạm Thị Thùy", "Dương", "2008-09-15"]);

    const buffer = await wb.xlsx.writeBuffer();

    const mapping = {
      headerRowIndex: 1,
      studentCodeCol: 2,
      lastNameCol: 3,
      firstNameCol: 4,
      dobCol: 5,
    };

    const importResult = await classService.importStudentsFromExcel(createdClass.id, buffer, mapping);
    assert.equal(importResult.importedCount, 2);
    assert.equal(importResult.skippedCount, 0);

    const students = await classService.listClassStudents(createdClass.id);
    const dang = students.find((s) => s.fullName === "Nguyễn Hải Đăng");
    const duong = students.find((s) => s.fullName === "Phạm Thị Thùy Dương");

    assert.ok(dang, "Must concatenate 'Nguyễn Hải' and 'Đăng'");
    assert.ok(duong, "Must concatenate 'Phạm Thị Thùy' and 'Dương'");
  });

  await t.test("7. Remove student from class", async () => {
    const studentsBefore = await classService.listClassStudents(createdClass.id);
    const targetStudent = studentsBefore[0];

    await classService.removeStudentFromClass(createdClass.id, targetStudent.studentId);

    const studentsAfter = await classService.listClassStudents(createdClass.id);
    assert.equal(studentsAfter.length, studentsBefore.length - 1);
    assert.ok(!studentsAfter.some((s) => s.studentId === targetStudent.studentId));
  });

  await t.test("8. Batch create multiple classes successfully", async () => {
    const pfx = `BATCH_${ctx.ts.toString().slice(-4)}`;
    const names = [`${pfx}_A`, `${pfx}_B`, `${pfx}_C`];

    const result = await classService.createBatchClasses({
      names,
      gradeId: ctx.grade12.id,
      teacherUserId: ctx.teacher.id,
    });

    assert.equal(result.totalCreated, 3);
    assert.equal(result.totalSkipped, 0);
    assert.equal(result.created.length, 3);
    assert.ok(result.created.some((c) => c.name === `${pfx}_A`));
  });

  await t.test("9. Batch create skips existing and creates new, throws if all exist", async () => {
    const pfx = `BATCH_${ctx.ts.toString().slice(-4)}`;
    // `${pfx}_A` already exists, `${pfx}_D` is new
    const names = [`${pfx}_A`, `${pfx}_D`];

    const result = await classService.createBatchClasses({
      names,
      gradeId: ctx.grade12.id,
      teacherUserId: ctx.teacher.id,
    });

    assert.equal(result.totalCreated, 1);
    assert.equal(result.totalSkipped, 1);
    assert.equal(result.created[0].name, `${pfx}_D`);
    assert.ok(result.skipped.includes(`${pfx}_A`));

    // When all exist
    await assert.rejects(
      () =>
        classService.createBatchClasses({
          names: [`${pfx}_A`],
          gradeId: ctx.grade12.id,
        }),
      (err) => err.code === "ALL_CLASSES_ALREADY_EXIST"
    );
  });

  await t.test("10. Update class details & reject duplicates", async () => {
    const updated = await classService.updateClass(createdClass.id, {
      name: `${createdClass.name}_RENAMED`,
    });
    assert.equal(updated.name, `${createdClass.name}_RENAMED`);

    // Duplicate check
    const pfx = `BATCH_${ctx.ts.toString().slice(-4)}`;
    await assert.rejects(
      () =>
        classService.updateClass(createdClass.id, {
          name: `${pfx}_D`,
        }),
      (err) => err.code === "CLASS_ALREADY_EXISTS"
    );
  });

  await t.test("11. Update student info & reject duplicate studentCode", async () => {
    const students = await classService.listClassStudents(createdClass.id);
    assert.ok(students.length > 0);
    const target = students[0];

    const updated = await classService.updateStudent(createdClass.id, target.studentId, {
      fullName: "Nguyễn Hải Đăng (Đã cập nhật)",
    });
    assert.equal(updated.fullName, "Nguyễn Hải Đăng (Đã cập nhật)");

    // Test duplicate studentCode if another student exists
    if (students.length > 1) {
      const other = students[1];
      await assert.rejects(
        () =>
          classService.updateStudent(createdClass.id, target.studentId, {
            studentCode: other.studentCode,
          }),
        (err) => err.code === "STUDENT_CODE_ALREADY_EXISTS"
      );
    }
  });

  await t.test("12. Vietnamese name sorting, standard email format & initialPassword", async () => {
    // Create a new class with 3 students with distinct Vietnamese names: An, Hoanh, Khải
    const cls = await classService.createClass({
      name: `SortTest_${ctx.ts.toString().slice(-4)}`,
      gradeId: ctx.grade12.id,
    });

    const s1 = await classService.addStudentToClass(cls.id, {
      studentCode: `VN_${ctx.ts}_10`,
      fullName: "Huỳnh Ngọc Thúy Hoanh",
    });
    const s2 = await classService.addStudentToClass(cls.id, {
      studentCode: `VN_${ctx.ts}_01`,
      fullName: "Trần Bảo An",
    });
    const s3 = await classService.addStudentToClass(cls.id, {
      studentCode: `VN_${ctx.ts}_11`,
      fullName: "Lê Quang Khải",
    });

    // Check emails format: className_sbd@digitalexam.edu.vn
    assert.ok(s2.email.endsWith("@digitalexam.edu.vn"));
    assert.ok(s2.email.includes("01"));
    assert.equal(s2.initialPassword, "123456");

    // Fetch class students - must be sorted An -> Hoanh -> Khải
    const list = await classService.listClassStudents(cls.id);
    assert.equal(list.length, 3);
    assert.equal(list[0].fullName, "Trần Bảo An");
    assert.equal(list[1].fullName, "Huỳnh Ngọc Thúy Hoanh");
    assert.equal(list[2].fullName, "Lê Quang Khải");
    assert.equal(list[0].initialPassword, "123456");

    // Test updating password
    const updated = await classService.updateStudent(cls.id, s2.studentId, {
      password: "NewPassword123",
    });
    assert.equal(updated.initialPassword, "NewPassword123");
  });

  await t.test("13. bulkRemoveStudentsFromClass removes selected students", async () => {
    const cls = await classService.createClass({
      name: `BulkStd_${ctx.ts.toString().slice(-4)}`,
      gradeId: ctx.grade12.id,
    });

    const s1 = await classService.addStudentToClass(cls.id, {
      studentCode: `BSTD1_${ctx.ts}`,
      fullName: "Nguyễn Văn A",
    });
    const s2 = await classService.addStudentToClass(cls.id, {
      studentCode: `BSTD2_${ctx.ts}`,
      fullName: "Nguyễn Văn B",
    });
    const s3 = await classService.addStudentToClass(cls.id, {
      studentCode: `BSTD3_${ctx.ts}`,
      fullName: "Nguyễn Văn C",
    });

    // Bulk remove s1 and s2
    const res = await classService.bulkRemoveStudentsFromClass(cls.id, [s1.studentId, s2.studentId]);
    assert.equal(res.deletedCount, 2);

    const remaining = await classService.listClassStudents(cls.id);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].studentId, s3.studentId);
  });

  await t.test("14. clearClassStudents removes all students from class", async () => {
    const cls = await classService.createClass({
      name: `ClearStd_${ctx.ts.toString().slice(-4)}`,
      gradeId: ctx.grade12.id,
    });

    await classService.addStudentToClass(cls.id, {
      studentCode: `CLR1_${ctx.ts}`,
      fullName: "Học sinh 1",
    });
    await classService.addStudentToClass(cls.id, {
      studentCode: `CLR2_${ctx.ts}`,
      fullName: "Học sinh 2",
    });

    const clearRes = await classService.clearClassStudents(cls.id);
    assert.equal(clearRes.deletedCount, 2);

    const list = await classService.listClassStudents(cls.id);
    assert.equal(list.length, 0);
  });

  await t.test("15. deleteClass and bulkDeleteClasses delete classes", async () => {
    const c1 = await classService.createClass({
      name: `Del1_${ctx.ts.toString().slice(-4)}`,
      gradeId: ctx.grade12.id,
    });
    const c2 = await classService.createClass({
      name: `Del2_${ctx.ts.toString().slice(-4)}`,
      gradeId: ctx.grade12.id,
    });

    // Delete single class
    const d1 = await classService.deleteClass(c1.id);
    assert.equal(d1.id, c1.id);

    // Bulk delete classes
    const bRes = await classService.bulkDeleteClasses([c2.id]);
    assert.equal(bRes.deletedCount, 1);
  });

  await t.test("16. generateSmartSbd creates consistent 6-digit SBD", async () => {
    assert.equal(classService.generateSmartSbd("9C06", 9, 1), "090601");
    assert.equal(classService.generateSmartSbd("12A01", 12, 5), "120105");
    assert.equal(classService.generateSmartSbd("6A", 6, 2), "060102");
    assert.equal(classService.generateSmartSbd("10A12", 10, 30), "101230");
  });

  await t.test("17. standardizeClassSbd renumbers students by Vietnamese ABC and updates emails", async () => {
    const grade9 = await prisma.grade.findFirst({ where: { level: 9 } }) || ctx.grade12;
    const stdClass = await classService.createClass({
      name: `9C06_${ctx.ts.toString().slice(-4)}`,
      gradeId: grade9.id,
    });

    try {
      await classService.addStudentToClass(stdClass.id, {
        studentCode: `OLD_Z_${ctx.ts}`,
        fullName: "Trần Văn An",
      });
      await classService.addStudentToClass(stdClass.id, {
        studentCode: `OLD_A_${ctx.ts}`,
        fullName: "Bùi Thị Bình",
      });
      await classService.addStudentToClass(stdClass.id, {
        studentCode: `OLD_M_${ctx.ts}`,
        fullName: "Đặng Hoàng Cường",
      });

      const result = await classService.standardizeClassSbd(stdClass.id);
      assert.equal(result.totalStandardized, 3);
      assert.equal(result.students.length, 3);

      // Vietnamese name sorting: An (1), Bình (2), Cường (3)
      assert.equal(result.students[0].fullName, "Trần Văn An");
      assert.equal(result.students[0].newSbd.slice(-2), "01");
      assert.equal(result.students[0].email, classService.makeStudentEmail(stdClass.name, result.students[0].newSbd));

      assert.equal(result.students[1].fullName, "Bùi Thị Bình");
      assert.equal(result.students[1].newSbd.slice(-2), "02");

      assert.equal(result.students[2].fullName, "Đặng Hoàng Cường");
      assert.equal(result.students[2].newSbd.slice(-2), "03");

      // Check DB persistence
      const updatedStudents = await classService.listClassStudents(stdClass.id);
      assert.equal(updatedStudents[0].studentCode, result.students[0].newSbd);
    } finally {
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { classId: stdClass.id },
        include: { student: true },
      });
      for (const e of enrollments) {
        await prisma.studentEnrollment.delete({ where: { id: e.id } }).catch(() => {});
        if (e.student?.userId) {
          await prisma.user.delete({ where: { id: e.student.userId } }).catch(() => {});
        } else if (e.studentId) {
          await prisma.student.delete({ where: { id: e.studentId } }).catch(() => {});
        }
      }
      await classService.deleteClass(stdClass.id).catch(() => {});
    }
  });
});
