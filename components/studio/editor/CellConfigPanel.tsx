"use client";
import { useState } from "react";
import type { ExerciseDraft } from "@/types/exercise-draft";
import type { CellRole } from "@/types/cell-rules";
import { createCellRuleResolver } from "@/lib/spreadsheet/cell-rules";
import { parseCellAddress } from "@/lib/spreadsheet/coordinates";
import { applyDraftRole, buildDefinition } from "@/lib/studio/exerciseDraft";
import { ValidationConfig } from "./ValidationConfig";

export function CellConfigPanel({ draft, sheet, address, onChange }: { draft: ExerciseDraft; sheet: string; address: string; onChange: (draft: ExerciseDraft) => void }) {
  const role = createCellRuleResolver(draft.cellRules)(sheet, parseCellAddress(address)).role;
  const rule = draft.validationRules.find(rule => rule.worksheetId === sheet && rule.cell === address);
  const [range, setRange] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function applyRole(next: CellRole, target = address) {
    try { onChange(applyDraftRole(draft, sheet, target, next)); setError(""); setNotice(`Papel aplicado a ${target}.`); }
    catch { setError("Intervalo inválido ou fora dos limites desta aba."); }
  }
  return <aside className="studio-cell-config" aria-labelledby="cell-config-title">
    <h2 id="cell-config-title">Configuração da célula</h2>
    <p><strong>{draft.workbook.worksheets.find(item => item.id === sheet)?.name} · {address}</strong></p>
    <fieldset><legend>Tipo pedagógico</legend>{([
      ["provided", "Fornecida"], ["calculated", "Calculada"], ["editable", "Editável"], ["answer", "Resposta"],
    ] as const).map(([value, label]) => <label className="studio-check" key={value}><input type="radio" name="pedagogical-role" value={value} checked={role === value} onChange={() => applyRole(value)} />{label}</label>)}</fieldset>
    <p>{role === "provided" || role === "calculated" ? "Protegida para o aluno. O professor pode editar." : "Editável pelo aluno."}</p>
    <form onSubmit={event => { event.preventDefault(); applyRole(role, range); }}>
      <label>Aplicar ao intervalo<input placeholder="F2:F6" required value={range} onChange={event => setRange(event.target.value)} /></label>
      <button type="submit" className="studio-secondary">Aplicar papel ao intervalo</button>
      <small>Aplica somente o papel atual. Avaliação é configurada por célula.</small>
    </form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {role === "answer" && <ValidationConfig rule={rule} sheet={sheet} address={address} onApply={rule => {
      const next = { ...draft, validationRules: [...draft.validationRules.filter(item => item.worksheetId !== sheet || item.cell !== address), rule] };
      try { buildDefinition(next); onChange(next); setNotice("Avaliação aplicada."); setError(""); }
      catch { setError("Não foi possível aplicar esta avaliação. Revise os campos."); }
    }} />}
  </aside>;
}
