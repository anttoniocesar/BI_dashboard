import FormulaParser, { type FunctionParameter, type Reference, type RangeReference, type Value } from "fast-formula-parser";
import { lex, type FormulaToken } from "fast-formula-parser/grammar/lexing";
import type { CalculatedCell, CalculatedWorkbook, CellPosition, SheetBounds, SheetData, Workbook } from "@/types/spreadsheet";
import { cellAddress, columnLabel, columnIndex, parseCellAddress } from "./coordinates";

const ErrorValue = FormulaParser.FormulaError;
export const SUPPORTED_FORMULA_FUNCTIONS: readonly string[] = Object.freeze(["SUM", "AVERAGE", "MIN", "MAX", "ABS", "SQRT", "POWER", "IF"]);
const functions = new Set(SUPPORTED_FORMULA_FUNCTIONS);
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

// Work on lexer tokens, never on string contents. Function tokens include their
// opening parenthesis; commas inside nested calls/parentheses are not separators.
function ifArguments(formula: string, tokens: FormulaToken[], start: number) {
  const args: string[] = [];
  let depth = 0, offset = tokens[start].endOffset + 1;
  for (let end = start + 1; end < tokens.length; end++) {
    const token = tokens[end], type = token.tokenType.name;
    if (type === "Function" || type === "OpenParen") depth++;
    if (type === "CloseParen") {
      if (depth === 0) {
        args.push(formula.slice(offset, token.startOffset));
        if (args.length !== 3 || !args[0].trim()) throw ErrorValue.VALUE;
        return { args, end };
      }
      depth--;
    }
    if (type === "Comma" && depth === 0) {
      args.push(formula.slice(offset, token.startOffset));
      offset = token.endOffset + 1;
    }
  }
  throw ErrorValue.VALUE;
}

function logicalValue(value: Value): boolean {
  if (value instanceof ErrorValue) throw value;
  if (typeof value === "string") {
    if (/^(true|false)$/i.test(value)) return value.toUpperCase() === "TRUE";
    throw ErrorValue.VALUE;
  }
  return Boolean(value);
}

function validReference(ref: Reference, bounds: SheetBounds): boolean {
  return ref.row >= 1 && ref.row <= bounds.rows && ref.col >= 1 && ref.col <= bounds.columns;
}

function rangeCells(ref: RangeReference, bounds: SheetBounds): Reference[][] {
  if (!validReference({ ...ref.from, sheet: ref.sheet }, bounds) || !validReference({ ...ref.to, sheet: ref.sheet }, bounds)) throw ErrorValue.REF;
  return Array.from({ length: ref.to.row - ref.from.row + 1 }, (_, row) =>
    Array.from({ length: ref.to.col - ref.from.col + 1 }, (_, col) => ({ row: ref.from.row + row, col: ref.from.col + col, sheet: ref.sheet })));
}

function key(ref: Reference): string {
  return cellAddress({ row: ref.row - 1, column: ref.col - 1 });
}

function literal(raw: string): Value {
  if (raw === "") return null;
  if (!numberPattern.test(raw.trim())) return raw;
  const value = Number(raw);
  return Number.isFinite(value) ? value : ErrorValue.NUM;
}

// Version 1.0.19 contains MIN/MAX stubs. Its extension API and parameter
// helper provide the same argument/range coercion used by SUM and AVERAGE.
function extreme(kind: "min" | "max", params: FunctionParameter[]): number {
  let result: number | undefined;
  FormulaParser.FormulaHelpers.flattenParams(params, FormulaParser.Types.NUMBER, true, value => {
    if (typeof value === "number") result = result === undefined ? value : Math[kind](result, value);
  });
  return result ?? 0;
}

// The package deduplicates ranges without comparing their sheet names. Keep every
// dependency here so equal coordinates on different sheets are all evaluated.
class WorkbookDependencyParser extends FormulaParser.DepParser {
  getCell(ref: Reference): number {
    if (ref.row != null) this.data.push({ ...ref, sheet: ref.sheet ?? this.position.sheet });
    return 0;
  }
  getRange(ref: RangeReference): number[][] {
    if (ref.from.row != null) this.data.push({ ...ref, sheet: ref.sheet ?? this.position.sheet });
    return [[0]];
  }
}

