export type CellPosition = { row: number; column: number };
// User input is authoritative; calculated values are a separate derived snapshot.
export type SheetData = Record<string, string>;
export type CellMerge = { startRow: number; startCol: number; endRow: number; endCol: number };
export type Worksheet = { id: string; name: string; cells: SheetData; merges?: CellMerge[] };
export type Workbook = { worksheets: Worksheet[] };
export type ReadonlyWorkbook = { readonly worksheets: readonly {
  readonly id: string; readonly name: string; readonly cells: Readonly<SheetData>; readonly merges?: readonly Readonly<CellMerge>[];
}[] };
export type CellEdit = { worksheetId: string; position: CellPosition; draft: string; source: "cell" | "bar" };
export type SheetBounds = { rows: number; columns: number };
export type CalculatedCell = {
  raw: string;
  formula?: string;
  calculatedValue: string | number | boolean | null;
  error?: string;
};
export type CalculatedWorkbook = Record<string, Record<string, CalculatedCell>>;
