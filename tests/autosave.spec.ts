import { expect, test, type Page } from "@playwright/test";
import { EXERCISE_STORAGE_KEY, serializeExercise } from "./fixtures/neural-storage";
import { createInitialWorkbook } from "../data/neural-network-demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const status = (page: Page) => page.getByRole("status", { name: "Status de salvamento", exact: true });
const panel = (page: Page) => page.getByRole("region", { name: "Verificação do exercício", exact: true });
const bar = (page: Page) => page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
const verify = (page: Page) => page.getByRole("button", { name: "Verificar respostas", exact: true });
const saved = (page: Page) => expect(status(page)).toContainText("Salvo ✓");
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}
async function seedDemo(page: Page) {
  const session = serializeExercise({ workbook: createInitialWorkbook(), activeSheet: "treinamento", selections: {}, validation: "never" });
  await page.addInitScript(({ key, session }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
  }, { key: EXERCISE_STORAGE_KEY, session });
}

test("sessão nova começa no Modelo Mestre; debounce mostra salvando e preserva fórmula, aba e seleção", async ({ page }) => {
  await page.goto("/");
  await expect(status(page)).toHaveText("Pronto para salvar");
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toBeEmpty();
  await enter(page, "F2", "=B2*D2+C2*E2");
  await expect(status(page)).toContainText("Salvando...");
  await saved(page);
  await expect(status(page).locator("time")).toHaveAttribute("datetime", /T/);
  await page.reload();
  await expect(tab(page, "Treinamento")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Célula selecionada")).toHaveText("F3");
  await expect(cell(page, "F2")).toHaveText("0.16");
  await cell(page, "F2").click();
  await expect(bar(page)).toHaveValue("=B2*D2+C2*E2");
  await enter(page, "F2", "=0.20");
  await saved(page);
  await tab(page, "Resultados").click();
  await expect(cell(page, "C2")).toHaveText("0.2");
});

test("edições rápidas são agrupadas; texto e números sobrevivem ao fechamento e abertura", async ({ page, context }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { writes: number }).writes = 0;
    Storage.prototype.setItem = function(key, value) { (window as unknown as { writes: number }).writes++; return original.call(this, key, value); };
  });
  await page.goto("/");
  await expect(status(page)).toHaveText("Pronto para salvar");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await tab(page, "Análise").click();
  await enter(page, "B3", "Temperatura");
  await enter(page, "B6", "950");
  await enter(page, "B9", "Minha resposta");
  await page.clock.runFor(749);
  expect(await page.evaluate(() => (window as unknown as { writes: number }).writes)).toBe(0);
  await page.clock.runFor(1);
  await saved(page);
  expect(await page.evaluate(() => (window as unknown as { writes: number }).writes)).toBe(1);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(tab(reopened, "Análise")).toHaveAttribute("aria-selected", "true");
  await expect(cell(reopened, "B3")).toHaveText("Temperatura");
  await expect(cell(reopened, "B6")).toHaveText("950");
  await expect(cell(reopened, "B9")).toHaveText("Minha resposta");
});

test("verificação, cores, pontos e conclusão restauram; editar invalida e salva nova situação", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/");
  await enter(page, "F2", "0.16");
  await verify(page).click();
  await expect(panel(page)).toContainText("4 de 5 respostas corretas");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("60 / 70");
  await saved(page);
  await page.reload();
  await expect(cell(page, "F2")).toHaveClass(/validation-incorrect/);
  await expect(cell(page, "H2")).toHaveClass(/validation-correct/);
  await expect(panel(page).getByLabel("Percentual de respostas corretas")).toHaveText("80%");
  await expect(panel(page).getByLabel("Percentual da pontuação")).toHaveText("85,7%");
  await expect(panel(page)).toContainText("Exercício concluído");
  await enter(page, "F2", "=D2*B2+E2*C2");
  await saved(page);
  await page.reload();
  await expect(panel(page)).toContainText("Há alterações não verificadas.");
  await expect(cell(page, "F2")).not.toHaveClass(/validation-/);
  await verify(page).click();
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText("70 / 70");
});

