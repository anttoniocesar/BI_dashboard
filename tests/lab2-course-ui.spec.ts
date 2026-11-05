import { test, expect, login } from "./fixtures/e2e-test";
import { grantAndOpenCourse } from "./fixtures/authenticated-test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chartWorkbookFixture, labChartTitle } from "./fixtures/xlsx/chart-workbook";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { assertOriginalIfResults } from "./fixtures/assert-original-if";

async function checkTabs(page: Page) {
  const names = await page.getByRole("tablist",{name:"Planilhas",exact:true}).getByRole("tab").allTextContents();
  for (const name of names) {
    await page.getByRole("tab",{name,exact:true}).click();
    await expect(page.getByRole("grid")).toBeVisible();
  }
  await page.getByRole("tab",{name:"Gabarito",exact:true}).click();
  await expect(page.getByRole("region",{name:labChartTitle,exact:true})).toBeVisible();
  await assertOriginalIfResults(page, process.env.BI_SOCIETY_LAB2_REGRESSION_PATH, 2);
}
async function modes(page: Page) {
  await page.getByRole("button",{name:"Tamanho normal do Lab",exact:true}).click();
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode","normal");
  await page.getByRole("button",{name:"Expandir Lab",exact:true}).click();
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode","expanded");
  await page.getByRole("button",{name:"Tela cheia do Lab",exact:true}).click();
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode","fullscreen");
  await page.keyboard.press("Escape");
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode","expanded");
}

test("LAB 2 original: importar, preview, Studio, refresh, curso publicado e Learn isolados",async ({page}) => {
  test.setTimeout(90000);
  const file = process.env.BI_SOCIETY_LAB2_REGRESSION_PATH;
  const buffer = file ? readFileSync(file) : (await chartWorkbookFixture()).buffer;
  const model = await importWorkbook(buffer,"laboratorio_2.xlsx"); expect(model.ok).toBe(true); if (!model.ok) return;
  const gabarito = model.workbook.worksheets.find(sheet=>sheet.name==="Gabarito")!;
  const formula = Object.values(gabarito.cells).find(cell=>cell.formula && !cell.mergedInto)!;
  const answer = Object.values(gabarito.cells).find(cell=>cell.kind === "number" && !cell.mergedInto)!;
  async function validateAnswer() {
    await page.getByRole("gridcell",{name:answer.address,exact:true}).click();
    await page.keyboard.type(`=${answer.value}`); await page.keyboard.press("Enter");
    await page.getByRole("button",{name:"Verificar respostas",exact:true}).click();
    await expect(page.getByRole("status",{name:"Resultado do exercício",exact:true})).toContainText("1 de 1 respostas corretas");
  }
  await page.goto("/login"); await login(page,"professor@example.com");
  await page.getByRole("link",{name:"Importar exercício Excel",exact:true}).click();
  await page.getByLabel("Arquivo Excel",{exact:true}).setInputFiles({name:"laboratorio_2.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer});
  const responsePromise = page.waitForResponse(r=>r.url().endsWith("/api/studio/import") && r.request().method()==="POST");
  await page.getByRole("button",{name:/Analisar arquivo/}).click();
  expect((await responsePromise).status()).toBe(200);
  await page.getByRole("button",{name:/Revisar abas/}).click();
  await page.getByRole("button",{name:/Importar e abrir no BI.Society Lab/}).click();
  await checkTabs(page); await modes(page);
  await page.getByRole("button",{name:"Abrir no Studio Editor",exact:true}).click();
  await checkTabs(page); await modes(page);
  await page.getByRole("gridcell",{name:formula.address,exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue(formula.formula!.expression);
  await page.getByRole("gridcell",{name:answer.address,exact:true}).click();
  await page.getByRole("radio",{name:"Resposta",exact:true}).check();
  await page.getByLabel("Resposta esperada",{exact:true}).fill(String(answer.value));
  await page.getByLabel("Aluno deve utilizar fórmula",{exact:true}).check();
  await page.getByLabel("Pontos",{exact:true}).fill("1");
  await page.getByLabel("Feedback quando incorreta",{exact:true}).fill("Revise o valor do parâmetro.");
  await page.getByRole("button",{name:"Aplicar avaliação",exact:true}).click();
  for (const [open,close] of [["Visualizar como aluno","Voltar ao editor"],["Testar exercício","Sair do teste"]]) {
    await page.getByRole("button",{name:open,exact:true}).click(); await checkTabs(page);
    if (open === "Testar exercício") await validateAnswer();
    await page.getByRole("button",{name:close,exact:true}).click();
  }
  await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();
  await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.reload(); await checkTabs(page);
  await page.getByRole("link",{name:"Meus cursos",exact:true}).click();
  await page.getByRole("link",{name:"Novo curso",exact:true}).click();
  await page.getByLabel("Título do curso",{exact:true}).fill("Curso temporário — regressão LAB 2");
  await page.getByRole("button",{name:"Criar curso",exact:true}).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  const courseURL = page.url();
  await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Capítulo LAB 2");
  await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();
  await page.getByRole("button",{name:"Nova atividade",exact:true}).click();
  await page.getByLabel("Título da atividade",{exact:true}).fill("LAB 2 original");
  await page.getByLabel("Tipo de atividade",{exact:true}).selectOption("spreadsheet-exercise");
  await page.getByLabel("Selecionar exercício",{exact:true}).selectOption({label:"laboratorio_2.xlsx · 0.1-draft"});
  await page.getByRole("button",{name:"Salvar atividade",exact:true}).click();
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click(); await checkTabs(page);
  await page.goto(courseURL); await grantAndOpenCourse(page);
  await page.getByRole("link",{name:"Começar curso",exact:true}).click();
  await checkTabs(page); await modes(page);
  await page.getByRole("gridcell",{name:formula.address,exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Conteúdo da célula",exact:true})).toHaveValue(formula.formula!.expression);
  await validateAnswer();
  await page.screenshot({path:"test-results/lab2-original-learn.png"});
});
