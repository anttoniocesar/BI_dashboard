import type { ImportReport, NormalizedWorkbook } from "@/lib/excel-import/types";
export function SheetSelector({ workbook, selected, preview, report, onToggle, onPreview }: {
  workbook: NormalizedWorkbook; selected: string[]; preview: string; report: ImportReport; onToggle: (id: string) => void; onPreview: (id: string) => void;
}) {
  return <fieldset className="studio-sheet-selector"><legend>Abas para importar</legend><p>Selecione ao menos uma aba. Use a prévia para conferir o conteúdo.</p>
    {workbook.worksheets.map(sheet => {
      const cells = Object.values(sheet.cells), warnings = report.items.filter(item => item.level === "WARNING" && item.sheet === sheet.name).length;
      return <div key={sheet.id} className={`studio-sheet-option ${selected.includes(sheet.id) ? "is-selected" : ""}`}>
        <label><input type="checkbox" checked={selected.includes(sheet.id)} onChange={() => onToggle(sheet.id)} /><span><strong>{sheet.name}</strong>
          <small>{sheet.dimensions.rows} linhas · {sheet.dimensions.columns} colunas · {cells.filter(cell => cell.kind !== "blank").length} preenchidas · {cells.filter(cell => cell.formula).length} fórmulas · {warnings} avisos associados</small></span></label>
        <button type="button" className="studio-text-button" aria-pressed={preview === sheet.id} aria-label={`Prévia de ${sheet.name}`} onClick={() => onPreview(sheet.id)}>Prévia <span aria-hidden="true">↗</span></button>
      </div>;
    })}
  </fieldset>;
}
