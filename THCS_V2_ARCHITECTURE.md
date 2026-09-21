# KIẾN TRÚC HỆ THỐNG DIGITAL EXAM GRADING — THCS V2

> **Định vị sản phẩm:** Hệ thống hỗ trợ tổ chức và chấm thi trắc nghiệm OMR chuyên biệt cho trường Trung học Cơ sở (THCS).

---

## 1. Phạm vi nghiệp vụ & Mô hình trường học (Domain Scope)

Hệ thống được tái định hình tập trung hoàn toàn vào bậc học **Trung học Cơ sở (THCS)**:
- **Khối lớp:** Chỉ bao gồm **Khối 6, Khối 7, Khối 8, Khối 9**. Toàn bộ dữ liệu, phân cấp và luồng xử lý liên quan đến THPT (Khối 10, 11, 12), đại học, điểm rèn luyện, học phí, điểm danh, thời khóa biểu và thi tuyển sinh đã được tinh gọn triệt để.
- **Nghiệp vụ cốt lõi:**
  1. Tổ chức và chấm bài kiểm tra thường xuyên của Giáo viên bộ môn (15 phút, thường xuyên).
  2. Tổ chức các đợt thi tập trung định kỳ toàn trường (Giữa kỳ - MIDTERM, Cuối kỳ - FINAL) do Ban Giám Hiệu và Cán bộ Khảo thí điều hành.
  3. Nhận dạng thị giác máy tính OMR (OpenCV Computer Vision) với khả năng nắn chỉnh góc phối cảnh, tự động dò khung định vị (fiducial markers) và hiệu chỉnh độ đậm nhạt (adaptive threshold).
  4. Hàng đợi chấm hàng loạt bất đồng bộ (BullMQ + Redis) chịu tải cao, theo dõi tiến độ chấm theo thời gian thực.
  5. Quy trình hậu kiểm người chấm (Human Review): can thiệp các câu hỏi nghi ngờ (UNCERTAIN), tô đè (MULTIPLE) và nhận dạng lại Số Báo Danh (SBD).
  6. Ma trận phê duyệt công bố điểm chặt chẽ: Tổ trưởng chuyên môn duyệt đáp án gốc, Phó Hiệu trưởng duyệt Giữa kỳ, Hiệu trưởng duyệt Cuối kỳ.
  7. Tra cứu kết quả học sinh an toàn, chống rò rỉ dữ liệu chéo lớp/chéo học sinh.
  8. Thống kê, phân tích phổ điểm và độ phân cách câu hỏi.

---

## 2. Mô hình Phân quyền RBAC (6 Vai trò chuẩn)

Hệ thống tinh gọn thành đúng **6 vai trò người dùng (UserRole)**:

| Vai trò (UserRole) | Định danh hiển thị | Trách nhiệm chính trong mô hình THCS |
|---|---|---|
| `SUPER_ADMIN` | Quản trị viên cấp cao | Quản trị hạ tầng, tài khoản quản lý BGH, sao lưu dữ liệu, giám sát an toàn hệ thống. |
| `PRINCIPAL` | Hiệu trưởng | Phê duyệt công bố điểm kỳ thi Cuối kỳ (FINAL); giám sát toàn diện báo cáo phổ điểm toàn trường. |
| `VICE_PRINCIPAL` | Phó Hiệu trưởng chuyên môn | Quản lý chuyên môn giáo viên, phân công khối lớp/tổ chuyên môn; phê duyệt công bố điểm kỳ thi Giữa kỳ (MIDTERM); sơ duyệt Cuối kỳ (FINAL). |
| `EXAM_OFFICER` | Cán bộ khảo thí | Tạo và tổ chức các kỳ thi chính quy toàn trường (MIDTERM, FINAL); tải ảnh bài thi hàng loạt và kích hoạt worker OMR; gán danh sách thí sinh. |
| `TEACHER` | Giáo viên bộ môn | Tạo bài kiểm tra thường xuyên (`REGULAR`, `MIN_15`) cho lớp phụ trách; chấm bài; hậu kiểm ảnh crop câu hỏi nghi vấn.<br>*(Nếu có `isSubjectLeader = true`: đảm nhiệm vai trò **Tổ trưởng chuyên môn** duyệt bảng đáp án gốc).* |
| `STUDENT` | Học sinh | Tra cứu điểm số, xem chi tiết kết quả câu trả lời an toàn (khi kỳ thi đã được phê duyệt công bố; không hiển thị ảnh scan thô, chức năng xem ảnh scan trực tiếp thuộc lộ trình giai đoạn sau). |

