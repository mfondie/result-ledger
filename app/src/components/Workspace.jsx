import { useEffect, useState, useCallback } from "react";
import {
  loadDepartmentBundle,
  fetchAllDepartments,
  createDepartment,
  addSemester,
  setScore as apiSetScore,
} from "../lib/api";
import { computeAllWithPolicy, semesterDisplayName } from "../lib/grading";
import { isAdminRole, ROLE_LABELS } from "../lib/permissions";
import SemesterView from "./SemesterView.jsx";
import StudentsView from "./StudentsView.jsx";
import PolicyScaleView from "./PolicyScaleView.jsx";
import AuditTrailView from "./AuditTrailView.jsx";
import UserManagementView from "./UserManagementView.jsx";
import NewSemesterForm from "./NewSemesterForm.jsx";
import DashboardView from "./DashboardView.jsx";
import DocumentsView from "./DocumentsView.jsx";
import NotificationsView from "./NotificationsView.jsx";
import DataChecksView from "./DataChecksView.jsx";

function groupSemesters(semesters) {
  const order = [];
  const map = {};
  semesters.forEach((sem) => {
    const key = [sem.session, sem.level].filter(Boolean).join(" \u00b7 ") || "Unsorted";
    if (!map[key]) {
      map[key] = [];
      order.push(key);
    }
    map[key].push(sem);
  });
  return order.map((key) => ({ key, items: map[key] }));
}

export default function Workspace({ profile, onSignOut }) {
  const [departments, setDepartments] = useState(null); // superadmin only
  const [activeDeptId, setActiveDeptId] = useState(profile.is_superadmin ? null : profile.department_id);

  useEffect(() => {
    if (profile.is_superadmin) {
      fetchAllDepartments().then(setDepartments);
    }
  }, [profile.is_superadmin]);

  if (profile.is_superadmin && !activeDeptId) {
    return (
      <DeptPicker
        departments={departments}
        profile={profile}
        onSelect={setActiveDeptId}
        onSignOut={onSignOut}
        onCreated={(dept) => {
          setDepartments((prev) => [...(prev || []), dept]);
          setActiveDeptId(dept.id);
        }}
      />
    );
  }

  return (
    <DepartmentShell
      key={activeDeptId}
      profile={profile}
      departmentId={activeDeptId}
      onSignOut={onSignOut}
      onSwitchDepartment={profile.is_superadmin ? () => setActiveDeptId(null) : null}
    />
  );
}

