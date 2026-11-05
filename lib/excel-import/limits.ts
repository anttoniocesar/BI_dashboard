export const IMPORT_LIMITS = Object.freeze({
  fileBytes: 2 * 1024 * 1024, expandedBytes: 16 * 1024 * 1024, partBytes: 4 * 1024 * 1024,
  zipEntries: 256, sheets: 8, rows: 200, columns: 32, gridCells: 20000,
  cells: 5000, textLength: 8192, formulaLength: 1024,
});

export class ImportFailure extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
export function importAssert(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new ImportFailure(code, message);
}
