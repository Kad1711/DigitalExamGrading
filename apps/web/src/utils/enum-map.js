/**
 * Centralized Vietnamese display mappings for domain enums.
 *
 * NOTE: Backend enum values and API contracts remain unchanged.
 * This helper ensures consistent, professional terminology across teacher-facing UI.
 */

export const EXAM_STATUS_LABELS = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã phát hành",
  CLOSED: "Đã đóng",
  ARCHIVED: "Đã lưu trữ",
};

export const SCORING_TYPE_LABELS = {
  EQUAL: "Chia đều điểm",
  CUSTOM: "Điểm tùy chỉnh",
};

export const GRADING_STATUS_LABELS = {
  FINAL: "Chính thức",
  PROVISIONAL: "Tạm tính",
  NEEDS_REVIEW: "Cần kiểm tra",
};

export const OMR_STATUS_LABELS = {
  MARKED: "Đã tô",
  BLANK: "Để trống",
  MULTIPLE: "Tô nhiều ô",
  UNCERTAIN: "Cần kiểm tra",
  MULTIPLE_INVALID: "Tô nhiều ô / Không hợp lệ",
};

export const USER_ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
};

export const USER_STATUS_LABELS = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Không hoạt động",
};

/**
 * Format ExamStatus enum to Vietnamese string
 * @param {string} status - DRAFT | PUBLISHED | CLOSED | ARCHIVED
 * @returns {string} Localized label
 */
export function formatExamStatus(status) {
  return EXAM_STATUS_LABELS[status] || status || "—";
}

/**
 * Format ScoringType enum to Vietnamese string
 * @param {string} scoringType - EQUAL | CUSTOM
 * @returns {string} Localized label
 */
export function formatScoringType(scoringType) {
  return SCORING_TYPE_LABELS[scoringType] || scoringType || "—";
}

/**
 * Format GradingStatus enum to Vietnamese string
 * @param {string} status - FINAL | PROVISIONAL | NEEDS_REVIEW
 * @returns {string} Localized label
 */
export function formatGradingStatus(status) {
  return GRADING_STATUS_LABELS[status] || status || "—";
}

/**
 * Format OMR status for single question
 * @param {string} status - MARKED | BLANK | MULTIPLE | UNCERTAIN
 * @returns {string} Localized label
 */
export function formatOmrStatus(status) {
  return OMR_STATUS_LABELS[status] || status || "—";
}

/**
 * Format UserRole enum to Vietnamese string
 * @param {string} role - ADMIN | TEACHER | STUDENT
 * @returns {string} Localized label
 */
export function formatUserRole(role) {
  return USER_ROLE_LABELS[role] || role || "—";
}

/**
 * Format UserStatus enum to Vietnamese string
 * @param {string} status - ACTIVE | LOCKED | INACTIVE
 * @returns {string} Localized label
 */
export function formatUserStatus(status) {
  return USER_STATUS_LABELS[status] || status || "—";
}

/**
 * Get Initials Avatar text from Full Name or Email
 * e.g., "Nguyễn Văn An" -> "NA", "teacher@digitalexam.local" -> "TE"
 * @param {string} fullName
 * @param {string} email
 * @returns {string} 2-character initials
 */
export function getInitials(fullName, email) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email && email.trim()) {
    const namePart = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    return (namePart.slice(0, 2) || "U").toUpperCase();
  }
  return "U";
}
