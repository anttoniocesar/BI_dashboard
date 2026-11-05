import { readXlsx, type ImportDiagnostics } from "./xlsxAdapter";
import { normalizeWorkbook } from "./normalizeWorkbook";
import { compatibilityReport, makeReport } from "./compatibility";
import { ImportFailure } from "./limits";
import type { ImportResult } from "./types";

export async function importWorkbook(input: Uint8Array, fileName: string): Promise<ImportResult> {
  const diagnostics: ImportDiagnostics = {stage:"package",sheetCount:0,parserBranch:"unselected",chartCount:0,relationCount:0};
  try {
    const imported = await readXlsx(input, fileName,diagnostics);
    diagnostics.stage = "normalization";
    const workbook = normalizeWorkbook(imported), report = compatibilityReport(workbook);
    diagnostics.stage = "complete";
    console.info(JSON.stringify({event:"xlsx_import",status:200,...diagnostics}));
    return { ok: true, workbook, report };
  } catch (error) {
    const failureKind = error instanceof ImportFailure ? error.code.startsWith("UNSUPPORTED") ? "unsupported" : "invalid" : "internal";
    // No filenames, sheet names, formulas, XML, stack traces or exception text in logs.
    console.warn(JSON.stringify({event:"xlsx_import",status:failureKind === "internal" ? 500 : 422,...diagnostics}));
    return { ok: false, failureKind, report: makeReport([{ level: "ERROR", code: error instanceof ImportFailure ? error.code : "IMPORT_INTERNAL_ERROR", message: error instanceof ImportFailure ? `Não foi possível importar: ${error.message}` : "Ocorreu um erro interno ao analisar a planilha. Tente novamente; se persistir, informe o suporte." }]) };
  }
}
