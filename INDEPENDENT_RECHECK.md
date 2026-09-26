# BÁO CÁO KIỂM TOÁN MÃ NGUỒN ĐỘC LẬP (INDEPENDENT ADVERSARIAL CODE AUDIT)
**Dự án:** Hệ thống Chấm thi Trắc nghiệm Kỹ thuật số (DigitalExamGrading)  
**Ngày thực hiện:** 27/09/2026  
**Chế độ kiểm toán:** Adversarial Code Audit (Không tin tưởng các giả định an toàn có sẵn; đối chiếu trực tiếp code thực thi)  
**Tài liệu đối chiếu:** Mã nguồn Git HEAD `83a53f3`, `SYSTEM_REVIEW.md`, `FILE_INDEX.md`  

---

## 1. EXECUTIVE SUMMARY (TÓM TẮT ĐIỀU HÀNH)

1. **Rủi ro P0 trong nhận dạng thí sinh:** Hệ thống tự động đặt `identityNeedsReview = false` ngay khi OMR đọc ra bất kỳ chuỗi SBD nào, hoàn toàn bỏ qua `confidence` của OMR. Nếu OMR đọc sai SBD của học sinh A thành SBD của học sinh B, học sinh B sẽ lập tức nhận điểm số với trạng thái `FINAL` mà không qua bước duyệt thủ công của giáo viên.
2. **Auto-linking candidate bằng Heuristic lỏng lẻo:** Khi SBD chưa có trong `ExamCandidate`, hàm `gradeSubmissionFromUpload` tự động khớp thí sinh bằng các quy tắc `.endsWith()`, `.includes()`, email prefix và tự động chèn bản ghi vào bảng `ExamCandidate` mà không ghi bất kỳ Audit Log nào.
3. **Mã đề không có lớp xác thực thứ hai:** QR Code in trên phiếu thi chỉ chứa `examId`, `templateId`, `pageNumber`, hoàn toàn không chứa `examCode`. Nếu OMR đọc nhầm mã đề `101` thành `107` (và mã 107 có trong kỳ thi), bài thi bị chấm toàn bộ bằng AnswerKey sai và lưu trạng thái `FINAL`.
4. **Phóng đại tài liệu về In-Memory Queue Fallback:** `SYSTEM_REVIEW.md` tuyên bố hệ thống có `InMemoryQueueManager` tự động xử lý hàng đợi khi Redis chết. Trên thực tế, code chỉ có `inMemoryBatchStore = new Map()` lưu chuỗi trạng thái batch. Khi Redis offline, lệnh `gradingQueue.addBulk()` ném ngoại lệ kết nối Redis và toàn bộ tính năng chấm hàng loạt tê liệt.
5. **Worker không khởi chạy khi thiếu Redis:** Hàm `initGradingWorker()` có logic `if (!isRedisConfigured()) return null;`, khẳng định 100% không có worker in-memory nào xử lý job khi không có Redis.
6. **Lỗ hổng BOLA / IDOR lộ mật khẩu học sinh:** Tuyến đường `GET /api/classes/:classId/students` không kiểm tra giáo viên có được phân công dạy lớp đó hay không. Bất kỳ giáo viên nào cũng có thể gọi API của lớp khác và nhận về toàn bộ email kèm `initialPassword` dạng plaintext (mặc định `123456`) của học sinh lớp đó.
7. **Nguy cơ DoS bộ nhớ (OOM Killer) do Multer Memory Storage:** Cấu hình upload hàng loạt cho phép 50 file $\times$ 15MB lưu trực tiếp trong RAM Node.js (`multer.memoryStorage()`), sau đó convert tiếp sang base64 ($+33\%$), tiêu tốn tới ~1GB RAM. Trên các container dung lượng 512MB (như Render Starter), thao tác này sẽ kích hoạt Linux OOM Killer dừng tiến trình server ngay lập tức.
8. **Thiếu kiểm tra Magic Bytes file ảnh:** Upload middleware chỉ kiểm tra đuôi file và header `Content-Type` do client gửi lên. Kẻ tấn công có thể đổi tên tệp thực thi, tệp PDF hoặc mã độc thành đuôi `.jpg` để vượt qua bộ lọc.
9. **Thiếu ràng buộc duy nhất 1 bài nộp / 1 thí sinh:** Cơ sở dữ liệu chỉ có `@@unique([examId, originalImageSha256])`. Nếu chụp 2 ảnh khác nhau của cùng 1 bài thi (SHA-256 khác nhau), hệ thống lưu 2 bản ghi submission độc lập cho cùng 1 SBD. API xem điểm học sinh dùng `findFirst()` không xác định thứ tự, trả về kết quả ngẫu nhiên giữa 2 bài nộp.
10. **Lỗi logic OMR Bubble khi tô 2 ô mờ:** Trong hàm `classify_bubble_group()`, nếu học sinh tô 2 ô cùng ở mức 34% và 33% (ví dụ: tẩy không sạch), do cả hai đều $< 0.35$ và margin $= 0.01 < 0.07$, thuật toán phân loại thành `BLANK` (để trắng) thay vì `MULTIPLE` hay `UNCERTAIN`.
11. **Rò rỉ tài nguyên Cloudinary vĩnh viễn (Orphan Files):** Hàm `cleanupSubmissionStorage()` chỉ xóa thư mục cục bộ (`storageService.deleteDirectory`), hoàn toàn không xóa ảnh đã đẩy lên Cloudinary khi transaction cơ sở dữ liệu thất bại.
12. **Bất biến sau công bố điểm (Publication Immutability) ở mức ứng dụng, không ở mức DB:** Sau khi công bố điểm (`resultsPublishedAt !== null`), các API sửa điểm và SBD bị khóa ở service layer (`assertResultsNotPublished`). Tuy nhiên, kỳ thi có thể bị `unpublish`, sửa đổi kết quả rồi công bố lại.
13. **Lỗi Runtime Crash tại TeacherStatisticsPage:** Trang thống kê giáo viên sử dụng icon `Plus` (`icon={Plus}`) tại dòng 455 nhưng quên import từ thư viện `lucide-react`, gây lỗi `ReferenceError: Plus is not defined` và sập trang trên môi trường production.
14. **Mâu thuẫn thống kê số lượng học sinh:** Card Dashboard Admin lấy `prisma.student.count({ where: {} })` ra 347 học sinh (tính cả 256 học sinh rác không có lớp), gán nhãn "347 thực có trong các lớp", trong khi bảng phân bổ khối lớp chỉ tính học sinh có lớp ($91 + 0 + 0 + 0 = 91$).
15. **Kết quả kiểm thử thực tế:** Chạy 172 test cases tự động backend trên môi trường Node.js native test runner đều PASS, nhưng 100% là test tổng hợp và unit/integration có kiểm soát; chưa có test tải thực tế và chưa có test ảnh chụp camera thực tế từ giấy thi nhàu nát.