/** A fresh workbook-wide snapshot; never mutates or replaces user input. */
export function calculateWorkbook(workbook: Workbook, bounds: SheetBounds, sheetDimensions: Record<string, SheetBounds> = {}): CalculatedWorkbook {
  const values = new Map<string, Value>();
  const visiting = new Set<string>();
  const sheets = new Map(workbook.worksheets.map(sheet => [sheet.name.toLocaleLowerCase("pt-BR"), sheet]));
  const resolveSheet = (name?: string) => name ? sheets.get(name.toLocaleLowerCase("pt-BR")) : undefined;
  const referenceBounds = (ref: Reference | RangeReference) => sheetDimensions[resolveSheet(ref.sheet)?.id ?? ""] ?? bounds;
  const qualifiedKey = (ref: Reference) => JSON.stringify([resolveSheet(ref.sheet)?.id, key(ref)]);
  const dependencies = new WorkbookDependencyParser();
  const getValue = (ref: Reference): Value => validReference(ref, referenceBounds(ref)) && resolveSheet(ref.sheet) ? values.get(qualifiedKey(ref)) ?? null : ErrorValue.REF;
  const parser = new FormulaParser({
    functions: { MIN: (...params) => extreme("min", params), MAX: (...params) => extreme("max", params) },
    onCell: getValue,
    onRange: ref => rangeCells(ref, referenceBounds(ref)).map(row => row.map(getValue)),
  });

  function expression(formula: string, position: Reference): Value {
    const tokens = lex(formula).tokens;
    let reduced = "", offset = 0;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token.tokenType.name !== "Function" || token.image.toUpperCase() !== "IF(") continue;
      const { args, end } = ifArguments(formula, tokens, index);
      const condition = expression(args[0], position);
      const selected = args[logicalValue(condition) ? 1 : 2].trim() || "0";
      const result = expression(selected, position);
      if (result instanceof ErrorValue) throw result;
      // Serialize only a typed scalar produced by the parser, escaping Excel
      // quotes. User text can never become executable formula syntax.
      const scalar = typeof result === "string" ? `"${result.replaceAll('"', '""')}"`
        : typeof result === "boolean" ? result ? "TRUE" : "FALSE" : String(result ?? 0);
      reduced += formula.slice(offset, token.startOffset) + `(${scalar})`;
      offset = tokens[end].endOffset + 1;
      index = end;
    }
    reduced += formula.slice(offset);
    // Resolve only dependencies actually consumed. Each edit recalculates the
    // entire workbook from raw formulas, so references in BOTH original branches
    // remain available on the next snapshot; there is no pruned persistent graph.
    for (const dependency of dependencies.parse(reduced, position)) {
      const refs = "from" in dependency ? rangeCells(dependency, referenceBounds(dependency)).flat() : [dependency];
      for (const dependencyRef of refs) {
        const result = evaluate(dependencyRef);
        if (result instanceof ErrorValue) throw result;
      }
    }
    // Recursive dependency/IF evaluation finishes before this stateful parser runs.
    return parser.parse(reduced, position) ?? 0;
  }

  function evaluate(ref: Reference): Value {
    const sheet = resolveSheet(ref.sheet);
    if (!validReference(ref, referenceBounds(ref)) || !sheet) return ErrorValue.REF;
    const address = qualifiedKey(ref);
    if (values.has(address)) return values.get(address)!;
    if (visiting.has(address)) return new ErrorValue("#CYCLE!");
    const raw = sheet.cells[key(ref)] ?? "";
    if (!raw.startsWith("=")) {
      const value = literal(raw);
      values.set(address, value);
      return value;
    }
    visiting.add(address);
    let value: Value;
    try {
      const formula = raw.slice(1);
      const tokens = lex(formula).tokens;
      if (tokens.some(token => token.tokenType.name === "Function" && !functions.has(token.image.slice(0, -1).toUpperCase()))) throw ErrorValue.NAME;
      // Validate syntax and arity in both branches without evaluating either.
      dependencies.parse(formula, { ...ref, sheet: sheet.name });
      tokens.forEach((token, index) => {
        if (token.tokenType.name === "Function" && token.image.toUpperCase() === "IF(") ifArguments(formula, tokens, index);
      });
      value = expression(formula, { ...ref, sheet: sheet.name });
      if (typeof value === "number" && !Number.isFinite(value)) value = ErrorValue.NUM;
    } catch (error) {
      value = error instanceof ErrorValue ? error : new ErrorValue("#ERROR!");
    } finally {
      visiting.delete(address);
    }
    values.set(address, value);
    return value;
  }

  const calculated: CalculatedWorkbook = {};
  for (const sheet of workbook.worksheets) {
    calculated[sheet.id] = {};
    for (const [address, raw] of Object.entries(sheet.cells)) {
      let position: CellPosition;
      try { position = parseCellAddress(address); } catch { continue; }
      const result = evaluate({ row: position.row + 1, col: position.column + 1, sheet: sheet.name });
      const error = result instanceof ErrorValue ? result.toString() : undefined;
      calculated[sheet.id][address] = { raw, formula: raw.startsWith("=") ? raw : undefined, calculatedValue: error ?? result as CalculatedCell["calculatedValue"], error };
    }
  }
  return calculated;
}

/** Compatibility adapter for single-sheet consumers and Stage 2 regression tests. */
export function calculateSheet(data: SheetData, bounds: SheetBounds): Record<string, CalculatedCell> {
  return calculateWorkbook({ worksheets: [{ id: "sheet", name: "Planilha", cells: data }] }, bounds).sheet;
}

/** Token-based copy translation leaves strings, function names and whitespace intact. */
export function translateFormula(raw: string, source: CellPosition, target: CellPosition, bounds: SheetBounds): string {
  if (!raw.startsWith("=")) return raw;
  try {
    const tokens = lex(raw.slice(1)).tokens;
    let translated = raw;
    for (const token of [...tokens].reverse()) {
      if (token.tokenType.name !== "Cell") continue;
      const match = /^(\$?)([A-Z]+)(\$?)(\d+)$/i.exec(token.image);
      if (!match) continue;
      const [, fixedColumn, label, fixedRow, rowLabel] = match;
      const column = columnIndex(label) + (fixedColumn ? 0 : target.column - source.column);
      const row = Number(rowLabel) - 1 + (fixedRow ? 0 : target.row - source.row);
      const replacement = row < 0 || row >= bounds.rows || column < 0 || column >= bounds.columns
        ? "#REF!" : `${fixedColumn}${columnLabel(column)}${fixedRow}${row + 1}`;
      translated = translated.slice(0, token.startOffset + 1) + replacement + translated.slice(token.endOffset + 2);
    }
    return translated;
  } catch {
    return raw; // An incomplete formula is still editable and safe to copy.
  }
}

export function displayCell(cell: CalculatedCell | undefined): string {
  if (!cell) return "";
  if (!cell.formula) return cell.raw;
  if (typeof cell.calculatedValue === "number") return String(Number(cell.calculatedValue.toPrecision(12)));
  return String(cell.calculatedValue ?? "");
}
