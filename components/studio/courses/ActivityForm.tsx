"use client";
import { useId, useState } from "react";
import { StudioImportLink } from "@/components/navigation/StudioImportLink";
import type { ActivityDraft, ActivityType, ExerciseLibrary, StudioExercise } from "@/types/course";
import { activityLabels, isHttpUrl } from "@/lib/studio/courseDraft";
import { chapterActivityGroups } from "@/lib/learn/chapter-navigation";

export function ActivityForm({ activity, exercises, exerciseEntries = Object.values(exercises), onSave, onCancel }: { activity?: ActivityDraft; exercises: ExerciseLibrary; exerciseEntries?: StudioExercise[]; onSave: (activity: ActivityDraft) => void; onCancel: () => void }) {
  const id = useId();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [type, setType] = useState<ActivityType>(activity?.type ?? "video");
  const [required, setRequired] = useState(activity?.required ?? true);
  const [url, setUrl] = useState(activity && "url" in activity.content ? activity.content.url ?? "" : "");
  const [text, setText] = useState(activity && "text" in activity.content ? activity.content.text : activity?.type === "assessment" ? activity.content.description : "");
  const [fileName, setFileName] = useState(activity && "fileName" in activity.content ? activity.content.fileName ?? "" : "");
  const [duration, setDuration] = useState(activity?.type === "video" && activity.content.durationMinutes !== undefined ? String(activity.content.durationMinutes) : "");
  const [exercise, setExercise] = useState(activity?.type === "spreadsheet-exercise" ? activity.content.exerciseId : "");
  const [error, setError] = useState("");
  return <form className="course-activity-form" aria-label={activity ? "Editar atividade" : "Nova atividade"} onSubmit={event => {
    event.preventDefault(); setError("");
    if (!title.trim()) { setError("Informe o título da atividade."); return; }
    if ((type === "video" || ((type === "text" || type === "material") && url)) && !isHttpUrl(url)) { setError("Informe uma URL HTTP/HTTPS válida."); return; }
    if (type === "video" && duration !== "" && (!Number.isFinite(Number(duration)) || Number(duration) < 0)) { setError("Informe uma duração válida."); return; }
    if (type === "spreadsheet-exercise" && !Object.hasOwn(exercises, activity?.type === "spreadsheet-exercise" ? activity.content.exerciseId : exercise)) { setError("Selecione um exercício disponível nesta sessão."); return; }
    const navigationGroup = chapterActivityGroups.find(group => group.id === activity?.navigationGroup && group.type === type)?.id;
    const base = { id: activity?.id ?? `activity-${crypto.randomUUID()}`, title: title.trim(), order: activity?.order ?? 1, required,
      ...(navigationGroup ? { navigationGroup } : {}) };
    let next: ActivityDraft;
    if (type === "video") next = { ...base, type, content: { url, ...(duration === "" ? {} : { durationMinutes: Number(duration) }) } };
    else if (type === "spreadsheet-exercise") next = { ...base, type, content: activity?.type === "spreadsheet-exercise" ? {...activity.content} : {exerciseId:exercise,exerciseVersion:exercises[exercise].definition.version} };
    else if (type === "assessment") next = { ...base, type, content: { description: text } };
    else next = { ...base, type, content: { text, ...(url ? { url } : {}), ...(fileName ? { fileName } : {}) } };
    onSave(next);
  }}>
    <h4>{activity ? "Editar atividade" : "Nova atividade"}</h4>
    <label htmlFor={`${id}-title`}>Título da atividade</label><input autoFocus id={`${id}-title`} required value={title} onChange={event => setTitle(event.target.value)} />
    <label htmlFor={`${id}-type`}>Tipo de atividade</label><select id={`${id}-type`} value={type} onChange={event => setType(event.target.value as ActivityType)}>{Object.entries(activityLabels).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select>
    <label className="course-check"><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />Atividade obrigatória</label>
    {(type === "video" || type === "text" || type === "material") && <><label htmlFor={`${id}-url`}>{type === "video" ? "URL do vídeo" : "URL do material (metadata)"}</label><input id={`${id}-url`} type="url" required={type === "video"} value={url} onChange={event => setUrl(event.target.value)} /><small>{type === "video" ? "Cole um link do YouTube (incluindo Shorts) ou de um arquivo HTTPS MP4, WebM ou OGG." : "A URL é uma referência ao material; não há upload remoto."}</small></>}
    {type === "video" && <><label htmlFor={`${id}-duration`}>Duração (minutos, opcional)</label><input id={`${id}-duration`} type="number" min="0" step="any" value={duration} onChange={event => setDuration(event.target.value)} /></>}
    {(type === "text" || type === "material" || type === "assessment") && <><label htmlFor={`${id}-text`}>{type === "assessment" ? "Descrição da avaliação" : "Texto da atividade"}</label><textarea id={`${id}-text`} rows={4} value={text} onChange={event => setText(event.target.value)} /></>}
    {(type === "text" || type === "material") && <><label htmlFor={`${id}-file`}>Nome do arquivo (metadata)</label><input id={`${id}-file`} value={fileName} onChange={event => setFileName(event.target.value)} /></>}
    {type === "spreadsheet-exercise" && <><label htmlFor={`${id}-exercise`}>Selecionar exercício</label><select id={`${id}-exercise`} required disabled={activity?.type === "spreadsheet-exercise"} value={activity?.type === "spreadsheet-exercise" ? activity.content.exerciseId : exercise} onChange={event => setExercise(event.target.value)}><option value="">Selecione um exercício</option>{activity?.type === "spreadsheet-exercise" ? <option value={activity.content.exerciseId}>{exerciseEntries.find(entry=>entry.id===activity.content.exerciseId && (!activity.content.exerciseVersion || entry.definition.version===activity.content.exerciseVersion))?.definition.title ?? activity.content.exerciseId} · {activity.content.exerciseVersion ?? "Versão não definida"}</option> : Object.values(exercises).map(entry => <option key={entry.id} value={entry.id}>{entry.definition.title} · {entry.definition.version}</option>)}</select>
      {activity?.type === "spreadsheet-exercise" && <small>Para trocar o vínculo salvo, use Substituir exercício na atividade acima.</small>}
      <small>O vínculo fixa a versão selecionada. Depois de publicar, crie outra atividade para trocar o Lab e preservar as tentativas anteriores.</small>{!Object.keys(exercises).length && <p>Nenhum exercício disponível. <StudioImportLink>Importar exercício Excel</StudioImportLink> e salvar no Editor antes de vincular.</p>}</>}
    {type === "assessment" && <small>Estrutura de avaliação; nenhum motor de prova foi criado.</small>}
    {error && <p role="alert">{error}</p>}
    <div className="course-actions"><button className="studio-primary" type="submit">Salvar atividade</button><button className="studio-secondary" type="button" onClick={onCancel}>Cancelar atividade</button></div>
  </form>;
}
