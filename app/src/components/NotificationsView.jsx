import { useEffect, useMemo, useState } from "react";
import { gradeForRaw, fmt, semesterDisplayName } from "../lib/grading";
import { fetchEmailLogs, sendResultEmail, getGmailAuthUrl, getGmailStatus } from "../lib/api";

function findOverdueCourses(semesters, students) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = [];
  semesters.forEach((sem) => {
    sem.courses.forEach((c) => {
      if (!c.due_date || c.due_date >= today) return;
      const missing = students.filter((stu) => {
        const raw = sem.scoresByStudent?.[stu.id]?.[c.id];
        return raw === undefined || raw === "" || raw === null;
      });
      if (missing.length) {
        overdue.push({ semester: semesterDisplayName(sem), code: c.code, dueDate: c.due_date, missingCount: missing.length });
      }
    });
  });
  return overdue;
}

function buildCoursesPayload(semester, student, bands) {
  return semester.courses.map((c) => {
    const raw = semester.scoresByStudent?.[student.id]?.[c.id];
    const g = raw !== undefined && raw !== "" ? gradeForRaw(raw, bands) : null;
    return { code: c.code, title: c.title, credit: c.credit, score: raw ?? "", grade: g ? g.letter : "" };
  });
}

function GmailConnectionPanel({ departmentId }) {
  const [status, setStatus] = useState(null); // null = loading
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const load = () => getGmailStatus(departmentId).then(setStatus).catch((e) => setError(e.message || String(e)));
  useEffect(() => { load(); }, [departmentId]);

  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const { url } = await getGmailAuthUrl(departmentId);
      window.location.href = url; // leaves the app, Google will redirect back here
    } catch (e) {
      setError(e.message || String(e));
      setConnecting(false);
    }
  };

  return (
    <div className="gmail-panel">
      <div>
        <strong>Gmail sending</strong>
        {status === null && !error && <div className="help-text" style={{ margin: 0 }}>Checking connection…</div>}
        {error && <div className="error-text">{error}</div>}
        {status && (
          status.connected ? (
            <div className="remark-pass">Connected as {status.email}</div>
          ) : (
            <div style={{ color: "#8a8778", fontSize: 12.5 }}>Not connected yet — results can't be emailed until you connect a Gmail account.</div>
          )
        )}
      </div>
      <button className="secondary" onClick={connect} disabled={connecting}>
        {connecting ? "Redirecting…" : status?.connected ? "Reconnect Gmail" : "Connect Gmail"}
      </button>
    </div>
  );
}

export default function NotificationsView({ department, semesters, students, results }) {
  const [semesterId, setSemesterId] = useState(semesters[semesters.length - 1]?.id || "");
  const semester = semesters.find((s) => s.id === semesterId);
  const [logMap, setLogMap] = useState({});
  const [sending, setSending] = useState({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState("");

  const overdue = useMemo(() => findOverdueCourses(semesters, students), [semesters, students]);

  const loadLogs = async (semId) => {
    if (!semId) return;
    const logs = await fetchEmailLogs(semId);
    const map = {};
    logs.forEach((l) => {
      if (!map[l.student_id] || new Date(l.sent_at) > new Date(map[l.student_id].sent_at)) {
        map[l.student_id] = l;
      }
    });
    setLogMap(map);
  };

  useEffect(() => {
    loadLogs(semesterId);
  }, [semesterId]);

  const published = semester?.approval_status === "published";

  const sendOne = async (student) => {
    if (!semester || !published) return;
    setError("");
    setSending((s) => ({ ...s, [student.id]: true }));
    try {
      const r = results[semester.id]?.[student.id];
      await sendResultEmail({
        studentId: student.id,
        semesterId: semester.id,
        gpa: r?.gpa != null ? fmt(r.gpa) : null,
        cgpa: r?.cgpa != null ? fmt(r.cgpa) : null,
        courses: buildCoursesPayload(semester, student, department.bands),
      });
      await loadLogs(semester.id);
    } catch (e) {
      setError(`${student.name}: ${e.message || String(e)}`);
    } finally {
      setSending((s) => ({ ...s, [student.id]: false }));
    }
  };

  const sendToAllPending = async () => {
    setBulkRunning(true);
    setError("");
    const targets = students.filter((s) => s.email && logMap[s.id]?.status !== "sent");
    for (const stu of targets) {
      await sendOne(stu);
      await new Promise((res) => setTimeout(res, 400)); // gentle pacing
    }
    setBulkRunning(false);
  };

  const pendingCount = students.filter((s) => s.email && logMap[s.id]?.status !== "sent").length;

  return (
    <div className="panel">
      <h1 className="page-title">Notifications</h1>
      <p className="help-text">
        Result emails are sent through your department's connected Gmail account and logged
        below. Overdue courses are flagged automatically from the due dates set when a course
        was added.
      </p>

      <GmailConnectionPanel departmentId={department.id} />

      <h3 className="section-title">Email results for a semester</h3>
      {!students.length || !semesters.length ? (
        <p className="help-text">Add at least one student and one semester first.</p>
      ) : (
        <>
          <div className="inline-form">
            <label className="field">
              Semester
              <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                {semesters.map((s) => <option key={s.id} value={s.id}>{semesterDisplayName(s)}</option>)}
              </select>
            </label>
            {semester && (
              <span className={published ? "badge-published" : "badge-draft"}>
                {published ? "PUBLISHED" : "DRAFT"}
              </span>
            )}
            {published && pendingCount > 0 && (
              <button className="primary" onClick={sendToAllPending} disabled={bulkRunning}>
                {bulkRunning ? "Sending…" : `Send to all pending (${pendingCount})`}
              </button>
            )}
          </div>

          {!published && semester && (
            <div className="error-text">
              This semester is still in DRAFT — approve and publish it (from the semester view) before results can be emailed.
            </div>
          )}
          {error && <div className="error-text">{error}</div>}

          {semester && (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Matric No.</th><th>Email</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {students.map((stu) => {
                  const log = logMap[stu.id];
                  return (
                    <tr key={stu.id}>
                      <td>{stu.name}</td>
                      <td>{stu.matric}</td>
                      <td>{stu.email || <span className="error-text">no email</span>}</td>
                      <td>
                        {log?.status === "sent" && <span className="remark-pass">Sent {new Date(log.sent_at).toLocaleDateString()}</span>}
                        {log?.status === "failed" && <span className="remark-fail" title={log.error_message}>Failed</span>}
                        {!log && <span style={{ color: "#8a8778" }}>Not sent</span>}
                      </td>
                      <td>
                        <button
                          className="secondary"
                          disabled={!stu.email || !published || sending[stu.id]}
                          onClick={() => sendOne(stu)}
                        >
                          {sending[stu.id] ? "Sending…" : log?.status === "sent" ? "Resend" : "Send"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && <tr><td colSpan={5}>No students yet.</td></tr>}
              </tbody>
            </table>
          )}
        </>
      )}

      <h3 className="section-title">Overdue score submissions</h3>
      {overdue.length === 0 ? (
        <div className="remark-pass">No courses past their due date with missing scores.</div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Semester</th><th>Course</th><th>Due date</th><th>Missing scores</th></tr></thead>
          <tbody>
            {overdue.map((o, i) => (
              <tr key={i}>
                <td>{o.semester}</td>
                <td>{o.code}</td>
                <td className="remark-fail">{o.dueDate}</td>
                <td>{o.missingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
