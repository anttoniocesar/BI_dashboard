import {test,expect,login,logout,noOverflow} from "./fixtures/e2e-test";
import {grantAndOpenCourse,switchUser} from "./fixtures/authenticated-test";
import type {Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {deletionWorkspace} from "./fixtures/exercise-deletion";
import {COURSE_STORAGE_KEY} from "../lib/repositories/InMemoryCourseRepository";
import {exerciseKey,type CourseWorkspace} from "../lib/repositories/CourseRepository";
import {applyCourseOperation} from "../lib/courses/authoring";
import {createAdminFixtures} from "../data/admin/demo";
import {chartWorkbookFixture} from "./fixtures/xlsx/chart-workbook";

const radio=(page:Page,id:string,version="0.1-draft")=>page.getByRole("dialog").locator(`input[type="radio"][value='${exerciseKey(id,version)}']`);
const current=(page:Page)=>page.locator(".activity-exercise-control");
async function seed(page:Page,workspace:CourseWorkspace=deletionWorkspace()){
  await page.goto("/login");await page.evaluate(({key,workspace})=>localStorage.setItem(key,JSON.stringify(workspace)),{key:COURSE_STORAGE_KEY,workspace});
  await login(page,"professor@example.com");await page.goto(`/studio/courses/${workspace.courses[0].id}`);
  await expect(current(page)).toContainText("laboratorio_1.xlsx · 0.1-draft");
  return workspace;
}
async function replace(page:Page,id="lab-2",version="0.1-draft"){
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await radio(page,id,version).check();
  await page.getByRole("button",{name:"Substituir",exact:true}).click();await expect(page.getByText("Exercício substituído com sucesso.",{exact:true})).toBeVisible();
}

test("Substituir UI: modal, busca, atual, confirmação, cancelar, Esc e foco",async({page})=>{
  const before=await seed(page);const button=page.getByRole("button",{name:"Substituir exercício",exact:true});await button.click();
  const modal=page.getByRole("dialog"),cancel=modal.getByRole("button",{name:"Cancelar",exact:true}),confirm=modal.getByRole("button",{name:"Substituir",exact:true});
  await expect(cancel).toBeFocused();await expect(modal).toHaveAccessibleName("Substituir exercício");await expect(radio(page,"lab-1")).toBeDisabled();await expect(modal.getByText("Atual",{exact:true})).toBeVisible();await expect(confirm).toBeDisabled();
  await page.getByLabel("Buscar exercício",{exact:true}).fill("0.1-draft");await expect(modal.getByRole("radio")).toHaveCount(3);
  await page.getByLabel("Buscar exercício",{exact:true}).fill("laboratorio_2");await expect(modal.getByRole("radio")).toHaveCount(2);
  await radio(page,"lab-2").check();await expect(modal).toContainText("Substituir “laboratorio_1.xlsx” (0.1-draft) por “laboratorio_2.xlsx” (0.1-draft)?");
  await confirm.focus();await page.keyboard.press("Tab");await expect(page.getByLabel("Buscar exercício",{exact:true})).toBeFocused();await page.keyboard.press("Shift+Tab");await expect(confirm).toBeFocused();
  await cancel.click();await expect(button).toBeFocused();await expect(current(page)).toContainText("laboratorio_1.xlsx");
  await button.click();await page.keyboard.press("Escape");await expect(button).toBeFocused();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).courses,COURSE_STORAGE_KEY)).toEqual(before.courses);
});
test("Substituir UI: uma gravação, atualização imediata, refresh, logout/login, preview e exclusão",async({page})=>{
  const before=await seed(page);
  await page.evaluate(key=>{const original=Storage.prototype.setItem;(window as unknown as {replacementWrites:number}).replacementWrites=0;Storage.prototype.setItem=function(k,v){if(k===key)(window as unknown as {replacementWrites:number}).replacementWrites++;original.call(this,k,v);};},COURSE_STORAGE_KEY);
  await replace(page);await expect(current(page)).toContainText("laboratorio_2.xlsx · 0.1-draft");
  expect(await page.evaluate(()=>(window as unknown as {replacementWrites:number}).replacementWrites)).toBe(1);
  await expect(page.getByRole("button",{name:"Substituir exercício",exact:true})).toBeFocused();
  await page.reload();await expect(current(page)).toContainText("laboratorio_2.xlsx");
  await logout(page);await login(page,"professor@example.com");await page.goto(`/studio/courses/${before.courses[0].id}`);await expect(current(page)).toContainText("laboratorio_2.xlsx");
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();await expect(page.getByText("laboratorio_2.xlsx",{exact:true})).toBeVisible();
  await page.goto("/studio/courses");const library=page.locator(".exercise-library-list > li");
  await library.filter({hasText:"laboratorio_1.xlsx"}).getByRole("button",{name:"Excluir",exact:true}).click();await expect(page.getByRole("button",{name:"Confirmar exclusão",exact:true})).toBeVisible();await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();await expect(library.filter({hasText:"laboratorio_1.xlsx"})).toHaveCount(0);
  await library.filter({hasText:"laboratorio_2.xlsx"}).first().getByRole("button",{name:"Excluir",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("está sendo utilizado por 1 atividade");
});
test("Substituir UI: nomes iguais e versões do mesmo ID são distinguíveis",async({page})=>{
  let workspace=deletionWorkspace();const state=createAdminFixtures(),teacher=state.users.find(u=>u.id==="teacher-neural")!;
  const entry=structuredClone(workspace.exercises[0]);entry.draft.version="0.2-draft";workspace=applyCourseOperation(workspace,{operation:"save-exercise",exercise:entry},teacher,state);
  await seed(page,workspace);await replace(page,"duplicate");
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).courses[0].chapters[0].activities[0].content.exerciseId,COURSE_STORAGE_KEY)).toBe("duplicate");
  await replace(page,"lab-1","0.2-draft");await expect(current(page)).toContainText("laboratorio_1.xlsx · 0.2-draft");
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await expect(radio(page,"lab-1","0.2-draft")).toBeDisabled();await expect(radio(page,"lab-1","0.1-draft")).toBeEnabled();
});
for(const status of ["published","archived"] as const)test(`Substituir UI: curso ${status} preserva regra existente`,async({page})=>{
  const workspace=deletionWorkspace();workspace.courses[0].status=status;await seed(page,workspace);
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("atividade publicada deve ser preservada");await expect(page.getByRole("dialog").getByRole("button")).toHaveCount(1);
});
test("Substituir UI: falha de storage mantém vínculo anterior",async({page})=>{
  await seed(page);await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new Error("quota");original.call(this,k,v);};},COURSE_STORAGE_KEY);
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await radio(page,"lab-2").check();await page.getByRole("button",{name:"Substituir",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Não foi possível substituir o exercício.");
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(current(page)).toContainText("laboratorio_1.xlsx");
});
test("Substituir UI: curso alterado em outra aba não é sobrescrito",async({page})=>{
  await seed(page);await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await radio(page,"lab-2").check();
  await page.evaluate(key=>{const data=JSON.parse(localStorage.getItem(key)!);data.courses[0].updatedAt=new Date(Date.now()+5000).toISOString();data.courses[0].title="Outra revisão";localStorage.setItem(key,JSON.stringify(data));},COURSE_STORAGE_KEY);
  await page.getByRole("button",{name:"Substituir",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("outra aba ou sessão");
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).courses[0].title,COURSE_STORAGE_KEY)).toBe("Outra revisão");
});
test("Substituir UI: biblioteca sem alternativa, importar e retornar ao curso; mobile sem overflow",async({page})=>{
  const workspace=deletionWorkspace();workspace.exercises=workspace.exercises.slice(0,1);await seed(page,workspace);await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Nenhum outro exercício disponível para substituição.");await noOverflow(page);await page.screenshot({path:"test-results/exercise-replacement-mobile.png"});
  await page.getByRole("link",{name:"Importar novo exercício",exact:true}).click();await page.getByLabel("Arquivo Excel",{exact:true}).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button",{name:/Analisar arquivo/}).click();await page.getByRole("button",{name:/Revisar abas/}).click();await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:/Voltar ao (curso|preview)/,exact:false}).click();await expect(page).toHaveURL(new RegExp(workspace.courses[0].id));await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(2);await noOverflow(page);
});
test("Substituir UI: reiniciar navegador com mesmo perfil mantém o vínculo",async({browser,baseURL})=>{
  const profile=await mkdtemp(path.join(tmpdir(),"bi-replacement-"));let context;
  try{
    context=await browser.browserType().launchPersistentContext(profile,{headless:true,executablePath:browser.browserType().executablePath(),baseURL});let page=await context.newPage();const before=await seed(page);await replace(page);await context.close();
    context=await browser.browserType().launchPersistentContext(profile,{headless:true,executablePath:browser.browserType().executablePath(),baseURL});page=await context.newPage();await page.goto("/login");await login(page,"professor@example.com");await page.goto(`/studio/courses/${before.courses[0].id}`);await expect(current(page)).toContainText("laboratorio_2.xlsx");
  }finally{await context?.close();if(path.dirname(profile)===path.resolve(tmpdir())&&path.basename(profile).startsWith("bi-replacement-"))await rm(profile,{recursive:true,force:true});}
});
test("Substituir aceite: LAB 1 original → LAB 2 original, preview, publicar, Learn e excluir antigo",async({page})=>{
  test.setTimeout(90000);await page.goto("/login");await login(page,"professor@example.com");
  for(const number of [1,2]){
    const file=number===1?process.env.BI_SOCIETY_CHART_REGRESSION_PATH:process.env.BI_SOCIETY_LAB2_REGRESSION_PATH,buffer=file?readFileSync(file):(await chartWorkbookFixture()).buffer;
    await page.goto("/studio/import");await page.getByLabel("Arquivo Excel",{exact:true}).setInputFiles({name:`laboratorio_${number}.xlsx`,mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer});await page.getByRole("button",{name:/Analisar arquivo/}).click();await page.getByRole("button",{name:/Revisar abas/}).click();await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  }
  await page.goto("/studio/courses");await page.getByRole("link",{name:"Novo curso",exact:true}).click();await page.getByLabel("Título do curso",{exact:true}).fill("Curso Teste Completo");await page.getByRole("button",{name:"Criar curso",exact:true}).click();await expect(page).toHaveURL(/\/studio\/courses\/course-/);const courseURL=page.url();
  await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Capítulo 1 — Introdução");await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();await page.getByRole("button",{name:"Nova atividade",exact:true}).click();await page.getByLabel("Título da atividade",{exact:true}).fill("Lab");await page.getByLabel("Tipo de atividade",{exact:true}).selectOption("spreadsheet-exercise");await page.getByLabel("Selecionar exercício",{exact:true}).selectOption({label:"laboratorio_1.xlsx · 0.1-draft"});await page.getByRole("button",{name:"Salvar atividade",exact:true}).click();await expect(current(page)).toContainText("laboratorio_1.xlsx");
  await page.goto("/studio/courses");await page.locator(".exercise-library-list > li").filter({hasText:"laboratorio_1.xlsx"}).getByRole("button",{name:"Excluir",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("não pode ser excluído");await page.getByRole("button",{name:"Cancelar",exact:true}).click();await page.goto(courseURL);
  await page.getByRole("button",{name:"Substituir exercício",exact:true}).click();await page.getByLabel("Buscar exercício",{exact:true}).fill("laboratorio_2.xlsx");await page.getByRole("dialog").getByRole("radio").check();await page.screenshot({path:"test-results/exercise-replacement-confirm.png"});await page.getByRole("button",{name:"Substituir",exact:true}).click();await expect(current(page)).toContainText("laboratorio_2.xlsx");
  await page.getByRole("button",{name:"Salvar",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Salvo · Rascunho"})).toBeVisible();await page.reload();await expect(current(page)).toContainText("laboratorio_2.xlsx");
  await page.getByRole("button",{name:"Editar exercício",exact:true}).click();await expect(page.getByRole("heading",{name:"laboratorio_2.xlsx",exact:true})).toBeVisible();await page.getByRole("link",{name:/Voltar ao (curso|preview)/,exact:false}).click();
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();await expect(page.getByText("laboratorio_2.xlsx",{exact:true})).toBeVisible();await page.goto(courseURL);await grantAndOpenCourse(page);await page.getByRole("link",{name:"Começar curso",exact:true}).click();await expect(page.getByText("laboratorio_2.xlsx",{exact:true})).toBeVisible();await page.getByRole("tab",{name:"Gabarito",exact:true}).click();await expect(page.getByRole("region",{name:"Evolução do erro absoluto por chapa",exact:true})).toBeVisible();
  await switchUser(page,"professor@example.com");await page.goto("/studio/courses");await page.locator(".exercise-library-list > li").filter({hasText:"laboratorio_1.xlsx"}).getByRole("button",{name:"Excluir",exact:true}).click();await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();await expect(page.locator(".exercise-library-list > li").filter({hasText:"laboratorio_1.xlsx"})).toHaveCount(0);
  await page.locator(".exercise-library-list > li").filter({hasText:"laboratorio_2.xlsx"}).getByRole("button",{name:"Excluir",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("Curso Teste Completo → Capítulo 1 — Introdução → Lab");
});
