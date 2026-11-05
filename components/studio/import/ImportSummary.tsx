import type { ImportReport } from "@/lib/excel-import/types";
export function ImportSummary({ report }: { report: ImportReport }) {
  const cards = [["Abas", report.sheets], ["Células", report.cells], ["Fórmulas", report.formulas], ["Gráficos", report.charts], ["Avisos", report.warnings], ["Erros", report.errors]] as const;
  return <>
    <dl className="studio-summary">{cards.map(([label, value]) => <div key={label} className={label === "Erros" && value ? "has-error" : label === "Avisos" && value ? "has-warning" : ""}><dt>{label}</dt><dd aria-label={`Total de ${label.toLowerCase()}`}>{value}</dd></div>)}</dl>
    <p className="studio-formula-summary">✓ {report.supportedFormulas} fórmulas compatíveis <span>·</span> {report.partiallySupportedFormulas + report.unsupportedFormulas} precisam de revisão <span>·</span> {report.populatedCells} células preenchidas</p>
    {!!report.charts && <p className="studio-formula-summary">Charts: {report.charts} detected / {report.importedCharts ?? 0} imported{report.unsupportedCharts ? ` / ${report.unsupportedCharts} unsupported` : ""}</p>}
  </>;
}
