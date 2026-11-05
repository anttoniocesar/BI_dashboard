"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import type {CourseDraft} from "@/types/course";
import { useStudioSession } from "@/components/studio/StudioSession";
import { courseCatalog } from "@/lib/courses/catalog";
import { dataConfiguration, emptyAdminState } from "@/lib/data/config";
import { LocalDemoAdminRepository } from "@/lib/repositories/LocalDemoAdminRepository";
import { HttpAdminRepository } from "@/lib/repositories/HttpAdminRepository";
import type { AdminCommand } from "@/lib/admin/session";
import type { AdminState } from "@/types/admin";
import {courseForNewGrant} from "@/lib/courses/versions";
function useAdminState() {
  const studio = useStudioSession();
  const [configuration] = useState(dataConfiguration);
  const catalogRef=useRef<CourseDraft[]>([]);
  const [repository] = useState(() => configuration.mode === "demo" ? new LocalDemoAdminRepository(() => window.localStorage,()=>catalogRef.current) : new HttpAdminRepository());
  const courses = useMemo(() => courseCatalog(studio.courses), [studio.courses]);
  catalogRef.current=courses;
  const [state, setState] = useState<AdminState>(emptyAdminState);
  const [ready, setReady] = useState(configuration.mode !== "demo");
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    if (!(repository instanceof LocalDemoAdminRepository)) return;
    let active = true;
    void repository.load().then(restored => {
      if (!active) return;
      setState(restored); setStorageNotice(repository.notice); setReady(true);
    });
    return () => { active = false; };
  }, [repository]);
  const replaceState = useCallback((next: AdminState) => setState(next), []);
  async function execute(command: AdminCommand, actorId: string) {
    if(command.type==="grant-course")command={...command,courseId:courseForNewGrant(courses,state,command.userServiceId,command.courseId).id};
    const result = await repository.execute(command, actorId, courses.filter(course=>command.type!=="grant-course" || course.status==="published").map(course => course.id)); setState(result.state);
    if (repository instanceof LocalDemoAdminRepository) setStorageNotice(repository.notice);
    return result;
  }
  async function resetDemo(actorId: string) {
    if (!(repository instanceof LocalDemoAdminRepository)) throw new Error("Restauração disponível somente no modo demo.");
    setState(await repository.reset(actorId)); setStorageNotice(repository.notice);
  }
  return { state, courses, execute, replaceState, configuration, ready, storageNotice, resetDemo };
}
const Context = createContext<ReturnType<typeof useAdminState> | null>(null);
export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const session = useAdminState();
  // Restore demo identities/permissions before mounting AuthSessionProvider.
  return <Context.Provider value={session}>{session.ready ? children : <main role="status">Carregando dados administrativos...</main>}</Context.Provider>;
}
export function useAdminSession() { const session = useContext(Context); if (!session) throw new Error("Sessão administrativa ausente."); return session; }
