import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../lib/excel-import/importWorkbook";
import { createExerciseDefinitionFromImport } from "../lib/excel-import/createExerciseDefinitionFromImport";

for (const policy of ["provided", "editable"] as const) test(`XLSX no mesmo Lab: ${policy}, abas, fórmulas, proteção e recálculo`, async ({ page }) => {
  const result = await importWorkbook(readFileSync("tests/fixtures/xlsx/controlled.xlsx"), "controlled.xlsx");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const definition = createExerciseDefinitionFromImport(result.workbook, { id: `import-${policy}`, version: "1", cellPolicy: policy });
  await page.addInitScript(definition => { window.repositoryOptions = { importedDefinition: definition }; }, definition);
  const errors: string[] = [], externalRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith("http://localhost:")) externalRequests.push(request.url()); });
  await page.goto("http://localhost:3002");
  const cell = (address: string) => page.getByRole("gridcell", { name: address, exact: true });
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(cell("A1")).toHaveText("10");
  await expect(cell("B2")).toHaveText("001");
  await expect(cell("C2")).toHaveText("=SUM(A1:B1)");
  await expect(page.getByRole("link")).toHaveCount(0);
  await page.getByRole("tab", { name: "Resultado & análise", exact: true }).click();
  await expect(cell("A1")).toHaveText("30");
  await expect(cell("A2")).toHaveText("20");
  await expect(cell("A3")).toHaveText("1");
  await expect(cell("A4")).toHaveText("80");
  await cell("A2").click();
  await expect(bar).toHaveValue("='Dados base'!$A$1*2");
  await expect(page.getByRole("grid")).toHaveAttribute("aria-rowcount", "6");
  await expect(page.getByRole("grid")).toHaveAttribute("aria-colcount", "7");
  await page.getByRole("tab", { name: "Dados base", exact: true }).click();
  await cell("A1").click();
  if (policy === "provided") {
    await expect(bar).not.toBeEditable();
    await page.keyboard.type("50");
    await expect(cell("A1")).toHaveText("10");
    await expect(cell("A1")).toHaveAccessibleDescription(/protegida/);
  } else {
    await expect(bar).toBeEditable();
    await page.keyboard.type("50");
    await page.keyboard.press("Enter");
    await page.getByRole("tab", { name: "Resultado & análise", exact: true }).click();
    await expect(cell("A1")).toHaveText("70");
    await expect(cell("A2")).toHaveText("100");
    await expect(page.getByRole("status", { name: "Status de salvamento", exact: true })).toContainText("Salvo ✓");
    await page.evaluate(() => window.remountLab());
    await expect(cell("A1")).toHaveText("70");
    await cell("A2").click();
    await expect(bar).toHaveValue("='Dados base'!$A$1*2");
  }
  await page.screenshot({ path: `test-results/etapa-12-import-${policy}.png`, fullPage: true });
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});
