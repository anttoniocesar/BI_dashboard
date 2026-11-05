import ExcelJS from "exceljs";
import { readPackage } from "../../../lib/excel-import/packageReader";
import { packageFixture } from "./package-fixture";

/** Structural fixture: qualified SpreadsheetML + absent optional workbookPr/views.
 * No relationship to a particular filename, author, account or local XLSX. */
export function qualifySpreadsheetParts(parts: Map<string,Buffer>, prefix = "book") {
  const next = new Map(parts);
  for (const [path,data] of next) {
    if (!/workbook\.xml$|styles\.xml$|sharedStrings\.xml$|worksheets\/[^/]+\.xml$/.test(path)) continue;
    const xml = data.toString().replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',`xmlns:${prefix}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`)
      .replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g,`<$1${prefix}:$2`)
      .replace(/\br:/g,"office:").replace(/xmlns:r=/g,"xmlns:office=");
    next.set(path,Buffer.from(xml));
  }
  return next;
}
export async function prefixedWorkbookFixture(prefix = "book") {
  const book = new ExcelJS.Workbook(), first = book.addWorksheet("Dados"), second = book.addWorksheet("Oculta",{state:"hidden"});
  first.getCell("A1").value = "A&B <texto>\nsegunda linha"; first.mergeCells("A1:C1"); first.getCell("A1").font = {bold:true,color:{argb:"FF123456"}};
  first.getCell("A2").value = 3; first.getCell("B2").value = {formula:"SUM(A2,2)",result:5}; first.getCell("B2").numFmt="0.00";
  second.getCell("A1").value = {formula:"Dados!B2",result:5};
  const parts = readPackage(Buffer.from(await book.xlsx.writeBuffer()));
  parts.set("xl/workbook.xml",Buffer.from(parts.get("xl/workbook.xml")!.toString().replace(/<workbookPr\b[^>]*\/>/g,"").replace(/<bookViews>[\s\S]*?<\/bookViews>/g,"")));
  const prefixed = qualifySpreadsheetParts(parts,prefix);
  return {parts:prefixed,buffer:packageFixture(prefixed)};
}
