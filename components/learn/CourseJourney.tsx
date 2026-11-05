import Link from "next/link";
import type { CourseDraft } from "@/types/course";
import type { ChapterProgress } from "@/types/student-progress";
import { inOrder } from "@/lib/learn/progress";

export function chapterUrl(courseId: string, chapterId: string) {
  return `/learn/${encodeURIComponent(courseId)}/chapter/${encodeURIComponent(chapterId)}`;
}
export function CourseJourney({ course, chapters }: { course: CourseDraft; chapters: ChapterProgress[] }) {
  return <section className="learn-card learn-journey" aria-labelledby="journey-title"><div className="learn-section-title"><div><p className="learn-kicker">SEU CAMINHO</p><h2 id="journey-title">Jornada do curso</h2></div><span>{chapters.filter(chapter => chapter.completed).length} / {chapters.length} capítulos</span></div>
    {!chapters.length && <p>Este curso ainda não possui capítulos.</p>}
    <ol>{inOrder(course.chapters).map((chapter, index) => {
      const state = chapters.find(item => item.id === chapter.id)!;
      const content = <><span className="learn-checkpoint" aria-hidden="true">{state.completed ? "✓" : index + 1}</span><div><small>CAPÍTULO {index + 1} · {state.status}</small><h3>{chapter.title}</h3><p>{chapter.description}</p><span>{state.completedCount} de {state.requiredCount} obrigatórias · {state.percent}%</span>{!state.available && <p>Conclua o capítulo anterior para abrir.</p>}</div><span aria-hidden="true">{state.available ? "↗" : "—"}</span></>;
      return <li key={chapter.id} data-status={state.status}>{state.available ? <Link href={chapterUrl(course.id, chapter.id)}>{content}</Link> : <div className="learn-locked" aria-disabled="true">{content}</div>}</li>;
    })}</ol>
  </section>;
}
