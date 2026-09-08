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
  npm test
  ```
- **Backend E2E Smoke Test:**
  ```bash
  cd apps/api
  npm run test:smoke
  ```
- **OMR Synthetic Tests (Python):**
  ```bash
  cd apps/ai-service
  .venv\Scripts\python -m pytest -v tests/test_omr_synthetic.py
  ```

---

## Hướng Dẫn Thử Nghiệm Phiếu Giấy Thật (Real Photo Validation Preparation)

Hệ thống đã sẵn sàng để thử nghiệm với phiếu in giấy và ảnh chụp điện thoại thật theo các bước sau:

### 1. Quy trình thực hiện:
1. Khởi động đầy đủ 4 service (PostgreSQL, Node, FastAPI, React).
2. Đăng nhập tài khoản Giáo viên trên web (`teacher@digitalexam.local` / `Teacher@123456`).
3. Chọn kỳ thi đã phát hành (ví dụ: kỳ thi 40 câu).
4. Nhấp nút **"TẢI PHIẾU TRẢ LỜI PDF (OMR)"** ngay trên giao diện để tải về file PDF vector chuẩn của kỳ thi từ cơ sở dữ liệu.
5. **In phiếu trả lời (Rất quan trọng):**
   - Chọn chế độ in **Actual Size** (100%), khổ giấy **A4**.
   - **TUYỆT ĐỐI KHÔNG** chọn *Fit to page*, *Shrink oversized pages*, hoặc co giãn kích thước tự động (vì thuật toán OMR tính toán tọa độ chính xác theo milimet).
6. **Tô phiếu thử nghiệm:**
   - Số báo danh: `123456`
   - Mã đề: `101`
   - Các câu hỏi: Tô chì 2B đậm, tròn ô.
7. **Chụp ảnh bằng điện thoại:**
   - Giữ điện thoại song song với mặt bàn.
   - Chụp lấy trọn vẹn toàn bộ tờ giấy, thấy rõ **đủ 4 marker hình vuông màu đen ở 4 góc**.
   - Không để ngón tay hoặc bóng che khuất vùng **mã QR** ở góc trên bên phải.
   - Hạn chế bóng đổ, chụp ở nơi có ánh sáng đều.
8. **Tải ảnh lên và bấm "CHẤM BÀI":**
   - Kiểm tra điểm số, các thông số nhận diện OMR, cảnh báo chất lượng ảnh và bảng kết quả từng câu.

### 2. Ma trận kịch bản thử nghiệm (Test Matrix):
- **Kịch bản A (Ảnh chuẩn):** Chụp thẳng, đủ sáng, tô chuẩn $\to$ Kỳ vọng điểm tuyệt đối, trạng thái `FINAL`.
- **Kịch bản B (Góc nghiêng nhẹ):** Chụp hơi nghiêng góc $\to$ Kiểm tra thuật toán homography nắn góc.
- **Kịch bản C (Ánh sáng yếu):** Chụp môi trường hơi tối $\to$ Kiểm tra threshold nhị phân hóa và cảnh báo `IMAGE_TOO_DARK`.
- **Kịch bản D (Câu để trống):** Để trống 1 câu $\to$ Kỳ vọng `blankCount = 1`, bài thi vẫn đạt `FINAL`.
- **Kịch bản E (Tô nhiều đáp án):** Tô 2 ô trong 1 câu $\to$ Kỳ vọng phát hiện `MULTIPLE`, trạng thái chuyển `PROVISIONAL`.
- **Kịch bản F (Tô mờ/Tẩy không sạch):** Tô rất mờ hoặc tẩy sót $\to$ Kỳ vọng phát hiện `UNCERTAIN`, trạng thái `PROVISIONAL`, candidate không bị tính điểm.
