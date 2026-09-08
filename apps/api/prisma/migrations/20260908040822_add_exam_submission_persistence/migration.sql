-- CreateEnum
CREATE TYPE "ExamSubmissionStatus" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "SubmissionAnswerOutcome" AS ENUM ('CORRECT', 'INCORRECT', 'BLANK', 'INVALID_MULTIPLE', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "TeacherReviewResolution" AS ENUM ('ANSWER', 'BLANK', 'MULTIPLE_INVALID', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "SubmissionAuditEventType" AS ENUM ('SUBMISSION_CREATED', 'ANSWER_REVIEWED', 'IDENTITY_REVIEWED', 'REGRADED');

-- CreateTable
CREATE TABLE "ExamSubmission" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "examCodeId" TEXT NOT NULL,
    "answerSheetTemplateId" TEXT NOT NULL,
    "gradedByUserId" TEXT NOT NULL,
    "status" "ExamSubmissionStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "detectedStudentNumber" TEXT,
    "candidateStudentNumber" TEXT,
    "studentNumberOmrStatus" TEXT NOT NULL,
    "resolvedStudentNumber" TEXT,
    "identityNeedsReview" BOOLEAN NOT NULL DEFAULT false,
    "identityReviewedByUserId" TEXT,
    "identityReviewedAt" TIMESTAMP(3),
    "originalImageStorageKey" TEXT NOT NULL,
    "originalImageSha256" TEXT NOT NULL,
    "originalImageMimeType" TEXT NOT NULL,
    "originalImageSizeBytes" INTEGER NOT NULL,
    "originalImageWidth" INTEGER,
    "originalImageHeight" INTEGER,
    "omrOverallStatus" TEXT NOT NULL,
    "templateVersion" TEXT,
    "qualityMetadata" JSONB,
    "timingMetadata" JSONB,
    "rawOmrSnapshot" JSONB,
    "questionCountSnapshot" INTEGER NOT NULL,
    "maxScoreSnapshot" DECIMAL(6,4) NOT NULL,
    "scoringTypeSnapshot" "ScoringType" NOT NULL,
    "examCodeSnapshot" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "incorrectCount" INTEGER NOT NULL,
    "blankCount" INTEGER NOT NULL,
    "unresolvedCount" INTEGER NOT NULL,
    "provisionalScore" DECIMAL(6,4),
    "finalScore" DECIMAL(6,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "ExamSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "detectedAnswer" TEXT,
    "candidate" TEXT,
    "originalCandidates" JSONB,
    "omrStatus" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "fillRatios" JSONB NOT NULL,
    "reviewCropStorageKey" TEXT,
    "correctAnswerSnapshot" "AnswerOption" NOT NULL,
    "scoreSnapshot" DECIMAL(6,4) NOT NULL,
    "resolvedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "teacherResolution" "TeacherReviewResolution",
    "resolvedAnswer" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "effectiveAnswer" TEXT,
    "result" "SubmissionAnswerOutcome" NOT NULL,
    "scoreEarned" DECIMAL(6,4),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubmissionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubmissionAuditLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" "SubmissionAuditEventType" NOT NULL,
    "questionNumber" INTEGER,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSubmissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSubmission_examId_idx" ON "ExamSubmission"("examId");

-- CreateIndex
CREATE INDEX "ExamSubmission_examCodeId_idx" ON "ExamSubmission"("examCodeId");

-- CreateIndex
CREATE INDEX "ExamSubmission_status_idx" ON "ExamSubmission"("status");

-- CreateIndex
CREATE INDEX "ExamSubmission_gradedByUserId_idx" ON "ExamSubmission"("gradedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubmission_examId_originalImageSha256_key" ON "ExamSubmission"("examId", "originalImageSha256");

-- CreateIndex
CREATE INDEX "SubmissionAnswer_submissionId_idx" ON "SubmissionAnswer"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAnswer_submissionId_questionNumber_key" ON "SubmissionAnswer"("submissionId", "questionNumber");

-- CreateIndex
CREATE INDEX "ExamSubmissionAuditLog_submissionId_createdAt_idx" ON "ExamSubmissionAuditLog"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ExamSubmissionAuditLog_actorUserId_idx" ON "ExamSubmissionAuditLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_examCodeId_fkey" FOREIGN KEY ("examCodeId") REFERENCES "ExamCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_answerSheetTemplateId_fkey" FOREIGN KEY ("answerSheetTemplateId") REFERENCES "AnswerSheetTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_gradedByUserId_fkey" FOREIGN KEY ("gradedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmission" ADD CONSTRAINT "ExamSubmission_identityReviewedByUserId_fkey" FOREIGN KEY ("identityReviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ExamSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmissionAuditLog" ADD CONSTRAINT "ExamSubmissionAuditLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ExamSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubmissionAuditLog" ADD CONSTRAINT "ExamSubmissionAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
