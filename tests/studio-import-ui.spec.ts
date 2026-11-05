import { test, expect, type Page } from "./fixtures/authenticated-test";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../lib/excel-import/importWorkbook";

const fixture = "tests/fixtures/xlsx/controlled.xlsx";
const field = (page: Page) => page.getByLabel("Arquivo Excel", { exact: true });
const analyze = (page: Page) => page.getByRole("button", { name: "Analisar arquivo", exact: false });
const open = (page: Page) => page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false });
const checkbox = (page: Page, name: string) => page.getByRole("checkbox", { name: new RegExp(`^${name}`) });
async function report(page: Page) {
  await page.goto("/studio/import"); await field(page).setInputFiles(fixture); await analyze(page).click();
  await expect(page.getByRole("heading", { name: "Importação analisada", exact: true })).toBeVisible();
}
async function review(page: Page) { await report(page); await page.getByRole("button", { name: "Revisar abas", exact: false }).click(); }
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>) {
  for (let index = 0; index < 24; index++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("Studio: importador real, relatório, avisos, preview readonly e mesmo ExerciseLab sem storage do aluno", async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith("http://localhost:")) external.push(request.url()); });
  await page.addInitScript(() => { localStorage.setItem("bi-society:poc01:exercise-state:v1", "student-session-unchanged"); });
  await report(page);
  // Merge support replaces the former metadata-only warning with an OK item.
  for (const [label, value] of [["abas", "2"], ["células", "24"], ["fórmulas", "12"], ["gráficos", "0"], ["avisos", "10"], ["erros", "0"]]) await expect(page.getByLabel(`Total de ${label}`, { exact: true })).toHaveText(value);
  await expect(page.getByText("O arquivo pode ser importado, mas alguns itens precisarão de revisão.")).toBeVisible();
  await page.getByText("Detalhes da análise", { exact: false }).click();
  await expect(page.getByRole("region", { name: "Detalhes da análise", exact: true })).not.toContainText("Funções não suportadas: IF");
  await expect(page.getByRole("region", { name: "Detalhes da análise", exact: true })).toContainText("Merged cells: Supported");
  await expect(page.getByRole("region", { name: "Detalhes da análise", exact: true })).toContainText("Aviso");
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await expect(page.getByRole("table", { name: "Prévia da aba Dados base" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "A1, 10, somente leitura", exact: true })).toBeVisible();
  await expect(page.locator('.studio-sheet-preview :is(input,[contenteditable="true"])')).toHaveCount(0);
  await expect(open(page)).toBeEnabled();
  await open(page).click();
  await expect(page).toHaveURL(/\/studio\/import\/preview$/);
  await expect(page.getByRole("heading", { name: "Pré-visualização da importação", exact: true })).toBeVisible();
  await expect(page.getByText("Rascunho · 0.1-draft", { exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "A1", exact: true })).toHaveText("10");
  await page.getByRole("tab", { name: "Resultado & análise", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "A1", exact: true })).toHaveText("30");
  await expect(page.getByRole("gridcell", { name: "A3", exact: true })).toHaveText("1");
  await page.getByRole("gridcell", { name: "A2", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("='Dados base'!$A$1*2");
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).not.toBeEditable();
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({ "bi-society:poc01:exercise-state:v1": "student-session-unchanged" });
  expect(external).toEqual([]); expect(errors).toEqual([]);
  await page.getByRole("link", { name: "Voltar à revisão", exact: false }).click();
  await expect(checkbox(page, "Dados base")).toBeChecked();
  await expect(checkbox(page, "Resultado & análise")).toBeChecked();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeVisible();
  await expect(analyze(page)).toBeDisabled();
});

test("Studio: valida extensão, vazio e tamanho antes do envio; remover permite escolher novamente", async ({ page }) => {
  let requests = 0; page.on("request", request => { if (request.url().includes("/api/studio/import")) requests++; });
  await page.goto("/studio/import");
  for (const [name, buffer, message] of [["invalid.txt", Buffer.from("text"), "Formato não suportado"], ["empty.xlsx", Buffer.alloc(0), "arquivo está vazio"], ["large.xlsx", Buffer.alloc(2 * 1024 * 1024 + 1), "tamanho máximo"]] as const) {
    await field(page).setInputFiles({ name, mimeType: "application/octet-stream", buffer });
    await expect(page.getByRole("main").getByRole("alert")).toContainText(message);
    await expect(analyze(page)).toBeDisabled();
  }
  expect(requests).toBe(0);
  await field(page).setInputFiles(fixture);
  await expect(analyze(page)).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("controlled.xlsx");
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(analyze(page)).toBeDisabled();
  await field(page).setInputFiles(fixture);
  await expect(analyze(page)).toBeEnabled();
});