---

## 2. CONFIRMED CRITICAL / HIGH ISSUES (DANH SÁCH LỖI NGHIÊM TRỌNG ĐÃ XÁC NHẬN)

### FINDING-001
- **Severity:** Critical
- **Classification:** HIGH-RISK DESIGN & DATA INTEGRITY FLAW
- **Affected component:** Submission Service / Identity Resolution Engine
- **File:** `apps/api/src/services/submission.service.js`
- **Function:** `gradeSubmissionFromUpload`
- **Lines:** 357–362, 428, 579–620

**Expected behavior:**  
Khi OMR trích xuất số báo danh, hệ thống phải:
1. Kiểm tra độ tin cậy (`confidence`) của SBD.
2. Kiểm tra xem SBD có nằm trong danh sách phòng thi (`ExamCandidate`) của kỳ thi này hay không.
3. Nếu SBD không khớp hoặc có độ nghi vấn, bắt buộc phải đánh dấu `identityNeedsReview = true` và đưa bài thi về trạng thái `PROVISIONAL`.

**Actual behavior:**  
- Dòng 360: `const identityNeedsReview = !detectedStudentNumber;` — Cờ này chỉ bằng `true` khi OMR trả về `null` (không đọc được ký tự nào). Nếu OMR đọc ra bất kỳ chuỗi số nào, cờ này lập tức nhận giá trị `false`.
- Dòng 428: `status: grading.unresolvedCount > 0 ? "PROVISIONAL" : "FINAL"` — Trạng thái bài thi chỉ phụ thuộc vào số câu hỏi chưa rõ ràng. Nếu các câu trắc nghiệm được tô rõ, bài thi được gán trạng thái `FINAL` ngay lập tức.
- Dòng 584–617: Nếu SBD chưa có trong `ExamCandidate`, hệ thống tự động tìm học sinh bằng heuristic lỏng lẻo (`code.endsWith(resolvedStudentNumber)`, `emailPrefix.includes(resolvedStudentNumber)`, `code.includes()`) và tự động chèn bản ghi `ExamCandidate` vào DB mà không có log kiểm toán.

**Why it matters:**  
Nếu học sinh A bị OMR đọc sai 1 chữ số trên SBD thành SBD của học sinh B, hệ thống sẽ tự động gán bài thi của A cho B, chuyển thành `FINAL`. Khi công bố kết quả, học sinh B nhận điểm của A, còn học sinh A mất bài làm.

**Reproduction:**  
1. Tạo kỳ thi cho lớp có học sinh A (Mã 01) và B (Mã 02).
2. Tải ảnh bài thi của A, nhưng vùng SBD bị lem khiến OMR đọc thành "02".
3. Kết quả: Hệ thống gán bài cho học sinh B, `identityNeedsReview = false`, `status = FINAL`.

**Evidence:**
```javascript
// apps/api/src/services/submission.service.js:360
const identityNeedsReview = !detectedStudentNumber;
const resolvedStudentNumber = detectedStudentNumber;
...
// apps/api/src/services/submission.service.js:428
status: grading.unresolvedCount > 0 ? "PROVISIONAL" : "FINAL",
```

**Possible impact:** Sai lệch hoàn toàn kết quả thi cử của học sinh; khiếu nại điểm số nghiêm trọng.  
**Recommended direction:** Đổi điều kiện `identityNeedsReview`: Bắt buộc kiểm tra `existingCandidate`. Nếu SBD không khớp chính xác danh sách thí sinh đã đăng ký kỳ thi hoặc confidence $< 0.85$, phải đặt `identityNeedsReview = true` và `status = PROVISIONAL`. Bỏ toàn bộ cơ chế auto-link heuristic.

---

### FINDING-002
- **Severity:** Critical
- **Classification:** HIGH-RISK DESIGN & SILENT CORRUPTION RISK
- **Affected component:** Submission Ingestion / Exam Code Resolution
- **File:** `apps/api/src/services/submission.service.js`, `apps/api/src/utils/answer-sheet-layout.js`
- **Function:** `gradeSubmissionFromUpload`, `buildAnswerSheetGeometry`
- **Lines:** `submission.service.js:304-344`, `answer-sheet-layout.js:338-352`

**Expected behavior:**  
Mã đề thi phải được đối soát chéo (cross-check) qua mã QR hoặc bắt buộc giáo viên xác nhận nếu độ tin cậy nhận diện thấp.

**Actual behavior:**  
- QR code in trên phiếu thi chỉ chứa `templateVersion`, `templateId`, `examId`, `pageNumber`, `totalPages`. QR code hoàn toàn KHÔNG chứa `examCode`.
- Tại dòng 305–344, code chỉ kiểm tra: `if (!omrData.examCode?.value)`. Nếu OMR nhận diện nhầm mã đề `101` thành `102` (và mã 102 có tồn tại trong kỳ thi), hệ thống lập tức lấy đáp án của đề 102 để chấm bài.
- `omrData.examCode.confidence` và `omrData.examCode.status` bị bỏ qua hoàn toàn, không làm chuyển bài thi sang `PROVISIONAL`.

**Why it matters:**  
Thí sinh làm đề 101 nhưng bị chấm theo đáp án đề 102, dẫn đến điểm số bị sai lệch hoàn toàn (có thể từ 9 điểm xuống 1-2 điểm).

**Reproduction:**  
Tải ảnh phiếu đề 101 với ô mã đề bị mờ hoặc bóng đổ khiến OMR đọc thành 102 (kỳ thi có cả đề 101 và 102). Hệ thống chấm theo đề 102 và lưu `status = FINAL`.

**Evidence:**
```javascript
// apps/api/src/utils/answer-sheet-layout.js:343-349
payload: {
  v: 1,
  templateVersion,
  templateId,
  examId,
  pageNumber: p,
  totalPages,
} // Không có examCode trong QR
```

