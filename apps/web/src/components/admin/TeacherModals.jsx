import React from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Alert from "../ui/Alert";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export default function TeacherModals({
  // Create Modal
  isCreateOpen,
  setIsCreateOpen,
  createForm,
  setCreateForm,
  handleCreateSubmit,
  showCreatePassword,
  setShowCreatePassword,
  handleSubjectChange,

  // Edit Modal
  isEditOpen,
  setIsEditOpen,
  editForm,
  setEditForm,
  handleEditSubmit,
  subjects = [],

  // Reset Password Modal
  isResetPasswordOpen,
  setIsResetPasswordOpen,
  resetForm,
  setResetForm,
  handleConfirmResetPassword,
  showResetPassword,
  setShowResetPassword,

  // Lock Modal
  isLockOpen,
  setIsLockOpen,
  handleConfirmLock,

  // Unlock Modal
  isUnlockOpen,
  setIsUnlockOpen,
  handleConfirmUnlock,

  // Delete Modal
  isDeleteOpen,
  setIsDeleteOpen,
  deleteConfirmText,
  setDeleteConfirmText,
  handleConfirmDelete,

  // Bulk Delete Modal
  isBulkDeleteOpen,
  setIsBulkDeleteOpen,
  selectedLockedTeacherIds,
  handleBulkDeleteLocked,

  // Approve Modal
  isApproveOpen,
  setIsApproveOpen,
  handleConfirmApprove,

  // Reject Modal
  isRejectOpen,
  setIsRejectOpen,
  handleConfirmReject,

  // Shared state
  selectedTeacher,
  modalLoading,
  modalError,
}) {
  return (
    <>
      {/* ===================================================== */}
      {/* MODAL 1: CREATE TEACHER                               */}
      {/* ===================================================== */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !modalLoading && setIsCreateOpen(false)}
        title="Tạo tài khoản giáo viên"
        description="Nhập thông tin tài khoản để cấp quyền cho giáo viên truy cập hệ thống."
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="create-teacher-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="create-teacher-form"
          onSubmit={handleCreateSubmit}
          className="space-y-4"
        >
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900">Vai trò hệ thống:</span>
            <Badge variant="blue" size="sm">
              Giáo viên (Bắt buộc)
            </Badge>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={createForm.fullName}
              onChange={(e) =>
                setCreateForm({ ...createForm, fullName: e.target.value })
              }
              placeholder="Ví dụ: Nguyễn Văn An"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Môn giảng dạy <span className="text-xs text-blue-600 font-normal">(Chuẩn hóa mã GV)</span>
            </label>
            <select
              disabled={modalLoading}
              value={createForm.subject || ""}
              onChange={(e) => handleSubjectChange ? handleSubjectChange(e.target.value) : setCreateForm({ ...createForm, subject: e.target.value })}
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="">-- Chọn môn để tự động tạo mã chuẩn (hoặc tự nhập) --</option>
              <option value="TOAN">Toán (GVTOAN...)</option>
              <option value="NGUVAN">Ngữ văn (GVVAN...)</option>
              <option value="TIENGANH">Tiếng Anh (GVANH...)</option>
              <option value="VATLY">Vật lý (GVLY...)</option>
              <option value="HOAHOC">Hóa học (GVHOA...)</option>
              <option value="SINHHOC">Sinh học (GVSINH...)</option>
              <option value="LICHSU">Lịch sử (GVSU...)</option>
              <option value="DIALY">Địa lý (GVDIA...)</option>
              <option value="TINHOC">Tin học (GVTIN...)</option>
              <option value="GDKTPL">Giáo dục KT & PL / GDCD (GVGDCD...)</option>
              <option value="CONGNGHE">Công nghệ (GVCN...)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mã giáo viên <span className="text-rose-500">*</span>
                </label>
                {createForm.subject && (
                  <button
                    type="button"
                    onClick={() => handleSubjectChange && handleSubjectChange(createForm.subject)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium cursor-pointer hover:underline"
                    title="Lấy lại mã tăng tiến tự động mới nhất theo môn"
                  >
                    Lấy mã tự động
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                disabled={modalLoading}
                value={createForm.teacherCode}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    teacherCode: e.target.value.toUpperCase(),
                  })
                }
                placeholder="GVHOA01"
                className="block w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Mã tăng tiến tự động (GVHOA01, GVHOA02...)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                disabled={modalLoading}
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
                placeholder="0901234567"
                className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              disabled={modalLoading}
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              placeholder="giaovien@school.edu.vn"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu ban đầu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  required
                  disabled={modalLoading}
                  value={createForm.initialPassword}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      initialPassword: e.target.value,
                    })
                  }
                  placeholder="Tối thiểu 8 ký tự"
                  className="block w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCreatePassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Xác nhận mật khẩu <span className="text-rose-500">*</span>
              </label>
              <input
                type={showCreatePassword ? "text" : "password"}
                required
                disabled={modalLoading}
                value={createForm.confirmPassword}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Nhập lại mật khẩu"
                className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 2: EDIT TEACHER                                 */}
      {/* ===================================================== */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => !modalLoading && setIsEditOpen(false)}
        title="Chỉnh sửa thông tin giáo viên"
        description="Cập nhật thông tin định danh và liên hệ của giáo viên."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="edit-teacher-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="edit-teacher-form"
          onSubmit={handleEditSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={editForm.fullName}
              onChange={(e) =>
                setEditForm({ ...editForm, fullName: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã giáo viên
            </label>
            <input
              type="text"
              required
              disabled={modalLoading}
              value={editForm.teacherCode}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  teacherCode: e.target.value.toUpperCase(),
                })
              }
              className="block w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập
            </label>
            <input
              type="email"
              required
              disabled={modalLoading}
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Số điện thoại
            </label>
            <input
              type="tel"
              disabled={modalLoading}
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chức danh chuyên môn
            </label>
            <select
              disabled={modalLoading}
              value={editForm.title || "Giáo viên"}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="Giáo viên">Giáo viên</option>
              <option value="Giáo viên chính">Giáo viên chính</option>
              <option value="Giáo viên cao cấp">Giáo viên cao cấp</option>
              <option value="Tổ trưởng bộ môn">Tổ trưởng bộ môn</option>
              <option value="Tổ phó bộ môn">Tổ phó bộ môn</option>
              <option value="Giáo viên kiêm nhiệm">Giáo viên kiêm nhiệm</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Môn chuyên môn chính
            </label>
            <select
              disabled={modalLoading}
              value={editForm.primarySubjectId || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, primarySubjectId: e.target.value })
              }
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all cursor-pointer"
            >
              <option value="">-- Chưa đặt môn chuyên môn --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 3: RESET PASSWORD                               */}
      {/* ===================================================== */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => !modalLoading && setIsResetPasswordOpen(false)}
        title="Đặt lại mật khẩu giáo viên"
        description={`Cập nhật mật khẩu mới cho ${selectedTeacher?.fullName || "giáo viên"}.`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetPasswordOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              variant="primary"
              loading={modalLoading}
            >
              {modalLoading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
            </Button>
          </>
        }
      >
        {modalError && (
          <Alert variant="danger" className="mb-4">
            {modalError}
          </Alert>
        )}

        <form
          id="reset-password-form"
          onSubmit={handleConfirmResetPassword}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showResetPassword ? "text" : "password"}
                required
                disabled={modalLoading}
                value={resetForm.newPassword}
                onChange={(e) =>
                  setResetForm({ ...resetForm, newPassword: e.target.value })
                }
                placeholder="Tối thiểu 8 ký tự"
                className="block w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showResetPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <input
              type={showResetPassword ? "text" : "password"}
              required
              disabled={modalLoading}
              value={resetForm.confirmPassword}
              onChange={(e) =>
                setResetForm({
                  ...resetForm,
                  confirmPassword: e.target.value,
                })
              }
              placeholder="Nhập lại mật khẩu mới"
              className="block w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
            />
          </div>
        </form>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 4: LOCK TEACHER                                 */}
      {/* ===================================================== */}
      <Modal
        isOpen={isLockOpen}
        onClose={() => !modalLoading && setIsLockOpen(false)}
        title="Xác nhận khóa tài khoản"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLockOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              onClick={handleConfirmLock}
            >
              {modalLoading ? "Đang khóa..." : "Khóa tài khoản"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Bạn có chắc chắn muốn khóa tài khoản giáo viên{" "}
            <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            Giáo viên sẽ bị đăng xuất ngay lập tức và không thể đăng nhập vào hệ thống cho tới khi được mở khóa.
          </div>
          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 5: UNLOCK TEACHER                               */}
      {/* ===================================================== */}
      <Modal
        isOpen={isUnlockOpen}
        onClose={() => !modalLoading && setIsUnlockOpen(false)}
        title="Xác nhận mở khóa tài khoản"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsUnlockOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={modalLoading}
              onClick={handleConfirmUnlock}
            >
              {modalLoading ? "Đang mở khóa..." : "Mở khóa tài khoản"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Bạn có chắc chắn muốn mở khóa cho giáo viên{" "}
            <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>?
          </p>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            Giáo viên sẽ có thể tiếp tục đăng nhập và thực hiện nhiệm vụ chấm thi bình thường.
          </div>
          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 6: DELETE TEACHER                               */}
      {/* ===================================================== */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => !modalLoading && setIsDeleteOpen(false)}
        title="Xác nhận xóa vĩnh viễn tài khoản giáo viên"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              disabled={
                modalLoading ||
                (deleteConfirmText.trim() !== selectedTeacher?.teacherCode &&
                  deleteConfirmText.trim().toUpperCase() !== "XÓA")
              }
              onClick={handleConfirmDelete}
            >
              {modalLoading ? "Đang xóa..." : "Xác nhận xóa vĩnh viễn"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <strong className="block text-sm font-bold text-rose-900 mb-1">
                Cảnh báo nguy hiểm - Bước 1:
              </strong>
              Hành động này sẽ <strong>xóa vĩnh viễn</strong> tài khoản giáo viên và các phân công giảng dạy. Dữ liệu này <strong>không thể khôi phục</strong>.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Họ và tên:</span>
              <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mã giáo viên:</span>
              <strong className="text-rose-700 font-mono">{selectedTeacher?.teacherCode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-700 font-mono">{selectedTeacher?.email}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Xác nhận an toàn - Bước 2:
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Để xác nhận, vui lòng gõ đúng mã giáo viên{" "}
              <code className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-mono font-bold">
                {selectedTeacher?.teacherCode}
              </code>{" "}
              hoặc chữ{" "}
              <code className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">
                XÓA
              </code>{" "}
              vào ô bên dưới:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Nhập ${selectedTeacher?.teacherCode || "mã giáo viên"}`}
              className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-rose-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-600 transition-all"
            />
          </div>

          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 7: BULK DELETE LOCKED TEACHERS                  */}
      {/* ===================================================== */}
      <Modal
        isOpen={isBulkDeleteOpen}
        onClose={() => !modalLoading && setIsBulkDeleteOpen(false)}
        title="Xác nhận xóa hàng loạt giáo viên đã khóa"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBulkDeleteOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              onClick={handleBulkDeleteLocked}
            >
              {modalLoading
                ? "Đang xóa..."
                : `Xác nhận xóa ${selectedLockedTeacherIds.length} giáo viên`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              Bạn đang chuẩn bị xóa vĩnh viễn{" "}
              <strong>{selectedLockedTeacherIds.length} tài khoản giáo viên</strong>{" "}
              đã bị khóa khỏi hệ thống.
            </div>
          </div>
          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 8: APPROVE TEACHER                             */}
      {/* ===================================================== */}
      <Modal
        isOpen={isApproveOpen}
        onClose={() => !modalLoading && setIsApproveOpen(false)}
        title="Xác nhận phê duyệt tài khoản giáo viên"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsApproveOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="success"
              loading={modalLoading}
              onClick={handleConfirmApprove}
            >
              {modalLoading ? "Đang xử lý..." : "Xác nhận phê duyệt"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 leading-relaxed">
              Bạn có chắc chắn muốn phê duyệt tài khoản cho giáo viên{" "}
              <strong>{selectedTeacher?.fullName}</strong>? Sau khi duyệt, giáo viên có thể đăng nhập ngay vào hệ thống.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Họ và tên:</span>
              <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mã giáo viên:</span>
              <strong className="text-blue-700 font-mono">{selectedTeacher?.teacherCode}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-700 font-mono">{selectedTeacher?.email}</span>
            </div>
          </div>

          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* ===================================================== */}
      {/* MODAL 9: REJECT TEACHER                              */}
      {/* ===================================================== */}
      <Modal
        isOpen={isRejectOpen}
        onClose={() => !modalLoading && setIsRejectOpen(false)}
        title="Từ chối yêu cầu đăng ký giáo viên"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsRejectOpen(false)}
              disabled={modalLoading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={modalLoading}
              onClick={handleConfirmReject}
            >
              {modalLoading ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              Bạn có chắc chắn muốn từ chối yêu cầu của{" "}
              <strong>{selectedTeacher?.fullName}</strong>? Yêu cầu đăng ký sẽ bị loại bỏ khỏi hệ thống.
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Họ và tên:</span>
              <strong className="text-slate-900">{selectedTeacher?.fullName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-700 font-mono">{selectedTeacher?.email}</span>
            </div>
          </div>

          {modalError && (
            <Alert variant="danger" className="text-xs">
              {modalError}
            </Alert>
          )}
        </div>
      </Modal>
    </>
  );
}
