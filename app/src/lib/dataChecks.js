// Scans already-loaded department data for duplicate/invalid entries.
// Pure function — no Supabase calls, so it's cheap to re-run on every render.
export function runDataChecks(students, semesters) {
  const issues = [];

  const matricCount = {};
  students.forEach((s) => {
    const m = (s.matric || "").trim();
    if (m) matricCount[m] = (matricCount[m] || 0) + 1;
  });
  Object.entries(matricCount)
    .filter(([, c]) => c > 1)
    .forEach(([m]) => issues.push({ type: "Duplicate matric no.", detail: m }));

  students.forEach((s) => {
    if (!s.matric || !s.matric.trim()) {
      issues.push({ type: "Missing matric no.", detail: s.name });
    }
  });

  semesters.forEach((sem) => {
    const codeCount = {};
    sem.courses.forEach((c) => {
      codeCount[c.code] = (codeCount[c.code] || 0) + 1;
    });
    Object.entries(codeCount)
      .filter(([, c]) => c > 1)
      .forEach(([code]) => issues.push({ type: "Duplicate course code", detail: `${code} in ${sem.label}` }));

    sem.courses.forEach((c) => {
      if (c.grade_entry_mode === "letter") return;
      students.forEach((stu) => {
        const raw = sem.scoresByStudent?.[stu.id]?.[c.id];
        if (raw === undefined || raw === "" || raw === null) return;
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0 || n > 100) {
          issues.push({ type: "Score out of range", detail: `${stu.name} — ${c.code} (${sem.label}): ${raw}` });
        }
      });
    });
  });

  return issues;
}
