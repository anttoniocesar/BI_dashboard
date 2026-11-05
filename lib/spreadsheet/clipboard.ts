import type { CellPosition, SheetBounds } from "@/types/spreadsheet";
import { translateFormula } from "./formula-engine";

export const CELL_CLIPBOARD_TYPE = "application/x-bi-society-cell";

export function pastedCell(plainText: string, metadata: string, target: CellPosition, bounds: SheetBounds): string {
  try {
    const source: { raw?: unknown; position?: Partial<CellPosition> } = JSON.parse(metadata);
    const position = source.position;
    if (source.raw === plainText && position && Number.isInteger(position.row) && Number.isInteger(position.column)
      && position.row! >= 0 && position.row! < bounds.rows && position.column! >= 0 && position.column! < bounds.columns) {
      return translateFormula(plainText, position as CellPosition, target, bounds);
    }
  } catch { /* External plain text has no internal source coordinates. */ }
  return plainText;
}
