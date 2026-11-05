import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}

// Regression cases own their fixtures, independently of the exercise's initial layout.
async function openPlayground(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  for (const [address, raw] of Object.entries({ F2: "10", H2: "2", I2: "=F2*H2", F3: "20", H3: "3", I3: "=F3*H3", F4: "30", H4: "4", I4: "=F4*H4", J2: "0.10" })) {
    await enter(page, address, raw);
  }
}

test("média de F2=30 e F3=30 é 30 após confirmar por Enter ou clique fora", async ({ page }) => {
  await openPlayground(page);
  await enter(page, "F2", "30");
  await enter(page, "F3", "20");
  await enter(page, "J2", "=AVERAGE(F2:F3)");
  await expect(cell(page, "J2")).toHaveText("25");
  await enter(page, "F3", "30");
  await expect(cell(page, "F2")).toHaveText("30");
  await expect(cell(page, "F3")).toHaveText("30");
  await expect(cell(page, "J2")).toHaveText("30");
  await enter(page, "F3", "20");
  await expect(cell(page, "J2")).toHaveText("25");
  await cell(page, "F3").dblclick();
  await page.getByRole("textbox", { name: "Editar F3", exact: true }).fill("30");
  await cell(page, "J2").click();
  await expect(cell(page, "J2")).toHaveText("30");
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("=AVERAGE(F2:F3)");
});

test("soma, multiplicação, recálculo, barra de fórmulas e edição nos dois locais", async ({ page }) => {
  await openPlayground(page);
  await enter(page, "F2", "10");
  await enter(page, "H2", "5");
  await enter(page, "I2", "=F2+H2");
  await expect(cell(page, "I2")).toHaveText("15");
  await expect(cell(page, "I3")).toHaveText("60");
  await enter(page, "F3", "40");
  await expect(cell(page, "I3")).toHaveText("120");
  await cell(page, "I3").click();
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await expect(bar).toHaveValue("=F3*H3");
  await bar.fill("=F3+H3");
  await bar.press("Enter");
  await expect(cell(page, "I3")).toHaveText("43");
  await expect(cell(page, "I4")).toBeFocused();
  await cell(page, "I3").dblclick();
  await expect(page.getByRole("textbox", { name: "Editar I3", exact: true })).toHaveValue("=F3+H3");
  await page.getByRole("textbox", { name: "Editar I3", exact: true }).fill("=F3-H3");
  await expect(bar).toHaveValue("=F3-H3");
  await page.keyboard.press("Tab");
  await expect(cell(page, "I3")).toHaveText("37");
  await expect(cell(page, "J3")).toBeFocused();
});

test("copiar e colar célula ajusta referências relativas, absolutas e mistas", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openPlayground(page);
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  async function copyPaste(source: string, target: string, formula: string, result: string) {
    await cell(page, source).click();
    await page.keyboard.press("Control+c");
    await cell(page, target).click();
    await page.keyboard.press("Control+v");
    await expect(bar).toHaveValue(formula);
    await expect(cell(page, target)).toHaveText(result);
  }
  await copyPaste("I3", "I4", "=F4*H4", "120");
  await copyPaste("I3", "J3", "=G3*I3", "22.8");
  await enter(page, "I3", "=F3*$J$2");
  await copyPaste("I3", "I4", "=F4*$J$2", "3");
  await enter(page, "I3", "=$F3+H$2+$J$2");
  await copyPaste("I3", "J4", "=$F4+I$2+$J$2", "50.1");
  // Plain clipboard text from outside the grid has no source position to shift.
  await page.evaluate(() => navigator.clipboard.writeText("=F2+H2"));
  await cell(page, "J5").click();
  await page.keyboard.press("Control+v");
  await expect(bar).toHaveValue("=F2+H2");
  await expect(cell(page, "J5")).toHaveText("12");
});

test("média e erros não interrompem a interface; barra cancela e confirma ao sair", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openPlayground(page);
  await enter(page, "J2", "=AVERAGE(F2:F4)");
  await expect(cell(page, "J2")).toHaveText("20");
  for (const [address, formula, error] of [["I3", "=F2/0", "#DIV/0!"], ["J3", "=Z99", "#REF!"], ["J4", "=F2+", "#ERROR!"], ["J5", "=J5+1", "#CYCLE!"]]) {
    await enter(page, address, formula);
    await expect(cell(page, address)).toHaveText(error);
  }
  await cell(page, "J2").click();
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await bar.fill("=SUM(F2:F4)");
  await bar.press("Escape");
  await expect(cell(page, "J2")).toHaveText("20");
  await expect(bar).toHaveValue("=AVERAGE(F2:F4)");
  await bar.fill("=SUM(F2:F4)");
  // Grid clicks insert references during formula editing; external blur commits.
  await page.getByText("Planilha · Treinamento", { exact: true }).click();
  await cell(page, "G1").click();
  await expect(cell(page, "J2")).toHaveText("60");
  await enter(page, "I3", "=F2+H2");
  await expect(cell(page, "I3")).toHaveText("12");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/etapa-2-desktop.png", fullPage: true });
});
