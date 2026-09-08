import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");

      const user = await login(email, password);

      // Chuyen huong theo vai tro
      const from = location.state?.from?.pathname;
      if (from && from !== "/login") {
        navigate(from, { replace: true });
        return;
      }

      if (user.role === "ADMIN") {
        navigate("/admin/teachers", { replace: true });
      } else if (user.role === "TEACHER") {
        navigate("/exams", { replace: true });
      } else if (user.role === "STUDENT") {
        navigate("/student/results", { replace: true });
      } else {
        setErrorMsg("Vai trò tài khoản không hợp lệ.");
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        "Đăng nhập không thành công. Vui lòng kiểm tra lại email và mật khẩu.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Digital Exam Grading
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hệ thống chấm thi trắc nghiệm OMR & Quản lý kỳ thi
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Đăng nhập</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dành cho Giáo viên và Quản trị viên nhà trường
            </p>
          </div>

          {errorMsg && (
            <Alert variant="danger" className="mb-5" onClose={() => setErrorMsg("")}>
              {errorMsg}
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Email đăng nhập
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu.vn"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Mật khẩu
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full"
              >
                {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
              </Button>
            </div>
          </form>

          {/* Quick Login Helper Box (CHỈ HIỂN THỊ Ở MÔI TRƯỜNG PHÁT TRIỂN / DEVELOPMENT) */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Tài khoản mẫu phát triển (DEV Only)
                </span>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono">
                  DEV
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill("teacher@digitalexam.local", "Teacher@123456")
                  }
                  className="text-left p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                    Giáo viên
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    teacher@...
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill("admin@digitalexam.local", "Admin@123456")
                  }
                  className="text-left p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                    Quản trị
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    admin@...
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill("student@digitalexam.local", "Student@123456")
                  }
                  className="text-left p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">
                    Học sinh
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    student@...
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          Digital Exam Grading System &bull; Khóa luận tốt nghiệp
        </div>
      </div>
    </div>
  );
}
