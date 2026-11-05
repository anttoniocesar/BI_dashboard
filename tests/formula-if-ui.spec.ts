import { test, expect } from "./fixtures/authenticated-test";
import { assertOriginalIfResults } from "./fixtures/assert-original-if";

test("IF no Studio: LAB 1 original muda Q11 automaticamente ao editar I11", async ({ page }) => {
  const file = process.env.BI_SOCIETY_CHART_REGRESSION_PATH;
  test.skip(!file, "Configure o caminho do LAB 1 original.");
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles(file!);
  await page.getByRole("button", { name: /Analisar arquivo/ }).click();
  await page.getByRole("button", { name: /Revisar abas/ }).click();
  await page.getByRole("button", { name: /Importar e abrir no BI.Society Lab/ }).click();
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await assertOriginalIfResults(page, file, 1);
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await page.getByRole("tab", { name: "Gabarito", exact: true }).click();
  await assertOriginalIfResults(page, file, 1);
  const source = page.getByRole("gridcell", { name: "I11", exact: true });
  const target = page.getByRole("gridcell", { name: "Q11", exact: true });
  await expect(target).toHaveText("Previsão acima do real");
  for (const [value, expected] of [["1", "Previsão abaixo do real"], ["0", "Sem erro"], ["-1", "Previsão acima do real"]]) {
    await source.click(); await page.keyboard.type(value); await page.keyboard.press("Enter");
    await expect(target).toHaveText(expected);
  }
});
