import type { ImportedStyle, NormalizedWorksheet } from "@/lib/excel-import/types";
import { cellAddress, columnLabel } from "@/lib/spreadsheet/coordinates";
import { coveredByMerge, inspectMerges, mergeAt, mergeRange } from "@/lib/spreadsheet/merges";
import { importedSheetPresentation } from "@/lib/excel-import/presentation";
export function SheetPreview({ sheet,styles={} }: { sheet: NormalizedWorksheet; styles?:Record<string,ImportedStyle> }) {
  let rows = Math.min(10, sheet.dimensions.rows), columns = Math.min(8, sheet.dimensions.columns);
  const merges=inspectMerges(sheet.merges,sheet.dimensions).merges;
  // Never truncate a rectangle whose anchor is inside this limited preview.
  let changed=true;
  while(changed) {changed=false;for(const merge of merges) if(merge.startRow<rows && merge.startCol<columns && (merge.endRow>=rows || merge.endCol>=columns)) {rows=Math.max(rows,merge.endRow+1);columns=Math.max(columns,merge.endCol+1);changed=true;}}
  const presentation=importedSheetPresentation(sheet,styles);
  const widths=Array.from({length:columns},(_,column)=>presentation.columnWidths?.[columnLabel(column)]??100);
  return <section className="studio-sheet-preview" aria-label={`Prévia somente leitura: ${sheet.name}`}>
    <div className="studio-preview-heading"><h3>{sheet.name}</h3><span>Somente leitura</span></div>
    <p>Conteúdo original, incluindo expressões de fórmulas. Exibindo até {rows} linhas e {columns} colunas.</p>
    <div className="studio-table-scroll" tabIndex={0} role="region" aria-label="Rolagem da prévia"><table style={{width:32+widths.reduce((sum,width)=>sum+width,0)}}><caption className="studio-sr-only">Prévia da aba {sheet.name}</caption>
      <colgroup><col style={{width:32}} />{widths.map((width,index)=><col key={index} style={{width}} />)}</colgroup>
      <thead><tr><th scope="col" aria-label="Linha">#</th>{Array.from({ length: columns }, (_, column) => <th key={column} scope="col">{columnLabel(column)}</th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, row) => <tr key={row} style={{height:presentation.rowHeights?.[String(row+1)]}}><th scope="row">{row + 1}</th>{Array.from({ length: columns }, (_, column) => {
        const position={row,column};if(coveredByMerge(merges,position)) return null;
        const merge=mergeAt(merges,position);
        const address = cellAddress({ row, column }), cell = sheet.cells[address];
        const alignment=presentation.cellAlignment?.[address];
        const text = cell?.formula?.expression ?? String(cell?.value ?? "");
        return <td key={address} rowSpan={merge?merge.endRow-row+1:undefined} colSpan={merge?merge.endCol-column+1:undefined} data-merge={merge?mergeRange(merge):undefined}
          style={{textAlign:alignment?.horizontal,verticalAlign:alignment?.vertical==="middle"?"middle":alignment?.vertical==="bottom"?"bottom":"top",...(merge||alignment?.wrapText?{whiteSpace:"pre-wrap",overflowWrap:"anywhere",textOverflow:"clip"}:{})}}
          title={`${address}: ${text || "Vazia"}`} aria-label={`${address}, ${text || "vazia"}, somente leitura`} className={cell?.formula ? "is-formula" : ""}>{text}</td>;
      })}</tr>)}</tbody>
    </table></div>
    <small>Mesclagens, dimensões e alinhamento básico são reproduzidos. Outros estilos permanecem como metadados.</small>
  </section>;
}