### Cơ chế Tổ trưởng chuyên môn (Subject Leader)
- Quyền hạn Tổ trưởng không phụ thuộc vào chuỗi ký tự hiển thị (`title`), mà được định danh bằng cờ nghiệp vụ tường minh:
  ```prisma
  model Teacher {
    // ...
    isSubjectLeader Boolean @default(false)
    primarySubjectId String?
  }
  ```
- **Điều kiện duyệt bảng đáp án gốc (Master AnswerKey):** Chỉ Giáo viên được phân công làm Tổ trưởng chuyên môn phụ trách đúng môn học của kỳ thi (`TEACHER` với `teacher.isSubjectLeader === true` VÀ `teacher.primarySubjectId === exam.subjectId`) mới có quyền phê duyệt bảng đáp án gốc. Giáo viên thông thường, Cán bộ khảo thí, Hiệu trưởng, Hiệu phó và Quản trị viên bị từ chối phê duyệt theo quy trình chuẩn.

---

## 3. Quy trình Thi & Máy trạng thái (Exam Workflows)

```
[DRAFT]  --->  [PUBLISHED]  --->  [CLOSED]  --->  [PUBLICATION APPROVED]  --->  [ARCHIVED]
(Thiết lập)    (Chấm bài OMR)     (Khóa bài thi)   (Phê duyệt & Công bố điểm)   (Lưu trữ hồ sơ)
```

### Quy trình A: Bài kiểm tra thường xuyên của Giáo viên (`REGULAR`, `MIN_15`)
1. Giáo viên tạo đề kiểm tra cho lớp được phân công giảng dạy (`classId`).
2. Thiết lập mã đề và đáp án.
3. Phát hành (`PUBLISHED`), quét ảnh bài thi hoặc tải ảnh lên.
4. Xử lý các câu hỏi nghi ngờ trong màn hình Review.
5. Đóng kỳ thi (`CLOSED`).
6. Kiểm tra điều kiện công bố (Section 4): Nếu 100% bài đạt trạng thái `FINAL` và không có SBD trùng $\rightarrow$ Giáo viên trực tiếp ấn **Công bố kết quả** (`resultsPublishedAt = NOW()`).

---

### Quy trình B: Kỳ thi Giữa kỳ tập trung (`MIDTERM`)
1. Cán bộ khảo thí (`EXAM_OFFICER`) tạo kỳ thi tập trung cho khối/nhiều lớp (`examClasses`).
2. Nhập bảng đáp án gốc cho các mã đề (001, 002, 003, ...).
3. **Phê duyệt đáp án gốc:** Tổ trưởng bộ môn (`isSubjectLeader = true`) kiểm tra và phê duyệt (`answerKeyApprovedAt = NOW()`).
4. Phát hành (`PUBLISHED`) và chấm hàng loạt thông qua worker BullMQ/Redis.
5. Hậu kiểm bài thi và đối soát số báo danh thí sinh.
6. Đóng kỳ thi (`CLOSED`).
7. Cán bộ khảo thí gửi yêu cầu phê duyệt công bố $\rightarrow$ Trạng thái chuyển thành `PENDING_VICE_PRINCIPAL`.
8. **Phó Hiệu trưởng phê duyệt:**
   - Khi Phó Hiệu trưởng ấn **Phê duyệt**: Hệ thống thực hiện giao dịch nguyên tử (Atomic Transaction):
     - Ghi nhận `publicationApprovalStatus = "APPROVED"`
     - Tự động gán `resultsPublishedAt = NOW()` và `resultsPublishedByUserId = vp.id`
     - Điểm số lập tức mở cho học sinh tra cứu.
   - Nếu từ chối: Bắt buộc nhập lý do từ chối $\rightarrow$ `publicationApprovalStatus = "REJECTED"`.

