-- CreateTable
CREATE TABLE "AnswerSheetTemplate" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "templateVersion" TEXT NOT NULL DEFAULT 'OMR_V1',
    "studentNumberDigits" INTEGER NOT NULL DEFAULT 6,
    "examCodeDigits" INTEGER NOT NULL DEFAULT 3,
    "questionsPerPage" INTEGER NOT NULL DEFAULT 50,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "layoutJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerSheetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerSheetTemplate_examId_idx" ON "AnswerSheetTemplate"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheetTemplate_examId_version_key" ON "AnswerSheetTemplate"("examId", "version");

-- AddForeignKey
ALTER TABLE "AnswerSheetTemplate" ADD CONSTRAINT "AnswerSheetTemplate_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
