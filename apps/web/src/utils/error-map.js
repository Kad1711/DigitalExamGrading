/**
 * Centralized error mapping for Digital Exam Grading
 */

export const ERROR_MESSAGES = {
  OMR_SERVICE_UNAVAILABLE:
    "Dịch vụ nhận diện OMR hiện không hoạt động. Hãy kiểm tra FastAPI.",
  MARKERS_NOT_FOUND:
    "Không tìm thấy đủ 4 marker trên phiếu. Hãy chụp lại toàn bộ tờ giấy.",
  CORNER_MARKERS_NOT_FOUND:
    "Không tìm thấy đủ 4 marker trên phiếu. Hãy chụp lại toàn bộ tờ giấy.",
  QR_NOT_FOUND:
    "Không đọc được mã QR của phiếu. Hãy kiểm tra độ nét và vùng QR.",
  OMR_EXAM_MISMATCH:
    "Phiếu này không thuộc kỳ thi đang được chọn.",
  OMR_TEMPLATE_MISMATCH:
    "Phiếu này không khớp với mẫu phiếu hiện tại của kỳ thi.",
  OMR_EXAM_CODE_NOT_FOUND:
    "Mã đề nhận diện được không tồn tại trong kỳ thi.",
  EXAM_CODE_UNCERTAIN:
    "Không thể xác định chắc chắn mã đề.",
  MULTI_PAGE_GRADING_NOT_SUPPORTED_YET:
    "Chế độ chấm một ảnh hiện chỉ hỗ trợ phiếu một trang.",
  IMAGE_TOO_LARGE:
    "Ảnh vượt quá dung lượng tối đa 15 MB.",
  IMAGE_TYPE_INVALID:
    "Chỉ hỗ trợ ảnh JPG hoặc PNG.",
  EXAM_NOT_AVAILABLE_FOR_GRADING:
    "Kỳ thi này hiện chưa thể chấm bài (chỉ hỗ trợ kỳ thi đã phát hành).",
  VALIDATION_ERROR:
    "Dữ liệu nhập vào chưa hợp lệ. Vui lòng kiểm tra lại các trường.",
  EXAM_NOT_FOUND:
    "Kỳ thi không tồn tại hoặc đã bị xóa.",
  EXAM_ACCESS_DENIED:
    "Bạn không có quyền truy cập hoặc chỉnh sửa kỳ thi này.",
  EXAM_NOT_DRAFT:
    "Kỳ thi không ở trạng thái Nháp nên không thể thực hiện thao tác này.",
  EXAM_FIELD_LOCKED:
    "Trường thông tin này đã bị khóa sau khi kỳ thi được phát hành.",
  EXAM_DELETE_NOT_ALLOWED:
    "Chỉ có thể xóa vĩnh viễn kỳ thi ở trạng thái Nháp.",
  EXAM_ALREADY_PUBLISHED:
    "Kỳ thi đã được phát hành.",
  EXAM_INVALID_STATUS:
    "Trạng thái kỳ thi không hợp lệ cho thao tác này.",
  EXAM_CODE_REQUIRED:
    "Kỳ thi phải có ít nhất 1 mã đề trước khi phát hành.",
  EXAM_CODE_DUPLICATE:
    "Mã đề này đã tồn tại trong kỳ thi.",
  EXAM_CODE_NOT_FOUND:
    "Mã đề không tồn tại.",
  EXAM_CODE_NOT_OMR_COMPATIBLE:
    "Mã đề OMR phải là các chữ số từ 0-9 và tối đa 3 chữ số.",
  ANSWER_KEY_INCOMPLETE:
    "Các mã đề chưa có đủ đáp án hoặc tổng điểm chưa khớp với thang điểm.",
  INVALID_QUESTION_COUNT:
    "Số lượng đáp án không khớp với số câu hỏi của kỳ thi.",
  CUSTOM_SCORE_TOTAL_MISMATCH:
    "Tổng điểm các câu không bằng thang điểm tối đa của kỳ thi.",
  ANSWER_SHEET_TEMPLATE_NOT_FOUND:
    "Chưa có phiếu trả lời OMR nào được tạo cho kỳ thi này.",
  ANSWER_KEY_FILE_REQUIRED:
    "Vui lòng chọn file Excel (.xlsx) hoặc CSV để tải lên.",
  ANSWER_KEY_FILE_TYPE_INVALID:
    "Chỉ chấp nhận file định dạng .xlsx hoặc .csv.",
  ANSWER_KEY_FILE_TOO_LARGE:
    "Dung lượng file vượt quá giới hạn 5MB.",
};

export const QUALITY_WARNING_MESSAGES = {
  IMAGE_BLURRY: "Ảnh hơi mờ. Hãy giữ điện thoại ổn định và chụp lại.",
  IMAGE_TOO_DARK: "Ảnh bị tối. Hãy bật thêm đèn hoặc chụp ở nơi đủ sáng.",
  IMAGE_TOO_BRIGHT: "Ảnh bị lóa/quá sáng. Hãy tránh ánh đèn phản chiếu trực tiếp.",
  LOW_RESOLUTION: "Độ phân giải ảnh thấp, kết quả nhận diện có thể không ổn định.",
};

export function getErrorMessage(code, fallbackMessage) {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return fallbackMessage || "Có lỗi xảy ra khi chấm bài. Vui lòng thử lại.";
}

export function mapQualityWarning(warning) {
  return QUALITY_WARNING_MESSAGES[warning] || warning;
}
