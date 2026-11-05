"use client";

import { useEffect, useId, useState } from "react";
import type { ActivityDraft } from "@/types/course";
import { chapterActivityGroups, chapterNavigation, type ChapterNavigationItem } from "@/lib/learn/chapter-navigation";

export function ChapterActivityNavigation({ activities, activityId, completedActivities, onActivity }: {
  activities: ActivityDraft[]; activityId?: string; completedActivities: string[]; onActivity: (id: string) => void;
}) {
  const items = chapterNavigation(activities);
  const labs = items.filter(item => item.group === "laboratory");
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  const activeLab = labs.some(item => item.activity.id === activityId);
  useEffect(() => { if (activeLab) setExpanded(true); }, [activeLab, activityId]);
  const renderActivity = (item: ChapterNavigationItem) => <li key={item.activity.id}>
    <button type="button" aria-current={activityId === item.activity.id ? "step" : undefined} onClick={() => onActivity(item.activity.id)}>
      <span><span className="sidebar-activity-letter" aria-hidden={item.group ? undefined : true}>{item.prefix}{item.prefix.includes(".") ? "" : "."}</span> {item.label}</span>
      {item.label !== item.activity.title && <span className="sidebar-activity-title">{item.activity.title}</span>}
      <small>{completedActivities.includes(item.activity.id) ? "Concluída ✓" : activityId === item.activity.id ? "Em estudo" : "Pendente"} · {item.activity.required ? "Obrigatória" : "Opcional"}</small>
    </button>
  </li>;
  const laboratory = chapterActivityGroups.find(group => group.id === "laboratory")!;
  const before = items.filter(item => item.group === "video-lesson" || item.group === "video-application");
  const after = items.filter(item => !item.group);
  return <ol className="learn-activity-list">
    {before.map(renderActivity)}
    {labs.length > 0 && <li className="chapter-laboratory-group">
      <button type="button" className="laboratory-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <span><span className="sidebar-activity-letter">{laboratory.prefix}.</span> {laboratory.label} <span aria-hidden="true">{expanded ? "−" : "+"}</span></span>
        <small>{labs.filter(item => completedActivities.includes(item.activity.id)).length} de {labs.length} concluídos</small>
      </button>
      <ol id={id} hidden={!expanded} className="laboratory-activities">{labs.map(renderActivity)}</ol>
    </li>}
    {after.map(renderActivity)}
  </ol>;
}
