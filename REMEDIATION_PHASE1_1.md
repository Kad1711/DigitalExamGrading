# REMEDIATION PHASE 1.1 – VERIFICATION HOTFIX

**Dự án:** DigitalExamGrading  
**Môi trường:** Node.js v24.19.0 / PostgreSQL (`exam_grading_test`)  
**Phạm vi:** Chỉ xử lý 3 vấn đề từ `REMEDIATION_PHASE1.md`. Tuyệt đối không sửa `apps/web/**`. Không bắt đầu Phase 2.

---

## 1. Missing-confidence verification

### Hiện trạng trước Phase 1.1 (Fail-Open)
Trong [submission.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/submission.service.js):
```javascript
const examCodeConfidence =
  typeof omrData.examCode?.confidence === "number"
    ? omrData.examCode.confidence
    : 1.0;
```
Đoạn code trên là **Fail-Open**: Khi OMR engine không trả về trường `confidence` (undefined), trường này bị null, hoặc không tính toán được, hệ thống mặc định coi `confidence = 1.0` (100% tin cậy). Hậu quả là bài thi có mã đề không rõ ràng vẫn vượt qua ngưỡng $\ge 0.90$ và tự động chốt điểm `FINAL`.

Tương tự, với `studentNumberConfidence`:
```javascript
const studentNumberConfidence =
  typeof omrData.studentNumber?.confidence === "number" ? omrData.studentNumber.confidence : 0;
```
Nếu OMR engine trả về `NaN` hoặc giá trị số không hữu hạn, biểu thức `typeof NaN === "number"` vẫn trả về `true`, dẫn đến các so sánh logic sau đó bị sai lệch.

