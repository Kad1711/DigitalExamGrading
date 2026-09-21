-- Migration: 20260922040000_thcs_v2_role_and_exam_rebase
-- Defensive PostgreSQL migration for THCS V2 Domain Rebase

-- 1. Create temporary UserRole enum with target values
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'EXAM_OFFICER', 'TEACHER', 'STUDENT');

-- 1b. Safety guard: prevent silent privilege elevation of obsolete ACADEMIC_BOARD accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "role"::text = 'ACADEMIC_BOARD') THEN
    RAISE EXCEPTION 'MIGRATION BLOCKED: Found obsolete ACADEMIC_BOARD accounts. To prevent unauthorized privilege elevation to VICE_PRINCIPAL, administrators must explicitly reassign or remove ACADEMIC_BOARD accounts prior to THCS V2 migration.';
  END IF;
END $$;

-- 2. Alter User table to use UserRole_new
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'SUPER_ADMIN'::"UserRole_new"
    WHEN 'EXAM_BOARD' THEN 'EXAM_OFFICER'::"UserRole_new"
    WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"UserRole_new"
    WHEN 'PRINCIPAL' THEN 'PRINCIPAL'::"UserRole_new"
    WHEN 'VICE_PRINCIPAL' THEN 'VICE_PRINCIPAL'::"UserRole_new"
    WHEN 'EXAM_OFFICER' THEN 'EXAM_OFFICER'::"UserRole_new"
    WHEN 'TEACHER' THEN 'TEACHER'::"UserRole_new"
    WHEN 'STUDENT' THEN 'STUDENT'::"UserRole_new"
    ELSE 'TEACHER'::"UserRole_new"
  END
);

-- 3. Replace old UserRole type
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- 4. Create temporary PublicationApprovalStatus enum
CREATE TYPE "PublicationApprovalStatus_new" AS ENUM ('NOT_REQUIRED', 'PENDING_VICE_PRINCIPAL', 'PENDING_PRINCIPAL', 'APPROVED', 'REJECTED');

-- 5. Alter Exam table publicationApprovalStatus
ALTER TABLE "Exam" ALTER COLUMN "publicationApprovalStatus" DROP DEFAULT;
ALTER TABLE "Exam" ALTER COLUMN "publicationApprovalStatus" TYPE "PublicationApprovalStatus_new" USING (
  CASE "publicationApprovalStatus"::text
    WHEN 'NOT_REQUESTED' THEN 'NOT_REQUIRED'::"PublicationApprovalStatus_new"
    WHEN 'PENDING_APPROVAL' THEN 'PENDING_VICE_PRINCIPAL'::"PublicationApprovalStatus_new"
    WHEN 'PENDING_PRINCIPAL_APPROVAL' THEN 'PENDING_PRINCIPAL'::"PublicationApprovalStatus_new"
    WHEN 'APPROVED' THEN 'APPROVED'::"PublicationApprovalStatus_new"
    WHEN 'REJECTED' THEN 'REJECTED'::"PublicationApprovalStatus_new"
    WHEN 'NOT_REQUIRED' THEN 'NOT_REQUIRED'::"PublicationApprovalStatus_new"
    WHEN 'PENDING_VICE_PRINCIPAL' THEN 'PENDING_VICE_PRINCIPAL'::"PublicationApprovalStatus_new"
    ELSE 'NOT_REQUIRED'::"PublicationApprovalStatus_new"
  END
);

-- 6. Replace old PublicationApprovalStatus type & restore default
DROP TYPE "PublicationApprovalStatus";
ALTER TYPE "PublicationApprovalStatus_new" RENAME TO "PublicationApprovalStatus";
ALTER TABLE "Exam" ALTER COLUMN "publicationApprovalStatus" SET DEFAULT 'NOT_REQUIRED';

-- 7. Add VICE_PRINCIPAL values to ResultPublicationAction
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'VICE_PRINCIPAL_APPROVED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'VICE_PRINCIPAL_REJECTED';

-- 8. Add isSubjectLeader to Teacher
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "isSubjectLeader" BOOLEAN NOT NULL DEFAULT false;

-- 9. Add answerKey approval tracking to Exam
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "answerKeyApprovedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "answerKeyApprovedByTeacherId" TEXT;

-- 10. Foreign key and index for Exam.answerKeyApprovedByTeacherId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Exam_answerKeyApprovedByTeacherId_fkey'
  ) THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_answerKeyApprovedByTeacherId_fkey"
      FOREIGN KEY ("answerKeyApprovedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Exam_answerKeyApprovedByTeacherId_idx" ON "Exam"("answerKeyApprovedByTeacherId");
