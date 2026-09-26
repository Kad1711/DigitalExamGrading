# BÁO CÁO KHẮC PHỤC KỸ THUẬT: REMEDIATION PHASE 1 (P0 DATA INTEGRITY & SECURITY)

**Dự án:** DigitalExamGrading  
**Ngày thực hiện:** 27/09/2026  
**Phạm vi:** Remediation Phase 1 — Khắc phục triệt để 4 lỗ hổng nghiêm trọng P0 (FINDING-001, FINDING-002, FINDING-004, FINDING-006) theo kết quả kiểm định độc lập tại `INDEPENDENT_RECHECK.md`.  
**Quy trình tuân thủ:** Test-First Regression Testing (Viết test -> Xác nhận FAIL -> Minimal Code Fix -> Xác nhận PASS -> Chạy Full Suite 100% PASS).  
**Cam kết bảo vệ working tree:** Thư mục `apps/web/` hoàn toàn được bảo vệ, **KHÔNG CÓ BẤT KỲ SỰ THAY ĐỔI NÀO**.

---

## 1. Executive Summary

Trong Phase 1, đội ngũ phát triển đã xử lý triệt để 4 lỗ hổng P0 về an toàn thông tin và tính toàn vẹn dữ liệu thi cử cốt lõi của hệ thống `DigitalExamGrading`:

1. **Khắc phục BOLA / IDOR và lộ mật khẩu học sinh (FINDING-004):**
   - Chặn đứng hoàn toàn nguy cơ giáo viên này đọc trộm danh sách học sinh của giáo viên khác qua `GET /api/classes/:classId/students` bằng middleware phân quyền `requireClassStudentAccess`.
   - Triệt tiêu việc rò rỉ trường mật khẩu khởi tạo (`initialPassword`) trong toàn bộ danh sách trả về của API đọc học sinh theo lớp.

2. **Khắc phục gán sai định danh thí sinh / SBD từ OMR (FINDING-001):**
   - Loại bỏ hoàn toàn cơ chế tự động liên kết học sinh phỏng đoán (heuristic auto-link qua substring/email prefix) – nguyên nhân gây chiếm quyền và tráo đổi bài thi.
   - Bắt buộc đối soát SBD nhận dạng từ OMR với danh sách thí sinh chính thức của kỳ thi (`ExamCandidate`). Nếu SBD chưa đăng ký, OMR status khác `OK`, hoặc độ tin cậy $< 0.85$, hệ thống lập tức đánh dấu `identityNeedsReview = true` và chuyển bài thi sang trạng thái `PROVISIONAL`, ngăn chặn tuyệt đối việc tự động finalized.

3. **Khắc phục nhận diện sai mã đề / đáp án chấm (FINDING-002):**
   - Bổ sung quy tắc kiểm tra độ tin cậy và tính rõ ràng của mã đề OMR (`examCode.status === 'OK'` và `confidence >= 0.90`).
   - Nếu mã đề bị mờ, nghi vấn hoặc có độ tin cậy thấp, bài thi bị bắt buộc giữ ở trạng thái `PROVISIONAL`, cấm tự động chấm `FINAL` bằng đáp án của đề thi khác.

4. **Khắc phục bài nộp trùng lặp và tra cứu kết quả không an toàn (FINDING-006):**
   - Thực thi bất biến dữ liệu: Trong cùng một kỳ thi, mỗi thí sinh (`resolvedStudentNumber`) chỉ được có tối đa 1 bài thi `FINAL`/hợp lệ. Mọi nỗ lực nộp thêm bài khi đã có bài `FINAL` sẽ bị từ chối ngay với mã lỗi `409 DUPLICATE_CANDIDATE_SUBMISSION`.
   - Áp dụng nguyên tắc Fail-Closed (Đóng khi có xung đột) cho cổng tra cứu học sinh: Nếu cơ sở dữ liệu phát hiện có $> 1$ bài nộp cho cùng một SBD, hệ thống chặn hiển thị điểm số và từ chối với mã lỗi `409 RESULT_IDENTITY_CONFLICT`, tuyệt đối không chọn ngẫu nhiên bài thi bằng `findFirst()`.

---

## 2. Bảng trạng thái chi tiết 4 Finding

