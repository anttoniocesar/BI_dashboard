import type { CourseDraft } from "@/types/course";
import type { ChapterProgress } from "@/types/student-progress";

export function CourseSummaryCards({ course, percent, completedCount, requiredCount, chapters, nextId }: { course: CourseDraft; percent: number; completedCount: number; requiredCount: number; chapters: ChapterProgress[]; nextId: string | null }) {
  const next = course.chapters.find(chapter => chapter.id === nextId);
  return <section className="course-summary-cards" aria-label="Resumo do treinamento">
    <article><span className="summary-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 8C12 5 6 5 3 7v20c4-2 9-1 13 1 4-2 9-3 13-1V7c-3-2-9-2-13 1Zm0 0v20" /></svg></span><div><h2>Capítulos</h2><strong>{chapters.length}</strong><p>{chapters.filter(chapter => chapter.completed).length} concluídos na jornada</p></div></article>
    <article><span className="summary-ring" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="none" stroke="#e0e7ef" strokeWidth="5" /><circle cx="24" cy="24" r="19" fill="none" stroke="#a64b16" strokeWidth="5" pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 24 24)" /></svg></span><div><h2>Progresso geral</h2><strong>{percent}%</strong><p>{completedCount} de {requiredCount} obrigatórias concluídas</p></div></article>
    <article><span className="summary-icon" aria-hidden="true">↗</span><div><h2>Próximo capítulo</h2><strong className="summary-next-title">{next ? `${next.order}. ${next.title}` : chapters.length ? "Jornada concluída" : "Nenhum capítulo"}</strong><p>{next ? "Seu próximo passo" : chapters.length ? "Você pode revisitar os capítulos" : "Aguardando capítulos"}</p></div></article>
    <article><span className="summary-icon" aria-hidden="true">◷</span><div><h2>Carga horária</h2><strong>{course.workload} <small>horas</small></strong><p>Tempo de estudo previsto</p></div></article>
  </section>;
}
