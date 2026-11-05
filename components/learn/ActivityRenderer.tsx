"use client";
import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExerciseLab } from "@/components/storage/ExerciseLab";
import type { ActivityDraft, CourseDraft } from "@/types/course";
import type { ExerciseValidationResult } from "@/types/validation";
import { useLearnSession } from "./LearnSession";
import { VideoActivityCard } from "./VideoActivityCard";
import { MaterialActivityCard } from "./MaterialActivityCard";
import { LabDomScope } from "@/components/spreadsheet/LabDomScope";
import { exerciseKey } from "@/lib/repositories/CourseRepository";

export function ActivityRenderer(props: { course: CourseDraft; chapterId: string; activity: ActivityDraft; completed: boolean; summary?: string }) {
  return <LabDomScope><ActivityContent {...props} /></LabDomScope>;
}
function ActivityContent({ course, chapterId, activity, completed, summary }: { course: CourseDraft; chapterId: string; activity: ActivityDraft; completed: boolean; summary?: string }) {
  const pathname = usePathname();
  const { exercises, repository, finish } = useLearnSession();
  const onEvaluationChange = useCallback((result: ExerciseValidationResult | null) => {
    if (result?.completed) finish(course, chapterId, activity.id);
  }, [finish, course, chapterId, activity.id]);
  const definition = activity.type === "spreadsheet-exercise" ? exercises[activity.content.exerciseVersion ? exerciseKey(activity.content.exerciseId,activity.content.exerciseVersion) : activity.content.exerciseId] : undefined;
  return <div className="learn-activity-content">
    {activity.type === "spreadsheet-exercise" && pathname.startsWith("/learn/") && <Link className="learn-button learn-secondary" href={`/learn/${encodeURIComponent(course.id)}/chapter/${encodeURIComponent(chapterId)}#chapter-heading`} onClick={() => document.getElementById("chapter-heading")?.focus()}>← Voltar ao capítulo</Link>}
    {activity.type === "video" && <VideoActivityCard url={activity.content.url} duration={activity.content.durationMinutes} summary={summary} completed={completed} />}
    {(activity.type === "text" || activity.type === "material") && <MaterialActivityCard {...activity.content} material={activity.type === "material"} />}
    {activity.type === "assessment" && <div className="assessment-activity-card"><p className="learn-prose">{activity.content.description}</p><p className="learn-note">Reflexão com conclusão manual; sem avaliação automática de prova.</p></div>}
    {activity.type === "spreadsheet-exercise" && (definition ? <><div className="lab-practice-callout"><strong>Agora é a sua vez de aplicar o conceito.</strong><p>Utilize a planilha abaixo para resolver o exercício.</p><details><summary>Ver instruções</summary><p>Conclua pelo critério do exercício e clique Verificar respostas. Abrir o Lab não conclui a atividade. Aguarde Salvo antes de navegar. No ambiente conectado, respostas confirmadas são preservadas no servidor.</p>{definition.subtitle && <p>{definition.subtitle}</p>}</details></div><div className="learn-lab"><ExerciseLab embedded definition={definition} repository={repository} attemptId={JSON.stringify([course.id, chapterId, activity.id])} onEvaluationChange={onEvaluationChange} /></div></> : <p role="status">Exercício não disponível na biblioteca desta sessão. Não é possível concluir esta atividade até que o conteúdo esteja disponível.</p>)}
    <div className={`learn-complete ${completed ? "is-done" : ""}`} aria-live="polite">{completed ? <p>Atividade concluída ✓</p> : activity.type !== "spreadsheet-exercise" ? <button className="learn-button" onClick={() => finish(course, chapterId, activity.id)}>Concluir atividade</button> : <p>Aguardando aprovação do exercício.</p>}</div>
  </div>;
}
