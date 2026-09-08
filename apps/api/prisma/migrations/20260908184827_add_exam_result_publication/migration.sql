-- CreateEnum
CREATE TYPE "ResultPublicationAction" AS ENUM ('PUBLISHED', 'UNPUBLISHED');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "resultsPublishedAt" TIMESTAMP(3),
ADD COLUMN     "resultsPublishedByUserId" TEXT;

-- CreateTable
CREATE TABLE "ExamResultPublicationLog" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "ResultPublicationAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResultPublicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamResultPublicationLog_examId_createdAt_idx" ON "ExamResultPublicationLog"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "ExamResultPublicationLog_actorUserId_idx" ON "ExamResultPublicationLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_resultsPublishedByUserId_fkey" FOREIGN KEY ("resultsPublishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultPublicationLog" ADD CONSTRAINT "ExamResultPublicationLog_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResultPublicationLog" ADD CONSTRAINT "ExamResultPublicationLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