| ID | Mức độ | Thành phần ảnh hưởng | Nguyên nhân gốc rễ (Root Cause) | Giải pháp khắc phục (Fix Applied) | Trạng thái |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **FINDING-004** | **High** | Class Students API (`class.routes.js`, `student-enrollment.service.js`) | Tuyến đường `GET /api/classes/:classId/students` chỉ dùng middleware chung `canReadClasses`, không kiểm tra phân công giảng dạy (`TeachingAssignment`). Hàm `listClassStudents` trả kèm trường `initialPassword` dạng plain-text. | Bổ sung middleware `requireClassStudentAccess` kiểm tra quyền phân công của Giáo viên (chỉ được xem lớp mình dạy; BGH/Admin xem toàn trường). Xóa bỏ trường `initialPassword` khỏi payload trả về của `listClassStudents`. | **REMEDIATED** |
| **FINDING-001** | **Critical** | Grading Orchestration (`submission.service.js`, `submission-review.service.js`) | `identityNeedsReview` chỉ kiểm tra có text SBD hay không (`!detectedStudentNumber`). Đoạn code dòng 579–621 tự động tạo `ExamCandidate` bằng heuristic `endsWith()`, `includes()`, gán nhầm học sinh. Bài thi tự động chuyển thành `FINAL`. | Bỏ toàn bộ block heuristic auto-link trong chấm thi và duyệt bài. Bắt buộc tra cứu SBD trong danh sách `ExamCandidate` của kỳ thi. Nếu không có hoặc OMR status $\neq$ 'OK' hoặc confidence $< 0.85$, đánh dấu `identityNeedsReview = true` và ép trạng thái `PROVISIONAL`. | **REMEDIATED** |
| **FINDING-002** | **Critical** | Exam Code Resolution (`submission.service.js`) | Chỉ kiểm tra tồn tại mã đề `omrData.examCode?.value`, bỏ qua hoàn toàn `status` và `confidence`. Nếu OMR đọc nhầm mã đề, hệ thống lập tức chấm theo đáp án đề nhầm và lưu trạng thái `FINAL`. | Kiểm tra `examCode.status === 'OK'` và `examCode.confidence >= 0.90`. Nếu không thỏa mãn, kích hoạt cờ `examCodeNeedsReview = true`, cấm bài thi chuyển sang `FINAL` và lưu vết kiểm toán rõ ràng. | **REMEDIATED** |
| **FINDING-006** | **High** | Ingestion & Student Results (`submission.service.js`, `student-result.service.js`) | Schema DB chỉ có unique theo `[examId, originalImageSha256]`. Hai ảnh chụp khác nhau của cùng 1 bài thi được lưu độc lập. Cổng tra cứu học sinh gọi `findFirst()` không sắp xếp, trả về điểm ngẫu nhiên. | Bổ sung candidate-level duplicate guard trong `createSubmission`: Chặn nộp bài thứ 2 cho cùng 1 thí sinh đã có bài `FINAL` với mã lỗi `409 DUPLICATE_CANDIDATE_SUBMISSION`. Trong `student-result.service.js`, chuyển sang Fail-Closed: Báo xung đột nếu phát hiện $> 1$ bài nộp. | **REMEDIATED** |

---

## 3. Chi tiết kỹ thuật từng bản sửa đổi (Code Diffs & Logic Changes)

### 3.1. FINDING-004: BOLA IDOR & Leak of Initial Password

#### A. File: `apps/api/src/middlewares/class-access.middleware.js`
- **Thay đổi:** Bổ sung middleware `requireClassStudentAccess`.
- **Logic:**
  ```javascript
  export async function requireClassStudentAccess(req, res, next) {
    const user = req.user;
    if (!user) return next(new AppError("Bạn chưa xác thực.", 401, "UNAUTHORIZED"));

    // BGH, Khảo thí, Quản trị viên được xem toàn trường
    if (["SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER"].includes(user.role)) {
      return next();
    }

    // Giáo viên bộ môn/chủ nhiệm bắt buộc phải có TeachingAssignment với classId
    if (user.role === "TEACHER") {
      const classId = req.params.classId;
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!teacher) return next(new AppError("Không tìm thấy thông tin giáo viên.", 403, "FORBIDDEN"));

      const assignment = await prisma.teachingAssignment.findFirst({
        where: { classId, teacherId: teacher.id },
      });
      if (!assignment) {
        return next(new AppError("Bạn chỉ được phép xem danh sách học sinh của các lớp bạn được phân công phụ trách.", 403, "FORBIDDEN"));
      }
      return next();
    }

    return next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403, "FORBIDDEN"));
  }
  ```

