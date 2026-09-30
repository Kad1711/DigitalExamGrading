-- Migration: 20260927060000_add_exam_answer_key_user_approver
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN "answerKeyApprovedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Exam_answerKeyApprovedByUserId_idx" ON "Exam"("answerKeyApprovedByUserId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_answerKeyApprovedByUserId_fkey" FOREIGN KEY ("answerKeyApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
