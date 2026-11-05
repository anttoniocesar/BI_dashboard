import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const bar = (page: Page) => page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}

test("quatro abas reais preservam conteúdo, seleção e respostas independentes", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Dados", "Treinamento", "Resultados", "Análise"]) {
    await tab(page, name).click();
    await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
  }
  await expect(cell(page, "B2")).toHaveText("Qual peso sofreu a maior variação?");
  await expect(cell(page, "B3")).toBeEmpty();
  await enter(page, "B3", "Minha análise do treinamento");
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "0.25");
  await tab(page, "Dados").click();
  await expect(cell(page, "B2")).toHaveText("0.20");
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toHaveText("0.25");
  await expect(page.getByLabel("Célula selecionada")).toHaveText("F3");
  await tab(page, "Análise").click();
  await expect(cell(page, "B3")).toHaveText("Minha análise do treinamento");
});

test("respostas → Resultados recalculam; trocar aba confirma edição na origem", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(cell(page, "I2")).toHaveText("0.2028");
  await cell(page, "B2").click();
  await expect(bar(page)).toHaveValue("=Dados!B2");
  await tab(page, "Resultados").click();
  await expect(cell(page, "D2")).toHaveText("0.14");
  const originalMAE = await cell(page, "B8").textContent();
  await cell(page, "B8").click();
  await expect(bar(page)).toHaveValue("=AVERAGE(D2:D6)");
  await tab(page, "Treinamento").click();
  await cell(page, "F2").dblclick();
  await page.getByRole("textbox", { name: "Editar F2", exact: true }).fill("0.20");
  await tab(page, "Resultados").click();
  await expect(cell(page, "C2")).toHaveText("0.2");
  await expect(cell(page, "D2")).toHaveText("0.1");
  await expect(cell(page, "B8")).not.toHaveText(originalMAE!);
  await tab(page, "Treinamento").click();
  await enter(page, "H2", "=Dados!D2-Treinamento!F2");
  await expect(cell(page, "H2")).toHaveText("0.1");
  await cell(page, "H2").click();
  await expect(bar(page)).toHaveValue("=Dados!D2-Treinamento!F2");
  // Formula-bar edits also belong to their original worksheet when changing tabs.
  await cell(page, "F2").click();
  await bar(page).fill("=Dados!B2*Treinamento!D2");
  await tab(page, "Dados").click();
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toHaveText("0.04");
  expect(errors).toEqual([]);
});

test("copiar fórmula entre linhas e abas preserva Dados!$B$10 e referências relativas", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "=Dados!$B$10*Dados!B2");
  await cell(page, "F2").click();
  await page.keyboard.press("Control+c");
  await cell(page, "F3").click();
  await page.keyboard.press("Control+v");
  await expect(bar(page)).toHaveValue("=Dados!$B$10*Dados!B3");
  await expect(cell(page, "F3")).toHaveText("0.03");
  await enter(page, "F2", "=Dados!$B$10");
  await cell(page, "F2").click();
  await page.keyboard.press("Control+c");
  await tab(page, "Análise").click();
  await cell(page, "B3").click();
  await page.keyboard.press("Control+v");
  await expect(bar(page)).toHaveValue("=Dados!$B$10");
  await expect(cell(page, "B3")).toHaveText("0.1");
});

test("abas por teclado, erro recuperável e referência à aba Análise", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Dados").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Treinamento")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tab(page, "Análise")).toHaveAttribute("aria-selected", "true");
  await enter(page, "B3", "Resposta de teste");
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "='Análise'!B3");
  await expect(cell(page, "F2")).toHaveText("Resposta de teste");
  await enter(page, "H2", "=Ausente!A1");
  await expect(cell(page, "H2")).toHaveText("#REF!");
  await cell(page, "H2").click();
  await page.keyboard.press("Delete");
  await expect(cell(page, "H2")).toBeEmpty();
  await tab(page, "Resultados").focus();
  await page.keyboard.press("Home");
  await expect(tab(page, "Dados")).toHaveAttribute("aria-selected", "true");
  for (const name of ["Dados", "Treinamento", "Resultados", "Análise"]) {
    await tab(page, name).click();
    await page.screenshot({ path: `test-results/etapa-3-${name}.png`, fullPage: true });
  }
});
