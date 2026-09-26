-- Migration: 20260927050000_add_teaching_assignment_history
-- CreateEnum
CREATE TYPE "TeachingAssignmentAction" AS ENUM ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED');

-- CreateTable
CREATE TABLE "TeachingAssignmentHistory" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "action" "TeachingAssignmentAction" NOT NULL DEFAULT 'ASSIGNED',
    "previousTeacherId" TEXT,
    "newTeacherId" TEXT,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeachingAssignmentHistory_classId_subjectId_academicYearId_idx" ON "TeachingAssignmentHistory"("classId", "subjectId", "academicYearId");
CREATE INDEX "TeachingAssignmentHistory_previousTeacherId_idx" ON "TeachingAssignmentHistory"("previousTeacherId");
CREATE INDEX "TeachingAssignmentHistory_newTeacherId_idx" ON "TeachingAssignmentHistory"("newTeacherId");
CREATE INDEX "TeachingAssignmentHistory_actorUserId_idx" ON "TeachingAssignmentHistory"("actorUserId");
CREATE INDEX "TeachingAssignmentHistory_createdAt_idx" ON "TeachingAssignmentHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_previousTeacherId_fkey" FOREIGN KEY ("previousTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_newTeacherId_fkey" FOREIGN KEY ("newTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignmentHistory" ADD CONSTRAINT "TeachingAssignmentHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
