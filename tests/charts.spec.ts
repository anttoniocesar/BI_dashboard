import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const comparison = (page: Page) => page.getByRole("region", { name: "Saída real × Saída prevista", exact: true });
const errorsChart = (page: Page) => page.getByRole("region", { name: "Erro absoluto por amostra", exact: true });
async function showResults(page: Page, complete = true) {
  await page.getByRole("tab", { name: "Resultados", exact: true }).click();
  if (complete) {
    await expect(comparison(page).locator(".recharts-line-curve")).toHaveCount(2);
    await expect(errorsChart(page).locator(".recharts-line-curve")).toHaveCount(1);
  } else await expect(comparison(page)).toBeVisible();
}
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}

test("dois gráficos, séries, eixos, MAE e tooltips com valores reais", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Gráficos de Resultados", exact: true })).toHaveCount(0);
  await showResults(page);
  const chart = comparison(page);
  await expect(chart.locator(".recharts-legend-item")).toHaveCount(2);
  await expect(chart.locator(".recharts-legend-item").filter({ hasText: "Saída real" })).toBeVisible();
  await expect(chart.locator(".recharts-legend-item").filter({ hasText: "Saída prevista" })).toBeVisible();
  await expect(chart.getByText("Amostra", { exact: true })).toBeVisible();
  await expect(chart.getByText("Saída", { exact: true })).toBeVisible();
  await expect(cell(page, "B8")).toHaveText("0.238859976362");
  await expect(page.getByLabel("MAE dos resultados")).toHaveText("0.23886");
  await chart.locator(".recharts-line-dots").first().locator("circle").nth(2).hover();
  const tooltip = chart.getByRole("tooltip");
  await expect(tooltip).toContainText("Amostra 3");
  await expect(tooltip).toContainText("Saída real:");
  await expect(tooltip).toContainText("0.62");
  await expect(tooltip).toContainText("Saída prevista:");
  await expect(tooltip).toContainText("0.35503");
  await errorsChart(page).locator(".recharts-line-dots circle").nth(2).hover();
  await expect(errorsChart(page).getByRole("tooltip")).toContainText("Amostra 3");
  await expect(errorsChart(page).getByRole("tooltip")).toContainText("0.26497");
});

test("editar resposta recalcula os traçados; Resultados permanece protegido", async ({ page }) => {
  await page.goto("/");
  await showResults(page);
  const predicted = comparison(page).locator(".recharts-line-curve").nth(1);
  const errorLine = errorsChart(page).locator(".recharts-line-curve");
  const previousPrediction = await predicted.getAttribute("d");
  const previousError = await errorLine.getAttribute("d");
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await enter(page, "F2", "0.20");
  await showResults(page);
  await expect(cell(page, "C2")).toHaveText("0.2");
  await expect(cell(page, "D2")).toHaveText("0.1");
  await expect(predicted).not.toHaveAttribute("d", previousPrediction!);
  await expect(errorLine).not.toHaveAttribute("d", previousError!);
  const beforeDirectEdit = await predicted.getAttribute("d");
  await cell(page, "C2").click();
  await page.keyboard.type("999");
  await expect(cell(page, "C2")).toHaveText("0.2");
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await enter(page, "F2", "0.50");
  await showResults(page);
  await expect(cell(page, "D2")).toHaveText("0.2");
  await expect(predicted).not.toHaveAttribute("d", beforeDirectEdit!);
  await expect(page.getByRole("tab", { name: "Resultados", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("vazio, texto e erro são omitidos sem quebrar; recuperação após correção", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await showResults(page);
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await cell(page, "F2").click();
  await page.keyboard.press("Delete");
  await expect(cell(page, "F2")).toBeEmpty();
  await showResults(page);
  await expect(comparison(page).locator(".recharts-line-dots").first().locator("circle")).toHaveCount(5);
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await enter(page, "F2", "=1/0");
  await showResults(page, false);
  await expect(cell(page, "C2")).toHaveText("#DIV/0!");
  await expect(comparison(page).locator(".recharts-line-dots").first().locator("circle")).toHaveCount(5);
  await expect(errorsChart(page).getByRole("status")).toHaveText("Sem valores numéricos para exibir.");
  await expect(page.getByLabel("MAE dos resultados")).toHaveText("—");
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  for (let row = 2; row <= 6; row++) {
    await enter(page, `F${row}`, "texto");
  }
  await showResults(page, false);
  await expect(comparison(page).locator(".recharts-line-dots").first().locator("circle")).toHaveCount(5);
  await expect(errorsChart(page).getByRole("status")).toHaveText("Sem valores numéricos para exibir.");
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await enter(page, "F2", "0.16");
  await showResults(page, false);
  await expect(comparison(page).locator(".recharts-line-dots").first().locator("circle")).toHaveCount(5);
  await expect(errorsChart(page).locator(".recharts-line-dots circle")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("containers responsivos em desktop e notebook sem transbordar a página", async ({ page }) => {
  await page.goto("/");
  await showResults(page);
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(async () => comparison(page).locator(".recharts-wrapper").evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(200);
    const comparisonBox = await comparison(page).boundingBox();
    const errorBox = await errorsChart(page).boundingBox();
    expect(comparisonBox!.x + comparisonBox!.width).toBeLessThanOrEqual(width);
    expect(errorBox!.x + errorBox!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/etapa-4-${width}.png`, fullPage: true });
  }
});
