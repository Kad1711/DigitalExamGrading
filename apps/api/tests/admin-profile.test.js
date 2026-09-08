import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../src/config/prisma.js";
import * as adminTeacherService from "../src/services/admin-teacher.service.js";
import * as profileService from "../src/services/profile.service.js";
import * as authService from "../src/services/auth.service.js";
import { authenticate } from "../src/middlewares/auth.middleware.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";

// Helper to simulate Express middleware invocation
function runMiddleware(middleware, req, res = {}) {
  return new Promise((resolve) => {
    let errResult = null;
    let nextCalled = false;
    const next = (err) => {
      if (err) errResult = err;
      nextCalled = true;
      resolve({ err: errResult, nextCalled });
    };
    middleware(req, res, next);
  });
}

test("Admin Teacher Management & Teacher Profile - Phase 5.5 Test Suite", async (t) => {
  const timestamp = Date.now();
  const testEmail = `teacher_test_${timestamp}@school.local`;
  const testCode = `TCH_${timestamp.toString().slice(-6)}`;
  let createdTeacher = null;

  // Cleanup helper
  t.after(async () => {
    if (createdTeacher?.userId) {
      await prisma.refreshToken.deleteMany({ where: { userId: createdTeacher.userId } });
      await prisma.teacher.deleteMany({ where: { userId: createdTeacher.userId } });
      await prisma.user.deleteMany({ where: { id: createdTeacher.userId } });
    }
  });

  // Test 1: Admin creates Teacher successfully with forced role TEACHER
  await t.test("1. Admin creates teacher: role is strictly TEACHER, status is ACTIVE, password hashed", async () => {
    createdTeacher = await adminTeacherService.createTeacher({
      fullName: "Nguyễn Văn Test",
      teacherCode: testCode,
      email: testEmail,
      initialPassword: "InitialPassword@123",
      phone: "0901234567",
    });

    assert.ok(createdTeacher.id);
    assert.equal(createdTeacher.fullName, "Nguyễn Văn Test");
    assert.equal(createdTeacher.teacherCode, testCode);
    assert.equal(createdTeacher.email, testEmail);
    assert.equal(createdTeacher.role, "TEACHER");
    assert.equal(createdTeacher.status, "ACTIVE");
    assert.equal(createdTeacher.passwordHash, undefined, "Must not return passwordHash");

    // Verify directly in DB
    const dbUser = await prisma.user.findUnique({ where: { id: createdTeacher.userId } });
    assert.equal(dbUser.role, "TEACHER");
    assert.equal(dbUser.status, "ACTIVE");
    const isPwMatch = await bcrypt.compare("InitialPassword@123", dbUser.passwordHash);
    assert.equal(isPwMatch, true);
  });

  // Test 2: Privilege escalation prevention
  await t.test("2. Privilege escalation prevention: passing role: ADMIN is strictly ignored", async () => {
    const maliciousCode = `TCH_MAL_${Date.now().toString().slice(-5)}`;
    const maliciousEmail = `malicious_${Date.now()}@school.local`;

    const result = await adminTeacherService.createTeacher({
      fullName: "Hacker Attempt",
      teacherCode: maliciousCode,
      email: maliciousEmail,
      initialPassword: "Password@123",
      role: "ADMIN", // Malicious payload
    });

    assert.equal(result.role, "TEACHER", "Role must still be TEACHER");
    const dbUser = await prisma.user.findUnique({ where: { id: result.userId } });
    assert.equal(dbUser.role, "TEACHER", "DB user role must strictly be TEACHER");

    // Clean up
    await prisma.teacher.deleteMany({ where: { userId: result.userId } });
    await prisma.user.deleteMany({ where: { id: result.userId } });
  });

  // Test 3: Duplicates handling
  await t.test("3. Duplicate handling: duplicate email or teacherCode returns 409 domain error", async () => {
    // Duplicate email
    await assert.rejects(
      async () => {
        await adminTeacherService.createTeacher({
          fullName: "Another Name",
          teacherCode: `DIFF_${Date.now().toString().slice(-5)}`,
          email: testEmail, // Duplicate
          initialPassword: "Password@123",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "EMAIL_ALREADY_EXISTS");
        return true;
      }
    );

    // Duplicate teacherCode
    await assert.rejects(
      async () => {
        await adminTeacherService.createTeacher({
          fullName: "Another Name",
          teacherCode: testCode, // Duplicate
          email: `unique_${Date.now()}@school.local`,
          initialPassword: "Password@123",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "TEACHER_CODE_ALREADY_EXISTS");
        return true;
      }
    );
  });

  // Test 4: RBAC middleware protection
  await t.test("4. RBAC protection: Teacher or Student token accessing ADMIN-only middleware gets 403 FORBIDDEN", async () => {
    const teacherReq = { user: { id: createdTeacher.userId, role: "TEACHER" } };
    const authAdminMw = authorizeRoles("ADMIN");

    const result = await runMiddleware(authAdminMw, teacherReq);
    assert.ok(result.err);
    assert.equal(result.err.statusCode, 403);
    assert.equal(result.err.code, "FORBIDDEN");
  });

  // Test 4b: ADMIN token rejected on /api/profile routes (including change-password)
  await t.test("4b. RBAC protection: ADMIN token accessing /api/profile (including change-password) gets 403 FORBIDDEN", async () => {
    const adminReq = { user: { id: "admin-id", role: "ADMIN" } };
    const authTeacherMw = authorizeRoles("TEACHER");

    const result = await runMiddleware(authTeacherMw, adminReq);
    assert.ok(result.err);
    assert.equal(result.err.statusCode, 403);
    assert.equal(result.err.code, "FORBIDDEN");
  });

  // Test 5: Account Lock & Existing Token Invalidation
  await t.test("5. Account Lock: login rejected AND existing access token immediately rejected on protected routes", async () => {
    // 1. Teacher logs in and gets access token while ACTIVE
    const loginRes = await authService.login(testEmail, "InitialPassword@123");
    const activeToken = loginRes.accessToken;
    assert.ok(activeToken);

    // Verify token works through authenticate middleware
    const reqBeforeLock = { headers: { authorization: `Bearer ${activeToken}` } };
    const checkBefore = await runMiddleware(authenticate, reqBeforeLock);
    assert.equal(checkBefore.err, null);
    assert.equal(reqBeforeLock.user.email, testEmail);

    // 2. Admin locks Teacher account
    const lockRes = await adminTeacherService.lockTeacher(createdTeacher.id);
    assert.equal(lockRes.status, "LOCKED");

    // 3. New login attempt is rejected
    await assert.rejects(
      async () => {
        await authService.login(testEmail, "InitialPassword@123");
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "ACCOUNT_INACTIVE");
        return true;
      }
    );

    // 4. CRITICAL: Existing access token is NOW REJECTED immediately on protected route!
    const reqAfterLock = { headers: { authorization: `Bearer ${activeToken}` } };
    const checkAfter = await runMiddleware(authenticate, reqAfterLock);
    assert.ok(checkAfter.err);
    assert.equal(checkAfter.err.statusCode, 403);
    assert.equal(checkAfter.err.code, "ACCOUNT_INACTIVE");

    // 5. Admin unlocks Teacher account
    const unlockRes = await adminTeacherService.unlockTeacher(createdTeacher.id);
    assert.equal(unlockRes.status, "ACTIVE");

    // 6. Existing access token works again now that account is ACTIVE
    const reqAfterUnlock = { headers: { authorization: `Bearer ${activeToken}` } };
    const checkUnlock = await runMiddleware(authenticate, reqAfterUnlock);
    assert.equal(checkUnlock.err, null);
    assert.equal(reqAfterUnlock.user.status, "ACTIVE");
  });

  // Test 6: Teacher Profile Update & Sensitive fields protection
  await t.test("6. Profile Update: Teacher updates fullName/phone; sensitive fields (role, status, email, teacherCode) are unchanged", async () => {
    // Legitimate update
    const updated = await profileService.updateProfile(createdTeacher.userId, {
      fullName: "Nguyễn Văn Đã Cập Nhật",
      phone: "0987654321",
    });
    assert.equal(updated.fullName, "Nguyễn Văn Đã Cập Nhật");
    assert.equal(updated.phone, "0987654321");

    // Malicious attempt to change sensitive fields directly
    await profileService.updateProfile(createdTeacher.userId, {
      fullName: "Nguyễn Văn An Toàn",
      role: "ADMIN",
      status: "LOCKED",
      teacherCode: "HACKED_CODE",
      email: "hacked@school.local",
    });

    const dbUser = await prisma.user.findUnique({ where: { id: createdTeacher.userId } });
    const dbTeacher = await prisma.teacher.findUnique({ where: { userId: createdTeacher.userId } });

    assert.equal(dbUser.role, "TEACHER", "Role must not change via profile");
    assert.equal(dbUser.status, "ACTIVE", "Status must not change via profile");
    assert.equal(dbUser.email, testEmail, "Email must not change via profile");
    assert.equal(dbTeacher.teacherCode, testCode, "TeacherCode must not change via profile");
    assert.equal(dbTeacher.fullName, "Nguyễn Văn An Toàn");
  });

  // Test 7: Teacher Change Password
  await t.test("7. Change Password: wrong current password rejected; correct password succeeds and old password fails login", async () => {
    // 1. Wrong current password rejected
    await assert.rejects(
      async () => {
        await profileService.changePassword(createdTeacher.userId, {
          currentPassword: "WrongPassword@123",
          newPassword: "BrandNewPassword@456",
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "CURRENT_PASSWORD_INCORRECT");
        return true;
      }
    );

    // 2. Correct password changes successfully
    const changeRes = await profileService.changePassword(createdTeacher.userId, {
      currentPassword: "InitialPassword@123",
      newPassword: "BrandNewPassword@456",
    });
    assert.ok(changeRes.message);

    // 3. Old password cannot login anymore
    await assert.rejects(
      async () => {
        await authService.login(testEmail, "InitialPassword@123");
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, "INVALID_CREDENTIALS");
        return true;
      }
    );

    // 4. New password logs in successfully
    const newLoginRes = await authService.login(testEmail, "BrandNewPassword@456");
    assert.ok(newLoginRes.accessToken);
    assert.equal(newLoginRes.user.email, testEmail);
  });

  // Test 8: Admin Reset Password
  await t.test("8. Admin Reset Password: sets new password, invalidates old password, new password works", async () => {
    // Admin resets teacher password
    await adminTeacherService.resetTeacherPassword(
      createdTeacher.id,
      "AdminResetPassword@789"
    );

    // Previous password fails
    await assert.rejects(
      async () => {
        await authService.login(testEmail, "BrandNewPassword@456");
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, "INVALID_CREDENTIALS");
        return true;
      }
    );

    // New password succeeds
    const adminLoginRes = await authService.login(testEmail, "AdminResetPassword@789");
    assert.ok(adminLoginRes.accessToken);
    assert.equal(adminLoginRes.user.email, testEmail);
  });
});
