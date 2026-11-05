import { test,expect,type Page,grantAndOpenCourse } from "./fixtures/authenticated-test";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";
const fixture="tests/fixtures/xlsx/merged-cells.xlsx";
const cell=(page:Page,address:string)=>page.getByRole("gridcell",{name:address,exact:true});
async function review(page:Page,file=fixture) {
  await page.goto("/studio/import");await page.getByLabel("Arquivo Excel",{exact:true}).setInputFiles(file);
  await page.getByRole("button",{name:/Analisar arquivo/}).click();await page.getByRole("button",{name:/Revisar abas/}).click();
}
async function openEditor(page:Page){await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();await expect(cell(page,"A1")).toBeVisible();await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);}
async function geometry(page:Page) {
  await expect(cell(page,"A1")).toHaveAttribute("aria-colspan","5");await expect(cell(page,"B1")).toHaveCount(0);
  await expect(cell(page,"H1")).toHaveAttribute("aria-rowspan","4");await expect(cell(page,"H2")).toHaveCount(0);
  await expect(cell(page,"B8")).toHaveAttribute("aria-rowspan","3");await expect(cell(page,"B8")).toHaveAttribute("aria-colspan","3");
  const metrics=await page.locator('.sheet-grid').evaluate(grid=>{
    const rect=(selector:string)=>grid.querySelector(selector)!.getBoundingClientRect();
    const a=rect('[aria-label="A1"]');const headers=[...grid.querySelectorAll('.column-heading')].slice(0,5).reduce((sum,node)=>sum+node.getBoundingClientRect().width,0);
    const v=rect('[aria-label="H1"]');const rows=[...grid.querySelectorAll('.row-heading')].slice(0,4).reduce((sum,node)=>sum+node.getBoundingClientRect().height,0);
    const context=grid.querySelector<HTMLElement>('[aria-label="A3"]')!;
    return {width:a.width,headers,height:v.height,rows,clipped:context.scrollHeight>context.clientHeight+1 || context.scrollWidth>context.clientWidth+1};
  });
  expect(Math.abs(metrics.width-metrics.headers)).toBeLessThan(2);expect(Math.abs(metrics.height-metrics.rows)).toBeLessThan(2);expect(metrics.clipped).toBe(false);
}
test("Merges UI: revisão HTML, preview Lab, Editor, seleção e duas simulações usam a mesma estrutura",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await review(page);
  await expect(page.locator('td[data-merge="A1:E1"]')).toHaveAttribute("colspan","5");await expect(page.locator('td[data-merge="A3:B4"]')).toHaveAttribute("rowspan","2");
  await page.screenshot({path:"test-results/merges-review.png",fullPage:true});
  await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();await geometry(page);await expect(cell(page,"A12")).toHaveText("7");
  await page.screenshot({path:"test-results/merges-import-preview.png",fullPage:true});
  await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);await geometry(page);
  const box=await cell(page,"A1").boundingBox();await cell(page,"A1").click({position:{x:box!.width*.6,y:12}});await expect(page.getByLabel("Célula selecionada",{exact:true})).toHaveText("A1");
  await expect(page.getByLabel("Conteúdo da célula",{exact:true})).toHaveValue("LABORATÓRIO 1 | CORREÇÃO DE ERRO");
  await page.screenshot({path:"test-results/merges-studio-editor.png",fullPage:true});
  for(const [open,close] of [["Visualizar como aluno","Voltar ao editor"],["Testar exercício","Sair do teste"]]) {
    await page.getByRole("button",{name:open,exact:true}).click();await geometry(page);await expect(cell(page,"A1")).toHaveAttribute("aria-readonly","true");await page.getByRole("button",{name:close,exact:true}).click();
  }
  expect(errors).toEqual([]);
});
test("Merges UI: edição da principal, rascunho reaberto e Learn preservam o merge",async({page})=>{
  await review(page);await openEditor(page);await cell(page,"A1").click();
  await page.getByLabel("Conteúdo da célula",{exact:true}).fill("CABECALHO MESCLADO EDITADO");await page.keyboard.press("Enter");
  await expect(cell(page,"A1")).toHaveText("CABECALHO MESCLADO EDITADO");await expect(cell(page,"B1")).toHaveCount(0);
  await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Meus cursos",exact:true}).click();await page.getByRole("link",{name:"Novo curso",exact:true}).click();
  await page.getByLabel("Título do curso",{exact:true}).fill("Curso com mesclagens");await page.getByRole("button",{name:"Criar curso",exact:true}).click();await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Prática mesclada");await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();await page.getByRole("button",{name:"Nova atividade",exact:true}).click();
  await page.getByLabel("Título da atividade",{exact:true}).fill("Lab mesclado");await page.getByLabel("Tipo de atividade",{exact:true}).selectOption("spreadsheet-exercise");await page.getByLabel("Selecionar exercício",{exact:true}).selectOption({index:1});await page.getByRole("button",{name:"Salvar atividade",exact:true}).click();
  await page.getByRole("button",{name:"Editar exercício",exact:true}).click();await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);await expect(cell(page,"A1")).toHaveText("CABECALHO MESCLADO EDITADO");await geometry(page);
  await page.getByRole("link",{name:"Voltar ao curso",exact:false}).click();await grantAndOpenCourse(page);await page.getByRole("link",{name:"Começar curso",exact:true}).click();
  await geometry(page);await expect(cell(page,"A1")).toHaveText("CABECALHO MESCLADO EDITADO");await expect(cell(page,"A1")).toHaveAttribute("aria-readonly","true");await expect(cell(page,"A12")).toHaveText("7");
  await page.screenshot({path:"test-results/merges-learn.png",fullPage:true});
});
test("Merges UI: teclado, proteção, fórmula, copiar/colar e autosave sobrevivem ao remount",async({page})=>{
  const imported=await importWorkbook(readFileSync(fixture),basename(fixture));expect(imported.ok).toBe(true);if(!imported.ok)return;
  const definition=createExerciseDefinitionFromImport(imported.workbook,{id:"merges-autosave",version:"1",cellPolicy:"editable"});
  definition.cellRules[definition.workbook.worksheets[0].id].cells={A1:"provided",B1:"editable"};
  await page.addInitScript(definition=>{window.repositoryOptions={importedDefinition:definition};},definition);await page.goto("http://localhost:3002");await geometry(page);
  await cell(page,"A1").click();await page.keyboard.type("apagado");await expect(cell(page,"A1")).toHaveText("LABORATÓRIO 1 | CORREÇÃO DE ERRO");
  await page.keyboard.press("Tab");await expect(cell(page,"F1")).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(cell(page,"A1")).toBeFocused();await page.keyboard.press("ArrowRight");await expect(cell(page,"F1")).toBeFocused();
  await cell(page,"H1").click();await page.keyboard.press("Enter");await expect(cell(page,"H5")).toBeFocused();await page.keyboard.press("ArrowUp");await expect(cell(page,"H1")).toBeFocused();
  await cell(page,"A12").click();await expect(page.getByLabel("Conteúdo da célula",{exact:true})).toHaveValue("=SUM(F12:G12)");
  await page.getByLabel("Conteúdo da célula",{exact:true}).fill("=SUM(F12:G12)*2");await page.keyboard.press("Enter");await expect(cell(page,"A12")).toHaveText("14");
  await cell(page,"C6").click();await page.keyboard.type("META EDITADA");await page.keyboard.press("Enter");await expect(cell(page,"C6")).toHaveText("META EDITADA");
  await cell(page,"C6").click();await cell(page,"C6").evaluate(node=>{const data=new DataTransfer();node.dispatchEvent(new ClipboardEvent("copy",{bubbles:true,clipboardData:data}));window.sessionStorage.setItem("merged-copy",data.getData("text/plain"));});
  await cell(page,"A7").click();await cell(page,"A7").evaluate(node=>{const data=new DataTransfer();data.setData("text/plain",window.sessionStorage.getItem("merged-copy")!);node.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,clipboardData:data}));});await expect(cell(page,"A7")).toHaveText("META EDITADA");
  await expect(page.getByRole("status",{name:"Status de salvamento",exact:true})).toContainText("Salvo");await page.evaluate(()=>window.remountLab());await expect(cell(page,"C6")).toHaveText("META EDITADA");await expect(cell(page,"A12")).toHaveText("14");await geometry(page);
});
test("Merges UI: regressão de cabeçalhos e contexto do XLSX local selecionado",async({page})=>{
  const file=process.env.BI_SOCIETY_MERGE_REGRESSION_PATH??fixture;await review(page,file);await openEditor(page);
  const merged=page.locator('.grid-cell[data-merge]');await expect(merged.first()).toBeVisible();await expect(page.getByRole("gridcell",{name:"A1",exact:true})).toContainText("LABORATÓRIO 1");
  for(const title of ["CONTEXTO DO PROBLEMA","OBJETIVO DO ALUNO"]) {
    const target=merged.filter({hasText:title});await expect(target).toHaveCount(1);
    expect(await target.evaluate(node=>node.scrollHeight<=node.clientHeight+1 && node.scrollWidth<=node.clientWidth+1)).toBe(true);
  }
  await page.screenshot({path:"test-results/merges-laboratorio-studio.png",fullPage:true});
  await page.getByRole("button",{name:"Visualizar como aluno",exact:true}).click();
  for(const title of ["CONTEXTO DO PROBLEMA","OBJETIVO DO ALUNO"]) {const target=page.locator('.grid-cell[data-merge]').filter({hasText:title});expect(await target.evaluate(node=>node.scrollHeight<=node.clientHeight+1)).toBe(true);}
  await page.screenshot({path:"test-results/merges-laboratorio-student.png",fullPage:true});
});
