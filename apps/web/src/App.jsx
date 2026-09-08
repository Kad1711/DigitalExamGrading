import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import RequireRole from "./components/RequireRole";
import LoginPage from "./pages/LoginPage";
import GradingPage from "./pages/GradingPage";
import ExamListPage from "./pages/ExamListPage";
import ExamCreatePage from "./pages/ExamCreatePage";
import ExamDetailPage from "./pages/ExamDetailPage";
import AdminTeacherListPage from "./pages/AdminTeacherListPage";
import TeacherProfilePage from "./pages/TeacherProfilePage";

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin/teachers" replace />;
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

          {/* Fallback route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
