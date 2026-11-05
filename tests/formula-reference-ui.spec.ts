import { test, expect, type Page } from "@playwright/test";
import { simpleSumDefinition } from "./fixtures/simple-sum";
import type { ExerciseDefinition } from "../types/exercise";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const bar = (page: Page) => page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
const editor = (page: Page) => page.getByRole("textbox", { name: "Editar H11", exact: true });
const definition: ExerciseDefinition = {
  ...simpleSumDefinition, id: "formula-reference", dimensions: { rows: 12, columns: 8 },
  workbook: { worksheets: [{ id: "operacao", name: "Exercício", cells: { A1: "5", B11: "2", C11: "3", D11: "4", F11: "6", H11: "7" },
    merges: [{ startRow: 0, startCol: 0, endRow: 0, endCol: 4 }] }] },
  cellRules: { operacao: { default: "provided", cells: { H11: "answer" } } },
  validationRules: [{ ...simpleSumDefinition.validationRules[0], type: "number", cell: "H11", expected: 12 }],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(definition => { window.repositoryOptions = { importedDefinition: definition }; }, definition);
  await page.goto("http://localhost:3002");
  await expect(cell(page, "H11")).toHaveText("7");
});

for (const source of ["typing", "F2", "double click", "formula bar"]) {
  test(`${source}: referências preservam origem, foco, operadores, cálculo, validação e autosave`, async ({ page }) => {
    await cell(page, "H11").click();
    if (source === "F2") { await page.keyboard.press("F2"); await editor(page).fill("="); }
    else if (source === "double click") { await cell(page, "H11").dblclick(); await editor(page).fill("="); }
    else if (source === "formula bar") await bar(page).fill("=");
    else await page.keyboard.type("=");
    const input = source === "formula bar" ? bar(page) : editor(page);
    await expect(cell(page, "B11")).toHaveAttribute("aria-readonly", "true");
    await cell(page, "B11").click();
    await expect(input).toHaveValue("=B11");
    await expect(input).toBeFocused();
    await expect(cell(page, "H11")).toHaveAttribute("aria-selected", "true");
    await expect(cell(page, "B11")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByLabel("Célula selecionada", { exact: true })).toHaveText("H11");
    await page.keyboard.type("*");
    await cell(page, "F11").click();
    await expect(input).toHaveValue("=B11*F11");
    await expect(input).toBeFocused();
    if (source === "typing") await page.screenshot({ path: "test-results/formula-reference-edit.png", fullPage: true });
    await page.keyboard.press("Enter");
    await expect(editor(page)).toHaveCount(0);
    await expect(cell(page, "H11")).toHaveText("12");
    await expect(cell(page, "H12")).toBeFocused();
    await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
    await expect(cell(page, "H11")).toHaveClass(/validation-correct/);
    await expect(page.getByRole("status", { name: "Status de salvamento", exact: true })).toContainText("Salvo");
    await page.evaluate(() => window.remountLab());
    await expect(cell(page, "H11")).toHaveText("12");
    await cell(page, "H11").click();
    await expect(bar(page)).toHaveValue("=B11*F11");
  });
}

for (const operator of ["+", "*"]) {
  test(`inserção após ${operator}, no meio e sobre seleção de texto`, async ({ page }) => {
    await cell(page, "H11").click();
    await page.keyboard.type(`=B11${operator}`);
    await cell(page, "C11").click();
    await expect(editor(page)).toHaveValue(`=B11${operator}C11`);
    await page.keyboard.type("+D11");
    await editor(page).evaluate(input => (input as HTMLInputElement).setSelectionRange(5, 8));
    await cell(page, "F11").click();
    await expect(editor(page)).toHaveValue(`=B11${operator}F11+D11`);
    await page.keyboard.type("*2");
    await expect(editor(page)).toHaveValue(`=B11${operator}F11*2+D11`);
    await page.keyboard.press("Escape");
    await expect(cell(page, "H11")).toHaveText("7");
    await expect(cell(page, "H11")).toBeFocused();
    await expect(bar(page)).toHaveValue("7");
    // After cancellation a normal click must select, rather than insert.
    await cell(page, "B11").click();
    await expect(cell(page, "B11")).toBeFocused();
  });
}

test("barra preserva cursor, funções e refs absolutas/mistas; Esc restaura o original", async ({ page }) => {
  await cell(page, "H11").click();
  await bar(page).fill("=SUM(+$B$11+$C11+C$11)");
  await bar(page).evaluate(input => (input as HTMLInputElement).setSelectionRange(5, 5));
  await cell(page, "B11").click();
  await expect(bar(page)).toHaveValue("=SUM(B11+$B$11+$C11+C$11)");
  await expect(bar(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, "H11")).toHaveText("10");
  await cell(page, "H11").click();
  await bar(page).fill("=");
  await cell(page, "C11").click();
  await page.keyboard.press("Escape");
  await expect(bar(page)).toHaveValue("=SUM(B11+$B$11+$C11+C$11)");
  await expect(cell(page, "H11")).toBeFocused();
});

test("clique na região coberta de um merge protegido insere a principal", async ({ page }) => {
  await cell(page, "H11").click();
  await page.keyboard.type("=");
  const box = await cell(page, "A1").boundingBox();
  await cell(page, "A1").click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(editor(page)).toHaveValue("=A1");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, "H11")).toHaveText("5");
});

test("texto comum confirma ao clicar e origem protegida não inicia edição", async ({ page }) => {
  await cell(page, "H11").click();
  await page.keyboard.type("texto");
  await cell(page, "B11").click();
  await expect(cell(page, "H11")).toHaveText("texto");
  await expect(cell(page, "B11")).toBeFocused();
  await page.keyboard.type("=");
  await page.keyboard.press("F2");
  await cell(page, "B11").dblclick();
  await expect(page.locator(".cell-editor")).toHaveCount(0);
  await expect(bar(page)).not.toBeEditable();
  await expect(cell(page, "B11")).toHaveText("2");
});