### Khắc phục chuyển đổi sang Fail-Closed
Tại [submission.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/submission.service.js#L359-L395):
1. Bổ sung kiểm tra tính hữu hạn của số bằng `Number.isFinite(...)`.
2. Nếu `confidence` bị thiếu, `null`, `undefined`, chuỗi ký tự, hoặc `NaN`:
   - Gán `examCodeConfidence = 0` và ép `examCodeNeedsReview = true`.
   - Gán `studentNumberConfidence = 0` và ép `identityNeedsReview = true`.
3. Khi `examCodeNeedsReview = true` hoặc `identityNeedsReview = true`:
   - `isFinalEligible` trả về `false`.
   - `status = "PROVISIONAL"`.
   - `finalScore = null`.
4. Giữ nguyên toàn bộ ngưỡng (threshold) hiện có:
   - Ngưỡng mã đề: `confidence >= 0.90` và `status === "OK"`.
   - Ngưỡng số báo danh: `confidence >= 0.85`, `status === "OK"`, và SBD phải nằm trong `ExamCandidate` của kỳ thi.

---

## 2. Concurrent duplicate test

### Thiết kế kiểm thử đối kháng (TOCTOU Race Condition)
Viết test case `F006.3` trong [remediation-phase1.test.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/tests/remediation-phase1.test.js#L718-L791):
- Khởi tạo 1 thí sinh cô lập trong danh sách dự thi (`ExamCandidate`).
- Chuẩn bị 2 buffer ảnh khác biệt hoàn toàn (`img1`, `img2`), dẫn tới 2 hash SHA-256 khác nhau nhằm vượt qua guard chống trùng ảnh (`originalImageSha256`).
- Bắn đồng thời 2 request tạo bài thi qua `Promise.allSettled`:
```javascript
const results = await Promise.allSettled([
  submissionService.createSubmission({
    examId: ctx.exam.id,
    imageBuffer: img1,
    originalFilename: "conc1.jpg",
    mimeType: "image/jpeg",
    user: ctx.teacherUser1,
  }),
  submissionService.createSubmission({
    examId: ctx.exam.id,
    imageBuffer: img2,
    originalFilename: "conc2.jpg",
    mimeType: "image/jpeg",
    user: ctx.teacherUser1,
  }),
]);
```

### Bất biến dữ liệu kỳ vọng
```text
FINAL submissions for candidate+exam <= 1
```

### Kết quả khi chạy trên code cũ (Chưa có Atomic Guard)
- **FAIL**: Cả hai lời gọi `findFirst()` trước transaction đều chạy đồng thời và trả về `null`.
- Cả hai giao dịch cùng commit thành công vào database.
- Database ghi nhận **2 bản ghi `FINAL`** cho cùng một thí sinh trong một kỳ thi $\rightarrow$ **Vi phạm nghiêm trọng bất biến tính toàn vẹn dữ liệu**.
- Kết luận: `FINDING-006` chưa được khắc phục triệt để nếu chỉ dùng `findFirst()` tuần tự ở tầng ứng dụng.

---

## 3. Atomic fix nếu cần

### Cơ chế Atomic Concurrency Guard đã triển khai
Để giải quyết triệt để kẽ hở TOCTOU mà không gây khóa chết (deadlock) hoặc khóa nặng trên toàn bảng, cơ chế **PostgreSQL Transaction Advisory Lock** kết hợp **Intra-Transaction Check** được áp dụng trực tiếp bên trong `prisma.$transaction`.

Tại [submission.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/submission.service.js#L500-L525):
```javascript
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Concurrency guard: Serialize candidate submissions for this exam to prevent TOCTOU race (FINDING-006)
      if (resolvedStudentNumber) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${exam.id}), hashtext(${resolvedStudentNumber}))`;

        const existingCandidateSubmission = await tx.examSubmission.findFirst({
          where: {
            examId: exam.id,
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

      // 12a. Insert ExamSubmission
      const sub = await tx.examSubmission.create({ ... });
```

### Nguyên lý hoạt động
1. **Tuần tự hóa nguyên tử cấp ứng viên:** `pg_advisory_xact_lock(hashtext(examId), hashtext(resolvedStudentNumber))` chỉ cấp khóa trên cặp định danh `(examId, resolvedStudentNumber)`. Các thí sinh khác và các kỳ thi khác hoàn toàn không bị ảnh hưởng hiệu năng.
2. **Loại trừ Race Condition:** Khi request 1 và request 2 cùng gửi:
   - Request 1 lấy được advisory lock. Kiểm tra `findFirst()` trong transaction thấy chưa có bài `FINAL` $\rightarrow$ Tiến hành ghi bài `FINAL` $\rightarrow$ Commit transaction và giải phóng advisory lock.
   - Request 2 phải chờ Request 1 hoàn tất. Ngay khi lấy được advisory lock, Request 2 thực hiện `findFirst()` bên trong transaction $\rightarrow$ Thấy ngay bản ghi `FINAL` mà Request 1 vừa commit $\rightarrow$ Ném lỗi `409 DUPLICATE_CANDIDATE_SUBMISSION`.
3. **Dọn dẹp rác (Garbage Collection):** Khối `catch` ở ngoài của Request 2 bắt lỗi 409 và gọi `cleanupSubmissionStorage(namespace)`, dọn sạch các file ảnh đã lưu tạm của bài thi bị từ chối.
4. **Kiểm tra dữ liệu trùng lặp hiện hữu:** Đã kiểm tra qua script [check-duplicates.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/scripts/check-duplicates.js), cơ sở dữ liệu hiện tại ghi nhận **0** trường hợp trùng lặp `FINAL`.
5. **Quy tắc nghiệp vụ được bảo toàn:**
   > Không được tồn tại $> 1$ active/FINAL submission cho cùng candidate trong một exam mà không qua conflict-resolution workflow.

---

## 4. initialPassword dependency analysis

Đã thực hiện tìm kiếm toàn bộ references tới `initialPassword` và `DEFAULT_STUDENT_PASSWORD` trên toàn bộ codebase.

### Bảng phân tích phụ thuộc chi tiết

| File | Read/Write | Mục đích | Exposed externally? | Safe to remove? |
| :--- | :---: | :--- | :---: | :---: |
| `apps/api/prisma/schema.prisma` (L201) | Schema | Khai báo cột `initialPassword String? @default("123456")` trong model `Student`. | Có (Lưu plain-text trong DB) | **KHÔNG** (Cần DB migration) |
| `apps/api/prisma/migrations/20260921170000.../migration.sql` (L8-9) | Migration | Lịch sử migration tạo cột `initialPassword`. | Không | **KHÔNG** (Migration history bất biến) |
| `apps/api/scripts/apply-thcs-and-student-password.js` (L30-41) | Script | Script dev cũ để kiểm tra & cập nhật cột `initialPassword`. | Không | **CÓ THỂ** (Script tiện ích nội bộ) |
| `apps/api/src/schemas/admin-teacher.schema.js` (L27) | Validation | Xác thực request body khi Admin tạo tài khoản Giáo viên. | Không | **KHÔNG** (Dùng cho luồng admin tạo GV) |
| `apps/api/src/services/admin-teacher.service.js` (L95, 144) | Read / Hash | Nhận `initialPassword` từ request và băm: `bcrypt.hash(initialPassword, SALT_ROUNDS)`. | Không | **KHÔNG** (Mã an toàn, đã băm vào `passwordHash`) |
| `apps/api/src/services/student-enrollment.service.js` (L8, 98, 163, 196, 215, 323, 355, 545) | Read & Write | Tạo/sửa học sinh lẻ: ghi mật khẩu vào `Student.initialPassword` và trả về kết quả cho Giáo viên. | Có (Trả về khi tạo/sửa lẻ; **đã chặn** ở API danh sách lớp) | **KHÔNG** (GV dùng để báo mật khẩu cho HS) |
| `apps/api/src/services/student-excel-import.service.js` (L8, 207, 294) | Read & Write | Import Excel học sinh: gán `123456` vào `User.passwordHash` và `Student.initialPassword`. | Có (Lưu plain-text trong DB) | **KHÔNG** (Ảnh hưởng quy trình import hàng loạt) |
| `apps/web/src/pages/TeacherClassesPage.jsx` (L513, 1861) | Read / UI | UI hiển thị mật khẩu khởi tạo cho giáo viên khi xem/sửa học sinh. | Có (Hiển thị trên UI giáo viên) | **KHÔNG** (Thuộc `apps/web/**` cấm sửa) |

### Xác nhận tình trạng bảo mật
- **API leak:** **ĐÃ ĐƯỢC KHẮC PHỤC** trong Phase 1 đối với API danh sách học sinh theo lớp `GET /api/classes/:classId/students` (đã có test `F004.3` khẳng định `initialPassword` trả về `undefined`).
- **Plaintext trong cơ sở dữ liệu:** **VẪN CÒN TỒN TẠI** trong cột `Student.initialPassword`.
- **Nhãn xác lập:**
  ```text
  FOLLOW-UP SECURITY MIGRATION REQUIRED
  ```

### Đề xuất thiết kế Provisioning / Password-Reset thay thế (Zero Plaintext)
Trong giai đoạn tiếp theo (khi được phép thực hiện DB migration & chỉnh sửa UI):
1. **Thay thế mật khẩu mặc định bằng One-Time Activation Token:**
   - Khi tạo học sinh hoặc import Excel, hệ thống sinh ra `activationToken` (thời hạn 7 ngày) được băm bằng SHA-256 lưu trong bảng `StudentActivationToken`.
   - `User.passwordHash` được khởi tạo bằng một chuỗi ngẫu nhiên không thể đoán trước, kèm cờ `mustChangePassword = true`.
2. **Kích hoạt tài khoản lần đầu:**
   - Giáo viên xuất phiếu báo tài khoản có in mã QR / đường link kích hoạt kèm token.
   - Học sinh quét mã QR truy cập trang kích hoạt lần đầu, tự đặt mật khẩu cá nhân mới $\rightarrow$ Backend băm bcrypt lưu vào `User.passwordHash` và vô hiệu hóa token.
3. **Loại bỏ cột `initialPassword`:**
   - Thực hiện Prisma migration `DROP COLUMN "initialPassword"` an toàn trên bảng `Student`.

---

## 5. Files changed

Các file đã thay đổi trong Phase 1.1:

| File | Thay đổi chính |
| :--- | :--- |
| [apps/api/src/services/submission.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/submission.service.js) | Chuyển đổi kiểm tra `examCodeConfidence` và `studentNumberConfidence` sang Fail-Closed (`Number.isFinite`); Bổ sung PostgreSQL Advisory Lock (`pg_advisory_xact_lock`) và Intra-transaction check chống TOCTOU duplicate submission. |
| [apps/api/tests/remediation-phase1.test.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/tests/remediation-phase1.test.js) | Bổ sung 5 regression test cases kiểm thử Fail-Closed confidence và Concurrent duplicate race condition bằng `Promise.allSettled`. |
| [REMEDIATION_PHASE1_1.md](file:///d:/Learning_AI/DigitalExamGrading/REMEDIATION_PHASE1_1.md) | Báo cáo kỹ thuật chi tiết cho Phase 1.1. |

*Lưu ý:* Tuyệt đối không có bất kỳ file nào trong `apps/web/**` bị sửa đổi bởi agent.

---

## 6. Tests added

Đã bổ sung 5 bài test mới trong suite [apps/api/tests/remediation-phase1.test.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/tests/remediation-phase1.test.js):

1. `F002.2 — examCode status OK but confidence missing forces status=PROVISIONAL (Fail-Closed)`: Kiểm tra mã đề OMR status là OK nhưng trường `confidence` bị undefined $\rightarrow$ Xác nhận kết quả chuyển `PROVISIONAL`, `finalScore = null`.
2. `F002.3 — examCode confidence null forces status=PROVISIONAL (Fail-Closed)`: Kiểm tra trường `confidence` của mã đề nhận giá trị `null` $\rightarrow$ Xác nhận kết quả chuyển `PROVISIONAL`.
3. `F002.4 — examCode confidence non-number (string/NaN) forces status=PROVISIONAL (Fail-Closed)`: Kiểm tra trường `confidence` là dạng chuỗi (`"0.99"`) hoặc `NaN` $\rightarrow$ Xác nhận kết quả chuyển `PROVISIONAL`.
4. `F001.4 — studentNumber confidence missing forces status=PROVISIONAL (Fail-Closed)`: Kiểm tra trường `confidence` của SBD bị thiếu $\rightarrow$ Xác nhận cờ `identityNeedsReview = true` và bài thi chuyển `PROVISIONAL`.
5. `F006.3 — Concurrent submission race: Promise.allSettled enforces FINAL submissions <= 1`: Kiểm tra 2 request nộp bài đồng thời cùng thí sinh và 2 ảnh khác nhau $\rightarrow$ Xác nhận số lượng bài thi `FINAL` trong DB không vượt quá 1.

---

## 7. Actual test results

Thực thi lệnh kiểm thử toàn diện:
```bash
npm --prefix apps/api test
```

### Chi tiết số liệu kiểm thử
- **Baseline tests (trước Phase 1.1):** 182 tests
- **Tests mới bổ sung trong Phase 1.1:** 5 tests
- **Tổng số tests thực thi:** 187 tests
- **Pass:** **187 / 187 (100%)**
- **Fail:** **0**
- **Skipped / Cancelled:** **0**
- **Thời gian chạy:** 168.87 giây

> **Lưu ý về kiểm thử tương tranh:** Hệ thống **không** coi test tuần tự là bằng chứng chống race condition. Khả năng chống duplicate submission dưới tải đồng thời đã được xác thực độc lập thông qua test case `F006.3` sử dụng `Promise.allSettled` và khóa `pg_advisory_xact_lock` cấp database.

---

## 8. Remaining risks

1. **Rủi ro mật khẩu dạng thô `initialPassword`:** Do chưa thực hiện migration xóa cột `initialPassword` ở Phase 1.1, dữ liệu mật khẩu khởi tạo của học sinh vẫn nằm trong cơ sở dữ liệu. Cần ưu tiên thực hiện Phase chuyển đổi sang One-Time Activation Token ngay khi có phê duyệt.
2. **Chất lượng ảnh OMR thực tế:** OMR engine phụ thuộc vào độ sắc nét và ánh sáng của ảnh chụp bài thi. Cơ chế Fail-Closed đã bảo vệ an toàn để không chấm nhầm đề hoặc nhầm học sinh, tuy nhiên với các trường thi có nhiều ảnh chụp mờ, số lượng bài thi rơi vào hàng đợi duyệt thủ công (`PROVISIONAL`) sẽ tăng lên, đòi hỏi giáo viên thực hiện bước review danh tính/mã đề trên giao diện.
3. **Phụ thuộc cơ chế khóa PostgreSQL:** Khóa giao dịch `pg_advisory_xact_lock` phụ thuộc vào engine PostgreSQL. Nếu trong tương lai có sự thay đổi driver hoặc chuyển sang hệ quản trị CSDL khác, cơ chế khóa này cần được cập nhật tương đương.
