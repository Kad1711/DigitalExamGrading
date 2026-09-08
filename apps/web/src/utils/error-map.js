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
  DUPLICATE_SUBMISSION_IMAGE:
    "Ảnh bài thi này đã được chấm trước đó cho kỳ thi này.",
  SUBMISSION_NOT_FOUND:
    "Không tìm thấy kết quả bài nộp trong hệ thống.",
  SUBMISSION_ACCESS_DENIED:
    "Bạn không có quyền truy cập bài nộp này.",
  SUBMISSION_REVIEW_NOT_ALLOWED:
    "Kỳ thi đã lưu trữ, không thể chỉnh sửa duyệt bài.",
  CANNOT_OVERRIDE_RESOLVED_QUESTION:
    "Không thể can thiệp câu hỏi đã được nhận diện rõ ràng.",
  DUPLICATE_REVIEW_OVERRIDE:
    "Trùng lặp câu hỏi trong danh sách duyệt bài.",
  INVALID_OVERRIDE_ANSWER:
    "Đáp án hoặc phương án xác nhận không hợp lệ.",
  INVALID_REVIEW_RESOLUTION:
    "Loại xác nhận duyệt bài không hợp lệ.",
  INVALID_STUDENT_NUMBER:
    "Số báo danh phải bao gồm đúng 6 chữ số.",
  SUBMISSION_IMAGE_NOT_FOUND:
    "Không tìm thấy file ảnh gốc của bài nộp.",
  SUBMISSION_REVIEW_CROP_NOT_FOUND:
    "Không tìm thấy ảnh cắt vùng làm bài của câu hỏi.",
  NO_RESULTS_TO_PUBLISH:
    "Kỳ thi chưa có bài nộp nào được chấm để công bố.",
  NO_FINAL_RESULTS:
    "Kỳ thi chưa có bài nộp nào ở trạng thái hoàn tất (FINAL).",
  PROVISIONAL_SUBMISSIONS_EXIST:
    "Còn bài nộp chưa được duyệt hoàn tất (PROVISIONAL).",
  UNCONFIRMED_IDENTITIES_EXIST:
    "Còn bài nộp chưa được xác nhận số báo danh.",
  DUPLICATE_STUDENT_NUMBERS_EXIST:
    "Phát hiện số báo danh bị trùng lặp giữa các bài nộp.",
  PUBLISHED_RESULTS_INCONSISTENT:
    "Dữ liệu bài thi không đồng nhất để xuất kết quả chính thức.",
  RESULTS_PUBLISHED_LOCKED:
    "Kết quả kỳ thi đã được công bố. Không thể can thiệp chỉnh sửa bài nộp.",
  RESULTS_ALREADY_PUBLISHED:
    "Kết quả kỳ thi này đã được công bố trước đó.",
  RESULTS_NOT_PUBLISHED:
    "Kết quả kỳ thi chưa được công bố. Chỉ có thể xuất sau khi đã công bố.",
  STUDENT_PROFILE_NOT_FOUND:
    "Tài khoản học sinh chưa được liên kết với hồ sơ học sinh.",
  STUDENT_RESULT_NOT_AVAILABLE:
    "Kết quả chưa được công bố hoặc không tồn tại.",
  RESULT_IDENTITY_CONFLICT:
    "Không thể xác định duy nhất kết quả của bạn. Vui lòng liên hệ giáo viên.",
  EXAM_CANDIDATE_NOT_FOUND:
    "Không tìm thấy thông tin thí sinh trong kỳ thi.",
  EXAM_CANDIDATE_DUPLICATE_STUDENT:
    "Học sinh này đã được gán số báo danh trong kỳ thi.",
  EXAM_CANDIDATE_DUPLICATE_NUMBER:
    "Số báo danh này đã được cấp cho một học sinh khác trong kỳ thi.",
  EXAM_CANDIDATE_ACCESS_DENIED:
    "Bạn không có quyền quản lý thí sinh của kỳ thi này.",
  ANALYTICS_DATA_INCONSISTENT:
    "Dữ liệu bài thi không đồng nhất để tổng hợp thống kê.",
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
