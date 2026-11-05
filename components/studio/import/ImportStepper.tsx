const labels = ["Selecionar arquivo", "Analisar", "Revisar", "Abrir no Lab"];
export function ImportStepper({ step }: { step: number }) {
  return <ol className="studio-stepper" aria-label="Etapas da importação">
    {labels.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""}>
      <span className="studio-step-number" aria-hidden="true">{step > index + 1 ? "✓" : index + 1}</span>
      <span><small>ETAPA {index + 1}</small>{label}</span>
    </li>)}
  </ol>;
}
