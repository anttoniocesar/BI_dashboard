import type { CellPosition, SheetBounds } from "@/types/spreadsheet";

export function columnIndex(label: string): number {
  if (!/^[A-Z]+$/i.test(label)) throw new Error(`Coluna inválida: ${label}`);
  const column = [...label.toUpperCase()].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
  if (!Number.isSafeInteger(column)) throw new Error(`Coluna fora do limite: ${label}`);
  return column;
}
export function positionInBounds(position: CellPosition, bounds: SheetBounds): boolean {
  return Number.isSafeInteger(position.row) && Number.isSafeInteger(position.column) && position.row >= 0 && position.column >= 0 && position.row < bounds.rows && position.column < bounds.columns;
}
export function parseCellAddress(address: string, bounds?: SheetBounds): CellPosition {
  const match = /^\$?([A-Z]+)\$?([1-9]\d*)$/i.exec(address.trim());
  if (!match) throw new Error(`Endereço inválido: ${address}`);
  const position = { row: Number(match[2]) - 1, column: columnIndex(match[1]) };
  if (!Number.isSafeInteger(position.row) || (bounds && !positionInBounds(position, bounds))) throw new Error(`Endereço fora do limite: ${address}`);
  return position;
}
export function normalizeCellAddress(address: string, bounds?: SheetBounds): string {
  return cellAddress(parseCellAddress(address, bounds));
}
export function parseCellRange(range: string, bounds?: SheetBounds) {
  const parts = range.split(":");
  if (parts.length > 2) throw new Error(`Intervalo inválido: ${range}`);
  const from = parseCellAddress(parts[0], bounds), to = parseCellAddress(parts[1] ?? parts[0], bounds);
  return { from: { row: Math.min(from.row, to.row), column: Math.min(from.column, to.column) }, to: { row: Math.max(from.row, to.row), column: Math.max(from.column, to.column) } };
}
export function rangeAddresses(range: string, bounds?: SheetBounds): string[] {
  const { from, to } = parseCellRange(range, bounds);
  const addresses: string[] = [];
  for (let row = from.row; row <= to.row; row++) for (let column = from.column; column <= to.column; column++) addresses.push(cellAddress({ row, column }));
  return addresses;
}

export function columnLabel(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

export function cellAddress(position: CellPosition): string {
  return `${columnLabel(position.column)}${position.row + 1}`;
}