**Possible impact:** Toàn bộ bài thi bị chấm sai đáp án gốc mà không hề có cảnh báo.  
**Recommended direction:** Nếu kỳ thi in phiếu theo từng mã đề, bắt buộc nhúng `examCode` vào QR payload. Với phiếu trắc nghiệm chung, nếu `examCode.confidence < 0.90` hoặc có ô mã đề nghi vấn, bắt buộc chuyển trạng thái bài thi thành `PROVISIONAL`.

---

### FINDING-003
- **Severity:** Critical
- **Classification:** DOCUMENTATION OVERCLAIM & OPERATIONAL SPOF
- **Affected component:** Asynchronous Grading Queue
- **File:** `apps/api/src/queue/grading.queue.js`, `apps/api/src/queue/grading.worker.js`
- **Function:** `enqueueBatchGrading`, `initGradingWorker`
- **Lines:** `grading.queue.js:14-26, 95`, `grading.worker.js:96-99`

**Expected behavior:**  
Theo tuyên bố tại `SYSTEM_REVIEW.md` Phần 6.1: *"Khi không có Redis kết nối, hệ thống tự động rơi về cơ chế hàng đợi trong bộ nhớ (In-memory fallback queue) giúp môi trường dev / máy đơn vẫn vận hành trơn tru."*

**Actual behavior:**  
- `inMemoryBatchStore` tại dòng 14 của `grading.queue.js` chỉ là một `new Map()` dùng để lưu bản ghi JSON trạng thái batch (`batchId`, `total`, `status`).
- Hoàn toàn KHÔNG CÓ lớp hàng đợi in-memory nào để thực thi job chấm bài.
- Dòng 95 của `grading.queue.js`: `await gradingQueue.addBulk(jobs)` — gọi trực tiếp BullMQ Queue. Khi Redis chết hoặc không được cấu hình, lệnh này ném ngoại lệ không xử lý được.
- Dòng 96–99 của `grading.worker.js`:
  ```javascript
  if (!isRedisConfigured()) {
    console.log("[QUEUE] Skipping BullMQ Worker initialization: Redis not configured.");
    return null;
  }
  ```
  Worker hoàn toàn bị hủy khởi tạo nếu không có Redis.

**Why it matters:**  
Tài liệu khẳng định hệ thống có fallback hàng đợi bộ nhớ trong, nhưng trên thực tế nếu Redis sập, toàn bộ tính năng chấm hàng loạt (Bulk Upload) chết hoàn toàn.

**Reproduction:**  
Tắt Redis server (`docker stop digital_exam_redis`). Gửi request tải lên hàng loạt bài thi qua API. API lập tức trả lỗi 500 hoặc crash.

**Evidence:**
```javascript
// apps/api/src/queue/grading.worker.js:96-98
if (!isRedisConfigured()) {
  return null;
}
```

**Possible impact:** Sập chức năng chấm bài hàng loạt khi hạ tầng Redis gặp sự cố.  
**Recommended direction:** Đính chính lại tài liệu hệ thống: Redis là thành phần bắt buộc (Hard Dependency) cho chấm bất đồng bộ; hoặc triển khai một Worker loop chạy trên `setInterval` xử lý mảng in-memory thật sự khi Redis offline.

---

### FINDING-004
- **Severity:** High
- **Classification:** CONFIRMED SECURITY ISSUE (BOLA / IDOR) & CREDENTIAL LEAK
- **Affected component:** Class Students API
- **File:** `apps/api/src/routes/class.routes.js`, `apps/api/src/services/student-enrollment.service.js`
- **Function:** `getClassStudents`, `listClassStudents`
- **Lines:** `class.routes.js:60`, `student-enrollment.service.js:79`

**Expected behavior:**  
Giáo viên chỉ được xem danh sách học sinh của các lớp mình được phân công giảng dạy (`TeachingAssignment`). Mật khẩu học sinh không bao giờ được trả về qua API danh sách lớp.

**Actual behavior:**  
- Tuyến đường `GET /api/classes/:classId/students` chỉ dùng middleware `canReadClasses` (`SUPER_ADMIN`, `PRINCIPAL`, `VICE_PRINCIPAL`, `EXAM_OFFICER`, `TEACHER`). Hoàn toàn không có middleware kiểm tra quyền phân công lớp.
- Tại `student-enrollment.service.js:79`, API trả về:
  ```javascript
  initialPassword: en.student.initialPassword || DEFAULT_STUDENT_PASSWORD,
  ```
  trực tiếp trong danh sách học sinh.

**Why it matters:**  
Bất kỳ giáo viên nào cũng có thể đổi `classId` trên URL để lấy toàn bộ danh sách học sinh của giáo viên khác, bao gồm cả email và mật khẩu khởi tạo của học sinh.

**Reproduction:**  
Đăng nhập tài khoản Giáo viên A (chỉ dạy lớp 6A1). Gửi request `GET /api/classes/<ID_LỚP_6A2>/students`. API trả về danh sách học sinh lớp 6A2 kèm mật khẩu `123456`.

**Evidence:**
```javascript
// apps/api/src/routes/class.routes.js:60
router.get("/:classId/students", canReadClasses, getClassStudents); // Không có requireClassStudentManagement!
```

**Possible impact:** Vi phạm nghiêm trọng quyền riêng tư học đường; nguy cơ chiếm quyền tài khoản học sinh hàng loạt.  
**Recommended direction:** Thêm `requireClassStudentManagement` vào route `GET /:classId/students` đối với vai trò `TEACHER`. Loại bỏ trường `initialPassword` khỏi payload trả về của `listClassStudents`.

---

### FINDING-005
- **Severity:** High
- **Classification:** CONFIRMED SECURITY ISSUE & DENIAL OF SERVICE (OOM)
- **Affected component:** Upload Gateway / Multer Configuration
- **File:** `apps/api/src/routes/grading.routes.js`, `apps/api/src/queue/grading.queue.js`
- **Function:** `uploadBatchImages`, `enqueueBatchGrading`
- **Lines:** `grading.routes.js:67–94`, `grading.queue.js:79`

**Expected behavior:**  
Tệp tải lên phải được lưu tạm vào đĩa (disk storage) hoặc stream trực tiếp; kiểm tra Magic Bytes nhị phân để ngăn chặn tập tin giả mạo.

