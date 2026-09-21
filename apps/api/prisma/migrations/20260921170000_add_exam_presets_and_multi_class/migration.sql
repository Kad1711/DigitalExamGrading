-- AlterTable Exam: make teacherId, classId nullable, add gradeId, durationMinutes, sheetPreset
ALTER TABLE "Exam" ALTER COLUMN "teacherId" DROP NOT NULL;
ALTER TABLE "Exam" ALTER COLUMN "classId" DROP NOT NULL;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "gradeId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER DEFAULT 45;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "sheetPreset" TEXT DEFAULT 'PRESET_TERM_50Q';

-- AlterTable Student: add initialPassword
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "initialPassword" TEXT DEFAULT '123456';

-- AlterTable AnswerSheetTemplate: add sheetPreset
ALTER TABLE "AnswerSheetTemplate" ADD COLUMN IF NOT EXISTS "sheetPreset" TEXT DEFAULT 'PRESET_TERM_50Q';

-- CreateTable ExamClass
CREATE TABLE IF NOT EXISTS "ExamClass" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExamClass_examId_classId_key" ON "ExamClass"("examId", "classId");
CREATE INDEX IF NOT EXISTS "ExamClass_examId_idx" ON "ExamClass"("examId");
CREATE INDEX IF NOT EXISTS "ExamClass_classId_idx" ON "ExamClass"("classId");
CREATE INDEX IF NOT EXISTS "Exam_gradeId_idx" ON "Exam"("gradeId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Exam" ADD CONSTRAINT "Exam_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