#### B. File: `apps/api/src/routes/class.routes.js`
- **Dòng:** 60–63
- **Logic cũ:**
  ```javascript
  router.get("/:classId/students", canReadClasses, getClassStudents);
  ```
- **Logic mới:**
  ```javascript
  router.get("/:classId/students", requireClassStudentAccess, getClassStudents);
  ```

#### C. File: `apps/api/src/services/student-enrollment.service.js`
- **Hàm:** `listClassStudents`
- **Dòng:** 72–82
- **Logic cũ:**
  ```javascript
  return enrollments.map((en) => ({
    ...,
    email: en.student.user?.email || null,
    initialPassword: en.student.initialPassword || DEFAULT_STUDENT_PASSWORD,
    status: en.student.user?.status || "ACTIVE",
  }));
  ```
- **Logic mới:** Đã loại bỏ hoàn toàn trường `initialPassword`.

---

### 3.2. FINDING-001 & FINDING-002: Candidate Identity Verification & Ambiguous Exam Code

#### File: `apps/api/src/services/submission.service.js`
- **Hàm:** `createSubmission`
- **Dòng:** 350–440, 470–540, 638–689

1. **Kiểm tra độ tin cậy mã đề (FINDING-002):**
   ```javascript
   const examCodeOmrStatus = omrData.examCode?.status || "UNKNOWN";
   const examCodeConfidence = typeof omrData.examCode?.confidence === "number" ? omrData.examCode.confidence : 1.0;
   const examCodeNeedsReview = examCodeOmrStatus !== "OK" || examCodeConfidence < 0.90;
   ```

2. **Kiểm tra danh tính thí sinh qua Roster (FINDING-001):**
   ```javascript
   let isRosterCandidate = false;
   if (resolvedStudentNumber) {
     const candidateRecord = await prisma.examCandidate.findFirst({
       where: { examId, studentNumber: resolvedStudentNumber },
       select: { id: true },
     });
     if (candidateRecord) isRosterCandidate = true;
   }

   const identityNeedsReview =
     !resolvedStudentNumber ||
     studentNumberOmrStatus !== "OK" ||
     studentNumberConfidence < 0.85 ||
     !isRosterCandidate;
   ```

3. **Bất biến trạng thái bài thi (Status Invariant):**
   ```javascript
   const isFinalEligible =
     grading.unresolvedCount === 0 &&
     !identityNeedsReview &&
     !examCodeNeedsReview;

   const submissionStatus = isFinalEligible ? "FINAL" : "PROVISIONAL";
   const subFinalScore = isFinalEligible ? calculatedScoreDecimal : null;
   const subProvisionalScore = isFinalEligible ? null : calculatedScoreDecimal;
   const subFinalizedAt = isFinalEligible ? new Date() : null;
   ```

4. **Xóa bỏ hoàn toàn khối Heuristic Auto-Linking:**
   - Đã xóa toàn bộ đoạn mã tự động tạo `ExamCandidate` theo quy tắc `code.endsWith(resolvedStudentNumber) || emailPrefix.includes(resolvedStudentNumber)` ở dòng 579–621 của `submission.service.js` và dòng 405–452 của `submission-review.service.js`.

---

### 3.3. FINDING-006: Candidate Duplicate Guard & Fail-Closed Results

#### A. File: `apps/api/src/services/submission.service.js`
- **Hàm:** `createSubmission`
- **Logic:**
  ```javascript
  if (resolvedStudentNumber) {
    const existingCandidateSubmission = await prisma.examSubmission.findFirst({
      where: {
        examId,
        resolvedStudentNumber,
        status: "FINAL",
      },
      select: { id: true },
    });

    if (existingCandidateSubmission) {
      throw new AppError(
        `Thí sinh với SBD '${resolvedStudentNumber}' đã có bài nộp hợp lệ (FINAL) trong kỳ thi này.`,
        409,
        "DUPLICATE_CANDIDATE_SUBMISSION",
        { existingSubmissionId: existingCandidateSubmission.id }
      );
    }
  }
  ```

