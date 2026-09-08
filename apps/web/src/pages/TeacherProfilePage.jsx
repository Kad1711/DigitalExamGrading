import React, { useState, useEffect } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import {
  User,
  Phone,
  Mail,
  Shield,
  KeyRound,
  Save,
  Lock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { formatUserRole, formatUserStatus, getInitials } from "../utils/enum-map";

export default function TeacherProfilePage() {
  const { user, updateUser } = useAuth();

  // Profile data
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileAlert, setProfileAlert] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Form password
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordAlert, setPasswordAlert] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await api.get("/profile");
        const data = res.data.data;
        setProfile(data);
        setFullName(data.fullName || "");
        setPhone(data.phone || "");
      } catch (err) {
        setProfileAlert({
          type: "danger",
          message:
            err.response?.data?.error?.message ||
            "Không thể tải thông tin hồ sơ cá nhân.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // Submit Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileAlert(null);

    if (!fullName.trim()) {
      setProfileAlert({
        type: "danger",
        message: "Họ và tên không được để trống.",
      });
      return;
    }

    try {
      setSavingProfile(true);
      const res = await api.patch("/profile", {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });

      const updated = res.data.data;
      setProfile((prev) => ({ ...prev, ...updated }));

      // Đồng bộ ngay lập tức với AuthContext để Header đổi tên không cần reload
      updateUser({
        fullName: updated.fullName,
        teacher: {
          ...(user?.teacher || {}),
          fullName: updated.fullName,
          phone: updated.phone,
        },
      });

      setProfileAlert({
        type: "success",
        message: "Đã cập nhật hồ sơ.",
      });
    } catch (err) {
      setProfileAlert({
        type: "danger",
        message:
          err.response?.data?.error?.message ||
          "Không thể cập nhật hồ sơ. Vui lòng thử lại.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Change Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordAlert(null);

    if (!passwordForm.currentPassword) {
      setPasswordAlert({
        type: "danger",
        message: "Vui lòng nhập mật khẩu hiện tại.",
      });
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordAlert({
        type: "danger",
        message: "Vui lòng nhập mật khẩu mới.",
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordAlert({
        type: "danger",
        message: "Mật khẩu mới phải có ít nhất 8 ký tự.",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordAlert({
        type: "danger",
        message: "Mật khẩu xác nhận không khớp.",
      });
      return;
    }

    try {
      setPasswordLoading(true);
      await api.post("/profile/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordAlert({
        type: "success",
        message: "Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới.",
      });
    } catch (err) {
      setPasswordAlert({
        type: "danger",
        message:
          err.response?.data?.error?.message ||
          "Đổi mật khẩu không thành công. Vui lòng kiểm tra lại mật khẩu hiện tại.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const displayName = fullName || profile?.fullName || user?.fullName || "Giáo viên";
  const initials = getInitials(displayName, profile?.email || user?.email);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Hồ sơ giáo viên
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý thông tin cá nhân và bảo mật tài khoản giáo viên.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">
              Đang tải thông tin hồ sơ...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ===================================================== */}
            {/* HERO CARD: Profile Summary & Avatar Initials */}
            {/* ===================================================== */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Large Initials Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-md shadow-blue-500/20 shrink-0">
                  {initials}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900 truncate">
                      {displayName}
                    </h2>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5">
                      <Badge variant="blue" size="sm">
                        {formatUserRole(profile?.role || user?.role)}
                      </Badge>
                      <Badge variant="green" size="sm">
                        {formatUserStatus(profile?.status || user?.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">Mã GV:</span>
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold">
                        {profile?.teacherCode || "—"}
                      </span>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{profile?.email || user?.email}</span>
                    </span>

                    {profile?.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{profile.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column layout for forms on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ===================================================== */}
              {/* CARD 1: EDIT PROFILE FORM */}
              {/* ===================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col">
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Thông tin tài khoản
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cập nhật họ tên và số điện thoại liên hệ.
                    </p>
                  </div>
                </div>

                {profileAlert && (
                  <Alert
                    variant={profileAlert.type}
                    className="mb-5"
                    onClose={() => setProfileAlert(null)}
                  >
                    {profileAlert.message}
                  </Alert>
                )}

                <form onSubmit={handleProfileSubmit} className="space-y-4 flex-1">
                  {/* Editable: Full Name */}
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Họ và tên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      disabled={savingProfile}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn An"
                      className="block w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>

                  {/* Editable: Phone */}
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Số điện thoại
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      disabled={savingProfile}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901234567"
                      className="block w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>

                  {/* Read-Only Fields Container with Notice */}
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Liên hệ quản trị viên nếu cần thay đổi các thông tin dưới đây.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Read-only: Teacher Code */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Mã giáo viên
                        </label>
                        <input
                          type="text"
                          disabled
                          value={profile?.teacherCode || ""}
                          className="block w-full px-3 py-2 text-xs font-mono bg-slate-100/80 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                        />
                      </div>

                      {/* Read-only: Email */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Email đăng nhập
                        </label>
                        <input
                          type="text"
                          disabled
                          value={profile?.email || ""}
                          className="block w-full px-3 py-2 text-xs font-mono bg-slate-100/80 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Read-only: Role */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Vai trò
                        </label>
                        <input
                          type="text"
                          disabled
                          value={formatUserRole(profile?.role)}
                          className="block w-full px-3 py-2 text-xs bg-slate-100/80 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                        />
                      </div>

                      {/* Read-only: Status */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Trạng thái
                        </label>
                        <input
                          type="text"
                          disabled
                          value={formatUserStatus(profile?.status)}
                          className="block w-full px-3 py-2 text-xs bg-slate-100/80 border border-slate-200 rounded-lg text-slate-600 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      icon={Save}
                      loading={savingProfile}
                    >
                      {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* ===================================================== */}
              {/* CARD 2: CHANGE PASSWORD FORM */}
              {/* ===================================================== */}
              <div
                id="change-password"
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col"
              >
                <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Đổi mật khẩu
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bảo mật tài khoản với mật khẩu mới tối thiểu 8 ký tự.
                    </p>
                  </div>
                </div>

                {passwordAlert && (
                  <Alert
                    variant={passwordAlert.type}
                    className="mb-5"
                    onClose={() => setPasswordAlert(null)}
                  >
                    {passwordAlert.message}
                  </Alert>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4 flex-1">
                  {/* Current Password */}
                  <div>
                    <label
                      htmlFor="currentPassword"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Mật khẩu hiện tại <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        required
                        disabled={passwordLoading}
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            currentPassword: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                        className="block w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label={
                          showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        required
                        disabled={passwordLoading}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            newPassword: e.target.value,
                          })
                        }
                        placeholder="Tối thiểu 8 ký tự"
                        className="block w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label={
                          showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                    >
                      Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      type={showNewPassword ? "text" : "password"}
                      required
                      disabled={passwordLoading}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Nhập lại mật khẩu mới"
                      className="block w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      icon={Lock}
                      loading={passwordLoading}
                    >
                      {passwordLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
