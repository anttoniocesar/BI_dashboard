import Link from "next/link";
import type { ChapterProgress } from "@/types/student-progress";
import { chapterUrl } from "./CourseJourney";

export function ChapterNavigation({ courseId, previous, next }: { courseId: string; previous?: ChapterProgress; next?: ChapterProgress }) {
  return <nav className="chapter-navigation" aria-label="Navegação entre capítulos">
    {previous?.available ? <Link className="learn-button learn-secondary" href={chapterUrl(courseId, previous.id)}>← Capítulo anterior</Link> : <button className="learn-button learn-secondary" disabled>← Capítulo anterior</button>}
    <Link href={`/learn/${encodeURIComponent(courseId)}`}>Voltar para a trilha</Link>
    {next?.available ? <Link className="learn-button" href={chapterUrl(courseId, next.id)}>Próximo capítulo →</Link> : <button className="learn-button" disabled>Próximo capítulo →</button>}
  </nav>;
}
