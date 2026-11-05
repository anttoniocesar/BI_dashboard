import type { SheetPresentation } from "../../types/exercise";
import type { ImportedStyle, NormalizedWorksheet } from "./types";
import { columnLabel } from "../spreadsheet/coordinates";

/** Excel widths use character units, heights use points. Conversion is an
 * approximation at 96dpi; wrapping may expand the imported minimum height. */
export function importedSheetPresentation(sheet:NormalizedWorksheet,styles:Record<string,ImportedStyle>):SheetPresentation {
  return { dimensions:{...sheet.dimensions},
    columnWidths:Object.fromEntries(sheet.columns.filter(column=>typeof column.width==="number" && Number.isFinite(column.width) && column.width>0).map(column=>[columnLabel(column.index-1),Math.max(40,Math.round(column.width!*7+5))])),
    rowHeights:Object.fromEntries(sheet.rows.filter(row=>typeof row.height==="number" && Number.isFinite(row.height) && row.height>0).map(row=>[String(row.index),Math.max(31,Math.round(row.height!*4/3))])),
    cellAlignment:Object.fromEntries(Object.entries(sheet.cells).flatMap(([address,cell])=>{
      const alignment=cell.styleId?styles[cell.styleId]?.alignment:undefined;
      if(!alignment) return [];
      const horizontal=alignment.horizontal==="centerContinuous"?"center":alignment.horizontal;
      const normalized:NonNullable<SheetPresentation["cellAlignment"]>[string]={};
      if(horizontal==="left" || horizontal==="center" || horizontal==="right" || horizontal==="justify") normalized.horizontal=horizontal;
      if(alignment.vertical==="top" || alignment.vertical==="middle" || alignment.vertical==="bottom") normalized.vertical=alignment.vertical;
      if(alignment.wrapText!==undefined) normalized.wrapText=alignment.wrapText;
      return [[address,normalized]];
    })),
  };
}
