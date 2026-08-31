export const ROLE_LABELS = {
  hod: "Head of Department",
  exams_officer: "Exams Officer",
  lecturer: "Course Lecturer",
};

export function isAdminRole(profile) {
  return !!profile && (profile.role === "hod" || profile.role === "exams_officer");
}

// NOTE: this only controls what the UI *offers* — the real enforcement is
// the Postgres Row Level Security policies in supabase/schema.sql. Even if
// this check were bypassed client-side, the database would still reject
// the write.
export function canEditCourse(profile, course) {
  if (!profile || !course) return false;
  if (isAdminRole(profile)) return true;
  if (profile.role === "lecturer") {
    return course.lecturer_id === profile.id && !course.locked;
  }
  return false;
}
