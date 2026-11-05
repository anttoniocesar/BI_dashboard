"use client";
import { useState } from "react";
import type { ValidationRule } from "@/types/validation";

export function ValidationConfig({ rule, sheet, address, onApply }: {
  rule?: ValidationRule; sheet: string; address: string; onApply: (rule: ValidationRule) => void;
}) {
  const [type, setType] = useState<"number" | "text">(rule?.type ?? "number");
  const [expected, setExpected] = useState(rule ? String(rule.expected) : "");
  const [tolerance, setTolerance] = useState(rule?.type === "number" && rule.tolerance !== undefined ? String(rule.tolerance) : "");
  const [formula, setFormula] = useState(rule?.requireFormula ?? false);
  const [points, setPoints] = useState(String(rule?.points ?? 1));
  const [feedback, setFeedback] = useState(rule?.feedback ?? "Revise o cálculo desta resposta.");
  const [error, setError] = useState("");
  return <form className="studio-validation-config" aria-label="Avaliação da resposta" onSubmit={event => {
    event.preventDefault(); setError("");
    if (!expected.trim() || (type === "number" && !Number.isFinite(Number(expected)))) { setError("Informe uma resposta esperada válida."); return; }
    if (!points.trim() || !Number.isFinite(Number(points)) || Number(points) <= 0) { setError("Pontos devem ser um número positivo."); return; }
    if (type === "number" && tolerance !== "" && (!Number.isFinite(Number(tolerance)) || Number(tolerance) < 0)) { setError("Tolerância deve ser um número maior ou igual a zero."); return; }
    if (!feedback.trim()) { setError("Informe o feedback."); return; }
    const base = { id: rule?.id ?? `answer-${sheet}-${address}`, worksheetId: sheet, cell: address, label: rule?.label ?? `Resposta ${address}`, requireFormula: formula, points: Number(points), feedback };
    onApply(type === "number" ? { ...base, type, expected: Number(expected), ...(tolerance === "" ? {} : { tolerance: Number(tolerance) }) } : { ...base, type, expected });
  }}>
    <h3>Avaliação da resposta</h3>
    <p>{rule ? "Resposta avaliada: Sim" : "Avaliação ainda não configurada."}</p>
    <label htmlFor="validation-type">Tipo de validação</label><select id="validation-type" value={type} onChange={event => setType(event.target.value as "number" | "text")}><option value="number">Número (tolerância opcional)</option><option value="text">Texto</option></select>
    <label htmlFor="validation-expected">Resposta esperada</label><input id="validation-expected" required value={expected} onChange={event => setExpected(event.target.value)} />
    {type === "number" && <><label htmlFor="validation-tolerance">Tolerância</label><input id="validation-tolerance" type="number" min="0" step="any" aria-describedby="tolerance-help" value={tolerance} onChange={event => setTolerance(event.target.value)} /><small id="tolerance-help">Vazia: comparação numérica exata.</small></>}
    <label className="studio-check"><input type="checkbox" checked={formula} onChange={event => setFormula(event.target.checked)} />Aluno deve utilizar fórmula</label>
    <label htmlFor="validation-points">Pontos</label><input id="validation-points" required type="number" min="0" step="any" value={points} onChange={event => setPoints(event.target.value)} />
    <label htmlFor="validation-feedback">Feedback quando incorreta</label><textarea id="validation-feedback" required rows={3} value={feedback} onChange={event => setFeedback(event.target.value)} />
    {error && <p role="alert">{error}</p>}
    <button className="studio-primary" type="submit">Aplicar avaliação</button>
    <small>Confirme os campos com Aplicar avaliação antes de salvar ou testar.</small>
  </form>;
}
