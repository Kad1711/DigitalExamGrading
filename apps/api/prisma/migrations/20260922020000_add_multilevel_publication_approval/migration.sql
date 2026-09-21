-- Migration: 20260922020000_add_multilevel_publication_approval
-- Non-destructive forward migration for Multi-Level Publication Approval (Academic Board + Principal)

-- 1. Extend PublicationApprovalStatus Enum
ALTER TYPE "PublicationApprovalStatus" ADD VALUE IF NOT EXISTS 'PENDING_PRINCIPAL_APPROVAL';

-- 2. Extend ResultPublicationAction Enum
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'ACADEMIC_APPROVED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'ACADEMIC_REJECTED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'PRINCIPAL_APPROVED';
ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'PRINCIPAL_REJECTED';

-- 3. Add Multi-Level Approval columns to Exam Table
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "academicReviewedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "academicReviewedByUserId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "principalApprovedAt" TIMESTAMP(3);
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "principalApprovedByUserId" TEXT;

-- 4. Foreign Key Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_academicReviewedByUserId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_academicReviewedByUserId_fkey"
      FOREIGN KEY ("academicReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Exam_principalApprovedByUserId_fkey') THEN
    ALTER TABLE "Exam" ADD CONSTRAINT "Exam_principalApprovedByUserId_fkey"
      FOREIGN KEY ("principalApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Indices
CREATE INDEX IF NOT EXISTS "Exam_academicReviewedByUserId_idx" ON "Exam"("academicReviewedByUserId");
CREATE INDEX IF NOT EXISTS "Exam_principalApprovedByUserId_idx" ON "Exam"("principalApprovedByUserId");