**Actual behavior:**  
- `uploadBatchImages` cấu hình `storage = multer.memoryStorage()` với giới hạn 50 file $\times$ 15MB.
- Dữ liệu ảnh được giữ nguyên trong bộ nhớ RAM Node.js ($50 \times 15\text{ MB} = 750\text{ MB}$).
- Tại `grading.queue.js:79`, code tiếp tục gọi `file.buffer.toString("base64")` để đẩy vào BullMQ job, tăng kích thước bộ nhớ thêm 33% ($\sim 1\text{ GB}$ RAM).
- Bộ lọc `fileFilter` chỉ kiểm tra đuôi mở rộng và `file.mimetype` (do client tự khai báo). Hoàn toàn không kiểm tra Magic Bytes (ví dụ: `\xFF\xD8\xFF` cho JPEG).

**Why it matters:**  
Máy chủ Render / VPS cỡ nhỏ (512MB – 1GB RAM) sẽ bị tràn bộ nhớ và bị hệ điều hành tiêu diệt tiến trình (`SIGKILL`) ngay khi một giáo viên bấm tải lên 40–50 bài thi. Kẻ tấn công cũng có thể vượt qua bộ lọc bằng cách đổi tên file script/PDF thành `.jpg`.

**Reproduction:**  
Gửi request multipart chứa 40 file ảnh dung lượng mỗi file 12MB đến endpoint batch upload. Theo dõi RAM của Node.js tăng vọt trên 800MB và sập server.

**Evidence:**
```javascript
// apps/api/src/routes/grading.routes.js:67-72
export const uploadBatchImages = multer({
  storage, // memoryStorage!
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 50,
  },
```

**Possible impact:** Sập dịch vụ API (Denial of Service); tải lên tệp giả mạo.  
**Recommended direction:** Chuyển sang `multer.diskStorage()` ghi tệp tạm vào thư mục đĩa; bổ sung thư viện kiểm tra magic bytes (`file-type`); giải phóng buffer ngay sau khi lưu.

---

### FINDING-006
- **Severity:** High
- **Classification:** HIGH-RISK DESIGN & DATA INTEGRITY FLAW
- **Affected component:** Submission Storage / Database Invariants
- **File:** `apps/api/prisma/schema.prisma`, `apps/api/src/services/submission.service.js`, `apps/api/src/services/student-result.service.js`
- **Lines:** `schema.prisma:549`, `student-result.service.js:63-70`

**Expected behavior:**  
Trong một kỳ thi, mỗi thí sinh (`resolvedStudentNumber`) chỉ được có tối đa 1 bài thi hợp lệ.

**Actual behavior:**  
- Schema chỉ có ràng buộc: `@@unique([examId, originalImageSha256])`. Ràng buộc này chỉ chống lại việc gửi cùng một file ảnh nhị phân.
- Nếu chụp 2 ảnh khác nhau của cùng 1 bài thi (góc chụp khác nhau, độ sáng khác nhau $\rightarrow$ hash SHA-256 khác nhau), cơ sở dữ liệu sẽ lưu cả 2 bài nộp độc lập cho cùng 1 SBD.
- Khi học sinh tra cứu kết quả tại `student-result.service.js:63`, code gọi:
  ```javascript
  submission = await prisma.examSubmission.findFirst({
    where: { examId: exam.id, resolvedStudentNumber: studentNumber, status: "FINAL" }
  });
  ```
  Lệnh `findFirst()` không có mệnh đề `orderBy`, trả về ngẫu nhiên 1 trong 2 bài nộp.

**Why it matters:**  
Giáo viên quét lại bài thi để lấy ảnh rõ hơn nhưng không xóa bài cũ sẽ tạo ra 2 kết quả thi song song cho cùng 1 học sinh. Thống kê phổ điểm và báo cáo điểm số lớp bị nhân đôi số lượng bài thi.

**Reproduction:**  
Chụp 2 bức ảnh khác nhau của bài thi thí sinh SBD "060101". Tải cả 2 ảnh lên. Hệ thống tạo 2 bản ghi `ExamSubmission` độc lập và cả 2 đều tồn tại trong DB.

**Possible impact:** Sai lệch thống kê thi cử, học sinh có thể thấy điểm số của bài quét lỗi thay vì bài quét lại.  
**Recommended direction:** Thiết lập quy tắc nghiệp vụ: Nếu đã tồn tại submission có cùng `resolvedStudentNumber` trong kỳ thi, hệ thống phải từ chối hoặc đưa vào diện cảnh báo xung đột (Conflict Resolution) để giáo viên chọn ghi đè bài cũ.

---

### FINDING-007
- **Severity:** High
- **Classification:** CONFIRMED BUG & OMR LOGIC FLAW
- **Affected component:** OMR Bubble Classification
- **File:** `apps/ai-service/app/omr/bubble_reader.py`
- **Function:** `classify_bubble_group`
- **Lines:** 207–220

**Expected behavior:**  
Nếu thí sinh tô 2 ô tròn có độ đậm đáng kể (ví dụ tẩy chì không sạch khiến cả 2 ô đều đạt mức độ phủ xám 34% và 33%), hệ thống phải phân loại là `MULTIPLE` hoặc `UNCERTAIN` để giáo viên phúc khảo.

**Actual behavior:**  
- Ngưỡng `MIN_FILL_RATIO = 0.35`.
- Khi $A = 0.34$ và $B = 0.33$, `strong_candidates` có độ dài $= 0$.
- Hiệu số giữa 2 ô: $margin = 0.34 - 0.33 = 0.01$.
- Dòng 210 kiểm tra: `if top1_val >= MIN_UNCERTAIN_FILL_RATIO and margin >= 0.07:` $\rightarrow$ Do $0.01 < 0.07$, điều kiện này trả về `False`!
- Dòng 215 thực thi nhánh `else`:
  ```python
  status = "BLANK"
  ```
  Câu hỏi bị coi là để trắng hoàn toàn!

**Why it matters:**  
Thí sinh có tô bài thi (thậm chí tô 2 phương án gần bằng nhau) nhưng lại bị hệ thống chấm là bỏ trắng câu hỏi, nhận 0 điểm mà giáo viên không hề nhận được cờ cảnh báo để xem lại ảnh crop.

**Evidence:**
```python
# apps/ai-service/app/omr/bubble_reader.py:210-215
if top1_val >= MIN_UNCERTAIN_FILL_RATIO and margin >= 0.07:
    status = "UNCERTAIN"
else:
    status = "BLANK" # Khi margin < 0.07 và top1 < 0.35
```

