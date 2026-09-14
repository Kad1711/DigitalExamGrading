# 🎓 Digital Exam Grading V1
### Hệ Thống Chấm Điểm Bài Thi Trắc Nghiệm THPT Tự Động Bằng Thị Giác Máy Tính (Computer Vision & OMR)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Digital Exam Grading** là nền tảng toàn diện hỗ trợ các trường THPT, trung tâm khảo thí và giáo viên số hóa quy trình tổ chức thi: từ phát hành phiếu thi PDF chuẩn OMR, tổ chức lớp học, import danh sách học sinh thông minh, chấm điểm tự động từ ảnh chụp điện thoại/máy scan qua Computer Vision, đến phúc khảo đáp án và công bố điểm bảo mật cho học sinh tra cứu online.

---

## 📑 Mục lục
1. [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
2. [Các tính năng nổi bật](#-các-tính-năng-nổi-bật)
3. [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
4. [Yêu cầu môi trường](#-yêu-cầu-môi-trường)
5. [Cài đặt & Khởi chạy cục bộ](#-cài-đặt--khởi-chạy-cục-bộ)
6. [Tài khoản mặc định thử nghiệm](#-tài-khoản-mặc-định-thử-nghiệm)
7. [Quy trình in & Chấm phiếu thi giấy](#-quy-trình-in--chấm-phiếu-thi-giấy)
8. [Kiểm thử tự động (Testing)](#-kiểm-thử-tự-động-testing)
9. [Hướng dẫn triển khai Production](#-hướng-dẫn-triển-khai-production)

---

## 🏛 Kiến trúc hệ thống

Dự án được thiết kế theo mô hình Monorepo 3 tầng độc lập, cô lập ranh giới mạng và dịch vụ:

```
DigitalExamGrading/
├── apps/
│   ├── api/             # RESTful API Server (Node.js Express, Prisma, PostgreSQL)
│   ├── ai-service/      # OMR Engine (Python FastAPI, OpenCV, Homography)
│   └── web/             # Frontend SPA (React, Vite, Tailwind CSS v4)
├── scripts/             # Scripts điều phối Docker, DB healthcheck, dev banner
└── compose.yaml         # Docker Compose cho PostgreSQL 17 cục bộ
```

### Ranh giới mạng & bảo mật (Network Hardening):
- **Web Client:** `0.0.0.0:5173` (Truy cập được từ máy tính, điện thoại trong mạng LAN).
- **Backend API:** `LAN :5000` (CORS whitelist chặt chẽ, bảo vệ dữ liệu nhạy cảm).
- **AI Service:** `127.0.0.1:8000` (Chỉ API backend giao tiếp nội bộ, không lộ ra ngoài).
- **PostgreSQL:** `127.0.0.1:5432` (Cô lập an toàn trong máy chủ/container).

---

## ✨ Các tính năng nổi bật

### 1. Xử lý ảnh & Chấm thi OMR (Optical Mark Recognition)
- **Cân chỉnh góc nghiêng tự động:** Thuật toán 4 mốc góc (Corner Markers) kết hợp phép biến đổi hình chiếu (Perspective Transform / Homography) nắn phẳng ảnh chụp từ góc nghiêng.
- **Phân loại ô tô 4 trạng thái:** `MARKED` (Tô chuẩn), `BLANK` (Để trống), `MULTIPLE` (Tô nhiều ô), `UNCERTAIN` (Tô mờ hoặc tẩy sót).
- **Giải mã mã QR tích hợp:** Tự động đọc mã kỳ thi và loại đề trên phiếu thi để đối soát đáp án.
- **Cắt trích xuất câu hỏi (Review Crop):** Tự động cắt ảnh từng câu hỏi có nghi vấn để giáo viên xem lại và chấm phúc khảo trực quan.

### 2. Quản lý kỳ thi & Thang điểm
- **Vòng đời kỳ thi chuẩn hoá:** `DRAFT` ➔ `PUBLISHED` ➔ `CLOSED` ➔ `ARCHIVED`.
- **Hỗ trợ đa dạng số lượng câu:** Tạo phiếu thi vector PDF chuẩn 20 câu, 40 câu, 50 câu, 100 câu khổ A4.
- **Thang điểm linh hoạt:** Thang điểm chia đều (`EQUAL`) hoặc tuỳ biến theo từng câu (`CUSTOM`).

### 3. Quản lý lớp học & Import Excel thông minh
- **Nhận diện tiêu đề Heuristic:** Tự động phát hiện dòng tiêu đề và ánh xạ cột từ các file Excel phổ biến tại Việt Nam (vnEdu, SMAS, file Excel trường).
- **Chuẩn hóa SBD 6 số OMR:** Tự động sinh SBD chuẩn dạng `KKLLSS` (2 số Khối + 2 số Lớp + 2 số STT, ví dụ `090601`), tránh trùng lặp mã.
- **Tự động tạo tài khoản học sinh:** Khởi tạo tài khoản tra cứu điểm thi đồng bộ theo danh sách lớp.

### 4. Cổng tra cứu điểm thi dành cho Học sinh
- Học sinh đăng nhập bằng Số báo danh/Mã học sinh và mật khẩu được cấp.
- Chỉ hiển thị kết quả khi kỳ thi đã được công bố chính thức (`resultsPublishedAt !== null`) và bài thi đã ở trạng thái `FINAL`.
- Xem tổng điểm, số câu đúng/sai, chi tiết đáp án của bản thân.

### 5. Quản trị viên (Admin) & Bảo mật dữ liệu
- Phê duyệt tài khoản giáo viên đăng ký mới.
- Quản lý khóa/mở khóa tài khoản, đặt lại mật khẩu an toàn.
- **Bảo vệ quyền riêng tư:** Che (mask) email và số điện thoại, hỗ trợ nút con mắt bật/tắt hiển thị, loại bỏ hiển thị ID kỹ thuật nội bộ.

---

## 🛠 Công nghệ sử dụng

| Tầng | Công nghệ |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide React, Axios, React Router v7 |
| **Backend** | Node.js 24, Express 5, Prisma ORM 7, Zod Validation, JWT, Bcrypt |
| **Cơ sở dữ liệu** | PostgreSQL 17 (Docker hoặc Cloud Postgres) |
| **AI / OMR** | Python 3.11, FastAPI, OpenCV, NumPy, Pillow, Pyzbar |
| **DevOps & Tooling**| Docker Compose, Concurrently, ESLint, Pytest |

---

## 📋 Yêu cầu môi trường

- **Hệ điều hành:** Windows 10/11, macOS, hoặc Linux
- **Node.js:** `>= 22.0.0` (Khuyên dùng Node 24 LTS)
- **Python:** `3.11.x`
- **Docker Desktop:** Đã cài đặt và đang chạy (để khởi chạy PostgreSQL)

---

## 🚀 Cài đặt & Khởi chạy cục bộ

### 1. Clone mã nguồn
```bash
git clone https://github.com/Kad1711/DigitalExamGrading.git
cd DigitalExamGrading
```

### 2. Cấu hình biến môi trường
Tạo tệp `.env` tại thư mục gốc của từng ứng dụng (tham khảo `.env.example` nếu có):

**`apps/api/.env`:**
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/exam_grading_db"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/exam_grading_test"
JWT_SECRET="your_jwt_secret_key_change_in_production"
AI_SERVICE_URL="http://127.0.0.1:8000"
SUBMISSION_STORAGE_DIR="./storage/submissions"
CORS_ORIGIN="http://localhost:5173"
```

**`apps/web/.env`:**
```env
VITE_API_URL="http://localhost:5000"
```

### 3. Cài đặt Dependencies

**Cài đặt toàn bộ dependencies:**
```bash
# Cài đặt Node modules cho Root, API và Web
npm install
npm --prefix apps/api install
npm --prefix apps/web install

# Thiết lập môi trường ảo Python cho AI Service
cd apps/ai-service
python -m venv .venv

# Kích hoạt venv (Windows PowerShell):
.venv\Scripts\Activate.ps1
# (Trên Linux/macOS): source .venv/bin/activate

pip install -r requirements.txt
cd ../..
```

### 4. Khởi tạo Cơ sở dữ liệu Prisma
```bash
cd apps/api
npx prisma db push
cd ../..
```

### 5. Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất
Tại thư mục gốc dự án, chạy:
```bash
npm run dev
```

Lệnh này sẽ tự động:
1. Kiểm tra Docker Desktop và khởi động container **PostgreSQL 17**.
2. Chờ cơ sở dữ liệu sẵn sàng (`healthy`).
3. Khởi chạy đồng thời:
   - 🌐 **Web Frontend:** `http://localhost:5173`
   - ⚙️ **Backend API:** `http://localhost:5000`
   - 🧠 **AI OMR Service:** `http://localhost:8000`

---

## 🔑 Tài khoản mặc định thử nghiệm

| Vai trò | Tài khoản | Mật khẩu mặc định | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@digitalexam.local` | `Admin@123456` | Quản lý giáo viên, phê duyệt tài khoản |
| **Giáo viên (Teacher)** | `teacher@digitalexam.local` | `Teacher@123456` | Tạo kỳ thi, quản lý lớp, tải phiếu, chấm bài |
| **Học sinh (Student)** | SBD hoặc Email được cấp | `123456` | Cổng tra cứu điểm thi học sinh |

---

## 📝 Quy trình in & Chấm phiếu thi giấy

Để đạt độ chính xác nhận diện OMR cao nhất:

1. **In phiếu PDF:**
   - Chọn kỳ thi trên giao diện Giáo viên ➔ Bấm **"Tải phiếu trả lời PDF"**.
   - Khi in, chọn khổ giấy **A4**, tỷ lệ in **Actual Size (100%)**.
   - *Lưu ý:* Tuyệt đối không chọn *Fit to page* làm sai lệch tọa độ đo quang học.
2. **Tô phiếu thi:**
   - Dùng bút chì 2B tô kín và đậm các ô tròn tương ứng với SBD, Mã đề và Đáp án.
3. **Chụp ảnh bài làm:**
   - Đặt bài thi trên mặt phẳng, đủ ánh sáng đều (tránh bóng đổ của tay/điện thoại).
   - Chụp vuông góc, lấy trọn vẹn **đủ 4 ô vuông màu đen ở 4 góc** tờ giấy và mã QR ở góc trên.
4. **Tải lên và Chấm điểm:**
   - Tải ảnh chụp lên hệ thống, OMR sẽ tự động căn chỉnh và xuất kết quả chi tiết trong vòng 1-2 giây.

---

## 🧪 Kiểm thử tự động (Testing)

Dự án duy trì tỷ lệ kiểm thử nghiêm ngặt, đảm bảo tính toàn vẹn nghiệp vụ:

### 1. Kiểm thử AI OMR (Python)
```bash
cd apps/ai-service
.venv\Scripts\python -m pytest tests
```
*Kết quả:* **37/37 tests PASS** (Kiểm tra góc xoay, marker, calibration, ô mờ, ô tô đè).

### 2. Kiểm thử Backend API (Node.js)
```bash
npm --prefix apps/api test
```
*Kết quả:* Chạy trên cơ sở dữ liệu kiểm thử độc lập `exam_grading_test`, không ảnh hưởng dữ liệu thật.

### 3. Kiểm thử Frontend Lint & Build
```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

---

## 🌐 Hướng dẫn triển khai Production

### 1. Triển khai API trên Render.com
- **Build Command:** `npm --prefix apps/api install && npx prisma generate --schema=apps/api/prisma/schema.prisma`
- **Start Command:** `npm --prefix apps/api run start`
- **Environment Variables:**
  - `DATABASE_URL`: Chuỗi kết nối PostgreSQL (Render Postgres hoặc Neon)
  - `CORS_ORIGIN`: Tên miền frontend (ví dụ: `https://yourdomain.com`)
  - `AI_SERVICE_URL`: Địa chỉ nội bộ hoặc domain của dịch vụ AI

### 2. Triển khai Frontend Web trên Vercel / Cloudflare Pages
- **Root Directory:** `apps/web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variable:**
  - `VITE_API_URL`: `https://api.yourdomain.com`

### 3. Triển khai trọn gói trên VPS Linux (Khuyên dùng cho thi thật)
Khởi chạy toàn bộ hệ thống bằng Docker Compose trên 1 máy chủ VPS riêng biệt:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📄 Bản quyền & Tác giả

- Dự án được phát triển phục vụ công tác chuyển đổi số trong giáo dục và khảo thí THPT.
- Phát hành theo giấy phép [MIT License](LICENSE).
