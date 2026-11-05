import type { CellValidationResult, ExerciseValidationResult } from "@/types/validation";
import { useLabDomId } from "@/components/spreadsheet/LabDomScope";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export const validationStatusLabels = { correct: "Correto", incorrect: "Revisar", unanswered: "Não respondida" };

type Props = {
  worksheets: readonly { id: string; name: string }[];
  evaluation: ExerciseValidationResult | null;
  hasPreviousCheck: boolean;
  onVerify: () => void;
  onSelectCell: (result: CellValidationResult) => void;
};

export function ExerciseValidationSummary({ worksheets, evaluation, hasPreviousCheck, onVerify, onSelectCell }: Props) {
  const domId = useLabDomId();
  return (
    <section className="exercise-validation" aria-labelledby={domId("validation-title")}>
      <header className="validation-heading"><div><h2 id={domId("validation-title")}>Verificação do exercício</h2><p>{evaluation ? "Confira o resultado e as orientações de cada resposta." : hasPreviousCheck ? "Há alterações não verificadas. Verifique novamente." : "Confira suas respostas quando terminar."}</p></div>
        <button type="button" className="validation-button" onClick={onVerify}>Verificar respostas</button>
      </header>
      {evaluation && <>
        <div className="validation-overview" role="status" aria-label="Resultado do exercício">
          <div><strong className={evaluation.completed ? "completion-success" : "completion-review"}>{evaluation.completed ? "Exercício concluído" : "Continue revisando as respostas"}</strong>
            <p>{evaluation.correctCount} de {evaluation.totalCount} respostas corretas</p><small>{evaluation.reviewCount} {evaluation.reviewCount === 1 ? "resposta precisa" : "respostas precisam"} de revisão</small>
          </div>
          <dl><div><dt>Acerto</dt><dd aria-label="Percentual de respostas corretas">{number.format(evaluation.accuracyPercent)}%</dd></div>
            <div><dt>Nota ponderada</dt><dd aria-label="Percentual da pontuação">{number.format(evaluation.scorePercent)}%</dd></div>
            <div><dt>Pontos</dt><dd aria-label="Pontos obtidos">{number.format(evaluation.earnedPoints)} / {number.format(evaluation.possiblePoints)}</dd></div></dl>
        </div>
        <ul className="validation-feedback-list" aria-label="Feedback das respostas">
          {evaluation.cells.map(result => <li key={result.ruleId} id={domId(`feedback-${result.worksheetId}-${result.cell}`)} className={`feedback-${result.status}`}>
            <button type="button" className="feedback-address" onClick={() => onSelectCell(result)}>{worksheets.find(sheet => sheet.id === result.worksheetId)?.name ?? result.worksheetId}!{result.cell}</button>
            <div><span className="feedback-status">{validationStatusLabels[result.status]}</span><strong>{result.label}</strong><p>{result.feedback}</p></div>
            <span className="feedback-points">{number.format(result.pointsEarned)} / {number.format(result.pointsPossible)} pts</span>
          </li>)}
        </ul>
      </>}
    </section>
  );
}
