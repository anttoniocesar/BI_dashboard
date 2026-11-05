"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { CourseDraft, ExerciseLibrary } from "@/types/course";
import type { ExerciseDraft } from "@/types/exercise-draft";
import { buildDefinition } from "@/lib/studio/exerciseDraft";
import { emptyWorkspace, type CourseOperation, type CourseRepository, type CourseWorkspace } from "@/lib/repositories/CourseRepository";

function useSessionState() {
  const [workspace,setWorkspace] = useState<CourseWorkspace>(emptyWorkspace);
  const [ready,setReady] = useState(false), [error,setError] = useState("");
  const [saveStatus,setSaveStatus] = useState("Salvo");
  const repository = useRef<CourseRepository | null>(null), generation = useRef(0);
  const queue = useRef(Promise.resolve()), pending = useRef(0);
  const bind = useCallback(async (next: CourseRepository | null) => {
    const token = ++generation.current; repository.current = null; setReady(false); setError(""); setSaveStatus("Salvo"); setWorkspace(emptyWorkspace());
    try { await queue.current; const data = next ? await next.load() : emptyWorkspace(); if (token !== generation.current) return; repository.current = next; setWorkspace(data); setReady(true); }
    catch (cause) { if (token === generation.current) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar a autoria."); setReady(true); } }
  },[]);
  const execute = useCallback((operation: CourseOperation) => {
    const repo = repository.current, token = generation.current;
    if (!repo) return Promise.reject(new Error("Biblioteca indisponível. Tente carregar novamente."));
    pending.current++; setSaveStatus("Salvando..."); setError("");
    const result = queue.current.then(async () => {
      const data = await repo.execute(operation);
      if (generation.current === token) setWorkspace(data);
      return data;
    });
    queue.current = result.then(()=>{}).catch(cause => { if (generation.current === token) { setError(cause.message); setSaveStatus("Alterações não salvas"); } }).finally(() => { pending.current--; if (!pending.current && generation.current === token) setSaveStatus(previous => previous === "Alterações não salvas" ? previous : "Salvo"); });
    return result;
  },[]);
  const saveCourse = useCallback((course: CourseDraft) => {
    const token=generation.current;
    return execute({operation:"save-course",course}).catch(cause=>{
      // Keep unconfirmed chapter/activity edits available for correction/retry in this tab.
      if(token===generation.current)setWorkspace(previous=>{if(previous.courses.some(c=>c.id===course.id&&c.status!=="draft"))return previous;return {...previous,courses:previous.courses.filter(item=>item.id!==course.id).concat(structuredClone(course))};});
      throw cause;
    });
  },[execute]);
  const markDirty = useCallback(()=>setSaveStatus("Alterações não salvas"),[]);
  const saveExercise = useCallback((draft: ExerciseDraft) => execute({operation:"save-exercise",exercise:{id:draft.id,draft:structuredClone(draft),definition:buildDefinition(draft),updatedAt:new Date().toISOString()}}),[execute]);
  const exercises: ExerciseLibrary = {};
  for (const entry of workspace.exercises) exercises[entry.id] = entry;
  return { courses:workspace.courses,exercises,definitions:workspace.definitions,workspace,ready,error,saveStatus,bind,execute,saveCourse,saveExercise,markDirty };
}
const Context = createContext<ReturnType<typeof useSessionState> | null>(null);
export function StudioSessionProvider({children}:{children:React.ReactNode}) { return <Context.Provider value={useSessionState()}>{children}</Context.Provider>; }
export function useStudioSession() { const value = useContext(Context); if (!value) throw new Error("Sessão Studio ausente."); return value; }
