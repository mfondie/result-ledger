import { useState } from "react";
import { parseSpreadsheetFile, findColumn } from "../lib/spreadsheet";
import { setScoresBulk } from "../lib/api";

export default function BulkScoreImport({ semester, students, onImported }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await parseSpreadsheetFile(file);
      let updatedCount = 0, skippedRows = 0, skippedCells = 0;
      const unmatchedCourses = new Set();
      const toWrite = [];
      rows.forEach((row) => {
        const mk = findColumn(row, ["matric no", "matric no.", "matric", "matric number", "reg no"]);
        const matric = mk ? String(row[mk]).trim() : "";
        const stu = students.find((s) => (s.matric || "").trim().toLowerCase() === matric.toLowerCase());
        if (!stu) {
          skippedRows++;
          return;
        }
        semester.courses.forEach((c) => {
          const colKey = findColumn(row, [c.code]);
          if (!colKey) {
            unmatchedCourses.add(c.code);
            return;
          }
          const raw = row[colKey];
          if (raw === undefined || raw === "") return;
          if (c.grade_entry_mode === "letter") {
            toWrite.push({ courseId: c.id, studentId: stu.id, value: String(raw).trim().toUpperCase() });
            updatedCount++;
          } else {
            const n = Number(raw);
            if (Number.isNaN(n) || n < 0 || n > 100) {
              skippedCells++;
              return;
            }
            toWrite.push({ courseId: c.id, studentId: stu.id, value: n });
            updatedCount++;
          }
        });
      });
      setPreview({ toWrite, updatedCount, skippedRows, skippedCells, unmatchedCourses: [...unmatchedCourses] });
    } catch (err) {
      setPreview({ toWrite: [], updatedCount: 0, skippedRows: 0, skippedCells: 0, unmatchedCourses: [], error: err.message });
    }
    e.target.value = "";
  };

  const confirm = async () => {
    if (!preview?.toWrite.length) return;
    setBusy(true);
    try {
      await setScoresBulk(preview.toWrite);
      setPreview(null);
      await onImported();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#efece3", border: "1px solid var(--hairline)", borderRadius: 4, padding: "14px 16px", marginBottom: 18, maxWidth: 640 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--navy)", marginBottom: 4 }}>Bulk import scores</div>
      <p className="help-text">
        Upload a CSV or Excel file with a Matric No. column and one column per course code —
        columns are matched automatically against this semester's course codes.
      </p>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ fontSize: 12.5, marginTop: 4 }} />
      {preview && (
        <div style={{ marginTop: 10, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          {preview.error ? (
            <div style={{ color: "var(--warn)" }}>Could not read that file — {preview.error}</div>
          ) : (
            <>
              <div>{preview.updatedCount} score(s) ready to import.</div>
              {preview.skippedRows > 0 && <div style={{ color: "var(--warn)" }}>{preview.skippedRows} row(s) skipped — no matching matric no.</div>}
              {preview.skippedCells > 0 && <div style={{ color: "var(--warn)" }}>{preview.skippedCells} value(s) skipped — out of range.</div>}
              {preview.unmatchedCourses.length > 0 && (
                <div style={{ color: "var(--warn)" }}>Columns not matched to a course: {preview.unmatchedCourses.join(", ")}.</div>
              )}
              <button className="primary" onClick={confirm} disabled={!preview.toWrite.length || busy}>
                Confirm import ({preview.toWrite.length})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