function DeptPicker({ departments, profile, onSelect, onSignOut, onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const dept = await createDepartment(name.trim());
      onCreated(dept);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="session-bar">
          <span>Signed in as <strong>{profile.name}</strong> ({ROLE_LABELS[profile.role]}, superadmin)</span>
          <button className="logout-link" onClick={onSignOut}>Log out</button>
        </div>
        <h1 className="page-title">{departments?.length ? "Choose a department" : "Create your first department"}</h1>
        {departments === null ? (
          <p className="help-text">Loading\u2026</p>
        ) : (
          <div className="form-grid">
            {departments.map((d) => (
              <button key={d.id} className="secondary" style={{ textAlign: "left" }} onClick={() => onSelect(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
        )}
        <div className="inline-form" style={{ marginTop: 18 }}>
          <input placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="primary" onClick={create} disabled={busy}>+ Create department</button>
        </div>
      </div>
    </div>
  );
}

function DepartmentShell({ profile, departmentId, onSignOut, onSwitchDepartment }) {
  const admin = isAdminRole(profile);
  const [department, setDepartment] = useState(null);
  const [students, setStudents] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState({ tab: "semester", semesterId: null });
  const [showNewSemForm, setShowNewSemForm] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const bundle = await loadDepartmentBundle(departmentId);
      setDepartment(bundle.department);
      setStudents(bundle.students);
      setSemesters(bundle.semesters);
      setView((prev) => {
        if (prev.tab === "semester" && !bundle.semesters.find((s) => s.id === prev.semesterId)) {
          return { tab: "semester", semesterId: bundle.semesters[bundle.semesters.length - 1]?.id || null };
        }
        return prev;
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => { reload(); }, [reload]);

  // Optimistic local update for score entry — see setScoreOptimistic below.
  // Everything else re-fetches the bundle after the write so server-set
  // fields (submitted_by/at, approved_by/at, audit log) stay authoritative.
  const setScoreOptimistic = useCallback(
    async (semesterId, courseId, studentId, value) => {
      setSemesters((prev) =>
        prev.map((sem) => {
          if (sem.id !== semesterId) return sem;
          const scoresByStudent = { ...sem.scoresByStudent };
          scoresByStudent[studentId] = { ...(scoresByStudent[studentId] || {}), [courseId]: value };
          return { ...sem, scoresByStudent };
        })
      );
      try {
        await apiSetScore(courseId, studentId, value);
      } catch (e) {
        setError(e.message || String(e));
        reload();
      }
    },
    [reload]
  );

  const createSemester = async (fields) => {
    await addSemester(departmentId, {
      label: `${fields.term || "New"} Semester`,
      session: fields.session,
      level: fields.level,
      term: fields.term,
    });
    setShowNewSemForm(false);
    await reload();
  };

  if (loading && !department) {
    return (
      <div className="centered">
        <div className="help-text">Loading department\u2026</div>
      </div>
    );
  }

  if (error && !department) {
    return (
      <div className="centered">
        <div className="card">
          <h1 className="page-title">Couldn't load this department</h1>
          <p className="error-text">{error}</p>
          <button className="secondary" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }

  const bands = department?.bands || [];
  const policy = department?.policy || {};
  const results = computeAllWithPolicy(semesters, students, bands, policy);
  const activeSemester = semesters.find((s) => s.id === view.semesterId) || null;

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-head">
          <div className="rail-mark">\u00a7</div>
          <div>
            <div className="rail-title">Result Ledger</div>
            <div className="rail-sub">{department?.name || "Department"}</div>
          </div>
        </div>

        {onSwitchDepartment && (
          <button className="add-btn" onClick={onSwitchDepartment}>\u21c4 Switch department</button>
        )}

        <div className="session-bar">
          <div>{profile.name}</div>
          <div className="session-role">{ROLE_LABELS[profile.role]}{profile.is_superadmin ? " \u00b7 superadmin" : ""}</div>
          <button className="logout-link" onClick={onSignOut}>Log out</button>
        </div>

        <nav className="rail-nav">
          <div className="rail-label">Semesters</div>
          {groupSemesters(semesters).map((group) => (
            <div key={group.key}>
              <div className="rail-label" style={{ marginLeft: 6, color: "#a8a496" }}>{group.key}</div>
              {group.items.map((sem) => (
                <button
                  key={sem.id}
                  className={`tab-btn${view.tab === "semester" && view.semesterId === sem.id ? " active" : ""}`}
                  onClick={() => setView({ tab: "semester", semesterId: sem.id })}
                >
                  <span className="tab-label">{semesterDisplayName(sem)}{sem.is_final ? " \u2605" : ""}</span>
                </button>
              ))}
            </div>
          ))}
          {admin && (
            showNewSemForm ? (
              <NewSemesterForm onCreate={createSemester} onCancel={() => setShowNewSemForm(false)} />
            ) : (
              <button className="add-btn" onClick={() => setShowNewSemForm(true)}>+ New semester</button>
            )
          )}
        </nav>

        <div className="rail-foot">
          {admin && (
            <>
              <button className={`tab-btn${view.tab === "dashboard" ? " active" : ""}`} onClick={() => setView({ tab: "dashboard" })}>
                <span className="tab-label">Dashboard</span>
              </button>
              <button className={`tab-btn${view.tab === "students" ? " active" : ""}`} onClick={() => setView({ tab: "students" })}>
                <span className="tab-label">Students</span>
              </button>
              <button className={`tab-btn${view.tab === "checks" ? " active" : ""}`} onClick={() => setView({ tab: "checks" })}>
                <span className="tab-label">Data checks</span>
              </button>
              <button className={`tab-btn${view.tab === "policy" ? " active" : ""}`} onClick={() => setView({ tab: "policy" })}>
                <span className="tab-label">Grade scale &amp; policy</span>
              </button>
              <button className={`tab-btn${view.tab === "notifications" ? " active" : ""}`} onClick={() => setView({ tab: "notifications" })}>
                <span className="tab-label">Notifications</span>
              </button>
              <button className={`tab-btn${view.tab === "audit" ? " active" : ""}`} onClick={() => setView({ tab: "audit" })}>
                <span className="tab-label">Audit trail</span>
              </button>
            </>
          )}
          <button className={`tab-btn${view.tab === "documents" ? " active" : ""}`} onClick={() => setView({ tab: "documents" })}>
            <span className="tab-label">Documents</span>
          </button>
          {profile.is_superadmin && (
            <button className={`tab-btn${view.tab === "users" ? " active" : ""}`} onClick={() => setView({ tab: "users" })}>
              <span className="tab-label">Manage users</span>
            </button>
          )}
        </div>
      </aside>

      <main className="main">
        {error && <div className="error-text">{error}</div>}
        {view.tab === "students" && admin && <StudentsView departmentId={departmentId} students={students} onChanged={reload} />}
        {view.tab === "policy" && admin && <PolicyScaleView department={department} onChanged={reload} />}
        {view.tab === "audit" && admin && <AuditTrailView departmentId={departmentId} />}
        {view.tab === "checks" && admin && <DataChecksView students={students} semesters={semesters} />}
        {view.tab === "dashboard" && admin && (
          <DashboardView department={department} semesters={semesters} students={students} results={results} />
        )}
        {view.tab === "notifications" && admin && (
          <NotificationsView department={department} semesters={semesters} students={students} results={results} />
        )}
        {view.tab === "documents" && (
          <DocumentsView department={department} semesters={semesters} students={students} results={results} />
        )}
        {view.tab === "users" && profile.is_superadmin && <UserManagementView departmentId={departmentId} />}
        {view.tab === "semester" && activeSemester && (
          <SemesterView
            department={department}
            semester={activeSemester}
            students={students}
            results={results[activeSemester.id] || {}}
            profile={profile}
            onSetScore={setScoreOptimistic}
            onChanged={reload}
          />
        )}
        {view.tab === "semester" && !activeSemester && admin && (
          <div className="empty-state">
            <div className="empty-mark">\u00a7</div>
            <h2 className="page-title">No semester yet</h2>
            <p className="help-text">Create your first semester from the sidebar to start entering courses and scores.</p>
          </div>
        )}
        {view.tab === "semester" && !activeSemester && !admin && (
          <p className="help-text">No semester has been created yet — check back once your department admin sets one up.</p>
        )}
      </main>
    </div>
  );
}
