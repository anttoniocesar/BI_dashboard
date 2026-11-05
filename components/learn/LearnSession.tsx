"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStudioSession } from "@/components/studio/StudioSession";
import { demoExercises } from "@/data/courses/neural-demo";
import { courseCatalog } from "@/lib/courses/catalog";
import { studentCourses } from "@/lib/learn/courses";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useCurrentUser } from "@/components/auth/AuthSession";
import { requireCourseAccess } from "@/lib/auth/access";
import { hasPermission } from "@/lib/admin/permissions";
import { studentIdentity } from "@/lib/admin/session";
import { buildDefinition } from "@/lib/studio/exerciseDraft";
import { VolatileExerciseRepository } from "@/lib/storage/VolatileExerciseRepository";
import { HttpExerciseRepository } from "@/lib/repositories/HttpExerciseRepository";
import type { ExerciseRepository } from "@/types/exercise-repository";
import { completeActivity, initialProgress } from "@/lib/learn/progress";
import type { CourseDraft } from "@/types/course";
import type { ExerciseDefinition } from "@/types/exercise";
import type { StudentCourseProgress } from "@/types/student-progress";
import { HttpLearnRepository } from "@/lib/repositories/HttpLearnRepository";
import { InMemoryLearnRepository } from "@/lib/repositories/InMemoryLearnRepository";
import type { LearnRepository } from "@/lib/repositories/LearnRepository";
import type { ProgressRow } from "@/lib/repositories/LearnRepository";
import { ProgressQueue } from "@/lib/repositories/ProgressQueue";
import type { ProgressWrite } from "@/lib/data/validation";

