import { test, expect, grantAndOpenCourse, type Page } from "./fixtures/authenticated-test";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { chartWorkbookFixture, labChartTitle } from "./fixtures/xlsx/chart-workbook";

const chart = (page: Page, title = labChartTitle) => page.getByRole("region", { name: title, exact: true });
const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
async function upload(page: Page, input: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles(input);
  await page.getByRole("button", { name: /Analisar arquivo/ }).click();
  await expect(page.getByRole("heading", { name: "Importação analisada", exact: true })).toBeVisible();
}
async function openLab(page: Page) {
  await page.getByRole("button", { name: /Revisar abas/ }).click();
  await page.getByRole("button", { name: /Importar e abrir no BI.Society Lab/ }).click();
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await expect(chart(page)).toBeVisible();
}

test("XLSX charts UI: Studio, duas simulações e Learn usam gráfico reativo e preservam proteção/merges", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const fixture = await chartWorkbookFixture();
  await upload(page, { name: "laboratorio_1.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: fixture.buffer });
  await expect(page.getByText("Charts: 1 detected / 1 imported", { exact: true })).toBeVisible();
  await openLab(page);
  await expect(chart(page).locator(".recharts-line-curve")).toHaveCount(1);
  await expect(chart(page)).toContainText("|e|");
  await expect(cell(page, "B11")).toHaveAttribute("aria-readonly", "true");
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await expect(chart(page)).toBeVisible();
  await expect(cell(page, "A1")).toHaveAttribute("aria-colspan", "5");
  const before = await chart(page).locator(".recharts-line-curve").getAttribute("d");
  await cell(page, "B11").click();
  await page.getByRole("textbox", { name: "Conteúdo da célula", exact: true }).fill("-0.85");
  await page.keyboard.press("Enter");
  await expect(cell(page, "J11")).toHaveText("0.85");
  await expect(chart(page).locator(".recharts-line-curve")).not.toHaveAttribute("d", before!);
  await chart(page).locator(".recharts-line-dot").first().hover();
  await expect(chart(page).getByRole("tooltip")).toContainText("0.85");
  await expect(chart(page).getByRole("tooltip")).toContainText("|e|");
  for (const [open, close] of [["Visualizar como aluno", "Voltar ao editor"], ["Testar exercício", "Sair do teste"]]) {
    await page.getByRole("button", { name: open, exact: true }).click();
    await expect(page.getByRole("button", { name: close, exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
    await expect(chart(page).locator(".recharts-line-curve")).toHaveCount(1);
    await expect(cell(page, "B11")).toHaveAttribute("aria-readonly", "true");
    await page.getByRole("button", { name: close, exact: true }).click();
  }
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso com gráfico XLSX");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Laboratório");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel("Título da atividade", { exact: true }).fill("LAB 1");
  await page.getByLabel("Tipo de atividade", { exact: true }).selectOption("spreadsheet-exercise");
  await page.getByLabel("Selecionar exercício", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await grantAndOpenCourse(page);
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await expect(chart(page).locator(".recharts-line-curve")).toHaveCount(1);
  await expect(cell(page, "B11")).toHaveAttribute("aria-readonly", "true");
  await expect(cell(page, "J11")).toHaveText("0.85");
  await chart(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/xlsx-chart-learn.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("XLSX charts UI: cinco tipos, vários gráficos e tipo não suportado sem overflow", async ({ page }) => {
  const fixture = await chartWorkbookFixture([
    { type: "line", title: labChartTitle }, { type: "column", title: "Colunas" }, { type: "bar", title: "Barras" },
    { type: "pie", title: "Pizza" }, { type: "scatter", title: "Dispersão" }, { type: "radar", title: "Radar não suportado" },
  ]);
  await upload(page, { name: "cinco-graficos.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: fixture.buffer });
  await expect(page.getByText("Charts: 6 detected / 5 imported / 1 unsupported", { exact: true })).toBeVisible();
  await openLab(page);
  for (const [title, selector, count] of [[labChartTitle, ".recharts-line-curve", 1], ["Colunas", ".recharts-bar-rectangle", 8], ["Barras", ".recharts-bar-rectangle", 8], ["Pizza", ".recharts-pie-sector", 8], ["Dispersão", ".recharts-scatter-symbol", 8]] as const) {
    await chart(page, title).scrollIntoViewIfNeeded();
    await expect(chart(page, title).locator(selector)).toHaveCount(count);
  }
  await expect(chart(page, "Radar não suportado")).toHaveCount(0);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await chart(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await chart(page).boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/xlsx-chart-types-${width}.png`, fullPage: true });
  }
});

test("LAB 1 UI: arquivo real local ou equivalente mostra título, |e| e 8 chapas no Gabarito", async ({ page }) => {
  const file = process.env.BI_SOCIETY_CHART_REGRESSION_PATH;
  const buffer = file ? readFileSync(file) : (await chartWorkbookFixture()).buffer;
  await upload(page, { name: file ? basename(file) : "laboratorio_1.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await expect(page.getByText("Charts: 1 detected / 1 imported", { exact: true })).toBeVisible();
  await openLab(page);
  await expect(chart(page)).toContainText("|e|");
  await expect(chart(page).locator(".recharts-line-curve").first()).toBeVisible();
  await expect(chart(page).locator(".recharts-line-dots").last().locator("circle")).toHaveCount(8);
  await expect(page.locator('[data-chart-anchor="20,5:35,13"]')).toBeVisible();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  for (const width of [1440, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await chart(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/lab-1-chart-studio-${width}.png`, fullPage: true });
  }
});
