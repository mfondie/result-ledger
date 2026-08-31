import { useMemo } from "react";
import { runDataChecks } from "../lib/dataChecks";

export default function DataChecksView({ students, semesters }) {
  const issues = useMemo(() => runDataChecks(students, semesters), [students, semesters]);

  return (
    <div className="panel">
      <h1 className="page-title">Data checks</h1>
      <p className="help-text">Scans every student and semester for duplicate or invalid entries.</p>
      {issues.length === 0 ? (
        <div className="remark-pass">No issues found.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Type</th><th>Detail</th></tr></thead>
          <tbody>
            {issues.map((iss, i) => (
              <tr key={i}>
                <td className="remark-fail">{iss.type}</td>
                <td>{iss.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
