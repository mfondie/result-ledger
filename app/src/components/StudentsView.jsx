import { useState } from "react";
import { addStudent, updateStudent, deleteStudent } from "../lib/api";
import BulkStudentImport from "./BulkStudentImport.jsx";

export default function StudentsView({ departmentId, students, onChanged }) {
  const [name, setName] = useState("");
  const [matric, setMatric] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addStudent(departmentId, { name: name.trim(), matric: matric.trim(), email: email.trim() });
      setName(""); setMatric(""); setEmail("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = students.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.matric || "").toLowerCase().includes(q)
  );

  return (
    <div className="panel">
      <h1 className="page-title">Students</h1>
      <p className="help-text">One roll shared across every semester — add each student once.</p>
      <div className="inline-form">
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input placeholder="Matric no." value={matric} onChange={(e) => setMatric(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="primary" onClick={add} disabled={busy}>+ Add student</button>
      </div>

      <BulkStudentImport departmentId={departmentId} existingStudents={students} onImported={onChanged} />

      <input
        style={{ maxWidth: 320, marginBottom: 10 }}
        placeholder="Search by name or matric no."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Matric no.</th>
            <th>Email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id}>
              <td>
                <input className="cell-input" defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && updateStudent(s.id, { name: e.target.value }).then(onChanged)} />
              </td>
              <td>
                <input className="cell-input" defaultValue={s.matric} onBlur={(e) => e.target.value !== s.matric && updateStudent(s.id, { matric: e.target.value }).then(onChanged)} />
              </td>
              <td>
                <input className="cell-input" defaultValue={s.email || ""} placeholder="\u2014" onBlur={(e) => e.target.value !== (s.email || "") && updateStudent(s.id, { email: e.target.value }).then(onChanged)} />
              </td>
              <td>
                <button className="ghost" onClick={() => deleteStudent(s.id).then(onChanged)}>Remove</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4}>{students.length === 0 ? "No students yet." : "No students match that search."}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
