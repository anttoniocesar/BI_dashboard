import type { Worksheet, SheetBounds } from "@/types/spreadsheet";
import type { Ref } from "react";
import { useLabDomId } from "./LabDomScope";

type SheetTabsProps = { bounds: SheetBounds; worksheets: Worksheet[]; activeId: string; activeTabRef: Ref<HTMLButtonElement>; onSelect: (id: string) => void };

export function SheetTabs({ bounds, worksheets, activeId, activeTabRef, onSelect }: SheetTabsProps) {
  const domId = useLabDomId();
  return (
    <div className="sheet-footer">
      <div className="sheet-tabs" role="tablist" aria-label="Planilhas">
        <span className="sheet-icon" aria-hidden="true">▦</span>
        {worksheets.map((sheet, index) => <button key={sheet.id} type="button" role="tab" id={domId(`tab-${sheet.id}`)}
          ref={sheet.id === activeId ? activeTabRef : undefined}
          aria-selected={sheet.id === activeId} aria-controls={domId(`sheet-${sheet.id}`)} tabIndex={sheet.id === activeId ? 0 : -1}
          className={`sheet-tab ${sheet.id === activeId ? "active" : ""}`} onClick={() => onSelect(sheet.id)}
          onKeyDown={event => {
            let next: number;
            if (event.key === "ArrowRight") next = (index + 1) % worksheets.length;
            else if (event.key === "ArrowLeft") next = (index + worksheets.length - 1) % worksheets.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = worksheets.length - 1;
            else return;
            event.preventDefault();
            onSelect(worksheets[next].id);
            document.getElementById(domId(`tab-${worksheets[next].id}`))?.focus();
          }}>{sheet.name}</button>)}
      </div>
      <span className="sheet-size">{bounds.rows} linhas × {bounds.columns} colunas</span>
    </div>
  );
}
