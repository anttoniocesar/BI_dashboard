import { test, expect, grantAndOpenCourse, type Page } from "./fixtures/authenticated-test";
import { readFileSync } from "node:fs";
import { chartWorkbookFixture, labChartTitle } from "./fixtures/xlsx/chart-workbook";
import { assertOriginalIfResults } from "./fixtures/assert-original-if";

async function expanded(page: Page) {
  await page.getByRole("button", { name: "Expandir Lab", exact: true }).click();
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "expanded");
}
async function checkTabs(page: Page) {
  const tabs = page.getByRole("tablist", { name: "Planilhas", exact: true }).getByRole("tab");
  const names = await tabs.allTextContents();
  for (const name of names) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "expanded");
  }
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await expect(page.getByRole("region", { name: labChartTitle, exact: true })).toBeVisible();
  await assertOriginalIfResults(page, process.env.BI_SOCIETY_CHART_REGRESSION_PATH, 1);
}

test("Lab view curso: LAB 1 real/equivalente no Studio, preview, Curso Teste Completo e Learn; preferência na reabertura", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const file = process.env.BI_SOCIETY_CHART_REGRESSION_PATH;
  const buffer = file ? readFileSync(file) : (await chartWorkbookFixture()).buffer;
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles({ name: "laboratorio_1.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await page.getByRole("button", { name: /Analisar arquivo/ }).click();
  await page.getByRole("button", { name: /Revisar abas/ }).click();
  await page.getByRole("button", { name: /Importar e abrir no BI.Society Lab/ }).click();
  await expanded(page); await checkTabs(page);
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "expanded");
  await checkTabs(page);
  await page.getByRole("button", { name: "Tela cheia do Lab", exact: true }).click();
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "fullscreen");
  await expect(page.getByRole("tab", { name: "Gabarito", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "expanded");
  for (const [open, close] of [["Visualizar como aluno", "Voltar ao editor"], ["Testar exercício", "Sair do teste"]]) {
    await page.getByRole("button", { name: open, exact: true }).click();
    await expect(page.getByRole("button", { name: close, exact: true })).toBeVisible();
    await checkTabs(page);
    await page.getByRole("button", { name: "Tela cheia do Lab", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sair da tela cheia do Lab", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: close, exact: true }).click();
  }
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso Teste Completo");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Laboratório");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel("Título da atividade", { exact: true }).fill("LAB 1");
  await page.getByLabel("Tipo de atividade", { exact: true }).selectOption("spreadsheet-exercise");
  await page.getByLabel("Selecionar exercício", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await page.getByRole("link", { name: "Visualizar como aluno", exact: true }).click();
  await expect(page.locator(".lab-view")).toHaveCount(1);
  await checkTabs(page);
  await page.goBack();
  await grantAndOpenCourse(page);
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await checkTabs(page);
  await page.screenshot({ path: "test-results/lab-view-learn-desktop-1440.png", fullPage: true });
  const href = page.url();
  await page.getByRole("button", { name: "Tela cheia do Lab", exact: true }).click();
  await expect(page.getByRole("status", { name: "Status de salvamento", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/lab-view-learn-fullscreen-1440.png" });
  await page.keyboard.press("Escape");
  await page.goto("/learn"); await page.goto(href);
  await expect(page.locator(".lab-view")).toHaveAttribute("data-view-mode", "expanded");
  await checkTabs(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Tamanho normal do Lab", exact: true }).click();
  await expanded(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/lab-view-learn-mobile-390.png", fullPage: true });
  expect(errors).toEqual([]);
});
