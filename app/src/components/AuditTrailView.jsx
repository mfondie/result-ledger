import { useEffect, useState } from "react";
import { fetchAuditLog } from "../lib/api";
import { ROLE_LABELS } from "../lib/permissions";

export default function AuditTrailView({ departmentId }) {
  const [log, setLog] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchAuditLog(departmentId).then(setLog);
  }, [departmentId]);

  const filtered = !log ? [] : typeFilter === "all" ? log : log.filter((e) => e.type === typeFilter);

  return (
    <div className="panel">
      <h1 className="page-title">Audit trail</h1>
      <p className="help-text">
        Every score change, course submission, reopen, and approval is logged server-side by
        database triggers — the most recent 300 entries are shown here.
      </p>
      <label className="field" style={{ maxWidth: 260, marginBottom: 18 }}>
        Filter by type
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All activity</option>
          <option value="score_change">Score changes</option>
          <option value="course_submitted">Course submissions</option>
          <option value="course_reopened">Course reopenings</option>
          <option value="semester_approved">Semester approvals</option>
          <option value="semester_revoked">Semester revocations</option>
        </select>
      </label>
      {log === null ? (
        <p className="help-text">Loading\u2026</p>
      ) : filtered.length === 0 ? (
        <p className="help-text">No activity recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>When</th><th>Who</th><th>Role</th><th>Detail</th></tr></thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString()}</td>
                <td>{entry.actor_name}</td>
                <td>{ROLE_LABELS[entry.role] || entry.role}</td>
                <td>{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
