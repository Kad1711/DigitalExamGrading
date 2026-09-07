# DigitalExamGrading - AI Service (Computer Vision OMR Engine)

Dịch vụ xử lý thị giác máy tính (Computer Vision) thuần túy bằng OpenCV và FastAPI nhằm nhận diện, hiệu chỉnh phối cảnh và đọc kết quả trắc nghiệm từ ảnh chụp hoặc scan phiếu trả lời chuẩn A4.

---

## 1. Tổng quan & Triết lý thiết kế

- **Công nghệ cốt lõi:** Python 3.11+, OpenCV (`opencv-python`), FastAPI, NumPy, Pillow, PyMuPDF.
- **Không sử dụng Deep Learning cồng kềnh:** Không dùng YOLO, PyTorch, TensorFlow hay LLM để đọc bubble. Sử dụng thuật toán hình học thị giác máy tính (Computer Vision Geometry) và đo tỷ lệ lấp đầy điểm ảnh (Pixel Fill Ratio) trên mask hình tròn thu nhỏ (70% bán kính để loại bỏ viền in và ký tự chữ cái A/B/C/D).
- **Độ phân giải chuẩn hóa (Canonical A4):** 300 DPI = **2480 x 3508 pixels**.
- **Hiệu năng & Tài nguyên:** Xử lý CPU-only trong khoảng **~340ms / trang**, bộ nhớ RAM tiêu thụ dưới **150MB**, không cần GPU chuyên dụng.

---

## 2. Cấu trúc thư mục (`apps/ai-service`)

```
apps/ai-service/
├── app/
│   ├── config.py                 # Cấu hình DPI (300), kích thước A4 (2480x3508), ngưỡng fill & margin
│   ├── main.py                   # Điểm khởi động FastAPI application & CORS middleware
│   ├── omr/
│   │   ├── bubble_reader.py      # Đo fill ratio trên mask tròn 70%, ma trận quyết định MARKED/BLANK/MULTIPLE/UNCERTAIN
│   │   ├── layout_mapper.py      # Chuyển đổi tọa độ hình học từ mm sang pixel chuẩn hóa
│   │   ├── marker_detector.py    # Phát hiện 4 corner alignment markers màu đen ở 4 góc trang
│   │   ├── perspective.py        # Hiệu chỉnh góc chụp, độ nghiêng (getPerspectiveTransform + warpPerspective)
│   │   ├── quality.py            # Đánh giá chất lượng ảnh chụp: độ sáng (brightness), độ mờ (Laplacian variance)
│   │   └── qr_reader.py          # Giải mã QR code metadata đa tầng (ROI -> scale -> threshold)
│   ├── routes/
│   │   └── omr.py                # Endpoints GET /health và POST /omr/analyze
│   ├── schemas/
│   │   └── omr.py                # Pydantic schemas cho response contract
│   └── services/
│       └── omr_service.py        # Pipeline điều phối OMR end-to-end & visualize debug
├── fixtures/
│   └── generated/
│       ├── layout_40.json        # Layout 40 câu chuẩn hóa từ Phase 3
│       ├── layout_60.json        # Layout 60 câu 2 trang chuẩn hóa từ Phase 3
│       ├── template_40.pdf       # Vector PDF chuẩn 40 câu
│       └── template_60.pdf       # Vector PDF chuẩn 60 câu
├── tests/
│   ├── synthetic_generator.py   # Module giả lập ảnh scan/chụp: tô SBD, tô mã đề, tô đáp án, biến dạng phối cảnh
│   └── test_omr_synthetic.py    # Bộ kiểm thử 10 kịch bản toàn diện
├── requirements.txt              # Danh sách thư viện cố định phiên bản
└── README.md                     # Tài liệu hướng dẫn sử dụng
```

---

## 3. Quy trình xử lý OMR Pipeline (End-to-End)

1. **Nhận ảnh & layout:** Nhận `image` (binary png/jpg) và `layoutJson` (định nghĩa hình học mm từ API Phase 3).
2. **Kiểm tra chất lượng ảnh (Quality Assessment):**
   - Đánh giá độ phân giải ($W \ge 1200$, $H \ge 1600$).
   - Đo độ sáng trung bình (Brightness trong dải $[60, 240]$).
   - Đo độ mờ (Blur score bằng phương sai Laplacian, ngưỡng $\ge 100$).
3. **Phát hiện 4 Marker định vị (Marker Detection):**
   - Nhị phân hóa Otsu đảo ngược để phát hiện các khối đen hình vuông $7\text{mm} \times 7\text{mm}$.
   - Lọc phân vùng góc (quadrants: outer 14% width & 12% height) nhằm loại trừ hoàn toàn các ô kẻ tiêu đề và bảng SBD.
4. **Hiệu chỉnh phối cảnh (Perspective Transform):**
   - Ánh xạ 4 tâm marker sang 4 tọa độ lý thuyết trên khổ A4 300 DPI ($2480 \times 3508$).
   - Chuyển đổi ảnh về ảnh phẳng chuẩn mực (Canonical Page).
