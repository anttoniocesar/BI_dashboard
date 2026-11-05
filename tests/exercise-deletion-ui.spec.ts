import { test, expect, login, logout } from "./fixtures/e2e-test";
import type { Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deletionWorkspace } from "./fixtures/exercise-deletion";
import { COURSE_STORAGE_KEY } from "../lib/repositories/InMemoryCourseRepository";
import { chartWorkbookFixture } from "./fixtures/xlsx/chart-workbook";

async function seed(page: Page) {
  await page.goto("/login");
  await page.evaluate(({key,workspace}) => localStorage.setItem(key,JSON.stringify(workspace)),{key:COURSE_STORAGE_KEY,workspace:deletionWorkspace()});
  await login(page,"professor@example.com");
  await expect(page.locator(".exercise-library-list > li")).toHaveCount(3);
}
const row = (page: Page, title: string) => page.locator(".exercise-library-list > li").filter({hasText:title});

test("Excluir exercício UI: confirmação, cancelar, Esc, Tab, retorno de foco, nomes iguais e refresh",async ({page}) => {
  await seed(page);
  const originalCourses = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).courses,COURSE_STORAGE_KEY);
  const target = row(page,"laboratorio_2.xlsx").first(), trigger = target.getByRole("button",{name:"Excluir",exact:true});
  await trigger.click();
  const modal = page.getByRole("dialog"), cancel = modal.getByRole("button",{name:"Cancelar",exact:true}), confirm = modal.getByRole("button",{name:"Confirmar exclusão",exact:true});
  await expect(modal).toHaveAccessibleName(/Deseja excluir o exercício/);
  await expect(cancel).toBeFocused(); await expect(modal.getByText("0.1-draft",{exact:true})).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).exercises.length,COURSE_STORAGE_KEY)).toBe(3);
  await page.keyboard.press("Tab"); await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab"); await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(confirm).toBeFocused();
  await cancel.click(); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(2);
  await trigger.click(); await confirm.click();
  await expect(page.getByText("Exercício excluído.",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Exercícios da sessão",exact:true})).toBeFocused();
  await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(1);
  await expect(row(page,"laboratorio_1.xlsx")).toHaveCount(1);
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!),COURSE_STORAGE_KEY);
  expect(persisted.exercises.map((e:{id:string}) => e.id)).toEqual(["lab-1","duplicate"]);
  expect(persisted.courses).toEqual(originalCourses);
  await page.reload(); await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(1);
  await logout(page); await login(page,"professor@example.com"); await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(1);
  await row(page,"laboratorio_1.xlsx").getByRole("button",{name:"Abrir",exact:true}).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.locator(".lab-view")).toBeVisible();
});

for (const status of ["draft","published"] as const) test(`Excluir exercício UI: vínculo em curso ${status} permite somente cancelar`,async ({page}) => {
  await seed(page);
  if (status === "published") {
    await page.evaluate(key => {const data=JSON.parse(localStorage.getItem(key)!);data.courses[0].status="published";localStorage.setItem(key,JSON.stringify(data));},COURSE_STORAGE_KEY);
    await page.reload();
  }
  await row(page,"laboratorio_1.xlsx").getByRole("button",{name:"Excluir",exact:true}).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("Este exercício está sendo utilizado por 1 atividade");
  await expect(modal).toContainText("Curso Teste Completo → Capítulo 1 — Introdução → Lab");
  await expect(modal.getByRole("button")).toHaveCount(1);
  await modal.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(page.locator(".exercise-library-list > li")).toHaveCount(3);
});

test("Excluir exercício UI: falha de storage mostra erro e mantém exercício",async ({page}) => {
  await seed(page);
  await page.evaluate(key => {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException("quota","QuotaExceededError");original.call(this,k,v);};},COURSE_STORAGE_KEY);
  await row(page,"laboratorio_2.xlsx").first().getByRole("button",{name:"Excluir",exact:true}).click();
  await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Não foi possível excluir o exercício.");
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(2);
});

