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
    "Kỳ thi này hiện chưa thể chấm bài (chỉ hỗ trợ kỳ thi ở trạng thái PUBLISHED).",
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
