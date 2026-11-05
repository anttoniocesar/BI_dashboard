import type { CellRole, CellRuleResolver, WorkbookCellRules } from "@/types/cell-rules";
import type { CellPosition, Workbook } from "@/types/spreadsheet";
import { cellAddress, parseCellAddress as parseAddress, parseCellRange } from "./coordinates";

/** Cell > range > worksheet default. Last matching range wins; unknown sheets are read-only. */
export function createCellRuleResolver(config: WorkbookCellRules): CellRuleResolver {
  const compiled = new Map(Object.entries(config).map(([id, sheet]) => {
    const ranges = (sheet.ranges ?? []).map(rule => {
      const { from, to } = parseCellRange(rule.range);
      return { role: rule.role, top: Math.min(from.row, to.row), bottom: Math.max(from.row, to.row), left: Math.min(from.column, to.column), right: Math.max(from.column, to.column) };
    });
    const cells = new Map(Object.entries(sheet.cells ?? {}).map(([address, role]) => [cellAddress(parseAddress(address)), role]));
    return [id, { default: sheet.default, ranges, cells }] as const;
  }));
  return (worksheetId, position) => {
    const sheet = compiled.get(worksheetId);
    let role: CellRole = sheet?.default ?? "provided";
    if (sheet) {
      for (const range of sheet.ranges) {
        if (position.row >= range.top && position.row <= range.bottom && position.column >= range.left && position.column <= range.right) role = range.role;
      }
      role = sheet.cells.get(cellAddress(position)) ?? role;
    }
    return { role, readOnly: role === "provided" || role === "calculated" };
  };
}

/** Every student write (including paste, clear and formula-bar commit) passes this guard. */
export function applyCellEdit(workbook: Workbook, resolveRule: CellRuleResolver, worksheetId: string, position: CellPosition, value: string): Workbook {
  if (resolveRule(worksheetId, position).readOnly) return workbook;
  const address = cellAddress(position);
  const source = workbook.worksheets.find(sheet => sheet.id === worksheetId);
  if (!source || (source.cells[address] ?? "") === value) return workbook;
  return { worksheets: workbook.worksheets.map(sheet => {
    if (sheet.id !== worksheetId) return sheet;
    const cells = { ...sheet.cells };
    if (value === "") delete cells[address];
    else cells[address] = value;
    return { ...sheet, cells };
  }) };
}