**Possible impact:** Mất điểm oan của thí sinh trong các tình huống tẩy chì chưa sạch.  
**Recommended direction:** Nếu có từ 2 ô trở lên có `fill_ratio >= MIN_UNCERTAIN_FILL_RATIO (0.20)` và chênh lệch nhỏ ($margin < 0.07$), phải xếp vào trạng thái `UNCERTAIN` hoặc `MULTIPLE`, tuyệt đối không được gán `BLANK`.

---

### FINDING-008
- **Severity:** Medium
- **Classification:** CONFIRMED BUG (RUNTIME CRASH)
- **Affected component:** Frontend Teacher Statistics UI
- **File:** `apps/web/src/pages/TeacherStatisticsPage.jsx`
- **Lines:** 8–26, 455

**Expected behavior:**  
Trang `/teacher/statistics` phải render bình thường khi giáo viên truy cập, hiển thị danh sách lớp và kỳ thi phụ trách.

**Actual behavior:**  
Dòng 455 sử dụng icon `icon={Plus}` trong nút tạo bài thi mới, nhưng ở phần khai báo import đầu file (dòng 8–26) không có `Plus` từ `lucide-react`. Khi component render, trình duyệt ném lỗi `ReferenceError: Plus is not defined` và kích hoạt Error Boundary màu đỏ toàn trang.

**Evidence:**
Ảnh lỗi người dùng cung cấp từ production Render:
`ReferenceError: Plus is not defined at TeacherStatisticsPage-Bl4tiZlx.js:1:16346`

**Recommended direction:** Thêm `Plus` vào danh sách import từ `lucide-react` trong `TeacherStatisticsPage.jsx`.

---

### FINDING-009
- **Severity:** Medium
- **Classification:** DOCUMENTATION OVERCLAIM & RESOURCE LEAK
- **Affected component:** Storage Service
- **File:** `apps/api/src/services/storage/storage.service.js`
- **Function:** `cleanupSubmissionStorage`
- **Lines:** 61–72, 125–129

**Expected behavior:**  
Tài liệu `SYSTEM_REVIEW.md` tuyên bố: *"Rollback hoàn toàn... không bao giờ để lại file rác hoặc bản ghi mồ côi."*

**Actual behavior:**  
Khi bật cấu hình Cloudinary (`USE_CLOUDINARY=true`), hàm `saveOriginalSubmissionImage` tải ảnh lên Cloudinary (`uploadBufferToCloudinary`). Tuy nhiên, khi Prisma transaction thất bại, hàm bù trừ `cleanupSubmissionStorage` chỉ gọi:
```javascript
const relativeDir = `submissions/${namespace}`;
await storageService.deleteDirectory(relativeDir);
```
Hàm này chỉ xóa thư mục cục bộ trên ổ đĩa. Các ảnh đã đẩy lên Cloudinary không có cơ chế xóa rollback, biến thành tệp mồ côi vĩnh viễn trên Cloudinary.

**Recommended direction:** Bổ sung phương thức xóa thư mục/resource trên Cloudinary trong `cleanupSubmissionStorage`.

---

### FINDING-010
- **Severity:** Medium
- **Classification:** CONFIRMED BUG & METRIC INCONSISTENCY
- **Affected component:** Admin Dashboard Service & UI
- **File:** `apps/api/src/services/admin-dashboard.service.js`, `apps/web/src/pages/AdminDashboardPage.jsx`
- **Lines:** `admin-dashboard.service.js:224-226`, `AdminDashboardPage.jsx:928-930`

**Expected behavior:**  
Số lượng học sinh hiển thị trên thẻ tổng quan (Card) phải khớp chính xác với tổng số học sinh được phân bổ trong các khối lớp THCS (hiện tại là 91).

**Actual behavior:**  
Khi không chọn bộ lọc lớp, `whereStudent = {}`. Thẻ Card gọi `prisma.student.count({ where: {} })` và hiển thị **347** kèm nhãn *"347 thực có trong các lớp"*. Trong khi đó, phần thống kê khối lớp bên dưới chỉ đếm học sinh có trong các lớp (`c._count.enrollments`) nên hiển thị **91** ($91 + 0 + 0 + 0$). Sự chênh lệch 256 học sinh là do các bản ghi học sinh cũ/mồ côi trong bảng `Student` chưa từng được xếp lớp.

**Recommended direction:** Sửa `whereStudent` trong `admin-dashboard.service.js` để chỉ đếm học sinh có ghi danh trong các lớp của năm học hiện tại.

---

## 3. CANDIDATE IDENTITY AUDIT (PHẦN A CHI TIẾT)

