import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import RequireRole from "./components/RequireRole";
import LoginPage from "./pages/LoginPage";
import GradingPage from "./pages/GradingPage";
import ExamListPage from "./pages/ExamListPage";
import ExamCreatePage from "./pages/ExamCreatePage";
import ExamDetailPage from "./pages/ExamDetailPage";
import ExamSubmissionsPage from "./pages/ExamSubmissionsPage";
import AdminTeacherListPage from "./pages/AdminTeacherListPage";
import TeacherProfilePage from "./pages/TeacherProfilePage";
import TeacherClassesPage from "./pages/TeacherClassesPage";
import StudentResultsPage from "./pages/StudentResultsPage";
import StudentResultDetailPage from "./pages/StudentResultDetailPage";
import ExamAnalyticsPage from "./pages/ExamAnalyticsPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin/dashboard" replace />;
  if (user.role === "STUDENT") return <Navigate to="/student/results" replace />;
  return <Navigate to="/exams" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

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
              <RequireRole roles={["ADMIN"]}>
                <AdminTeacherListPage />
              </RequireRole>
            }
          />

          {/* Teacher Profile */}
          <Route
            path="/profile"
            element={
              <RequireRole roles={["TEACHER"]}>
                <TeacherProfilePage />
              </RequireRole>
            }
          />

          {/* Teacher Classes & Students */}
          <Route
            path="/classes"
            element={
              <RequireRole roles={["TEACHER"]}>
                <TeacherClassesPage />
              </RequireRole>
            }
          />

          {/* Teacher Exam & Grading Routes */}
          <Route
            path="/exams"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamListPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/new"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamCreatePage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/submissions"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamSubmissionsPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/analytics"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamAnalyticsPage />
              </RequireRole>
            }
          />
          <Route
            path="/exams/:examId/:slug"
            element={
              <RequireRole roles={["TEACHER"]}>
                <ExamDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/grade"
            element={
              <RequireRole roles={["TEACHER"]}>
                <GradingPage />
              </RequireRole>
            }
          />
          <Route
            path="/submissions/:submissionId"
            element={
              <RequireRole roles={["TEACHER"]}>
                <GradingPage />
              </RequireRole>
            }
          />

          {/* Student Routes */}
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
      </BrowserRouter>
    </AuthProvider>
  );
}