test("Excluir exercício UI: vínculo criado após abrir modal é recusado pelo repositório",async ({page}) => {
  await seed(page);
  await row(page,"laboratorio_2.xlsx").first().getByRole("button",{name:"Excluir",exact:true}).click();
  await page.evaluate(key => {const data=JSON.parse(localStorage.getItem(key)!);const activity=structuredClone(data.courses[0].chapters[0].activities[0]);activity.id="late";activity.content.exerciseId="lab-2";data.courses[0].chapters[0].activities.push(activity);localStorage.setItem(key,JSON.stringify(data));},COURSE_STORAGE_KEY);
  await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Curso Teste Completo → Capítulo 1 — Introdução → Lab");
  await expect(page.getByRole("dialog").getByRole("button")).toHaveCount(1);
});

test("Excluir exercício UI: fechar navegador e reabrir perfil preserva exclusão",async ({browser,baseURL}) => {
  const profile = await mkdtemp(path.join(tmpdir(),"bi-exercise-deletion-"));
  let context;
  try {
    context = await browser.browserType().launchPersistentContext(profile,{headless:true,executablePath:browser.browserType().executablePath(),baseURL});
    let page = await context.newPage(); await seed(page);
    await row(page,"laboratorio_2.xlsx").first().getByRole("button",{name:"Excluir",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();
    await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(1);
    await context.close();
    context = await browser.browserType().launchPersistentContext(profile,{headless:true,executablePath:browser.browserType().executablePath(),baseURL});
    page = await context.newPage(); await page.goto("/login"); await login(page,"professor@example.com");
    await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(1);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).exercises.some((e:{id:string}) => e.id==="lab-2"),COURSE_STORAGE_KEY)).toBe(false);
  } finally { await context?.close(); await rm(profile,{recursive:true,force:true}); }
});

test("Excluir exercício aceite: importar LAB 1/2, vincular LAB 1, excluir LAB 2 e recarregar",async ({page}) => {
  test.setTimeout(90000);
  await page.goto("/login"); await login(page,"professor@example.com");
  for (const number of [1,2]) {
    const file = number === 1 ? process.env.BI_SOCIETY_CHART_REGRESSION_PATH : process.env.BI_SOCIETY_LAB2_REGRESSION_PATH;
    const buffer = file ? readFileSync(file) : (await chartWorkbookFixture()).buffer;
    await page.goto("/studio/import");
    await page.getByLabel("Arquivo Excel",{exact:true}).setInputFiles({name:`laboratorio_${number}.xlsx`,mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer});
    await page.getByRole("button",{name:/Analisar arquivo/}).click();
    await page.getByRole("button",{name:/Revisar abas/}).click();
    await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();
    await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();
    await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();
    await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  }
  await page.goto("/studio/courses");
  await page.getByRole("link",{name:"Novo curso",exact:true}).click();
  await page.getByLabel("Título do curso",{exact:true}).fill("Curso Teste Completo");
  await page.getByRole("button",{name:"Criar curso",exact:true}).click();
  await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Capítulo 1 — Introdução");
  await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();
  await page.getByRole("button",{name:"Nova atividade",exact:true}).click();
  await page.getByLabel("Título da atividade",{exact:true}).fill("Lab");
  await page.getByLabel("Tipo de atividade",{exact:true}).selectOption("spreadsheet-exercise");
  await page.getByLabel("Selecionar exercício",{exact:true}).selectOption({label:"laboratorio_1.xlsx · 0.1-draft"});
  await page.getByRole("button",{name:"Salvar atividade",exact:true}).click();
  await page.getByRole("link",{name:"Voltar aos cursos",exact:true}).click();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).courses,COURSE_STORAGE_KEY);
  await row(page,"laboratorio_1.xlsx").getByRole("button",{name:"Excluir",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Curso Teste Completo → Capítulo 1 — Introdução → Lab");
  await expect(page.getByRole("dialog").getByRole("button")).toHaveCount(1);
  await page.screenshot({path:"test-results/exercise-deletion-linked.png"});
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await row(page,"laboratorio_2.xlsx").getByRole("button",{name:"Excluir",exact:true}).click();
  await page.screenshot({path:"test-results/exercise-deletion-confirm.png"});
  await page.getByRole("button",{name:"Confirmar exclusão",exact:true}).click();
  await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(0); await page.reload();
  await expect(row(page,"laboratorio_2.xlsx")).toHaveCount(0);
  await expect(row(page,"laboratorio_1.xlsx")).toHaveCount(1);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).courses,COURSE_STORAGE_KEY)).toEqual(before);
});
