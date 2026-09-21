# 🎓 Digital Exam Grading V2

### Hệ thống hỗ trợ tổ chức và chấm thi trắc nghiệm OMR cho trường Trung học Cơ sở (THCS)

[![CI Pipeline](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml/badge.svg)](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml)
[![Docker Ready](https://img.shields.io/badge/docker-compose%20v2-2496ED?logo=docker&logoColor=white)](compose.yaml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-7.x-red.svg)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

---

## 📌 Giới thiệu

**Digital Exam Grading V2** là hệ thống hỗ trợ số hóa quy trình **tổ chức, nhận dạng, chấm và công bố kết quả bài thi trắc nghiệm OMR** dành cho trường **Trung học Cơ sở (THCS – Khối 6, 7, 8, 9)**.

Hệ thống kết hợp:

- 🧠 **Computer Vision / OpenCV** để nhận dạng phiếu OMR.
- 📐 **Homography** để hiệu chỉnh ảnh chụp nghiêng và biến dạng phối cảnh.
- ⚙️ **Redis + BullMQ** để xử lý chấm bài hàng loạt bất đồng bộ.
- 👁️ **Human Review** để rà soát các trường hợp tô mờ, tô nhiều đáp án hoặc nhận dạng không chắc chắn.
- 🏫 **RBAC 6 vai trò** phù hợp với quy trình vận hành trong trường THCS.
- 📊 Thống kê, phổ điểm và quản lý kết quả thi.
- 🔐 Quy trình phê duyệt kết quả theo cấp độ kỳ thi.

> **Phạm vi dự án:** Hệ thống tập trung vào tổ chức và chấm thi trắc nghiệm OMR, không nhằm thay thế toàn bộ phần mềm quản lý nhà trường.

---

## 📑 Mục lục

1. [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
2. [Mô hình phân quyền RBAC](#-mô-hình-phân-quyền-rbac)
3. [Quy trình nghiệp vụ cốt lõi](#-quy-trình-nghiệp-vụ-cốt-lõi)
4. [Các tính năng nổi bật](#-các-tính-năng-nổi-bật)
5. [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
6. [Cấu trúc dự án](#-cấu-trúc-dự-án)
7. [Yêu cầu môi trường](#-yêu-cầu-môi-trường)
8. [Cài đặt và khởi chạy](#-cài-đặt-và-khởi-chạy)
9. [Quy trình chấm phiếu OMR](#-quy-trình-chấm-phiếu-omr)
10. [Kiểm thử tự động](#-kiểm-thử-tự-động)
11. [Triển khai Production](#-triển-khai-production)
12. [Phạm vi phát triển tiếp theo](#-phạm-vi-phát-triển-tiếp-theo)

---

# 🏛 Kiến trúc hệ thống

Digital Exam Grading được tổ chức theo kiến trúc Monorepo gồm ba thành phần chính:

```text
DigitalExamGrading/
│
├── apps/
│   ├── api/
│   │   └── RESTful API
│   │       Node.js + Express + Prisma + PostgreSQL
│   │
│   ├── ai-service/
│   │   └── OMR Computer Vision Engine
│   │       Python + FastAPI + OpenCV
│   │
│   └── web/
│       └── Frontend SPA
│           React + Vite + Tailwind CSS
│
├── scripts/
│   └── Docker / Database / Development utilities
│
└── compose.yaml
    └── PostgreSQL + Redis + AI Service
```

### Luồng xử lý chính

```text
Người dùng
    │
    ▼
React Web
    │
    ▼
Express REST API
    │
    ├──────────────► PostgreSQL
    │
    ├──────────────► Redis / BullMQ
    │                     │
    │                     ▼
    │                 Grading Worker
    │
    └──────────────► FastAPI AI Service
                          │
                          ▼
                       OpenCV
                          │
                          ▼
                     Kết quả OMR
```

---

## 🔐 Ranh giới mạng

| Thành phần | Binding | Mục đích |
|---|---|---|
| Web Client | `0.0.0.0:5173` | Cho phép truy cập trong mạng LAN |
| Backend API | `:5000` | REST API có JWT, CORS và rate limiting |
| AI Service | `127.0.0.1:8000` | Chỉ Backend giao tiếp với AI |
| Redis | `127.0.0.1:6379` | Queue xử lý OMR |
| PostgreSQL | `127.0.0.1:5433` | Cơ sở dữ liệu chính |

AI Service, Redis và PostgreSQL không cần được public trực tiếp ra mạng LAN.

---

# 👥 Mô hình phân quyền RBAC

Hệ thống sử dụng **6 vai trò chính**.

| UserRole | Vai trò | Trách nhiệm chính |
|---|---|---|
| `SUPER_ADMIN` | Quản trị hệ thống | Quản trị tài khoản, role, trạng thái tài khoản và cấu hình kỹ thuật |
| `PRINCIPAL` | Hiệu trưởng | Giám sát toàn trường và phê duyệt cuối kết quả kỳ thi `FINAL` |
| `VICE_PRINCIPAL` | Hiệu phó chuyên môn | Quản lý chuyên môn giáo viên, phân công giảng dạy và phê duyệt `MIDTERM` |
| `EXAM_OFFICER` | Cán bộ khảo thí | Tổ chức kỳ thi tập trung, xử lý OMR, hậu kiểm và trình duyệt kết quả |
| `TEACHER` | Giáo viên | Tổ chức kiểm tra thường xuyên cho môn/lớp được phân công |
| `STUDENT` | Học sinh | Tra cứu kết quả đã được công bố |

---

## 👨‍🏫 Tổ trưởng chuyên môn

**Tổ trưởng chuyên môn không phải một UserRole riêng.**

Tổ trưởng vẫn có:

```text
UserRole = TEACHER
```

và được xác định bằng:

```text
Teacher.isSubjectLeader = true
```

kết hợp với:

```text
Teacher.primarySubjectId
```

Tổ trưởng chỉ được phê duyệt Master AnswerKey của **đúng môn chuyên môn mình phụ trách**.

Ví dụ:

```text
Teacher
├── role: TEACHER
├── title: Tổ trưởng chuyên môn
├── isSubjectLeader: true
├── primarySubject: Toán
└── TeachingAssignments
    ├── Toán - 6A1
    └── Toán - 7A1
```

---

# 🔄 Quy trình nghiệp vụ cốt lõi

## 1. Kiểm tra thường xuyên

Áp dụng cho:

```text
REGULAR
MIN_15
```

Quy trình:

```text
Giáo viên
    ↓
Tạo bài kiểm tra
    ↓
Chọn lớp được phân công
    ↓
Thiết lập đáp án
    ↓
Sinh phiếu OMR
    ↓
Upload ảnh
    ↓
Chấm OMR
    ↓
Hậu kiểm
    ↓
FINAL
    ↓
Công bố trực tiếp
```

Giáo viên chỉ được tạo bài kiểm tra:

- Đúng môn chuyên môn chính.
- Đúng lớp đang được phân công.
- Không cần Ban Giám hiệu phê duyệt.

---

## 2. Kỳ thi Giữa kỳ

Áp dụng cho:

```text
MIDTERM
```

```text
Cán bộ khảo thí
        ↓
Tạo kỳ thi tập trung
        ↓
Tổ trưởng chuyên môn
        ↓
Duyệt Master AnswerKey
        ↓
Upload phiếu thi
        ↓
Redis / BullMQ
        ↓
OpenCV OMR
        ↓
Hậu kiểm kỹ thuật
        ↓
Cán bộ khảo thí gửi duyệt
        ↓
Hiệu phó chuyên môn
        ↓
Phê duyệt
        ↓
PUBLISHED
```

Sau khi Hiệu phó phê duyệt thành công:

```text
resultsPublishedAt = now()
```

Kết quả được công bố tự động.

---

## 3. Kỳ thi Cuối kỳ

Áp dụng cho:

```text
FINAL
```

```text
Cán bộ khảo thí
        ↓
Tạo kỳ thi
        ↓
Tổ trưởng chuyên môn
        ↓
Duyệt Master AnswerKey
        ↓
Chấm OMR hàng loạt
        ↓
Hậu kiểm kỹ thuật
        ↓
Hiệu phó chuyên môn
        ↓
Rà soát chuyên môn
        ↓
Hiệu trưởng
        ↓
Phê duyệt cuối
        ↓
PUBLISHED
```

Hiệu phó chỉ thực hiện bước rà soát chuyên môn.

Kết quả chỉ được công bố khi **Hiệu trưởng phê duyệt cuối cùng**.

---

# ✨ Các tính năng nổi bật

## 🧠 1. Nhận dạng và chấm OMR

Hệ thống sử dụng Computer Vision để xử lý phiếu thi:

- Nhận diện 4 Corner Markers.
- Hiệu chỉnh phối cảnh bằng Homography.
- Chuẩn hóa vùng ảnh.
- Phân tích tỷ lệ tô.
- Xác định đáp án.
- Tính confidence.
- Đánh dấu trường hợp cần hậu kiểm.

Các trạng thái nhận dạng:

| Trạng thái | Ý nghĩa |
|---|---|
| `MARKED` | Một phương án được tô rõ |
| `BLANK` | Không có phương án |
| `MULTIPLE` | Có nhiều phương án được tô |
| `UNCERTAIN` | Kết quả không đủ độ tin cậy |

---

## 🔍 2. Human Review

Các câu hỏi có độ tin cậy thấp có thể được đưa vào giao diện hậu kiểm.

Hệ thống lưu vùng ảnh crop tương ứng để người có quyền đối chiếu với phiếu thi thực tế.

---

## ⚡ 3. Chấm hàng loạt với Redis + BullMQ

Khi tải nhiều phiếu thi:

```text
Frontend
    ↓
1 Batch Request
    ↓
Backend
    ↓
BullMQ Queue
    ↓
Redis
    ↓
Grading Worker
    ↓
AI Service
```

Frontend theo dõi tiến độ xử lý bằng polling.

Khi Redis/BullMQ không khả dụng, hệ thống có thể chuyển sang cơ chế xử lý tuần tự dự phòng.

---

## 🏫 4. Quản lý khối và lớp THCS

Hệ thống chỉ hỗ trợ:

```text
Khối 6
Khối 7
Khối 8
Khối 9
```

Ví dụ lớp:

```text
6A1
6A2
7A1
8A1
9A1
```

---

## 🔢 5. Chuẩn hóa SBD OMR 6 số

Định dạng:

```text
KKLLSS
```

Trong đó:

- `KK`: mã khối (`06`, `07`, `08`, `09`)
- `LL`: thứ tự lớp trong khối
- `SS`: số thứ tự học sinh

Ví dụ:

```text
090215
```

có thể biểu diễn học sinh thứ 15 thuộc lớp thứ 2 của Khối 9.

---

## 📄 6. Phiếu OMR PDF

Hệ thống hỗ trợ sinh phiếu OMR dạng PDF vector A4.

Phiếu có thể bao gồm:

- SBD 6 chữ số.
- Mã đề 3 chữ số.
- QR Code định danh kỳ thi.
- Corner Markers.
- Vùng trả lời trắc nghiệm.

---

## 📊 7. Thống kê kết quả

Hệ thống hỗ trợ:

- Điểm trung bình.
- Điểm cao nhất / thấp nhất.
- Phổ điểm.
- Tỷ lệ hoàn thành.
- Số bài cần hậu kiểm.
- Thống kê theo lớp.
- Thống kê kỳ thi tập trung.

---

## 🎓 8. Cổng học sinh

Học sinh chỉ được xem kết quả khi:

```text
Exam đã được công bố
AND
Submission = FINAL
AND
Danh tính đã được xác nhận
AND
ExamCandidate khớp với học sinh
```

Hệ thống không cho phép học sinh truy cập dữ liệu của học sinh khác.

Ảnh scan gốc của phiếu thi hiện **không được cung cấp cho học sinh** trong phiên bản THCS V2.

---

# 🛠 Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Frontend | React 19, JavaScript, Vite, Tailwind CSS v4, Lucide React, Axios |
| Backend | Node.js 24, Express 5, Prisma ORM 7, Zod, JWT, bcrypt |
| Database | PostgreSQL 17 |
| Queue | Redis 7 + BullMQ |
| AI Service | Python 3.11, FastAPI, OpenCV, NumPy, Pillow |
| Testing | Node Test Runner, Supertest, Pytest, ESLint |
| Deployment | Docker / Docker Compose |

---

# 📁 Cấu trúc dự án

```text
DigitalExamGrading/
│
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── ai-service/
│   │   ├── app/
│   │   └── tests/
│   │
│   └── web/
│       ├── src/
│       └── public/
│
├── scripts/
├── compose.yaml
├── package.json
└── README.md
```

---

# 📋 Yêu cầu môi trường

- Windows 10/11, Linux hoặc macOS.
- Node.js `>= 22`.
- Python `3.11`.
- Docker Desktop / Docker Engine.
- Git.

Khuyến nghị:

```text
Node.js 24 LTS
PostgreSQL 17
Redis 7
Python 3.11
```

---

# 🚀 Cài đặt và khởi chạy

## 1. Clone repository

```bash
git clone https://github.com/Kad1711/DigitalExamGrading.git
cd DigitalExamGrading
```

---

## 2. Cài đặt dependencies

```bash
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

AI Service được khuyến nghị chạy qua Docker.

---

## 3. Cấu hình môi trường

Tạo:

```text
apps/api/.env
```

Ví dụ:

```env
PORT=5000
NODE_ENV=development

DATABASE_URL="<YOUR_DEVELOPMENT_DATABASE_URL>"
TEST_DATABASE_URL="<YOUR_ISOLATED_TEST_DATABASE_URL>"

JWT_SECRET="<GENERATE_A_STRONG_RANDOM_SECRET>"

AI_SERVICE_URL="http://127.0.0.1:8000"
REDIS_URL="redis://127.0.0.1:6379"

SUBMISSION_STORAGE_DIR="./storage/submissions"

CORS_ORIGIN="http://localhost:5173"
```

Tạo:

```text
apps/web/.env
```

```env
VITE_API_URL="http://localhost:5000"
```

> Không commit file `.env` hoặc thông tin xác thực vào repository.

---

## 4. Khởi động hạ tầng

```bash
docker compose up -d
```

Kiểm tra:

```bash
docker ps
```

Các dịch vụ chính:

```text
PostgreSQL
Redis
AI Service
```

---

## 5. Prisma

```bash
cd apps/api

npx prisma generate
npx prisma migrate deploy

cd ../..
```

Trong môi trường phát triển khi cần tạo migration mới:

```bash
npx prisma migrate dev
```

> Không sử dụng `prisma migrate reset` trên cơ sở dữ liệu chứa dữ liệu cần bảo toàn.

---

## 6. Khởi chạy Development

Từ thư mục root:

```bash
npm run dev
```

Các dịch vụ:

```text
Web       http://localhost:5173
API       http://localhost:5000
AI        http://127.0.0.1:8000
Redis     127.0.0.1:6379
Postgres  127.0.0.1:5433
```

---

# 📝 Quy trình chấm phiếu OMR

## 1. In phiếu

Tại kỳ thi:

```text
Chi tiết kỳ thi
→ Tải mẫu phiếu trả lời OMR
```

Khi in:

- Khổ giấy A4.
- `Actual Size / 100%`.
- Không chọn `Fit to page`.

---

## 2. Tô phiếu

Khuyến nghị:

- Bút chì 2B hoặc bút mực đen.
- Tô kín vòng tròn.
- Không đánh dấu ngoài vùng đáp án.
- Ghi đúng SBD và mã đề.

---

## 3. Chụp hoặc scan

Ảnh cần:

- Đủ toàn bộ phiếu.
- Nhìn thấy rõ 4 Corner Markers.
- Không bị bóng lớn.
- Hạn chế nhòe.
- Không cắt mất QR Code hoặc vùng trả lời.

---

## 4. Upload

Có thể:

- Upload một phiếu.
- Kéo thả nhiều ảnh.
- Chấm hàng loạt.

Hệ thống tự động:

```text
Upload
→ Queue
→ Perspective Correction
→ OMR Detection
→ Identity Resolution
→ Scoring
→ Human Review nếu cần
→ FINAL
```

---

# 🧪 Kiểm thử tự động

## Backend API

```bash
npm --prefix apps/api test
```

Các nhóm test bao gồm:

- RBAC.
- Teacher/Class scope.
- Exam lifecycle.
- OMR grading.
- Submission persistence.
- Candidate mapping.
- Publication.
- Student result security.
- Analytics.
- Export security.
- Database isolation.

---

## AI / Computer Vision

```bash
docker exec -e PYTHONPATH=. digital_exam_ai pytest tests/
```

Bộ test kiểm tra:

- Bubble calibration.
- Marker robustness.
- Synthetic OMR.
- Perspective distortion.
- Image rotation.
- Bubble classification.

---

## Frontend

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

---

# 🌐 Triển khai Production

## Database Migration

Production sử dụng:

```bash
npx prisma migrate deploy
```

Không sử dụng:

```bash
npx prisma migrate reset
```

---

## Kiến trúc triển khai gợi ý

```text
Frontend
   │
   ▼
Backend API
   │
   ├── PostgreSQL
   ├── Redis
   └── AI Service
```

Có thể triển khai theo:

- Docker Compose trên VPS.
- Frontend trên nền tảng hosting SPA.
- Backend Node.js trên nền tảng container/PaaS.
- PostgreSQL Managed Service.
- Redis Managed Service.
- AI Service chạy container riêng.

Các thông tin xác thực Production phải được cấu hình bằng **Environment Variables hoặc Secret Manager**, tuyệt đối không lưu trực tiếp trong repository.

---

# 🔮 Phạm vi phát triển tiếp theo

Các tính năng chưa thuộc phạm vi THCS V2 hiện tại:

- Phúc khảo trực tuyến.
- Học sinh xem ảnh scan gốc.
- Lịch thi đầy đủ.
- Phòng thi.
- Phân công giám thị.
- Các mô hình AI học sâu.
- Hệ thống LMS.
- Điểm danh.
- Học phí.
- Quản lý nhân sự toàn trường.

---

# 🎯 Định hướng đề tài

> **Digital Exam Grading là hệ thống hỗ trợ tổ chức, nhận dạng, chấm và công bố kết quả bài thi trắc nghiệm OMR cho trường Trung học Cơ sở.**

Mục tiêu của dự án là hỗ trợ nhà trường giảm thao tác chấm thủ công, tăng tốc độ xử lý bài thi, giảm sai sót và cung cấp quy trình hậu kiểm rõ ràng, minh bạch.

---

# 📄 License

This project is distributed under the **MIT License**.

---

<p align="center">
  <b>Digital Exam Grading V2</b><br/>
  OMR Examination Management for Middle Schools
</p>
