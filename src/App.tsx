import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

type UserRole = "admin" | "staff" | "teacher" | "student";
type AttendanceStatus = "present" | "late" | "absent" | "excused";
type LessonStatus = "scheduled" | "completed" | "cancelled";
type ActivityActionType =
  | "session_started"
  | "attendance_updated"
  | "lesson_note_saved"
  | "session_finished"
  | "late_entry_updated";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ACTIVE_ATTENDANCE_MESSAGE = "Attendance can only be updated during an active scheduled session.";
const ATTENDANCE_SAVE_ERROR_MESSAGE = "Attendance can only be updated during your active scheduled lesson.";
const LESSON_NOTE_SAVE_ERROR_MESSAGE = "Lesson notes can only be updated during your active scheduled lesson.";
const UNEXPECTED_SAVE_ERROR_MESSAGE =
  "An unexpected error occurred while saving. Please try again or contact the coordinator.";

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
};

type Teacher = {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  display_name: string;
  is_active: boolean;
};

type LessonRow = {
  id: string;
  class_id: string;
  teacher_id: string | null;
  lesson_date: string;
  starts_at: string;
  ends_at: string;
  title: string;
  status: LessonStatus;
  started_at: string | null;
  finished_at: string | null;
};

type ClassRow = {
  id: string;
  teacher_id: string;
  name: string;
  location: string | null;
};

type StudentRow = {
  id: string;
  full_name: string;
  student_code: string | null;
  phone: string | null;
  date_of_birth: string | null;
};

type AttendanceRow = {
  id: string;
  lesson_id: string;
  class_id: string;
  student_id: string;
  status: AttendanceStatus;
};

type ClassStudentRow = {
  class_id: string;
  student_id: string;
};

type LessonNoteRow = {
  id: string;
  lesson_id: string;
  body: string;
};

type SessionStudent = {
  id: string;
  fullName: string;
  studentCode: string | null;
  phone: string | null;
  birthYear: string | null;
  attendanceStatus: AttendanceStatus | null;
};

type SummerSession = {
  id: string;
  classId: string;
  teacherId: string | null;
  teacherName: string;
  teacherEmployeeCode: string | null;
  className: string;
  location: string | null;
  lessonDate: string;
  startsAt: string;
  endsAt: string;
  title: string;
  status: LessonStatus;
  startedAt: string | null;
  finishedAt: string | null;
  students: SessionStudent[];
  note: string;
};

type CoordinatorStats = {
  teacherCount: number;
  studentCount: number;
  todaySessionCount: number;
  attendanceCompletedCount: number;
  attendancePendingCount: number;
  notesCompletedCount: number;
};

