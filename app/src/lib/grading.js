// Pure grading logic — unchanged from the original artifact. None of this
// touches Supabase; it just turns raw scores + policy into GPA/CGPA/status.

export function gradeForScore(score, bands) {
  const s = Number(score);
  for (const b of bands) if (s >= b.min && s <= b.max) return b;
  return { letter: "F", point: 0 };
}

export function gradeForRaw(raw, bands) {
  if (raw === undefined || raw === "" || raw === null) return null;
  if (typeof raw === "string" && Number.isNaN(Number(raw))) {
    const letter = raw.trim().toUpperCase();
    const band = bands.find((b) => b.letter === letter);
    if (band) return band;
    return { letter: "F", point: 0 };
  }
  return gradeForScore(raw, bands);
}

// semester: { id, courses: [{id, code, credit, type}], scoresByStudent: {studentId: {courseId: value}} }
export function computeSemester(semester, students, bands, policy) {
  const out = {};
  students.forEach((stu) => {
    let creditSum = 0,
      pointSum = 0;
    const rpt = [],
      co = [];
    semester.courses.forEach((c) => {
      const raw = semester.scoresByStudent?.[stu.id]?.[c.id];
      if (raw === undefined || raw === "" || raw === null) {
        co.push(c.code);
        return;
      }
      const g = gradeForRaw(raw, bands);
      const countsForGPA = !(policy.excludeElectivesFromGPA && c.type === "elective");
      if (countsForGPA) {
        creditSum += c.credit;
        pointSum += c.credit * g.point;
      }
      if (g.letter === "F") rpt.push(c.code);
    });
    out[stu.id] = {
      creditSum,
      pointSum,
      gpa: creditSum ? pointSum / creditSum : null,
      rpt,
      co,
    };
  });
  return out;
}

// semesters must already be in chronological order.
export function computeAllWithPolicy(semesters, students, bands, policy) {
  const bySemester = {};
  const withdrawalStreak = {};

  const attemptsByStudent = {};
  semesters.forEach((sem, semIndex) => {
    students.forEach((stu) => {
      sem.courses.forEach((c) => {
        const raw = sem.scoresByStudent?.[stu.id]?.[c.id];
        if (raw === undefined || raw === "" || raw === null) return;
        if (policy.excludeElectivesFromGPA && c.type === "elective") return;
        const g = gradeForRaw(raw, bands);
        if (!attemptsByStudent[stu.id]) attemptsByStudent[stu.id] = [];
        attemptsByStudent[stu.id].push({ semIndex, code: c.code, credit: c.credit, point: g.point });
      });
    });
  });

  semesters.forEach((sem, semIndex) => {
    const semResults = computeSemester(sem, students, bands, policy);
    bySemester[sem.id] = {};
    students.forEach((stu) => {
      const attemptsSoFar = (attemptsByStudent[stu.id] || []).filter((a) => a.semIndex <= semIndex);
      const byCode = {};
      attemptsSoFar.forEach((a) => {
        if (!byCode[a.code]) byCode[a.code] = [];
        byCode[a.code].push(a);
      });

      let cumCredit = 0,
        cumPoints = 0;
      Object.values(byCode).forEach((list) => {
        if (policy.resitPolicy === "latest") {
          const chosen = list[list.length - 1];
          cumCredit += chosen.credit;
          cumPoints += chosen.credit * chosen.point;
        } else if (policy.resitPolicy === "average") {
          const avgPoint = list.reduce((s, a) => s + a.point, 0) / list.length;
          cumCredit += list[0].credit;
          cumPoints += list[0].credit * avgPoint;
        } else {
          list.forEach((a) => {
            cumCredit += a.credit;
            cumPoints += a.credit * a.point;
          });
        }
      });
      const cgpa = cumCredit ? cumPoints / cumCredit : null;

      if (cgpa != null && cgpa < policy.withdrawalCgpa) {
        withdrawalStreak[stu.id] = (withdrawalStreak[stu.id] || 0) + 1;
      } else {
        withdrawalStreak[stu.id] = 0;
      }
      let status = "GOOD";
      if (withdrawalStreak[stu.id] >= policy.withdrawalConsecutiveSemesters) status = "WITHDRAWAL";
      else if (cgpa != null && cgpa < policy.probationCgpa) status = "PROBATION";

      let classification = null;
      if (sem.isFinal && cgpa != null) {
        const sorted = [...policy.classifications].sort((a, b) => b.min - a.min);
        const found = sorted.find((c) => cgpa >= c.min);
        classification = found ? found.label : "Below pass mark";
      }

      bySemester[sem.id][stu.id] = {
        ...semResults[stu.id],
        cumCredit,
        cumPoints,
        cgpa,
        status,
        classification,
      };
    });
  });
  return bySemester;
}

export function fmt(n) {
  return n === null || n === undefined || Number.isNaN(n) ? "\u2014" : n.toFixed(2);
}

export function remarkFor(r) {
  const parts = [];
  if (r.rpt.length) parts.push("RPT: " + r.rpt.join(", "));
  if (r.co.length) parts.push("CO: " + r.co.join(", "));
  return parts.length ? parts.join("  \u00b7  ") : "PASS";
}

export function letterOptions(bands) {
  const sorted = [...bands].sort((a, b) => b.point - a.point);
  return [...sorted.map((b) => b.letter), "F"];
}

export function semesterDisplayName(sem) {
  const parts = [sem.session, sem.level, sem.term || sem.label].filter(Boolean);
  return parts.length ? parts.join(" \u00b7 ") : sem.label || "Untitled semester";
}
