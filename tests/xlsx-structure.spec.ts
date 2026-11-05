import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { readPackage, xmlElements, xmlTree } from "../lib/excel-import/packageReader";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { validateExerciseDefinition } from "../lib/exercises/definition";
import { POST } from "../app/api/studio/import/route";
import { prefixedWorkbookFixture, qualifySpreadsheetParts } from "./fixtures/xlsx/prefixed-workbook";
import { packageFixture } from "./fixtures/xlsx/package-fixture";
import { chartWorkbookFixture } from "./fixtures/xlsx/chart-workbook";

for (const prefix of ["x","otherPrefix"]) test(`XLSX estrutura: namespace ${prefix}, sem workbookPr/views, duas abas e oculta`,async () => {
  const {buffer} = await prefixedWorkbookFixture(prefix), result = await importWorkbook(buffer,"qualquer-nome.xlsx");
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.workbook.worksheets.map(s=>s.name)).toEqual(["Dados","Oculta"]);
  expect(result.workbook.worksheets[1].metadata.visibility).toBe("hidden");
  expect(result.workbook.worksheets[0].merges).toEqual(["A1:C1"]);
  expect(result.workbook.worksheets[0].cells.B2.formula?.expression).toBe("=SUM(A2,2)");
  expect(result.workbook.worksheets[0].cells.A1.value).toBe("A&B <texto>\nsegunda linha");
  expect(result.workbook.styles[result.workbook.worksheets[0].cells.A1.styleId!]).toMatchObject({bold:true,fontColor:{argb:"FF123456"}});
  expect(result.workbook.styles[result.workbook.worksheets[0].cells.B2.styleId!].numberFormat).toBe("0.00");
  validateExerciseDefinition(createExerciseDefinitionFromImport(result.workbook,{id:"structural",version:"0.1-draft"}));
});

test("XLSX estrutura: gráfico em diretório aninhado e namespace qualificado",async () => {
  const fixture = await chartWorkbookFixture();
  const parts = qualifySpreadsheetParts(fixture.parts);
  parts.set("xl/drawings/charts/chart1.xml",parts.get("xl/charts/chart1.xml")!);parts.delete("xl/charts/chart1.xml");
  for (const [name,data] of parts) if (/drawings\/_rels\/.*rels$/.test(name)) parts.set(name,Buffer.from(data.toString().replace("../charts/chart1.xml","charts/chart1.xml")));
  const result = await importWorkbook(packageFixture(parts),"nested.xlsx");
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.report.charts).toBe(1);expect(result.report.importedCharts).toBe(1);
  expect(result.workbook.charts[0].part).toBe("xl/drawings/charts/chart1.xml");
});

for (const missing of ["drawing","optional-relation"]) test(`XLSX estrutura: ${missing} ausente não derruba worksheets`,async () => {
  const fixture = await chartWorkbookFixture();
  const parts = qualifySpreadsheetParts(fixture.parts);
  if (missing === "drawing") parts.delete("xl/drawings/drawing1.xml");
  else for (const name of parts.keys()) if (/worksheets\/_rels\/.*rels$/.test(name)) parts.delete(name);
  const result = await importWorkbook(packageFixture(parts),"optional.xlsx");
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.workbook.worksheets).toHaveLength(2); expect(result.report.warnings).toBeGreaterThan(0);
});

for (const invalid of ["missing-workbook","missing-sheet","missing-relation","invalid-id","invalid-xml","wrong-namespace"]) test(`XLSX estrutura: ${invalid} gera erro de domínio sem TypeError`,async () => {
  const {parts} = await prefixedWorkbookFixture();
  if (invalid === "missing-workbook") parts.delete("xl/workbook.xml");
  if (invalid === "missing-sheet") parts.delete("xl/worksheets/sheet1.xml");
  if (invalid === "missing-relation") parts.delete("xl/_rels/workbook.xml.rels");
  if (invalid === "invalid-id") parts.set("xl/workbook.xml",Buffer.from(parts.get("xl/workbook.xml")!.toString().replace(/office:id="[^"]+"/,"office:id=\"missing\"")));
  if (invalid === "invalid-xml") parts.set("xl/workbook.xml",Buffer.from("<incomplete"));
  if (invalid === "wrong-namespace") parts.set("xl/workbook.xml",Buffer.from(parts.get("xl/workbook.xml")!.toString().replaceAll("http://schemas.openxmlformats.org/spreadsheetml/2006/main","urn:unsupported")));
  const response = await POST(new Request("http://localhost/api/studio/import",{method:"POST",headers:{"X-File-Name":"invalid.xlsx"},body:Uint8Array.from(packageFixture(parts)).buffer}));
  expect(response.status).toBe(422); const result = await response.json();
  expect(result.failureKind).toBe(invalid === "wrong-namespace" ? "unsupported" : "invalid");
  expect(JSON.stringify(result)).not.toMatch(/TypeError|Cannot read|reading 'sheets'|node_modules/);
});

