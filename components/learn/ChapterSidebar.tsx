import Link from "next/link";
import { LearnSidebarChapter, LearnSidebarShell } from "./LearnSidebarShell";
import { useLearnLayoutState } from "./LearnLayoutState";
import type { CourseDraft } from "@/types/course";
import type { ChapterProgress } from "@/types/student-progress";
import { inOrder } from "@/lib/learn/progress";
import { chapterUrl } from "./CourseJourney";
import { ChapterActivityNavigation } from "./ChapterActivityNavigation";

export function ChapterSidebar({ course, chapters, chapterId, activityId, completedActivities, onActivity }: { course: CourseDraft; chapters: ChapterProgress[]; chapterId: string; activityId?: string; completedActivities: string[]; onActivity: (id: string) => void }) {
  const { collapsed } = useLearnLayoutState();
  return <LearnSidebarShell variant="chapter" label="Capítulos e atividades"><Link className="sidebar-back" href={`/learn/${encodeURIComponent(course.id)}`}>← Visão geral do curso</Link><p className="sidebar-back-caption">Voltar para a trilha</p><h2>Seu percurso</h2><ol>{inOrder(course.chapters).map((chapter, index) => {
    const state = chapters.find(item => item.id === chapter.id)!;
    const content = <><span className={`sidebar-chapter-symbol ${state.completed ? "is-done" : !state.available ? "is-locked" : ""}`} aria-hidden="true">{state.completed ? "✓" : !state.available && !collapsed ? "−" : index + 1}</span><span><strong>{index + 1}. {chapter.title}</strong>{chapter.description && <small className="sidebar-chapter-description">{chapter.description}</small>}<small>{state.status} · {state.completedCount}/{state.requiredCount}</small></span></>;
    return <li key={chapter.id}><LearnSidebarChapter current={chapterId === chapter.id ? "page" : undefined} href={state.available ? chapterUrl(course.id, chapter.id) : undefined} label={`Capítulo ${index + 1} — ${chapter.title} · ${state.status}`}>{content}</LearnSidebarChapter>
      {chapterId === chapter.id && <ChapterActivityNavigation key={chapter.id} activities={chapter.activities} activityId={activityId} completedActivities={completedActivities} onActivity={onActivity} />}
      {!state.available && chapter.activities.some(item => item.type === "assessment") && <p className="sidebar-locked-assessment">Avaliação bloqueada · conclua os capítulos anteriores.</p>}
    </li>;
  })}</ol></LearnSidebarShell>;
}
