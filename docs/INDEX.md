# MỤC LỤC TÀI LIỆU HỆ THỐNG QUẢN LÝ KỲ THI & CHẤM ĐIỂM OMR

Chỉ mục tra cứu nhanh tài liệu kiến trúc, kiểm toán, lịch sử khắc phục lỗi và các báo cáo kiểm chứng của hệ thống.

---

## 1. Kiến trúc hệ thống
- [Kiến trúc THCS V2](file:///d:/Learning_AI/DigitalExamGrading/docs/architecture/THCS_V2_ARCHITECTURE.md) (`docs/architecture/THCS_V2_ARCHITECTURE.md`)
  *Tài liệu thiết kế kiến trúc chuẩn THCS: mô hình phân quyền (Principal, Vice Principal, Subject Leader, Teacher, Exam Officer), chuẩn hóa danh mục môn học, luồng duyệt đề và phê duyệt kết quả.*

---

## 2. Báo cáo kiểm toán & Đánh giá hiện trạng
- [Báo cáo Kiểm toán Toàn diện Hiện trạng](file:///d:/Learning_AI/DigitalExamGrading/docs/audits/CURRENT_SYSTEM_AUDIT.md) (`docs/audits/CURRENT_SYSTEM_AUDIT.md`)
  *Báo cáo phát hiện các lỗ hổng P0/P1 trong xử lý bài nộp, trùng lặp TOCTOU, điểm số và phân quyền RBAC.*
- [Báo cáo Tái kiểm tra Độc lập](file:///d:/Learning_AI/DigitalExamGrading/docs/audits/INDEPENDENT_RECHECK.md) (`docs/audits/INDEPENDENT_RECHECK.md`)
  *Báo cáo thẩm định độc lập các lỗi phân công giảng dạy, danh mục môn GDCD/GDKTPL và hành vi của giáo viên.*

---

## 3. Lịch sử các đợt khắc phục lỗi (Remediation)
- [Khắc phục Phase 1](file:///d:/Learning_AI/DigitalExamGrading/docs/remediation/REMEDIATION_PHASE1.md) (`docs/remediation/REMEDIATION_PHASE1.md`)
  *Xử lý 4 lỗi nghiêm trọng ban đầu: Race condition, TOCTOU trong submission, cấu hình DB test.*
- [Khắc phục Phase 1.1](file:///d:/Learning_AI/DigitalExamGrading/docs/remediation/REMEDIATION_PHASE1_1.md) (`docs/remediation/REMEDIATION_PHASE1_1.md`)
  *Bổ sung Fail-closed confidence check và khóa PostgreSQL Advisory Lock.*
- [Khắc phục Phase 2](file:///d:/Learning_AI/DigitalExamGrading/docs/remediation/REMEDIATION_PHASE2.md) (`docs/remediation/REMEDIATION_PHASE2.md`)
  *Xử lý kiểm soát truy cập kỳ thi, cô lập vai trò SUPER_ADMIN và phân quyền chấm thi.*
- [Khắc phục Phase 2.1](file:///d:/Learning_AI/DigitalExamGrading/docs/remediation/REMEDIATION_PHASE2_1.md) (`docs/remediation/REMEDIATION_PHASE2_1.md`)
  *Hoàn thiện logic xác thực danh tính bài nộp và cô lập dữ liệu bài thi.*

---

## 4. Báo cáo kiểm chứng sau sửa (Verification)
- [Báo cáo Kiểm chứng Sau sửa (Đợt 1 & 2)](file:///d:/Learning_AI/DigitalExamGrading/docs/verification/POST_FIX_VERIFICATION.md) (`docs/verification/POST_FIX_VERIFICATION.md`)
  *Kiểm chứng độ tin cậy SBD kỳ thi đa lớp, cô lập học sinh giữa các lớp, xử lý bài nộp chưa xác minh danh tính.*
- [Báo cáo Kiểm chứng Độc lập & Bàn giao (Lượt 3/4 Mới nhất)](file:///d:/Learning_AI/DigitalExamGrading/docs/verification/ROUND3_VERIFICATION_REPORT.md) (`docs/verification/ROUND3_VERIFICATION_REPORT.md`)
  *Chi tiết giải quyết ReferenceError trong nhánh giáo viên, chặn triệt để rò rỉ dữ liệu qua `filters.teacherId`, kiểm thử tích hợp HTTP Express toàn trình, đồng bộ năm học và cơ chế thăm dò DB động.*

---

## 5. Gói bàn giao và Hiện vật (Artifacts)
- **Gói bàn giao mới nhất (Lượt 3/4):** `artifacts/handovers/2026-09-27_1930/`
  - [Gói mã nguồn bàn giao độc lập](file:///d:/Learning_AI/DigitalExamGrading/artifacts/handovers/2026-09-27_1930/DIGITAL_EXAM_HANDOVER_ROUND3.zip) (`DIGITAL_EXAM_HANDOVER_ROUND3.zip`)
  - [Bản diff thay đổi thực tế](file:///d:/Learning_AI/DigitalExamGrading/artifacts/handovers/2026-09-27_1930/CURRENT_DIFF.patch) (`CURRENT_DIFF.patch`)
  - [Log thực thi 14 bài kiểm thử tự động](file:///d:/Learning_AI/DigitalExamGrading/artifacts/handovers/2026-09-27_1930/ROUND3_TEST_LOG.txt) (`ROUND3_TEST_LOG.txt`)
- **Manifest dọn dẹp và Script hoàn tác:** `artifacts/cleanup/2026-09-27_1940/`
  - [Manifest dọn dẹp](file:///d:/Learning_AI/DigitalExamGrading/artifacts/cleanup/2026-09-27_1940/manifest.json) (`manifest.json`)
  - [Script hoàn tác di chuyển](file:///d:/Learning_AI/DigitalExamGrading/artifacts/cleanup/2026-09-27_1940/rollback.ps1) (`rollback.ps1`)