| Câu hỏi kiểm toán | Trả lời thực tế từ mã nguồn | Dẫn chứng Code |
|---|---|---|
| **1. Nếu OMR đọc được SBD hợp lệ về hình thức nhưng thực tế đọc nhầm thì hệ thống có mặc định coi là hợp lệ?** | **CÓ.** Hệ thống coi là hợp lệ ngay lập tức và đặt `identityNeedsReview = false`. | `apps/api/src/services/submission.service.js:360` |
| **2. `identityNeedsReview` dựa vào yếu tố nào?** | **CHỈ DỰA VÀO VIỆC CÓ ĐỌC ĐƯỢC CHUỖI SBD HAY KHÔNG** (`!detectedStudentNumber`). Hoàn toàn không kiểm tra confidence, không kiểm tra tồn tại trong `ExamCandidate`. | `submission.service.js:360` |
| **3. Có kiểm tra SBD thuộc đúng `examId` không?** | **KHÔNG KIỂM TRA TRƯỚC KHI LƯU SUBMISSION.** Sau khi lưu xong, code mới chạy khối `try/catch` không chặn để auto-link. | `submission.service.js:579-620` |
| **4. Có kiểm tra student thuộc đúng lớp tham gia kỳ thi không?** | **CHỈ KIỂM TRA KHI AUTO-LINK CANDIDATE**, nhưng kiểm tra bằng heuristic lỏng lẻo. | `submission.service.js:585-601` |
| **5. Có khả năng tự động tạo `ExamCandidate` từ SBD đọc được không?** | **CÓ.** Nếu SBD chưa có trong `ExamCandidate`, code tự động gọi `prisma.examCandidate.create()`. | `submission.service.js:608-615` |
| **6. Heuristic auto-link gồm những gì?** | `code === SBD` \|\| `code.endsWith(SBD)` \|\| `emailPrefix.includes(SBD)` \|\| `(SBD.length >= 4 && code.includes(SBD))`. | `submission.service.js:597-601` |
| **7. Hai học sinh có thể cùng match một heuristic không?** | **CÓ THỂ.** Ví dụ học sinh A có mã `102` và học sinh B có mã `2102`, cùng match `endsWith("02")`. | `submission.service.js:598` |
| **8. Nếu có nhiều candidate phù hợp thì code chọn ai?** | Chọn phần tử đầu tiên mà hàm Javascript `.find()` duyệt trúng. Không có cơ chế cảnh báo ambiguous. | `submission.service.js:593` |
| **9. Nguy cơ: Bài của A $\rightarrow$ OMR đọc SBD B $\rightarrow$ gán bài cho B $\rightarrow$ status FINAL?** | **HOÀN TOÀN CÓ THỂ XẢY RA.** Trạng thái bài nộp là `FINAL` nếu các câu trả lời trắc nghiệm không có câu UNRESOLVED. | `submission.service.js:428` |
| **10. Nếu SBD tồn tại nhưng OMR confidence thấp thì xử lý thế nào?** | **BỎ QUA.** Node.js API không kiểm tra trường `confidence` của SBD do AI Service gửi về. | `submission.service.js:357-362` |
| **11. Có audit trail khi danh tính được auto-resolve không?** | **KHÔNG CÓ.** Khối auto-link candidate nằm trong `try/catch` âm thầm, không ghi audit log. | `submission.service.js:618-620` |
| **12. Có DB constraint ngăn 2 submission cùng được gán cho 1 candidate không?** | **KHÔNG CÓ.** Chỉ có `@@unique([examId, originalImageSha256])`. Cùng 1 candidate có thể có nhiều submission trong cùng 1 exam. | `schema.prisma:549` |

---

## 4. EXAM CODE / ANSWER KEY AUDIT (PHẦN B CHI TIẾT)

1. **Đọc nhầm mã đề:** Nếu OMR đọc nhầm mã đề `101` thành `107` và mã `107` có tồn tại trong danh sách mã đề của kỳ thi, hệ thống sẽ **chấp nhận mã 107** và chấm bài theo mã 107 mà không có bất kỳ cảnh báo nào (`submission.service.js:330-336`).
2. **Confidence mã đề:** API không thiết lập ngưỡng confidence tối thiểu cho mã đề. Chỉ cần trường `omrData.examCode.value` khác rỗng là được chấp nhận.
3. **Mã đề mờ:** Không khiến submission chuyển sang `PROVISIONAL`. Trạng thái `PROVISIONAL` chỉ kích hoạt khi `grading.unresolvedCount > 0` (tức là có câu hỏi trắc nghiệm không rõ ràng).
4. **Lớp xác minh thứ hai:** Không có. QR code in trên phiếu chỉ chứa metadata kỳ thi và số trang, hoàn toàn không có mã đề để đối soát chéo.
5. **Kịch bản sai sót:** Tình huống *"SBD đúng + mã đề sai nhưng tồn tại $\rightarrow$ chấm toàn bộ bằng answer key sai $\rightarrow$ status FINAL"* là **HOÀN TOÀN KHẢ THI** trong mã nguồn hiện tại.

---

## 5. QUEUE & REDIS FAILURE AUDIT (PHẦN C CHI TIẾT)

1. **Vị trí Job Queue:** Nằm hoàn toàn trên Redis thông qua thư viện BullMQ (`apps/api/src/queue/grading.queue.js:7-9`).
2. **Vị trí Batch-status:** Lưu trong Redis key `batch:<batchId>`, nếu lỗi thì lưu tạm vào `inMemoryBatchStore = new Map()`.
3. **Class InMemoryQueue:** **KHÔNG TỒN TẠI.** Không có bất kỳ class hay module nào tên là `InMemoryQueue` hay `InMemoryQueueManager` trong toàn bộ mã nguồn.
4. **Hành vi khi Redis không được cấu hình:**
   - Worker: Hàm `initGradingWorker()` kiểm tra `if (!isRedisConfigured()) return null;` và dừng ngay lập tức.
   - Enqueue: Hàm `enqueueBatchGrading` gọi `await gradingQueue.addBulk(jobs)` và văng lỗi kết nối Redis.
5. **Đánh giá:** Tuyên bố trong `SYSTEM_REVIEW.md` về việc "tự động fallback sang In-Memory Queue khi Redis offline" là **DOCUMENTATION OVERCLAIM**.

---

## 6. RACE CONDITION & IDEMPOTENCY AUDIT (PHẦN D CHI TIẾT)

- **Case 1 (Hai request tải cùng file ảnh đồng thời):** Xử lý an toàn. Cả hai cùng tính ra mã băm SHA-256 giống nhau. Request thứ hai vi phạm ràng buộc `@@unique([examId, originalImageSha256])` tại PostgreSQL (mã lỗi Prisma `P2002`). Khối `catch` tại `submission.service.js:548-560` bắt lỗi này và trả về bản ghi đã tạo thành công trước đó.
- **Case 2 (Worker xử lý xong nhưng crash trước khi ACK job):** BullMQ sẽ retry job theo cấu hình `attempts: 2`. Khi retry chạy lại, nó sẽ gặp lỗi `P2002` (duplicate SHA-256). Nhờ cơ chế bắt lỗi ở Case 1, job retry sẽ coi như thành công và không tạo bản ghi rác.
- **Case 3 (Hai ảnh khác nhau của cùng một thí sinh):** **LỖI THIẾT KẾ.** Do hash SHA-256 khác nhau, hệ thống chấp nhận cả 2 bức ảnh và tạo ra 2 bản ghi `ExamSubmission` cho cùng một học sinh trong cùng một kỳ thi. Hệ thống thiếu invariant: `1 candidate + 1 exam -> max 1 submission`.

---

## 7. OMR BOUNDARY ANALYSIS (PHẦN F & G CHI TIẾT)

Đối soát các giá trị biên dựa trên code thực tế tại `apps/ai-service/app/omr/bubble_reader.py`:

