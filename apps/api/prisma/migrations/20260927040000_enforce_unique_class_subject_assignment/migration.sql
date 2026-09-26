-- Migration: 20260927040000_enforce_unique_class_subject_assignment
-- Invariant: Trong một năm học, mỗi cặp (Lớp, Môn) chỉ có tối đa 1 giáo viên phụ trách (Mô hình THCS V2)

-- DropIndex
DROP INDEX IF EXISTS "TeachingAssignment_teacherId_classId_subjectId_academicYear_key";
DROP INDEX IF EXISTS "TeachingAssignment_teacherId_classId_subjectId_academicYearId_key";

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_classId_subjectId_academicYearId_key" ON "TeachingAssignment"("classId", "subjectId", "academicYearId");