function useLearnState() {
  const studio = useStudioSession();
  const { state: admin, configuration } = useAdminSession();
  const user = useCurrentUser();
  const userId = user?.id ?? "";
  const canStudy = hasPermission(user, "course:study");
  const adminRef = useRef(admin); adminRef.current = admin;
  const currentUserId = useRef(userId); currentUserId.current = userId;
  const [remoteTeachers, setRemoteTeachers] = useState<{ courseId: string; name: string }[]>([]);
  const [remoteRows, setRemoteRows] = useState<ProgressRow[]>([]);
  const projectedIdentity = user ? studentIdentity(admin, user.id) : null;
  const identity = projectedIdentity && configuration.mode === "supabase" ? { ...projectedIdentity, caption: "Aluno" } : projectedIdentity;
  const teachers = configuration.mode === "supabase" ? remoteTeachers : admin.courseTeachers.flatMap(link => {
    const user = admin.users.find(item => item.id === link.userId && item.status === "active" && item.roles.includes("teacher"));
    return user ? [{ courseId: link.courseId, name: user.name }] : [];
  });
  const [progressByUser, setProgress] = useState<Record<string, Record<string, StudentCourseProgress>>>({});
  const progressRef = useRef(progressByUser); progressRef.current = progressByUser;
  const dataRepositories = useRef(new Map<string, LearnRepository>());
  const queues = useRef(new Map<string, ProgressQueue>());
  const [statuses,setStatuses] = useState<Record<string,string>>({});
  const [loadedUser,setLoadedUser] = useState("");
  const [loadError,setLoadError] = useState("");
  const [loadVersion,setLoadVersion] = useState(0);
  if (userId && !dataRepositories.current.has(userId)) {
    const repo = configuration.mode === "demo" ? new InMemoryLearnRepository(() => adminRef.current,userId) : new HttpLearnRepository(userId);
    dataRepositories.current.set(userId,repo);
    queues.current.set(userId,new ProgressQueue(repo,() => currentUserId.current===userId,status => setStatuses(previous => ({ ...previous,[userId]:status }))));
  }
  useEffect(() => {
    if (configuration.mode !== "supabase" || !userId || !canStudy) return;
    let cancelled=false;
    setLoadError(""); setLoadedUser("");
    (async () => { await queues.current.get(userId)!.flush(); return dataRepositories.current.get(userId)!.load(); })().then(data => {
      if (cancelled) return;
      setProgress(previous => { const next={ ...previous,[userId]:data.progress }; progressRef.current=next; return next; });
      setRemoteTeachers(data.teachers); setRemoteRows(data.rows ?? []); setLoadedUser(userId);
    }).catch(() => { if (!cancelled) setLoadError("Não foi possível carregar seus cursos e progresso."); });
    return () => { cancelled=true; };
  }, [userId,canStudy,configuration.mode,loadVersion]);
  const progress = progressByUser[userId] ?? {};
  const recordProgress = useCallback((input: ProgressWrite) => {
    if (configuration.mode !== "supabase") return;
    setRemoteRows(rows => {
      const previous = rows.find(row => row.course_id === input.courseId && row.chapter_id === input.chapterId && row.activity_id === input.activityId);
      const now = new Date().toISOString();
      return [...rows.filter(row => row !== previous), { course_id:input.courseId,chapter_id:input.chapterId,activity_id:input.activityId,status:previous?.status === "completed" ? "completed" : input.status,updated_at:now,completed_at:previous?.completed_at ?? (input.status === "completed" ? now : null) }];
    });
  },[configuration.mode]);
  const repositories = useRef(new Map<string, ExerciseRepository>());
  if (!repositories.current.has(userId)) repositories.current.set(userId, configuration.mode === "supabase" ? new HttpExerciseRepository(userId, () => currentUserId.current) : new VolatileExerciseRepository());
  const repository = repositories.current.get(userId)!;
  // Only execution definitions cross into the learner screens, never author drafts.
  const sources = useMemo(() => {
    const exercises: Record<string, ExerciseDefinition> = { ...demoExercises };
    Object.assign(exercises,studio.definitions);
    for (const entry of Object.values(studio.exercises)) exercises[entry.id] = buildDefinition(entry.draft, true);
    return { courses: studentCourses(courseCatalog(studio.courses), admin, user), exercises };
  }, [studio.courses, studio.exercises, studio.definitions, admin, user]);
  const finish = useCallback((course: CourseDraft, chapterId: string, activityId: string) => {
    if (!user || !requireCourseAccess(admin, user, course.id)) return;
    const before = progressRef.current[userId]?.[course.id] ?? initialProgress(course.id);
    if (completeActivity(course,before,chapterId,activityId) === before) return;
    queues.current.get(userId)?.enqueue({ courseId:course.id,chapterId,activityId,status:"completed" });
    recordProgress({ courseId:course.id,chapterId,activityId,status:"completed" });
    setProgress(all => {
      const previous = all[userId] ?? {};
      const current = previous[course.id] ?? initialProgress(course.id);
      const next = completeActivity(course, current, chapterId, activityId);
      return current === next ? all : { ...all, [userId]: { ...previous, [course.id]: next } };
    });
  }, [user, userId, admin, recordProgress]);
  const visit = useCallback((courseId: string, chapterId: string, activityId = "") => {
    if (!user || !requireCourseAccess(admin, user, courseId)) return;
    queues.current.get(userId)?.enqueue({ courseId,chapterId,activityId,status:"in-progress" });
    recordProgress({ courseId,chapterId,activityId,status:"in-progress" });
    setProgress(all => {
      const previous = all[userId] ?? {};
      const current = previous[courseId] ?? initialProgress(courseId);
      return current.currentChapterId === chapterId ? all : { ...all, [userId]: { ...previous, [courseId]: { ...current, currentChapterId: chapterId } } };
    });
  }, [user, userId, admin, recordProgress]);
  const getDemoProgressRows = (id: string) => {
    const data = dataRepositories.current.get(id);
    return data instanceof InMemoryLearnRepository ? data.getRows() : [];
  };
  return { ...sources, identity, teachers, progress, repository, finish, visit, getDemoProgressRows,
    progressRows: configuration.mode === "demo" ? getDemoProgressRows(userId) : remoteRows,
    ready: configuration.mode === "demo" || loadedUser===userId,
    loadError, retryLoad: () => setLoadVersion(value => value+1),
    progressStatus: configuration.mode === "supabase" ? statuses[userId] ?? "" : "",
    retryProgress: () => { void queues.current.get(userId)?.flush(); },
  };
}
const Context = createContext<ReturnType<typeof useLearnState> | null>(null);
export const LearnPreviewProvider = Context.Provider;
export function LearnSessionProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={useLearnState()}>{children}</Context.Provider>;
}
export function useLearnSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Sessão de aprendizado ausente.");
  return session;
}
