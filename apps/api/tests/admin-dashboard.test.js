import test from "node:test";
import assert from "node:assert/strict";
import * as adminDashboardService from "../src/services/admin-dashboard.service.js";

test("Admin Dashboard System Statistics Test Suite", async (t) => {
  await t.test("1. getAdminSystemDashboard returns complete and valid structure", async () => {
    const data = await adminDashboardService.getAdminSystemDashboard();

    assert.ok(data, "Dashboard data must not be null");

    // Overview counters
    assert.ok(data.overview, "Must have overview");
    assert.equal(typeof data.overview.teachers.total, "number");
    assert.equal(typeof data.overview.teachers.active, "number");
    assert.equal(typeof data.overview.teachers.locked, "number");
    assert.equal(typeof data.overview.students.total, "number");
    assert.equal(typeof data.overview.students.enrolled, "number");
    assert.equal(typeof data.overview.classes.total, "number");
    assert.ok(data.overview.academicYear, "Must report academic year");
    assert.equal(typeof data.overview.exams.total, "number");
    assert.equal(typeof data.overview.submissions.total, "number");
    assert.equal(typeof data.overview.scoring.averageScore, "number");
    assert.ok(data.overview.scoring.distribution, "Must have score distribution");

    // Tier statistics (THCS & THPT)
    assert.ok(data.tierStats, "Must have tierStats");
    assert.equal(typeof data.tierStats.thcs.students, "number");
    assert.equal(typeof data.tierStats.thcs.classes, "number");
    assert.equal(typeof data.tierStats.thpt.students, "number");
    assert.equal(typeof data.tierStats.thpt.classes, "number");

    // Grade breakdown includes THCS & THPT levels
    assert.ok(Array.isArray(data.grades), "Must have grades array");
    const levels = data.grades.map((g) => g.level);
    assert.ok(levels.includes(6), "Must include Khối 6");
    assert.ok(levels.includes(9), "Must include Khối 9");
    assert.ok(levels.includes(12), "Must include Khối 12");

    // Subjects
    assert.ok(Array.isArray(data.subjects), "Must have subjects array");

    // OMR Stats
    assert.ok(data.omrStats, "Must have omrStats");
    assert.equal(typeof data.omrStats.correct, "number");
    assert.equal(typeof data.omrStats.incorrect, "number");
    assert.equal(typeof data.omrStats.blank, "number");
    assert.equal(typeof data.omrStats.unresolved, "number");
    assert.equal(typeof data.omrStats.total, "number");

    // Recent items & System Health
    assert.ok(Array.isArray(data.recentExams), "Must have recentExams array");
    assert.ok(Array.isArray(data.recentSubmissions), "Must have recentSubmissions array");
    assert.ok(Array.isArray(data.topTeachers), "Must have topTeachers array");
    assert.ok(data.systemHealth, "Must have systemHealth");
    assert.equal(data.systemHealth.status, "HEALTHY");
    assert.equal(data.systemHealth.dbStatus, "CONNECTED");
  });

  await t.test("2. RBAC protection: non-ADMIN role is strictly denied", async () => {
    const { authorizeRoles } = await import("../src/middlewares/role.middleware.js");
    const adminOnlyMiddleware = authorizeRoles("ADMIN");

    const teacherReq = { user: { role: "TEACHER" } };
    const studentReq = { user: { role: "STUDENT" } };
    const adminReq = { user: { role: "ADMIN" } };

    let teacherErr = null;
    adminOnlyMiddleware(teacherReq, {}, (err) => {
      teacherErr = err;
    });
    assert.ok(teacherErr, "Teacher must be rejected");
    assert.equal(teacherErr.statusCode, 403);
    assert.equal(teacherErr.code, "FORBIDDEN");

    let studentErr = null;
    adminOnlyMiddleware(studentReq, {}, (err) => {
      studentErr = err;
    });
    assert.ok(studentErr, "Student must be rejected");
    assert.equal(studentErr.statusCode, 403);
    assert.equal(studentErr.code, "FORBIDDEN");

    let adminErr = null;
    let adminNextCalled = false;
    adminOnlyMiddleware(adminReq, {}, (err) => {
      adminErr = err;
      adminNextCalled = true;
    });
    assert.ok(!adminErr, "No error should be passed for ADMIN");
    assert.equal(adminNextCalled, true, "Admin must be authorized");
  });
});
