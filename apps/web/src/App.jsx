import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import RequireRole from "./components/RequireRole";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterTeacherPage = lazy(() => import("./pages/RegisterTeacherPage"));
const GradingPage = lazy(() => import("./pages/GradingPage"));
const ExamListPage = lazy(() => import("./pages/ExamListPage"));
const ExamCreatePage = lazy(() => import("./pages/ExamCreatePage"));
const ExamDetailPage = lazy(() => import("./pages/ExamDetailPage"));
const ExamSubmissionsPage = lazy(() => import("./pages/ExamSubmissionsPage"));
const AdminTeacherListPage = lazy(() => import("./pages/AdminTeacherListPage"));
const TeacherProfilePage = lazy(() => import("./pages/TeacherProfilePage"));
const TeacherClassesPage = lazy(() => import("./pages/TeacherClassesPage"));
const StudentExamsPage = lazy(() => import("./pages/StudentExamsPage"));
const StudentResultsPage = lazy(() => import("./pages/StudentResultsPage"));
const StudentResultDetailPage = lazy(() => import("./pages/StudentResultDetailPage"));
const ExamAnalyticsPage = lazy(() => import("./pages/ExamAnalyticsPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));

// Role groups for route protection
const ALL_STAFF_ROLES = ["ADMIN", "TEACHER", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_BOARD", "ACADEMIC_BOARD"];
const EXAM_CREATOR_ROLES = ["ADMIN", "TEACHER", "EXAM_BOARD"];
const GRADING_ROLES = ["ADMIN", "TEACHER", "EXAM_BOARD"];
const MANAGEMENT_VIEW_ROLES = ["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_BOARD", "ACADEMIC_BOARD"];

function PageLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-500">Đang tải dữ liệu...</p>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (user.role === "STUDENT") return <Navigate to="/student/exams" replace />;
  // All staff roles (TEACHER, PRINCIPAL, VICE_PRINCIPAL, EXAM_BOARD, ACADEMIC_BOARD) go to /exams
  return <Navigate to="/exams" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register-teacher" element={<RegisterTeacherPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <RequireRole roles={["ADMIN"]}>
                <AdminDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/teachers"
            element={
              <RequireRole roles={["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"]}>
                <AdminTeacherListPage />
              </RequireRole>
            }
          />

          {/* User Profile & Security — all authenticated users */}
          <Route
            path="/profile"
            element={
              <RequireRole roles={["TEACHER", "STUDENT", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_BOARD", "ACADEMIC_BOARD"]}>
                <TeacherProfilePage />
              </RequireRole>
            }
          />

          {/* Classes & Students — all staff */}
          <Route
            path="/classes"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <TeacherClassesPage />
              </RequireRole>
            }
          />

          {/* Exam & Grading Routes */}
          <Route
            path="/exams"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <ExamListPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/new"
            element={
              <RequireRole roles={EXAM_CREATOR_ROLES}>
                <ExamCreatePage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <ExamDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/submissions"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <ExamSubmissionsPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/analytics"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <ExamAnalyticsPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/:slug"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <ExamDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/grade"
            element={
              <RequireRole roles={GRADING_ROLES}>
                <GradingPage />
              </RequireRole>
            }
          />
          <Route
            path="/submissions/:submissionId"
            element={
              <RequireRole roles={ALL_STAFF_ROLES}>
                <GradingPage />
              </RequireRole>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/exams"
            element={
              <RequireRole roles={["STUDENT"]}>
                <StudentExamsPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/results"
            element={
              <RequireRole roles={["STUDENT"]}>
                <StudentResultsPage />
              </RequireRole>
            }
          />
          <Route
            path="/student/results/:examId"
            element={
              <RequireRole roles={["STUDENT"]}>
                <StudentResultDetailPage />
              </RequireRole>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
