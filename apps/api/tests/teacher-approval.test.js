import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import * as authService from "../src/services/auth.service.js";
import * as adminTeacherService from "../src/services/admin-teacher.service.js";

describe("Teacher Registration and Admin Approval Flow", () => {
  const testEmail = `teacher.pending.${Date.now()}@test.local`;
  const testPassword = "Password@123456";
  let teacherRecord = null;

  after(async () => {
    // Cleanup
    try {
      const u = await prisma.user.findUnique({ where: { email: testEmail } });
      if (u) {
        await prisma.teacher.deleteMany({ where: { userId: u.id } });
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
      }
    } catch {
      // Ignore
    }
  });

  test("1. Self-register teacher creates user with PENDING_APPROVAL status", async () => {
    const res = await authService.registerTeacher({
      fullName: "Nguyễn Thầy Giáo Mới",
      email: testEmail,
      phone: "0901234567",
      password: testPassword,
    });

    assert.ok(res.id);
    assert.equal(res.email, testEmail);
    assert.equal(res.status, "PENDING_APPROVAL");
    assert.ok(res.teacherCode.startsWith("GV"));

    const dbTeacher = await prisma.teacher.findUnique({
      where: { teacherCode: res.teacherCode },
      include: { user: true },
    });
    assert.ok(dbTeacher);
    assert.equal(dbTeacher.user.status, "PENDING_APPROVAL");
    teacherRecord = dbTeacher;
  });

  test("2. Logging in with PENDING_APPROVAL account is blocked", async () => {
    await assert.rejects(
      async () => {
        await authService.login(testEmail, testPassword);
      },
      (err) => {
        assert.equal(err.code, "ACCOUNT_PENDING_APPROVAL");
        assert.match(err.message, /chờ Quản trị viên phê duyệt/i);
        return true;
      }
    );
  });

  test("3. Admin approves teacher account -> status becomes ACTIVE", async () => {
    const res = await adminTeacherService.approveTeacher(teacherRecord.id);
    assert.equal(res.status, "ACTIVE");

    const updatedUser = await prisma.user.findUnique({
      where: { id: teacherRecord.userId },
    });
    assert.equal(updatedUser.status, "ACTIVE");
  });

  test("4. Teacher can successfully login after admin approval", async () => {
    const loginRes = await authService.login(testEmail, testPassword);
    assert.ok(loginRes.accessToken);
    assert.ok(loginRes.refreshToken);
    assert.equal(loginRes.user.email, testEmail);
    assert.equal(loginRes.user.status, "ACTIVE");
    assert.equal(loginRes.user.role, "TEACHER");
  });

  test("5. Admin rejects a pending teacher -> deletes user completely", async () => {
    const rejectEmail = `reject.${Date.now()}@test.local`;
    const regRes = await authService.registerTeacher({
      fullName: "Giáo Viên Bị Từ Chối",
      email: rejectEmail,
      password: testPassword,
    });

    const dbTeacher = await prisma.teacher.findUnique({
      where: { teacherCode: regRes.teacherCode },
    });
    assert.ok(dbTeacher);

    const rejectRes = await adminTeacherService.rejectTeacher(dbTeacher.id);
    assert.ok(rejectRes.message);

    const checkUser = await prisma.user.findUnique({
      where: { email: rejectEmail },
    });
    assert.equal(checkUser, null);
  });
});
