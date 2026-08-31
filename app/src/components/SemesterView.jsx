import { useEffect, useState } from "react";
import {
  updateSemester,
  deleteSemester,
  approveSemester,
  revokeApproval,
  addCourse,
  updateCourse,
  deleteCourse,
  submitCourse,
  reopenCourse,
  fetchDepartmentProfiles,
} from "../lib/api";
import { gradeForRaw, letterOptions, fmt, remarkFor, semesterDisplayName } from "../lib/grading";
import { isAdminRole, canEditCourse } from "../lib/permissions";
import BulkScoreImport from "./BulkScoreImport.jsx";

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function SemesterView({ department, semester, students, results, profile, onSetScore, onChanged }) {
  const admin = isAdminRole(profile);
  const bands = department.bands;
  const [lecturers, setLecturers] = useState([]);
  const [newCourse, setNewCourse] = useState({ code: "", title: "", credit: 3, type: "compulsory", lecturer_id: "", due_date: "" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!admin) return;
    fetchDepartmentProfiles(department.id).then((profiles) =>
      setLecturers(profiles.filter((p) => p.role === "lecturer"))
    );
  }, [department.id, admin]);

  const addCourseRow = async () => {
    if (!newCourse.code.trim()) return;
    await addCourse(semester.id, {
      code: newCourse.code.trim().toUpperCase(),
      title: newCourse.title.trim(),
      credit: Number(newCourse.credit) || 0,
      type: newCourse.type,
      lecturer_id: newCourse.lecturer_id || null,
      due_date: newCourse.due_date || null,
    });
    setNewCourse({ code: "", title: "", credit: 3, type: "compulsory", lecturer_id: "", due_date: "" });
    await onChanged();
  };

  const toggleEntryMode = async (course) => {
    await updateCourse(course.id, { grade_entry_mode: course.grade_entry_mode === "letter" ? "score" : "letter" });
    await onChanged();
  };

  const totalCredit = semester.courses.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const overLoad = totalCredit > (department.policy.maxCreditLoad || Infinity);

  const q = search.trim().toLowerCase();
  const filteredStudents = students.filter((stu) => {
    if (q && !(stu.name.toLowerCase().includes(q) || (stu.matric || "").toLowerCase().includes(q))) return false;
    const r = results[stu.id] || { rpt: [], co: [], status: "GOOD" };
    if (filter === "failing" && !(r.rpt && r.rpt.length)) return false;
    if (filter === "co" && !(r.co && r.co.length)) return false;
    if (filter === "probation" && r.status !== "PROBATION") return false;
    if (filter === "withdrawal" && r.status !== "WITHDRAWAL") return false;
    return true;
  });

  const exportCsv = () => {
    const header = [
      "Name", "Matric No.",
      ...semester.courses.map((c) => c.code),
      "Credit Units", "GPA", "Cum. Credit", "CGPA", "Status", "Remarks",
    ];
    const rows = students.map((stu) => {
      const r = results[stu.id] || {};
      const scoreCells = semester.courses.map((c) => {
        const raw = semester.scoresByStudent?.[stu.id]?.[c.id];
        if (raw === undefined || raw === "" || raw === null) return "";
        const g = gradeForRaw(raw, bands);
        return c.grade_entry_mode === "letter" ? g.letter : `${raw} ${g.letter}`;
      });
      return [
        stu.name, stu.matric,
        ...scoreCells,
        r.creditSum ?? "", fmt(r.gpa), r.cumCredit ?? "", fmt(r.cgpa),
        r.status === "GOOD" ? "" : r.status,
        remarkFor(r || { rpt: [], co: [] }),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${semesterDisplayName(semester)}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const approval = { status: semester.approval_status, approvedBy: semester.approved_by };

  return (
    <div className="panel">
      <div className="sem-header">
        <div>
          <input
            className="sem-title-input"
            value={semester.label}
            disabled={!admin}
            onChange={(e) => updateSemester(semester.id, { label: e.target.value }).then(onChanged)}
          />
          <div className="sem-meta-row">
            <input className="sem-meta-input" placeholder="Session" disabled={!admin} defaultValue={semester.session || ""} onBlur={(e) => e.target.value !== (semester.session || "") && updateSemester(semester.id, { session: e.target.value }).then(onChanged)} />
            <input className="sem-meta-input" placeholder="Level" disabled={!admin} defaultValue={semester.level || ""} onBlur={(e) => e.target.value !== (semester.level || "") && updateSemester(semester.id, { level: e.target.value }).then(onChanged)} />
            <span className={approval.status === "published" ? "badge-published" : "badge-draft"}>
              {approval.status === "published" ? "PUBLISHED" : "DRAFT"}
            </span>
          </div>
        </div>
        <div className="sem-actions">
          {admin && (
            <label className="final-toggle">
              <input type="checkbox" checked={!!semester.is_final} onChange={(e) => updateSemester(semester.id, { is_final: e.target.checked }).then(onChanged)} />
              Final semester
            </label>
          )}
          <button className="secondary" onClick={exportCsv}>Export CSV</button>
          {admin && approval.status !== "published" && (
            <button className="primary" onClick={() => approveSemester(semester.id).then(onChanged)}>Approve &amp; publish</button>
          )}
          {admin && approval.status === "published" && (
            <button className="danger-ghost" onClick={() => revokeApproval(semester.id).then(onChanged)}>Revoke approval</button>
          )}
          {admin && (
            <button className="danger-ghost" onClick={() => window.confirm("Delete this semester and all its scores?") && deleteSemester(semester.id).then(onChanged)}>
              Delete semester
            </button>
          )}
        </div>
      </div>

      <div className="course-bar">
        <div className="course-chips">
          {semester.courses.map((c) => {
            const editable = canEditCourse(profile, c);
            const lecturerName = lecturers.find((l) => l.id === c.lecturer_id)?.name;
            return (
              <div className="course-chip" key={c.id} title={[lecturerName && `Lecturer: ${lecturerName}`, c.due_date && `Due: ${c.due_date}`].filter(Boolean).join(" \u00b7 ")}>
                <span className="chip-code">{c.code}</span>
                {c.type === "elective" && <span className="elective-tag">ELECTIVE</span>}
                <span className="chip-credit">{c.credit}cu</span>
                {admin && (
                  <button className="entry-btn" title="Toggle score vs. letter-grade entry" onClick={() => toggleEntryMode(c)}>
                    {c.grade_entry_mode === "letter" ? "A\u2013F" : "0\u2013100"}
                  </button>
                )}
                {c.locked ? (
                  <span className="locked-tag" title={c.submitted_at ? new Date(c.submitted_at).toLocaleString() : ""}>\ud83d\udd12 locked</span>
                ) : (
                  editable && <button className="entry-btn" onClick={() => submitCourse(c.id).then(onChanged)}>Submit</button>
                )}
                {admin && c.locked && (
                  <button className="entry-btn" onClick={() => reopenCourse(c.id).then(onChanged)}>Reopen</button>
                )}
                {admin && (
                  <button className="chip-remove" onClick={() => deleteCourse(c.id).then(onChanged)} aria-label={`Remove ${c.code}`}>\u00d7</button>
                )}
              </div>
            );
          })}
        </div>
        {overLoad && (
          <div className="warning-banner">
            \u26a0 This semester's course list totals {totalCredit} credit units, above the {department.policy.maxCreditLoad}-unit maximum load.
          </div>
        )}
        {admin && (
          <div className="inline-form">
            <input style={{ width: 100 }} placeholder="Code" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} />
            <input style={{ width: 180 }} placeholder="Title (optional)" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} />
            <input type="number" style={{ width: 70 }} placeholder="CU" value={newCourse.credit} onChange={(e) => setNewCourse({ ...newCourse, credit: e.target.value })} />
            <select value={newCourse.type} onChange={(e) => setNewCourse({ ...newCourse, type: e.target.value })}>
              <option value="compulsory">Compulsory</option>
              <option value="elective">Elective</option>
            </select>
            <select value={newCourse.lecturer_id} onChange={(e) => setNewCourse({ ...newCourse, lecturer_id: e.target.value })}>
              <option value="">No lecturer assigned</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <input type="date" style={{ width: 150 }} title="Scores due date (optional)" value={newCourse.due_date} onChange={(e) => setNewCourse({ ...newCourse, due_date: e.target.value })} />
            <button className="primary" onClick={addCourseRow}>+ Add course</button>
          </div>
        )}
      </div>

      {admin && <BulkScoreImport semester={semester} students={students} onImported={onChanged} />}

      <div className="inline-form">
        <input style={{ maxWidth: 280 }} placeholder="Search by name or matric no." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All students</option>
          <option value="failing">With an F this semester</option>
          <option value="co">With an outstanding (CO) course</option>
          <option value="probation">On probation</option>
          <option value="withdrawal">Withdrawal status</option>
        </select>
      </div>

      <div className="ledger-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th className="sticky-col" style={{ minWidth: 190 }}>Student</th>
              {semester.courses.map((c) => (
                <th key={c.id} style={{ textAlign: "center" }}>
                  {c.code}
                  <div className="th-sub">{c.credit}cu{c.type === "elective" ? " \u00b7 elec" : ""}</div>
                </th>
              ))}
              <th style={{ textAlign: "center" }}>CU</th>
              <th style={{ textAlign: "center" }}>GPA</th>
              <th style={{ textAlign: "center" }}>CGPA</th>
              <th style={{ textAlign: "center" }}>Status</th>
              {semester.is_final && <th style={{ textAlign: "center" }}>Class.</th>}
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((stu) => {
              const r = results[stu.id] || { creditSum: 0, gpa: null, cgpa: null, rpt: [], co: [], status: "GOOD" };
              return (
                <tr key={stu.id}>
                  <td className="sticky-col">
                    <div className="student-name">{stu.name}</div>
                    <div className="student-matric">{stu.matric}</div>
                  </td>
                  {semester.courses.map((c) => {
                    const raw = semester.scoresByStudent?.[stu.id]?.[c.id];
                    const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, bands) : null;
                    const editable = canEditCourse(profile, c);
                    return (
                      <td key={c.id} style={{ textAlign: "center" }}>
                        {editable ? (
                          c.grade_entry_mode === "letter" ? (
                            <select value={raw ?? ""} onChange={(e) => onSetScore(semester.id, c.id, stu.id, e.target.value)}>
                              <option value="">\u2014</option>
                              {letterOptions(bands).map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          ) : (
                            <div className="score-cell">
                              <input type="number" min={0} max={100} className="score-input" value={raw ?? ""} onChange={(e) => onSetScore(semester.id, c.id, stu.id, e.target.value)} />
                              {g && <span className={`grade-tag${g.letter === "F" ? " fail" : ""}`}>{g.letter}</span>}
                            </div>
                          )
                        ) : (
                          <span className={`grade-tag${g?.letter === "F" ? " fail" : ""}`}>
                            {g ? (c.grade_entry_mode === "letter" ? g.letter : `${raw} ${g.letter}`) : "\u2014"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", fontFamily: "var(--mono)" }}>{r.creditSum}</td>
                  <td style={{ textAlign: "center", fontFamily: "var(--mono)" }}>{fmt(r.gpa)}</td>
                  <td className="cgpa-cell">{fmt(r.cgpa)}</td>
                  <td style={{ textAlign: "center" }}>
                    {r.status !== "GOOD" && (
                      <span className={r.status === "WITHDRAWAL" ? "status-withdrawal" : "status-probation"}>{r.status}</span>
                    )}
                  </td>
                  {semester.is_final && <td style={{ textAlign: "center", fontSize: 12.5 }}>{r.classification || "\u2014"}</td>}
                  <td className={r.rpt?.length ? "remark-fail" : "remark-pass"}>{remarkFor(r)}</td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={semester.courses.length + 6}>Add students first, from the Students tab.</td></tr>
            )}
            {students.length > 0 && filteredStudents.length === 0 && (
              <tr><td colSpan={semester.courses.length + 6}>No students match that search/filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
