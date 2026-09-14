import React from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import {
  FileSpreadsheet,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

export default function StudentExcelImportModal({
  isOpen,
  onClose,
  selectedClass,
  previewData,
  importError,
  setImportError,
  importResult,
  importingStudents,
  analyzingFile,
  sbdMode,
  setSbdMode,
  mappingStudentCodeCol,
  setMappingStudentCodeCol,
  isSelectedCodeSerial,
  mappingDobCol,
  setMappingDobCol,
  nameMode,
  setNameMode,
  mappingFullNameCol,
  setMappingFullNameCol,
  mappingLastNameCol,
  setMappingLastNameCol,
  mappingFirstNameCol,
  setMappingFirstNameCol,
  onFileChange,
  onResetFile,
  onExecuteImport,
  getSuggestedSbd,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Import danh sách học sinh vào lớp ${selectedClass?.name || ""}`}
      description="Tải lên file Excel (.xlsx, .xls). Hệ thống tự động nhận diện và ghép cột thông minh."
      size="lg"
      footer={
        previewData ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFile}
              disabled={importingStudents}
            >
              Chọn file khác
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onExecuteImport}
              loading={importingStudents}
            >
              {importingStudents
                ? "Đang nhập dữ liệu..."
                : `Xác nhận nhập ${previewData.totalRows} học sinh`}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Đóng
          </Button>
        )
      }
    >
      <div className="space-y-5 text-xs">
        {importError && (
          <Alert variant="danger" onClose={() => setImportError("")}>
            {importError}
          </Alert>
        )}

        {importResult && (
          <Alert variant={importResult.importedCount > 0 || importResult.updatedCount > 0 ? "success" : "warning"}>
            <p className="font-semibold">{importResult.message || "Import hoàn tất!"}</p>
            <p className="mt-0.5">
              Thành công: <strong>{importResult.importedCount}</strong> học sinh mới
              {importResult.updatedCount > 0 && (
                <> &bull; Đã cập nhật lại thông tin: <strong>{importResult.updatedCount}</strong> học sinh</>
              )}
              {" "}&bull; Bỏ qua: <strong>{importResult.skippedCount}</strong> (không đổi).
            </p>
            {importResult.errors?.length > 0 && (
              <div className="mt-2.5 text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 max-h-36 overflow-y-auto font-mono text-[11px] space-y-1">
                <div className="font-bold text-rose-800 uppercase tracking-wider text-[10px]">
                  Chi tiết các dòng bị lỗi ({importResult.errors.length}):
                </div>
                {importResult.errors.map((err, i) => (
                  <div key={i} className="leading-snug">{err}</div>
                ))}
              </div>
            )}
          </Alert>
        )}

        {/* STEP 1: Upload File */}
        {!previewData && (
          <div className="space-y-4">
            <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all block text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  Kéo thả hoặc bấm để chọn file Excel
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  Hỗ trợ định dạng .xlsx và .xls (Tối đa 10MB)
                </span>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={onFileChange}
                className="hidden"
                disabled={analyzingFile}
              />
            </label>

            {analyzingFile && (
              <div className="flex items-center justify-center gap-2 py-4 text-blue-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium text-xs">Đang quét và nhận diện cấu trúc file Excel...</span>
              </div>
            )}

            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-amber-800 text-[11px] leading-relaxed">
              <strong>Hỗ trợ file Excel không chuẩn:</strong> File tải về từ vnEdu, SMAS hoặc file trường có nhiều dòng tiêu đề ở trên, tách cột <em>Họ và tên đệm</em> + <em>Tên</em> hệ thống đều tự động nhận diện và gộp chuẩn xác!
            </div>
          </div>
        )}

        {/* STEP 2: Preview & Column Mapping Form */}
        {previewData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 p-3 rounded-lg text-blue-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold">Đã nhận diện tiêu đề tại Dòng {previewData.headerRowIndex}</span>
                  <span className="text-[11px] text-blue-700 block mt-0.5">
                    Tổng số {previewData.totalRows} dòng dữ liệu học sinh được phát hiện.
                  </span>
                </div>
              </div>
            </div>

            {/* Column Mapping Controls */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Cấu hình ánh xạ cột
              </h4>

              {/* SBD / Student Code Mode Selector */}
              <div className="space-y-2 pb-3 border-b border-slate-200">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Phương thức tạo Số báo danh / Mã HS <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      sbdMode === "AUTO"
                        ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sbdMode"
                      checked={sbdMode === "AUTO"}
                      onChange={() => setSbdMode("AUTO")}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>Tự động sinh SBD chuẩn</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                          Khuyên dùng
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Tự tạo SBD 6 số dạng: <strong className="text-blue-700 font-mono">{getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, 1)}</strong>, <strong className="text-blue-700 font-mono">{getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, 2)}</strong>... Tự động tránh trùng mã giữa các lớp khi file chỉ có cột Số thứ tự (1, 2, 3...).
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      sbdMode === "COLUMN"
                        ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sbdMode"
                      checked={sbdMode === "COLUMN"}
                      onChange={() => setSbdMode("COLUMN")}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        Lấy từ cột trong file Excel
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Dành cho trường đã có cột Mã học sinh / Mã định danh riêng biệt (ví dụ mã 10 chữ số của Bộ GD&ĐT).
                      </p>
                    </div>
                  </label>
                </div>

                {sbdMode === "COLUMN" && (
                  <div className="pt-2 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Chọn cột chứa Số báo danh / Mã HS <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mappingStudentCodeCol}
                      onChange={(e) => setMappingStudentCodeCol(e.target.value)}
                      className="w-full sm:w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn cột SBD / Mã HS --</option>
                      {previewData.headers.map((h) => (
                        <option key={h.colIndex} value={h.colIndex}>
                          Cột {h.colIndex}: {h.headerName}
                        </option>
                      ))}
                    </select>

                    {isSelectedCodeSerial && (
                      <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Cảnh báo trùng lặp:</strong> Cột bạn chọn ({previewData?.headers?.find((h) => String(h.colIndex) === String(mappingStudentCodeCol))?.headerName}) dường như là <em>Số thứ tự trong lớp (1, 2, 3...)</em>.
                          <br />
                          Mỗi học sinh trong hệ thống là duy nhất toàn trường. Nếu các lớp khác cũng dùng số thứ tự 1, 2, 3... sẽ bị báo lỗi trùng lặp mã.
                          <br />
                          <span className="font-bold text-blue-700">Giải pháp tốt nhất:</span> Hãy chọn tùy chọn <strong>"Tự động sinh SBD chuẩn"</strong> ở trên để hệ thống tự cấp SBD dạng <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono font-bold text-blue-800">{getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, 1)}</code>.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DOB & Name Formats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cột Ngày sinh (Tùy chọn)
                  </label>
                  <select
                    value={mappingDobCol}
                    onChange={(e) => setMappingDobCol(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Không có ngày sinh --</option>
                    {previewData.headers.map((h) => (
                      <option key={h.colIndex} value={h.colIndex}>
                        Cột {h.colIndex}: {h.headerName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name Mode Selection */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Định dạng cột Họ tên <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="nameMode"
                      checked={nameMode === "SINGLE"}
                      onChange={() => setNameMode("SINGLE")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs">1 cột Họ và tên gộp chung</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="nameMode"
                      checked={nameMode === "SPLIT"}
                      onChange={() => setNameMode("SPLIT")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs">Tách 2 cột (Họ đệm + Tên)</span>
                  </label>
                </div>

                {nameMode === "SINGLE" ? (
                  <div>
                    <select
                      value={mappingFullNameCol}
                      onChange={(e) => setMappingFullNameCol(e.target.value)}
                      className="w-full sm:w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn cột Họ và tên --</option>
                      {previewData.headers.map((h) => (
                        <option key={h.colIndex} value={h.colIndex}>
                          Cột {h.colIndex}: {h.headerName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <select
                        value={mappingLastNameCol}
                        onChange={(e) => setMappingLastNameCol(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Chọn cột Họ và đệm --</option>
                        {previewData.headers.map((h) => (
                          <option key={h.colIndex} value={h.colIndex}>
                            Cột {h.colIndex}: {h.headerName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={mappingFirstNameCol}
                        onChange={(e) => setMappingFirstNameCol(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Chọn cột Tên --</option>
                        {previewData.headers.map((h) => (
                          <option key={h.colIndex} value={h.colIndex}>
                            Cột {h.colIndex}: {h.headerName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Xem trước dữ liệu mẫu (5 dòng đầu)
                </h4>
                {sbdMode === "AUTO" && (
                  <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    SBD tự sinh theo lớp: <strong className="font-mono">{getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, 1)}</strong>, <strong className="font-mono">{getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, 2)}</strong>...
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-48">
                <table className="w-full text-left text-[11px] border-collapse bg-white">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 w-10 text-center text-slate-400">Dòng</th>
                      {sbdMode === "AUTO" && (
                        <th className="py-2 px-2.5 font-semibold text-blue-700 bg-blue-50/80 whitespace-nowrap">
                          SBD tự sinh ({selectedClass?.name})
                        </th>
                      )}
                      {previewData.headers.map((h) => (
                        <th key={h.colIndex} className="py-2 px-2.5 font-semibold text-slate-700 whitespace-nowrap">
                          Cột {h.colIndex}: {h.headerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewData.previewRows.map((row, rIdx) => (
                      <tr key={row._rowNumber} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-center text-slate-400">
                          {row._rowNumber}
                        </td>
                        {sbdMode === "AUTO" && (
                          <td className="py-1.5 px-2.5 whitespace-nowrap text-blue-700 font-bold bg-blue-50/40">
                            {getSuggestedSbd(selectedClass?.name, selectedClass?.gradeLevel, rIdx + 1)}
                          </td>
                        )}
                        {previewData.headers.map((h) => (
                          <td key={h.colIndex} className="py-1.5 px-2.5 whitespace-nowrap text-slate-800">
                            {row[h.colIndex] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
