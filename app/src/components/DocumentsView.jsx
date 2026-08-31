import { useState } from "react";
import { gradeForRaw, fmt, remarkFor, semesterDisplayName } from "../lib/grading";

function csvSafe(v) { return v ?? ""; }

function PrintButton({ label }) {
  return (
    <button className="primary no-print" onClick={() => window.print()}>
      {label || "Print / Save as PDF"}
    </button>
  );
}

function DocHeader({ department, title }) {
  return (
    <div className="doc-header">
      <div className="doc-institution">{department.institution || "Institution name not set"}</div>
      <div className="doc-dept">
        {department.name || "Department"}
        {department.programme ? ` — ${department.programme}` : ""}
      </div>
      <div className="doc-title">{title}</div>
    </div>
  );
}

function SignatureBlock({ lines }) {
  const defaults = lines || ["Course Lecturer", "Head of Department", "Exams Officer"];
  return (
    <div className="signature-row">
      {defaults.map((l) => (
        <div className="signature-block" key={l}>
          <div className="signature-line"></div>
          <div className="signature-label">{l}</div>
        </div>
      ))}
    </div>
  );
}

function TranscriptDoc({ department, semesters, students, results }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const student = students.find((s) => s.id === studentId);
  if (!students.length) return <p className="help-text">Add students first.</p>;

  return (
    <div>
      <div className="doc-controls no-print">
        <label className="field">
          Student
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.matric})</option>)}
          </select>
        </label>
        <PrintButton />
      </div>

      {student && (
        <div id="printable-doc" className="doc-page">
          <DocHeader department={department} title="Official Transcript of Academic Record" />
          <div className="doc-student-block">
            <div><strong>Name:</strong> {student.name}</div>
            <div><strong>Matric No.:</strong> {student.matric}</div>
          </div>

          {semesters.map((sem, i) => {
            const r = results[sem.id]?.[student.id];
            if (!r) return null;
            return (
              <div key={sem.id} className="doc-semester-block">
                <div className="doc-semester-title">
                  {semesterDisplayName(sem)}{sem.is_final ? " (Final)" : ""}
                </div>
                <table className="doc-table">
                  <thead><tr><th>Code</th><th>Title</th><th>CU</th><th>Score</th><th>Grade</th></tr></thead>
                  <tbody>
                    {sem.courses.map((c) => {
                      const raw = sem.scoresByStudent?.[student.id]?.[c.id];
                      const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, department.bands) : null;
                      return (
                        <tr key={c.id}>
                          <td>{c.code}</td>
                          <td>{c.title}</td>
                          <td style={{ textAlign: "center" }}>{c.credit}</td>
                          <td style={{ textAlign: "center" }}>{raw !== undefined && raw !== "" ? raw : "\u2014"}</td>
                          <td style={{ textAlign: "center" }}>{g ? g.letter : "\u2014"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="doc-semester-summary">
                  <span>GPA: <strong>{fmt(r.gpa)}</strong></span>
                  <span>CGPA: <strong>{fmt(r.cgpa)}</strong></span>
                  {r.status !== "GOOD" && <span className="doc-status-flag">{r.status}</span>}
                  {sem.is_final && r.classification && <span>Classification: <strong>{r.classification}</strong></span>}
                </div>
              </div>
            );
          })}

          <div className="doc-foot-note">Issued {new Date().toLocaleDateString()}. Not valid without institution seal and signature.</div>
          <SignatureBlock lines={["Registrar", "Head of Department"]} />
        </div>
      )}
    </div>
  );
}

function SemesterSheetDoc({ department, semesters, students, results }) {
  const [semesterId, setSemesterId] = useState(semesters[0]?.id || "");
  const semester = semesters.find((s) => s.id === semesterId);
  if (!semesters.length) return <p className="help-text">Create a semester first.</p>;

  return (
    <div>
      <div className="doc-controls no-print">
        <label className="field">
          Semester
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
            {semesters.map((s) => <option key={s.id} value={s.id}>{semesterDisplayName(s)}</option>)}
          </select>
        </label>
        <PrintButton />
      </div>

      {semester && (
        <div id="printable-doc" className="doc-page">
          <DocHeader department={department} title={`Semester Result Sheet — ${semesterDisplayName(semester)}`} />
          <table className="doc-table">
            <thead>
              <tr>
                <th>Name</th><th>Matric No.</th>
                {semester.courses.map((c) => <th key={c.id} style={{ textAlign: "center" }}>{c.code}</th>)}
                <th>GPA</th><th>CGPA</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu) => {
                const r = results[semester.id]?.[stu.id] || { gpa: null, cgpa: null, rpt: [], co: [] };
                return (
                  <tr key={stu.id}>
                    <td>{stu.name}</td>
                    <td>{stu.matric}</td>
                    {semester.courses.map((c) => {
                      const raw = semester.scoresByStudent?.[stu.id]?.[c.id];
                      const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, department.bands) : null;
                      return <td key={c.id} style={{ textAlign: "center" }}>{g ? g.letter : "\u2014"}</td>;
                    })}
                    <td style={{ textAlign: "center" }}>{fmt(r.gpa)}</td>
                    <td style={{ textAlign: "center" }}>{fmt(r.cgpa)}</td>
                    <td>{remarkFor(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="doc-foot-note">Prepared for departmental board review — {new Date().toLocaleDateString()}.</div>
          <SignatureBlock />
        </div>
      )}
    </div>
  );
}

function BroadsheetDoc({ department, semesters, students, results }) {
  const [selected, setSelected] = useState(() => semesters.map((s) => s.id));
  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const chosen = semesters.filter((s) => selected.includes(s.id));
  const last = chosen[chosen.length - 1];
  if (!semesters.length) return <p className="help-text">Create at least one semester first.</p>;

  return (
    <div>
      <div className="doc-controls no-print">
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 260 }}>
          <div className="rail-label" style={{ color: "#6b6a63" }}>Include semesters</div>
          {semesters.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              {semesterDisplayName(s)}
            </label>
          ))}
        </div>
        <PrintButton />
      </div>

      {chosen.length > 0 && (
        <div id="printable-doc" className="doc-page wide">
          <DocHeader department={department} title={`Broadsheet — ${chosen.map(semesterDisplayName).join(" + ")}`} />
          <div className="ledger-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Name</th><th>Matric No.</th>
                  {chosen.map((sem) => (
                    <th key={sem.id} style={{ textAlign: "center" }} colSpan={sem.courses.length || 1}>{semesterDisplayName(sem)}</th>
                  ))}
                  <th style={{ textAlign: "center" }}>Final GPA</th>
                  <th style={{ textAlign: "center" }}>Final CGPA</th>
                </tr>
                <tr>
                  <th></th><th></th>
                  {chosen.flatMap((sem) =>
                    sem.courses.length
                      ? sem.courses.map((c) => <th key={c.id} style={{ textAlign: "center", fontSize: 10 }}>{c.code}</th>)
                      : [<th key={sem.id + "-none"} style={{ textAlign: "center", fontSize: 10 }}>—</th>]
                  )}
                  <th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu) => {
                  const finalR = last ? results[last.id]?.[stu.id] : null;
                  return (
                    <tr key={stu.id}>
                      <td>{stu.name}</td>
                      <td>{stu.matric}</td>
                      {chosen.flatMap((sem) =>
                        sem.courses.length
                          ? sem.courses.map((c) => {
                              const raw = sem.scoresByStudent?.[stu.id]?.[c.id];
                              const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, department.bands) : null;
                              return <td key={c.id} style={{ textAlign: "center" }}>{g ? g.letter : "\u2014"}</td>;
                            })
                          : [<td key={sem.id + "-none"} style={{ textAlign: "center" }}>—</td>]
                      )}
                      <td style={{ textAlign: "center" }}>{fmt(last ? results[last.id]?.[stu.id]?.gpa : null)}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{fmt(finalR?.cgpa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="doc-foot-note">Session broadsheet for departmental board review — {new Date().toLocaleDateString()}.</div>
          <SignatureBlock />
        </div>
      )}
    </div>
  );
}

function StatementDoc({ department, semesters, students, results }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [semesterId, setSemesterId] = useState(semesters[0]?.id || "");
  const student = students.find((s) => s.id === studentId);
  const semester = semesters.find((s) => s.id === semesterId);
  const r = semester && student ? results[semester.id]?.[student.id] : null;
  if (!students.length || !semesters.length) return <p className="help-text">Add at least one student and one semester first.</p>;

  return (
    <div>
      <div className="doc-controls no-print">
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
        <PrintButton />
      </div>

      {student && semester && (
        <div id="printable-doc" className="doc-page narrow">
          <DocHeader department={department} title={`Statement of Result — ${semesterDisplayName(semester)}`} />
          <div className="doc-student-block">
            <div><strong>Name:</strong> {student.name}</div>
            <div><strong>Matric No.:</strong> {student.matric}</div>
          </div>
          <table className="doc-table">
            <thead><tr><th>Code</th><th>Title</th><th>CU</th><th>Score</th><th>Grade</th></tr></thead>
            <tbody>
              {semester.courses.map((c) => {
                const raw = semester.scoresByStudent?.[student.id]?.[c.id];
                const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, department.bands) : null;
                return (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.title}</td>
                    <td style={{ textAlign: "center" }}>{c.credit}</td>
                    <td style={{ textAlign: "center" }}>{csvSafe(raw) || "\u2014"}</td>
                    <td style={{ textAlign: "center" }}>{g ? g.letter : "\u2014"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="doc-semester-summary">
            <span>GPA: <strong>{fmt(r?.gpa)}</strong></span>
            <span>CGPA: <strong>{fmt(r?.cgpa)}</strong></span>
            {r && r.status !== "GOOD" && <span className="doc-status-flag">{r.status}</span>}
          </div>
          <div className="doc-foot-note">
            This is to certify that the above is the result obtained by the named student — issued {new Date().toLocaleDateString()}.
          </div>
          <SignatureBlock lines={["Exams Officer", "Head of Department"]} />
        </div>
      )}
    </div>
  );
}

export default function DocumentsView({ department, semesters, students, results }) {
  const [docType, setDocType] = useState("transcript");
  const tabs = [
    ["transcript", "Transcript"],
    ["semesterSheet", "Semester result sheet"],
    ["broadsheet", "Broadsheet"],
    ["statement", "Statement of result"],
  ];
  const props = { department, semesters, students, results };

  return (
    <div className="panel">
      <h1 className="page-title">Documents</h1>
      <p className="help-text">
        Each document is formatted for printing. Use the print button to save it as a PDF from
        your browser's print dialog (choose "Save as PDF" as the destination).
      </p>
      <div className="doc-sub-nav no-print">
        {tabs.map(([id, label]) => (
          <button key={id} className={`doc-sub-tab${docType === id ? " active" : ""}`} onClick={() => setDocType(id)}>{label}</button>
        ))}
      </div>
      {docType === "transcript" && <TranscriptDoc {...props} />}
      {docType === "semesterSheet" && <SemesterSheetDoc {...props} />}
      {docType === "broadsheet" && <BroadsheetDoc {...props} />}
      {docType === "statement" && <StatementDoc {...props} />}
    </div>
  );
}