| Giá trị đầu vào | Phân loại thực tế | Giải thích logic theo code | Đánh giá an toàn |
|---|:---:|---|:---:|
| `A = 0.349` (others < 0.20) | `UNCERTAIN` | `len(strong) == 0`, `top1 >= 0.20`, `margin >= 0.07` | Hợp lý |
| `A = 0.350` (others < 0.20) | `MARKED (A)` | `len(strong) == 1`, `margin >= 0.12` | Bước nhảy biên tại đúng 0.35 |
| `A = 0.350, B = 0.199` | `MARKED (A)` | `len(strong) == 1`, $margin = 0.151 \ge 0.12$ | Chấp nhận ô A |
| `A = 0.350, B = 0.201` | `MARKED (A)` | `len(strong) == 1`, $margin = 0.149 \ge 0.12$ | B có vết mờ 20% vẫn nhận A |
| `A = 0.350, B = 0.231` | `UNCERTAIN` | `len(strong) == 1`, $margin = 0.119 < 0.12$ | Đúng (chuyển giáo viên xem) |
| `A = 0.360, B = 0.220` | `MARKED (A)` | `len(strong) == 1`, $margin = 0.140 \ge 0.12$ | Hợp lý |
| `A = 0.500, B = 0.360` | `MULTIPLE` | `len(strong) == 2`, `is_dominant = False` | Đúng (tô 2 ô rõ) |
| `A = 0.500, B = 0.350` | `MULTIPLE` | `len(strong) == 2`, `is_dominant = False` | Đúng |
| `A = 0.640, B = 0.350` | `MARKED (A)` | `is_dominant = True` ($0.64 \ge 0.60$, $margin = 0.29 \ge 0.28$, $B \le 0.45$) | Bỏ qua ô B, tự chọn A |
| **`A = 0.340, B = 0.330`** | **`BLANK`** | `len(strong) == 0`, $margin = 0.01 < 0.07 \rightarrow$ Nhánh else: `BLANK` | **SAI NGHIỆM TRỌNG (Mất điểm học sinh)** |

---

## 8. PUBLICATION IMMUTABILITY (PHẦN H CHI TIẾT)

1. **Khóa sau khi công bố:** Khi kỳ thi có `resultsPublishedAt !== null`:
   - `reviewSubmissionAnswer`: Bị chặn bởi `assertResultsNotPublished(submission.examId)` $\rightarrow$ Lỗi `RESULTS_PUBLISHED_LOCKED`.
   - `reviewSubmissionIdentity`: Bị chặn bởi `assertResultsNotPublished` $\rightarrow$ Lỗi `RESULTS_PUBLISHED_LOCKED`.
   - `deleteSubmission`: Bị chặn bởi `assertResultsNotPublished` $\rightarrow$ Lỗi `RESULTS_PUBLISHED_LOCKED`.
   - `putAnswerKey`: Bị chặn bởi điều kiện `submissionCount > 0` và `exam.status !== 'DRAFT'`.
2. **Điểm hở quy trình (Unpublish):**
   - Kỳ thi có thể bị gỡ công bố thông qua `unpublishExamResults` (`resultsPublishedAt` bị reset về `null`).
   - Sau khi unpublish, toàn bộ các hàm sửa điểm, phúc khảo, sửa SBD lại **hoạt động bình thường**.
   - Mặc dù có lưu vết tại `ExamResultPublicationLog`, tính chất "Bất biến vĩnh viễn" (True Immutability) không tồn tại ở tầng Database.

---

## 9. RBAC & BOLA MATRIX (PHẦN I CHI TIẾT)

| Tuyến đường API | Vai trò thử nghiệm | Kết quả phân quyền thực tế | Đánh giá an toàn |
|---|---|---|---|
| `GET /api/classes/:classId/students` | Teacher A truy cập lớp của Teacher B | **CHO PHÉP TRUY CẬP** (Trả về cả `initialPassword`) | **LỖI BẢO MẬT (BOLA/IDOR)** |
| `POST /api/classes/:classId/students` | Teacher A thêm học sinh lớp của Teacher B | **BỊ CHẶN 403** qua `requireClassStudentManagement` | An toàn |
| `GET /api/exams/:examId/submissions` | Teacher A xem danh sách bài thi Teacher B | **BỊ CHẶN 403** qua `assertExamAccess` | An toàn |
| `GET /api/submissions/:id` | Teacher A xem chi tiết bài nộp Teacher B | **BỊ CHẶN 403** qua `assertSubmissionAccess` | An toàn |
| `GET /api/submissions/:id` | SuperAdmin xem bài thi học sinh | **BỊ CHẶN 403** (`SUPER_ADMIN` bị cấm xem bài thi) | An toàn (Chính sách trường học) |
| `GET /api/submissions/:id/image` | Teacher A tải trực tiếp ảnh bài thi Teacher B | **BỊ CHẶN 403** qua `assertSubmissionAccess` | An toàn |
| `GET /api/teacher/class-statistics` | Teacher A xem thống kê lớp Teacher B | **BỊ LỌC BỎ** (Chỉ trả về các lớp thuộc `assignedClasses`) | An toàn |

---

## 10. UPLOAD & AUTHENTICATION SECURITY (PHẦN J & K CHI TIẾT)

1. **Upload Security:**
   - Dung lượng upload tối đa: 15MB/file (ảnh đơn) và 50 file $\times$ 15MB (batch upload).
   - Multer Storage: Toàn bộ sử dụng `memoryStorage()`, tiềm ẩn nguy cơ cạn kiệt RAM Node.js khi nhiều người dùng tải ảnh đồng thời.
   - Kiểm tra định dạng: Chỉ kiểm tra extension và MIME type chuỗi, không kiểm tra Magic Bytes nhị phân.
2. **JWT & Refresh Token:**
   - Access Token: Ký bằng HMAC SHA-256 với bí mật `JWT_ACCESS_SECRET`, thời hạn 15 phút.
   - Refresh Token: Lưu mã băm SHA-256 trong bảng `RefreshToken`, có thời hạn 7 ngày.
   - Rotation: Khi refresh thành công, token cũ được gán `revokedAt = now()` và sinh cặp token mới.
   - Token Reuse: Nếu dùng lại token đã revoke, hệ thống trả mã lỗi `401 REFRESH_TOKEN_REVOKED`. Tuy nhiên, hệ thống **chưa thu hồi cây token gia đình (Family Revocation)** đối với các token con đã sinh ra từ phiên đó.
   - Đổi mật khẩu: Khi đổi mật khẩu thành công qua `profile.service.js`, hệ thống tự động xóa toàn bộ refresh token của người dùng trong cơ sở dữ liệu (`prisma.refreshToken.deleteMany({ where: { userId } })`).

