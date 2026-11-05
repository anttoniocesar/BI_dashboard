import FormulaParser from "fast-formula-parser";
import { lex } from "fast-formula-parser/grammar/lexing";
import { SUPPORTED_FORMULA_FUNCTIONS } from "@/lib/spreadsheet/formula-engine";
import { parseCellAddress } from "@/lib/spreadsheet/coordinates";
import type { ImportedFormula, ImportedWorkbook, NormalizedFormula, NormalizedWorkbook, ImportIssue, ImportReport } from "./types";

export function analyzeFormula(formula: ImportedFormula, workbook: ImportedWorkbook, sheetName: string): NormalizedFormula {
  const reasons: string[] = [], functions: string[] = [];
  const structure = formula.expression.replace(/"(?:[^"]|"")*"/g, '""');
  const blocked = /\[[^\]]*\]|\||(?:https?|file|ftp):/i.test(structure) || /\b(?:WEBSERVICE|HYPERLINK|RTD|CALL|REGISTER|EXEC|RUN|IMAGE)\s*\(/i.test(structure);
  if (blocked) reasons.push("Referência externa, DDE, tabela estruturada ou recurso ativo bloqueado; não será avaliado.");
  let unsupported = blocked;
  // Shared formulas already have their relative expression expanded by the
  // adapter. Sharing alone adds no runtime limitation; arrays still do.
  let partial = formula.kind === "array";
  if (partial) reasons.push("Fórmula matricial: expressão recuperada; sem semântica de matriz dinâmica no Lab.");
  try {
    const tokens = lex(formula.expression.slice(1)).tokens;
    const unknown = new Set<string>();
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index], type = token.tokenType.name;
      if (type === "Function") {
        const name = token.image.slice(0, -1).toUpperCase();
        if (!functions.includes(name)) functions.push(name);
        if (!SUPPORTED_FORMULA_FUNCTIONS.includes(name)) unknown.add(name);
      }
      if (["Name", "OpenSquareParen", "CloseSquareParen", "OpenCurlyParen", "CloseCurlyParen", "At", "Semicolon"].includes(type)) {
        unsupported = true;
        reasons.push(`Sintaxe não habilitada no Lab: ${token.image}.`);
      }
      if (["Sheet", "SheetQuoted"].includes(type) && tokens[index + 1]?.tokenType.name === "Colon") {
        unsupported = true; reasons.push("Referências 3D não são suportadas.");
      }
      if (type === "Cell") {
        // The qualifier preceding a range also applies to its second endpoint.
        let qualifier = tokens[index - 1];
        if (tokens[index - 1]?.tokenType.name === "Colon") qualifier = tokens[index - 3];
        const name = qualifier && ["Sheet", "SheetQuoted"].includes(qualifier.tokenType.name)
          ? qualifier.image.slice(0, -1).replace(/^'|'$/g, "").replace(/''/g, "'") : sheetName;
        const sheet = workbook.worksheets.find(source => source.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
        try {
          if (!sheet) throw new Error();
          parseCellAddress(token.image, sheet.dimensions);
        } catch { partial = true; reasons.push(`Referência fora da grade importada ou aba ausente: ${name}!${token.image}.`); }
      }
    }
    if (unknown.size) { unsupported = true; reasons.push(`Funções não suportadas: ${[...unknown].join(", ")}.`); }
    if (!unsupported) {
      try { new FormulaParser.DepParser().parse(formula.expression.slice(1), { sheet: sheetName, row: 1, col: 1 }); }
      catch { unsupported = true; reasons.push("Sintaxe não reconhecida pelo parser atual do Lab."); }
    }
  } catch { unsupported = true; reasons.push("Expressão não reconhecida pelo lexer atual do Lab."); }
  return { ...formula, functions, reasons: [...new Set(reasons)], blocked,
    compatibility: unsupported ? "UNSUPPORTED" : partial ? "PARTIALLY_SUPPORTED" : "SUPPORTED" };
}

