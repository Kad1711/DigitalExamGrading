import "dotenv/config";
import prisma from "../src/config/prisma.js";

async function cleanMismatchedAssignments() {
  console.log("Checking for mismatched teacher assignments (where assignment.subjectId != teacher.primarySubjectId)...");
  
  const teachers = await prisma.teacher.findMany({
    where: {
      primarySubjectId: { not: null },
    },
    include: {
      primarySubject: true,
      assignments: {
        include: {
          class: true,
          subject: true,
        },
      },
    },
  });

  let removedCount = 0;

  for (const t of teachers) {
    const mismatched = t.assignments.filter((a) => a.subjectId !== t.primarySubjectId);
    if (mismatched.length > 0) {
      console.log(`Found teacher "${t.fullName}" (${t.teacherCode}) with primary subject "${t.primarySubject?.name}":`);
      for (const m of mismatched) {
        console.log(`  - Removing mismatched assignment: Class ${m.class?.name} - Subject ${m.subject?.name}`);
      }
      const res = await prisma.teachingAssignment.deleteMany({
        where: {
          id: { in: mismatched.map((m) => m.id) },
        },
      });
      removedCount += res.count;
    }
  }

  console.log(`Done. Removed ${removedCount} mismatched assignment(s).`);
  await prisma.$disconnect();
}

cleanMismatchedAssignments().catch((err) => {
  console.error("Error cleaning mismatched assignments:", err);
  process.exit(1);
});
