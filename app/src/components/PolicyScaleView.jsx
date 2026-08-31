import { useState, useEffect } from "react";
import { updateDepartment } from "../lib/api";

export default function PolicyScaleView({ department, onChanged }) {
  const [bands, setBands] = useState(department.bands);
  const [policy, setPolicy] = useState(department.policy);
  const [meta, setMeta] = useState({ institution: department.institution, programme: department.programme, name: department.name });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setBands(department.bands);
    setPolicy(department.policy);
    setMeta({ institution: department.institution, programme: department.programme, name: department.name });
    setDirty(false);
  }, [department]);

  const save = async () => {
    await updateDepartment(department.id, {
      bands,
      policy,
      institution: meta.institution,
      programme: meta.programme,
      name: meta.name,
    });
    setDirty(false);
    await onChanged();
  };

  const setBandField = (i, field, value) => {
    const next = [...bands];
    next[i] = { ...next[i], [field]: field === "letter" ? value.toUpperCase().slice(0, 1) : Number(value) };
    setBands(next);
    setDirty(true);
  };

  const setPolicyField = (field, value) => {
    setPolicy({ ...policy, [field]: value });
    setDirty(true);
  };

  const setClassField = (i, field, value) => {
    const next = [...policy.classifications];
    next[i] = { ...next[i], [field]: field === "min" ? Number(value) : value };
    setPolicyField("classifications", next);
  };

  return (
    <div className="panel">
      <h1 className="page-title">Institution, grade scale &amp; policy</h1>
      <p className="help-text">
        These settings apply department-wide. Remember to hit Save — changes here aren't
        submitted keystroke-by-keystroke.
      </p>

      <h3 className="section-title">Institution details</h3>
      <div className="form-grid">
        <label className="field">Department name
          <input value={meta.name || ""} onChange={(e) => { setMeta({ ...meta, name: e.target.value }); setDirty(true); }} />
        </label>
        <label className="field">Institution
          <input value={meta.institution || ""} onChange={(e) => { setMeta({ ...meta, institution: e.target.value }); setDirty(true); }} />
        </label>
        <label className="field">Programme
          <input value={meta.programme || ""} onChange={(e) => { setMeta({ ...meta, programme: e.target.value }); setDirty(true); }} />
        </label>
      </div>

      <h3 className="section-title">Grade scale</h3>
      <table className="data-table">
        <thead><tr><th>Letter</th><th>Min</th><th>Max</th><th>Points</th></tr></thead>
        <tbody>
          {bands.map((b, i) => (
            <tr key={i}>
              <td><input className="cell-input" value={b.letter} onChange={(e) => setBandField(i, "letter", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={b.min} onChange={(e) => setBandField(i, "min", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={b.max} onChange={(e) => setBandField(i, "max", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={b.point} onChange={(e) => setBandField(i, "point", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="section-title">Probation &amp; withdrawal</h3>
      <div className="inline-form">
        <label className="field">Probation below CGPA
          <input type="number" step="0.1" value={policy.probationCgpa} onChange={(e) => setPolicyField("probationCgpa", Number(e.target.value))} />
        </label>
        <label className="field">Withdrawal below CGPA
          <input type="number" step="0.1" value={policy.withdrawalCgpa} onChange={(e) => setPolicyField("withdrawalCgpa", Number(e.target.value))} />
        </label>
        <label className="field">Consecutive semesters
          <input type="number" value={policy.withdrawalConsecutiveSemesters} onChange={(e) => setPolicyField("withdrawalConsecutiveSemesters", Number(e.target.value))} />
        </label>
      </div>

      <h3 className="section-title">Credit load &amp; electives</h3>
      <div className="inline-form">
        <label className="field">Max credit load
          <input type="number" value={policy.maxCreditLoad} onChange={(e) => setPolicyField("maxCreditLoad", Number(e.target.value))} />
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={policy.excludeElectivesFromGPA} onChange={(e) => setPolicyField("excludeElectivesFromGPA", e.target.checked)} />
        Exclude elective courses from GPA/CGPA
      </label>

      <h3 className="section-title">Resit / retake handling</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
        {[
          { v: "all", label: "Count every attempt" },
          { v: "latest", label: "Only the latest attempt counts" },
          { v: "average", label: "Average the point across attempts" },
        ].map((opt) => (
          <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="radio" name="resitPolicy" checked={policy.resitPolicy === opt.v} onChange={() => setPolicyField("resitPolicy", opt.v)} />
            {opt.label}
          </label>
        ))}
      </div>

      <h3 className="section-title">Degree classification (applied on semesters marked final)</h3>
      <table className="data-table">
        <thead><tr><th>Classification</th><th>Minimum CGPA</th></tr></thead>
        <tbody>
          {policy.classifications.map((c, i) => (
            <tr key={i}>
              <td><input className="cell-input" value={c.label} onChange={(e) => setClassField(i, "label", e.target.value)} /></td>
              <td><input className="cell-input" type="number" step="0.01" value={c.min} onChange={(e) => setClassField(i, "min", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="primary" onClick={save} disabled={!dirty}>Save changes</button>
    </div>
  );
}
