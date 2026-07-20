import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { validatePasswordChangeInput } from "./lib/passwordValidation";
import type { PasswordChangeInput } from "./lib/passwordValidation";
import { getDateOffset, isSummerSchoolActiveDate } from "./lib/summerSchoolCalendar";

type UserRole = "admin" | "staff" | "teacher" | "student";
type AttendanceStatus = "present" | "late" | "absent" | "excused";
type ParentNotificationType = "late" | "absent";
type LessonStatus = "scheduled" | "completed" | "cancelled";
type ActivityActionType =
  | "session_started"
  | "attendance_updated"
  | "lesson_note_saved"
  | "session_finished"
  | "late_entry_updated";
type AdminTab =
  | "dashboard"
  | "session-history"
  | "user-management"
  | "teacher-linking"
  | "reports"
  | "student-records"
  | "retroactive-attendance"
  | "teachers"
  | "rooms"
  | "sessions-classes";

type AdministrationNavItem = {
  id: AdminTab;
  label: string;
};

type AdministrationNavGroup = {
  label: string;
  items: AdministrationNavItem[];
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ACTIVE_ATTENDANCE_MESSAGE = "Attendance can only be updated during an active scheduled session.";
const ATTENDANCE_SAVE_ERROR_MESSAGE = "Attendance can only be updated during your active scheduled lesson.";
const LESSON_NOTE_SAVE_ERROR_MESSAGE = "Lesson notes can only be updated during your active scheduled lesson.";
const RETRO_ATTENDANCE_SAVE_ERROR_MESSAGE =
  "Retroactive attendance could not be saved. Please check coordinator permissions and try again.";
const UNEXPECTED_SAVE_ERROR_MESSAGE =
  "An unexpected error occurred while saving. Please try again or contact the coordinator.";
const GLOBAL_STUDENT_SEARCH_LIMIT = 10;
const SUMMER_SCHOOL_START_DATE = "2026-07-06";
const SUMMER_SCHOOL_END_DATE = "2026-08-12";

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

type ManagedUser = UserProfile & {
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
  last_active_at: string | null;
};

type ManagedUserCreateInput = {
  fullName: string;
  email: string;
  role: UserRole;
  temporaryPassword: string;
  isActive: boolean;
};

type ManagedUserUpdateInput = {
  role?: UserRole;
  isActive?: boolean;
};

type PasswordChangeResult = {
  message: string;
  sessionRetained: boolean;
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
  guardian_phone: string | null;
  date_of_birth: string | null;
};

type AttendanceRow = {
  id: string;
  lesson_id: string;
  class_id: string;
  student_id: string;
  status: AttendanceStatus;
  notes: string | null;
  arrived_at: string | null;
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
  guardianPhone: string | null;
  birthYear: string | null;
  attendanceId: string | null;
  attendanceStatus: AttendanceStatus | null;
  attendanceNotes: string | null;
  attendanceArrivedAt: string | null;
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

type ActivityFeedItem =
  | {
      kind: "single";
      id: string;
      log: ActivityLogRow;
    }
  | {
      kind: "group";
      id: string;
      actionType: ActivityActionType;
      logs: ActivityLogRow[];
      expanded: boolean;
    };

type RoomRecord = {
  key: string;
  roomName: string;
  sessionCount: number;
  teacherNames: string[];
  timeLabels: string[];
};

type StudentLessonHistoryItem = {
  lessonId: string;
  lessonDate: string;
  className: string;
  timeLabel: string;
  teacherName: string;
  room: string | null;
  attendanceStatus: AttendanceStatus | null;
  lateMinutes: number | null;
  note: string;
};

type StudentEnrollmentRecord = {
  key: string;
  classId: string;
  className: string;
  teacherName: string;
  room: string | null;
  sessionTimes: string[];
  history: StudentLessonHistoryItem[];
  summary: AttendanceSummary;
};

type StudentRecord = {
  id: string;
  fullName: string;
  studentCode: string | null;
  enrollments: StudentEnrollmentRecord[];
  overallSummary: AttendanceSummary;
};

type GlobalStudentSearchResult = {
  key: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  sessionContext: string;
  teacherName: string;
  room: string | null;
  matchedByCode: boolean;
};

type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  recorded: number;
  lateMinutes: number;
};

type AttentionReason = {
  kind: "absence-streak" | "late-minutes" | "late-count";
  label: string;
};

type AttentionNeededItem = {
  id: string;
  studentId: string;
  studentName: string;
  sessionContext: string;
  roomLabel: string;
  teacherName: string;
  primaryReason: AttentionReason;
  secondaryReasons: AttentionReason[];
  consecutiveAbsences: number;
  totalLateMinutes: number;
  lateCount: number;
};

type DailyReportSessionRow = {
  lessonId: string;
  timeLabel: string;
  teacherName: string;
  className: string;
  roomContext: string;
  expected: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  completed: boolean;
};

type DailyReportTeacherRow = {
  teacherId: string;
  teacherName: string;
  scheduledSessions: number;
  attendanceCompleted: number;
  attendanceMissing: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

type DailyReportAttendanceRecord = {
  key: string;
  lessonId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  lessonDate: string;
  status: AttendanceStatus;
  lateMinutes: number | null;
  sessionContext: string;
  teacherName: string;
  roomContext: string;
};

type DailyAttendanceReport = {
  date: string;
  totalScheduledSessions: number;
  sessionsWithAttendanceRecorded: number;
  sessionsWithNoAttendanceRecorded: number;
  totalStudentsExpected: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRecords: DailyReportAttendanceRecord[];
  sessionRows: DailyReportSessionRow[];
  teacherRows: DailyReportTeacherRow[];
};

type ReportDrillDownSelection = {
  status: AttendanceStatus;
  lessonId?: string;
  teacherId?: string;
};

type RetroAttendanceDraft = {
  status: AttendanceStatus | "";
  notes: string;
};

const SESSION_OUTSIDE_SCHEDULE_MESSAGE = "This session cannot be started outside its scheduled time.";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [teacherSessions, setTeacherSessions] = useState<SummerSession[]>([]);
  const [teacherProfileSessions, setTeacherProfileSessions] = useState<SummerSession[]>([]);
  const [coordinatorSessions, setCoordinatorSessions] = useState<SummerSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<CoordinatorStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [userManagementMessage, setUserManagementMessage] = useState<string | null>(null);
  const [teacherLinkingMessage, setTeacherLinkingMessage] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const lastActivityWriteRef = useRef(0);

  const isCoordinator = useMemo(
    () => Boolean(profile?.is_active && isCoordinatorProfile(profile)),
    [profile],
  );
  const isAdmin = useMemo(() => isAdminProfile(profile), [profile]);

  const selectedSession = teacherSessions.find((item: SummerSession) => item.id === selectedSessionId) ?? null;
  const studentProfileSessions = isCoordinator
    ? coordinatorSessions
    : profile?.role === "teacher"
      ? teacherProfileSessions
      : [];
  const selectedStudentProfile = selectedProfileStudentId
    ? getStudentRecords(studentProfileSessions).find((item) => item.id === selectedProfileStudentId) ?? null
    : null;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_IN" && nextSession?.user.id) {
        void recordOwnLogin();
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      lastActivityWriteRef.current = 0;
      return;
    }

    void recordOwnActivity();

    const recordIfVisible = () => {
      if (document.visibilityState === "visible") {
        void recordOwnActivity();
      }
    };

    const intervalId = window.setInterval(recordIfVisible, 60_000);
    document.addEventListener("visibilitychange", recordIfVisible);
    window.addEventListener("focus", recordIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", recordIfVisible);
      window.removeEventListener("focus", recordIfVisible);
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      setTeacher(null);
      setTeacherSessions([]);
      setTeacherProfileSessions([]);
      setCoordinatorSessions([]);
      setTeachers([]);
      setStats(null);
      setActivityLogs([]);
      setManagedUsers([]);
      setUserManagementMessage(null);
      setTeacherLinkingMessage(null);
      setSelectedProfileStudentId(null);
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
    if (!selectedProfileStudentId) return;
    const canStillSeeStudent = studentProfileSessions.some((item) =>
      item.students.some((student) => student.id === selectedProfileStudentId),
    );
    if (!canStillSeeStudent) setSelectedProfileStudentId(null);
  }, [selectedProfileStudentId, studentProfileSessions]);

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

  async function recordOwnLogin() {
    const { error: loginError } = await supabase.rpc("record_own_login");
    if (loginError) {
      console.error("[User activity] Could not record login timestamp", loginError);
    }

    await recordOwnActivity({ force: true });
  }

  async function recordOwnActivity(options: { force?: boolean } = {}) {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const now = Date.now();
    if (!options.force && now - lastActivityWriteRef.current < 60_000) return;

    lastActivityWriteRef.current = now;
    const { error: activityError } = await supabase.rpc("record_own_activity");
    if (activityError) {
      console.error("[User activity] Could not record activity timestamp", activityError);
    }
  }

  async function loadSignedInUser(userId: string) {
    setProfileLoading(true);
    setError(null);

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active")
      .eq("id", userId)
      .single();

    if (profileError) {
      setError("This login is not linked to an app profile yet.");
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    if (!userProfile.is_active) {
      await supabase.auth.signOut();
      setError("This account is inactive. Please contact an administrator.");
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfile(userProfile);

    if (isCoordinatorProfile(userProfile)) {
      await loadCoordinatorDashboard();
    }

    if (isAdminProfile(userProfile)) {
      await loadManagedUsers();
    } else {
      setManagedUsers([]);
      setUserManagementMessage(null);
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

    const [teacherCount, studentCount, teacherRows, userRows, activityRows] = await Promise.all([
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
        .from("users")
        .select("id, email, full_name, role, is_active, created_at, updated_at, last_login_at, last_active_at")
        .order("full_name", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("id, action_type, lesson_id, teacher_id, actor_user_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const dashboardError = teacherCount.error || studentCount.error || teacherRows.error || userRows.error || activityRows.error;
    if (dashboardError) {
      setError(dashboardError.message);
      return;
    }

    setTeachers(teacherRows.data ?? []);
    setManagedUsers((userRows.data ?? []) as ManagedUser[]);
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
      setTeacherProfileSessions([]);
      setError("Your teacher login is not linked yet. Ask an admin to link your teacher account in Administration.");
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

    const teacherSessionCards = getTeacherSessionCards(sessions);

    setTeacher(linkedTeacher);
    setTeacherProfileSessions(sessions);
    setTeacherSessions(teacherSessionCards);

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
      getNextTeacherSelectedSessionId(currentId, sessions, teacherSessionCards),
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
      supabase
        .from("attendance")
        .select("id, lesson_id, class_id, student_id, status, notes, arrived_at")
        .in("lesson_id", lessonIds),
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
          .select("id, full_name, student_code, phone, guardian_phone, date_of_birth")
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
        guardianPhone: typedStudent.guardian_phone,
        birthYear: typedStudent.date_of_birth?.slice(0, 4) ?? null,
        attendanceId: null,
        attendanceStatus: null,
        attendanceNotes: null,
        attendanceArrivedAt: null,
      });
      studentsByClass.set(row.class_id, list);
    }

    return lessonRows.map((lesson) => {
      const classRow = classById.get(lesson.class_id);
      const teacherRow = lesson.teacher_id ? teacherById.get(lesson.teacher_id) : null;
      const students = (studentsByClass.get(lesson.class_id) ?? [])
        .map((student) => {
          const attendanceRow = attendanceByLessonStudent.get(`${lesson.id}:${student.id}`);
          return {
            ...student,
            attendanceId: attendanceRow?.id ?? null,
            attendanceStatus: attendanceRow?.status ?? null,
            attendanceNotes: attendanceRow?.notes ?? null,
            attendanceArrivedAt: attendanceRow?.arrived_at ?? null,
          };
        })
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
    if (isAdmin) await loadManagedUsers();
    if (profile.role === "teacher" && session?.user.id) await loadTeacherDashboard(session.user.id);
  }

  async function callUserManagementFunction(body: Record<string, unknown>) {
    const { data, error: functionError } = await supabase.functions.invoke("manage-users", {
      body,
    });

    if (functionError) {
      console.error("[User management] Edge Function error", functionError);
      const context = (functionError as { context?: unknown }).context;
      if (context instanceof Response) {
        const payload = await context
          .clone()
          .json()
          .catch(() => null);
        if (payload && typeof payload === "object" && "error" in payload) {
          throw new Error(String((payload as { error: unknown }).error));
        }
      }
      throw new Error(functionError.message || "User management request failed.");
    }

    if (data && typeof data === "object" && "error" in data) {
      throw new Error(String((data as { error: unknown }).error));
    }

    return data as { users?: ManagedUser[]; user?: ManagedUser };
  }

  async function loadManagedUsers() {
    setUserManagementLoading(true);
    setUserManagementMessage(null);

    try {
      const data = await callUserManagementFunction({ action: "listUsers" });
      setManagedUsers(data.users ?? []);
    } catch (managementError) {
      console.error("[User management] Could not load users", managementError);
      setUserManagementMessage(getClientErrorMessage(managementError, "Could not load user management data."));
    } finally {
      setUserManagementLoading(false);
    }
  }

  async function createManagedUser(input: ManagedUserCreateInput) {
    setUserManagementLoading(true);
    setUserManagementMessage(null);

    try {
      await callUserManagementFunction({
        action: "createUser",
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        temporaryPassword: input.temporaryPassword,
        isActive: input.isActive,
      });
      await loadManagedUsers();
      setUserManagementMessage("User created successfully.");
    } catch (managementError) {
      console.error("[User management] Could not create user", managementError);
      setUserManagementMessage(getClientErrorMessage(managementError, "Could not create this user."));
    } finally {
      setUserManagementLoading(false);
    }
  }

  async function updateManagedUser(userId: string, updates: ManagedUserUpdateInput) {
    setUserManagementLoading(true);
    setUserManagementMessage(null);

    try {
      await callUserManagementFunction({
        action: "updateUser",
        userId,
        role: updates.role,
        isActive: updates.isActive,
      });
      await loadManagedUsers();
      setUserManagementMessage("User updated successfully.");
    } catch (managementError) {
      console.error("[User management] Could not update user", managementError);
      setUserManagementMessage(getClientErrorMessage(managementError, "Could not update this user."));
    } finally {
      setUserManagementLoading(false);
    }
  }

  async function linkTeacherLogin(teacherId: string, userId: string) {
    if (!isAdmin) {
      throw new Error("Only admins can link teacher logins.");
    }

    const teacherRecord = teachers.find((item) => item.id === teacherId);
    const userRecord = managedUsers.find((item) => item.id === userId);

    if (!teacherRecord) {
      throw new Error("Choose a teacher record to link.");
    }

    if (!userRecord) {
      throw new Error("Choose a teacher user to link.");
    }

    if (normalizeUserRole(userRecord.role) !== "teacher") {
      throw new Error("Only users with the teacher role can be linked to teacher records.");
    }

    if (!userRecord.is_active) {
      throw new Error("This teacher user is inactive.");
    }

    if (teacherRecord.user_id) {
      throw new Error("This teacher record is already linked.");
    }

    if (teachers.some((item) => item.user_id === userId)) {
      throw new Error("This teacher user is already linked to another teacher record.");
    }

    setActionLoading(true);
    setTeacherLinkingMessage(null);

    try {
      const { data: linkedRows, error: linkError } = await supabase
        .from("teachers")
        .update({ user_id: userId })
        .eq("id", teacherId)
        .is("user_id", null)
        .select("id, user_id");

      if (linkError) {
        console.error("[Teacher linking] Could not link teacher login", linkError);
        throw new Error("Could not link this teacher login. Please try again.");
      }

      if ((linkedRows?.length ?? 0) !== 1) {
        throw new Error("Teacher login was not linked because the selected teacher may already be linked.");
      }

      await Promise.all([loadCoordinatorDashboard(), loadManagedUsers()]);
      setTeacherLinkingMessage("Teacher login linked successfully.");
    } finally {
      setActionLoading(false);
    }
  }

  async function saveRetroactiveAttendance(lessonId: string, drafts: Record<string, RetroAttendanceDraft>) {
    if (!profile || !isCoordinator) {
      throw new Error("Only coordinators can update retroactive attendance.");
    }

    const selectedLesson = coordinatorSessions.find((item) => item.id === lessonId);
    if (!selectedLesson) {
      throw new Error("Choose a real existing lesson before saving attendance.");
    }

    if (!isPastSession(selectedLesson)) {
      throw new Error("Retroactive attendance can only be saved for past lessons.");
    }

    const validStudentIds = new Set(selectedLesson.students.map((student) => student.id));
    const rowsToSave = Object.entries(drafts)
      .filter(([, draft]) => draft.status)
      .map(([studentId, draft]) => {
        if (!validStudentIds.has(studentId)) {
          throw new Error("Attendance includes a student who is not enrolled in this session.");
        }

        return {
          lesson_id: selectedLesson.id,
          class_id: selectedLesson.classId,
          student_id: studentId,
          status: draft.status as AttendanceStatus,
          notes: draft.notes.trim() || null,
          recorded_by: profile.id,
          recorded_at: new Date().toISOString(),
        };
      });

    if (rowsToSave.length === 0) {
      throw new Error("Set at least one attendance status before saving.");
    }

    setActionLoading(true);
    setError(null);

    try {
      const { error: attendanceError } = await supabase
        .from("attendance")
        .upsert(rowsToSave, { onConflict: "lesson_id,student_id" })
        .select("id, lesson_id, class_id, student_id, status, notes");

      if (attendanceError) {
        console.error("[Retroactive attendance] Could not save attendance", attendanceError);
        throw new Error(getFriendlyRetroAttendanceSaveError(attendanceError));
      }

      await logActivity("late_entry_updated", selectedLesson, {
        update_type: "retroactive_attendance_saved",
        recorded_retroactively: true,
        changed_count: rowsToSave.length,
      });
      await loadCoordinatorDashboard();
    } finally {
      setActionLoading(false);
    }
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
    const { data: savedAttendance, error: attendanceError } = await supabase
      .from("attendance")
      .upsert(
        {
          lesson_id: item.id,
          class_id: item.classId,
          student_id: studentId,
          status,
          recorded_by: profile.id,
          recorded_at: new Date().toISOString(),
        },
        { onConflict: "lesson_id,student_id" },
      )
      .select("id, lesson_id, class_id, student_id, status")
      .single();
    if (attendanceError) {
      console.error("[Attendance] Could not save attendance", attendanceError);
      setError(getFriendlySupabaseSaveError(attendanceError, "attendance"));
    } else {
      await queueParentNotificationLog(item, studentId, savedAttendance?.id ?? null, status);
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

  async function queueParentNotificationLog(
    item: SummerSession,
    studentId: string,
    attendanceId: string | null,
    attendanceStatus: AttendanceStatus,
  ) {
    if (attendanceStatus !== "late" && attendanceStatus !== "absent") return;
    if (!attendanceId) return;

    const notificationType = attendanceStatus as ParentNotificationType;
    const student = item.students.find((candidate) => candidate.id === studentId);
    const guardianPhone = student?.guardianPhone?.trim();
    if (!student || !guardianPhone) return;
    if (await hasNotificationToday(student.id)) return;

    const message =
      notificationType === "late"
        ? `Sayın Velimiz, öğrenciniz ${student.fullName} bugün derse geç katılmıştır. Bilginize.`
        : `Sayın Velimiz, öğrenciniz ${student.fullName} bugün derse katılmamıştır. Bilginize.`;

    const { error: notificationError } = await supabase.from("notification_logs").upsert(
      {
        student_id: student.id,
        attendance_id: attendanceId,
        notification_type: notificationType,
        phone: guardianPhone,
        message,
        status: "pending",
      },
      {
        onConflict: "student_id,attendance_id,notification_type",
        ignoreDuplicates: true,
      },
    );

    if (notificationError) {
      console.error("[Notification log] Could not queue parent notification", {
        error: notificationError,
        lessonId: item.id,
        attendanceId,
        studentId,
        notificationType,
      });
    }
  }

  async function hasNotificationToday(studentId: string) {
    const { startIso, endIso } = getTurkeyTodayUtcRange();
    const { data, error: notificationCheckError } = await supabase
      .from("notification_logs")
      .select("id")
      .eq("student_id", studentId)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(1);

    if (notificationCheckError) {
      console.error("[Notification log] Could not check daily notification limit", {
        error: notificationCheckError,
        studentId,
        startIso,
        endIso,
      });
      return false;
    }

    return (data?.length ?? 0) > 0;
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

  async function changeOwnPassword(input: PasswordChangeInput): Promise<PasswordChangeResult> {
    if (!profile?.email) {
      throw new Error("Could not verify the signed-in user email.");
    }

    const validation = validatePasswordChangeInput(input);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: input.currentPassword,
    });

    if (reauthError) {
      throw new Error("Current password is incorrect.");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: input.newPassword,
    });

    if (updateError) {
      throw new Error("Could not update your password. Please try again.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionRetained = Boolean(sessionData.session);

    return {
      message: sessionRetained
        ? "Password changed successfully."
        : "Password changed successfully. Please sign in again with your new password.",
      sessionRetained,
    };
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

      <AccountSettingsPanel profile={profile} onChangePassword={changeOwnPassword} />

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
          managedUsers={managedUsers}
          userManagementLoading={userManagementLoading}
          userManagementMessage={userManagementMessage}
          onCreateUser={createManagedUser}
          onUpdateUser={updateManagedUser}
          onRefreshUsers={loadManagedUsers}
          onLinkTeacherLogin={linkTeacherLogin}
          onSaveRetroactiveAttendance={saveRetroactiveAttendance}
          teacherLinkingMessage={teacherLinkingMessage}
          onOpenStudentProfile={setSelectedProfileStudentId}
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
          onOpenStudentProfile={setSelectedProfileStudentId}
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
      {selectedStudentProfile && (
        <StudentProfileDrawer
          student={selectedStudentProfile}
          onClose={() => setSelectedProfileStudentId(null)}
        />
      )}
    </main>
  );
}

function AccountSettingsPanel({
  profile,
  onChangePassword,
}: {
  profile: UserProfile;
  onChangePassword: (input: PasswordChangeInput) => Promise<PasswordChangeResult>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await onChangePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setMessageType("success");
      setMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (passwordError) {
      setMessageType("error");
      setMessage(getClientErrorMessage(passwordError, "Could not update your password. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="panel account-settings-panel">
      <summary>
        <div>
          <h3>Account Settings</h3>
          <p>{profile.full_name} - {profile.email}</p>
        </div>
        <span className="status-pill success">{profile.role}</span>
      </summary>
      <form className="password-change-form" onSubmit={handleSubmit}>
        <div>
          <h4>Change Password</h4>
          <p className="muted">Use your current password to confirm this change.</p>
        </div>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {message && (
          <p className={messageType === "success" ? "management-message" : "error"}>
            {message}
          </p>
        )}
        <button type="submit" disabled={saving}>
          {saving ? "Changing password..." : "Change password"}
        </button>
      </form>
    </details>
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
  managedUsers,
  userManagementLoading,
  userManagementMessage,
  onCreateUser,
  onUpdateUser,
  onRefreshUsers,
  onLinkTeacherLogin,
  onSaveRetroactiveAttendance,
  teacherLinkingMessage,
  onOpenStudentProfile,
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
  managedUsers: ManagedUser[];
  userManagementLoading: boolean;
  userManagementMessage: string | null;
  onCreateUser: (input: ManagedUserCreateInput) => Promise<void>;
  onUpdateUser: (userId: string, updates: ManagedUserUpdateInput) => Promise<void>;
  onRefreshUsers: () => Promise<void>;
  onLinkTeacherLogin: (teacherId: string, userId: string) => Promise<void>;
  onSaveRetroactiveAttendance: (lessonId: string, drafts: Record<string, RetroAttendanceDraft>) => Promise<void>;
  teacherLinkingMessage: string | null;
  onOpenStudentProfile: (studentId: string) => void;
}) {
  const [sessionSearch, setSessionSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState(() => getDefaultSummerSchoolHistoryDate(getTodayDate()));
  const [reportDate, setReportDate] = useState(() => getTodayDate());
  const isAdmin = isAdminProfile(profile);
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>(() => getInitialAdminTab(isAdmin));
  const linkedTeachers = teachers.filter((item) => item.user_id);
  const sessionById = new Map(sessions.map((item) => [item.id, item]));
  const teacherById = new Map(teachers.map((item) => [item.id, item]));
  const managedUserById = new Map(managedUsers.map((item) => [item.id, item]));
  const teacherSearchText = normalizeSearchText(teacherSearch);
  const roomSearchText = normalizeSearchText(roomSearch);
  const studentSearchText = normalizeSearchText(studentSearch);
  const filteredTeachers = teachers.filter((item) => matchesTeacherSearch(item, managedUserById, teacherSearchText));
  const roomRecords = useMemo(() => getRoomRecords(sessions), [sessions]);
  const filteredRoomRecords = roomRecords.filter((item) => matchesRoomSearch(item, roomSearchText));
  const studentRecords = useMemo(() => getStudentRecords(sessions), [sessions]);
  const globalStudentSearchSource = useMemo(() => getGlobalStudentSearchSource(studentRecords), [studentRecords]);
  const attentionNeededItems = useMemo(() => getAttentionNeededItems(studentRecords), [studentRecords]);
  const filteredStudentRecords = studentRecords.filter((item) => matchesStudentSearch(item, studentSearchText));
  const selectedStudent = selectedStudentId
    ? studentRecords.find((item) => item.id === selectedStudentId) ?? null
    : null;
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
  const historySessions = getHistorySessionsByDate(sessions, historyDate);
  const historyDateLabel = formatLessonDateWithWeekday(historyDate);
  const firstName = getFirstName(profile.full_name);
  const administrationNavGroups = useMemo(() => getAdministrationNavGroups(isAdmin), [isAdmin]);
  const administrationNavItems = useMemo(
    () => administrationNavGroups.flatMap((group) => group.items),
    [administrationNavGroups],
  );

  useEffect(() => {
    if (!administrationNavItems.some((item) => item.id === activeAdminTab)) {
      setActiveAdminTab("dashboard");
    }
  }, [activeAdminTab, administrationNavItems]);

  useEffect(() => {
    syncAdminTabToUrl(activeAdminTab);
  }, [activeAdminTab]);

  return (
    <section className="dashboard coordinator-dashboard">
      <div className="coordinator-workspace">
        <aside className="coordinator-sidebar" aria-label="Coordinator navigation">
          <div className="coordinator-sidebar-summary">
            <strong>Campus Workspace</strong>
            <span>{stats?.studentCount ?? 0} students</span>
          </div>
          <nav className="coordinator-sidebar-nav">
            {administrationNavGroups.map((group) => (
              <div className="coordinator-sidebar-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => (
                  <button
                    aria-current={activeAdminTab === item.id ? "page" : undefined}
                    className={activeAdminTab === item.id ? "coordinator-sidebar-item active" : "coordinator-sidebar-item"}
                    key={item.id}
                    type="button"
                    onClick={() => setActiveAdminTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="coordinator-sidebar-meta">
            <span>Linked {linkedTeachers.length} / {teachers.length}</span>
            <span>{teachers.length} teachers</span>
          </div>
        </aside>

        <div className="coordinator-workspace-content">
          <div hidden={activeAdminTab !== "dashboard"}>
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

      <GlobalStudentSearch
        resultsSource={globalStudentSearchSource}
        onOpenStudentProfile={onOpenStudentProfile}
      />

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

      <AttentionNeededPanel items={attentionNeededItems} onOpenStudentProfile={onOpenStudentProfile} />

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
                onOpenStudentProfile={onOpenStudentProfile}
              />
            ))}
          </div>
        )}
      </section>
          </div>

          <div hidden={activeAdminTab !== "session-history"}>
      <section className="session-group">
        <div className="live-session-toolbar">
              <div className="section-heading compact">
                <h3>Session History</h3>
                <p>{historySessions.length} sessions on {historyDateLabel}</p>
              </div>
              <label className="search-field compact-search history-date-picker">
                <span>Select lesson date</span>
                <input
                  type="date"
                  value={historyDate}
                  min={SUMMER_SCHOOL_START_DATE}
                  max={SUMMER_SCHOOL_END_DATE}
                  onChange={(event) => setHistoryDate(event.target.value)}
                />
              </label>
            </div>
        <div className="history-results-context">
          Showing sessions for {historyDateLabel}. Summer School runs through {formatLessonDateWithWeekday(SUMMER_SCHOOL_END_DATE)}.
        </div>
        {historySessions.length === 0 ? (
          <div className="panel">
            <p className="muted">No Summer School sessions found for this selected date.</p>
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
                onOpenStudentProfile={onOpenStudentProfile}
                compact
              />
            ))}
          </div>
        )}
      </section>
          </div>

          <div hidden={activeAdminTab !== "dashboard"}>
      {pastEntrySessions.length > 0 && (
        <div className="panel late-entry-panel">
          <strong>Late entry queue</strong>
          <span>{pastEntrySessions.length} unfinished past sessions are available inside Session History after enabling editing.</span>
        </div>
      )}

      <ActivityFeed logs={activityLogs} sessionById={sessionById} teacherById={teacherById} />
          </div>

          <div className="administration-tab-panels">
            {isAdmin && (
              <div hidden={activeAdminTab !== "user-management"}>
                <UserManagementPanel
                  currentUserId={profile.id}
                  users={managedUsers}
                  loading={userManagementLoading}
                  message={userManagementMessage}
                  onCreateUser={onCreateUser}
                  onUpdateUser={onUpdateUser}
                  onRefreshUsers={onRefreshUsers}
                />
              </div>
            )}

            {isAdmin && (
              <div hidden={activeAdminTab !== "teacher-linking"}>
                <TeacherLoginLinkingPanel
                  actionLoading={actionLoading}
                  isAdmin={isAdmin}
                  managedUsers={managedUsers}
                  message={teacherLinkingMessage}
                  onLinkTeacherLogin={onLinkTeacherLogin}
                  stats={stats}
                  teachers={teachers}
                />
              </div>
            )}

            <div hidden={activeAdminTab !== "reports"}>
              <ReportsPanel
                reportDate={reportDate}
                sessions={sessions}
                onOpenStudentProfile={onOpenStudentProfile}
                onReportDateChange={setReportDate}
              />
            </div>

            <div hidden={activeAdminTab !== "student-records"}>
              <StudentRecordsPanel
                searchValue={studentSearch}
                onSearchChange={setStudentSearch}
                selectedStudent={selectedStudent}
                selectedStudentId={selectedStudentId}
                students={filteredStudentRecords}
                totalStudents={studentRecords.length}
                onSelectStudent={setSelectedStudentId}
              />
            </div>

            <div hidden={activeAdminTab !== "retroactive-attendance"}>
              <RetroactiveAttendancePanel
                actionLoading={actionLoading}
                onSaveRetroactiveAttendance={onSaveRetroactiveAttendance}
                onOpenStudentProfile={onOpenStudentProfile}
                sessions={sessions}
              />
            </div>

            <div hidden={activeAdminTab !== "teachers"}>
              <TeacherRecordsPanel
                linkedTeachers={linkedTeachers}
                managedUserById={managedUserById}
                searchValue={teacherSearch}
                onSearchChange={setTeacherSearch}
                teachers={filteredTeachers}
                totalTeachers={teachers.length}
              />
            </div>

            <div hidden={activeAdminTab !== "rooms"}>
              <RoomRecordsPanel
                rooms={filteredRoomRecords}
                searchValue={roomSearch}
                onSearchChange={setRoomSearch}
                totalRooms={roomRecords.length}
              />
            </div>

            <div hidden={activeAdminTab !== "sessions-classes"}>
              <SessionsClassesPanel sessions={sessions} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdministrationOverviewPanel({
  linkedTeachers,
  rooms,
  sessions,
  stats,
  teachers,
}: {
  linkedTeachers: number;
  rooms: number;
  sessions: SummerSession[];
  stats: CoordinatorStats | null;
  teachers: number;
}) {
  const classCount = new Set(sessions.map((item) => item.classId)).size;
  const completedLessons = sessions.filter((item) => item.finishedAt).length;

  return (
    <section className="admin-records-panel administration-overview-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Administration Overview</h4>
          <p>Quick summary of the current campus administration workspace.</p>
        </div>
      </div>
      <div className="admin-overview-grid">
        <StatCard label="Teachers" value={teachers} />
        <StatCard label="Linked Logins" value={`${linkedTeachers} / ${teachers}`} />
        <StatCard label="Students" value={stats?.studentCount ?? 0} />
        <StatCard label="Rooms" value={rooms} />
        <StatCard label="Classes" value={classCount} />
        <StatCard label="Completed Lessons" value={completedLessons} />
      </div>
    </section>
  );
}

function GlobalStudentSearch({
  onOpenStudentProfile,
  resultsSource,
}: {
  onOpenStudentProfile: (studentId: string) => void;
  resultsSource: GlobalStudentSearchResult[];
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = normalizeGlobalStudentSearchText(query);
  const canSearch = normalizedQuery.length >= 2;
  const matchedResults = useMemo(
    () => (canSearch ? getGlobalStudentSearchResults(resultsSource, normalizedQuery) : []),
    [canSearch, normalizedQuery, resultsSource],
  );
  const visibleResults = matchedResults.slice(0, GLOBAL_STUDENT_SEARCH_LIMIT);
  const hasMoreResults = matchedResults.length > visibleResults.length;
  const showPanel = isOpen && canSearch;

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (visibleResults.length > 0 && activeIndex >= visibleResults.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, visibleResults.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const selectResult = (result: GlobalStudentSearchResult) => {
    onOpenStudentProfile(result.studentId);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!showPanel || visibleResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleResults.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectResult(visibleResults[Math.min(activeIndex, visibleResults.length - 1)]);
    }
  };

  return (
    <section className="global-student-search" ref={rootRef}>
      <label className="global-student-search-field">
        <span>Global Student Search</span>
        <input
          aria-activedescendant={
            showPanel && visibleResults.length > 0 ? `global-student-result-${activeIndex}` : undefined
          }
          aria-controls="global-student-search-results"
          aria-expanded={showPanel}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(event.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search students..."
          role="combobox"
          type="search"
          value={query}
        />
      </label>

      {showPanel && (
        <div className="global-student-results" id="global-student-search-results" role="listbox">
          {visibleResults.length === 0 ? (
            <p className="global-student-search-message">No matching students found.</p>
          ) : (
            <>
              {visibleResults.map((result, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? "global-student-result active" : "global-student-result"}
                  id={`global-student-result-${index}`}
                  key={result.key}
                  onClick={() => selectResult(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <strong>{result.studentName}</strong>
                  <span>
                    {result.sessionContext} - {result.teacherName} - {result.room ?? "Room not set"}
                  </span>
                  {result.matchedByCode && <em>Matched by student code</em>}
                </button>
              ))}
              {hasMoreResults && (
                <p className="global-student-search-message">Refine your search to see more results.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function AttentionNeededPanel({
  items,
  onOpenStudentProfile,
}: {
  items: AttentionNeededItem[];
  onOpenStudentProfile: (studentId: string) => void;
}) {
  return (
    <section className="session-group attention-needed-section">
      <div className="section-heading compact attention-needed-heading">
        <div>
          <h3>Attention Needed</h3>
          <p>Students who may need attendance follow-up</p>
        </div>
        <span className={items.length > 0 ? "status-pill warning" : "status-pill success"}>
          {items.length} flagged
        </span>
      </div>

      {items.length === 0 ? (
        <div className="panel attention-empty-state">
          <p>No students currently require attendance follow-up.</p>
        </div>
      ) : (
        <div className="attention-needed-list operational-item-grid">
          {items.map((item) => (
            <button
              className="attention-needed-row operational-grid-item"
              key={item.id}
              type="button"
              onClick={() => onOpenStudentProfile(item.studentId)}
            >
              <span className="attention-student">
                <strong>{item.studentName}</strong>
                <span>{item.sessionContext}</span>
                <span>{item.roomLabel} - {item.teacherName}</span>
              </span>
              <span className="attention-reasons">
                <strong>{item.primaryReason.label}</strong>
                {item.secondaryReasons.length > 0 && (
                  <span>{item.secondaryReasons.map((reason) => reason.label).join(" - ")}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TeacherLoginLinkingPanel({
  actionLoading,
  isAdmin,
  managedUsers,
  message,
  onLinkTeacherLogin,
  stats,
  teachers,
}: {
  actionLoading: boolean;
  isAdmin: boolean;
  managedUsers: ManagedUser[];
  message: string | null;
  onLinkTeacherLogin: (teacherId: string, userId: string) => Promise<void>;
  stats: CoordinatorStats | null;
  teachers: Teacher[];
}) {
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const managedUserById = new Map(managedUsers.map((item) => [item.id, item]));
  const linkedTeacherUserIds = new Set(teachers.map((item) => item.user_id).filter(Boolean));
  const linkedTeachers = teachers.filter((item) => item.user_id);
  const unlinkedTeachers = teachers.filter((item) => !item.user_id);
  const availableTeacherUsers = managedUsers.filter(
    (item) => normalizeUserRole(item.role) === "teacher" && item.is_active && !linkedTeacherUserIds.has(item.id),
  );
  const selectedTeacher = unlinkedTeachers.find((item) => item.id === selectedTeacherId) ?? null;
  const selectedUser = availableTeacherUsers.find((item) => item.id === selectedUserId) ?? null;
  const canSubmitLink = Boolean(selectedTeacher && selectedUser && !actionLoading);
  const visibleMessage = localMessage ?? message;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalMessage(null);

    try {
      await onLinkTeacherLogin(selectedTeacherId, selectedUserId);
      setMessageType("success");
      setLocalMessage("Teacher login linked successfully.");
      setSelectedTeacherId("");
      setSelectedUserId("");
    } catch (linkError) {
      setMessageType("error");
      setLocalMessage(getClientErrorMessage(linkError, "Could not link this teacher login."));
    }
  };

  return (
    <section className="teacher-linking-panel">
      <div>
        <h4>Teacher Login Linking</h4>
        <p>
          Create a teacher user in User Management, then link that user to the matching imported teacher record.
        </p>
      </div>
      <div className="teacher-grid">
        <span className="status-pill success">Linked logins: {linkedTeachers.length} / {teachers.length}</span>
        <span className="status-pill success">Total students: {stats?.studentCount ?? 0}</span>
        <span className="status-pill warning">
          Attendance pending: {stats?.attendancePendingCount ?? 0}
        </span>
        {teachers.map((item) => {
          const linkedUser = item.user_id ? managedUserById.get(item.user_id) : null;
          const linkedLabel = linkedUser
            ? `linked to ${linkedUser.full_name} (${linkedUser.email})`
            : item.user_id
              ? `linked to user ${item.user_id.slice(0, 8)}...`
              : "missing login";

          return (
            <span className={item.user_id ? "status-pill success" : "status-pill warning"} key={item.id}>
              {item.display_name}: {linkedLabel}
            </span>
          );
        })}
      </div>

      {visibleMessage && (
        <p className={messageType === "success" ? "management-message" : "error"}>
          {visibleMessage}
        </p>
      )}

      {!isAdmin ? (
        <p className="muted">Teacher login linking is managed by admin users in this Administration panel.</p>
      ) : unlinkedTeachers.length === 0 ? (
        <p className="muted">All imported teachers have linked logins.</p>
      ) : availableTeacherUsers.length === 0 ? (
        <p className="muted">Create an active teacher user in User Management, then return here to link it.</p>
      ) : (
        <form className="teacher-linking-form" onSubmit={handleSubmit}>
          <label>
            Imported teacher record
            <select
              value={selectedTeacherId}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
              required
            >
              <option value="">Choose teacher</option>
              {unlinkedTeachers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Teacher login user
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              required
            >
              <option value="">Choose user</option>
              {availableTeacherUsers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.full_name} - {item.email}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!canSubmitLink}>
            Link teacher login
          </button>
        </form>
      )}
    </section>
  );
}

function ReportsPanel({
  onOpenStudentProfile,
  onReportDateChange,
  reportDate,
  sessions,
}: {
  onOpenStudentProfile: (studentId: string) => void;
  onReportDateChange: (value: string) => void;
  reportDate: string;
  sessions: SummerSession[];
}) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<ReportDrillDownSelection | null>(null);
  const [printReport, setPrintReport] = useState<{
    generatedAt: Date;
    report: DailyAttendanceReport;
  } | null>(null);
  const drillDownPanelRef = useRef<HTMLElement | null>(null);
  const report = getDailyAttendanceReport(sessions, reportDate);
  const canExport = report.totalScheduledSessions > 0;
  const drillDownRecords = drillDown ? getReportDrillDownRecords(report, drillDown) : [];

  useEffect(() => {
    if (!printReport) return;

    let fallbackTimeout: number | null = null;
    const finishPrint = () => {
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      setPrintReport(null);
    };

    window.addEventListener("afterprint", finishPrint, { once: true });
    const printTimeout = window.setTimeout(() => {
      window.print();
      fallbackTimeout = window.setTimeout(finishPrint, 1500);
    }, 80);

    return () => {
      window.clearTimeout(printTimeout);
      if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
      window.removeEventListener("afterprint", finishPrint);
    };
  }, [printReport]);

  useEffect(() => {
    setDrillDown(null);
  }, [reportDate]);

  useEffect(() => {
    if (!drillDown) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrillDown(null);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [drillDown]);

  useEffect(() => {
    if (!drillDown) return;

    const animationFrame = window.requestAnimationFrame(() => {
      drillDownPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      drillDownPanelRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [drillDown]);

  const handleCsvExport = () => {
    setExportError(null);
    try {
      exportDailyReportCsv(report);
    } catch (error) {
      console.error("[Reports] CSV export failed", error);
      setExportError("Could not export the CSV report. Please try again.");
    }
  };

  const handleExcelExport = async () => {
    setExportError(null);
    try {
      await exportDailyReportExcel(report);
    } catch (error) {
      console.error("[Reports] Excel export failed", error);
      setExportError("Could not export the Excel report. Please try again.");
    }
  };

  const handlePrintReport = () => {
    setExportError(null);
    try {
      setPrintReport({ generatedAt: new Date(), report });
    } catch (error) {
      console.error("[Reports] Print preparation failed", error);
      setExportError("Could not prepare the printable report. Please try again.");
    }
  };

  return (
    <section className="admin-records-panel reports-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Reports</h4>
          <p>Daily attendance summary for {formatLessonDateWithWeekday(report.date)}</p>
        </div>
        <label className="search-field compact-search">
          <span>Select report date</span>
          <input
            type="date"
            value={reportDate}
            onChange={(event) => onReportDateChange(event.target.value || getTodayDate())}
          />
        </label>
      </div>

      <div className="reports-summary-grid">
        <StatCard label="Scheduled Sessions" value={report.totalScheduledSessions} />
        <StatCard label="Attendance Recorded" value={report.sessionsWithAttendanceRecorded} />
        <StatCard label="No Attendance" value={report.sessionsWithNoAttendanceRecorded} />
        <StatCard label="Students Expected" value={report.totalStudentsExpected} />
        <ReportMetricButton
          label="Attended"
          value={report.present}
          onClick={() => setDrillDown({ status: "present" })}
        />
        <ReportMetricButton
          label="Late"
          value={report.late}
          onClick={() => setDrillDown({ status: "late" })}
        />
        <ReportMetricButton
          label="Absent"
          value={report.absent}
          onClick={() => setDrillDown({ status: "absent" })}
        />
        <ReportMetricButton
          label="Excused"
          value={report.excused}
          onClick={() => setDrillDown({ status: "excused" })}
        />
      </div>

      {drillDown && (
        <ReportDrillDownPanel
          panelRef={drillDownPanelRef}
          records={drillDownRecords}
          report={report}
          selection={drillDown}
          onClose={() => setDrillDown(null)}
          onOpenStudentProfile={onOpenStudentProfile}
        />
      )}

      <div className="report-export-actions">
        <div>
          <h5>Export</h5>
          <p>Download the currently selected daily report.</p>
        </div>
        <div className="report-export-buttons">
          <button className="secondary" type="button" onClick={handleCsvExport} disabled={!canExport}>
            Export CSV
          </button>
          <button className="secondary" type="button" onClick={() => void handleExcelExport()} disabled={!canExport}>
            Export Excel
          </button>
          <button className="secondary" type="button" onClick={handlePrintReport} disabled={!canExport}>
            Print / Save PDF
          </button>
        </div>
        {exportError && <p className="error">{exportError}</p>}
      </div>

      {printReport && (
        <PrintableAttendanceReport report={printReport.report} generatedAt={printReport.generatedAt} />
      )}

      <section className="report-section">
        <div>
          <h5>Session Breakdown</h5>
          <p>{report.sessionRows.length} sessions on this date</p>
        </div>
        {report.sessionRows.length === 0 ? (
          <p className="muted">No scheduled sessions found for this date.</p>
        ) : (
          <div className="report-table">
            <div className="report-row report-row-header">
              <span>Time</span>
              <span>Teacher</span>
              <span>Session</span>
              <span>Room</span>
              <span>Expected</span>
              <span>Attended</span>
              <span>Late</span>
              <span>Absent</span>
              <span>Excused</span>
              <span>Status</span>
            </div>
            {report.sessionRows.map((item) => (
              <div className="report-row" key={item.lessonId}>
                <span>{item.timeLabel}</span>
                <strong>{item.teacherName}</strong>
                <span>{item.className}</span>
                <span>{item.roomContext}</span>
                <span>{item.expected}</span>
                <ReportTableMetricButton
                  value={item.present}
                  status="present"
                  onClick={() => setDrillDown({ status: "present", lessonId: item.lessonId })}
                />
                <ReportTableMetricButton
                  value={item.late}
                  status="late"
                  onClick={() => setDrillDown({ status: "late", lessonId: item.lessonId })}
                />
                <ReportTableMetricButton
                  value={item.absent}
                  status="absent"
                  onClick={() => setDrillDown({ status: "absent", lessonId: item.lessonId })}
                />
                <ReportTableMetricButton
                  value={item.excused}
                  status="excused"
                  onClick={() => setDrillDown({ status: "excused", lessonId: item.lessonId })}
                />
                <span className={item.completed ? "status-pill success" : "status-pill warning"}>
                  {item.completed ? "Completed" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="report-section">
        <div>
          <h5>Teacher Breakdown</h5>
          <p>{report.teacherRows.length} teachers scheduled on this date</p>
        </div>
        {report.teacherRows.length === 0 ? (
          <p className="muted">No teacher sessions found for this date.</p>
        ) : (
          <div className="report-table teacher-report-table">
            <div className="report-row report-row-header">
              <span>Teacher</span>
              <span>Sessions</span>
              <span>Completed</span>
              <span>Missing</span>
              <span>Attended</span>
              <span>Late</span>
              <span>Absent</span>
              <span>Excused</span>
            </div>
            {report.teacherRows.map((item) => (
              <div className="report-row" key={item.teacherId}>
                <strong>{item.teacherName}</strong>
                <span>{item.scheduledSessions}</span>
                <span>{item.attendanceCompleted}</span>
                <span>{item.attendanceMissing}</span>
                <ReportTableMetricButton
                  value={item.present}
                  status="present"
                  onClick={() => setDrillDown({ status: "present", teacherId: item.teacherId })}
                />
                <ReportTableMetricButton
                  value={item.late}
                  status="late"
                  onClick={() => setDrillDown({ status: "late", teacherId: item.teacherId })}
                />
                <ReportTableMetricButton
                  value={item.absent}
                  status="absent"
                  onClick={() => setDrillDown({ status: "absent", teacherId: item.teacherId })}
                />
                <ReportTableMetricButton
                  value={item.excused}
                  status="excused"
                  onClick={() => setDrillDown({ status: "excused", teacherId: item.teacherId })}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ReportMetricButton({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick: () => void;
  value: number;
}) {
  if (value === 0) {
    return <StatCard label={label} value={value} />;
  }

  return (
    <button className="stat-card report-metric-button" type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function ReportTableMetricButton({
  onClick,
  status,
  value,
}: {
  onClick: () => void;
  status: AttendanceStatus;
  value: number;
}) {
  if (value === 0) {
    return <span className="report-metric-zero">{value}</span>;
  }

  return (
    <button className="report-table-metric" type="button" onClick={onClick}>
      <span className="sr-only">{formatAttendanceStatus(status)} records: </span>
      {value}
    </button>
  );
}

function ReportDrillDownPanel({
  onClose,
  onOpenStudentProfile,
  panelRef,
  records,
  report,
  selection,
}: {
  onClose: () => void;
  onOpenStudentProfile: (studentId: string) => void;
  panelRef: RefObject<HTMLElement>;
  records: DailyReportAttendanceRecord[];
  report: DailyAttendanceReport;
  selection: ReportDrillDownSelection;
}) {
  return (
    <section
      className="report-drilldown-panel"
      ref={panelRef}
      tabIndex={-1}
      aria-label="Report drill-down records"
    >
      <div className="report-drilldown-heading">
        <div>
          <h5>{getReportDrillDownTitle(selection)}</h5>
          <p>{getReportDrillDownContext(report, selection)} - {records.length} records</p>
        </div>
        <button className="secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {records.length === 0 ? (
        <p className="muted">No contributing attendance records found for this metric.</p>
      ) : (
        <div className="report-drilldown-list">
          {records.map((record) => (
            <article className="report-drilldown-row" key={record.key}>
              <button
                className="inline-student-button"
                type="button"
                onClick={() => onOpenStudentProfile(record.studentId)}
              >
                {record.studentName}
              </button>
              <span>{formatTimelineDate(record.lessonDate)}</span>
              <span className={`status-pill ${getStudentTimelineStatusKind(record.status)}`}>
                {getReportRecordStatusLabel(record)}
              </span>
              <span>{record.sessionContext} - {record.teacherName} - {record.roomContext}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PrintableAttendanceReport({
  generatedAt,
  report,
}: {
  generatedAt: Date;
  report: DailyAttendanceReport;
}) {
  return (
    <article className="printable-report" aria-label="Printable daily attendance report">
      <header className="print-report-header">
        <p>Sancaktepe American Life Yabancı Dil Kursu</p>
        <h1>Daily Attendance Report</h1>
        <div>
          <span>Report date: {formatLessonDateWithWeekday(report.date)}</span>
          <span>Generated: {formatPrintDateTime(generatedAt)}</span>
        </div>
      </header>

      <section className="print-report-section" aria-labelledby="print-summary-heading">
        <h2 id="print-summary-heading">Daily Summary</h2>
        <table>
          <tbody>
            <tr><th scope="row">Scheduled Sessions</th><td>{report.totalScheduledSessions}</td></tr>
            <tr><th scope="row">Attendance Recorded</th><td>{report.sessionsWithAttendanceRecorded}</td></tr>
            <tr><th scope="row">No Attendance</th><td>{report.sessionsWithNoAttendanceRecorded}</td></tr>
            <tr><th scope="row">Students Expected</th><td>{report.totalStudentsExpected}</td></tr>
            <tr><th scope="row">Present</th><td>{report.present}</td></tr>
            <tr><th scope="row">Late</th><td>{report.late}</td></tr>
            <tr><th scope="row">Absent</th><td>{report.absent}</td></tr>
            <tr><th scope="row">Excused</th><td>{report.excused}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="print-report-section" aria-labelledby="print-session-heading">
        <h2 id="print-session-heading">Session Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Teacher</th>
              <th scope="col">Class / Session</th>
              <th scope="col">Room</th>
              <th scope="col">Expected</th>
              <th scope="col">Present</th>
              <th scope="col">Late</th>
              <th scope="col">Absent</th>
              <th scope="col">Excused</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.sessionRows.map((item) => (
              <tr key={item.lessonId}>
                <td>{item.timeLabel}</td>
                <td>{item.teacherName}</td>
                <td>{item.className}</td>
                <td>{item.roomContext}</td>
                <td>{item.expected}</td>
                <td>{item.present}</td>
                <td>{item.late}</td>
                <td>{item.absent}</td>
                <td>{item.excused}</td>
                <td>{item.completed ? "Completed" : "Missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-report-section" aria-labelledby="print-teacher-heading">
        <h2 id="print-teacher-heading">Teacher Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Teacher</th>
              <th scope="col">Scheduled Sessions</th>
              <th scope="col">Attendance Completed</th>
              <th scope="col">Attendance Missing</th>
              <th scope="col">Present</th>
              <th scope="col">Late</th>
              <th scope="col">Absent</th>
              <th scope="col">Excused</th>
            </tr>
          </thead>
          <tbody>
            {report.teacherRows.map((item) => (
              <tr key={item.teacherId}>
                <td>{item.teacherName}</td>
                <td>{item.scheduledSessions}</td>
                <td>{item.attendanceCompleted}</td>
                <td>{item.attendanceMissing}</td>
                <td>{item.present}</td>
                <td>{item.late}</td>
                <td>{item.absent}</td>
                <td>{item.excused}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="print-report-footer">
        <div>
          <span>Education Coordinator</span>
        </div>
      </footer>
    </article>
  );
}

function TeacherRecordsPanel({
  linkedTeachers,
  managedUserById,
  onSearchChange,
  searchValue,
  teachers,
  totalTeachers,
}: {
  linkedTeachers: Teacher[];
  managedUserById: Map<string, ManagedUser>;
  onSearchChange: (value: string) => void;
  searchValue: string;
  teachers: Teacher[];
  totalTeachers: number;
}) {
  const [activityNow, setActivityNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setActivityNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="admin-records-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Teacher Records</h4>
          <p>{teachers.length} of {totalTeachers} teachers shown · {linkedTeachers.length} linked logins</p>
        </div>
        <label className="search-field compact-search">
          <span>Search teachers</span>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Name, code, email"
          />
        </label>
      </div>
      {teachers.length === 0 ? (
        <p className="muted">No teacher records match this search.</p>
      ) : (
        <div className="admin-record-list">
          {teachers.map((item) => {
            const linkedUser = item.user_id ? managedUserById.get(item.user_id) : null;
            const presence = getTeacherPresenceStatus(linkedUser?.last_active_at ?? null, activityNow);
            return (
              <article className="admin-record-row" key={item.id}>
                <div>
                  <strong>{item.display_name}</strong>
                  <p>{item.employee_code ?? "No employee code"}</p>
                  {linkedUser ? (
                    <div className="teacher-activity-meta">
                      <span>Last login: {formatActivityTimestamp(linkedUser.last_login_at)}</span>
                      <span>Last active: {formatActivityTimestamp(linkedUser.last_active_at)}</span>
                    </div>
                  ) : (
                    <p className="muted">No linked app login yet.</p>
                  )}
                </div>
                <div className="teacher-record-statuses">
                  <span className={item.user_id ? "status-pill success" : "status-pill warning"}>
                    {linkedUser ? `Linked to ${linkedUser.full_name}` : item.user_id ? "Linked" : "Missing login"}
                  </span>
                  {linkedUser && (
                    <span className={`status-pill ${presence.kind}`}>{presence.label}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RoomRecordsPanel({
  onSearchChange,
  rooms,
  searchValue,
  totalRooms,
}: {
  onSearchChange: (value: string) => void;
  rooms: RoomRecord[];
  searchValue: string;
  totalRooms: number;
}) {
  return (
    <section className="admin-records-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Room Records</h4>
          <p>{rooms.length} of {totalRooms} rooms shown</p>
        </div>
        <label className="search-field compact-search">
          <span>Search rooms</span>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Room name or code"
          />
        </label>
      </div>
      {rooms.length === 0 ? (
        <p className="muted">No room records match this search.</p>
      ) : (
        <div className="admin-record-list">
          {rooms.map((item) => (
            <article className="admin-record-row" key={item.key}>
              <div>
                <strong>{item.roomName}</strong>
                <p>{item.sessionCount} sessions · {item.timeLabels.join(", ")}</p>
              </div>
              <span className="status-pill success">{item.teacherNames.join(", ")}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionsClassesPanel({ sessions }: { sessions: SummerSession[] }) {
  const classRecords = getSessionClassRecords(sessions);

  return (
    <section className="admin-records-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Sessions / Classes</h4>
          <p>{classRecords.length} class/session groups shown</p>
        </div>
      </div>
      {classRecords.length === 0 ? (
        <p className="muted">No sessions or classes are currently loaded.</p>
      ) : (
        <div className="admin-record-list">
          {classRecords.map((item) => (
            <article className="admin-record-row" key={item.classId}>
              <div>
                <strong>{item.className}</strong>
                <p>{item.teacherName} - {item.room ?? "Room not set"} - {item.timeLabels.join(", ")}</p>
              </div>
              <span className="status-pill success">{item.lessonCount} lessons</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StudentRecordsPanel({
  onSearchChange,
  onSelectStudent,
  searchValue,
  selectedStudent,
  selectedStudentId,
  students,
  totalStudents,
}: {
  onSearchChange: (value: string) => void;
  onSelectStudent: (studentId: string | null) => void;
  searchValue: string;
  selectedStudent: StudentRecord | null;
  selectedStudentId: string | null;
  students: StudentRecord[];
  totalStudents: number;
}) {
  if (selectedStudent) {
    return (
      <section className="admin-records-panel student-records-panel">
        <div className="admin-breadcrumb-row">
          <div>
            <p className="admin-breadcrumb">Administration &gt; Student Records &gt; {selectedStudent.fullName}</p>
            <h4>{selectedStudent.fullName}</h4>
          </div>
          <button className="secondary" type="button" onClick={() => onSelectStudent(null)}>
            Back to Student Records
          </button>
        </div>
        <StudentDetailView student={selectedStudent} />
      </section>
    );
  }

  return (
    <section className="admin-records-panel student-records-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Student Records</h4>
          <p>{students.length} of {totalStudents} students shown</p>
        </div>
        <label className="search-field compact-search">
          <span>Search students</span>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => {
              onSearchChange(event.target.value);
              onSelectStudent(null);
            }}
            placeholder="Student name or code"
          />
        </label>
      </div>

      {students.length === 0 ? (
        <p className="muted">No student records match this search.</p>
      ) : (
        <div className="student-record-grid">
          {students.map((item) => (
            <button
              className={item.id === selectedStudentId ? "student-record-button selected" : "student-record-button"}
              key={item.id}
              type="button"
              onClick={() => onSelectStudent(item.id)}
            >
              <strong>{item.fullName}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function StudentDetailView({ student }: { student: StudentRecord }) {
  return (
    <div className="admin-record-detail student-profile-embedded">
      <StudentProfileContent student={student} />
    </div>
  );
}
function StudentProfileContent({
  onClose,
  student,
}: {
  onClose?: () => void;
  student: StudentRecord;
}) {
  const timeline = getStudentProfileTimeline(student);
  const sessionContexts = getStudentProfileSessionContexts(student);
  const isSingleSessionProfile = sessionContexts.length === 1;
  const primaryContext = sessionContexts[0] ?? null;

  return (
    <>
      <header className="student-profile-header">
        <div>
          <span className="eyebrow">Student Profile</span>
          <h2 id="student-profile-title">{student.fullName}</h2>
          <p>{student.studentCode ? `Student code: ${student.studentCode}` : "No student code"}</p>
          {isSingleSessionProfile && primaryContext && (
            <dl className="student-profile-meta">
              <div>
                <dt>Session</dt>
                <dd>{primaryContext.timeLabel}</dd>
              </div>
              <div>
                <dt>Teacher</dt>
                <dd>{primaryContext.teacherName}</dd>
              </div>
              <div>
                <dt>Room</dt>
                <dd>{primaryContext.room ?? "Room not set"}</dd>
              </div>
            </dl>
          )}
        </div>
        {onClose && (
          <button className="secondary" type="button" onClick={onClose} aria-label="Close student profile">
            Close
          </button>
        )}
      </header>

      {!isSingleSessionProfile && (
        <section className="student-profile-section">
          <h3>Sessions</h3>
          {sessionContexts.length === 0 ? (
            <p className="muted">No current session information is available.</p>
          ) : (
            <div className="student-profile-context-list">
              {sessionContexts.map((context) => (
                <div className="student-profile-context" key={context.key}>
                  <strong>{context.className}</strong>
                  <span>{context.timeLabel}</span>
                  <span>{context.teacherName} · {context.room ?? "Room not set"}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="student-profile-section">
        <h3>Summary</h3>
        <div className="student-profile-summary">
          <span>Attendance rate <strong>{getStudentAttendanceRateLabel(student.overallSummary)}</strong></span>
          <span>Attended <strong>{student.overallSummary.present}</strong></span>
          <span>Late <strong>{student.overallSummary.late}</strong></span>
          <span>Absent <strong>{student.overallSummary.absent}</strong></span>
          <span>Excused <strong>{student.overallSummary.excused}</strong></span>
          <span>Total late minutes <strong>{student.overallSummary.lateMinutes}</strong></span>
        </div>
      </section>

      <section className="student-profile-section">
        <h3>Timeline</h3>
        {timeline.length === 0 ? (
          <p className="muted">No attendance history has been recorded yet.</p>
        ) : (
          <div className="student-timeline">
            {timeline.map((item) => (
              <article
                className={isSingleSessionProfile ? "student-timeline-row" : "student-timeline-row with-context"}
                key={`${item.lessonId}-${item.className}`}
              >
                <time dateTime={item.lessonDate}>{formatTimelineDate(item.lessonDate)}</time>
                {!isSingleSessionProfile && (
                  <span className="student-timeline-context">
                    {getShortStudentTimelineContext(item)}
                  </span>
                )}
                <span className={`status-pill ${getStudentTimelineStatusKind(item.attendanceStatus)}`}>
                  {getTimelineStatusLabel(item)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function StudentProfileDrawer({
  onClose,
  student,
}: {
  onClose: () => void;
  student: StudentRecord;
}) {
  return (
    <div className="student-profile-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        aria-labelledby="student-profile-title"
        className="student-profile-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <StudentProfileContent student={student} onClose={onClose} />
      </aside>
    </div>
  );
}
function RetroactiveAttendancePanel({
  actionLoading,
  onSaveRetroactiveAttendance,
  onOpenStudentProfile,
  sessions,
}: {
  actionLoading: boolean;
  onSaveRetroactiveAttendance: (lessonId: string, drafts: Record<string, RetroAttendanceDraft>) => Promise<void>;
  onOpenStudentProfile: (studentId: string) => void;
  sessions: SummerSession[];
}) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RetroAttendanceDraft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const sessionOptions = getRetroSessionOptions(sessions);
  const lessonsForSession = sessions
    .filter((item) => item.classId === selectedClassId && isPastSession(item))
    .sort((a, b) => {
      const dateCompare = b.lessonDate.localeCompare(a.lessonDate);
      if (dateCompare !== 0) return dateCompare;
      return a.startsAt.localeCompare(b.startsAt);
    });
  const selectedLesson = lessonsForSession.find((item) => item.id === selectedLessonId) ?? null;
  const summary = getRetroDraftSummary(drafts, selectedLesson?.students ?? []);
  const hasSelectedRequiredFields = Boolean(selectedClassId && selectedLessonId && selectedLesson);
  const canSave = hasSelectedRequiredFields && summary.recorded > 0 && !actionLoading;
  const selectedLessonDateLabel = selectedLesson ? formatLessonDateWithWeekday(selectedLesson.lessonDate) : "";
  const selectedLessonTimeLabel = selectedLesson
    ? `${formatTime(selectedLesson.startsAt)}-${formatTime(selectedLesson.endsAt)}`
    : "";

  useEffect(() => {
    setSelectedLessonId("");
    setDrafts({});
    setMessage(null);
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedLesson) {
      setDrafts({});
      return;
    }

    setDrafts(
      Object.fromEntries(
        selectedLesson.students.map((student) => [
          student.id,
          {
            status: student.attendanceStatus ?? "",
            notes: student.attendanceNotes ?? "",
          },
        ]),
      ),
    );
    setMessage(null);
  }, [selectedLesson]);

  const updateDraft = (studentId: string, patch: Partial<RetroAttendanceDraft>) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        status: current[studentId]?.status ?? "",
        notes: current[studentId]?.notes ?? "",
        ...patch,
      },
    }));
  };

  const markAllPresent = () => {
    if (!selectedLesson) return;
    setDrafts(
      Object.fromEntries(
        selectedLesson.students.map((student) => [
          student.id,
          {
            status: "present" as AttendanceStatus,
            notes: drafts[student.id]?.notes ?? student.attendanceNotes ?? "",
          },
        ]),
      ),
    );
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    try {
      if (!selectedLesson) {
        throw new Error("Select a session and past lesson before saving.");
      }
      await onSaveRetroactiveAttendance(selectedLesson.id, drafts);
      setMessageType("success");
      setMessage("Retroactive attendance saved successfully.");
    } catch (saveError) {
      setMessageType("error");
      setMessage(getClientErrorMessage(saveError, "Could not save retroactive attendance."));
    }
  };

  return (
    <section className="admin-records-panel retro-attendance-panel">
      <div className="admin-records-heading">
        <div>
          <h4>Retroactive Attendance</h4>
          <p>Record or correct attendance for past lessons only.</p>
        </div>
      </div>

      <form className="retro-attendance-form" onSubmit={handleSave}>
        <div className="retro-selector-grid">
          <label>
            Select class/session
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              required
            >
              <option value="">Choose session</option>
              {sessionOptions.map((item) => (
                <option value={item.classId} key={item.classId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Select lesson date
            <select
              value={selectedLessonId}
              onChange={(event) => setSelectedLessonId(event.target.value)}
              disabled={!selectedClassId}
              required
            >
              <option value="">Choose past lesson</option>
              {lessonsForSession.map((item) => (
                <option value={item.id} key={item.id}>
                  {formatLessonDateWithWeekday(item.lessonDate)} - {formatTime(item.startsAt)}-{formatTime(item.endsAt)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!selectedClassId && (
          <p className="retro-empty-state">Select a class/session to choose a past lesson occurrence.</p>
        )}

        {selectedClassId && lessonsForSession.length === 0 && (
          <p className="retro-empty-state">No lesson occurrences are available for this session.</p>
        )}

        {selectedClassId && lessonsForSession.length > 0 && !selectedLessonId && (
          <p className="retro-empty-state">Select a lesson date to load the student attendance list.</p>
        )}

        {selectedLesson && (
          <>
            <div className="admin-breadcrumb-row">
              <div>
                <p className="admin-breadcrumb">
                  Administration &gt; Retroactive Attendance &gt; {selectedLesson.className}
                </p>
                <h4>{selectedLessonDateLabel}</h4>
              </div>
              <button className="secondary" type="button" onClick={() => setSelectedLessonId("")}>
                Back to Retroactive Attendance
              </button>
            </div>

            <div className="retro-context-sticky">
              <div className="retro-context-card">
                <div className="retro-context-main">
                  <span className="eyebrow">Retroactive Attendance</span>
                  <h5>{selectedLesson.className}</h5>
                  <strong>{selectedLessonDateLabel}</strong>
                  <p>
                    {selectedLessonTimeLabel} - {selectedLesson.teacherName} -{" "}
                    {selectedLesson.location ?? "Room not set"}
                  </p>
                </div>
                <div className="retro-context-actions">
                  <div className="retro-summary-compact" aria-label="Attendance count summary">
                    <span className="status-pill success">Present <strong>{summary.present}</strong></span>
                    <span className="status-pill warning">Late <strong>{summary.late}</strong></span>
                    <span className="status-pill danger">Absent <strong>{summary.absent}</strong></span>
                    <span className="status-pill neutral">Excused <strong>{summary.excused}</strong></span>
                    <span className="status-pill neutral">Unset <strong>{summary.unset}</strong></span>
                  </div>
                  <button className="secondary" type="button" onClick={markAllPresent} disabled={actionLoading}>
                    Mark all present
                  </button>
                </div>
              </div>
            </div>

            {selectedLesson.students.length === 0 ? (
              <p className="retro-empty-state">No students are assigned to this session.</p>
            ) : (
              <div className="retro-student-list">
                {selectedLesson.students.map((student) => {
                  const draft = drafts[student.id] ?? { status: "", notes: "" };
                  return (
                    <article className="retro-student-row" key={student.id}>
                      <div className="retro-student-identity">
                        <button
                          className="student-name-button"
                          type="button"
                          onClick={() => onOpenStudentProfile(student.id)}
                        >
                          {student.fullName}
                        </button>
                        <p>{student.studentCode ?? "No student code"}</p>
                        {student.attendanceId && <p>Editing existing attendance record.</p>}
                      </div>
                      <label className="retro-status-field">
                        <span>Status</span>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(student.id, { status: event.target.value as AttendanceStatus | "" })
                          }
                        >
                          <option value="">Unset</option>
                          {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((status) => (
                            <option value={status} key={status}>
                              {formatAttendanceStatus(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="retro-note-field">
                        <span>Attendance note</span>
                        <input
                          value={draft.notes}
                          onChange={(event) => updateDraft(student.id, { notes: event.target.value })}
                          placeholder="Optional note"
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {message && <p className={messageType === "success" ? "management-message" : "error"}>{message}</p>}

        {selectedLesson && (
          <p className="retro-save-context">
            Saving attendance for {selectedLessonDateLabel} - {selectedLessonTimeLabel}
          </p>
        )}

        <button type="submit" disabled={!canSave}>
          {actionLoading ? "Saving attendance..." : "Save retroactive attendance"}
        </button>
      </form>
    </section>
  );
}

function UserManagementPanel({
  currentUserId,
  users,
  loading,
  message,
  onCreateUser,
  onUpdateUser,
  onRefreshUsers,
}: {
  currentUserId: string;
  users: ManagedUser[];
  loading: boolean;
  message: string | null;
  onCreateUser: (input: ManagedUserCreateInput) => Promise<void>;
  onUpdateUser: (userId: string, updates: ManagedUserUpdateInput) => Promise<void>;
  onRefreshUsers: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateUser({
      fullName,
      email,
      role,
      temporaryPassword,
      isActive,
    });
    setFullName("");
    setEmail("");
    setRole("teacher");
    setTemporaryPassword("");
    setIsActive(true);
  };

  return (
    <section className="user-management-panel">
      <div className="user-management-heading">
        <div>
          <h4>User Management</h4>
          <p>Create logins and manage app profile access. Admin users only.</p>
        </div>
        <button className="secondary" type="button" onClick={() => void onRefreshUsers()} disabled={loading}>
          Refresh
        </button>
      </div>

      {message && <p className="management-message">{message}</p>}

      <form className="user-management-form" onSubmit={handleCreate}>
        <label>
          Full name
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {(["admin", "staff", "teacher", "student"] as UserRole[]).map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temporary password
          <input
            type="password"
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active
        </label>
        <button type="submit" disabled={loading}>
          Create user
        </button>
      </form>

      <div className="managed-user-list">
        {users.length === 0 ? (
          <p className="muted">No application users loaded yet.</p>
        ) : (
          users.map((item) => (
            <article className="managed-user-row" key={item.id}>
              <div>
                <strong>{item.full_name}</strong>
                <p>{item.email}</p>
              </div>
              <label>
                Role
                <select
                  value={item.role}
                  disabled={loading || item.id === currentUserId}
                  onChange={(event) =>
                    void onUpdateUser(item.id, { role: event.target.value as UserRole })
                  }
                >
                  {(["admin", "staff", "teacher", "student"] as UserRole[]).map((roleValue) => (
                    <option value={roleValue} key={roleValue}>
                      {roleValue}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  disabled={loading || item.id === currentUserId}
                  onChange={(event) => void onUpdateUser(item.id, { isActive: event.target.checked })}
                />
                Active
              </label>
              <span className={item.is_active ? "status-pill success" : "status-pill warning"}>
                {item.is_active ? "Active" : "Inactive"}
              </span>
            </article>
          ))
        )}
      </div>
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
  onOpenStudentProfile,
  compact = false,
  showLessonDate = false,
}: {
  item: SummerSession;
  actionLoading: boolean;
  onMarkAttendance: (item: SummerSession, studentId: string, status: AttendanceStatus) => void;
  onSaveNote: (item: SummerSession, body: string) => void;
  onFinishSession: (item: SummerSession) => void;
  activityLogs: ActivityLogRow[];
  onOpenStudentProfile: (studentId: string) => void;
  compact?: boolean;
  showLessonDate?: boolean;
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
        {showLessonDate && (
          <div className="session-info-block session-date-block">
            <span className="session-info-icon" aria-hidden="true">Date</span>
            <span className="eyebrow">Date</span>
            <strong>{formatLessonDateWithWeekday(item.lessonDate)}</strong>
          </div>
        )}
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
              <RosterList
                title="Present students"
                students={presentStudents}
                emptyText="No present students marked."
                onOpenStudentProfile={onOpenStudentProfile}
              />
              <RosterList
                title="Late students"
                students={lateStudents}
                emptyText="No late students marked."
                onOpenStudentProfile={onOpenStudentProfile}
              />
              <RosterList
                title="Absent students"
                students={absentStudents}
                emptyText="No absent students."
                onOpenStudentProfile={onOpenStudentProfile}
              />
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
                        <button
                          className="student-name-button"
                          type="button"
                          onClick={() => onOpenStudentProfile(student.id)}
                        >
                          {student.fullName}
                        </button>
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
  onOpenStudentProfile,
}: {
  title: string;
  students: SessionStudent[];
  emptyText: string;
  onOpenStudentProfile: (studentId: string) => void;
}) {
  return (
    <div className="roster-column">
      <h5>{title}</h5>
      {students.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="compact-list">
          {students.map((student) => (
            <li key={student.id}>
              <button
                className="inline-student-button"
                type="button"
                onClick={() => onOpenStudentProfile(student.id)}
              >
                {student.fullName}
              </button>
            </li>
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
  const [visibleCount, setVisibleCount] = useState(12);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const groupedItems = getActivityFeedItems(logs, expandedGroups);
  const visibleGroups = getVisibleActivityGroups(groupedItems, visibleCount);
  const totalItems = groupedItems.reduce((total, group) => total + group.items.length, 0);
  const shownItems = visibleGroups.reduce((total, group) => total + group.items.length, 0);
  const canShowMore = shownItems < totalItems;

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <section className="session-group">
      <div className="section-heading compact">
        <h3>Activity Feed</h3>
        <p>Latest session actions - {shownItems} shown</p>
      </div>
      {logs.length === 0 ? (
        <div className="panel">
          <p className="muted">No activity recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="activity-feed">
            {visibleGroups.map((group) => (
              <section className="activity-date-group" key={group.dateKey}>
                <h4>{formatActivityDateHeader(group.dateKey)}</h4>
                <div className="activity-date-list">
                  {group.items.map((item) =>
                    item.kind === "single" ? (
                      <ActivityFeedRow
                        item={item.log}
                        key={item.id}
                        sessionById={sessionById}
                        teacherById={teacherById}
                      />
                    ) : (
                      <ActivityFeedGroupRow
                        item={item}
                        key={item.id}
                        onToggle={() => toggleGroup(item.id)}
                        sessionById={sessionById}
                        teacherById={teacherById}
                      />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
          {canShowMore && (
            <button className="secondary activity-show-more" type="button" onClick={() => setVisibleCount((value) => value + 12)}>
              Show more activity
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ActivityFeedRow({
  item,
  sessionById,
  teacherById,
}: {
  item: ActivityLogRow;
  sessionById: Map<string, SummerSession>;
  teacherById: Map<string, Teacher>;
}) {
  const display = getActivityDisplay(item, sessionById, teacherById);

  return (
    <article className="activity-feed-row">
      <time>{formatActivityTime(item.created_at)}</time>
      <strong>{display.teacherName}</strong>
      <span>{getActivityLabel(item.action_type)}</span>
      <span>{display.sessionLabel}</span>
    </article>
  );
}

function ActivityFeedGroupRow({
  item,
  onToggle,
  sessionById,
  teacherById,
}: {
  item: Extract<ActivityFeedItem, { kind: "group" }>;
  onToggle: () => void;
  sessionById: Map<string, SummerSession>;
  teacherById: Map<string, Teacher>;
}) {
  const firstLog = item.logs[0];
  const display = getActivityDisplay(firstLog, sessionById, teacherById);
  const uniqueTeachers = new Set(item.logs.map((log) => getActivityDisplay(log, sessionById, teacherById).teacherName));

  return (
    <article className="activity-feed-group-row">
      <button className="activity-feed-row activity-group-toggle" type="button" onClick={onToggle}>
        <time>{formatActivityTime(firstLog.created_at)}</time>
        <strong>{uniqueTeachers.size === 1 ? display.teacherName : `${uniqueTeachers.size} teachers`}</strong>
        <span>{getActivityLabel(item.actionType)} - {item.logs.length} actions</span>
        <span>{item.expanded ? "Hide details" : "View details"}</span>
      </button>
      {item.expanded && (
        <div className="activity-group-details">
          {item.logs.map((log) => (
            <ActivityFeedRow
              item={log}
              key={log.id}
              sessionById={sessionById}
              teacherById={teacherById}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function LegacyActivityFeed({
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
  onOpenStudentProfile,
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
  onOpenStudentProfile: (studentId: string) => void;
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
                    <button
                      className="student-name-button"
                      type="button"
                      onClick={() => onOpenStudentProfile(student.id)}
                    >
                      {student.fullName}
                    </button>
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

function getFriendlyRetroAttendanceSaveError(error: unknown) {
  if (isSupabasePermissionError(error)) {
    return RETRO_ATTENDANCE_SAVE_ERROR_MESSAGE;
  }

  return "Could not save retroactive attendance. Please try again.";
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

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

function searchable(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("tr-TR");
}

function normalizeGlobalStudentSearchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ");
}

function getGlobalStudentSearchSource(students: StudentRecord[]) {
  return students.flatMap((student) =>
    student.enrollments.map((enrollment) => ({
      key: `${student.id}:${enrollment.key}`,
      studentId: student.id,
      studentName: student.fullName,
      studentCode: student.studentCode,
      sessionContext: enrollment.sessionTimes.join(", ") || enrollment.className,
      teacherName: enrollment.teacherName || "Teacher not set",
      room: enrollment.room,
      matchedByCode: false,
    })),
  );
}

function getGlobalStudentSearchResults(resultsSource: GlobalStudentSearchResult[], normalizedQuery: string) {
  if (normalizedQuery.length < 2) return [];

  return resultsSource
    .map((item) => {
      const nameMatch = normalizeGlobalStudentSearchText(item.studentName).includes(normalizedQuery);
      const codeMatch = normalizeGlobalStudentSearchText(item.studentCode).includes(normalizedQuery);
      return { item: { ...item, matchedByCode: codeMatch && !nameMatch }, nameMatch, codeMatch };
    })
    .filter(({ nameMatch, codeMatch }) => nameMatch || codeMatch)
    .map(({ item }) => item)
    .sort((a, b) => {
      const nameCompare = a.studentName.localeCompare(b.studentName);
      if (nameCompare !== 0) return nameCompare;
      const sessionCompare = a.sessionContext.localeCompare(b.sessionContext);
      if (sessionCompare !== 0) return sessionCompare;
      return a.teacherName.localeCompare(b.teacherName);
    });
}

function getAdministrationNavGroups(isAdmin: boolean): AdministrationNavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard" },
        { id: "session-history", label: "Session History" },
      ],
    },
    {
      label: "Attendance",
      items: [
        { id: "retroactive-attendance", label: "Retroactive Attendance" },
        { id: "student-records", label: "Student Records" },
      ],
    },
    {
      label: "Insights",
      items: [{ id: "reports", label: "Reports" }],
    },
    {
      label: "Administration",
      items: [
        ...(isAdmin ? [{ id: "user-management" as AdminTab, label: "User Management" }] : []),
        ...(isAdmin ? [{ id: "teacher-linking" as AdminTab, label: "Teacher Login Linking" }] : []),
        { id: "teachers", label: "Teachers" },
        { id: "rooms", label: "Rooms" },
        { id: "sessions-classes", label: "Sessions / Classes" },
      ],
    },
  ];
}

function getInitialAdminTab(isAdmin: boolean): AdminTab {
  if (typeof window === "undefined") return "dashboard";
  const requestedTab = normalizeAdminTab(new URLSearchParams(window.location.search).get("adminTab"));
  if (!requestedTab) return "dashboard";
  if ((requestedTab === "user-management" || requestedTab === "teacher-linking") && !isAdmin) return "dashboard";
  return requestedTab;
}

function normalizeAdminTab(value: string | null): AdminTab | null {
  if (
    value === "dashboard" ||
    value === "overview" ||
    value === "session-history" ||
    value === "user-management" ||
    value === "teacher-linking" ||
    value === "reports" ||
    value === "student-records" ||
    value === "retroactive-attendance" ||
    value === "teachers" ||
    value === "rooms" ||
    value === "sessions-classes"
  ) {
    return value === "overview" ? "dashboard" : value;
  }

  return null;
}

function syncAdminTabToUrl(activeTab: AdminTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (activeTab === "dashboard") {
    url.searchParams.delete("adminTab");
  } else {
    url.searchParams.set("adminTab", activeTab);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function matchesTeacherSearch(teacher: Teacher, managedUserById: Map<string, ManagedUser>, searchText: string) {
  if (!searchText) return true;
  const linkedUser = teacher.user_id ? managedUserById.get(teacher.user_id) : null;
  return [teacher.display_name, teacher.employee_code, teacher.user_id, linkedUser?.full_name, linkedUser?.email].some(
    (value) => searchable(value).includes(searchText),
  );
}

function matchesRoomSearch(room: RoomRecord, searchText: string) {
  if (!searchText) return true;
  return [room.roomName, room.key, ...room.teacherNames, ...room.timeLabels].some((value) =>
    searchable(value).includes(searchText),
  );
}

function matchesStudentSearch(student: StudentRecord, searchText: string) {
  if (!searchText) return true;
  return [student.fullName, student.studentCode].some((value) => searchable(value).includes(searchText));
}

function getRoomRecords(sessions: SummerSession[]) {
  const roomMap = new Map<string, RoomRecord>();

  for (const sessionItem of sessions) {
    const roomName = sessionItem.location?.trim() || "Room not set";
    const key = normalizeSearchText(roomName) || "room-not-set";
    const record = roomMap.get(key) ?? {
      key,
      roomName,
      sessionCount: 0,
      teacherNames: [],
      timeLabels: [],
    };
    record.sessionCount += 1;
    addUnique(record.teacherNames, sessionItem.teacherName);
    addUnique(record.timeLabels, `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)}`);
    roomMap.set(key, record);
  }

  return Array.from(roomMap.values()).sort((a, b) => a.roomName.localeCompare(b.roomName));
}

function getDailyAttendanceReport(sessions: SummerSession[], date: string): DailyAttendanceReport {
  const reportSessions = sessions
    .filter((item) => item.lessonDate === date)
    .sort((a, b) => {
      const timeCompare = a.startsAt.localeCompare(b.startsAt);
      if (timeCompare !== 0) return timeCompare;
      return a.teacherName.localeCompare(b.teacherName);
    });
  const attendanceRecords = getDailyReportAttendanceRecords(reportSessions);
  const recordsByLessonId = groupReportRecords(attendanceRecords, (record) => record.lessonId);

  const sessionRows = reportSessions.map((item) => {
    const lessonRecords = recordsByLessonId.get(item.id) ?? [];
    return {
        lessonId: item.id,
        timeLabel: `${formatTime(item.startsAt)}-${formatTime(item.endsAt)}`,
        teacherName: item.teacherName,
        className: item.className,
        roomContext: item.location ?? "Room not set",
        expected: item.students.length,
        present: countReportRecordsByStatus(lessonRecords, "present"),
        late: countReportRecordsByStatus(lessonRecords, "late"),
        absent: countReportRecordsByStatus(lessonRecords, "absent"),
        excused: countReportRecordsByStatus(lessonRecords, "excused"),
        completed: hasCompletedAttendance(item),
      };
    });

  const teacherMap = new Map<string, DailyReportTeacherRow>();
  for (const row of sessionRows) {
    const session = reportSessions.find((item) => item.id === row.lessonId);
    const teacherId = session?.teacherId ?? `unassigned-${row.teacherName}`;
    const teacherRow = teacherMap.get(teacherId) ?? {
      teacherId,
      teacherName: row.teacherName,
      scheduledSessions: 0,
      attendanceCompleted: 0,
      attendanceMissing: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    };

    teacherRow.scheduledSessions += 1;
    teacherRow.attendanceCompleted += row.completed ? 1 : 0;
    teacherRow.attendanceMissing += row.completed ? 0 : 1;
    teacherRow.present += row.present;
    teacherRow.late += row.late;
    teacherRow.absent += row.absent;
    teacherRow.excused += row.excused;
    teacherMap.set(teacherId, teacherRow);
  }

  const sessionsWithAttendanceRecorded = reportSessions.filter(hasAnyAttendanceRecorded).length;

  return {
    date,
    totalScheduledSessions: sessionRows.length,
    sessionsWithAttendanceRecorded,
    sessionsWithNoAttendanceRecorded: sessionRows.length - sessionsWithAttendanceRecorded,
    totalStudentsExpected: sessionRows.reduce((total, item) => total + item.expected, 0),
    present: countReportRecordsByStatus(attendanceRecords, "present"),
    late: countReportRecordsByStatus(attendanceRecords, "late"),
    absent: countReportRecordsByStatus(attendanceRecords, "absent"),
    excused: countReportRecordsByStatus(attendanceRecords, "excused"),
    attendanceRecords,
    sessionRows,
    teacherRows: Array.from(teacherMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName)),
  };
}

function getDailyReportAttendanceRecords(sessions: SummerSession[]) {
  return sessions
    .flatMap((sessionItem) =>
      sessionItem.students
        .filter((student) => student.attendanceStatus)
        .map((student) => {
          const status = student.attendanceStatus as AttendanceStatus;
          return {
            key: `${sessionItem.id}:${student.id}:${student.attendanceId ?? status}`,
            lessonId: sessionItem.id,
            teacherId: sessionItem.teacherId ?? `unassigned-${sessionItem.teacherName}`,
            studentId: student.id,
            studentName: student.fullName,
            lessonDate: sessionItem.lessonDate,
            status,
            lateMinutes: getLateMinutes(student.attendanceArrivedAt, sessionItem.lessonDate, sessionItem.startsAt),
            sessionContext: `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)}`,
            teacherName: sessionItem.teacherName,
            roomContext: sessionItem.location ?? "Room not set",
          };
        }),
    )
    .sort(sortReportAttendanceRecords);
}

function groupReportRecords<T extends string>(
  records: DailyReportAttendanceRecord[],
  getKey: (record: DailyReportAttendanceRecord) => T,
) {
  const grouped = new Map<T, DailyReportAttendanceRecord[]>();
  for (const record of records) {
    const group = grouped.get(getKey(record)) ?? [];
    group.push(record);
    grouped.set(getKey(record), group);
  }
  return grouped;
}

function countReportRecordsByStatus(records: DailyReportAttendanceRecord[], status: AttendanceStatus) {
  return records.filter((record) => record.status === status).length;
}

function getReportDrillDownRecords(report: DailyAttendanceReport, selection: ReportDrillDownSelection) {
  return report.attendanceRecords
    .filter((record) => {
      if (record.status !== selection.status) return false;
      if (selection.lessonId && record.lessonId !== selection.lessonId) return false;
      if (selection.teacherId && record.teacherId !== selection.teacherId) return false;
      return true;
    })
    .sort(sortReportAttendanceRecords);
}

function sortReportAttendanceRecords(a: DailyReportAttendanceRecord, b: DailyReportAttendanceRecord) {
  const dateCompare = b.lessonDate.localeCompare(a.lessonDate);
  if (dateCompare !== 0) return dateCompare;
  const nameCompare = a.studentName.localeCompare(b.studentName);
  if (nameCompare !== 0) return nameCompare;
  return a.sessionContext.localeCompare(b.sessionContext);
}

function getReportDrillDownTitle(selection: ReportDrillDownSelection) {
  return `${formatAttendanceStatus(selection.status)} Students`;
}

function getReportDrillDownContext(report: DailyAttendanceReport, selection: ReportDrillDownSelection) {
  if (selection.lessonId) {
    const session = report.sessionRows.find((item) => item.lessonId === selection.lessonId);
    if (session) {
      return `${session.timeLabel} - ${session.teacherName} - ${formatLessonDateWithWeekday(report.date)}`;
    }
  }

  if (selection.teacherId) {
    const teacher = report.teacherRows.find((item) => item.teacherId === selection.teacherId);
    if (teacher) return `${teacher.teacherName} - ${formatLessonDateWithWeekday(report.date)}`;
  }

  return formatLessonDateWithWeekday(report.date);
}

function getReportRecordStatusLabel(record: DailyReportAttendanceRecord) {
  if (record.status === "late") {
    return record.lateMinutes ? `${record.lateMinutes} min late` : "Late";
  }
  return formatAttendanceStatus(record.status);
}

function exportDailyReportCsv(report: DailyAttendanceReport) {
  const rows: string[][] = [
    ["Daily Attendance Report"],
    ["Report date", formatLessonDateWithWeekday(report.date)],
    [],
    ["Summary"],
    ["Scheduled Sessions", String(report.totalScheduledSessions)],
    ["Attendance Recorded", String(report.sessionsWithAttendanceRecorded)],
    ["No Attendance", String(report.sessionsWithNoAttendanceRecorded)],
    ["Students Expected", String(report.totalStudentsExpected)],
    ["Present", String(report.present)],
    ["Late", String(report.late)],
    ["Absent", String(report.absent)],
    ["Excused", String(report.excused)],
    [],
    ["Session Breakdown"],
    ["Session Time", "Teacher", "Class / Session", "Room / Context", "Expected Students", "Present", "Late", "Absent", "Excused", "Attendance Status"],
    ...report.sessionRows.map((item) => [
      item.timeLabel,
      item.teacherName,
      item.className,
      item.roomContext,
      String(item.expected),
      String(item.present),
      String(item.late),
      String(item.absent),
      String(item.excused),
      item.completed ? "Completed" : "Missing",
    ]),
    [],
    ["Teacher Breakdown"],
    ["Teacher", "Scheduled Sessions", "Attendance Completed", "Attendance Missing", "Present", "Late", "Absent", "Excused"],
    ...report.teacherRows.map((item) => [
      item.teacherName,
      String(item.scheduledSessions),
      String(item.attendanceCompleted),
      String(item.attendanceMissing),
      String(item.present),
      String(item.late),
      String(item.absent),
      String(item.excused),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), getReportFileName(report.date, "csv"));
}

async function exportDailyReportExcel(report: DailyAttendanceReport) {
  const sheets = [
    createWorksheetXml({
      name: "Daily Summary",
      rows: [
        ["Daily Attendance Report"],
        ["Report date", formatLessonDateWithWeekday(report.date)],
        [],
        ["Metric", "Value"],
        ["Scheduled Sessions", report.totalScheduledSessions],
        ["Attendance Recorded", report.sessionsWithAttendanceRecorded],
        ["No Attendance", report.sessionsWithNoAttendanceRecorded],
        ["Students Expected", report.totalStudentsExpected],
        ["Present", report.present],
        ["Late", report.late],
        ["Absent", report.absent],
        ["Excused", report.excused],
      ],
      boldRows: new Set([1, 4]),
      columnWidths: [26, 18],
    }),
    createWorksheetXml({
      name: "Session Breakdown",
      rows: [
        ["Session Time", "Teacher", "Class / Session", "Room / Context", "Expected Students", "Present", "Late", "Absent", "Excused", "Attendance Status"],
        ...report.sessionRows.map((item) => [
          item.timeLabel,
          item.teacherName,
          item.className,
          item.roomContext,
          item.expected,
          item.present,
          item.late,
          item.absent,
          item.excused,
          item.completed ? "Completed" : "Missing",
        ]),
      ],
      boldRows: new Set([1]),
      freezeHeader: true,
      autoFilter: true,
      columnWidths: [16, 22, 34, 18, 18, 12, 12, 12, 12, 20],
    }),
    createWorksheetXml({
      name: "Teacher Breakdown",
      rows: [
        ["Teacher", "Scheduled Sessions", "Attendance Completed", "Attendance Missing", "Present", "Late", "Absent", "Excused"],
        ...report.teacherRows.map((item) => [
          item.teacherName,
          item.scheduledSessions,
          item.attendanceCompleted,
          item.attendanceMissing,
          item.present,
          item.late,
          item.absent,
          item.excused,
        ]),
      ],
      boldRows: new Set([1]),
      freezeHeader: true,
      autoFilter: true,
      columnWidths: [24, 20, 22, 20, 12, 12, 12, 12],
    }),
  ];

  const blob = createXlsxWorkbook(sheets);
  downloadBlob(blob, getReportFileName(report.date, "xlsx"));
}

function escapeCsvCell(value: string) {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getReportFileName(date: string, extension: "csv" | "xlsx") {
  return `attendance-report-${date}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type WorksheetDefinition = {
  name: string;
  xml: string;
};

function createWorksheetXml({
  autoFilter = false,
  boldRows,
  columnWidths,
  freezeHeader = false,
  name,
  rows,
}: {
  autoFilter?: boolean;
  boldRows: Set<number>;
  columnWidths: number[];
  freezeHeader?: boolean;
  name: string;
  rows: Array<Array<string | number>>;
}): WorksheetDefinition {
  const lastColumn = getExcelColumnName(Math.max(...rows.map((row) => row.length), 1));
  const lastRow = Math.max(rows.length, 1);
  const columnXml = columnWidths.length
    ? `<cols>${columnWidths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";
  const sheetViews = freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : "";
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => createCellXml(value, `${getExcelColumnName(columnIndex + 1)}${rowNumber}`, boldRows.has(rowNumber)))
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  const autoFilterXml = autoFilter && rows.length > 0 ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` : "";

  return {
    name,
    xml:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      sheetViews +
      columnXml +
      `<sheetData>${sheetRows}</sheetData>` +
      autoFilterXml +
      "</worksheet>",
  };
}

function createCellXml(value: string | number, ref: string, bold: boolean) {
  const style = bold ? ' s="1"' : "";
  if (typeof value === "number") {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
}

function createXlsxWorkbook(sheets: WorksheetDefinition[]) {
  const files: Array<{ name: string; data: Uint8Array }> = [
    { name: "[Content_Types].xml", data: encodeUtf8(createContentTypesXml(sheets.length)) },
    { name: "_rels/.rels", data: encodeUtf8(createPackageRelsXml()) },
    { name: "xl/workbook.xml", data: encodeUtf8(createWorkbookXml(sheets)) },
    { name: "xl/_rels/workbook.xml.rels", data: encodeUtf8(createWorkbookRelsXml(sheets.length)) },
    { name: "xl/styles.xml", data: encodeUtf8(createStylesXml()) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encodeUtf8(sheet.xml),
    })),
  ];

  return new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function createContentTypesXml(sheetCount: number) {
  const worksheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    worksheets +
    "</Types>"
  );
}

function createPackageRelsXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>"
  );
}

function createWorkbookXml(sheets: WorksheetDefinition[]) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<sheets>" +
    sheets
      .map((sheet, index) => `<sheet name="${escapeXmlAttribute(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("") +
    "</sheets></workbook>"
  );
}

function createWorkbookRelsXml(sheetCount: number) {
  const worksheetRels = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    worksheetRels +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

function createStylesXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    "</styleSheet>"
  );
}

function createZip(files: Array<{ name: string; data: Uint8Array }>) {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const { date, time } = getZipDateTime(new Date());

  for (const file of files) {
    const nameBytes = encodeUtf8(file.name);
    const crc = getCrc32(file.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    chunks.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }

  const centralStart = offset;
  const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);

  return concatenateUint8Arrays([...chunks, ...centralDirectory, endRecord]);
}

function getZipDateTime(value: Date) {
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);
  const date = ((value.getFullYear() - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  return { date, time };
}

function getCrc32(data: Uint8Array) {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table: Uint32Array | null = null;

function getCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

function concatenateUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function getExcelColumnName(columnNumber: number) {
  let name = "";
  let value = columnNumber;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXml(value).replace(/"/g, "&quot;");
}

function getSessionClassRecords(sessions: SummerSession[]) {
  const classMap = new Map<
    string,
    {
      classId: string;
      className: string;
      teacherName: string;
      room: string | null;
      timeLabels: string[];
      lessonCount: number;
    }
  >();

  for (const sessionItem of sessions) {
    const record = classMap.get(sessionItem.classId) ?? {
      classId: sessionItem.classId,
      className: sessionItem.className,
      teacherName: sessionItem.teacherName,
      room: sessionItem.location,
      timeLabels: [],
      lessonCount: 0,
    };
    record.lessonCount += 1;
    addUnique(record.timeLabels, `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)}`);
    classMap.set(sessionItem.classId, record);
  }

  return Array.from(classMap.values()).sort((a, b) => a.className.localeCompare(b.className));
}

function getStudentRecords(sessions: SummerSession[]) {
  const studentMap = new Map<string, StudentRecord>();

  for (const sessionItem of sessions) {
    for (const student of sessionItem.students) {
      const record = studentMap.get(student.id) ?? {
        id: student.id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        enrollments: [],
        overallSummary: createEmptyAttendanceSummary(),
      };
      const enrollmentKey = `${sessionItem.classId}:${sessionItem.teacherId ?? "unassigned"}:${sessionItem.location ?? ""}`;
      let enrollment = record.enrollments.find((item) => item.key === enrollmentKey);

      if (!enrollment) {
        enrollment = {
          key: enrollmentKey,
          classId: sessionItem.classId,
          className: sessionItem.className,
          teacherName: sessionItem.teacherName,
          room: sessionItem.location,
          sessionTimes: [],
          history: [],
          summary: createEmptyAttendanceSummary(),
        };
        record.enrollments.push(enrollment);
      }

      addUnique(enrollment.sessionTimes, `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)}`);

      if (hasLessonOccurred(sessionItem)) {
        const historyItem = {
          lessonId: sessionItem.id,
          lessonDate: sessionItem.lessonDate,
          className: sessionItem.className,
          timeLabel: `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)}`,
          teacherName: sessionItem.teacherName,
          room: sessionItem.location,
          attendanceStatus: student.attendanceStatus,
          lateMinutes: getLateMinutes(student.attendanceArrivedAt, sessionItem.lessonDate, sessionItem.startsAt),
          note: sessionItem.note,
        };
        enrollment.history.push(historyItem);
        addToAttendanceSummary(enrollment.summary, student.attendanceStatus, historyItem.lateMinutes);
        addToAttendanceSummary(record.overallSummary, student.attendanceStatus, historyItem.lateMinutes);
      }

      studentMap.set(student.id, record);
    }
  }

  for (const record of studentMap.values()) {
    record.enrollments.sort((a, b) => a.className.localeCompare(b.className));
    for (const enrollment of record.enrollments) {
      enrollment.history.sort((a, b) => {
        const dateCompare = a.lessonDate.localeCompare(b.lessonDate);
        if (dateCompare !== 0) return dateCompare;
        return a.timeLabel.localeCompare(b.timeLabel);
      });
    }
  }

  return Array.from(studentMap.values()).sort((a, b) => {
    const nameCompare = a.fullName.localeCompare(b.fullName);
    if (nameCompare !== 0) return nameCompare;
    return (a.studentCode ?? "").localeCompare(b.studentCode ?? "");
  });
}

function getStudentProfileTimeline(student: StudentRecord) {
  return student.enrollments
    .flatMap((enrollment) => enrollment.history)
    .sort((a, b) => {
      const dateCompare = b.lessonDate.localeCompare(a.lessonDate);
      if (dateCompare !== 0) return dateCompare;
      return b.timeLabel.localeCompare(a.timeLabel);
    });
}

function getStudentProfileSessionContexts(student: StudentRecord) {
  const contextMap = new Map<
    string,
    {
      key: string;
      className: string;
      teacherName: string;
      room: string | null;
      timeLabel: string;
    }
  >();

  for (const enrollment of student.enrollments) {
    const timeLabel = enrollment.sessionTimes.join(", ") || "Session time unavailable";
    const key = `${enrollment.className}:${enrollment.teacherName}:${enrollment.room ?? ""}:${timeLabel}`;
    if (contextMap.has(key)) continue;
    contextMap.set(key, {
      key,
      className: enrollment.className,
      teacherName: enrollment.teacherName,
      room: enrollment.room,
      timeLabel,
    });
  }

  return Array.from(contextMap.values());
}

function getStudentAttendanceRateLabel(summary: AttendanceSummary) {
  if (summary.recorded === 0) return "0%";
  const attended = summary.present + summary.late + summary.excused;
  return `${Math.round((attended / summary.recorded) * 100)}%`;
}

function getTimelineStatusLabel(item: StudentLessonHistoryItem) {
  if (item.attendanceStatus === "late") {
    return item.lateMinutes ? `${item.lateMinutes} min late` : "Late";
  }
  return formatAttendanceStatus(item.attendanceStatus);
}

function getShortStudentTimelineContext(item: StudentLessonHistoryItem) {
  return `${item.timeLabel} · ${item.room ?? "Room not set"}`;
}

function getStudentTimelineStatusKind(status: AttendanceStatus | null) {
  if (status === "absent") return "danger";
  if (status === "late") return "warning";
  if (status === "present" || status === "excused") return "success";
  return "warning";
}

function getAttentionNeededItems(students: StudentRecord[]) {
  const items: AttentionNeededItem[] = [];

  for (const student of students) {
    for (const enrollment of student.enrollments) {
      const item = getEnrollmentAttentionNeededItem(student, enrollment);
      if (item) items.push(item);
    }
  }

  return items.sort((a, b) => {
    if (b.consecutiveAbsences !== a.consecutiveAbsences) {
      return b.consecutiveAbsences - a.consecutiveAbsences;
    }
    if (b.totalLateMinutes !== a.totalLateMinutes) {
      return b.totalLateMinutes - a.totalLateMinutes;
    }
    if (b.lateCount !== a.lateCount) {
      return b.lateCount - a.lateCount;
    }
    return a.studentName.localeCompare(b.studentName);
  });
}

function getEnrollmentAttentionNeededItem(student: StudentRecord, enrollment: StudentEnrollmentRecord) {
  const recordedHistory = getUniqueRecordedEnrollmentHistory(enrollment.history);
  if (recordedHistory.length === 0) return null;

  const consecutiveAbsences = getCurrentConsecutiveAbsences(recordedHistory);
  const lateEntries = recordedHistory.filter((item) => item.attendanceStatus === "late");
  const lateCount = lateEntries.length;
  const totalLateMinutes = lateEntries.reduce((sum, item) => sum + (item.lateMinutes ?? 0), 0);
  const reasons = getAttentionReasons(consecutiveAbsences, totalLateMinutes, lateCount);

  if (reasons.length === 0) return null;

  return {
    id: `${student.id}:${enrollment.key}`,
    studentId: student.id,
    studentName: student.fullName,
    sessionContext: getAttentionSessionContext(enrollment),
    roomLabel: enrollment.room ?? "Room not set",
    teacherName: enrollment.teacherName,
    primaryReason: reasons[0],
    secondaryReasons: reasons.slice(1),
    consecutiveAbsences,
    totalLateMinutes,
    lateCount,
  };
}

function getUniqueRecordedEnrollmentHistory(history: StudentLessonHistoryItem[]) {
  const uniqueByLessonId = new Map<string, StudentLessonHistoryItem>();

  for (const item of history) {
    if (!item.attendanceStatus) continue;
    if (!uniqueByLessonId.has(item.lessonId)) {
      uniqueByLessonId.set(item.lessonId, item);
    }
  }

  return Array.from(uniqueByLessonId.values()).sort((a, b) => {
    const dateCompare = a.lessonDate.localeCompare(b.lessonDate);
    if (dateCompare !== 0) return dateCompare;
    return a.timeLabel.localeCompare(b.timeLabel);
  });
}

function getCurrentConsecutiveAbsences(history: StudentLessonHistoryItem[]) {
  let streak = 0;

  for (const item of history) {
    if (item.attendanceStatus === "absent") {
      streak += 1;
    } else {
      streak = 0;
    }
  }

  return streak;
}

function getAttentionReasons(consecutiveAbsences: number, totalLateMinutes: number, lateCount: number) {
  const reasons: AttentionReason[] = [];

  if (consecutiveAbsences >= 2) {
    reasons.push({
      kind: "absence-streak",
      label: `Absent for ${consecutiveAbsences} consecutive sessions`,
    });
  }

  if (totalLateMinutes >= 45) {
    reasons.push({
      kind: "late-minutes",
      label: `${totalLateMinutes} total late minutes`,
    });
  }

  if (lateCount >= 3) {
    reasons.push({
      kind: "late-count",
      label: `Late ${lateCount} times`,
    });
  }

  return reasons;
}

function getAttentionSessionContext(enrollment: StudentEnrollmentRecord) {
  return enrollment.sessionTimes.join(", ") || enrollment.className;
}

function getRetroSessionOptions(sessions: SummerSession[]) {
  const optionMap = new Map<string, { classId: string; label: string; sortKey: string }>();

  for (const item of sessions) {
    if (optionMap.has(item.classId)) continue;
    const timeLabel = `${formatTime(item.startsAt)}-${formatTime(item.endsAt)}`;
    const roomLabel = item.location ?? "Room not set";
    optionMap.set(item.classId, {
      classId: item.classId,
      label: `${item.className} - ${item.teacherName} - ${roomLabel} - ${timeLabel}`,
      sortKey: `${item.className}-${item.teacherName}-${roomLabel}-${timeLabel}`,
    });
  }

  return Array.from(optionMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function getRetroDraftSummary(drafts: Record<string, RetroAttendanceDraft>, students: SessionStudent[]) {
  const summary = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    unset: 0,
    recorded: 0,
  };

  for (const student of students) {
    const status = drafts[student.id]?.status;
    if (!status) {
      summary.unset += 1;
      continue;
    }

    summary.recorded += 1;
    if (status === "present") summary.present += 1;
    if (status === "late") summary.late += 1;
    if (status === "absent") summary.absent += 1;
    if (status === "excused") summary.excused += 1;
  }

  return summary;
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

function createEmptyAttendanceSummary(): AttendanceSummary {
  return {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    recorded: 0,
    lateMinutes: 0,
  };
}

function addToAttendanceSummary(summary: AttendanceSummary, status: AttendanceStatus | null, lateMinutes: number | null = null) {
  if (!status) return;
  summary.recorded += 1;
  if (status === "present") summary.present += 1;
  if (status === "late") {
    summary.late += 1;
    summary.lateMinutes += lateMinutes ?? 0;
  }
  if (status === "absent") summary.absent += 1;
  if (status === "excused") summary.excused += 1;
}

function getLateMinutes(arrivedAt: string | null, lessonDate: string, startsAt: string) {
  if (!arrivedAt) return null;

  const arrivedDate = new Date(arrivedAt);
  const scheduledDate = new Date(`${lessonDate}T${startsAt}`);
  const diffMinutes = Math.round((arrivedDate.getTime() - scheduledDate.getTime()) / 60_000);

  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) return null;
  return diffMinutes;
}

function hasLessonOccurred(item: SummerSession) {
  const today = getTodayDate();
  if (item.lessonDate < today) return true;
  if (item.lessonDate > today) return false;
  return getCurrentLocalMinutes() >= timeToMinutes(item.startsAt);
}

function formatAttendanceStatus(status: AttendanceStatus | null) {
  if (status === "present") return "Attended";
  if (status === "late") return "Late";
  if (status === "absent") return "Absent";
  if (status === "excused") return "Excused";
  return "Not recorded";
}

function hasCompletedAttendance(item: SummerSession) {
  return item.students.length > 0 && item.students.every((student) => student.attendanceStatus);
}

function hasAnyAttendanceRecorded(item: SummerSession) {
  return item.students.some((student) => student.attendanceStatus);
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

function getHistorySessionsByDate(sessions: SummerSession[], selectedDate: string) {
  return sessions
    .filter((item) => item.lessonDate === selectedDate)
    .sort((a, b) => `${a.startsAt}-${a.teacherName}`.localeCompare(`${b.startsAt}-${b.teacherName}`));
}

function getDefaultSummerSchoolHistoryDate(today: string) {
  if (today < SUMMER_SCHOOL_START_DATE) return SUMMER_SCHOOL_START_DATE;
  if (today > SUMMER_SCHOOL_END_DATE) return getMostRecentSummerSchoolDateOnOrBefore(SUMMER_SCHOOL_END_DATE);
  return getMostRecentSummerSchoolDateOnOrBefore(today);
}

function getMostRecentSummerSchoolDateOnOrBefore(dateValue: string) {
  for (let offset = 0; offset >= -7; offset -= 1) {
    const candidate = getDateOffset(dateValue, offset);
    if (
      candidate >= SUMMER_SCHOOL_START_DATE &&
      candidate <= SUMMER_SCHOOL_END_DATE &&
      isSummerSchoolActiveDate(candidate)
    ) {
      return candidate;
    }
  }

  return SUMMER_SCHOOL_START_DATE;
}

function getActiveSessions(sessions: SummerSession[]) {
  return sessions.filter((item) => item.startedAt && !item.finishedAt);
}

function getTeacherSessionCards(sessions: SummerSession[]) {
  const groupedByClass = new Map<string, SummerSession[]>();

  for (const item of sessions) {
    const group = groupedByClass.get(item.classId) ?? [];
    group.push(item);
    groupedByClass.set(item.classId, group);
  }

  return Array.from(groupedByClass.values())
    .map((group) => pickTeacherSessionCard(group))
    .sort((a, b) => `${a.startsAt}-${a.location ?? ""}-${a.className}`.localeCompare(
      `${b.startsAt}-${b.location ?? ""}-${b.className}`,
    ));
}

function pickTeacherSessionCard(classLessons: SummerSession[]) {
  const sortedLessons = [...classLessons].sort((a, b) => {
    const dateCompare = a.lessonDate.localeCompare(b.lessonDate);
    if (dateCompare !== 0) return dateCompare;
    return a.startsAt.localeCompare(b.startsAt);
  });
  const today = getTodayDate();

  return (
    sortedLessons.find((item) => item.startedAt && !item.finishedAt) ??
    sortedLessons.find((item) => item.lessonDate === today) ??
    sortedLessons.find((item) => item.lessonDate > today) ??
    sortedLessons[sortedLessons.length - 1]
  );
}

function getNextTeacherSelectedSessionId(
  currentId: string | null,
  allLessonOccurrences: SummerSession[],
  sessionCards: SummerSession[],
) {
  if (currentId && sessionCards.some((item) => item.id === currentId)) return currentId;

  const currentLesson = currentId ? allLessonOccurrences.find((item) => item.id === currentId) : null;
  const matchingClassCard = currentLesson
    ? sessionCards.find((item) => item.classId === currentLesson.classId)
    : null;

  return matchingClassCard?.id ?? sessionCards[0]?.id ?? null;
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

function getTurkeyTodayUtcRange() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const turkeyDate = formatter.format(new Date());
  const startUtc = new Date(`${turkeyDate}T00:00:00+03:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

function getClientErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function isAdminProfile(profile: Pick<UserProfile, "role"> | null | undefined) {
  return normalizeUserRole(profile?.role) === "admin";
}

function isCoordinatorProfile(profile: Pick<UserProfile, "role"> | null | undefined) {
  const role = normalizeUserRole(profile?.role);
  return role === "admin" || role === "staff";
}

function normalizeUserRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "staff" || normalized === "teacher" || normalized === "student") {
    return normalized;
  }

  return null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatLessonDateWithWeekday(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTimelineDate(value: string) {
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

function formatActivityTimestamp(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPrintDateTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getTeacherPresenceStatus(lastActiveAt: string | null, nowMs = Date.now()) {
  if (!lastActiveAt) return { label: "Offline", kind: "offline" };
  const activeMs = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(activeMs)) return { label: "Offline", kind: "offline" };
  const ageMs = nowMs - activeMs;
  if (ageMs <= 3 * 60 * 1000) return { label: "Online now", kind: "online" };
  if (ageMs <= 15 * 60 * 1000) return { label: "Recently active", kind: "recent" };
  return { label: "Offline", kind: "offline" };
}

function getActivityFeedItems(logs: ActivityLogRow[], expandedGroups: Set<string>) {
  const items: ActivityFeedItem[] = [];
  let lateEntryBuffer: ActivityLogRow[] = [];

  const flushLateEntryBuffer = () => {
    if (lateEntryBuffer.length === 0) return;
    if (lateEntryBuffer.length === 1) {
      items.push({ kind: "single", id: lateEntryBuffer[0].id, log: lateEntryBuffer[0] });
    } else {
      const id = `late-entry-${lateEntryBuffer[0].id}-${lateEntryBuffer[lateEntryBuffer.length - 1].id}`;
      items.push({
        kind: "group",
        id,
        actionType: "late_entry_updated",
        logs: lateEntryBuffer,
        expanded: expandedGroups.has(id),
      });
    }
    lateEntryBuffer = [];
  };

  for (const log of logs) {
    if (log.action_type === "late_entry_updated") {
      const previousLog = lateEntryBuffer[lateEntryBuffer.length - 1];
      if (previousLog && !canGroupLateEntryActivity(previousLog, log)) {
        flushLateEntryBuffer();
      }
      lateEntryBuffer.push(log);
      continue;
    }

    flushLateEntryBuffer();
    items.push({ kind: "single", id: log.id, log });
  }

  flushLateEntryBuffer();

  const groups = new Map<string, ActivityFeedItem[]>();
  for (const item of items) {
    const dateKey = getActivityItemFirstLog(item).created_at.slice(0, 10);
    const groupItems = groups.get(dateKey) ?? [];
    groupItems.push(item);
    groups.set(dateKey, groupItems);
  }

  return Array.from(groups.entries()).map(([dateKey, groupItems]) => ({ dateKey, items: groupItems }));
}

function canGroupLateEntryActivity(previousLog: ActivityLogRow, nextLog: ActivityLogRow) {
  if (previousLog.created_at.slice(0, 10) !== nextLog.created_at.slice(0, 10)) return false;
  const previousTime = new Date(previousLog.created_at).getTime();
  const nextTime = new Date(nextLog.created_at).getTime();
  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) return false;
  return Math.abs(previousTime - nextTime) <= 10 * 60 * 1000;
}

function getVisibleActivityGroups(
  groups: Array<{ dateKey: string; items: ActivityFeedItem[] }>,
  visibleCount: number,
) {
  const visibleGroups: Array<{ dateKey: string; items: ActivityFeedItem[] }> = [];
  let remaining = visibleCount;

  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    if (items.length > 0) {
      visibleGroups.push({ dateKey: group.dateKey, items });
      remaining -= items.length;
    }
  }

  return visibleGroups;
}

function getActivityItemFirstLog(item: ActivityFeedItem) {
  return item.kind === "single" ? item.log : item.logs[0];
}

function getActivityDisplay(
  log: ActivityLogRow,
  sessionById: Map<string, SummerSession>,
  teacherById: Map<string, Teacher>,
) {
  const sessionItem = log.lesson_id ? sessionById.get(log.lesson_id) : null;
  const teacherName =
    sessionItem?.teacherName ??
    (log.teacher_id ? teacherById.get(log.teacher_id)?.display_name : null) ??
    "Unknown teacher";
  const sessionLabel = sessionItem
    ? `${formatTime(sessionItem.startsAt)}-${formatTime(sessionItem.endsAt)} - ${sessionItem.location ?? "Room not set"}`
    : "Session details unavailable";

  return { teacherName, sessionLabel };
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatActivityDateHeader(dateKey: string) {
  const today = getTodayDate();
  const yesterday = getDateOffset(today, -1);
  const date = new Date(`${dateKey}T00:00:00`);
  const monthDay = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
  }).format(date);

  if (dateKey === today) return `TODAY - ${monthDay.toUpperCase()}`;
  if (dateKey === yesterday) return `YESTERDAY - ${monthDay.toUpperCase()}`;

  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(date);
  return `${weekday.toUpperCase()} - ${monthDay.toUpperCase()}`;
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