---

### Quy trình C: Kỳ thi Cuối kỳ tập trung (`FINAL`)
1. Cán bộ khảo thí (`EXAM_OFFICER`) khởi tạo kỳ thi và nạp danh sách thí sinh.
2. Tổ trưởng bộ môn thẩm định và phê duyệt bảng đáp án gốc.
3. Chấm tập trung qua hệ thống nhận dạng OMR AI, hoàn tất hậu kiểm kết quả.
4. Đóng kỳ thi (`CLOSED`).
5. Cán bộ khảo thí gửi yêu cầu phê duyệt công bố $\rightarrow$ Trạng thái chuyển thành `PENDING_VICE_PRINCIPAL`.
6. **Vòng 1 — Phó Hiệu trưởng rà soát chuyên môn:**
   - Phó Hiệu trưởng kiểm tra dữ liệu điểm, tỷ lệ làm bài.
   - Nhấn **Chuyển Hiệu trưởng phê duyệt** $\rightarrow$ Trạng thái chuyển thành `PENDING_PRINCIPAL`.
7. **Vòng 2 — Hiệu trưởng phê duyệt tối cao:**
   - Hiệu trưởng kiểm tra và ký duyệt công bố.
   - Giao dịch nguyên tử:
     - Ghi nhận `publicationApprovalStatus = "APPROVED"`
     - Ghi nhận `principalApprovedAt = NOW()`
     - Tự động kích hoạt công bố điểm: `resultsPublishedAt = NOW()`
     - Học sinh và phụ huynh xem được điểm số chính thức.

---

## 4. Tính Bất Biến của Bảng Đáp Án (AnswerKey Immutability)

Để ngăn chặn hoàn toàn sai lệch điểm sau khi bài thi đã được nạp:
1. **Khóa đáp án khi đã có bài thi:** Ngay khi kỳ thi phát sinh bài nộp (`submissionCount > 0`), mọi hành vi chỉnh sửa/xóa/nhập đè đáp án đều bị chặn (`ANSWER_KEY_IMMUTABLE_ONCE_SUBMISSIONS_EXIST`, HTTP 409).
2. **Hủy phê duyệt khi thay đổi dự thảo:** Nếu đề thi ở trạng thái `DRAFT` và chưa có bài nộp, khi giáo viên cập nhật đáp án, cờ phê duyệt đáp án gốc sẽ tự động reset về `null` để bảo đảm tính toàn vẹn.

---

## 5. Kiến trúc Công nghệ & Hạ tầng

```
[React 19 + Tailwind CSS] (Vite Frontend :5173)
           │
           │ RESTful API (JWT Bearer Token)
           ▼
[Express 5 + Prisma 7 ORM] (Backend API :5000)
     │                     │
     │ BullMQ Job          │ PostgreSQL Driver
     ▼                     ▼
[Redis Cache/Queue :6379]   [PostgreSQL Database :5433]
     │                      (exam_grading_db / exam_grading_test)
     │ HTTP IPC
     ▼
[FastAPI + OpenCV Python Engine :8000]
(37/37 Automated CV Tests: Corner markers, perspective warping, bubble calibration)
```

---

## 6. Kiểm định Chất lượng (Test Verification)

- **Backend API & Nghiệp vụ:**
  - Tổng số test suites: **18 suites**
  - Tổng số ca kiểm thử: **173 tests**
  - Tỷ lệ đạt: **173/173 PASSED (100%)**
  - Môi trường: DB cô lập `exam_grading_test`, cấm hoàn toàn chạy kiểm thử trên DB sản xuất.
- **Thị giác máy tính (AI Core OMR):**
  - Tổng số ca kiểm thử: **37 tests**
  - Tỷ lệ đạt: **37/37 PASSED (100%)**
  - Độ chính xác tọa độ bubble, bù xoay giấy thi (skew correction), xử lý bóng đổ (adaptive threshold).
- **Giao diện người dùng (Frontend Web):**
  - Linter: **0 lỗi** (0 errors, 41 files).
  - Production Build: **Thành công** (`vite build` hoàn tất không lỗi).