5. **Đọc mã QR (Metadata Extraction):**
   - Cắt vùng ROI góc trên bên phải ($x=168\text{mm}, y=18\text{mm}, \text{size}=24\text{mm}$).
   - Đọc payload JSON: `v`, `templateVersion`, `templateId`, `examId`, `page`, `pages`.
6. **Đọc Số Báo Danh (SBD) & Mã Đề:**
   - Dò từng cột chữ số $0..9$. Đo tỷ lệ tô đen của từng ô tròn.
   - Giữ nguyên chuỗi ký tự, bảo toàn số 0 ở đầu (ví dụ: `"001234"`).
7. **Đọc đáp án trắc nghiệm (Answer Bubbles):**
   - Tạo circular mask bán kính $0.70 \times R$.
   - Tính `fill_ratio` của 4 lựa chọn A, B, C, D.
   - Phân loại:
     - `BLANK`: Tỷ lệ ô cao nhất $< 0.35$.
     - `MULTIPLE`: Có từ 2 ô $\ge 0.35$ và hiệu giữa ô 1 và ô 2 $< 0.12$.
     - `UNCERTAIN`: Hiệu giữa ô cao nhất và ô nhì $< 0.12$ (tẩy chưa sạch hoặc tô quá nhạt).
     - `MARKED`: Ô cao nhất $\ge 0.35$ và vượt trội so với các ô còn lại $\ge 0.12$.
8. **Trả về kết quả chuẩn hóa:** Gắn cờ `NEEDS_REVIEW` nếu có câu hỏi `MULTIPLE`/`UNCERTAIN` hoặc SBD/Mã đề bị lỗi.

---

## 4. Cài đặt & Môi trường phát triển

### 4.1. Yêu cầu hệ thống
- Python 3.11.x (Khuyến nghị 3.11.9)
- Hệ điều hành: Windows, Linux hoặc macOS

### 4.2. Khởi tạo Virtual Environment & Cài đặt thư viện

```powershell
# Di chuyển vào thư mục ai-service
cd D:\DigitalExamGrading\apps\ai-service

# Tạo môi trường ảo .venv
python -m venv .venv

# Kích hoạt môi trường ảo (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Cài đặt các gói phụ thuộc
pip install -r requirements.txt
```

---

## 5. Khởi chạy Dịch vụ (Uvicorn Server)

```powershell
cd D:\DigitalExamGrading\apps\ai-service
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Endpoint kiểm tra sức khỏe: `http://localhost:8000/health`
- Swagger UI tài liệu API: `http://localhost:8000/docs`

---

## 6. Bộ kiểm thử (Automated Test Suite)

Chạy toàn bộ 10 test case mô phỏng thực tế với pytest:

```powershell
cd D:\DigitalExamGrading\apps\ai-service
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe -m pytest -v tests/test_omr_synthetic.py
```

### Danh sách 10 kịch bản kiểm thử:
1. `test_ground_truth_clean`: Ảnh chuẩn hóa 40 câu, SBD 123456, Mã đề 101 -> Đạt độ chính xác 100% (40/40 câu).
2. `test_ground_truth_perspective`: Ảnh bị xoay nghiêng và biến dạng phối cảnh -> Hiệu chỉnh phối cảnh chính xác, đạt 100% (40/40 câu).
3. `test_ground_truth_blank`: Bỏ trống câu số 5 -> Nhận diện chính xác status = BLANK và answer = None.
4. `test_ground_truth_multiple`: Tô 2 đáp án A và C tại câu 8 -> Nhận diện status = MULTIPLE, tự động gắn cờ vào needsReviewQuestions.
5. `test_ground_truth_uncertain`: Câu 12 tô nhạt và tẩy không sạch -> Nhận diện status = UNCERTAIN, confidence < 0.85, gắn cờ xem xét.
6. `test_ground_truth_sbd_leading_zero`: SBD có số 0 ở đầu (001234) -> Bảo toàn định dạng chuỗi "001234".
7. `test_ground_truth_marker_failure`: 1 góc marker bị che khuất/rách -> Bắt ngoại lệ MARKERS_NOT_FOUND và mã lỗi HTTP 422.
8. `test_multi_page_60_p2`: Bài thi 60 câu (Trang 2/2) -> Nhận diện QR trang 2, đọc chính xác các câu từ 51 đến 60.
9. `test_fastapi_analyze_endpoint`: Gọi HTTP POST /omr/analyze qua TestClient -> Trả về mã 200 kèm payload JSON chuẩn.
10. `test_health_endpoint`: Gọi HTTP GET /health -> Trả về mã 200 và trạng thái hoạt động của service.

---

## 7. Tài liệu API Endpoints

### 7.1. `GET /health`
Kiểm tra tình trạng hoạt động của service.

### 7.2. `POST /omr/analyze`
Phân tích phiếu thi OMR từ ảnh chụp hoặc scan.

- Form Fields:
  - `image`: Tệp ảnh nhị phân (.jpg, .jpeg, .png).
  - `layoutJson`: Chuỗi JSON định nghĩa tọa độ hình học trang (sinh bởi API Backend Phase 3).
