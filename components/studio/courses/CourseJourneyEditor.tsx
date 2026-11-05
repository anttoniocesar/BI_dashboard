"use client";
import { useState } from "react";
import type { CourseDraft } from "@/types/course";
import { TRAIL_POINTS, TRAIL_TOP, resolvedJourney, journeyIssues, distributeTrailPoints, assignTrailPoint } from "@/lib/courses/journey";
import "@/components/learn/journey.css";

export function CourseJourneyEditor({ course, onChange }: { course: CourseDraft; onChange: (course: CourseDraft) => void }) {
  const chapters = resolvedJourney(course.chapters);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const selected = chapters.find(ch => ch.id === selectedId) ?? chapters[0];
  const issues = journeyIssues(chapters);
  function assign(id: string) {
    if (!selected) return;
    try { const next = assignTrailPoint(chapters, selected.id, id); onChange({ ...course, chapters: next }); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  return <section className="studio-panel" aria-labelledby="configure-journey-title">
    <h2 id="configure-journey-title">Configurar jornada</h2>
    <p>Selecione um capítulo e escolha um ponto. O primeiro começa em P1; TOP é reservado à conclusão. Os pontos-guia aparecem somente aqui.</p>
    <div className="trail-editor-controls">
      <label>Capítulo da jornada<select value={selected?.id ?? ""} disabled={!chapters.length} onChange={e => setSelectedId(e.target.value)}>{chapters.map((ch, i) => <option key={ch.id} value={ch.id}>{i + 1}. {ch.title}</option>)}</select></label>
      <label>Ponto da jornada<select value={selected?.trailPointId ?? ""} disabled={!selected || chapters.length > 15} onChange={e => assign(e.target.value)}><option value="" disabled>Selecione um ponto</option>{TRAIL_POINTS.map(point => {
        let disabled = false;
        try { if (selected) assignTrailPoint(chapters, selected.id, point.id); } catch { disabled = true; }
        return <option key={point.id} value={point.id} disabled={disabled}>{point.id}</option>;
      })}</select></label>
      <button type="button" className="studio-secondary" disabled={!chapters.length || chapters.length > 15} onClick={() => {
        const ids = distributeTrailPoints(chapters.length);
        onChange({ ...course, chapters: chapters.map((ch, i) => ({ ...ch, trailPointId: ids[i] })) }); setError("");
      }}>Distribuir automaticamente</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!!issues.length && <div role="alert"><ul>{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
    <div className="trail-scroll"><div className="trail-editor-map" aria-label="Mapa de autoria da jornada">
      {TRAIL_POINTS.map(point => {
        const occupant = chapters.find(ch => ch.trailPointId === point.id);
        return <button type="button" key={point.id} className="trail-guide" style={{ left: `${point.x}%`, top: `${point.y}%` }} data-occupied={!!occupant} aria-pressed={selected?.trailPointId === point.id} aria-label={`Selecionar ponto ${point.id} · ${occupant ? `ocupado por ${occupant.title}` : "disponível"}`} disabled={!selected || chapters.length > 15} onClick={() => assign(point.id)}>{point.id}</button>;
      })}
      <span className="trail-guide-top" style={{ left: `${TRAIL_TOP.x}%`, top: `${TRAIL_TOP.y}%` }}>⚑ TOP · Conclusão do curso</span>
    </div></div>
    <ol className="trail-editor-assignments">{chapters.map(ch => <li key={ch.id}>{ch.title} → {ch.trailPointId ?? "Defina a posição deste capítulo na jornada."}</li>)}</ol>
  </section>;
}
