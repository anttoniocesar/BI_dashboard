import type { ChapterDraft } from "../../types/course";

export type TrailPoint = Readonly<{ id: string; x: number; y: number; order: number }>;
// Percentages in the original 1942 × 809 scenery. Never crop this coordinate space.
export const TRAIL_POINTS: readonly TrailPoint[] = Object.freeze([
  [16, 89], [24, 84], [30, 88], [36, 77], [40, 67],
  [46, 73], [51, 70], [56, 60], [60, 65], [65, 55],
  [70, 48], [66, 42], [69, 33], [72, 25], [71, 17],
].map(([x, y], index) => Object.freeze({ id: `P${index + 1}`, x, y, order: index + 1 })));
export const TRAIL_TOP: TrailPoint = Object.freeze({ id: "TOP", x: 72.4, y: 9.5, order: 16 });
export const JOURNEY_LIMIT = "A jornada visual suporta até 15 capítulos.";
export function distributeTrailPoints(count: number): string[] {
  if (!Number.isInteger(count) || count < 0 || count > 15) throw new Error(JOURNEY_LIMIT);
  if (count === 0) return [];
  if (count === 1) return ["P1"];
  const end = count <= 7 ? 12 : 14;
  return Array.from({ length: count }, (_, i) => `P${1 + Math.round(i * end / (count - 1))}`);
}
export function orderedChapters(chapters: ChapterDraft[]) { return [...chapters].sort((a, b) => a.order - b.order); }
/** Legacy courses have no assignments. Once any assignment exists, missing values are errors. */
export function resolvedJourney(chapters: ChapterDraft[]): ChapterDraft[] {
  const sorted = orderedChapters(chapters);
  if (sorted.length > 15 || sorted.some(ch => ch.trailPointId !== undefined)) return sorted;
  const ids = distributeTrailPoints(sorted.length);
  return sorted.map((ch, i) => ({ ...ch, trailPointId: ids[i] }));
}
export function journeyIssues(chapters: ChapterDraft[]): string[] {
  if (chapters.length > 15) return [JOURNEY_LIMIT];
  const used = new Set<string>(); let previous = 0;
  return orderedChapters(chapters).flatMap((ch, i) => {
    const point = TRAIL_POINTS.find(p => p.id === ch.trailPointId);
    const issues: string[] = [];
    if (!ch.trailPointId) issues.push(`${ch.title}: Defina a posição deste capítulo na jornada.`);
    else if (!point) issues.push(`${ch.title}: ponto da jornada inválido. TOP é reservado à conclusão.`);
    else {
      if (i === 0 && point.id !== "P1") issues.push("O primeiro capítulo deve começar em P1.");
      if (used.has(point.id)) issues.push(`${ch.title}: ponto já ocupado.`);
      if (point.order <= previous) issues.push(`${ch.title}: ordem regressiva na jornada. Redistribua ou ajuste os pontos.`);
      previous = point.order; used.add(point.id);
    }
    return issues;
  });
}
export function assignTrailPoint(chapters: ChapterDraft[], chapterId: string, pointId: string): ChapterDraft[] {
  if (!TRAIL_POINTS.some(p => p.id === pointId)) throw new Error("Ponto inválido. TOP é reservado à conclusão.");
  const sorted = orderedChapters(chapters), index = sorted.findIndex(ch => ch.id === chapterId);
  if (index < 0) throw new Error("Capítulo inexistente.");
  if (index === 0 && pointId !== "P1") throw new Error("O primeiro capítulo deve começar em P1.");
  const order = TRAIL_POINTS.find(p => p.id === pointId)!.order;
  if (sorted.some((ch, i) => {
    if (i === index) return false;
    const p = TRAIL_POINTS.find(p => p.id === ch.trailPointId);
    return p && (i < index ? p.order >= order : p.order <= order);
  })) throw new Error("Ponto ocupado ou ordem regressiva. Redistribua ou ajuste os pontos.");
  return chapters.map(ch => ch.id === chapterId ? { ...ch, trailPointId: pointId } : { ...ch });
}
/** Cardinal cubic spline with short tangents; intermediate guides remain invisible. */
export function trailPath(chapters: ChapterDraft[]): string {
  if (!chapters.length || journeyIssues(chapters).length) return "";
  const points = [...TRAIL_POINTS, TRAIL_TOP];
  const f = (n: number) => Number(n.toFixed(3));
  return `M ${points[0].x} ${points[0].y}` + points.slice(1).map((p, i) => {
    const a = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 2)];
    return ` C ${f(a.x + (p.x - before.x) / 8)} ${f(a.y + (p.y - before.y) / 8)}, ${f(p.x - (after.x - a.x) / 8)} ${f(p.y - (after.y - a.y) / 8)}, ${p.x} ${p.y}`;
  }).join("");
}
