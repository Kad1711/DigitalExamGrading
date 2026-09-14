import React from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { Sparkles, Eye, EyeOff } from "lucide-react";

export function AddStudentModal({
  isOpen,
  onClose,
  selectedClass,
  studentsCount,
  studentCode,
  setStudentCode,
  studentFullName,
  setStudentFullName,
  studentDob,
  setStudentDob,
  studentEmail,
  setStudentEmail,
  studentPassword,
  setStudentPassword,
  addingStudent,
  addStudentError,
  setAddStudentError,
  onSubmit,
  getSuggestedSbd,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Thêm học sinh vào lớp ${selectedClass?.name || ""}`}
      description="Nhập thông tin học sinh để lưu vào danh sách và cấp tài khoản tra cứu."
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={addingStudent}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            loading={addingStudent}
          >
            {addingStudent ? "Đang lưu..." : "Thêm vào lớp"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        {addStudentError && (
          <Alert variant="danger" onClose={() => setAddStudentError("")}>
            {addStudentError}
          </Alert>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Số báo danh (SBD 6 số) / Mã học sinh <span className="text-rose-500">*</span>
            </label>
            {selectedClass && getSuggestedSbd && (
              <button
                type="button"
                onClick={() =>
                  setStudentCode(
                    getSuggestedSbd(
                      selectedClass.name,
                      selectedClass.gradeLevel,
                      studentsCount + 1
                    )
                  )
                }
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Gợi ý SBD chuẩn ({getSuggestedSbd(selectedClass.name, selectedClass.gradeLevel, studentsCount + 1)})
              </button>
            )}
          </div>
          <input
            type="text"
            required
            autoFocus
            disabled={addingStudent}
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            placeholder="Ví dụ: 090601 (Chuẩn 6 số: Khối + Lớp + STT)"
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
          />
          <span className="text-[11px] text-slate-400 block mt-1">
            Định dạng 6 số chuẩn phiếu tô OMR: 2 số Khối + 2 số Lớp + 2 số STT (Ví dụ: <strong>090601</strong> cho Lớp 9C06, học sinh 01).
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Họ và tên học sinh <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={addingStudent}
            value={studentFullName}
            onChange={(e) => setStudentFullName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn An"
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Ngày sinh (Tùy chọn)
          </label>
          <input
            type="date"
            disabled={addingStudent}
            value={studentDob}
            onChange={(e) => setStudentDob(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Email đăng nhập (Tùy chọn)
          </label>
          <input
            type="email"
            disabled={addingStudent}
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            placeholder="Để trống hệ thống sẽ tự sinh: [Lớp]_[SBD]@digitalexam.edu.vn"
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Mật khẩu khởi tạo
          </label>
          <input
            type="text"
            disabled={addingStudent}
            value={studentPassword}
            onChange={(e) => setStudentPassword(e.target.value)}
            placeholder="Mặc định: 123456"
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
          />
          <span className="text-[11px] text-slate-400 block mt-1">
            Mật khẩu mặc định: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold">123456</code> (giáo viên có thể xem và ẩn/hiện bằng icon mắt).
          </span>
        </div>
      </form>
    </Modal>
  );
}

export function EditStudentModal({
  studentToEdit,
  onClose,
  editStudentCode,
  setEditStudentCode,
  editStudentFullName,
  setEditStudentFullName,
  editStudentDob,
  setEditStudentDob,
  editStudentEmail,
  setEditStudentEmail,
  editStudentPassword,
  setEditStudentPassword,
  showEditPassword,
  setShowEditPassword,
  updatingStudent,
  editStudentError,
  setEditStudentError,
  onSubmit,
}) {
  return (
    <Modal
      isOpen={Boolean(studentToEdit)}
      onClose={onClose}
      title={`Chỉnh sửa học sinh: ${studentToEdit?.fullName || ""}`}
      description="Cập nhật Mã học sinh, Họ tên, Ngày sinh hoặc Email tra cứu."
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={updatingStudent}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            loading={updatingStudent}
          >
            {updatingStudent ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        {editStudentError && (
          <Alert variant="danger" onClose={() => setEditStudentError("")}>
            {editStudentError}
          </Alert>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Mã học sinh / Số báo danh <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            disabled={updatingStudent}
            value={editStudentCode}
            onChange={(e) => setEditStudentCode(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Họ và tên học sinh <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={updatingStudent}
            value={editStudentFullName}
            onChange={(e) => setEditStudentFullName(e.target.value)}
            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ngày sinh
            </label>
            <input
              type="date"
              disabled={updatingStudent}
              value={editStudentDob}
              onChange={(e) => setEditStudentDob(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email tra cứu (Tùy chọn)
            </label>
            <input
              type="email"
              disabled={updatingStudent}
              value={editStudentEmail}
              onChange={(e) => setEditStudentEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Mật khẩu đăng nhập
          </label>
          <div className="relative">
            <input
              type={showEditPassword ? "text" : "password"}
              disabled={updatingStudent}
              value={editStudentPassword}
              onChange={(e) => setEditStudentPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới nếu muốn thay đổi (Mặc định: 123456)"
              className="w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowEditPassword(!showEditPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              title={showEditPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Mật khẩu dùng để học sinh đăng nhập vào cổng tra cứu điểm thi.
          </p>
        </div>
      </form>
    </Modal>
  );
}
