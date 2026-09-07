import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GradingPage from "./pages/GradingPage";

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/grade"
          element={
            <PrivateRoute>
              <GradingPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/grade" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
