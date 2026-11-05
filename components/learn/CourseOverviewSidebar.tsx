import { LearnSidebarChapter, LearnSidebarShell } from "./LearnSidebarShell";
import type { CourseDraft } from "@/types/course";
import type { ChapterProgress } from "@/types/student-progress";
import { inOrder } from "@/lib/learn/progress";
import { chapterUrl } from "./CourseJourney";

export function CourseOverviewSidebar({ course, chapters }: { course: CourseDraft; chapters: ChapterProgress[]; completedActivities: string[] }) {
  return <LearnSidebarShell variant="overview" label="Trilha do curso"><h2>TRILHA DO CURSO</h2><p>Seu percurso, passo a passo</p><ol>{inOrder(course.chapters).map((chapter, index) => {
    const state = chapters.find(item => item.id === chapter.id)!;
    const content = <><span className="overview-sidebar-checkpoint" aria-hidden="true">{state.completed ? "✓" : String(index + 1).padStart(2, "0")}</span><span><small>Capítulo {index + 1} · {state.status}</small><strong>{chapter.title}</strong>{chapter.description && <span className="overview-sidebar-description">{chapter.description}</span>}</span></>;
    return <li key={chapter.id} data-status={state.status}><LearnSidebarChapter className="overview-sidebar-chapter" current={state.status === "Atual" ? "step" : undefined} href={state.available ? chapterUrl(course.id, chapter.id) : undefined} label={`Capítulo ${index + 1} — ${chapter.title} · ${state.status}`}>{content}</LearnSidebarChapter>
    </li>;
  })}</ol>{!chapters.length && <p>Nenhum capítulo disponível.</p>}</LearnSidebarShell>;
}
