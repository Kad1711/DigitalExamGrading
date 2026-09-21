-- Migration: 20260921210000_add_management_roles_exam_governance
-- Non-destructive forward migration for Management Roles, Teacher Primary Subject, Exam Governance & Publication Approval

-- 1. Extend UserRole Enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VICE_PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EXAM_BOARD';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACADEMIC_BOARD';

-- 2. Create ExamType Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExamType') THEN
    CREATE TYPE "ExamType" AS ENUM ('REGULAR', 'MIN_15', 'MIN_45', 'MIN_60', 'MIN_90', 'MIDTERM', 'FINAL', 'OTHER');
  END IF;
END $$;

-- 3. Create PublicationApprovalStatus Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublicationApprovalStatus') THEN
    CREATE TYPE "PublicationApprovalStatus" AS ENUM ('NOT_REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- 4. Extend ResultPublicationAction Enum
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 5. Update Teacher Table
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT 'Giáo viên';
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "primarySubjectId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Teacher_primarySubjectId_fkey') THEN
    ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_primarySubjectId_fkey"
      FOREIGN KEY ("primarySubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Teacher_primarySubjectId_idx" ON "Teacher"("primarySubjectId");

-- 6. Update Exam Table
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "examType" "ExamType" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovalStatus" "PublicationApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRequestedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRequestedByUserId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovedByUserId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRejectionReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_createdByUserId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_publicationRequestedByUserId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_publicationRequestedByUserId_fkey"
      FOREIGN KEY ("publicationRequestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_publicationApprovedByUserId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_publicationApprovedByUserId_fkey"
      FOREIGN KEY ("publicationApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Exam_createdByUserId_idx" ON "Exam"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Exam_examType_idx" ON "Exam"("examType");
CREATE INDEX IF NOT EXISTS "Exam_publicationApprovalStatus_idx" ON "Exam"("publicationApprovalStatus");

-- 7. Safe Backfills
-- Backfill createdByUserId from Teacher.userId
UPDATE "Exam" e
SET "createdByUserId" = t."userId"
FROM "Teacher" t
WHERE e."teacherId" = t."id" AND e."createdByUserId" IS NULL;

-- Backfill Exam.examType based on existing preset and duration
UPDATE "Exam"
SET "examType" = CASE
  WHEN "sheetPreset" LIKE '%15MIN%' OR "durationMinutes" = 15 THEN 'MIN_15'::"ExamType"
  WHEN "sheetPreset" LIKE '%45MIN%' OR "durationMinutes" = 45 THEN 'MIN_45'::"ExamType"
  WHEN "sheetPreset" LIKE '%60MIN%' OR "durationMinutes" = 60 THEN 'MIN_60'::"ExamType"
  WHEN "sheetPreset" LIKE '%90MIN%' OR "durationMinutes" = 90 THEN 'MIN_90'::"ExamType"
  WHEN "sheetPreset" LIKE '%TERM%' THEN 'OTHER'::"ExamType"
  ELSE 'REGULAR'::"ExamType"
END
WHERE "examType" = 'REGULAR';

-- Backfill Teacher.primarySubjectId if teacher has exactly 1 unique assigned subject
WITH SingleSubjectTeachers AS (
  SELECT "teacherId", MIN("subjectId") AS unique_subject_id
  FROM "TeachingAssignment"
  GROUP BY "teacherId"
  HAVING COUNT(DISTINCT "subjectId") = 1
)
UPDATE "Teacher" t
SET "primarySubjectId" = s.unique_subject_id
FROM SingleSubjectTeachers s
WHERE t."id" = s."teacherId" AND t."primarySubjectId" IS NULL;
