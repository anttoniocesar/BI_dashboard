import type { KeyboardEvent, Ref } from "react";
import { useLabDomId } from "./LabDomScope";

type FormulaBarProps = {
  address: string;
  value: string;
  readOnly: boolean;
  answer: boolean;
  inputRef: Ref<HTMLInputElement>;
  onFocus: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function FormulaBar({ address, value, readOnly, answer, inputRef, onFocus, onChange, onBlur, onKeyDown }: FormulaBarProps) {
  const domId = useLabDomId();
  return (
    <div className="formula-bar" role="group" aria-label="Barra da célula">
      <output className="cell-address" aria-label="Célula selecionada">{address}</output>
      <span className="formula-symbol" aria-hidden="true">ƒx</span>
      <input ref={inputRef} className="cell-value" aria-label="Conteúdo da célula" aria-describedby={`${domId("formula-permission")} ${domId("keyboard-help")}`} value={value} placeholder="Digite um valor ou uma fórmula, como =A1+B1"
        readOnly={readOnly}
        onFocus={onFocus} onChange={event => onChange(event.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} spellCheck={false} autoComplete="off" />
      <span id={domId("formula-permission")} className={`cell-permission ${readOnly ? "is-protected" : "is-editable"}`} role="status" aria-label="Permissão da célula">
        {readOnly && <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true"><rect x="1.5" y="6" width="9" height="6.5" rx="1.5" stroke="currentColor" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" /></svg>}
        {readOnly ? "Protegida" : answer ? "Preencher" : "Editável"}
      </span>
    </div>
  );
}