test("XLSX estrutura: erro interno retorna 500 e logs contêm somente contexto seguro",async () => {
  const prototype = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx), original = prototype.load;
  const logs: string[] = [], warn = console.warn;
  try {
    prototype.load = async () => {throw new TypeError("sensitive formula private sheet reading sheets");};
    console.warn = value => {logs.push(String(value));};
    const {buffer} = await prefixedWorkbookFixture();
    const response = await POST(new Request("http://localhost/api/studio/import",{method:"POST",headers:{"X-File-Name":"private-name.xlsx"},body:Uint8Array.from(buffer).buffer}));
    expect(response.status).toBe(500); expect((await response.json()).report.items[0].code).toBe("IMPORT_INTERNAL_ERROR");
    expect(logs.join()).not.toMatch(/sensitive|private|formula|TypeError/);
    expect(JSON.parse(logs[0])).toMatchObject({stage:"parser",sheetCount:2,parserBranch:"namespace-normalized",chartCount:0,relationCount:expect.any(Number)});
  } finally {prototype.load = original; console.warn = warn;}
});

for (const number of [1,2]) test(`XLSX estrutura: LAB ${number} original, endpoint, fórmulas, merges e gráfico`,async () => {
  const file = number === 1 ? process.env.BI_SOCIETY_CHART_REGRESSION_PATH : process.env.BI_SOCIETY_LAB2_REGRESSION_PATH;
  const bytes = file ? readFileSync(file) : (await prefixedWorkbookFixture()).buffer;
  const response = await POST(new Request("http://localhost/api/studio/import",{method:"POST",headers:{"X-File-Name":"regression.xlsx"},body:Uint8Array.from(bytes).buffer}));
  expect(response.status).toBe(200); const result = await response.json(); expect(result.ok).toBe(true);
  validateExerciseDefinition(createExerciseDefinitionFromImport(result.workbook,{id:"real-regression",version:"0.1-draft"}));
  const parts = readPackage(bytes), sources = [...parts].filter(([name])=>/^xl\/worksheets\/[^/]+\.xml$/.test(name));
  const formulas = sources.flatMap(([,data])=>xmlElements(data,["f"])), merges = sources.flatMap(([,data])=>xmlElements(data,["mergeCell"]));
  expect(result.report.formulas).toBe(formulas.length);
  expect(result.workbook.worksheets.flatMap((s:{merges:unknown[]})=>s.merges)).toHaveLength(merges.length);
  if (file) {
    expect(result.workbook.worksheets.map((s:{name:string})=>s.name)).toEqual(["Laboratório","Prática","Gabarito"]);
    expect(result.report).toMatchObject({formulas:110,charts:1,importedCharts:1,errors:0});
    for (const [,data] of sources) {
      const cells = xmlTree(data).children.find(node=>node.name==="sheetData")!.children.flatMap(row=>row.children);
      const sourceFormulas = cells.flatMap(cell=>cell.children.filter(node=>node.name==="f" && node.text).map(node=>({address:cell.attributes.r,expression:`=${node.text}`})));
      // Shared formula followers have empty OOXML <f/> nodes; ExcelJS expands
      // them to relative expressions. Compare every explicit master/normal formula.
      const sheetNames = xmlElements(parts.get("xl/workbook.xml"),["sheet"]).map(s=>s.attributes.name);
      const index = sources.findIndex(([,bytes])=>bytes===data), sheet = result.workbook.worksheets.find((s:{name:string})=>s.name===sheetNames[index]);
      for (const formula of sourceFormulas) expect(sheet.cells[formula.address].formula.expression).toBe(formula.expression);
    }
    const chartParts = [...parts].filter(([name,data])=>name.endsWith(".xml") && xmlTree(data).name === "chartSpace");expect(chartParts).toHaveLength(1);
    const diagnostic = {lab:number,sheets:result.workbook.worksheets.map((s:{name:string;metadata:unknown;merges:unknown[]})=>({name:s.name,metadata:s.metadata,merges:s.merges.length})),formulas:formulas.length,charts:result.report.charts,importedCharts:result.report.importedCharts,styles:Object.keys(result.workbook.styles).length,definedNames:result.workbook.metadata.definedNames.length,drawings:[...parts.keys()].filter(p=>/^xl\/drawings\/[^/]+\.xml$/.test(p)).length,externalRelations:result.workbook.metadata.features.filter((f:{kind:string})=>f.kind==="EXTERNAL_RELATIONSHIP").length,report:result.report};
    await test.info().attach(`lab-${number}-diagnostic`,{body:JSON.stringify(diagnostic,null,2),contentType:"application/json"});
    console.log(JSON.stringify({...diagnostic,report:{...diagnostic.report,items:undefined}}));
  }
});
