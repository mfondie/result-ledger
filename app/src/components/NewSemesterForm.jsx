import { useState } from "react";

export default function NewSemesterForm({ onCreate, onCancel }) {
  const [session, setSession] = useState("");
  const [level, setLevel] = useState("");
  const [term, setTerm] = useState("First");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onCreate({ session: session.trim(), level: level.trim(), term });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(217,194,148,0.2)", borderRadius: 4, padding: 10, marginTop: 6 }}>
      <input className="rail-input" placeholder="Session e.g. 2023/2024" value={session} onChange={(e) => setSession(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      <input className="rail-input" placeholder="Level e.g. 100L" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      <select value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: "100%", marginBottom: 8 }}>
        <option value="First">First Semester</option>
        <option value="Second">Second Semester</option>
        <option value="Summer/Resit">Summer / Resit</option>
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="primary" onClick={submit} disabled={busy}>Add</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
