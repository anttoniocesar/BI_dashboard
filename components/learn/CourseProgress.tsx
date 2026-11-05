export function CourseProgress({ label, completed, total, percent }: { label: string; completed: number; total: number; percent: number }) {
  return <div className="learn-progress" role="group" aria-label={label}>
    <div><strong>{label}</strong><span>{percent}%</span></div>
    <progress aria-label={label} max={100} value={percent} />
    <p>{completed} de {total} atividades obrigatórias concluídas</p>
  </div>;
}