export function makeReport(items: ImportIssue[], workbook?: NormalizedWorkbook): ImportReport {
  const cells = workbook?.worksheets.flatMap(sheet => Object.values(sheet.cells)) ?? [];
  const formulas = cells.flatMap(cell => cell.formula ? [cell.formula] : []);
  return {
    sheets: workbook?.worksheets.length ?? 0, cells: cells.length,
    populatedCells: cells.filter(cell => cell.kind !== "blank").length, formulas: formulas.length,
    supportedFormulas: formulas.filter(formula => formula.compatibility === "SUPPORTED").length,
    partiallySupportedFormulas: formulas.filter(formula => formula.compatibility === "PARTIALLY_SUPPORTED").length,
    unsupportedFormulas: formulas.filter(formula => formula.compatibility === "UNSUPPORTED").length,
    charts: workbook?.charts.length ?? 0, importedCharts: workbook?.charts.filter(chart => chart.definition).length ?? 0,
    unsupportedCharts: workbook?.charts.filter(chart => !chart.definition).length ?? 0, warnings: items.filter(issue => issue.level === "WARNING").length,
    errors: items.filter(issue => issue.level === "ERROR").length, items,
  };
}

export function compatibilityReport(workbook: NormalizedWorkbook): ImportReport {
  const items: ImportIssue[] = [];
  for (const sheet of workbook.worksheets) {
    items.push({ level: "OK", code: "SHEET_IMPORTED", sheet: sheet.name, message: `Aba importada: ${sheet.name} (${sheet.dimensions.rows} × ${sheet.dimensions.columns}).` });
    if (!Object.values(sheet.cells).some(cell => cell.kind !== "blank")) items.push({ level: "WARNING", code: "EMPTY_SHEET", sheet: sheet.name, message: "Planilha vazia preservada; grade mínima 1×1 quando não há intervalo declarado." });
    items.push({level:sheet.mergeIssues?.length?"WARNING":"OK",code:sheet.mergeIssues?.length?"MERGES_PARTIALLY_SUPPORTED":"MERGES_SUPPORTED",sheet:sheet.name,
      message:`Merged cells: ${sheet.mergeIssues?.length?"Partially supported":"Supported"}. ${sheet.merges.length} mesclagens reproduzidas na grade.`});
    for(const issue of sheet.mergeIssues??[]) items.push({level:"WARNING",code:"INVALID_MERGE",sheet:sheet.name,cell:issue.range,message:`Mesclagem ${issue.range} não aplicada: ${issue.reason}.`});
    if (sheet.metadata.visibility !== "visible") items.push({ level: "WARNING", code: "HIDDEN_SHEET", sheet: sheet.name, message: "Estado oculto preservado como metadata; o Lab exibirá esta aba." });
    if (sheet.metadata.protection || Object.values(sheet.cells).some(cell => cell.styleId && workbook.styles[cell.styleId].protection)) items.push({ level: "WARNING", code: "PROTECTION_METADATA_ONLY", sheet: sheet.name, message: "Proteção Excel preservada como metadata; não determina papéis pedagógicos." });
    if (sheet.columns.some(column => column.width !== undefined) || sheet.rows.some(row => row.height !== undefined) || Object.values(sheet.cells).some(cell => cell.styleId)) items.push({ level: "WARNING", code: "STYLES_METADATA_ONLY", sheet: sheet.name, message: "Larguras e alinhamento básico aplicados; abas mescladas preservam alturas mínimas com expansão de texto. Demais estilos Excel permanecem como metadados." });
    for (const cell of Object.values(sheet.cells)) {
      if (cell.formula) items.push({ level: cell.formula.compatibility === "SUPPORTED" ? "OK" : "WARNING", code: `FORMULA_${cell.formula.compatibility}`, sheet: sheet.name, cell: cell.address,
        message: cell.formula.reasons.join(" ") || "Expressão compatível com o subconjunto atual do Lab; resultado será recalculado." });
      if (cell.kind === "boolean") items.push({ level: "WARNING", code: "BOOLEAN_ADAPTATION", sheet: sheet.name, cell: cell.address, message: "Booleano preservado no modelo e representado como =TRUE ou =FALSE no workbook textual do Lab." });
      if (cell.kind === "date" || cell.kind === "error") items.push({ level: "WARNING", code: "TYPED_VALUE_AS_TEXT", sheet: sheet.name, cell: cell.address, message: `${cell.kind === "date" ? "Data ISO" : "Erro Excel"} preservado com tipo no modelo; apresentado como texto no Lab.` });
      if (cell.hyperlink) items.push({ level: "WARNING", code: "HYPERLINK_INERT", sheet: sheet.name, cell: cell.address, message: "Hyperlink preservado como metadata; somente o texto será mostrado, sem seguir o endereço." });
      for (const message of cell.notices ?? []) items.push({ level: "WARNING", code: "CELL_PARTIAL_FEATURE", sheet: sheet.name, cell: cell.address, message });
    }
  }
  if (workbook.charts.length) {
    const imported = workbook.charts.filter(chart => chart.definition).length, unsupported = workbook.charts.length - imported;
    const complete = imported === workbook.charts.length && workbook.charts.every(chart => chart.compatibility === "SUPPORTED");
    items.push({ level: complete ? "OK" : "WARNING", code: imported ? complete ? "CHARTS_SUPPORTED" : "CHARTS_PARTIALLY_SUPPORTED" : "CHARTS_UNSUPPORTED",
      message: `Charts: ${complete ? "Supported" : imported ? "Partially supported" : "Unsupported"}. ${workbook.charts.length} detected / ${imported} imported${unsupported ? ` / ${unsupported} unsupported` : ""}.` });
    for (const chart of workbook.charts) items.push({ level: chart.compatibility === "SUPPORTED" ? "OK" : "WARNING", code: chart.definition ? chart.compatibility === "SUPPORTED" ? "CHART_IMPORTED" : "CHART_PARTIALLY_SUPPORTED" : "CHART_UNSUPPORTED", part: chart.part, sheet: chart.sheetName,
      message: `${chart.definition ? `Gráfico importado: ${chart.definition.title}` : "Gráfico não importado"} (${chart.types.join(", ") || "tipo não identificado"}). ${chart.reasons.join(" ")}` });
  }
  for (const feature of workbook.metadata.features) {
    const drawing = feature.kind === "WORKSHEET_DRAWING" && workbook.charts.some(chart => chart.definition);
    items.push({ level: drawing ? "OK" : "WARNING", code: feature.kind, part: feature.part, message: drawing ? "Drawing analisado; gráficos convertidos conforme o relatório Charts. Outros objetos não são executados." : `Recurso encontrado: ${feature.kind}. Preservado como inventário; não executado ou convertido.` });
  }
  if (workbook.metadata.definedNames.length) items.push({ level: "WARNING", code: "DEFINED_NAMES", message: `${workbook.metadata.definedNames.length} nomes definidos preservados como metadata; resolução de nomes não habilitada no Lab.` });
  items.push({ level: workbook.metadata.features.some(feature => feature.kind === "VBA") ? "WARNING" : "OK", code: "VBA_SCAN", message: workbook.metadata.features.some(feature => feature.kind === "VBA") ? "Macros VBA encontradas; nenhum código será executado." : "Macros VBA: não encontradas nas partes inspecionadas." });
  items.push({ level: "WARNING", code: "NO_PEDAGOGICAL_INFERENCE", message: "Sem respostas/gabarito inferidos. Estilos são metadados; conversão padrão usa células fornecidas, sem avaliação e corte provisório de 100%." });
  return makeReport(items, workbook);
}