#### B. File: `apps/api/src/services/student-result.service.js`
- **Hàm:** `listStudentExams`
- **Logic cũ:** Gọi `prisma.examSubmission.findFirst(...)`, ngẫu nhiên lấy 1 trong 2 bài nộp nếu có trùng lặp.
- **Logic mới (Fail-Closed):**
  ```javascript
  const candidateSubmissions = await prisma.examSubmission.findMany({
    where: {
      examId: exam.id,
      resolvedStudentNumber: studentNumber,
      status: "FINAL",
      identityNeedsReview: false,
    },
    take: 2,
  });

  if (candidateSubmissions.length === 1) {
    submission = candidateSubmissions[0];
  } else if (candidateSubmissions.length > 1) {
    console.warn(`[STUDENT_RESULT] Conflict: Multiple FINAL submissions for SBD ${studentNumber} in exam ${exam.id}`);
    submission = null; // Chặn hiển thị điểm nếu có xung đột trùng lặp
  }
  ```
- **Hàm:** `getStudentResultDetail`
  - Giữ vững cơ chế ném lỗi `409 RESULT_IDENTITY_CONFLICT` khi phát hiện $> 1$ bài nộp.
  - Loại bỏ các mệnh đề fuzzy auto-link `.endsWith(cleanCode)` tại dòng 157 và dòng 293.

---

## 4. Kết quả kiểm thử (Test-First Verification Results)

### 4.1. Bộ kiểm thử hồi quy mới: `apps/api/tests/remediation-phase1.test.js`

Gồm 10 test case chuyên biệt kiểm định hành vi của 4 Finding:

| Test Case | Mục đích kiểm tra | Kết quả chạy trên CODE CŨ | Kết quả chạy trên CODE MỚI |
| :--- | :--- | :---: | :---: |
| `F004.1` | Chặn giáo viên không được phân công truy cập danh sách lớp (403 FORBIDDEN) | ❌ **FAIL** (Missing middleware) | ✅ **PASS** (8.1ms) |
| `F004.2` | Cho phép giáo viên phụ trách và Quản trị viên xem danh sách lớp | ❌ **FAIL** (Missing middleware) | ✅ **PASS** (4.5ms) |
| `F004.3` | Đảm bảo `listClassStudents` không rò rỉ `initialPassword` | ❌ **FAIL** (Lộ `SecretPassword123`) | ✅ **PASS** (23.5ms) |
| `F001.1` | SBD không nằm trong danh sách kỳ thi bắt buộc chuyển `PROVISIONAL` | ❌ **FAIL** (Bị tự động `FINAL`) | ✅ **PASS** (114.7ms) |
| `F001.2` | SBD có độ tin cậy OMR thấp ($< 0.85$) bắt buộc chuyển `PROVISIONAL` | ❌ **FAIL** (Bị tự động `FINAL`) | ✅ **PASS** (79.6ms) |
| `F001.3` | Ngăn chặn việc tự động liên kết heuristic tạo `ExamCandidate` giả mạo | ❌ **FAIL** (Tự tạo candidate sai) | ✅ **PASS** (73.2ms) |
| `F002.1` | Mã đề OMR nghi vấn (`UNCERTAIN`, confidence $< 0.90$) bắt buộc giữ `PROVISIONAL` | ❌ **FAIL** (Bị tự động `FINAL`) | ✅ **PASS** (76.9ms) |
| `F006.1` | Thí sinh đã có bài `FINAL` bị chặn khi nộp bài thứ 2 (409 DUPLICATE) | ❌ **FAIL** (Cho phép nộp trùng) | ✅ **PASS** (110.9ms) |
| `F006.2` | Tra cứu kết quả học sinh Fail-Closed khi cơ sở dữ liệu có bài nộp xung đột | ❌ **FAIL** (Lấy bừa điểm thi) | ✅ **PASS** (117.1ms) |

### 4.2. Kết quả chạy toàn bộ Test Suite (`npm --prefix apps/api test`)

```text
==================================================
Test DB selected: exam_grading_test
Normal dev DB:   NOT USED
Test Storage:    ./storage-test
==================================================

ℹ tests 182
ℹ suites 7
ℹ pass 182
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 174292.5588
```

- **Tổng số test ban đầu:** 172 tests (100% pass)
- **Số test mới thêm:** 10 tests
- **Tổng số test hiện tại:** 182 tests (100% pass)
- **Tỷ lệ vượt qua:** **100% PASS** (0 fail, 0 skipped)
- **Thời gian chạy test:** ~174 giây

