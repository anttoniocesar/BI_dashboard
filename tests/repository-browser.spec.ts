import { expect, test, type Page } from "@playwright/test";
import { neuralExerciseDefinition as neural } from "../data/exercises/neural-error-correction";
import { serializeExercise } from "../lib/storage/exerciseSessionCodec";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import type { MemoryExerciseRepository } from "./fixtures/MemoryExerciseRepository";

declare global { interface Window { testRepository: MemoryExerciseRepository; remountLab: () => void; releaseSave: () => void; releaseClear: () => void } }
const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const status = (page: Page) => page.getByRole("status", { name: "Status de salvamento", exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const context = { exerciseId: neural.id, exerciseVersion: neural.version };
async function open(page: Page) {
  await page.goto("http://localhost:3002");
  await expect(status(page)).toBeVisible();
}
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}
async function analysis(page: Page) { await page.getByRole("tab", { name: "Análise", exact: true }).click(); }

test("load pendente não monta nem salva mestre; depois restaura fórmula e aba", async ({ page }) => {
  const workbook = cloneWorkbook(neural.workbook);
  workbook.worksheets[1].cells.F2 = "=B2*D2+C2*E2";
  const seed = serializeExercise(neural, { workbook, activeSheet: "treinamento", selections: { treinamento: { row: 1, column: 5 } }, validation: "verified" });
  await page.addInitScript(seed => { window.repositoryOptions = { seed, loadDelay: 1800 }; }, seed);
  await page.goto("http://localhost:3002");
  await expect(page.getByText("Carregando exercício...", { exact: true })).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  expect(await page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(0);
  await expect(page.getByRole("tab", { name: "Treinamento", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("=B2*D2+C2*E2");
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Resposta correta/);
  expect(await page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(0);
});

test("autosave aguarda Promise, mostra erro sem perder conteúdo e tenta na próxima alteração", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.testRepository.behavior.save = { delay: 1000, fail: true }; });
  await analysis(page);
  await enter(page, "B3", "Trabalho preservado");
  await expect(status(page)).toContainText("Salvando...");
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(1);
  await expect(status(page)).toContainText("Salvando...");
  await expect(status(page)).toContainText("Erro ao salvar");
  await expect(cell(page, "B3")).toHaveText("Trabalho preservado");
  await page.evaluate(() => { window.testRepository.behavior.save = {}; });
  await enter(page, "B6", "Nova tentativa");
  await expect(status(page)).toContainText("Salvando...");
  await expect(status(page)).toContainText("Salvo ✓");
  const stored = await page.evaluate(context => window.testRepository.peek(context), context);
  expect(stored?.cells).toEqual(expect.arrayContaining([{ worksheetId: "analise", address: "B3", raw: "Trabalho preservado" }, { worksheetId: "analise", address: "B6", raw: "Nova tentativa" }]));
});

test("save A lento não termina depois de B: fila preserva última edição e indicador", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.testRepository.behavior.save.gate = new Promise(resolve => { window.releaseSave = resolve; }); });
  await analysis(page);
  await enter(page, "B3", "A");
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(1);
  await page.evaluate(() => { window.testRepository.behavior.save = { delay: 500 }; });
  await enter(page, "B3", "B");
  await page.waitForTimeout(850);
  expect(await page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(1);
  await page.evaluate(() => window.releaseSave());
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(2);
  await expect(status(page)).toContainText("Salvando...");
  await expect(status(page)).toContainText("Salvo ✓");
  expect((await page.evaluate(context => window.testRepository.peek(context), context))?.cells).toContainEqual({ worksheetId: "analise", address: "B3", raw: "B" });
  await page.evaluate(() => window.remountLab());
  await expect(cell(page, "B3")).toHaveText("B");
});