---

## 11. XÁC MINH CÁC TUYÊN BỐ TRONG SYSTEM_REVIEW (PHẦN L)

| Tuyên bố trong SYSTEM_REVIEW.md | Dẫn chứng Code thực tế | Kết luận kiểm toán |
|---|---|---|
| *"Tự động fallback sang In-Memory Queue khi Redis offline"* | `grading.worker.js:96-99`, `grading.queue.js:14-95` | **OVERCLAIM (Sai thực tế)** |
| *"Không bao giờ để lại file rác hoặc bản ghi mồ côi"* | `storage.service.js:125-129` (Cloudinary không được xóa khi DB fail) | **OVERCLAIM (Không đảm bảo với Cloud)** |
| *"identityNeedsReview bảo vệ khỏi gán nhầm thí sinh"* | `submission.service.js:360` (Chỉ check `!detectedStudentNumber`) | **OVERCLAIM (Vẫn bị gán nhầm nếu đọc sai)** |
| *"Homography triệt tiêu hoàn toàn góc nghiêng và độ méo"* | `perspective.py:27-58` (Phụ thuộc vào 4 marker; nếu giấy cong phi phẳng vẫn méo cục bộ) | **OVERCLAIM (Chỉ nắn được biến đổi affine/phối cảnh)** |
| *"Toàn bộ can thiệp giáo viên đều được audit"* | `submission.service.js:608-615` (Auto-link candidate không có audit log) | **PARTIAL (Chỉ audit khi giáo viên click sửa tay)** |
| *"100% không có Machine Learning / Deep Learning weights"* | `requirements.txt`, `apps/ai-service/app/omr/` | **VERIFIED (Đúng 100% là Classical CV)** |
| *"Bảo vệ BOLA/IDOR chặn SuperAdmin xem bài thi học sinh"* | `submission.service.js:49-51` | **VERIFIED (Chặn cứng 403)** |

---

## 12. KẾT QUẢ KIỂM THỬ THỰC TẾ (PHẦN M)

```text
Command: npm --prefix apps/api test
Environment: Node.js v24.19.0 on Windows (win32 10.0.19045)
Database: PostgreSQL (exam_grading_test)
Storage: ./storage-test
Test Files: 18 test files
Suites: 7 suites
Tests Passed: 172
Tests Failed: 0
Tests Skipped: 0
Duration: 155,099.88 ms (2 phút 35 giây)
Result: SUCCESS (Với bộ test tích hợp mock & synthetic)
```

> [!WARNING]
> **Giới hạn kiểm thử:** Bộ test 172 ca kiểm thử trên sử dụng dữ liệu giả lập (Synthetic images được sinh bằng vector từ PyMuPDF). Hệ thống **CHƯA TỪNG ĐƯỢC CHẠY KIỂM THỬ TẢI THỰC TẾ (Load Testing)** với 1.000 bài thi đồng thời và **CHƯA CÓ BỘ TEST VỚI ẢNH CHỤP CAMERA ĐIỆN THOẠI THỰC TẾ NGOÀI ĐỜI** (vốn có bóng tay, nếp nhăn giấy và độ nghiêng phi phẳng).

---

## 13. DANH MỤC KHẮC PHỤC ƯU TIÊN (PRIORITIZED REMEDIATION BACKLOG)

### Ưu tiên P0 (Nguy cơ sai lệch điểm số / Lộ dữ liệu nghiêm trọng)
1. **[Fix FINDING-001]** Chặn gán nhầm thí sinh: Nếu SBD đọc được không có trong `ExamCandidate` của kỳ thi, bắt buộc gán `identityNeedsReview = true` và `status = PROVISIONAL`. Xóa bỏ cơ chế fuzzy match tự động gán thí sinh.
2. **[Fix FINDING-004]** Vá lỗ hổng BOLA lộ mật khẩu: Gắn `requireClassStudentManagement` vào route `GET /api/classes/:classId/students` và loại bỏ trường `initialPassword` khỏi API response.
3. **[Fix FINDING-008]** Sửa lỗi crash trang thống kê: Thêm `import { Plus } from "lucide-react"` vào `TeacherStatisticsPage.jsx`.
4. **[Fix FINDING-002]** Bảo vệ mã đề: Nếu OMR đọc mã đề có confidence thấp hoặc kỳ thi có nhiều mã đề, bắt buộc kiểm tra cờ cảnh báo hoặc nhúng mã đề vào QR code.

### Ưu tiên P1 (Bảo mật, Tính toàn vẹn & Độ chịu lỗi)
1. **[Fix FINDING-005]** Chuyển Multer sang `diskStorage()` và kiểm tra Magic Bytes file ảnh, tránh sập OOM khi upload nhiều ảnh.
2. **[Fix FINDING-003]** Đính chính tài liệu và thêm thông báo lỗi rõ ràng khi Redis offline thay vì quảng cáo tính năng fallback ảo.
3. **[Fix FINDING-007]** Sửa ngưỡng OMR: Khi 2 ô có độ phủ tối gần bằng nhau ($> 0.20$), phân loại là `MULTIPLE` hoặc `UNCERTAIN`, không được phân loại là `BLANK`.
4. **[Fix FINDING-006]** Thiết lập ràng buộc 1 thí sinh chỉ có 1 bài nộp hợp lệ trong 1 kỳ thi.

### Ưu tiên P2 (Gia cố Hệ thống Production)
1. **[Fix FINDING-009]** Triển khai hàm xóa tài nguyên Cloudinary trong cơ chế rollback `cleanupSubmissionStorage`.
2. **[Fix FINDING-010]** Đồng bộ truy vấn học sinh trong `admin-dashboard.service.js` để chỉ đếm học sinh đang được xếp lớp trong năm học hiện tại.
3. Triển khai Family Refresh Token Revocation (thu hồi toàn bộ chuỗi token nếu phát hiện token bị tái sử dụng).

### Ưu tiên P3 (Bảo trì & Tối ưu hóa)
1. Xây dựng kịch bản kiểm thử tải E2E (k6 / Locust) mô phỏng 50 giáo viên nộp bài đồng thời.
2. Tách nhỏ các modal trong `TeacherClassesPage.jsx` thành component độc lập.
