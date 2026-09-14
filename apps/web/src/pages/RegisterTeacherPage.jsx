import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  ArrowLeft,
  CheckCircle2,
  BadgeCheck,
  Building,
} from "lucide-react";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function RegisterTeacherPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    teacherCode: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.fullName.trim()) {
      setErrorMsg("Vui lòng nhập Họ và tên.");
      return;
    }
    if (!form.email.trim()) {
      setErrorMsg("Vui lòng nhập Email.");
      return;
    }
    if (!form.password) {
      setErrorMsg("Vui lòng nhập Mật khẩu.");
      return;
    }
    if (form.password.length < 6) {
      setErrorMsg("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      if (form.teacherCode.trim()) payload.teacherCode = form.teacherCode.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();

      const res = await api.post("/auth/register-teacher", payload);
      setCreatedInfo(res.data.data);
      setIsSuccess(true);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Digital Exam Grading
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Đăng ký tài khoản dành cho Giáo viên bộ môn & Giám thị
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          {isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Gửi yêu cầu đăng ký thành công!
              </h2>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-900 space-y-2">
                <div className="flex items-start gap-2 font-medium">
                  <BadgeCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Tài khoản của bạn đang chờ Quản trị viên phê duyệt.</span>
                </div>
                <p className="text-xs text-amber-800">
                  Sau khi Quản trị viên duyệt tài khoản, bạn sẽ có thể đăng nhập bằng email{" "}
                  <strong>{createdInfo?.email}</strong> và mật khẩu đã tạo.
                </p>
                {createdInfo?.teacherCode && (
                  <p className="text-xs text-amber-800">
                    Mã giáo viên được cấp: <strong>{createdInfo.teacherCode}</strong>
                  </p>
                )}
              </div>

              <div className="pt-3">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => navigate("/login")}
                >
                  Quay lại trang Đăng nhập
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Đăng ký tài khoản Giáo viên
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Điền đầy đủ thông tin bên dưới để gửi yêu cầu phê duyệt
                  </p>
                </div>
                <Link
                  to="/login"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Đăng nhập
                </Link>
              </div>

              {errorMsg && (
                <div className="mb-5">
                  <Alert type="danger" message={errorMsg} />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="teacher@school.edu.vn"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Row: Teacher Code & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mã giáo viên <span className="text-xs text-slate-400 font-normal">(tùy chọn)</span>
                    </label>
                    <input
                      type="text"
                      name="teacherCode"
                      value={form.teacherCode}
                      onChange={handleChange}
                      placeholder="Để trống để tự tạo (GV...)"
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Số điện thoại <span className="text-xs text-slate-400 font-normal">(tùy chọn)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="0912345678"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Ít nhất 6 ký tự"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Xác nhận mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Nhập lại mật khẩu"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={loading}
                    className="w-full justify-center py-2.5 text-sm font-semibold shadow-md shadow-blue-500/20"
                  >
                    Gửi yêu cầu đăng ký
                  </Button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Đã có tài khoản được duyệt?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Đăng nhập tại đây
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Digital Exam Grading System &bull; Hệ thống chấm thi và quản lý kỳ thi
        </p>
      </div>
    </div>
  );
}
