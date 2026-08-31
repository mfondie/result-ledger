import { useMemo, useState } from "react";
import { gradeForRaw, fmt, remarkFor, semesterDisplayName } from "../lib/grading";

function buildMailto(student, semester, r, bands, departmentName) {
  const subject = `Your result — ${semesterDisplayName(semester)}`;
  const lines = [
    `Dear ${student.name},`,
    "",
    `Your result for ${semesterDisplayName(semester)} is as follows:`,
    "",
    ...semester.courses.map((c) => {
      const raw = semester.scoresByStudent?.[student.id]?.[c.id];
      const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, bands) : null;
      return `${c.code}: ${g ? g.letter : "N/A"}`;
    }),
    "",
    `GPA: ${fmt(r?.gpa)}`,
    `CGPA: ${fmt(r?.cgpa)}`,
    `Remarks: ${remarkFor(r || { rpt: [], co: [] })}`,
    "",
    "Regards,",
    departmentName || "Department",
  ];
  return `mailto:${encodeURIComponent(student.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function findOverdueCourses(semesters, students) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = [];
  semesters.forEach((sem) => {
    sem.courses.forEach((c) => {
      if (!c.due_date || c.due_date >= today) return;
      const missing = students.filter((stu) => {
        const raw = sem.scoresByStudent?.[stu.id]?.[c.id];
        return raw === undefined || raw === "" || raw === null;
      });
      if (missing.length) {
        overdue.push({
          semester: semesterDisplayName(sem),
          code: c.code,
          dueDate: c.due_date,
          missingCount: missing.length,
        });
      }
    });
  });
  return overdue;
}

export default function NotificationsView({ department, semesters, students, results }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [semesterId, setSemesterId] = useState(semesters[0]?.id || "");
  const student = students.find((s) => s.id === studentId);
  const semester = semesters.find((s) => s.id === semesterId);
  const r = semester && student ? results[semester.id]?.[student.id] : null;
  const overdue = useMemo(() => findOverdueCourses(semesters, students), [semesters, students]);

  return (
    <div className="panel">
      <h1 className="page-title">Notifications</h1>
      <p className="help-text">
        There's no email server behind this — "send" opens your own mail client with the message
        pre-filled, and you hit send yourself. Overdue courses are flagged automatically from the
        due dates set when a course was added.
      </p>

      <h3 className="section-title">Email a student their result</h3>
      {!students.length || !semesters.length ? (
        <p className="help-text">Add at least one student and one semester first.</p>
      ) : (
        <div className="inline-form">
          <label className="field">
            Student
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.matric})</option>)}
            </select>
          </label>
          <label className="field">
            Semester
            <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              {semesters.map((s) => <option key={s.id} value={s.id}>{semesterDisplayName(s)}</option>)}
            </select>
          </label>
          {student && !student.email ? (
            <div className="error-text">Add an email address for {student.name} on the Students tab first.</div>
          ) : (
            student && semester && (
              <a className="primary" style={{ textDecoration: "none", display: "inline-block" }} href={buildMailto(student, semester, r, department.bands, department.name)}>
                Compose email
              </a>
            )
          )}
        </div>
      )}

      <h3 className="section-title">Overdue score submissions</h3>
      {overdue.length === 0 ? (
        <div className="remark-pass">No courses past their due date with missing scores.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Semester</th><th>Course</th><th>Due date</th><th>Missing scores</th></tr></thead>
          <tbody>
            {overdue.map((o, i) => (
              <tr key={i}>
                <td>{o.semester}</td>
                <td>{o.code}</td>
                <td className="remark-fail">{o.dueDate}</td>
                <td>{o.missingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
