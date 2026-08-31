import { useState } from "react";
import { parseSpreadsheetFile, findColumn } from "../lib/spreadsheet";
import { addStudentsBulk } from "../lib/api";

export default function BulkStudentImport({ departmentId, existingStudents, onImported }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheetFile(file);
      const existingMatrics = new Set(existingStudents.map((s) => (s.matric || "").trim().toLowerCase()).filter(Boolean));
      const toAdd = [];
      const duplicates = [];
      const errors = [];
      const seenInFile = new Set();
      rows.forEach((row, i) => {
        const nameCol = findColumn(row, ["name", "full name", "student name"]);
        const matricCol = findColumn(row, ["matric", "matric no", "matric number", "reg no", "registration number"]);
        const emailCol = findColumn(row, ["email", "email address"]);
        const name = nameCol ? String(row[nameCol]).trim() : "";
        const matric = matricCol ? String(row[matricCol]).trim() : "";
        const email = emailCol ? String(row[emailCol]).trim() : "";
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          return;
        }
        const key = matric.toLowerCase();
        if (matric && (existingMatrics.has(key) || seenInFile.has(key))) {
          duplicates.push({ name, matric });
          return;
        }
        if (matric) seenInFile.add(key);
        toAdd.push({ name, matric, email });
      });
      setPreview({ toAdd, duplicates, errors });
    } catch (err) {
      setPreview({ toAdd: [], duplicates: [], errors: ["Could not read file: " + err.message] });
    }
    e.target.value = "";
  };

  const confirm = async () => {
    if (!preview?.toAdd.length) return;
    setBusy(true);
    try {
      await addStudentsBulk(departmentId, preview.toAdd);
      setPreview(null);
      await onImported();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#efece3", border: "1px solid var(--hairline)", borderRadius: 4, padding: "14px 16px", marginBottom: 18, maxWidth: 640 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--navy)", marginBottom: 4 }}>Bulk import students</div>
      <p className="help-text">
        Upload a CSV or Excel file with a Name column, a Matric No. column, and optionally an
        Email column — headers are matched automatically.
      </p>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ fontSize: 12.5, marginTop: 4 }} />
      {preview && (
        <div style={{ marginTop: 10, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          <div>{preview.toAdd.length} new student(s) ready to add.</div>
          {preview.duplicates.length > 0 && (
            <div style={{ color: "var(--warn)" }}>{preview.duplicates.length} skipped — matric no. already exists.</div>
          )}
          {preview.errors.length > 0 && (
            <div style={{ color: "var(--warn)" }}>{preview.errors.length} row(s) skipped — {preview.errors.slice(0, 3).join("; ")}</div>
          )}
          <button className="primary" onClick={confirm} disabled={!preview.toAdd.length || busy}>
            Confirm import ({preview.toAdd.length})
          </button>
        </div>
      )}
    </div>
  );
}
