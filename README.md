# 🎓 Digital Exam Grading V2

### Hệ thống số hóa tổ chức và chấm thi trắc nghiệm OMR chuẩn hóa Bộ GD&ĐT cho trường Trung học Cơ sở (THCS)

[![CI Pipeline](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml/badge.svg)](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml)
[![Docker Ready](https://img.shields.io/badge/docker-compose%20v2-2496ED?logo=docker&logoColor=white)](compose.yaml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-7.x-red.svg)](https://redis.io/)
[![Cloudinary](https://img.shields.io/badge/storage-Cloudinary%20SDK-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

---

## 📌 Giới thiệu

**Digital Exam Grading V2** là giải pháp phần mềm toàn diện hỗ trợ chuyển đổi số công tác **tổ chức kỳ thi, in phiếu trả lời trắc nghiệm, nhận dạng thị giác máy tính OMR (Optical Mark Recognition), chấm điểm tự động và công bố kết quả thi** chuyên biệt cho bậc **Trung học Cơ sở (THCS – Khối 6, 7, 8, 9)** theo Chương trình Giáo dục phổ thông mới (GDPT 2018).

### 🌟 Các Điểm Nhấn Đột Phá:
* 📄 **Mẫu phiếu trắc nghiệm chuẩn Bộ GD&ĐT 2025 (GDPT 2018):** Hỗ trợ đầy đủ **Phiếu 20 câu**, **Phiếu 40 câu** và **Phiếu chuẩn 3 phần mới nhất của Bộ GD&ĐT** (Phần I: 40 câu trắc nghiệm 4 lựa chọn; Phần II: 8 câu Đúng/Sai chấm điểm lũy tiến 0.1 - 0.25 - 0.5 - 1.0; Phần III: 6 câu trả lời ngắn điền số).
* 🧠 **Thị giác máy tính OMR (OpenCV & Homography):** Tự động nắn góc phối cảnh nghiêng (tới $25^\circ$), khử bóng đổ (Adaptive Thresholding), nhận dạng chính xác Số Báo Danh (SBD) 6 chữ số định dạng `KKLLSS`, Mã Đề Thi 3 chữ số và phân tích tỷ lệ tô quang học.
* ⚡ **Xử lý bất đồng bộ đa chế độ (Dual-mode Queue):** Hàng đợi **Redis + BullMQ** chấm song song hàng trăm bài thi chịu tải cao, tích hợp cơ chế tự động chuyển sang *Standalone Synchronous Fallback* khi hoạt động trên môi trường không có Redis (như Render Free Tier).
* ☁️ **Lưu trữ Cloudinary & Hậu kiểm trực quan (Human-in-the-loop Review):** Tự động trích xuất và hiển thị ảnh crop thực tế của các câu hỏi nghi vấn (tô mờ, tẩy xóa, tô đè) để giáo viên rà soát, lưu trữ an toàn trên Cloudinary CDN.
* 🏫 **Phân quyền RBAC 6 vai trò chuẩn trường THCS:** Thiết lập ma trận nghiệp vụ chặt chẽ giữa Quản trị viên, Hiệu trưởng, Phó Hiệu trưởng, Cán bộ khảo thí, Giáo viên chuyên môn (kèm vai trò Tổ trưởng chuyên môn) và Học sinh.
* 👥 **Chính sách phân quyền Lớp học & Học sinh (`/classes`):**
  * Ban Giám Hiệu (`VICE_PRINCIPAL`, `SUPER_ADMIN`): Toàn quyền CRUD lớp học và học sinh chính thức.
  * Giáo viên chuyên môn (`TEACHER`): Xem đầy đủ học sinh lớp mình phụ trách (badge *Lớp phụ trách*); đối với các lớp khác trong trường, giáo viên **ĐƯỢC XEM** danh sách học sinh và SBD ở chế độ **Chỉ xem (Read-only)** (badge *Chỉ xem*), **TUYỆT ĐỐI KHÔNG CÓ QUYỀN CRUD** ở lớp khác.
* 📊 **Trung tâm Thống kê & Bộ lọc Đa chiều:** Thanh lọc tương tác 4 chiều (**Khối, Lớp, Môn học, Giáo viên**) với phản ánh dữ liệu tức thì: phổ điểm (Giỏi, Khá, Trung bình, Dưới TB), điểm trung bình, danh sách bài thi và bài nộp OMR.
* 📑 **Quản lý danh sách học sinh thông minh:** Chuẩn hóa Số Báo Danh 6 số theo thứ tự tên tiếng Việt chuẩn ABC và nạp danh sách học sinh tự động từ file Excel (tương thích vnEdu, SMAS).

---

## 📑 Mục lục

1. [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
2. [Mô hình phân quyền RBAC](#-mô-hình-phân-quyền-rbac)
3. [Mẫu phiếu trả lời trắc nghiệm chuẩn BGD 2025](#-mẫu-phiếu-trả-lời-trắc-nghiệm-chuẩn-bgd-2025)
4. [Bộ lọc thống kê đa chiều](#-bộ-lọc-thống-kê-đa-chiều)
5. [Quy trình nghiệp vụ cốt lõi](#-quy-trình-nghiệp-vụ-cốt-lõi)
6. [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
7. [Cấu trúc Monorepo](#-cấu-trúc-monorepo)
8. [Cài đặt & Khởi chạy Local](#-cài-đặt--khởi-chạy-local)
9. [Kiểm thử tự động](#-kiểm-thử-tự-động)
10. [Triển khai Production](#-triển-khai-production)
11. [Tài khoản kiểm thử mặc định](#-tài-khoản-kiểm-thử-mặc-định)

---

# 🏛 Kiến trúc hệ thống

Dự án được cấu trúc theo mô hình **Monorepo đa tầng**:

```text
DigitalExamGrading/
│
├── apps/
│   ├── api/          Node.js 22+ / Express 5 / Prisma 7 / PostgreSQL / Cloudinary / BullMQ
│   ├── ai-service/   Python 3.11 / FastAPI / OpenCV 4 / NumPy / Perspective Homography
│   └── web/          React 19 / Vite 8 / Tailwind CSS / Lucide React SPA
│
├── compose.yaml      Docker Compose (PostgreSQL 17, Redis 7, Python AI Service)
└── render.yaml       Render Cloud Blueprint Specification
```

### Luồng Xử lý Dữ liệu Tổng thể:

```text
       [Người dùng: BGH / Giáo viên / Khảo thí / Học sinh]
                                │
                                ▼
                   [React 19 Web SPA Client]
                                │
                                ▼ HTTPS (JWT Bearer Token)
                   [Express 5 RESTful API Gateway]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 [PostgreSQL 17 DB]     [Cloudinary Cloud]      [Queue Engine]
 (Prisma 7 ORM)        (Scan Images & Crops)    (BullMQ + Redis 7)
                                                        │
                                                        ▼
                                             [Grading Worker Engine]
                                                        │
                                                        ▼ IPC / HTTP
                                             [FastAPI AI Service]
                                                        │
                                                        ▼
                                             [OpenCV 4 Computer Vision]
                                             (Homography / Bubble Scan)
```

---

# 👥 Mô hình phân quyền RBAC

Hệ thống thiết lập đúng **6 vai trò người dùng (UserRole)** phù hợp chặt chẽ với cơ cấu vận hành của trường THCS:

| UserRole | Tên hiển thị | Trách nhiệm chính trong hệ thống |
|---|---|---|
| `SUPER_ADMIN` | Quản trị hệ thống | Quản trị hạ tầng, cơ cấu phòng ban, tài khoản quản trị, bảo mật và sao lưu dữ liệu. |
| `PRINCIPAL` | Hiệu trưởng | Giám sát toàn trường; phê duyệt tối cao công bố điểm kỳ thi Cuối kỳ (`FINAL`); xem báo cáo và phổ điểm. |
| `VICE_PRINCIPAL` | Phó Hiệu trưởng | Quản lý chuyên môn giáo viên; phân công giảng dạy; toàn quyền quản lý Lớp học và Học sinh; phê duyệt công bố điểm kỳ thi Giữa kỳ (`MIDTERM`). |
| `EXAM_OFFICER` | Cán bộ khảo thí | Khởi tạo và điều hành kỳ thi tập trung toàn trường (`MIDTERM`, `FINAL`); tải và chấm bài OMR; đối soát danh sách thí sinh. |
| `TEACHER` | Giáo viên chuyên môn | Tạo bài kiểm tra thường xuyên (`REGULAR`, `MIN_15`); chấm bài lớp phụ trách; đảm nhận vai trò **Tổ trưởng chuyên môn** duyệt đáp án gốc khi được phân công. |
| `STUDENT` | Học sinh | Tra cứu điểm số cá nhân và xem chi tiết kết quả câu trả lời sau khi kỳ thi đã được phê duyệt công bố chính thức. |

### 👨‍🏫 Cơ chế Tổ trưởng Chuyên môn (Subject Leader)
Tổ trưởng chuyên môn không phải là một UserRole riêng biệt mà được định danh qua cờ:
```text
Teacher.isSubjectLeader = true  VÀ  Teacher.primarySubjectId = Exam.subjectId
```
**Quy tắc:** Chỉ Giáo viên được giao nhiệm vụ Tổ trưởng đúng môn thi mới có quyền phê duyệt Bảng đáp án gốc (Master AnswerKey). Ban Giám Hiệu và Khảo thí không được duyệt thay để đảm bảo tính độc lập sư phạm.

### 🏫 Phân quyền Quản lý Lớp học & Học sinh (`/classes`)
* **Ban Giám Hiệu (`VICE_PRINCIPAL`, `SUPER_ADMIN`):** Toàn quyền Tạo lớp, Sửa lớp, Xóa lớp, Thêm học sinh, Import Excel, Chuẩn hóa SBD 6 số.
* **Giáo viên chuyên môn (`TEACHER`):**
  * **Lớp phụ trách:** Gắn huy hiệu xanh `"Lớp phụ trách"`. Xem đầy đủ danh sách học sinh, Số báo danh, tài khoản/mật khẩu tra cứu để hỗ trợ phòng thi và chấm điểm.
  * **Lớp khác trong trường:** Gắn huy hiệu xám `"Chỉ xem"`. Giáo viên **được quyền xem** danh sách học sinh để đối chiếu, nhưng **tuyệt đối KHÔNG có quyền CRUD** (ẩn nút Tạo lớp, Sửa lớp, Xóa lớp, Thêm học sinh, Import Excel, Chuẩn hóa SBD, Xóa tất cả; ẩn cột Thao tác và checkbox chọn).

---

# 📄 Mẫu phiếu trả lời trắc nghiệm chuẩn BGD 2025

Hệ thống tích hợp bộ tạo phiếu PDF vector A4 chất lượng cao (300 DPI) gồm 3 loại mẫu phiếu:

### 1. Phiếu BGD 2025 Chuẩn GDPT 2018 (3 Phần Chuyên sâu)
Thiết kế theo cấu trúc đề thi trắc nghiệm mới nhất của Bộ Giáo dục & Đào tạo:
* **Phần I — Câu trắc nghiệm nhiều phương án lựa chọn (40 câu):** 4 lựa chọn A, B, C, D (chọn 1 phương án đúng).
* **Phần II — Câu trắc nghiệm Đúng / Sai (8 câu hỏi):** Mỗi câu gồm 4 ý diễn đạt độc lập **a, b, c, d** (chọn Đúng hoặc Sai).
  * **Quy tắc chấm điểm lũy tiến chuẩn Bộ GD&ĐT:**
    * Đúng 1 ý: tính $0.1$ điểm.
    * Đúng 2 ý: tính $0.25$ điểm.
    * Đúng 3 ý: tính $0.5$ điểm.
    * Đúng cả 4 ý: tính $1.0$ điểm tối đa.
* **Phần III — Câu trắc nghiệm trả lời ngắn / Điền số (6 câu hỏi):** Khung lưới số có dấu âm ($-$), dấu dương ($+$), phần nguyên và phần số thập phân.

### 2. Phiếu 20 câu & Phiếu 40 câu trắc nghiệm
* Tối ưu cho các bài kiểm tra 15 phút, kiểm tra thường xuyên hoặc bài thi 1 tiết với 4 lựa chọn A, B, C, D.

### Đặc điểm Kỹ thuật Phiếu OMR:
* **Khổ giấy:** A4 (210 x 297 mm), in tỉ lệ thực `Actual Size 100%`.
* **Corner Fiducial Markers:** 4 dấu vuông đen $10 \times 10\text{ mm}$ tại 4 góc giúp OpenCV nắn chỉnh góc phối cảnh khi chụp bị nghiêng góc tới $25^\circ$.
* **Mã nhận diện Barcode / QR:** Tự động định danh kỳ thi, mã môn, loại phiếu để tự động khớp lưới chấm.
* **Số Báo Danh 6 số (`KKLLSS`):** `KK` (Mã khối: 06, 07, 08, 09), `LL` (Số thứ tự lớp trong khối), `SS` (Số thứ tự học sinh).

---

# 📊 Bộ lọc thống kê đa chiều

Trang Thống kê hệ thống (`/statistics` và `/admin/dashboard`) trang bị thanh bộ lọc tương tác 4 chiều:

```text
[BỘ LỌC ĐA CHIỀU]
  ├── Theo Khối:      Tất cả khối học, Khối 6, Khối 7, Khối 8, Khối 9
  ├── Theo Lớp học:   Tất cả lớp (Tự động lọc danh sách lớp theo khối đã chọn)
  ├── Theo Môn học:   Tất cả môn (Toán học, Ngữ văn, Tiếng Anh, Hóa học, Tin học...)
  └── Theo Giáo viên: Tất cả giáo viên phụ trách
```

* **Cập nhật số liệu Real-time:** Phổ điểm chuẩn sư phạm (Giỏi $\ge 8.0$, Khá $6.5 - 7.9$, Trung bình $5.0 - 6.4$, Dưới TB $< 5.0$), điểm trung bình toàn diện, tổng số kỳ thi, bài nộp và trạng thái chấm OMR.
* **Nút "Đặt lại bộ lọc":** Khôi phục trạng thái mặc định chỉ với 1 cú click.

---

# 🔄 Quy trình nghiệp vụ cốt lõi

### 1. Bài kiểm tra thường xuyên (`REGULAR`, `MIN_15`)
1. Giáo viên tạo đề kiểm tra cho lớp mình phụ trách.
2. Nhập đáp án cho các mã đề.
3. Xuất phiếu OMR và tổ chức làm bài.
4. Chụp/quét ảnh bài thi tải lên hệ thống.
5. Xử lý câu hỏi nghi vấn tại giao diện Review.
6. Đóng kỳ thi và **Giáo viên trực tiếp công bố điểm** cho học sinh tra cứu.

### 2. Kỳ thi Giữa kỳ tập trung (`MIDTERM`)
1. Cán bộ khảo thí khởi tạo kỳ thi tập trung cho toàn khối/nhiều lớp.
2. **Phê duyệt đáp án gốc:** Tổ trưởng chuyên môn thẩm định và ấn phê duyệt.
3. Chấm hàng loạt qua hàng đợi BullMQ/Redis.
4. Hậu kiểm kỹ thuật và rà soát số báo danh thí sinh.
5. Cán bộ khảo thí gửi yêu cầu phê duyệt công bố điểm.
6. **Phó Hiệu trưởng phê duyệt:** Thực hiện giao dịch nguyên tử (Atomic Transaction) công bố điểm chính thức cho toàn trường.

### 3. Kỳ thi Cuối kỳ tập trung (`FINAL`)
1. Cán bộ khảo thí khởi tạo kỳ thi và nạp danh sách thí sinh.
2. Tổ trưởng chuyên môn phê duyệt bảng đáp án gốc.
3. Chấm bài tập trung qua OMR AI Engine và hoàn tất hậu kiểm bài thi.
4. **Vòng 1 (Sơ duyệt):** Phó Hiệu trưởng rà soát chuyên môn và chuyển tiếp lên Hiệu trưởng.
5. **Vòng 2 (Phê duyệt tối cao):** Hiệu trưởng ký duyệt công bố kết quả thi chính thức.

---

# 🛠 Công nghệ sử dụng

| Tầng công nghệ | Danh mục công nghệ |
|---|---|
| **Frontend Web** | React 19, JavaScript (ES Modules), Vite 8, Tailwind CSS, Lucide React, Axios |
| **Backend API** | Node.js 22+/24+, Express 5, Prisma ORM 7, Zod, JWT, bcrypt, PDFKit |
| **Cơ sở dữ liệu** | PostgreSQL 17 (Hỗ trợ Neon Serverless Postgres và Render Postgres) |
| **Hàng đợi & Cache** | Redis 7 + BullMQ (Kèm Dual-mode Standalone Synchronous Fallback) |
| **Thị giác máy tính AI** | Python 3.11, FastAPI, OpenCV 4, NumPy, Pillow, Homography Perspective Warping |
| **Lưu trữ đám mây** | Cloudinary SDK (Tự động upload ảnh bài scan, ảnh crop câu hỏi và thumbnail) |
| **Kiểm thử tự động** | Node Test Runner, Supertest, Pytest, ESLint |
| **Triển khai hạ tầng** | Docker, Docker Compose, Render Cloud (Blueprint `render.yaml`) |

---

# 📁 Cấu trúc Monorepo

```text
DigitalExamGrading/
├── apps/
│   ├── api/                          # RESTful API Backend Service
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Mô hình dữ liệu PostgreSQL THCS
│   │   │   └── migrations/           # Lịch sử Database Migrations
│   │   ├── src/
│   │   │   ├── config/               # Cấu hình Prisma, Cloudinary, Redis
│   │   │   ├── controllers/          # Controllers (Auth, Exam, Class, Submission...)
│   │   │   ├── middlewares/          # Auth, RBAC, Upload, Error handler
│   │   │   ├── routes/               # API Routes bảo vệ theo quyền
│   │   │   ├── services/             # Nghiệp vụ chấm thi, OMR, Excel, Lớp học...
│   │   │   └── utils/                # BGD 2025 Answer Sheet Layout, SBD Generator...
│   │   └── tests/                    # 18 test suites / 173 ca kiểm thử API
│   │
│   ├── ai-service/                   # Thị giác máy tính nhận dạng OMR
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI Endpoints
│   │   │   └── omr/                  # Thuật toán Homography & Bubble Scanner
│   │   └── tests/                    # 37 ca kiểm thử thị giác máy tính OpenCV
│   │
│   └── web/                          # Frontend SPA Client
│       ├── src/
│       │   ├── api/                  # Axios Client & Token Interceptors
│       │   ├── components/           # UI Components, AppHeader, Modals, Badges...
│       │   ├── context/              # AuthContext quản lý session
│       │   ├── pages/                # Giao diện theo vai trò người dùng
│       │   └── utils/                # Enum mappers, Vietnamese helpers
│       └── package.json
│
├── compose.yaml                      # Docker Compose chạy PostgreSQL, Redis, AI Service
├── render.yaml                       # Blueprint triển khai Render Cloud tự động
└── README.md                         # Tài liệu hướng dẫn dự án
```

---

# 🚀 Cài đặt & Khởi chạy Local

### 1. Yêu cầu tiên quyết
* Node.js `>= 22.0.0` (Khuyến nghị Node.js 24 LTS).
* Python `3.11` (Khuyến nghị chạy AI Service qua Docker).
* Docker Desktop hoặc Docker Engine.
* Git.

### 2. Clone mã nguồn & Cài đặt thư viện
```bash
git clone https://github.com/Kad1711/DigitalExamGrading.git
cd DigitalExamGrading

# Cài đặt toàn bộ dependencies
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

### 3. Cấu hình biến môi trường
Tạo file `apps/api/.env`:
```env
PORT=5000
NODE_ENV=development

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/exam_grading_db?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/exam_grading_test?schema=public"

JWT_ACCESS_SECRET="dev_access_secret_super_secure_key_12345"
JWT_REFRESH_SECRET="dev_refresh_secret_super_secure_key_67890"

AI_SERVICE_URL="http://127.0.0.1:8000"
REDIS_URL="redis://127.0.0.1:6379"

# Cấu hình Cloudinary (Tùy chọn cho Local, bắt buộc trên Production)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

CORS_ORIGIN="http://localhost:5173"
```

Tạo file `apps/web/.env`:
```env
VITE_API_URL="http://localhost:5000"
```

### 4. Khởi động hạ tầng Docker
```bash
docker compose up -d
```
Lệnh này sẽ khởi động:
* **PostgreSQL:** `localhost:5433`
* **Redis:** `localhost:6379`
* **AI Service:** `http://127.0.0.1:8000`

### 5. Khởi tạo Cơ sở dữ liệu Prisma
```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

### 6. Khởi chạy môi trường Phát triển
Từ thư mục gốc:
```bash
npm run dev
```
* **Frontend Web:** `http://localhost:5173`
* **Backend API:** `http://localhost:5000`
* **AI Service Swagger:** `http://127.0.0.1:8000/docs`

---

# 🧪 Kiểm thử tự động

### 1. Kiểm thử Backend API (173 Tests)
Chạy trên cơ sở dữ liệu cô lập `exam_grading_test`:
```bash
npm --prefix apps/api test
```
* Kết quả: **173/173 tests PASSED (100%)**.

### 2. Kiểm thử Thị giác máy tính AI (37 Tests)
```bash
docker exec -e PYTHONPATH=. digital_exam_ai pytest tests/
```
* Kết quả: **37/37 tests PASSED (100%)**.

### 3. Kiểm thử Biên dịch Frontend
```bash
npm --prefix apps/web run build
```
* Kết quả: `vite build` **hoàn tất sạch 100% không cảnh báo lỗi**.

---

# 🌐 Triển khai Production

Hệ thống được thiết kế tối ưu để triển khai trơn tru trên nền tảng **Render Cloud** hoặc **VPS Docker**:

* **Web Service:** Static Site SPA trên Render (Publish directory: `dist`, Build command: `npm install && npm run build`).
* **API Service:** Node.js Web Service trên Render (Build command: `npm install && npx prisma generate`, Start command: `node src/server.js`).
* **Database:** PostgreSQL Managed Service (Render PostgreSQL hoặc Neon Serverless Postgres).
* **Cloud Storage:** Lưu trữ bài thi scan và ảnh crop câu hỏi nghi vấn qua **Cloudinary CDN**.

---

# 🔑 Tài khoản kiểm thử mặc định

Khi chạy seed dữ liệu mẫu, hệ thống tự động khởi tạo các tài khoản chuẩn THCS:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Ghi chú nghiệp vụ |
|---|---|:---:|---|
| `SUPER_ADMIN` | `admin@digitalexam.local` | `Admin@123` | Quản trị viên cấp cao toàn quyền |
| `PRINCIPAL` | `hieutruong@digitalexam.local` | `Admin@123` | Hiệu trưởng (Phê duyệt Cuối kỳ) |
| `VICE_PRINCIPAL` | `hieupho@digitalexam.local` | `Admin@123` | Phó Hiệu trưởng (Quản lý GV, Lớp học, duyệt Giữa kỳ) |
| `EXAM_OFFICER` | `khaothi@digitalexam.local` | `Admin@123` | Cán bộ khảo thí (Tạo kỳ thi tập trung, chấm OMR) |
| `TEACHER` | `toan_leader@digitalexam.local` | `Admin@123` | Tổ trưởng chuyên môn Toán (Duyệt đáp án Toán) |
| `TEACHER` | `van_leader@digitalexam.local` | `Admin@123` | Tổ trưởng chuyên môn Ngữ văn |
| `TEACHER` | `giaovien1@digitalexam.local` | `Admin@123` | Giáo viên chuyên môn Toán |
| `STUDENT` | `hs6a01@digitalexam.local` | `123456` | Học sinh lớp 6A (SBD: `060101`) |

---

# 📄 Giấy phép Bản quyền (License)

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**.

<p align="center">
  <b>Digital Exam Grading V2</b><br/>
  Hệ thống Chấm thi Trắc nghiệm OMR Chuyên biệt cho Trường Trung học Cơ sở
</p>
