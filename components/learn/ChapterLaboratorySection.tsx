import { useId, type ReactNode } from "react";

export function ChapterLaboratorySection({ expanded, onToggle, completed, total, children }: {
  expanded: boolean; onToggle: () => void; completed: number; total: number; children: ReactNode;
}) {
  const id = useId();
  return <section className="chapter-laboratory-section" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="laboratory-heading"><button type="button" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={onToggle}>
      <span>C. Laboratório</span><small>{completed} de {total} concluídos</small><span aria-hidden="true">{expanded ? "▼" : "▶"}</span>
    </button></h2>
    <div id={`${id}-body`} className="chapter-laboratory-body" hidden={!expanded}>{children}</div>
  </section>;
}
