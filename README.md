<div align="center">

# 🎓 Digital Exam Grading V2

### Hệ thống Quản lý & Chấm thi Trắc nghiệm OMR dành cho Trường Trung học Cơ sở

[![CI Pipeline](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml/badge.svg)](https://github.com/Kad1711/DigitalExamGrading/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

**Web Application • REST API • Computer Vision • OMR Processing**

</div>

---

## 📌 Giới thiệu

**Digital Exam Grading V2** là hệ thống hỗ trợ số hóa quy trình **tổ chức, quản lý và chấm thi trắc nghiệm OMR** dành cho trường Trung học Cơ sở.

Hệ thống kết hợp ứng dụng Web, Backend API và công nghệ **Computer Vision** nhằm hỗ trợ xử lý phiếu trả lời trắc nghiệm, quản lý kỳ thi, hậu kiểm kết quả và thống kê dữ liệu.

> 🎯 Mục tiêu của dự án là xây dựng một nền tảng quản lý kỳ thi tập trung, giảm thao tác thủ công và hỗ trợ giáo viên trong quá trình chấm thi.

---

## ✨ Tính năng nổi bật

### 📄 Quản lý kỳ thi

- Tạo và quản lý kỳ thi.
- Quản lý môn thi, lớp học và danh sách thí sinh.
- Quản lý đề thi và đáp án.
- Hỗ trợ nhiều loại bài kiểm tra và kỳ thi.

### 🧠 Chấm thi OMR

- Nhận dạng phiếu trả lời bằng **OpenCV**.
- Xử lý ảnh bài thi trước khi chấm.
- Nhận dạng vùng tô đáp án.
- Hỗ trợ nhận dạng thông tin trên phiếu.
- Phát hiện các trường hợp cần hậu kiểm.

### 🔍 Hậu kiểm kết quả

Hệ thống hỗ trợ quy trình **Human-in-the-loop**, cho phép người dùng có thẩm quyền kiểm tra lại những bài thi hoặc câu trả lời cần xác minh trước khi hoàn tất kết quả.

### 👥 Quản lý người dùng

Hỗ trợ quản lý người dùng theo vai trò và phạm vi nghiệp vụ.

### 📊 Thống kê

Cung cấp các chức năng thống kê phục vụ theo dõi kết quả thi theo:

- Khối
- Lớp
- Môn học
- Giáo viên
- Kỳ thi

### 📑 Quản lý học sinh

- Quản lý danh sách học sinh.
- Hỗ trợ nhập dữ liệu.
- Quản lý thông tin phục vụ tổ chức kỳ thi.

---

## 👥 Phân quyền hệ thống

Digital Exam Grading V2 sử dụng mô hình:

> **RBAC — Role-Based Access Control**

Các nhóm người dùng chính bao gồm:

| Vai trò | Phạm vi sử dụng |
|---|---|
| 🛡️ **Quản trị hệ thống** | Quản trị hệ thống và tài khoản |
| 👑 **Hiệu trưởng** | Quản lý và giám sát cấp trường |
| 🎓 **Phó Hiệu trưởng** | Quản lý nghiệp vụ chuyên môn |
| 📋 **Cán bộ khảo thí** | Tổ chức và quản lý kỳ thi |
| 👨‍🏫 **Giáo viên** | Quản lý nghiệp vụ giảng dạy và chấm thi |
| 👨‍🎓 **Học sinh** | Tra cứu kết quả được phép công bố |

> 🔐 Quyền truy cập thực tế được kiểm soát tại Backend API theo vai trò và phạm vi nghiệp vụ.

---

## 🏗️ Kiến trúc hệ thống

Dự án được xây dựng theo kiến trúc **Monorepo đa dịch vụ**.

```text
DigitalExamGrading/
│
├── apps/
│   ├── api/          # Backend API
│   ├── ai-service/   # AI / OMR Processing
│   └── web/          # Web Application
│
├── compose.yaml
├── render.yaml
└── README.md
```

### 🔄 Luồng xử lý tổng quan

```text
                 ┌───────────────────┐
                 │      Người dùng   │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │  Web Application  │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │    Backend API    │
                 └─────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         Database       Storage      Queue/Cache
                                         │
                                         ▼
                                ┌────────────────┐
                                │ AI/OMR Service │
                                └────────────────┘
```

> ℹ️ README chỉ trình bày kiến trúc ở mức tổng quan. Chi tiết hạ tầng và cấu hình production được quản lý riêng.

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| 🌐 **Frontend** | React, Vite, JavaScript |
| ⚙️ **Backend** | Node.js, Express, Prisma |
| 🗄️ **Database** | PostgreSQL |
| 🧠 **AI / OMR** | Python, FastAPI, OpenCV |
| ⚡ **Queue / Cache** | Redis, BullMQ |
| ☁️ **Object Storage** | Cloudinary |
| 📦 **Container** | Docker, Docker Compose |
| 🧪 **Testing** | Node Test Runner, Supertest, Pytest |

---

## 📁 Cấu trúc dự án

```text
apps/
│
├── api/
│   ├── prisma/
│   ├── src/
│   └── tests/
│
├── ai-service/
│   ├── app/
│   └── tests/
│
└── web/
    ├── src/
    └── package.json
```

### 🌐 Web

Ứng dụng giao diện dành cho người dùng, được xây dựng bằng **React + Vite**.

### ⚙️ API

Backend quản lý:

- Authentication
- Authorization
- Người dùng
- Lớp học
- Kỳ thi
- Bài thi
- Kết quả
- Quy trình nghiệp vụ

### 🧠 AI Service

Dịch vụ xử lý ảnh độc lập phục vụ nhận dạng và chấm phiếu OMR.

---

## 🚀 Khởi chạy Development

### 1️⃣ Yêu cầu

Cài đặt các công cụ:

- Node.js
- Python
- Docker
- Git

---

### 2️⃣ Clone repository

```bash
git clone https://github.com/Kad1711/DigitalExamGrading.git

cd DigitalExamGrading
```

---

### 3️⃣ Cài đặt dependencies

```bash
npm install

npm --prefix apps/api install

npm --prefix apps/web install
```

---

### 4️⃣ Cấu hình Environment

Tạo các file `.env` cần thiết dựa trên cấu hình development của dự án.

Ví dụ:

```env
NODE_ENV=development

DATABASE_URL=<your-development-database-url>

JWT_ACCESS_SECRET=<your-secret>

JWT_REFRESH_SECRET=<your-secret>

AI_SERVICE_URL=<your-ai-service-url>

REDIS_URL=<your-redis-url>

CORS_ORIGIN=<your-frontend-origin>
```

> ⚠️ **Không sử dụng các giá trị ví dụ trên production.**

---

### 5️⃣ Khởi động Docker

```bash
docker compose up -d
```

---

### 6️⃣ Khởi chạy ứng dụng

```bash
npm run dev
```

---

## 🧪 Kiểm thử

### ⚙️ Backend

```bash
npm --prefix apps/api test
```

### 🌐 Frontend

```bash
npm --prefix apps/web run build
```

### 🧠 AI Service

Các bài kiểm thử AI/OMR được thực thi trong môi trường Python hoặc container tương ứng.

---

## 🔐 Security

Bảo mật là một phần quan trọng của Digital Exam Grading V2.

### Repository KHÔNG được chứa

- ❌ Mật khẩu thật
- ❌ Tài khoản production
- ❌ JWT Secret
- ❌ API Key
- ❌ Database Credential
- ❌ Access Token
- ❌ Dữ liệu học sinh thật
- ❌ Dữ liệu kỳ thi thật

### Environment Variables

Các thông tin nhạy cảm phải được quản lý thông qua:

```text
Environment Variables
        │
        ├── Database Credentials
        ├── Authentication Secrets
        ├── Storage Credentials
        └── Service Configuration
```

Không commit:

```text
.env
.env.production
.env.local
```

vào repository.

### 🧪 Development Accounts

Tài khoản phục vụ development/test, nếu cần, phải được quản lý riêng trong môi trường phát triển.

> 🔒 Production không sử dụng tài khoản hoặc mật khẩu demo được công khai trong repository.

---

## 🌐 Production

Hệ thống được thiết kế để có thể triển khai theo kiến trúc:

```text
Web Application
      │
      ▼
Backend API
      │
      ├──── Database
      │
      ├──── Object Storage
      │
      └──── AI / OMR Service
```

Thông tin chi tiết về:

- Production Environment Variables
- Database Credentials
- Authentication Secrets
- Administrator Accounts
- Backup
- Monitoring
- Infrastructure Configuration

được quản lý trong **tài liệu vận hành nội bộ** và không công khai trong README.

---

## 🛡️ Nguyên tắc bảo mật khi phát triển

Trước khi commit:

```bash
git status
git diff
```

Đảm bảo không có:

```text
Password
Secret
Token
API Key
Private Credential
Production Data
```

trong thay đổi chuẩn bị push.

> ⚠️ Nếu một secret đã từng được commit vào repository, chỉ xóa nó khỏi README/source hiện tại là chưa đủ. Secret đó cần được thay thế (rotate).

---

## 🤝 Đóng góp

Khi đóng góp mã nguồn:

1. 🍴 Tạo branch riêng cho thay đổi.
2. 💻 Tuân thủ cấu trúc mã nguồn hiện tại.
3. 🧪 Chạy kiểm thử trước khi commit.
4. 🔐 Không commit secret hoặc dữ liệu thật.
5. 📝 Mô tả rõ thay đổi trong Pull Request.
6. 🛡️ Các thay đổi liên quan đến Authentication, Authorization hoặc Database cần được kiểm tra kỹ.

---

## 📜 License

Dự án được phân phối theo giấy phép được quy định trong file:

```text
LICENSE
```

---

<div align="center">

### 🎓 Digital Exam Grading V2

**OMR Examination Management & Grading System**

Built with ❤️ using React • Node.js • Python • OpenCV • PostgreSQL

</div>
