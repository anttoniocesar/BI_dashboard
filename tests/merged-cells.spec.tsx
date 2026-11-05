import { test,expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
import { inspectMerges,mergeAnchor,moveMergedCell,coveredByMerge } from "../lib/spreadsheet/merges";
import { cloneWorkbook,freezeWorkbook } from "../lib/spreadsheet/workbook";
import { createDraft,buildDefinition } from "../lib/studio/exerciseDraft";
import { validateExerciseDefinition,workbookBounds } from "../lib/exercises/definition";
import { calculateWorkbook } from "../lib/spreadsheet/formula-engine";
import { SpreadsheetEditor } from "../components/spreadsheet/SpreadsheetEditor";
import { SheetPreview } from "../components/studio/import/SheetPreview";
import { readPackage } from "../lib/excel-import/packageReader";
import { packageFixture } from "./fixtures/xlsx/package-fixture";
import { reviewImport } from "../lib/excel-import/reviewImport";
const bounds={rows:14,columns:8};
async function imported(){const result=await importWorkbook(readFileSync("tests/fixtures/xlsx/merged-cells.xlsx"),"merged-cells.xlsx");expect(result.ok,JSON.stringify(result.report)).toBe(true);if(!result.ok)throw new Error("Fixture inválida");return result;}
async function definition(){return createExerciseDefinitionFromImport((await imported()).workbook,{id:"merges",version:"1"});}
test("Merges: coordenadas horizontais, verticais e retangulares são normalizadas e validadas",()=>{
  for(const [range,expected] of [["A1:E1",{startRow:0,startCol:0,endRow:0,endCol:4}],["A1:A4",{startRow:0,startCol:0,endRow:3,endCol:0}],["B2:D4",{startRow:1,startCol:1,endRow:3,endCol:3}]] as const) expect(inspectMerges([range],bounds)).toEqual({merges:[expected],issues:[]});
  const checked=inspectMerges(["A1:E1","B1:F1","D4:B2","A1:A99","invalid","A7:A7"],bounds);
  expect(checked.merges).toHaveLength(1);expect(checked.issues).toHaveLength(5);
});
test("Merges: seleção e teclado resolvem principal, saltam cobertas e saem nos limites",()=>{
  const merges=inspectMerges(["A1:E1","A3:B4","B8:D10","G14:H14"],bounds).merges;
  expect(mergeAnchor(merges,{row:0,column:2})).toEqual({row:0,column:0});expect(coveredByMerge(merges,{row:3,column:1})).toBe(true);
  expect(moveMergedCell({row:0,column:0},0,1,true,bounds,merges)).toEqual({row:0,column:5});
  expect(moveMergedCell({row:0,column:5},0,-1,true,bounds,merges)).toEqual({row:0,column:0});
  expect(moveMergedCell({row:2,column:0},1,0,false,bounds,merges)).toEqual({row:4,column:0});
  expect(moveMergedCell({row:7,column:1},0,1,false,bounds,merges)).toEqual({row:7,column:4});
  expect(moveMergedCell({row:10,column:2},-1,0,false,bounds,merges)).toEqual({row:7,column:1});
  expect(moveMergedCell({row:13,column:6},0,1,true,bounds,merges)).toBeNull();
  expect(moveMergedCell({row:0,column:0},0,-1,true,bounds,merges)).toBeNull();
});
test("Merges: XLSX real preserva principais, spans e fórmula sem cache ou duplicação",async()=>{
  const result=await imported(),sheet=result.workbook.worksheets[0];
  expect(sheet.merges).toEqual(expect.arrayContaining(["A1:E1","A3:B4","C6:F6"]));expect(sheet.cells.B1.mergedInto).toBe("A1");
  const def=await definition(),master=def.workbook.worksheets[0];expect(master.merges).toHaveLength(6);expect(master.cells.A1).toContain("LABORATÓRIO 1");expect(master.cells.B1).toBe("");expect(master.cells.A12).toBe("=SUM(F12:G12)");
  expect(calculateWorkbook(cloneWorkbook(def.workbook),def.dimensions,workbookBounds(def))[master.id].A12.calculatedValue).toBe(7);
  expect(result.report.items.find(item=>item.code==="MERGES_SUPPORTED")?.message).toContain("Merged cells: Supported");
  expect(def.sheets?.[master.id]?.columnWidths?.A).toBe(110);expect(def.sheets?.[master.id]?.rowHeights?.["1"]).toBe(40);
});
test("Merges: XLSX com overlap, inversão e range inválido importa com aviso específico",async()=>{
  const parts=readPackage(readFileSync("tests/fixtures/xlsx/merged-cells.xlsx"));
  const name="xl/worksheets/sheet1.xml";parts.set(name,Buffer.from(parts.get(name)!.toString().replace("</mergeCells>",'<mergeCell ref="B1:F1"/><mergeCell ref="D4:B2"/><mergeCell ref="A1:XFD1"/></mergeCells>')));
  const result=await importWorkbook(packageFixture(parts),"invalid-merges.xlsx");expect(result.ok).toBe(true);
  expect(result.report.items.find(item=>item.code==="MERGES_PARTIALLY_SUPPORTED")?.message).toContain("Partially supported");
  expect(result.report.items.filter(item=>item.code==="INVALID_MERGE").map(item=>item.cell)).toEqual(["B1:F1","D4:B2","A1:XFD1"]);
});
test("Merges: draft, definição, JSON e cópias preservam estrutura independente e congelada",async()=>{
  const def=await definition(),draft=createDraft(def),next=buildDefinition(draft,true);
  expect(next.workbook.worksheets[0].merges).toEqual(def.workbook.worksheets[0].merges);
  const clone=cloneWorkbook(next.workbook);clone.worksheets[0].merges![0].endCol=3;
  expect(next.workbook.worksheets[0].merges![0].endCol).toBe(4);expect(Object.isFrozen(next.workbook.worksheets[0].merges![0])).toBe(true);
  expect(()=>validateExerciseDefinition(JSON.parse(JSON.stringify(next)))).not.toThrow();
  expect(Object.isFrozen(freezeWorkbook(clone).worksheets[0].merges)).toBe(true);
});
test("Merges: runtime recusa limites, overlap e conteúdo subordinado; legado sem merges continua válido",async()=>{
  const def=await definition();
  for(const merges of [[{startRow:-1,startCol:0,endRow:1,endCol:1}],[{startRow:0,startCol:0,endRow:1,endCol:99}],[{startRow:2,startCol:0,endRow:1,endCol:1}],[{startRow:0,startCol:0,endRow:0,endCol:2},{startRow:0,startCol:1,endRow:1,endCol:2}]]) {
    const invalid=createDraft(def);invalid.workbook.worksheets[0].merges=merges;expect(()=>validateExerciseDefinition(invalid)).toThrow(/mesclagem/);
  }
  const hidden=createDraft(def);hidden.workbook.worksheets[0].cells.B1="=1+1";expect(()=>validateExerciseDefinition(hidden)).toThrow(/principal/);
  // Text ranges belong to the importer, not the runtime CellMerge contract.
  // Accepting them here would let cloneWorkbook spread strings into broken objects.
  for (const merges of [["A1:E1"], [null], [{startRow:0.5,startCol:0,endRow:1,endCol:1}]]) {
    const invalid=JSON.parse(JSON.stringify(def));invalid.workbook.worksheets[0].merges=merges;
    expect(()=>validateExerciseDefinition(invalid)).toThrow(/mesclagem/);
  }
  const emptyAnchor=createDraft(def);delete emptyAnchor.workbook.worksheets[0].cells.A1;
  expect(()=>validateExerciseDefinition(emptyAnchor)).not.toThrow();
  const legacy=createDraft(def);delete legacy.workbook.worksheets[0].merges;expect(()=>validateExerciseDefinition(legacy)).not.toThrow();
});
test("Merges: renderer compartilhado omite células cobertas e usa papel da principal",async()=>{
  const def=await definition();def.cellRules[def.workbook.worksheets[0].id].cells={A1:"provided",B1:"editable"};
  const html=renderToStaticMarkup(createElement(SpreadsheetEditor,{definition:def,initialSession:null,initialSaveState:{status:"idle",lastSavedAt:null},onSaveStatus:()=>{}}));
  expect(html).toContain('data-merge="A1:E1"');expect(html).toContain('aria-colspan="5"');expect(html).toContain('aria-rowspan="4"');
  expect(html).not.toContain('aria-label="B1"');expect(html).not.toContain('aria-label="H2"');
  expect(html).toMatch(/aria-label="A1"[^>]*aria-readonly="true"/);expect(html).toContain("cell-provided merged-cell");
});
test("Merges: revisão e preview readonly preservam spans, texto e janela completa de merge",async()=>{
  const result=await imported();const sheet=result.workbook.worksheets[0];
  const html=renderToStaticMarkup(createElement(SheetPreview,{sheet,styles:result.workbook.styles}));
  expect(html).toContain('colSpan="5"');expect(html).toContain('rowSpan="4"');expect(html).toContain("CONTEXTO DO PROBLEMA");expect(html).not.toContain('aria-label="B1,');
  const kept=reviewImport(result.workbook,[sheet.id],{values:true,formulas:true,formatting:true});expect(kept.ok&&kept.workbook.worksheets[0].merges).toEqual(sheet.merges);
  const omitted=reviewImport(result.workbook,[sheet.id],{values:true,formulas:true,formatting:false});expect(omitted.ok&&omitted.workbook.worksheets[0].merges).toEqual([]);
});
