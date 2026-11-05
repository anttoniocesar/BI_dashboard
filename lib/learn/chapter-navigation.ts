import type { ActivityDraft, ChapterActivityGroup } from "@/types/course";
import { inOrder } from "./progress";

/** Presentation metadata only: never changes completion or access policy. */
export const chapterActivityGroups = [
  { id: "video-lesson", label: "Video Aula", prefix: "A", type: "video" },
  { id: "video-application", label: "Video Aplicação", prefix: "B", type: "video" },
  { id: "laboratory", label: "Laboratório", prefix: "C", type: "spreadsheet-exercise" },
] as const;

export function activityLetter(index: number): string {
  let value = index + 1, label = "";
  while (value > 0) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}

export type ChapterNavigationItem = {
  activity: ActivityDraft; prefix: string; label: string; group?: ChapterActivityGroup;
};
export function chapterNavigation(activities: ActivityDraft[]): ChapterNavigationItem[] {
  const ordered = inOrder(activities);
  const grouped = ordered.some(activity => activity.navigationGroup);
  if (!grouped) return ordered.map((activity, index) => ({ activity, prefix: activityLetter(index), label: activity.title }));
  const items: ChapterNavigationItem[] = [];
  for (const group of chapterActivityGroups) {
    const members = ordered.filter(activity => activity.navigationGroup === group.id && activity.type === group.type);
    members.forEach((activity, index) => items.push({ activity, group: group.id,
      prefix: group.id === "laboratory" || members.length > 1 ? `${group.prefix}.${index + 1}` : group.prefix,
      label: group.id === "laboratory" ? activity.title : group.label,
    }));
  }
  // Legacy/supplementary content remains executable and keeps its original title.
  const assigned = new Set(items.map(item => item.activity.id));
  ordered.filter(activity => !assigned.has(activity.id)).forEach((activity, index) => {
    items.push({ activity, prefix: activityLetter(index + chapterActivityGroups.length), label: activity.title });
  });
  return items;
}

export function navigationGroupIssue(activity: ActivityDraft): string | null {
  if (activity.navigationGroup === undefined) return null;
  const group = chapterActivityGroups.find(group => group.id === activity.navigationGroup);
  return !group || group.type !== activity.type ? `${activity.title}: grupo de navegação incompatível com o tipo de atividade.` : null;
}
