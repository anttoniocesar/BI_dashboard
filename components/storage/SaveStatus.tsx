import type { SaveState } from "@/types/exercise-session";

export function SaveStatus({ state }: { state: SaveState }) {
  const label = { idle: "Pronto para salvar", saving: "Salvando...", saved: "Salvo ✓", error: "Erro ao salvar" }[state.status];
  return <div className={`save-status save-${state.status}`} role="status" aria-label="Status de salvamento">
    <span>{label}</span>
    {state.lastSavedAt && <small>Último salvamento: <time dateTime={state.lastSavedAt}>{new Date(state.lastSavedAt).toLocaleString("pt-BR")}</time></small>}
    {state.status === "error" && <small>O progresso continua nesta página. Não foi possível concluir a persistência.</small>}
  </div>;
}