test("Studio: arquivo corrompido mostra motivo e bloqueia continuação", async ({ page }) => {
  await page.goto("/studio/import");
  await field(page).setInputFiles({ name: "broken.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not zip") });
  await analyze(page).click();
  await expect(page.getByRole("heading", { name: "Não foi possível importar este arquivo.", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Arquivo inválido");
  await expect(page.getByLabel("Total de erros", { exact: true })).toHaveText("1");
  await expect(page.getByRole("button", { name: "Revisar abas", exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Escolher outro arquivo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clique para selecionar", exact: true })).toBeVisible();
});

test("Studio: aba removida gera erro de referência; omitir fórmulas libera apenas aba selecionada", async ({ page }) => {
  await review(page);
  await checkbox(page, "Dados base").uncheck();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("referencia a aba desmarcada");
  await expect(open(page)).toBeDisabled();
  await checkbox(page, "Fórmulas").uncheck();
  await expect(open(page)).toBeEnabled();
  await checkbox(page, "Formatação disponível").uncheck();
  await open(page).click();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByRole("tab", { name: "Resultado & análise", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("gridcell", { name: "A1", exact: true })).toBeEmpty();
  await expect(page.getByRole("gridcell", { name: "E1", exact: true })).toHaveText("Mesclada");
});

test("Studio: última aba não pode ser desmarcada e prévia permite inspecionar outra aba", async ({ page }) => {
  await review(page);
  await checkbox(page, "Resultado & análise").uncheck();
  await checkbox(page, "Dados base").click();
  await expect(checkbox(page, "Dados base")).toBeChecked();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Pelo menos uma aba");
  await page.getByRole("button", { name: "Prévia de Resultado & análise", exact: true }).click();
  await expect(page.getByRole("table", { name: "Prévia da aba Resultado & análise" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "A2, ='Dados base'!$A$1*2, somente leitura", exact: true })).toBeVisible();
});

test("Studio: análise pendente evita cliques duplicados; cancelar ignora resposta obsoleta", async ({ page }) => {
  const result = await importWorkbook(readFileSync(fixture), "controlled.xlsx");
  let requests = 0; let release: (() => Promise<void>) | undefined;
  await page.route("**/api/studio/import", route => { requests++; release = () => route.fulfill({ status: 200, json: result }).catch(() => {}); });
  await page.goto("/studio/import"); await field(page).setInputFiles(fixture);
  await analyze(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole("heading", { name: "Analisando arquivo...", exact: true })).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator('.studio-stepper [aria-current="step"]')).toContainText("Analisar");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeVisible();
  await release?.();
  await expect(page.getByRole("heading", { name: "Importação analisada", exact: true })).toHaveCount(0);
  await expect(analyze(page)).toBeDisabled();
});

test("Studio: falha de rede permite nova tentativa mantendo arquivo", async ({ page }) => {
  await page.route("**/api/studio/import", route => route.abort("failed"));
  await page.goto("/studio/import"); await field(page).setInputFiles(fixture); await analyze(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Verifique a conexão");
  await page.unroute("**/api/studio/import");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Importação analisada", exact: true })).toBeVisible();
});

test("Studio: fluxo por teclado, foco visível, stepper e seletor nativo de arquivo", async ({ page }) => {
  await page.goto("/studio/import");
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Clique para selecionar", exact: true })).toBeFocused();
  expect(await page.locator(".studio-dropzone").evaluate(element => getComputedStyle(element).outlineStyle)).toBe("solid");
  const chooser = page.waitForEvent("filechooser"); await page.getByRole("button", { name: "Clique para selecionar", exact: true }).press("Enter"); await (await chooser).setFiles(fixture);
  await tabTo(page, analyze(page)); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Importação analisada", exact: true })).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: "Revisar abas", exact: false })); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Revise a importação", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(checkbox(page, "Dados base")).toBeFocused();
  await page.keyboard.press("Space"); await expect(open(page)).toBeDisabled();
  await page.keyboard.press("Space"); await expect(open(page)).toBeEnabled();
  await tabTo(page, open(page)); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/studio\/import\/preview$/);
  await expect(page.getByRole("heading", { name: "Pré-visualização da importação", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Voltar à revisão", exact: false })).toBeFocused();
});

test("Studio: drag-and-drop seleciona arquivo e previne navegação do navegador", async ({ page }) => {
  await page.goto("/studio/import");
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeFocused();
  const data = await page.evaluateHandle(bytes => { const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], "dropped.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); return transfer; }, Array.from(readFileSync(fixture)));
  await page.locator(".studio-dropzone").dispatchEvent("dragover", { dataTransfer: data });
  await expect(page.locator(".studio-dropzone")).toHaveClass(/is-dragging/);
  await page.locator(".studio-dropzone").dispatchEvent("drop", { dataTransfer: data });
  await expect(page.getByRole("status")).toContainText("dropped.xlsx");
  await expect(page).toHaveURL(/\/studio\/import$/);
  await expect(analyze(page)).toBeEnabled();
});

test("Studio: refresh da prévia não recupera dados; rota do aluno permanece intacta", async ({ page }) => {
  await review(page); await open(page).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Não há uma importação nesta sessão", exact: true })).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await page.getByRole("link", { name: "Selecionar arquivo Excel", exact: true }).click();
  await expect(analyze(page)).toBeDisabled();
  await page.getByRole("link", { name: "Voltar ao Studio", exact: false }).click();
  await expect(page).toHaveURL(/\/studio\/courses$/);
  await expect(page.getByRole("heading", { name: "Meus cursos", exact: true })).toBeVisible();
});

for (const width of [1440, 1024]) test(`Studio: layout, foco e contraste em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 768 });
  await page.goto("/studio/import");
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/etapa-13-selecionar-${width}.png`, fullPage: true });
  await field(page).setInputFiles(fixture); await analyze(page).click();
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await tabTo(page, checkbox(page, "Dados base"));
  expect(await checkbox(page, "Dados base").evaluate(element => getComputedStyle(element).outlineWidth)).toBe("2px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const color = await page.locator(".studio-section-heading p").evaluate(element => getComputedStyle(element).color);
  expect(color).toBe("rgb(82, 100, 122)");
  await page.screenshot({ path: `test-results/etapa-13-revisar-${width}.png`, fullPage: true });
});
