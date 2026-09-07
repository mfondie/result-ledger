import Papa from "papaparse";
import * as XLSX from "xlsx";

export function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: reject,
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}

// Strips everything except letters and numbers, so "Matric No.", "MATRIC_NO",
// "Matric-No", and "matric no" are all treated as the same header.
function normalize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findColumn(row, candidates) {
  const keys = Object.keys(row);
  const normCandidates = candidates.map(normalize);
  for (const key of keys) {
    if (normCandidates.includes(normalize(key))) return key;
  }
  // fall back to a loose "contains" match, e.g. a header of "Matriculation
  // Number" against a candidate of "matric"
  for (const key of keys) {
    const nk = normalize(key);
    if (normCandidates.some((c) => c.length >= 4 && nk.includes(c))) return key;
  }
  return null;
}
