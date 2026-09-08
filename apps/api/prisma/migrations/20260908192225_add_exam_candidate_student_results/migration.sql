-- CreateTable
CREATE TABLE "ExamCandidate" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamCandidate_examId_idx" ON "ExamCandidate"("examId");

-- CreateIndex
CREATE INDEX "ExamCandidate_studentId_idx" ON "ExamCandidate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCandidate_examId_studentId_key" ON "ExamCandidate"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCandidate_examId_studentNumber_key" ON "ExamCandidate"("examId", "studentNumber");

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
