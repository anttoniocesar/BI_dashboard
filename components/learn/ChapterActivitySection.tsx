import type { ReactNode, Ref } from "react";
import type { ActivityDraft } from "@/types/course";
import { activityLetter } from "@/lib/learn/chapter-navigation";
export { activityLetter } from "@/lib/learn/chapter-navigation";

/** Presentation labels only; ordering and eligibility still come from the course. */
export function ChapterActivitySection({ activity, index, navigationPrefix, active, expanded, completed, onSelect, headingRef, children, nested }: {
  activity: ActivityDraft; index: number; active: boolean; completed: boolean;
  expanded: boolean; nested?: boolean;
  navigationPrefix?: string;
  onSelect: () => void; headingRef?: Ref<HTMLHeadingElement>; children: ReactNode;
}) {
  const letter = navigationPrefix ?? activityLetter(index);
  const titleId = `activity-title-${activity.id}`, contentId = `activity-content-${activity.id}`;
  const Heading = nested ? "h3" : "h2";
  return <section className={`chapter-activity-section ${active ? "is-current" : ""} ${activity.type === "spreadsheet-exercise" ? "is-lab" : ""}`} aria-labelledby={titleId}>
    <header className="chapter-activity-header"><Heading className="activity-header-heading" id={titleId} ref={headingRef} tabIndex={active ? -1 : undefined} aria-label={activity.title}><button type="button" className="activity-header-toggle" aria-label={`${expanded ? "Recolher" : "Abrir"} bloco ${letter}`} aria-expanded={expanded} aria-controls={contentId} onClick={onSelect}><span className="activity-letter" aria-hidden="true">{letter}</span><span className="activity-heading-text"><span className="activity-title">{activity.title}</span><small>{activity.required ? "Obrigatória" : "Opcional"}{activity.type === "video" && activity.content.durationMinutes !== undefined && ` · Duração: ${activity.content.durationMinutes} min`}</small></span>
      <span className={`activity-state ${completed ? "is-done" : ""}`}>{completed ? "Concluída ✓" : active ? "Em estudo" : "Pendente"}</span>
      <span className="activity-open">{expanded ? "Recolher" : "Expandir"}<span aria-hidden="true">{expanded ? " ▼" : " ▶"}</span></span></button></Heading>
    </header>
    <div id={contentId} hidden={!expanded} className="chapter-activity-body">{children}</div>
  </section>;
}
