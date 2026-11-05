import Link from "next/link";
import type { CourseDraft } from "@/types/course";
import type { ChapterProgress } from "@/types/student-progress";
import { chapterUrl } from "./CourseJourney";
import { TRAIL_POINTS, TRAIL_TOP, distributeTrailPoints, resolvedJourney, journeyIssues, trailPath } from "@/lib/courses/journey";
import "./journey.css";
import { JourneyCloudLayer } from "./JourneyCloudLayer";
import { JourneyBirdLayer } from "./JourneyBirdLayer";
import { JourneySummitFlag } from "./JourneySummitFlag";

export function journeyPositions(count: number) {
  if (count > 15) return null;
  return distributeTrailPoints(count).map(id => TRAIL_POINTS.find(p => p.id === id)!);
}
export function CourseJourneyBoard({ course, chapters, backgroundImage = "/images/learn/course-journey-background.png", onChapterSelect }: { course: CourseDraft; chapters: ChapterProgress[]; learningStatuses?: Record<string,string>; backgroundImage?: string; onChapterSelect?: (chapterId: string) => void }) {
  const assigned = resolvedJourney(course.chapters), issues = journeyIssues(assigned);
  const valid = !issues.length, path = trailPath(assigned);
  const localImage = backgroundImage.startsWith("/") && !backgroundImage.startsWith("//") && !backgroundImage.includes("\\") ? backgroundImage : "/images/learn/course-mountains.svg";
  return <section className="course-journey-board" aria-labelledby="journey-board-title">
    <div className="course-board-heading"><div><span>CONHECIMENTO QUE TRANSFORMA</span><h2 id="journey-board-title">Jornada do curso</h2></div><p>{chapters.filter(ch => ch.completed).length} de {chapters.length} capítulos concluídos</p></div>
    {!valid && <p role="status">{course.chapters.length > 15 ? issues[0] : "A jornada aguarda ajuste de posições pelo professor."}</p>}
    <div className="trail-scroll"><div className={`trail-map journey-landscape ${assigned.length > 8 ? "trail-dense" : ""} ${valid ? "" : "trail-fallback"}`} style={{ backgroundImage: `url("${localImage}"), url("/images/learn/course-mountains.svg")` }}>
      {valid && assigned.length > 0 && <JourneyCloudLayer />}
      {valid && assigned.length > 0 && <JourneyBirdLayer />}
      {path && <svg className="journey-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="#142d4e" strokeOpacity=".65" strokeWidth="1.1"/><path d={path} fill="none" stroke="white" strokeWidth=".45" strokeDasharray="1.2 1" strokeLinecap="round"/></svg>}
      <div className="journey-destination" aria-label="Conclusão do curso" style={{ left: `${TRAIL_TOP.x}%`, top: `${TRAIL_TOP.y}%` }}><JourneySummitFlag /><span className="trail-destination-title">Conclusão do curso</span></div>
      {!assigned.length && <p className="journey-empty">Este curso ainda não possui capítulos.</p>}
      <ol>{assigned.map((chapter, index) => {
        const state = chapters.find(ch => ch.id === chapter.id);
        if (!state) return null;
        const point = valid ? TRAIL_POINTS.find(p => p.id === chapter.trailPointId) : undefined;
        const label = `${String(index + 1).padStart(2, "0")} ${chapter.title} · ${state.status}`;
        const content = <><span className="journey-checkpoint" aria-hidden="true">{state.completed ? "✓" : String(index + 1).padStart(2, "0")}{!state.available && <span className="trail-lock">🔒</span>}</span><div title={chapter.title} className={`journey-chapter-card${point?.id === "P15" ? " trail-label-above" : point && [13,14].includes(point.order) ? " trail-label-right" : ""}`}><h3>{chapter.title}</h3></div></>;
        return <li key={chapter.id} data-status={state.status} style={point ? { left: `${point.x}%`, top: `${point.y}%` } : undefined}>{state.available ? onChapterSelect ? <button type="button" className="trail-preview-chapter" aria-label={label} onClick={() => onChapterSelect(chapter.id)}>{content}</button> : <Link href={chapterUrl(course.id, chapter.id)} aria-label={label}>{content}</Link> : <div className="learn-locked" aria-disabled="true" aria-label={label}>{content}</div>}</li>;
      })}</ol>
    </div></div>
  </section>;
}
