import { useState } from "react";
import { gradeForRaw, fmt, semesterDisplayName } from "../lib/grading";

function computeDashboardStats(semester, students, semResults, bands) {
  let gpaSum = 0, gpaCount = 0, passStudents = 0, probation = 0, withdrawal = 0;
  let totalRegs = 0, totalPasses = 0;
  const gradeDist = {};
  semester.courses.forEach((c) => { gradeDist[c.id] = { code: c.code, counts: {} }; });

  students.forEach((stu) => {
    const r = semResults[stu.id];
    if (!r) return;
    if (r.gpa != null) { gpaSum += r.gpa; gpaCount++; }
    if (!r.rpt.length) passStudents++;
    if (r.status === "PROBATION") probation++;
    if (r.status === "WITHDRAWAL") withdrawal++;
    semester.courses.forEach((c) => {
      const raw = semester.scoresByStudent?.[stu.id]?.[c.id];
      if (raw === undefined || raw === "" || raw === null) return;
      totalRegs++;
      const g = gradeForRaw(raw, bands);
      if (g.letter !== "F") totalPasses++;
      gradeDist[c.id].counts[g.letter] = (gradeDist[c.id].counts[g.letter] || 0) + 1;
    });
  });

  return {
    avgGpa: gpaCount ? gpaSum / gpaCount : null,
    studentPassRate: students.length ? (passStudents / students.length) * 100 : null,
    registrationPassRate: totalRegs ? (totalPasses / totalRegs) * 100 : null,
    probation,
    withdrawal,
    totalStudents: students.length,
    gradeDist: Object.values(gradeDist),
  };
}

export default function DashboardView({ department, semesters, students, results }) {
  const [semesterId, setSemesterId] = useState(semesters[semesters.length - 1]?.id || "");
  const semester = semesters.find((s) => s.id === semesterId);

  if (!semesters.length) return <p className="help-text">Create a semester first.</p>;

  const bands = department.bands;
  const semResults = semester ? results[semester.id] || {} : {};
  const stats = semester ? computeDashboardStats(semester, students, semResults, bands) : null;
  const letters = [...bands.map((b) => b.letter), "F"];
  const maxCount = stats ? Math.max(1, ...stats.gradeDist.flatMap((g) => letters.map((l) => g.counts[l] || 0))) : 1;

  return (
    <div className="panel">
      <h1 className="page-title">Dashboard</h1>
      <p className="help-text">Pass rate, average GPA, and grade distribution for a semester.</p>
      <label className="field" style={{ maxWidth: 260, marginBottom: 22 }}>
        Semester
        <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
          {semesters.map((s) => <option key={s.id} value={s.id}>{semesterDisplayName(s)}</option>)}
        </select>
      </label>

      {stats && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 30 }}>
            {[
              ["Students", stats.totalStudents, undefined],
              ["Average GPA", fmt(stats.avgGpa), undefined],
              ["Student pass rate", stats.studentPassRate != null ? stats.studentPassRate.toFixed(0) + "%" : "\u2014", undefined],
              ["Course-sitting pass rate", stats.registrationPassRate != null ? stats.registrationPassRate.toFixed(0) + "%" : "\u2014", undefined],
              ["On probation", stats.probation, stats.probation ? "var(--warn)" : undefined],
              ["Withdrawal", stats.withdrawal, stats.withdrawal ? "var(--fail)" : undefined],
            ].map(([label, value, color]) => (
              <div key={label} style={{ background: "#fff", border: "1px solid var(--hairline)", borderRadius: 4, padding: "14px 18px", minWidth: 130 }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8778", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: color || "var(--navy)" }}>{value}</div>
              </div>
            ))}
          </div>

          <h3 className="section-title">Grade distribution by course</h3>
          {stats.gradeDist.length === 0 ? (
            <p className="help-text">No courses in this semester yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
              {stats.gradeDist.map((g) => (
                <div key={g.code} style={{ border: "1px solid var(--hairline)", borderRadius: 4, padding: "10px 14px", background: "#fff" }}>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color: "var(--navy)", marginBottom: 6 }}>{g.code}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {letters.map((l) => {
                      const count = g.counts[l] || 0;
                      return (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 14, fontSize: 11, fontFamily: "var(--mono)", color: "#726f63" }}>{l}</div>
                          <div style={{ flex: 1, height: 8, background: "#efece3", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: l === "F" ? "var(--fail)" : "var(--brass)", borderRadius: 2 }} />
                          </div>
                          <div style={{ width: 20, fontSize: 11, fontFamily: "var(--mono)", color: "#726f63", textAlign: "right" }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