test("gráficos e MAE recalculam após recuperação; proteção permanece", async ({ page }) => {
  await seedDemo(page);
  await page.goto("/");
  await enter(page, "F2", "=0.20");
  await tab(page, "Resultados").click();
  const chart = page.getByRole("region", { name: "Saída real × Saída prevista", exact: true });
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(2);
  const mae = await cell(page, "B8").textContent();
  await saved(page);
  await page.reload();
  await expect(cell(page, "C2")).toHaveText("0.2");
  await expect(cell(page, "B8")).toHaveText(mae!);
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(2);
  await cell(page, "B8").click();
  await expect(bar(page)).not.toBeEditable();
  await page.keyboard.type("999");
  await expect(cell(page, "B8")).toHaveText(mae!);
});

test("cancelar reinício preserva tudo; confirmar limpa sessão, respostas e nota sem ressuscitar debounce", async ({ page }) => {
  // Seed only once: a reload after reset must really start from the blank master.
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "=0.16");
  await verify(page).click();
  await saved(page);
  const points = await panel(page).getByLabel("Pontos obtidos").textContent();
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Reiniciar exercício", exact: true });
  await expect(dialog).toContainText("Todo o progresso atual será apagado.");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveText(points!);
  await enter(page, "H2", "=G2-F2");
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  await dialog.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(tab(page, "Dados")).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByLabel("Pontos obtidos")).toHaveCount(0);
  await expect(page.locator(".validation-correct, .validation-incorrect")).toHaveCount(0);
  await page.waitForTimeout(1000); // Detect a pending pre-reset timer recreating the deleted session.
  expect(await page.evaluate(key => localStorage.getItem(key), EXERCISE_STORAGE_KEY)).toBeNull();
  await page.reload();
  await expect(tab(page, "Dados")).toHaveAttribute("aria-selected", "true");
  await tab(page, "Treinamento").click();
  for (const address of ["F2", "H2", "I2", "J2", "F6", "J6"]) await expect(cell(page, address)).toBeEmpty();
  await expect(cell(page, "B2")).toHaveText("0.2");
  await tab(page, "Resultados").click();
  await cell(page, "B8").click();
  await expect(bar(page)).toHaveValue("=AVERAGE(D2:D6)");
  await expect(page.getByRole("region", { name: "Saída real × Saída prevista", exact: true })).toBeVisible();
});

for (const [name, content] of [
  ["JSON corrompido", "{broken"],
  ["formato inválido", JSON.stringify({ version: 1, cells: [] })],
  ["versão incompatível", JSON.stringify({ ...serializeExercise({ workbook: createInitialWorkbook(), activeSheet: "dados", selections: {}, validation: "verified" }), version: 99 })],
  ["célula protegida manipulada", JSON.stringify({ ...serializeExercise({ workbook: createInitialWorkbook(), activeSheet: "dados", selections: {}, validation: "verified" }), cells: [{ worksheetId: "dados", address: "B2", raw: "999" }] })],
]) test(`${name} é ignorado sem quebrar a aplicação`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ key, content }) => localStorage.setItem(key, content), { key: EXERCISE_STORAGE_KEY, content });
  await page.goto("/");
  await expect(cell(page, "B2")).toHaveText("0.20");
  await expect(cell(page, "B2")).toHaveAttribute("aria-readonly", "true");
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("quota excedida mostra erro, mantém edição e permite nova tentativa; reinício bloqueado preserva progresso", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException("Quota", "QuotaExceededError"); };
    Storage.prototype.removeItem = () => { throw new DOMException("Denied", "SecurityError"); };
  });
  await tab(page, "Análise").click();
  await enter(page, "B3", "Progresso local");
  await expect(status(page)).toContainText("Erro ao salvar");
  await expect(cell(page, "B3")).toHaveText("Progresso local");
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("O exercício atual foi preservado.");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await enter(page, "B6", "Nova tentativa");
  await expect(status(page)).toContainText("Salvando...");
  await saved(page);
});

test("acesso ao armazenamento bloqueado não impede abrir e editar", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException("Denied", "SecurityError"); }; });
  await page.goto("/");
  await expect(status(page)).toContainText("Erro ao salvar");
  await tab(page, "Análise").click();
  await enter(page, "B3", "Ainda posso editar");
  await expect(cell(page, "B3")).toHaveText("Ainda posso editar");
});

test("atualizar antes do debounce preserva inclusive rascunho da barra", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await cell(page, "F2").click();
  await bar(page).fill("=B2*D2+C2*E2");
  await page.reload();
  await expect(tab(page, "Treinamento")).toHaveAttribute("aria-selected", "true");
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(bar(page)).toHaveValue("=B2*D2+C2*E2");
});
