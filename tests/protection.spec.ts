import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const bar = (page: Page) => page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });

test("Dados resiste à digitação, F2, duplo clique, Delete, Backspace, colagem e barra", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await cell(page, "B2").click();
  await expect(cell(page, "B2")).toHaveAttribute("aria-readonly", "true");
  await expect(page.getByLabel("Permissão da célula")).toHaveText("Protegida");
  await expect(bar(page)).toHaveValue("0.20");
  await expect(bar(page)).not.toBeEditable();
  await page.keyboard.type("999");
  for (const key of ["F2", "Delete", "Backspace"]) await page.keyboard.press(key);
  await cell(page, "B2").dblclick();
  await expect(page.getByRole("textbox", { name: "Editar B2", exact: true })).toHaveCount(0);
  await expect(cell(page, "B2")).toHaveText("0.20");
  await page.evaluate(() => navigator.clipboard.writeText("=1+1"));
  await page.keyboard.press("Control+v");
  await expect(cell(page, "B2")).toHaveText("0.20");
  await bar(page).click();
  await bar(page).press("Control+a");
  await page.keyboard.type("999");
  await page.keyboard.press("Control+v");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(cell(page, "B2")).toHaveText("0.20");
  await cell(page, "B2").click();
  await expect(bar(page)).toHaveValue("0.20");
});

test("cabeçalhos, parâmetros, fórmulas fixas, perguntas e MAE permanecem protegidos", async ({ page }) => {
  await page.goto("/");
  const positions: Record<string, string[]> = { Dados: ["A1", "B8", "B9", "B10"], Treinamento: ["A1", "B2", "D2", "E2", "G2"], Resultados: ["C2", "D2", "B8"], Análise: ["B2", "B5", "B8"] };
  for (const [name, addresses] of Object.entries(positions)) {
    await tab(page, name).click();
    for (const address of addresses) {
      await cell(page, address).click();
      const before = await bar(page).inputValue();
      await expect(cell(page, address)).toHaveAttribute("aria-readonly", "true");
      await page.keyboard.type("apagado");
      await page.keyboard.press("Delete");
      await expect(bar(page)).toHaveValue(before);
    }
  }
});

test("respostas amarelas aceitam fórmulas, barra, exclusão e cópia de célula protegida", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await cell(page, "B2").click();
  await page.keyboard.press("Control+c");
  await tab(page, "Treinamento").click();
  await cell(page, "F2").click();
  await expect(cell(page, "F2")).toHaveClass(/cell-answer/);
  await expect(cell(page, "F2")).toHaveAttribute("aria-readonly", "false");
  await expect(page.getByLabel("Permissão da célula")).toHaveText("Preencher");
  await page.keyboard.press("Control+v");
  await expect(cell(page, "F2")).toHaveText("0.20");
  await page.keyboard.type("=Dados!B2*2");
  await page.keyboard.press("Enter");
  await expect(cell(page, "F2")).toHaveText("0.4");
  await cell(page, "F2").click();
  await bar(page).fill("=B2*D2+C2*E2");
  await bar(page).press("Enter");
  await expect(cell(page, "F2")).toHaveText("0.16");
  await cell(page, "H2").click();
  await page.keyboard.press("Delete");
  await expect(cell(page, "H2")).toBeEmpty();
  await page.keyboard.type("=G2-F2");
  await page.keyboard.press("Tab");
  await expect(cell(page, "H2")).toHaveText("0.14");
  await expect(cell(page, "I2")).toBeFocused();
  await tab(page, "Análise").click();
  await cell(page, "B3").click();
  await page.keyboard.type("Minha resposta");
  await tab(page, "Dados").click();
  await tab(page, "Análise").click();
  await expect(cell(page, "B3")).toHaveText("Minha resposta");
});

test("navegação inclui protegidas, legenda e borda de seleção permanecem visíveis", async ({ page }) => {
  await page.goto("/");
  await cell(page, "A1").click();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, "B1")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cell(page, "C1")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, "C2")).toBeFocused();
  await expect(cell(page, "C2")).toHaveClass(/active-cell/);
  await expect(page.getByLabel("Legenda das células")).toContainText("Fornecido");
  await expect(page.getByLabel("Legenda das células")).toContainText("Preencher");
  for (const name of ["Dados", "Treinamento", "Resultados", "Análise"]) {
    await tab(page, name).click();
    await page.screenshot({ path: `test-results/etapa-5-${name}.png`, fullPage: true });
  }
});
