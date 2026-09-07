# Digital Exam Grading (Hệ Thống Chấm Điểm Bài Thi Trắc Nghiệm THPT)

Hệ thống chấm điểm bài thi trắc nghiệm THPT từ ảnh chụp/scan phiếu thi chuẩn sử dụng Computer Vision & OMR (Optical Mark Recognition).

---

## Cấu Trúc Dự Án

- `apps/api`: Backend REST API (Node.js Express, Prisma ORM, PostgreSQL)
- `apps/ai-service`: Computer Vision & OMR Service (Python FastAPI, OpenCV)
- `apps/web`: Frontend Giao diện Giáo viên (React JS, Vite)

---

## Hướng Dẫn Khởi Chạy Môi Trường Phát Triển (Development)

Hệ thống bao gồm 4 thành phần chạy đồng thời:

### 1. Cơ sở dữ liệu PostgreSQL
Khởi chạy container PostgreSQL qua Docker Compose:
```bash
docker compose up -d
```
Cơ sở dữ liệu lắng nghe tại cổng `localhost:5432`.

### 2. Backend Node API
Chạy dịch vụ REST API Node / Express:
```bash
cd apps/api
npm run dev
```
API lắng nghe tại cổng `http://localhost:5000`.

### 3. AI Service (FastAPI OMR)
Kích hoạt môi trường ảo Python và khởi chạy dịch vụ FastAPI:
```bash
cd apps/ai-service
# Trên Windows:
.venv\Scripts\activate
# Trên Linux/macOS:
# source .venv/bin/activate

uvicorn app.main:app --reload --port 8000
```
Dịch vụ OMR lắng nghe tại cổng `http://localhost:8000`.

### 4. Frontend React
Khởi chạy giao diện người dùng React:
```bash
cd apps/web
npm run dev
```
Giao diện web mở tại cổng `http://localhost:5173`.
Tất cả các API request `/api/*` được cấu hình proxy tự động chuyển tiếp tới `http://localhost:5000`.

---

## Kiểm Thử (Testing)

- **Backend Unit & Grading Tests:**
  ```bash
  cd apps/api
  node --test tests/grading.test.js
  ```
- **OMR Synthetic Tests (Python):**
  ```bash
  cd apps/ai-service
  .venv\Scripts\python -m pytest -v tests/test_omr_synthetic.py
  ```