test("falha de save obsoleto não substitui status nem bloqueia edição mais recente", async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.testRepository.behavior.save = { fail: true, gate: new Promise(resolve => { window.releaseSave = resolve; }) }; });
  await analysis(page);
  await enter(page, "B3", "A");
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(1);
  await page.evaluate(() => { window.testRepository.behavior.save = { delay: 500 }; });
  await enter(page, "B3", "B");
  await page.waitForTimeout(850);
  await page.evaluate(() => window.releaseSave());
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(2);
  await expect(status(page)).toContainText("Salvando...");
  await expect(status(page)).toContainText("Salvo ✓");
  await expect(cell(page, "B3")).toHaveText("B");
});

test("reinício espera save e clear, impede duplicação e só então restaura mestre", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.testRepository.behavior.save.gate = new Promise(resolve => { window.releaseSave = resolve; });
    window.testRepository.behavior.clear.gate = new Promise(resolve => { window.releaseClear = resolve; });
  });
  await analysis(page);
  await enter(page, "B3", "Progresso");
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(1);
  const origin = page.getByRole("button", { name: "Reiniciar exercício", exact: true });
  await origin.click();
  await expect(dialog(page).getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialog(page).getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(dialog(page)).toHaveAttribute("aria-busy", "true");
  await expect(cell(page, "B3")).toHaveText("Progresso");
  expect(await page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "clear").length)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeVisible();
  await page.evaluate(() => window.releaseSave());
  await expect.poll(() => page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "clear").length)).toBe(1);
  await expect(dialog(page)).toBeVisible();
  await expect(cell(page, "B3")).toHaveText("Progresso");
  await page.evaluate(() => window.releaseClear());
  await expect(dialog(page)).not.toBeVisible();
  await expect(origin).toBeFocused();
  await expect(page.getByRole("tab", { name: "Dados", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(850);
  expect(await page.evaluate(context => window.testRepository.peek(context), context)).toBeNull();
  await page.evaluate(() => window.remountLab());
  await analysis(page);
  await expect(cell(page, "B3")).toBeEmpty();
});

test("clear rejeitado preserva sessão e permite cancelar ou repetir", async ({ page }) => {
  await open(page);
  await analysis(page);
  await enter(page, "B3", "Não apagar");
  await expect(status(page)).toContainText("Salvo ✓");
  await page.evaluate(() => { window.testRepository.behavior.clear = { delay: 500, fail: true }; });
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("O exercício atual foi preservado.");
  await expect(cell(page, "B3")).toHaveText("Não apagar");
  expect((await page.evaluate(context => window.testRepository.peek(context), context))?.cells).toContainEqual({ worksheetId: "analise", address: "B3", raw: "Não apagar" });
  await dialog(page).getByRole("button", { name: "Cancelar", exact: true }).click();
  await enter(page, "B6", "Posso continuar");
  await expect(status(page)).toContainText("Salvo ✓");
});

test("segundo exercício usa mesmo Lab com memória, fórmula, nota, recuperação e reset", async ({ page }) => {
  await page.addInitScript(() => { window.repositoryOptions = { sum: true }; });
  await open(page);
  await expect(page.getByText("Teste de Soma", { exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(12);
  await enter(page, "C1", "=A1+B1");
  await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.getByLabel("Pontos obtidos")).toHaveText("7 / 7");
  await expect(status(page)).toContainText("Salvo ✓");
  await page.evaluate(() => window.remountLab());
  await expect(cell(page, "C1")).toHaveText("30");
  await expect(page.getByLabel("Pontos obtidos")).toHaveText("7 / 7");
  await cell(page, "C1").click();
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("=A1+B1");
  await expect(cell(page, "A1")).toHaveAttribute("aria-readonly", "true");
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(cell(page, "C1")).toBeEmpty();
  await expect(cell(page, "A1")).toHaveText("10");
});

test("load rejeitado abre modelo utilizável, sem gravar antes de uma alteração", async ({ page }) => {
  await page.addInitScript(() => { window.repositoryOptions = { loadFail: true }; });
  await open(page);
  await expect(status(page)).toContainText("Erro ao salvar");
  expect(await page.evaluate(() => window.testRepository.calls.filter(call => call.operation === "save").length)).toBe(0);
  await analysis(page);
  await enter(page, "B3", "Ainda posso editar");
  await expect(status(page)).toContainText("Salvo ✓");
});
