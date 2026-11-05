import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const verify = (page: Page) => page.getByRole("button", { name: "Verificar respostas", exact: true });
const panel = (page: Page) => page.getByRole("region", { name: "Verificação do exercício", exact: true });
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}
async function openTraining(page: Page) {
  await page.goto("/");
  await tab(page, "Treinamento").click();
}

test("verificação explícita marca respostas, pontos e MAE protegido sem revelar gabarito", async ({ page }) => {
  await openTraining(page);
  await expect(cell(page, "F2")).not.toHaveClass(/validation-correct/);
  await verify(page).click();
  for (const address of ["F2", "H2", "I2", "J2"]) await expect(cell(page, address)).toHaveClass(/validation-correct/);
  await expect(panel(page)).toContainText("5 de 5 respostas corretas");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("70 / 70");
  await expect(panel(page).getByLabel("Percentual da pontuação")).toHaveText("100%");
  await expect(panel(page)).toContainText("Exercício concluído");
  for (const hidden of ["0.16", "0.2028", "0.3056", "0.0001", "=B2*D2+C2*E2"]) await expect(panel(page)).not.toContainText(hidden);
  await panel(page).getByRole("button", { name: "Resultados!B8", exact: true }).click();
  await expect(tab(page, "Resultados")).toHaveAttribute("aria-selected", "true");
  await expect(cell(page, "B8")).toHaveClass(/validation-correct/);
  await expect(cell(page, "B8")).toHaveAttribute("aria-readonly", "true");
  await expect(cell(page, "B8")).toBeFocused();
  await page.screenshot({ path: "test-results/etapa-6-validacao-completa.png", fullPage: true });
});

test("resultado literal não substitui fórmula obrigatória; nota ponderada respeita 70%", async ({ page }) => {
  await openTraining(page);
  await enter(page, "F2", "0.16");
  await enter(page, "H2", "0.14");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
  await expect(panel(page)).toContainText("Use uma fórmula nesta resposta.");
  await expect(panel(page)).toContainText("3 de 5 respostas corretas");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("50 / 70");
  await expect(panel(page).getByLabel("Percentual de respostas corretas")).toHaveText("60%");
  await expect(panel(page).getByLabel("Percentual da pontuação")).toHaveText("71,4%");
  await expect(panel(page)).toContainText("Exercício concluído");
  await enter(page, "I2", "0.2028");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveCount(0);
  await verify(page).click();
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("35 / 70");
  await expect(panel(page).getByLabel("Percentual da pontuação")).toHaveText("50%");
  await expect(panel(page)).toContainText("Continue revisando as respostas");
});

test("fórmula errada, tolerância, expressão equivalente e revalidação", async ({ page }) => {
  await openTraining(page);
  await enter(page, "F2", "=0.4");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
  await expect(panel(page)).toContainText("Revise o cálculo da saída prevista.");
  await enter(page, "F2", "=D2*B2+E2*C2");
  await expect(cell(page, "F2")).not.toHaveClass(/validation-(correct|incorrect)/);
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-correct/);
  await enter(page, "F2", "=0.16005");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-correct/);
  await enter(page, "F2", "=0.161");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
});

test("resposta vazia e erro de fórmula recebem feedback sem interromper gráficos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openTraining(page);
  await cell(page, "F2").click();
  await page.keyboard.press("Delete");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-unanswered/);
  await expect(panel(page)).toContainText("Não respondida");
  await enter(page, "F2", "=1/0");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
  await expect(panel(page)).toContainText("A fórmula contém um erro.");
  await tab(page, "Resultados").click();
  await expect(page.getByRole("region", { name: "Saída real × Saída prevista", exact: true })).toBeVisible();
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("0 / 70");
  expect(errors).toEqual([]);
});

test("alterações retiram avaliação obsoleta e clicar em verificar confirma rascunho da barra", async ({ page }) => {
  await openTraining(page);
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveClass(/validation-correct/);
  await cell(page, "F2").dblclick();
  await page.getByRole("textbox", { name: "Editar F2", exact: true }).fill("=0.4");
  await expect(cell(page, "F2")).not.toHaveClass(/validation-correct/);
  await expect(panel(page)).toContainText("Há alterações não verificadas.");
  await page.keyboard.press("Escape");
  await expect(cell(page, "F2")).toHaveClass(/validation-correct/);
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await bar.fill("=0.4");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveText("0.4");
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
  await enter(page, "F2", "=B2*D2+C2*E2");
  await expect(cell(page, "F2")).toHaveClass(/cell-answer/);
  await expect(cell(page, "F2")).not.toHaveClass(/validation-/);
  await verify(page).click();
  await expect(panel(page)).toContainText("5 de 5 respostas corretas");
});

test("gráficos atualizam após resposta e validação; células fornecidas continuam protegidas", async ({ page }) => {
  await openTraining(page);
  await verify(page).click();
  await tab(page, "Dados").click();
  await cell(page, "B2").click();
  await page.keyboard.type("999");
  await expect(cell(page, "B2")).toHaveText("0.20");
  await expect(panel(page)).toContainText("5 de 5 respostas corretas");
  await tab(page, "Resultados").click();
  const line = page.getByRole("region", { name: "Saída real × Saída prevista", exact: true }).locator(".recharts-line-curve").nth(1);
  await expect(line).toBeVisible();
  const previous = await line.getAttribute("d");
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "0.20");
  await tab(page, "Resultados").click();
  await expect(cell(page, "B8")).not.toHaveClass(/validation-correct/);
  await expect(cell(page, "C2")).toHaveText("0.2");
  await expect(line).not.toHaveAttribute("d", previous!);
  await verify(page).click();
  await expect(cell(page, "B8")).toHaveAttribute("aria-readonly", "true");
});