type ActivityLogRow = {
  id: string;
  action_type: ActivityActionType;
  lesson_id: string | null;
  teacher_id: string | null;
  actor_user_id: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

type HistoryFilter = "today" | "yesterday" | "week" | "all";

const SESSION_OUTSIDE_SCHEDULE_MESSAGE = "This session cannot be started outside its scheduled time.";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [teacherSessions, setTeacherSessions] = useState<SummerSession[]>([]);
  const [coordinatorSessions, setCoordinatorSessions] = useState<SummerSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<CoordinatorStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isCoordinator = useMemo(
    () => profile?.role === "admin" || profile?.role === "staff",
    [profile],
  );

  const selectedSession = teacherSessions.find((item: SummerSession) => item.id === selectedSessionId) ?? null;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      setTeacher(null);
      setTeacherSessions([]);
      setCoordinatorSessions([]);
      setTeachers([]);
      setStats(null);
      setActivityLogs([]);
      return;
    }

    loadSignedInUser(session.user.id);
  }, [session?.user.id]);

  useEffect(() => {
    if (profile?.role !== "teacher" || !session?.user.id) return;

    const recoverActiveSession = () => {
      loadTeacherDashboard(session.user.id);
    };

    const recoverWhenVisible = () => {
      if (document.visibilityState === "visible") recoverActiveSession();
    };

    window.addEventListener("online", recoverActiveSession);
    window.addEventListener("focus", recoverActiveSession);
    document.addEventListener("visibilitychange", recoverWhenVisible);

    return () => {
      window.removeEventListener("online", recoverActiveSession);
      window.removeEventListener("focus", recoverActiveSession);
      document.removeEventListener("visibilitychange", recoverWhenVisible);
    };
  }, [profile?.role, session?.user.id]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function loadSignedInUser(userId: string) {
    setProfileLoading(true);
    setError(null);

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      setError("This login is not linked to an app profile yet.");
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfile(userProfile);

    if (userProfile.role === "admin" || userProfile.role === "staff") {
      await loadCoordinatorDashboard();
    }

    if (userProfile.role === "teacher") {
      await loadTeacherDashboard(userId);
    }

    setProfileLoading(false);
  }

  async function loadCoordinatorDashboard() {
    const allSessions = await loadSessions();
    const today = getTodayDate();
    const todaySessions = allSessions.filter((item) => item.lessonDate === today);

    const [teacherCount, studentCount, teacherRows, activityRows] = await Promise.all([
      supabase
        .from("teachers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .like("employee_code", "YAZ-%"),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .like("student_code", "YAZ-VISIBLE-%"),
      supabase
      .from("teachers")
      .select("id, user_id, employee_code, display_name, is_active")
      .eq("is_active", true)
      .like("employee_code", "YAZ-%")
      .order("display_name", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("id, action_type, lesson_id, teacher_id, actor_user_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const dashboardError = teacherCount.error || studentCount.error || teacherRows.error || activityRows.error;
    if (dashboardError) {
      setError(dashboardError.message);
      return;
    }

    setTeachers(teacherRows.data ?? []);
    setCoordinatorSessions(allSessions);
    setActivityLogs((activityRows.data ?? []) as ActivityLogRow[]);
    setStats({
      teacherCount: teacherCount.count ?? 0,
      studentCount: studentCount.count ?? 0,
      todaySessionCount: todaySessions.length,
      attendanceCompletedCount: todaySessions.filter(hasCompletedAttendance).length,
      attendancePendingCount: todaySessions.filter((item) => !hasCompletedAttendance(item)).length,
      notesCompletedCount: todaySessions.filter((item) => item.note.trim().length > 0).length,
    });
  }

  async function loadTeacherDashboard(userId: string) {
    const { data: linkedTeacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id, user_id, employee_code, display_name, is_active")
      .eq("user_id", userId)
      .single();

    if (teacherError) {
      setTeacher(null);
      setTeacherSessions([]);
      setError("Your teacher login is not linked yet. Ask the coordinator to run the teacher linking SQL.");
      return;
    }

    let sessions = await loadSessions(linkedTeacher.id);
    const sessionsNeedingAttendance = sessions.filter(
      (item) => item.startedAt && !item.finishedAt && item.students.length > 0 && !hasCompletedAttendance(item),
    );

    if (sessionsNeedingAttendance.length > 0) {
      for (const item of sessionsNeedingAttendance) {
        await ensureAttendanceRecordsForSession(item);
      }
      sessions = await loadSessions(linkedTeacher.id);
    }

    setTeacher(linkedTeacher);
    setTeacherSessions(sessions);

    const activeSessions = getActiveSessions(sessions);
    if (activeSessions.length > 1) {
      setError("Multiple active sessions detected. Please contact the coordinator.");
      setSelectedSessionId(null);
      return;
    }

    if (activeSessions.length === 1) {
      setSelectedSessionId(activeSessions[0].id);
      return;
    }

    setSelectedSessionId((currentId: string | null) =>
      currentId && sessions.some((item) => item.id === currentId) ? currentId : sessions[0]?.id ?? null,
    );
  }

  async function loadSessions(teacherId?: string) {
    const lessonQuery = supabase
      .from("lessons")
      .select("id, class_id, teacher_id, lesson_date, starts_at, ends_at, title, status, started_at, finished_at")
      .neq("status", "cancelled")
      .order("lesson_date", { ascending: true })
      .order("starts_at", { ascending: true });

    const { data: lessons, error: lessonsError } = teacherId
      ? await lessonQuery.eq("teacher_id", teacherId)
      : await lessonQuery;

    if (lessonsError) {
      setError(lessonsError.message);
      return [];
    }

    const lessonRows = (lessons ?? []) as LessonRow[];
    if (lessonRows.length === 0) return [];

    const classIds = [...new Set(lessonRows.map((item) => item.class_id))];
    const teacherIds = [...new Set(lessonRows.map((item) => item.teacher_id).filter(Boolean))] as string[];
    const lessonIds = lessonRows.map((item) => item.id);

    const [classes, teacherRows, enrollments, attendance, notes] = await Promise.all([
      supabase.from("classes").select("id, teacher_id, name, location").in("id", classIds),
      teacherIds.length
        ? supabase
            .from("teachers")
            .select("id, user_id, employee_code, display_name, is_active")
            .in("id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("class_students")
        .select("class_id, student_id")
        .in("class_id", classIds)
        .eq("status", "active"),
      supabase.from("attendance").select("id, lesson_id, class_id, student_id, status").in("lesson_id", lessonIds),
      supabase.from("lesson_notes").select("id, lesson_id, body").in("lesson_id", lessonIds),
    ]);

    const sessionError = classes.error || teacherRows.error || enrollments.error || attendance.error || notes.error;
    if (sessionError) {
      setError(sessionError.message);
      console.error("[Load sessions] Supabase load error", {
        classesError: classes.error,
        teacherRowsError: teacherRows.error,
        enrollmentsError: enrollments.error,
        attendanceError: attendance.error,
        notesError: notes.error,
      });
      return [];
    }

    const enrollmentRows = (enrollments.data ?? []) as ClassStudentRow[];
    const studentIds = [...new Set(enrollmentRows.map((row) => row.student_id).filter(Boolean))];
    const studentsResult = studentIds.length
      ? await supabase
          .from("students")
          .select("id, full_name, student_code, phone, date_of_birth")
          .in("id", studentIds)
      : { data: [] as StudentRow[], error: null };

    if (studentsResult.error) {
      setError(`Could not load students for attendance: ${studentsResult.error.message}`);
      console.error("[Load sessions] Student roster select failed", studentsResult.error);
      return [];
    }

    const studentRows = (studentsResult.data ?? []) as StudentRow[];
    const studentById = new Map(studentRows.map((student) => [student.id, student]));
    const missingStudentIds = studentIds.filter((studentId) => !studentById.has(studentId));

    console.info("[Load sessions] Loaded summer school session data", {
      lessonCount: lessonRows.length,
      classIds,
      enrollmentCount: enrollmentRows.length,
      studentIdCountFromEnrollments: studentIds.length,
      studentRowsLoaded: studentRows.length,
      missingStudentIds,
      attendanceCount: attendance.data?.length ?? 0,
      noteCount: notes.data?.length ?? 0,
    });

    if (studentIds.length > 0 && studentRows.length === 0) {
      setError("Students are enrolled in this class, but the teacher cannot read the student roster yet. Run the student roster RLS migration.");
    }

    const classById = new Map((classes.data ?? []).map((item: ClassRow) => [item.id, item]));
    const teacherById = new Map((teacherRows.data ?? []).map((item: Teacher) => [item.id, item]));
    const attendanceByLessonStudent = new Map<string, AttendanceRow>();
    for (const row of (attendance.data ?? []) as AttendanceRow[]) {
      attendanceByLessonStudent.set(`${row.lesson_id}:${row.student_id}`, row);
    }

    const notesByLesson = new Map<string, LessonNoteRow>();
    for (const row of (notes.data ?? []) as LessonNoteRow[]) {
      if (!notesByLesson.has(row.lesson_id)) notesByLesson.set(row.lesson_id, row);
    }

    const studentsByClass = new Map<string, SessionStudent[]>();
    for (const row of enrollmentRows) {
      const student = studentById.get(row.student_id);
      if (!student) continue;
      const typedStudent = student as StudentRow;
      const list = studentsByClass.get(row.class_id) ?? [];
      list.push({
        id: typedStudent.id,
        fullName: typedStudent.full_name,
        studentCode: typedStudent.student_code,
        phone: typedStudent.phone,
        birthYear: typedStudent.date_of_birth?.slice(0, 4) ?? null,
        attendanceStatus: null,
      });
      studentsByClass.set(row.class_id, list);
    }

    return lessonRows.map((lesson) => {
      const classRow = classById.get(lesson.class_id);
      const teacherRow = lesson.teacher_id ? teacherById.get(lesson.teacher_id) : null;
      const students = (studentsByClass.get(lesson.class_id) ?? [])
        .map((student) => ({
          ...student,
          attendanceStatus:
            attendanceByLessonStudent.get(`${lesson.id}:${student.id}`)?.status ?? null,
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      return {
        id: lesson.id,
        classId: lesson.class_id,
        teacherId: lesson.teacher_id,
        teacherName: teacherRow?.display_name ?? "Unassigned teacher",
        teacherEmployeeCode: teacherRow?.employee_code ?? null,
        className: classRow?.name ?? "Summer school session",
        location: classRow?.location ?? null,
        lessonDate: lesson.lesson_date,
        startsAt: lesson.starts_at,
        endsAt: lesson.ends_at,
        title: lesson.title,
        status: lesson.status,
        startedAt: lesson.started_at,
        finishedAt: lesson.finished_at,
        students,
        note: notesByLesson.get(lesson.id)?.body ?? "",
      };
    }).filter((item) => item.teacherEmployeeCode?.startsWith("YAZ-"));
  }

  async function refreshCurrentRoleData() {
    if (!profile) return;
    if (isCoordinator) await loadCoordinatorDashboard();
    if (profile.role === "teacher" && session?.user.id) await loadTeacherDashboard(session.user.id);
  }

  async function startSession(item: SummerSession) {
    const blockedReason = getSessionStartBlockedReason(item);
    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    if (!teacher?.id) {
      setError("Teacher record was not loaded, so this session cannot be started yet.");
      console.error("[Start session] Missing teacher record", {
        sessionId: item.id,
        selectedSession: item,
        loadedTeacher: teacher,
      });
      return;
    }

    setActionLoading(true);
    setError(null);

    const startedAt = new Date().toISOString();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const authUserId = authData.user?.id ?? null;
    const queryDebug = buildStartSessionQueryDebug(item, teacher, startedAt, authUserId);

    const { data: matchingLessons, error: matchError } = await supabase
      .from("lessons")
      .select("id, class_id, teacher_id, lesson_date, starts_at, ends_at, status, started_at, finished_at")
      .eq("id", item.id)
      .eq("class_id", item.classId)
      .eq("teacher_id", teacher.id);

    console.group("[Start session] Supabase debug");
    console.info("Exact Supabase query", queryDebug);
    console.info("session.id", item.id);
    console.info("logged-in auth user id", authUserId);
    console.info("loaded public.teachers record", teacher);
    console.info("matching lesson rows before update", matchingLessons ?? []);
    console.info("matching lesson row count before update", matchingLessons?.length ?? 0);
    if (authError) console.error("auth.getUser error", authError);
    if (matchError) console.error("pre-update lesson lookup error", matchError);

    if (authError || matchError) {
      setError((authError ?? matchError)?.message ?? "Could not verify the session before starting it.");
      console.groupEnd();
      setActionLoading(false);
      return;
    }

    if ((matchingLessons?.length ?? 0) !== 1) {
      setError("Session start was not saved because the selected session did not match exactly one lesson row.");
      console.warn("Expected exactly one lesson row before update.", {
        expectedWhere: queryDebug.where,
        returnedRowCount: matchingLessons?.length ?? 0,
      });
      console.groupEnd();
      setActionLoading(false);
      return;
    }

    const { data: updatedLessons, error: updateError } = await supabase
      .from("lessons")
      .update({
        started_at: startedAt,
        status: "scheduled",
      })
      .eq("id", item.id)
      .eq("class_id", item.classId)
      .eq("teacher_id", teacher.id)
      .is("started_at", null)
      .select("id, class_id, teacher_id, status, started_at, finished_at");

    const updatedRowCount = updatedLessons?.length ?? 0;
    console.info("returned row count", updatedRowCount);
    console.info("updated rows", updatedLessons ?? []);
    if (updateError) console.error("full Supabase update error", updateError);
    console.groupEnd();

    if (updateError) {
      setError(updateError.message);
    } else if (updatedRowCount !== 1) {
      setError("Session start was not saved because the update did not match exactly one lesson row.");
    } else {
      const attendanceReady = await ensureAttendanceRecordsForSession(item);
      if (!attendanceReady) {
        await refreshCurrentRoleData();
        setSelectedSessionId(item.id);
        setActionLoading(false);
        return;
      }
      await logActivity("session_started", item, { started_at: startedAt });
    }

    await refreshCurrentRoleData();
    setSelectedSessionId(item.id);
    setActionLoading(false);
  }

  async function ensureAttendanceRecordsForSession(item: SummerSession) {
    const recordedByUserId = profile?.id ?? session?.user.id;
    if (!recordedByUserId) {
      setError("User profile was not loaded, so attendance records could not be created.");
      return false;
    }

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("class_students")
      .select("class_id, student_id")
      .eq("class_id", item.classId)
      .eq("status", "active");

    if (enrollmentError) {
      setError(`Could not load students for attendance: ${enrollmentError.message}`);
      console.error("[Start session] Could not load class students for attendance", enrollmentError);
      return false;
    }

    const studentIds = ((enrollmentRows ?? []) as ClassStudentRow[])
      .map((row) => row.student_id)
      .filter(Boolean);

    console.info("[Start session] Students found for attendance", {
      lessonId: item.id,
      classId: item.classId,
      studentCount: studentIds.length,
      enrollmentRows: enrollmentRows ?? [],
    });

    if (studentIds.length === 0) {
      setError("No students were found for this class, so attendance controls cannot be shown.");
      return false;
    }

    const now = new Date().toISOString();
    const attendanceRows = studentIds.map((studentId) => ({
      lesson_id: item.id,
      class_id: item.classId,
      student_id: studentId,
      status: "absent" as AttendanceStatus,
      recorded_by: recordedByUserId,
      recorded_at: now,
    }));

    const { data: savedAttendance, error: attendanceError } = await supabase
      .from("attendance")
      .upsert(attendanceRows, { onConflict: "lesson_id,student_id" })
      .select("id, lesson_id, class_id, student_id, status");

    if (attendanceError) {
      console.error("[Start session] Could not create attendance records", attendanceError);
      setError(getFriendlySupabaseSaveError(attendanceError, "attendance"));
      return false;
    }

    console.info("[Start session] Attendance records ready", {
      lessonId: item.id,
      insertedOrUpdatedCount: savedAttendance?.length ?? 0,
      savedAttendance: savedAttendance ?? [],
    });

    return true;
  }

  async function finishSession(item: SummerSession) {
    const canFinishForRole = isCoordinator ? canCoordinatorEditSessionRecord(item) : canTeacherEditLiveSession(item);
    if (!canFinishForRole) {
      setError(isCoordinator ? "Only a started session or a past session entry can be finished." : ACTIVE_ATTENDANCE_MESSAGE);
      return;
    }

    if (!hasCompletedAttendance(item)) {
      setError("Attendance must be completed before finishing the session.");
      return;
    }

    if (item.note.trim().length === 0) {
      setError("Lesson note must be saved before finishing the session.");
      return;
    }

    setActionLoading(true);
    setError(null);
    let finishQuery = supabase
      .from("lessons")
      .update({
        finished_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", item.id)
      .is("finished_at", null);

    if (isCoordinator && isPastSession(item)) {
      // Coordinators may complete late-entry records without setting started_at.
    } else {
      finishQuery = finishQuery.not("started_at", "is", null);
    }

    const { error: updateError } = await finishQuery;
    if (updateError) {
      setError(updateError.message);
    } else {
      await logActivity("session_finished", item, { late_entry: isCoordinator && canUseLateEntry(item) });
      if (isCoordinator && canUseLateEntry(item)) {
        await logActivity("late_entry_updated", item, { update_type: "session_finished" });
      }
    }
    await refreshCurrentRoleData();
    setSelectedSessionId(item.id);
    setActionLoading(false);
  }

  async function markAttendance(item: SummerSession, studentId: string, status: AttendanceStatus) {
    if (!profile) return;
    const canMarkForRole = isCoordinator ? canCoordinatorEditSessionRecord(item) : canTeacherEditLiveSession(item);
    if (!canMarkForRole) {
      setError(ATTENDANCE_SAVE_ERROR_MESSAGE);
      return;
    }
    setActionLoading(true);
    setError(null);
    const { error: attendanceError } = await supabase.from("attendance").upsert(
      {
        lesson_id: item.id,
        class_id: item.classId,
        student_id: studentId,
        status,
        recorded_by: profile.id,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id,student_id" },
    );
    if (attendanceError) {
      console.error("[Attendance] Could not save attendance", attendanceError);
      setError(getFriendlySupabaseSaveError(attendanceError, "attendance"));
    } else {
      await logActivity("attendance_updated", item, { student_id: studentId, status });
      if (isCoordinator && canUseLateEntry(item)) {
        await logActivity("late_entry_updated", item, {
          update_type: "attendance_updated",
          student_id: studentId,
          status,
        });
      }
    }
    await refreshCurrentRoleData();
    setSelectedSessionId(item.id);
    setActionLoading(false);
  }

  async function saveLessonNote(item: SummerSession, body: string) {
    if (!profile) return;
    const canSaveForRole = isCoordinator ? canCoordinatorEditSessionRecord(item) : canTeacherEditLiveSession(item);
    if (!canSaveForRole) {
      setError(
        isCoordinator
          ? "Lesson notes can only be saved during a started session or as past session entry."
          : LESSON_NOTE_SAVE_ERROR_MESSAGE,
      );
      return;
    }
    setActionLoading(true);
    setError(null);

    let existingNoteQuery = supabase
      .from("lesson_notes")
      .select("id")
      .eq("lesson_id", item.id);

    if (!isCoordinator) {
      existingNoteQuery = existingNoteQuery.eq("author_id", profile.id);
    }

    const { data: existingNote, error: existingNoteError } = await existingNoteQuery
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingNoteError) {
      console.error("[Lesson note] Could not check existing lesson note", existingNoteError);
      setError(getFriendlySupabaseSaveError(existingNoteError, "lesson_notes"));
      setActionLoading(false);
      return;
    }

    const notePayload = {
      lesson_id: item.id,
      author_id: profile.id,
      title: "Summer school note",
      body,
      is_private: false,
    };

    const { error: noteError } = existingNote?.id
      ? await supabase
          .from("lesson_notes")
          .update({
            title: notePayload.title,
            body: notePayload.body,
            is_private: notePayload.is_private,
          })
          .eq("id", existingNote.id)
      : await supabase.from("lesson_notes").insert(notePayload);

    if (noteError) {
      console.error("[Lesson note] Could not save lesson note", noteError);
      setError(getFriendlySupabaseSaveError(noteError, "lesson_notes"));
    } else {
      await logActivity("lesson_note_saved", item, { note_length: body.trim().length });
      if (isCoordinator && canUseLateEntry(item)) {
        await logActivity("late_entry_updated", item, { update_type: "lesson_note_saved" });
      }
    }
    await refreshCurrentRoleData();
    setSelectedSessionId(item.id);
    setActionLoading(false);
  }

  async function logActivity(
    actionType: ActivityActionType,
    item: SummerSession,
    details: Record<string, unknown> = {},
  ) {
    if (!profile) return;

    const { error: logError } = await supabase.from("activity_logs").insert({
      action_type: actionType,
      lesson_id: item.id,
      teacher_id: item.teacherId,
      actor_user_id: profile.id,
      details: {
        ...details,
        lesson_date: item.lessonDate,
        starts_at: item.startsAt,
        ends_at: item.endsAt,
        room: item.location,
      },
    });

    if (logError) {
      console.error("[Activity log] Could not create activity log entry", logError);
      setError(`Activity was saved, but audit logging failed: ${logError.message}`);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setActionLoading(false);
  }

  async function handleSignOut() {
    setActionLoading(true);
    setError(null);
    await supabase.auth.signOut();
    setActionLoading(false);
  }

  async function handleInstallApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (loading || profileLoading) {
    return (
      <main className="loading-screen">
        <img className="loading-logo" src="/logo.jpg" alt="American Life Language Institute" />
        <span>Loading Campus Portal...</span>
      </main>
    );
  }

  if (!session || !profile) {
    return (
      <main className="auth-page">
        <section className="login-panel">
          <div className="auth-brand">
            <img src="/logo.jpg" alt="American Life Language Institute" />
            <div>
              <p className="eyebrow">Sancaktepe Branch</p>
              <h1>Campus Portal</h1>
              <span>American Life Language Institute</span>
            </div>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={actionLoading}>
              {actionLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="app-brand">
          <img src="/logo.jpg" alt="American Life Language Institute" />
          <div>
            <p className="eyebrow">Sancaktepe Branch</p>
            <h1>American Life Language Institute</h1>
            <p className="user-name">Campus Portal - Signed in as {profile.role} - {profile.full_name}</p>
          </div>
        </div>
        <div className="topbar-actions">
          {installPrompt && (
            <button type="button" className="install-button" onClick={handleInstallApp} aria-label="Install app">
              <span aria-hidden="true">+</span>
              Install
            </button>
          )}
          <button type="button" className="secondary" onClick={handleSignOut} disabled={actionLoading}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {isCoordinator && (
        <CoordinatorDashboard
          stats={stats}
          teachers={teachers}
          sessions={coordinatorSessions}
          activityLogs={activityLogs}
          actionLoading={actionLoading}
          onMarkAttendance={markAttendance}
          onSaveNote={saveLessonNote}
          onFinishSession={finishSession}
          profile={profile}
        />
      )}
      {profile.role === "teacher" && (
        <TeacherDashboard
          teacher={teacher}
          sessions={teacherSessions}
          selectedSession={selectedSession}
          selectedSessionId={selectedSessionId}
          actionLoading={actionLoading}
          onSelectSession={setSelectedSessionId}
          onStartSession={startSession}
          onFinishSession={finishSession}
          onMarkAttendance={markAttendance}
          onSaveNote={saveLessonNote}
        />
      )}
      {!isCoordinator && profile.role !== "teacher" && (
        <section className="panel">
          <h2>No dashboard yet</h2>
          <p>This campus portal module is currently enabled for coordinators, admins, and teachers.</p>
        </section>
      )}
      <footer className="app-footer">
        <strong>American Life Language Institute</strong>
        <span>Sancaktepe Branch</span>
        <span>Campus Portal · v1.1</span>
      </footer>
    </main>
  );
}

function CoordinatorDashboard({
  stats,
  teachers,
  sessions,
  activityLogs,
  actionLoading,
  onMarkAttendance,
  onSaveNote,
  onFinishSession,
  profile,
}: {
  stats: CoordinatorStats | null;
  teachers: Teacher[];
  sessions: SummerSession[];
  activityLogs: ActivityLogRow[];
  actionLoading: boolean;
  onMarkAttendance: (item: SummerSession, studentId: string, status: AttendanceStatus) => void;
  onSaveNote: (item: SummerSession, body: string) => void;
  onFinishSession: (item: SummerSession) => void;
  profile: UserProfile;
}) {
  const [sessionSearch, setSessionSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("today");
  const linkedTeachers = teachers.filter((item) => item.user_id);
  const sessionById = new Map(sessions.map((item) => [item.id, item]));
  const teacherById = new Map(teachers.map((item) => [item.id, item]));
  const today = getTodayDate();
  const todaySessions = sessions
    .filter((item) => item.lessonDate === today)
    .sort((a, b) =>
      `${a.startsAt}-${a.teacherName}-${a.location ?? ""}`.localeCompare(
        `${b.startsAt}-${b.teacherName}-${b.location ?? ""}`,
      ),
    );
  const searchText = sessionSearch.trim().toLowerCase();
  const filteredTodaySessions = todaySessions.filter((item) => {
    if (!searchText) return true;
    return (
      item.teacherName.toLowerCase().includes(searchText) ||
      (item.location ?? "").toLowerCase().includes(searchText)
    );
  });
  const pastEntrySessions = sessions
    .filter(canUseLateEntry)
    .sort((a, b) => {
      const dateCompare = b.lessonDate.localeCompare(a.lessonDate);
      if (dateCompare !== 0) return dateCompare;
      return b.startsAt.localeCompare(a.startsAt);
    });
  const activeSessions = todaySessions.filter((item) => item.startedAt && !item.finishedAt);
  const completedSessions = todaySessions.filter((item) => item.finishedAt);
  const upcomingSessions = todaySessions.filter((item) => !item.startedAt && !item.finishedAt);
  const notesSubmitted = todaySessions.filter((item) => item.note.trim().length > 0).length;
  const alerts = getCoordinatorAlerts(todaySessions);
  const historySessions = getHistorySessions(sessions, historyFilter);
  const firstName = getFirstName(profile.full_name);

  return (
    <section className="dashboard coordinator-dashboard">
      <section className="coordinator-greeting">
        <div>
          <span className="eyebrow">Coordinator Dashboard</span>
          <h2>{getGreeting()}, {firstName}</h2>
          <p>{formatDate(today)} · Summer School Module operations</p>
        </div>
        <div className="coordinator-greeting-meta">
          <strong>{todaySessions.length}</strong>
          <span>sessions today</span>
        </div>
      </section>

      <section className="session-group">
        <div className="section-heading compact">
          <h3>Today's Overview</h3>
          <p>Summer School Module operational snapshot</p>
        </div>
        <div className="stats-grid overview-grid operations-overview-grid">
          <StatCard icon="Cal" label="Sessions Today" value={stats?.todaySessionCount ?? 0} />
          <StatCard icon="Live" label="Active Sessions" value={activeSessions.length} />
          <StatCard icon="Done" label="Completed Sessions" value={completedSessions.length} />
          <StatCard icon="Next" label="Upcoming / Not Started" value={upcomingSessions.length} />
          <StatCard icon="%" label="Attendance Rate" value={getAttendanceRateLabel(todaySessions)} />
          <StatCard icon="Note" label="Lesson Notes Submitted" value={`${notesSubmitted} / ${todaySessions.length}`} />
          <StatCard icon="!" label="Alerts" value={alerts.length} />
        </div>
      </section>

      <section className="session-group">
        <div className="alerts-panel">
          <div>
            <h4>Alerts</h4>
            <p>{alerts.length === 0 ? "No operational alerts right now." : `${alerts.length} items need attention.`}</p>
          </div>
          {alerts.length > 0 && (
            <div className="alert-list">
              {alerts.map((alert) => (
                <article className="alert-item" key={alert.id}>
                  <strong>{alert.label}</strong>
                  <span>{alert.detail}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="session-group live-sessions-section">
        <div className="live-session-toolbar">
          <div className="section-heading compact">
            <h3>Live / Today's Sessions</h3>
            <p>{filteredTodaySessions.length} of {todaySessions.length} sessions shown</p>
          </div>
          <label className="search-field">
            <span>Search by teacher or room</span>
            <input
              type="search"
              value={sessionSearch}
              onChange={(event) => setSessionSearch(event.target.value)}
              placeholder="Teacher or room"
            />
          </label>
        </div>
        {todaySessions.length === 0 ? (
          <div className="panel">
            <p className="muted">No Summer School Module sessions are scheduled for today.</p>
          </div>
        ) : filteredTodaySessions.length === 0 ? (
          <div className="panel">
            <p className="muted">No sessions match this search.</p>
          </div>
        ) : (
          <div className="session-tracker session-card-grid">
            {filteredTodaySessions.map((item) => (
              <CoordinatorSessionRow
                actionLoading={actionLoading}
                item={item}
                key={item.id}
                onFinishSession={onFinishSession}
                onMarkAttendance={onMarkAttendance}
                onSaveNote={onSaveNote}
                activityLogs={activityLogs}
              />
            ))}
          </div>
        )}
      </section>

      <section className="session-group">
        <div className="live-session-toolbar">
          <div className="section-heading compact">
            <h3>Session History</h3>
            <p>{historySessions.length} sessions in view</p>
          </div>
          <div className="history-filter" aria-label="Session history filters">
            {([
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["week", "This Week"],
              ["all", "All Summer School"],
            ] as const).map(([value, label]) => (
              <button
                className={historyFilter === value ? "chip selected" : "chip"}
                key={value}
                type="button"
                onClick={() => setHistoryFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {historySessions.length === 0 ? (
          <div className="panel">
            <p className="muted">No sessions found for this history filter.</p>
          </div>
        ) : (
          <div className="session-tracker session-card-grid session-history-grid">
            {historySessions.map((item) => (
              <CoordinatorSessionRow
                actionLoading={actionLoading}
                item={item}
                key={item.id}
                onFinishSession={onFinishSession}
                onMarkAttendance={onMarkAttendance}
                onSaveNote={onSaveNote}
                activityLogs={activityLogs}
                compact
              />
            ))}
          </div>
        )}
      </section>

      {pastEntrySessions.length > 0 && (
        <div className="panel late-entry-panel">
          <strong>Late entry queue</strong>
          <span>{pastEntrySessions.length} unfinished past sessions are available inside Session History after enabling editing.</span>
        </div>
      )}

      <ActivityFeed logs={activityLogs} sessionById={sessionById} teacherById={teacherById} />

      <details className="panel management-panel administration-panel">
        <summary>
          <div>
            <h3>Administration</h3>
            <p>Teacher login linking and account status</p>
          </div>
          <div className="admin-summary">
            <span>Linked {linkedTeachers.length} / {teachers.length}</span>
            <span>{teachers.length} teachers</span>
            <span>{stats?.studentCount ?? 0} students</span>
          </div>
        </summary>
        <div className="administration-body">
          <div>
            <h4>Teacher Login Linking</h4>
            <p>
              Teachers without a linked Auth account cannot log in yet. Create each teacher in Supabase
              Authentication, then run the linking SQL in <strong>sql/link_teacher_auth_users.sql</strong>.
            </p>
          </div>
          <div className="teacher-grid">
            <span className="status-pill success">Linked logins: {linkedTeachers.length} / {teachers.length}</span>
            <span className="status-pill success">Total students: {stats?.studentCount ?? 0}</span>
            <span className="status-pill warning">
              Attendance pending: {stats?.attendancePendingCount ?? 0}
            </span>
            {teachers.map((item) => (
              <span className={item.user_id ? "status-pill success" : "status-pill warning"} key={item.id}>
                {item.display_name}: {item.user_id ? "linked" : "missing login"}
              </span>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function CoordinatorSessionRow({
  item,
  actionLoading,
  onMarkAttendance,
  onSaveNote,
  onFinishSession,
  activityLogs,
  compact = false,
}: {
  item: SummerSession;
  actionLoading: boolean;
  onMarkAttendance: (item: SummerSession, studentId: string, status: AttendanceStatus) => void;
  onSaveNote: (item: SummerSession, body: string) => void;
  onFinishSession: (item: SummerSession) => void;
  activityLogs: ActivityLogRow[];
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.note);
  const lifecycle = getLifecycleStatus(item);
  const attendanceDone = hasCompletedAttendance(item);
  const noteDone = item.note.trim().length > 0;
  const counts = getAttendanceCounts(item);
  const presentStudents = item.students.filter((student) => student.attendanceStatus === "present");
  const lateStudents = item.students.filter((student) => student.attendanceStatus === "late");
  const absentStudents = item.students.filter((student) => student.attendanceStatus === "absent");
  const editable = canCoordinatorEditSessionRecord(item);
  const lateEntry = canUseLateEntry(item);
  const canFinish = editable && attendanceDone && noteDone;
  const lessonActivity = activityLogs.filter((log) => log.lesson_id === item.id);

  useEffect(() => {
    setNoteDraft(item.note);
  }, [item.id, item.note]);

  useEffect(() => {
    setEditingEnabled(false);
  }, [item.id]);

  const enableEditing = () => {
    if (window.confirm("You are about to modify teacher records. Continue?")) {
      setEditingEnabled(true);
    }
  };

  return (
    <article className={compact ? "session-tracker-row compact-session-row" : "session-tracker-row"}>
      <div className="session-tracker-main">
        <div className="session-teacher teacher-identity">
          <span className="teacher-avatar" aria-hidden="true">
            {getInitials(item.teacherName)}
          </span>
          <div>
            <span className="eyebrow">Teacher</span>
            <strong>{item.teacherName}</strong>
          </div>
        </div>
        <div className="session-info-block">
          <span className="session-info-icon" aria-hidden="true">Time</span>
          <span className="eyebrow">Time</span>
          <strong>{formatTime(item.startsAt)}-{formatTime(item.endsAt)}</strong>
        </div>
        <div className="session-info-block">
          <span className="session-info-icon" aria-hidden="true">Room</span>
          <span className="eyebrow">Room</span>
          <strong>{item.location ?? "Room not set"}</strong>
        </div>
        <div className="status-badges">
          <span className={`status-badge ${lifecycle.kind}`}>{lifecycle.label}</span>
          <span className={`status-badge ${attendanceDone ? "success" : "warning"}`}>
            Attendance {attendanceDone ? "Completed" : "Pending"}
          </span>
          <span className={`status-badge ${noteDone ? "success" : "warning"}`}>
            Note {noteDone ? "Completed" : "Pending"}
          </span>
          {lateEntry && <span className="status-badge warning">Late entry</span>}
        </div>
        <div className="session-summary-grid">
          <span><strong>{counts.marked}/{item.students.length}</strong> marked</span>
          <span><strong>{counts.present}</strong> present</span>
          <span><strong>{counts.absent}</strong> absent</span>
          <span>Started: <strong>{formatTimestamp(item.startedAt)}</strong></span>
          <span>Finished: <strong>{formatTimestamp(item.finishedAt)}</strong></span>
        </div>
        <div className="session-card-actions">
          <button className="secondary" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "^ Hide details" : "v View details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="session-details-grid">
          <section>
            <h4>Lesson note</h4>
            {noteDone ? <p>{item.note}</p> : <p className="muted">No lesson note saved yet.</p>}
            {editable && !editingEnabled && (
              <button className="secondary enable-editing-button" type="button" onClick={enableEditing}>
                Enable Editing
              </button>
            )}
            {editable && editingEnabled && (
              <form
                className="note-form compact-note"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSaveNote(item, noteDraft);
                }}
              >
                <label>
                  {lateEntry ? "Past session entry note" : "Lesson note"}
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    readOnly={Boolean(item.finishedAt)}
                  />
                </label>
                <button type="submit" disabled={actionLoading || noteDraft.trim().length === 0 || Boolean(item.finishedAt)}>
                  Save note
                </button>
              </form>
            )}
          </section>

          <section>
            <h4>Attendance summary</h4>
            <p>
              {counts.present} present / {counts.late} late / {counts.absent} absent /{" "}
              {counts.pending} pending / {item.students.length} total
            </p>
            <div className="roster-columns">
              <RosterList title="Present students" students={presentStudents} emptyText="No present students marked." />
              <RosterList title="Late students" students={lateStudents} emptyText="No late students marked." />
              <RosterList title="Absent students" students={absentStudents} emptyText="No absent students." />
            </div>
          </section>

          <section>
            <h4>Session times</h4>
            <p>Date: {formatDate(item.lessonDate)}</p>
            <p>Scheduled: {formatTime(item.startsAt)}-{formatTime(item.endsAt)}</p>
            <p>Started: {formatTimestamp(item.startedAt)}</p>
            <p>Finished: {formatTimestamp(item.finishedAt)}</p>
            <h4>Activity timeline</h4>
            {lessonActivity.length === 0 ? (
              <p className="muted">No activity recorded for this lesson yet.</p>
            ) : (
              <div className="timeline-list">
                {lessonActivity.map((log) => (
                  <article className="timeline-item" key={log.id}>
                    <span>{getActivityIcon(log.action_type)}</span>
                    <div>
                      <strong>{getActivityLabel(log.action_type)}</strong>
                      <p>{formatTimestamp(log.created_at)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {editable && editingEnabled && (
              <button
                type="button"
                disabled={actionLoading || !canFinish}
                onClick={() => onFinishSession(item)}
              >
                Finish session
              </button>
            )}
          </section>

          {editable && editingEnabled && (
            <section className="session-detail-wide">
              <h4>{lateEntry ? "Past session attendance entry" : "Attendance"}</h4>
              {item.students.length === 0 ? (
                <p className="muted">No students were found for this session.</p>
              ) : (
                <div className="student-list">
                  {item.students.map((student) => (
                    <article className="student-row" key={student.id}>
                      <div>
                        <h3>{student.fullName}</h3>
                        <p>{student.birthYear ? `Birth year ${student.birthYear}` : "Birth year missing"}</p>
                      </div>
                      <div className="attendance-actions">
                        {(["present", "late", "absent"] as AttendanceStatus[]).map((status) => (
                          <button
                            className={student.attendanceStatus === status ? "chip selected" : "chip"}
                            disabled={actionLoading || Boolean(item.finishedAt)}
                            key={status}
                            type="button"
                            onClick={() => onMarkAttendance(item, student.id, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </article>
  );
}

function RosterList({
  title,
  students,
  emptyText,
}: {
  title: string;
  students: SessionStudent[];
  emptyText: string;
}) {
  return (
    <div className="roster-column">
      <h5>{title}</h5>
      {students.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="compact-list">
          {students.map((student) => (
            <li key={student.id}>{student.fullName}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityFeed({
  logs,
  sessionById,
  teacherById,
}: {
  logs: ActivityLogRow[];
  sessionById: Map<string, SummerSession>;
  teacherById: Map<string, Teacher>;
}) {
  return (
    <section className="session-group">
      <div className="section-heading compact">
        <h3>Activity Feed</h3>
        <p>Latest session actions</p>
      </div>
      {logs.length === 0 ? (
        <div className="panel">
          <p className="muted">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="activity-feed">
          {logs.map((log) => {
            const sessionItem = log.lesson_id ? sessionById.get(log.lesson_id) : null;
            const teacherName =
              sessionItem?.teacherName ??
              (log.teacher_id ? teacherById.get(log.teacher_id)?.display_name : null) ??
              "Unknown teacher";
            const sessionLabel = sessionItem
              ? `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)} · ${
                  sessionItem.location ?? "Room not set"
                }`
              : "Session details unavailable";

            return (
              <article className="activity-feed-row" key={log.id}>
                <span className="activity-icon" aria-hidden="true">{getActivityIcon(log.action_type)}</span>
                <div>
                  <strong>{teacherName}</strong>
                  <span>{getActivityLabel(log.action_type)}</span>
                </div>
                <span>{formatTimestamp(log.created_at)}</span>
                <span>{sessionLabel}</span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeacherDashboard({
  teacher,
  sessions,
  selectedSession,
  selectedSessionId,
  actionLoading,
  onSelectSession,
  onStartSession,
  onFinishSession,
  onMarkAttendance,
  onSaveNote,
}: {
  teacher: Teacher | null;
  sessions: SummerSession[];
  selectedSession: SummerSession | null;
  selectedSessionId: string | null;
  actionLoading: boolean;
  onSelectSession: (lessonId: string) => void;
  onStartSession: (item: SummerSession) => void;
  onFinishSession: (item: SummerSession) => void;
  onMarkAttendance: (item: SummerSession, studentId: string, status: AttendanceStatus) => void;
  onSaveNote: (item: SummerSession, body: string) => void;
}) {
  const [noteDraft, setNoteDraft] = useState("");
  const sessionHasStarted = Boolean(selectedSession?.startedAt);
  const sessionHasFinished = Boolean(selectedSession?.finishedAt);
  const canEditSessionWork = selectedSession ? canTeacherEditLiveSession(selectedSession) : false;
  const attendanceCompleted = selectedSession ? hasCompletedAttendance(selectedSession) : false;
  const noteSaved = Boolean(selectedSession?.note.trim());
  const canFinishSession = canEditSessionWork && attendanceCompleted && noteSaved;

  useEffect(() => {
    setNoteDraft(selectedSession?.note ?? "");
  }, [selectedSession?.id, selectedSession?.note]);

  if (!teacher) {
    return (
      <section className="panel">
        <h2>Teacher Login Not Linked</h2>
        <p>Ask the coordinator to connect your Supabase Auth user to your imported teacher record.</p>
      </section>
    );
  }

  return (
    <section className="dashboard teacher-layout">
      <aside className="session-sidebar">
        <div className="section-heading compact">
          <h2>{teacher.display_name}</h2>
          <p>Teacher Dashboard · Summer School Module</p>
        </div>
        <div className="session-tabs">
          {sessions.length === 0 ? (
            <p className="muted">No imported sessions found for this teacher.</p>
          ) : (
            sessions.map((item) => (
              <button
                className={item.id === selectedSessionId ? "session-tab active" : "session-tab"}
                key={item.id}
                type="button"
                onClick={() => onSelectSession(item.id)}
              >
                <span>{formatTime(item.startsAt)}-{formatTime(item.endsAt)}</span>
                <strong>{item.location ?? "Room not set"}</strong>
              </button>
            ))
          )}
        </div>
      </aside>

      {selectedSession && (
        <section className="panel session-detail">
          <div className="session-header">
            <div>
              <p className="eyebrow">{formatDate(selectedSession.lessonDate)}</p>
              <h2>{selectedSession.title}</h2>
              <p>
                {formatTime(selectedSession.startsAt)}-{formatTime(selectedSession.endsAt)} ·{" "}
                {selectedSession.location ?? "Room not set"}
              </p>
              <SessionStatusBadges item={selectedSession} />
            </div>
            <div className="action-row">
              {!sessionHasStarted && !sessionHasFinished && (
                <button
                  type="button"
                  className="secondary"
                  disabled={actionLoading}
                  onClick={() => onStartSession(selectedSession)}
                >
                  Start session
                </button>
              )}
              <button
                type="button"
                disabled={actionLoading || !canFinishSession}
                onClick={() => onFinishSession(selectedSession)}
              >
                {sessionHasFinished ? "Session finished" : "Finish session"}
              </button>
            </div>
          </div>

          {!sessionHasStarted ? (
            <div className="locked-panel">Start the session to unlock attendance controls.</div>
          ) : !canEditSessionWork ? (
            <div className="locked-panel">{ATTENDANCE_SAVE_ERROR_MESSAGE}</div>
          ) : selectedSession.students.length === 0 ? (
            <div className="locked-panel">
              No students were found for this session. Check the class enrollment import or RLS access to
              class_students/students.
            </div>
          ) : (
            <div className="student-list">
              {selectedSession.students.map((student) => (
                <article className="student-row" key={student.id}>
                  <div>
                    <h3>{student.fullName}</h3>
                    <p>
                      {student.birthYear ? `Birth year ${student.birthYear}` : "Birth year missing"}
                      {student.phone ? ` · ${student.phone}` : ""}
                    </p>
                  </div>
                  <div className="attendance-actions">
                    {(["present", "late", "absent"] as AttendanceStatus[]).map((status) => (
                      <button
                        className={student.attendanceStatus === status ? "chip selected" : "chip"}
                        disabled={actionLoading || !canEditSessionWork}
                        key={status}
                        type="button"
                        onClick={() => onMarkAttendance(selectedSession, student.id, status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {canEditSessionWork && !canFinishSession && (
            <div className="locked-panel">
              Finish unlocks after attendance is completed and a lesson note is saved.
            </div>
          )}

          <form
            className="note-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveNote(selectedSession, noteDraft);
            }}
          >
            <label>
              Lesson note
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="What did this group work on today?"
                rows={5}
                readOnly={sessionHasFinished}
              />
            </label>
            <button
              type="submit"
              disabled={actionLoading || !canEditSessionWork || noteDraft.trim().length === 0}
            >
              Save note
            </button>
          </form>
        </section>
      )}
    </section>
  );
}

function SessionSummaryCard({ item }: { item: SummerSession }) {
  return (
    <article className="class-card">
      <div>
        <h3>{item.teacherName}</h3>
        <p>
          {item.location ?? "Room not set"} · {formatDate(item.lessonDate)}
        </p>
      </div>
      <div className="class-meta status-meta">
        <span>{formatTime(item.startsAt)}-{formatTime(item.endsAt)}</span>
        <SessionStatusBadges item={item} />
        <span>{item.students.length} students</span>
      </div>
    </article>
  );
}

function SessionStatusBadges({ item }: { item: SummerSession }) {
  const lifecycle = getLifecycleStatus(item);
  const attendanceDone = hasCompletedAttendance(item);
  const noteDone = item.note.trim().length > 0;

  return (
    <span className="status-badges">
      <span className={`status-badge ${lifecycle.kind}`}>{lifecycle.label}</span>
      <span className={`status-badge ${attendanceDone ? "success" : "warning"}`}>
        Attendance {attendanceDone ? "completed" : "pending"}
      </span>
      <span className={`status-badge ${noteDone ? "success" : "warning"}`}>
        Note {noteDone ? "completed" : "pending"}
      </span>
    </span>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
  return (
    <article className="stat-card">
      <span className="stat-card-label">
        {icon && <span className="stat-icon" aria-hidden="true">{icon}</span>}
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}

function getFirstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "Coordinator";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

function getFriendlySupabaseSaveError(error: unknown, table: "attendance" | "lesson_notes") {
  if (isSupabasePermissionError(error)) {
    return table === "attendance" ? ATTENDANCE_SAVE_ERROR_MESSAGE : LESSON_NOTE_SAVE_ERROR_MESSAGE;
  }

  return UNEXPECTED_SAVE_ERROR_MESSAGE;
}

function isSupabasePermissionError(error: unknown) {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string };
  const text = [maybeError.code, maybeError.message, maybeError.details, maybeError.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("row-level security") ||
    text.includes("violates row-level security policy") ||
    text.includes("permission denied") ||
    text.includes("insufficient privilege") ||
    maybeError.code === "42501"
  );
}

function hasCompletedAttendance(item: SummerSession) {
  return item.students.length > 0 && item.students.every((student) => student.attendanceStatus);
}

function getAttendanceCounts(item: SummerSession) {
  const present = item.students.filter((student) => student.attendanceStatus === "present").length;
  const late = item.students.filter((student) => student.attendanceStatus === "late").length;
  const absent = item.students.filter((student) => student.attendanceStatus === "absent").length;
  const pending = item.students.filter((student) => !student.attendanceStatus).length;

  return {
    present,
    late,
    absent,
    pending,
    marked: item.students.length - pending,
  };
}

function getAttendanceRateLabel(sessions: SummerSession[]) {
  const totals = sessions.reduce(
    (summary, item) => {
      const counts = getAttendanceCounts(item);
      return {
        marked: summary.marked + counts.marked,
        total: summary.total + item.students.length,
      };
    },
    { marked: 0, total: 0 },
  );

  if (totals.total === 0) return "0%";
  return `${Math.round((totals.marked / totals.total) * 100)}%`;
}

function getCoordinatorAlerts(todaySessions: SummerSession[]) {
  const nowMinutes = getCurrentLocalMinutes();

  return todaySessions.flatMap((item) => {
    const alerts: { id: string; label: string; detail: string }[] = [];
    const sessionLabel = `${item.teacherName} - ${formatTime(item.startsAt)}-${formatTime(item.endsAt)} - ${
      item.location ?? "Room not set"
    }`;

    if (item.startedAt && !hasCompletedAttendance(item)) {
      alerts.push({
        id: `${item.id}-attendance`,
        label: "Started session missing attendance",
        detail: sessionLabel,
      });
    }

    if (item.startedAt && item.note.trim().length === 0) {
      alerts.push({
        id: `${item.id}-note`,
        label: "Started session missing lesson note",
        detail: sessionLabel,
      });
    }

    if (item.startedAt && !item.finishedAt) {
      alerts.push({
        id: `${item.id}-unfinished`,
        label: "Unfinished active session",
        detail: sessionLabel,
      });
    }

    if (!item.startedAt && !item.finishedAt && nowMinutes > timeToMinutes(item.startsAt)) {
      alerts.push({
        id: `${item.id}-late-start`,
        label: "Session not started after scheduled start",
        detail: sessionLabel,
      });
    }

    return alerts;
  });
}

function getHistorySessions(sessions: SummerSession[], filter: HistoryFilter) {
  const today = getTodayDate();
  const yesterday = getDateOffset(today, -1);
  const weekStart = getWeekStartDate(today);
  const filtered = sessions.filter((item) => {
    if (filter === "today") return item.lessonDate === today;
    if (filter === "yesterday") return item.lessonDate === yesterday;
    if (filter === "week") return item.lessonDate >= weekStart && item.lessonDate <= today;
    return true;
  });

  return filtered.sort((a, b) => {
    const dateCompare = b.lessonDate.localeCompare(a.lessonDate);
    if (dateCompare !== 0) return dateCompare;
    return `${a.startsAt}-${a.teacherName}`.localeCompare(`${b.startsAt}-${b.teacherName}`);
  });
}

function getDateOffset(dateValue: string, offsetDays: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getWeekStartDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function getActiveSessions(sessions: SummerSession[]) {
  return sessions.filter((item) => item.startedAt && !item.finishedAt);
}

function getLifecycleStatus(item: SummerSession) {
  if (item.finishedAt) {
    return { label: "Finished", kind: "finished" };
  }

  if (item.startedAt) {
    return { label: "Started", kind: "started" };
  }

  return { label: "Not started", kind: "not-started" };
}

function groupSessionsByTime(sessions: SummerSession[]) {
  const groups = new Map<string, SummerSession[]>();
  for (const item of sessions) {
    const key = `${formatTime(item.startsAt)}-${formatTime(item.endsAt)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return new Map(
    Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function getSessionStartBlockedReason(item: SummerSession) {
  if (item.lessonDate !== getTodayDate()) return SESSION_OUTSIDE_SCHEDULE_MESSAGE;

  if (!isNowInsideSessionWindow(item)) {
    return SESSION_OUTSIDE_SCHEDULE_MESSAGE;
  }

  return null;
}

function canCoordinatorEditSessionRecord(item: SummerSession) {
  return !item.finishedAt && (Boolean(item.startedAt) || canUseLateEntry(item));
}

function canTeacherEditLiveSession(item: SummerSession) {
  return (
    Boolean(item.startedAt) &&
    !item.finishedAt &&
    item.lessonDate === getTodayDate() &&
    isNowInsideSessionWindow(item)
  );
}

function canUseLateEntry(item: SummerSession) {
  return !item.finishedAt && isPastSession(item);
}

function isPastSession(item: SummerSession) {
  const today = getTodayDate();
  if (item.lessonDate < today) return true;
  if (item.lessonDate > today) return false;
  return getCurrentLocalMinutes() > timeToMinutes(item.endsAt);
}

function isNowInsideSessionWindow(item: SummerSession) {
  const nowMinutes = getCurrentLocalMinutes();
  return nowMinutes >= timeToMinutes(item.startsAt) && nowMinutes <= timeToMinutes(item.endsAt);
}

function getCurrentLocalMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function buildStartSessionQueryDebug(
  item: SummerSession,
  teacherRecord: Teacher,
  startedAt: string,
  authUserId: string | null,
) {
  const where = {
    "lessons.id": item.id,
    "lessons.class_id": item.classId,
    "lessons.teacher_id": teacherRecord.id,
    "lessons.started_at": "is null",
  };

  return {
    table: "public.lessons",
    operation: "UPDATE",
    set: {
      started_at: startedAt,
      status: "scheduled",
    },
    where,
    schemaMatch: {
      "lessons.id": "public.lessons.id primary key",
      "lessons.class_id": "public.lessons.class_id -> public.classes.id",
      "lessons.teacher_id": "public.lessons.teacher_id -> public.teachers.id",
      "teachers.user_id": "public.teachers.user_id -> public.users.id/auth.uid()",
      authUserId,
    },
    postgrestEquivalent:
      "/rest/v1/lessons" +
      `?id=eq.${item.id}` +
      `&class_id=eq.${item.classId}` +
      `&teacher_id=eq.${teacherRecord.id}` +
      "&started_at=is.null" +
      "&select=id,class_id,teacher_id,status,started_at,finished_at",
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getTodayDate() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getActivityLabel(actionType: ActivityActionType) {
  switch (actionType) {
    case "session_started":
      return "Started session";
    case "attendance_updated":
      return "Updated attendance";
    case "lesson_note_saved":
      return "Saved lesson note";
    case "session_finished":
      return "Finished session";
    case "late_entry_updated":
      return "Updated late entry";
    default:
      return actionType;
  }
}

function getActivityIcon(actionType: ActivityActionType) {
  switch (actionType) {
    case "session_started":
      return "Start";
    case "attendance_updated":
      return "Att";
    case "lesson_note_saved":
      return "Note";
    case "session_finished":
      return "Done";
    case "late_entry_updated":
      return "Late";
    default:
      return "Log";
  }
}

export default App;
