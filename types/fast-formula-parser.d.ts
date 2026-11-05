// The pinned package has no TypeScript declarations. Only the adapter uses these APIs.
declare module "fast-formula-parser" {
  export type Reference = { row: number; col: number; sheet?: string };
  export type RangeReference = { from: Reference; to: Reference; sheet?: string };
  export class FormulaError extends Error {
    constructor(code: string);
    static REF: FormulaError;
    static NAME: FormulaError;
    static NUM: FormulaError;
    static VALUE: FormulaError;
  }
  export type Value = number | string | boolean | null | FormulaError;
  export type FunctionParameter = { value: Value | Value[][]; isArray: boolean; isCellRef?: boolean; isRangeRef?: boolean };
  export class DependencyParser {
    data: (Reference | RangeReference)[];
    position: Reference;
    parse(formula: string, position: Reference): (Reference | RangeReference)[];
    getCell(reference: Reference): number;
    getRange(reference: RangeReference): number[][];
  }
  export default class FormulaParser {
    static FormulaError: typeof FormulaError;
    static DepParser: typeof DependencyParser;
    static Types: { NUMBER: number };
    static FormulaHelpers: { flattenParams(params: FunctionParameter[], type: number, allowUnion: boolean, callback: (value: Value) => void): void };
    constructor(config: {
      functions?: Record<string, (...args: FunctionParameter[]) => Value>;
      onCell: (reference: Reference) => Value;
      onRange: (reference: RangeReference) => Value[][];
    });
    parse(formula: string, position: Reference): Value;
  }
}

declare module "fast-formula-parser/grammar/lexing" {
  export type FormulaToken = { image: string; startOffset: number; endOffset: number; tokenType: { name: string } };
  export function lex(formula: string): { tokens: FormulaToken[] };
}