---

## 5. Xác nhận bảo vệ Working Tree (Rule #0)

Trước khi thực hiện và sau khi hoàn thành Phase 1, trạng thái git được kiểm tra nghiêm ngặt:

1. **Kiểm tra `git diff apps/web`:**
   ```text
   warning: in the working copy of 'apps/web/src/pages/TeacherStatisticsPage.jsx', LF will be replaced by CRLF the next time Git touches it
   diff --git a/apps/web/src/pages/TeacherStatisticsPage.jsx b/apps/web/src/pages/TeacherStatisticsPage.jsx
   index b8dd5f2..cb3b538 100644
   --- a/apps/web/src/pages/TeacherStatisticsPage.jsx
   +++ b/apps/web/src/pages/TeacherStatisticsPage.jsx
   @@ -23,6 +23,7 @@ import {
      Filter,
      Eye,
      SlidersHorizontal,
   +  Plus,
    } from "lucide-react";
    import { formatExamStatus } from "../utils/enum-map";
   ```
   *Xác nhận: Ngoại trừ dòng import `Plus` ban đầu do User chỉnh sửa dở dang từ trước, KHÔNG CÓ BẤT KỲ FILE NÀO TRONG `apps/web/` BỊ THAY ĐỔI, FORMAT LẠI HOẶC OVERWRITE.*

2. **Danh sách các file code thay đổi trong Phase 1 (Chỉ thuộc `apps/api/`):**
   - `apps/api/package.json`: Đăng ký `tests/remediation-phase1.test.js` vào lệnh `test`.
   - `apps/api/src/middlewares/class-access.middleware.js`: Bổ sung `requireClassStudentAccess`.
   - `apps/api/src/routes/class.routes.js`: Áp dụng middleware bảo vệ endpoint đọc học sinh.
   - `apps/api/src/services/student-enrollment.service.js`: Loại bỏ rò rỉ `initialPassword`.
   - `apps/api/src/services/submission.service.js`: Bổ sung kiểm tra SBD qua Roster, kiểm tra độ tin cậy mã đề OMR, chặn bài thi trùng lặp của thí sinh, loại bỏ heuristic auto-link.
   - `apps/api/src/services/submission-review.service.js`: Chuẩn hóa logic finalize khi duyệt danh tính, loại bỏ heuristic auto-link.
   - `apps/api/src/services/student-result.service.js`: Chuyển sang Fail-Closed cho học sinh tra cứu điểm khi có bài thi xung đột, loại bỏ substring matching.
   - `apps/api/tests/class-management.test.js`: Cập nhật assertion kiểm tra `initialPassword === undefined` khi đọc danh sách.
   - `apps/api/tests/remediation-phase1.test.js`: File test mới (10 subtests).

---

## 6. Đánh giá rủi ro tồn dư (Residual Risks) & Đề xuất cho Phase 2

1. **Rủi ro phụ thuộc Redis cho Bulk Grading (FINDING-003):**
   - *Hiện trạng:* Phase 1 chỉ tập trung vào P0 Data Integrity & Security trên luồng đồng bộ. Tính năng tải lên hàng loạt (Bulk Upload) vẫn phụ thuộc vào BullMQ & Redis. Nếu hạ tầng Redis gặp sự cố, luồng bulk upload sẽ dừng hoạt động.
   - *Đề xuất Phase 2:* Triển khai In-Memory queue worker fallback hoặc điều chỉnh tài liệu để định nghĩa rõ hard-dependency của Redis.

2. **Rủi ro bộ nhớ RAM khi upload nhiều ảnh lớn (FINDING-005):**
   - *Hiện trạng:* `uploadBatchImages` hiện dùng `multer.memoryStorage()`.
   - *Đề xuất Phase 2:* Chuyển đổi sang `multer.diskStorage()` kèm kiểm tra Magic Bytes (`file-type`) để chống DoS tràn bộ nhớ RAM (OOM) trên Render VPS dung lượng 512MB.

3. **Ngưỡng nhận diện OMR (FINDING-007):**
   - *Hiện trạng:* Ngưỡng fill ratio 0.18 và delta 0.08 trong OMR engine cần được tiếp tục theo dõi qua thực tế chấm bài của giáo viên trên các loại giấy thi và mực bút khác nhau.
