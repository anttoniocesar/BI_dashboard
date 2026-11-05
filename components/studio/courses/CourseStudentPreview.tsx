"use client";
import { CourseJourneyBoard } from "@/components/learn/CourseJourneyBoard";
import { courseProgress, initialProgress } from "@/lib/learn/progress";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStudioSession } from "../StudioSession";
import { useLearnSession, LearnPreviewProvider } from "@/components/learn/LearnSession";
import { ActivityRenderer } from "@/components/learn/ActivityRenderer";
import { VolatileExerciseRepository } from "@/lib/storage/VolatileExerciseRepository";

export function CourseStudentPreview({courseId}:{courseId:string}) {
  const studio = useStudioSession(), learn = useLearnSession();
  const course = studio.courses.find(c=>c.id===courseId);
  const [selected,setSelected] = useState("");
  const [completed,setCompleted] = useState<string[]>([]);
  const repository = useMemo(()=>new VolatileExerciseRepository(),[]);
  if (!course) return <h1>Curso indisponível</h1>;
  const activities = course.chapters.flatMap(ch=>ch.activities.map(activity=>({chapter:ch,activity})));
  const current = activities.find(item=>item.activity.id===selected) ?? activities[0];
  return <LearnPreviewProvider value={{...learn,courses:[course],exercises:{...learn.exercises,...studio.definitions},repository,finish:(_course,_chapter,id)=>setCompleted(previous=>previous.includes(id) ? previous : [...previous,id]),visit:()=>{},progressStatus:"",progress:{}}}>
    <section className="studio-panel learn-shell"><Link href={`/studio/courses/${course.id}`}>Voltar ao curso</Link><h1>{course.title}</h1><p>Preview do professor · respostas temporárias · sem registrar progresso de aluno</p><CourseJourneyBoard course={course} chapters={courseProgress(course, { ...initialProgress(course.id), completedActivities: completed }).chapters} onChapterSelect={chapterId => setSelected(activities.find(item => item.chapter.id === chapterId)?.activity.id ?? "")} /><nav aria-label="Atividades do preview">{activities.map(({chapter,activity})=><button key={activity.id} onClick={()=>setSelected(activity.id)} aria-current={current?.activity.id===activity.id ? "step" : undefined}>{chapter.title} · {activity.title}</button>)}</nav>{current ? <><h2>{current.activity.title}</h2><ActivityRenderer key={current.activity.id} course={course} chapterId={current.chapter.id} activity={current.activity} completed={completed.includes(current.activity.id)} /></> : <p>Nenhuma atividade neste curso.</p>}</section>
  </LearnPreviewProvider>;
}
