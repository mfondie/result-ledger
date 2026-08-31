import { supabase } from "./supabaseClient";

// ---------- auth ----------

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

// ---------- department bundle ----------
// Fetches everything needed to render a department and re-shapes it into
// the { semesters: [{ ...sem, courses, scoresByStudent }] } form that
// src/lib/grading.js expects.

export async function loadDepartmentBundle(departmentId) {
  const [deptRes, studentsRes, semestersRes] = await Promise.all([
    supabase.from("departments").select("*").eq("id", departmentId).single(),
    supabase.from("students").select("*").eq("department_id", departmentId).order("name"),
    supabase.from("semesters").select("*").eq("department_id", departmentId).order("created_at"),
  ]);
  if (deptRes.error) throw deptRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (semestersRes.error) throw semestersRes.error;

  const semesters = semestersRes.data || [];
  const semesterIds = semesters.map((s) => s.id);

  let courses = [];
  if (semesterIds.length) {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .in("semester_id", semesterIds)
      .order("code");
    if (error) throw error;
    courses = data || [];
  }

  const courseIds = courses.map((c) => c.id);
  let scores = [];
  if (courseIds.length) {
    const { data, error } = await supabase.from("scores").select("*").in("course_id", courseIds);
    if (error) throw error;
    scores = data || [];
  }

  const coursesBySemester = {};
  courses.forEach((c) => {
    (coursesBySemester[c.semester_id] ||= []).push(c);
  });
  const scoresByCourse = {};
  scores.forEach((s) => {
    (scoresByCourse[s.course_id] ||= {})[s.student_id] = s.value;
  });

  const shapedSemesters = semesters.map((sem) => {
    const semCourses = coursesBySemester[sem.id] || [];
    const scoresByStudent = {};
    semCourses.forEach((c) => {
      const perStudent = scoresByCourse[c.id] || {};
      Object.entries(perStudent).forEach(([studentId, value]) => {
        (scoresByStudent[studentId] ||= {})[c.id] = value;
      });
    });
    return { ...sem, courses: semCourses, scoresByStudent };
  });

  return { department: deptRes.data, students: studentsRes.data || [], semesters: shapedSemesters };
}

// ---------- departments ----------

export async function fetchAllDepartments() {
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) throw error;
  return data || [];
}

export async function createDepartment(name) {
  const { data, error } = await supabase.from("departments").insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id, fields) {
  const { error } = await supabase.from("departments").update(fields).eq("id", id);
  if (error) throw error;
}

// ---------- students ----------

export async function addStudent(departmentId, fields) {
  const { data, error } = await supabase
    .from("students")
    .insert({ department_id: departmentId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addStudentsBulk(departmentId, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from("students")
    .insert(rows.map((r) => ({ department_id: departmentId, ...r })))
    .select();
  if (error) throw error;
  return data || [];
}

export async function updateStudent(id, fields) {
  const { error } = await supabase.from("students").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteStudent(id) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

// ---------- semesters ----------

export async function addSemester(departmentId, fields) {
  const { data, error } = await supabase
    .from("semesters")
    .insert({ department_id: departmentId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSemester(id, fields) {
  const { error } = await supabase.from("semesters").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteSemester(id) {
  const { error } = await supabase.from("semesters").delete().eq("id", id);
  if (error) throw error;
}

export async function approveSemester(id) {
  const { error } = await supabase.from("semesters").update({ approval_status: "published" }).eq("id", id);
  if (error) throw error;
}

export async function revokeApproval(id) {
  const { error } = await supabase.from("semesters").update({ approval_status: "draft" }).eq("id", id);
  if (error) throw error;
}

// ---------- courses ----------

export async function addCourse(semesterId, fields) {
  const { data, error } = await supabase
    .from("courses")
    .insert({ semester_id: semesterId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, fields) {
  const { error } = await supabase.from("courses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(id) {
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw error;
}

// locked/submitted_by/submitted_at are finished server-side by the
// trg_log_course_submission trigger — the client only ever flips `locked`.
export async function submitCourse(id) {
  const { error } = await supabase.from("courses").update({ locked: true }).eq("id", id);
  if (error) throw error;
}

export async function reopenCourse(id) {
  const { error } = await supabase.from("courses").update({ locked: false }).eq("id", id);
  if (error) throw error;
}

// ---------- scores ----------

export async function setScore(courseId, studentId, value) {
  const { error } = await supabase
    .from("scores")
    .upsert(
      { course_id: courseId, student_id: studentId, value: value === "" ? null : String(value) },
      { onConflict: "course_id,student_id" }
    );
  if (error) throw error;
}

export async function setScoresBulk(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("scores")
    .upsert(
      rows.map((r) => ({ course_id: r.courseId, student_id: r.studentId, value: r.value === "" ? null : String(r.value) })),
      { onConflict: "course_id,student_id" }
    );
  if (error) throw error;
}

// ---------- audit log ----------

export async function fetchAuditLog(departmentId, limit = 300) {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ---------- user management (superadmin only — enforced server-side too) ----------

export async function fetchDepartmentProfiles(departmentId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("department_id", departmentId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createUserAccount({ email, password, name, role, department_id }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { email, password, name, role, department_id },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
