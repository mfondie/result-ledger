import { useEffect, useState } from "react";
import { fetchDepartmentProfiles, createUserAccount } from "../lib/api";
import { ROLE_LABELS } from "../lib/permissions";

export default function UserManagementView({ departmentId }) {
  const [profiles, setProfiles] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "lecturer" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => fetchDepartmentProfiles(departmentId).then(setProfiles);
  useEffect(() => { reload(); }, [departmentId]);

  const submit = async () => {
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email, and password are all required.");
      return;
    }
    setBusy(true);
    try {
      await createUserAccount({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        department_id: departmentId,
      });
      setForm({ name: "", email: "", password: "", role: "lecturer" });
      await reload();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h1 className="page-title">Manage users</h1>
      <p className="help-text">
        Create HOD, Exams Officer, and Lecturer accounts here with a password of your choosing.
        Once a lecturer account exists, assign them to a specific course from the course chip in
        that course's semester view — courses reference a real account, not just a typed name.
      </p>

      <h3 className="section-title">Create an account</h3>
      {error && <div className="error-text">{error}</div>}
      <div className="form-grid">
        <label className="field">Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field">Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">Password
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
        </label>
        <label className="field">Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="hod">Head of Department</option>
            <option value="exams_officer">Exams Officer</option>
            <option value="lecturer">Course Lecturer</option>
          </select>
        </label>
        <button className="primary" onClick={submit} disabled={busy}>{busy ? "Creating\u2026" : "+ Create account"}</button>
      </div>

      <h3 className="section-title">Existing accounts in this department</h3>
      {profiles === null ? (
        <p className="help-text">Loading\u2026</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.is_superadmin ? " (superadmin)" : ""}</td>
                <td>{p.email}</td>
                <td>{ROLE_LABELS[p.role] || p.role}</td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={3}>No accounts yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
