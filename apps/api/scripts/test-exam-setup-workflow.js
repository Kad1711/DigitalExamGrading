/**
 * End-to-End Test for Teacher Exam Setup Workflow (Phase 5.2)
 *
 * Simulates complete teacher workflow:
 * 1. Login as teacher
 * 2. Fetch subjects & classes
 * 3. Create a new DRAFT exam
 * 4. Add exam code (101)
 * 5. Save AnswerKey for code 101
 * 6. Generate OMR template
 * 7. Download PDF from DB
 * 8. Publish exam
 * 9. Verify exam is locked (cannot update questionCount or AnswerKey)
 * 10. Verify /grade exam preselection compatibility
 */

import assert from "assert/strict";

const API_BASE = "http://localhost:5000/api";
const TEACHER_EMAIL = "teacher@digitalexam.local";
const TEACHER_PASSWORD = "Teacher@123456";

async function run() {
  console.log("=== BẮT ĐẦU KIỂM THỬ TEACHER EXAM SETUP WORKFLOW ===");

  // 1. Login
  console.log("1. Đăng nhập Teacher...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEACHER_EMAIL, password: TEACHER_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);
  const { data: { accessToken: token } } = await loginRes.json();
  assert.ok(token);
  console.log("   ✓ Đăng nhập thành công.");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 2. Fetch subjects & classes
  console.log("2. Tải danh mục Môn học & Lớp học...");
  const [subRes, clsRes] = await Promise.all([
    fetch(`${API_BASE}/subjects`, { headers }),
    fetch(`${API_BASE}/classes`, { headers }),
  ]);
  assert.equal(subRes.status, 200);
  assert.equal(clsRes.status, 200);
  const subjects = (await subRes.json()).data;
  const classes = (await clsRes.json()).data;
  assert.ok(subjects.length > 0);
  assert.ok(classes.length > 0);
  console.log(`   ✓ Có ${subjects.length} môn học và ${classes.length} lớp học.`);

  // 3. Create a new DRAFT Exam (separate from test fixtures)
  const testTitle = `Kiểm tra Khảo sát Toán 11 - Test Flow ${Date.now()}`;
  console.log(`3. Tạo kỳ thi mới: "${testTitle}"...`);
  const createExamRes = await fetch(`${API_BASE}/exams`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: testTitle,
      description: "Kỳ thi thử nghiệm quy trình thiết lập tự động",
      subjectId: subjects[0].id,
      classId: classes[0].id,
      questionCount: 10,
      maxScore: 10,
      scoringType: "EQUAL",
    }),
  });
  assert.equal(createExamRes.status, 201);
  const createdExam = (await createExamRes.json()).data;
  const examId = createdExam.id;
  assert.equal(createdExam.status, "DRAFT");
  assert.equal(createdExam.questionCount, 10);
  console.log(`   ✓ Đã tạo kỳ thi DRAFT (ID: ${examId})`);

  // 4. Add Exam Code "101"
  console.log("4. Tạo mã đề 101...");
  const createCodeRes = await fetch(`${API_BASE}/exams/${examId}/codes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code: "101" }),
  });
  assert.equal(createCodeRes.status, 201);
  const createdCode = (await createCodeRes.json()).data;
  const codeId = createdCode.id;
  assert.equal(createdCode.code, "101");
  console.log(`   ✓ Đã tạo mã đề 101 (ID: ${codeId})`);

  // 5. Save AnswerKey for code 101 (10 questions)
  console.log("5. Lưu đáp án cho mã đề 101...");
  const answers = Array.from({ length: 10 }, (_, i) => ({
    questionNumber: i + 1,
    correctAnswer: ["A", "B", "C", "D"][i % 4],
  }));
  const putAnswersRes = await fetch(`${API_BASE}/exams/${examId}/codes/${codeId}/answer-key`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ answers }),
  });
  assert.equal(putAnswersRes.status, 200);
  console.log("   ✓ Đã lưu thành công 10 đáp án.");

  // 6. Generate OMR Template
  console.log("6. Tạo mẫu phiếu OMR...");
  const createTplRes = await fetch(`${API_BASE}/exams/${examId}/answer-sheet-template`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(createTplRes.status, 201);
  const template = (await createTplRes.json()).data;
  assert.ok(template.id);
  assert.equal(template.version, 1);
  assert.equal(template.pageCount, 1);
  console.log(`   ✓ Đã tạo mẫu phiếu OMR v${template.version} (Template ID: ${template.id})`);

  // 7. Download PDF
  console.log("7. Tải file PDF phiếu OMR...");
  const pdfRes = await fetch(`${API_BASE}/exams/${examId}/answer-sheet-template/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(pdfRes.status, 200);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBuffer.slice(0, 5).toString(), "%PDF-");
  console.log(`   ✓ Tải PDF thành công (${pdfBuffer.length} bytes).`);

  // 8. Publish Exam
  console.log("8. Phát hành kỳ thi (Publish)...");
  const publishRes = await fetch(`${API_BASE}/exams/${examId}/publish`, {
    method: "POST",
    headers,
  });
  assert.equal(publishRes.status, 200);
  const publishedExam = (await publishRes.json()).data;
  assert.equal(publishedExam.status, "PUBLISHED");
  console.log("   ✓ Kỳ thi đã chuyển sang trạng thái PUBLISHED.");

  // 9. Verify locking: attempting to update questionCount or AnswerKey must be rejected with 409
  console.log("9. Xác minh cơ chế khóa sau khi phát hành...");
  const lockedUpdateRes = await fetch(`${API_BASE}/exams/${examId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ questionCount: 20 }),
  });
  assert.equal(lockedUpdateRes.status, 409);
  console.log("   ✓ Cố gắng đổi questionCount bị chặn (409 EXAM_NOT_DRAFT).");

  const lockedAnswerKeyRes = await fetch(`${API_BASE}/exams/${examId}/codes/${codeId}/answer-key`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ answers }),
  });
  assert.equal(lockedAnswerKeyRes.status, 409);
  console.log("   ✓ Cố gắng đổi AnswerKey bị chặn (409 EXAM_NOT_DRAFT).");

  // 10. Check list of PUBLISHED exams includes this exam
  console.log("10. Kiểm tra hiển thị trong danh sách kỳ thi PUBLISHED...");
  const listPublishedRes = await fetch(`${API_BASE}/exams?status=PUBLISHED`, { headers });
  assert.equal(listPublishedRes.status, 200);
  const publishedList = (await listPublishedRes.json()).data;
  assert.ok(publishedList.some((e) => e.id === examId));
  console.log(`   ✓ Kỳ thi xuất hiện trong danh sách chấm bài.`);

  console.log(`\n>>> HOÀN TẤT THÀNH CÔNG WORKFLOW THIẾT LẬP KỲ THI (EXAM ID: ${examId}) <<<\n`);
}

run().catch((err) => {
  console.error("❌ Test workflow thất bại:", err);
  process.exit(1);
});
