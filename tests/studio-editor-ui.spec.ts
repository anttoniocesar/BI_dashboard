import { test, expect, type Page } from "./fixtures/authenticated-test";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
async function editor(page: Page) {
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button", { name: "Analisar arquivo", exact: false }).click();
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.getByRole("complementary")).toBeVisible();
}
async function edit(page: Page, address: string, value: string) {
  await cell(page, address).click(); await page.keyboard.type(value); await page.keyboard.press("Enter");
}
async function answer(page: Page, address = "A3") {
  await cell(page, address).click(); await page.getByRole("radio", { name: "Resposta", exact: true }).check();
  await page.getByLabel("Resposta esperada", { exact: true }).fill("30");
  await page.getByLabel("Tolerância", { exact: true }).fill("0.005");
  await page.getByLabel("Aluno deve utilizar fórmula", { exact: true }).check();
  await page.getByLabel("Pontos", { exact: true }).fill("10");
  await page.getByLabel("Feedback quando incorreta", { exact: true }).fill("Verifique as referências da soma.");
  await page.getByRole("button", { name: "Aplicar avaliação", exact: true }).click();
  await expect(page.getByText("Pontuação total: 10", { exact: true })).toBeVisible();
}

test("Studio Editor: edição direta/barra, fórmulas, exclusão, cópia/colagem e navegação preservadas", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await editor(page);
  await expect(cell(page, "A1")).toHaveAttribute("aria-readonly", "false");
  await edit(page, "A1", "15"); await expect(cell(page, "A1")).toHaveText("15");
  await edit(page, "A3", "=A1+B1"); await expect(cell(page, "A3")).toHaveText("35");
  await cell(page, "A3").click();
  const bar = page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await expect(bar).toHaveValue("=A1+B1");
  await bar.fill("=A1*2"); await bar.press("Enter"); await expect(cell(page, "A3")).toHaveText("30");
  await cell(page, "A3").click(); await page.keyboard.press("Control+c");
  await cell(page, "B3").click(); await page.keyboard.press("Control+v"); await expect(cell(page, "B3")).toHaveText("40");
  await page.keyboard.press("Delete"); await expect(cell(page, "B3")).toBeEmpty();
  await page.keyboard.press("Tab"); await expect(cell(page, "C3")).toBeFocused();
  await page.keyboard.press("ArrowLeft"); await expect(cell(page, "B3")).toBeFocused();
  await page.keyboard.type("cancelar"); await page.keyboard.press("Escape"); await expect(cell(page, "B3")).toBeEmpty();
  await page.getByRole("tab", { name: "Resultado & análise", exact: true }).click();
  await expect(cell(page, "A1")).toHaveText("35");
  expect(errors).toEqual([]);
});

test("Studio Editor: papéis, proteção do aluno, intervalo e limites", async ({ page }) => {
  await editor(page); await cell(page, "A1").click();
  await page.getByRole("radio", { name: "Calculada", exact: true }).check();
  await edit(page, "A1", "12"); await expect(cell(page, "A1")).toHaveText("12");
  await cell(page, "B1").click(); await page.getByRole("radio", { name: "Editável", exact: true }).check();
  await page.getByLabel("Aplicar ao intervalo", { exact: true }).fill("B1:B2");
  await page.getByRole("button", { name: "Aplicar papel ao intervalo", exact: true }).click();
  await cell(page, "B2").click(); await expect(page.getByRole("radio", { name: "Editável", exact: true })).toBeChecked();
  await page.getByLabel("Aplicar ao intervalo", { exact: true }).fill("Z999");
  await page.getByRole("button", { name: "Aplicar papel ao intervalo", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Intervalo inválido");
  await page.getByRole("button", { name: "Visualizar como aluno", exact: true }).click();
  await expect(cell(page, "A1")).toHaveAttribute("aria-readonly", "true");
  await expect(cell(page, "B1")).toHaveAttribute("aria-readonly", "false");
  await edit(page, "B1", "25"); await expect(cell(page, "B1")).toHaveText("25");
  await edit(page, "A1", "999"); await expect(cell(page, "A1")).toHaveText("12");
  await page.getByRole("button", { name: "Voltar ao editor", exact: true }).click();
  await expect(cell(page, "B1")).toHaveText("20");
  await cell(page, "A1").click(); await page.getByRole("radio", { name: "Fornecida", exact: true }).check();
});

test("Studio e simulações inserem referências com mouse no mesmo editor", async ({ page }) => {
  await editor(page);
  await answer(page);
  for (const view of ["Studio", "Visualizar como aluno", "Testar exercício"]) {
    if (view !== "Studio") await page.getByRole("button", { name: view, exact: true }).click();
    await cell(page, "A3").click();
    await page.keyboard.type("=");
    await cell(page, "A1").click();
    await page.keyboard.type("+");
    await cell(page, "B1").click();
    const input = page.getByRole("textbox", { name: "Editar A3", exact: true });
    await expect(input).toHaveValue("=A1+B1");
    await expect(input).toBeFocused();
    await expect(cell(page, "A3")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(cell(page, "A3")).toHaveText("30");
    if (view !== "Studio") await page.getByRole("button", { name: view === "Visualizar como aluno" ? "Voltar ao editor" : "Sair do teste", exact: true }).click();
  }
});

test("Studio Editor: configuração completa, gabarito oculto, feedback, nota, descarte e salvar jornada", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bi-society:poc01:exercise-state:v1", "preserved"));
  await editor(page); await edit(page, "A3", "=A1+B1"); await answer(page);
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Testar exercício", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Teste do exercício", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByLabel("Resposta esperada", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Tolerância", { exact: true })).toHaveCount(0);
  await expect(cell(page, "A3")).toBeEmpty();
  await edit(page, "A3", "30");
  await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(cell(page, "A3")).toHaveAttribute("class", /validation-incorrect/);
  await edit(page, "A3", "=1"); await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.getByText("Verifique as referências da soma.", { exact: true })).toBeVisible();
  await edit(page, "A3", "=A1+B1"); await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(cell(page, "A3")).toHaveAttribute("class", /validation-correct/);
  await expect(page.getByLabel("Pontos obtidos", { exact: true })).toHaveText("10 / 10");
  await page.getByRole("button", { name: "Sair do teste", exact: true }).click();
  await expect(cell(page, "A3")).toHaveText("30");
  await expect(cell(page, "A3")).not.toHaveAttribute("class", /validation-correct/);
  await page.getByRole("button", { name: "Testar exercício", exact: true }).click(); await expect(cell(page, "A3")).toBeEmpty();
  await page.getByRole("button", { name: "Sair do teste", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao preview", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(cell(page, "A3")).toHaveText("30");
  await cell(page, "A3").click(); await expect(cell(page, "A3")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Resposta esperada", { exact: true })).toHaveValue("30");
  await expect(page.getByLabel("Pontos", { exact: true })).toHaveValue("10");
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bi-society:poc01:exercise-state:v1"))).toBe("preserved");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bi-society:course-authoring:v1")!).exercises)).toHaveLength(1);
});

test("Studio Editor: validação textual e remoção da avaliação ao mudar o papel", async ({ page }) => {
  await editor(page); await cell(page, "B2").click(); await page.getByRole("radio", { name: "Resposta", exact: true }).check();
  await page.getByLabel("Tipo de validação", { exact: true }).selectOption("text");
  await page.getByLabel("Resposta esperada", { exact: true }).fill("Temperatura");
  await page.getByRole("button", { name: "Aplicar avaliação", exact: true }).click();
  await page.getByRole("button", { name: "Testar exercício", exact: true }).click();
  await edit(page, "B2", "temperatura"); await page.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(cell(page, "B2")).toHaveAttribute("class", /validation-correct/);
  await page.getByRole("button", { name: "Sair do teste", exact: true }).click();
  await cell(page, "B2").click(); await page.getByRole("radio", { name: "Editável", exact: true }).check();
  await expect(page.getByText("Pontuação total: 0", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Resposta esperada", { exact: true })).toHaveCount(0);
});

test("Studio Editor: proteção de sessão vazia e recuperação do rascunho salvo após refresh", async ({ page }) => {
  await page.goto("/studio/editor"); await expect(page.getByRole("heading", { name: "Nenhum rascunho aberto" })).toBeVisible();
  await editor(page); await edit(page, "A1", "55");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.reload(); await expect(cell(page,"A1")).toHaveText("55");
  await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.getByLabel("Versão do exercício",{exact:true}).fill("");await cell(page,"A1").click();await expect(page.getByRole("alert").filter({hasText:"versão não vazia"})).toBeVisible();
  await page.getByLabel("Versão do exercício",{exact:true}).fill("0.2-draft");await page.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(page.getByText("Rascunho salvo",{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel("Versão do exercício",{exact:true})).toHaveValue("0.2-draft");await expect(cell(page,"A1")).toHaveText("55");
});

test("Studio Editor: salvar confirma edição por blur e alterações posteriores atualizam o indicador", async ({ page }) => {
  await editor(page);
  await cell(page, "A4").click(); await page.keyboard.type("91");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(cell(page, "A4")).toHaveText("91");
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao preview", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(cell(page, "A4")).toHaveText("91");
  await edit(page, "A4", "92");
  await expect(page.getByText("Alterações não salvas", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Visualizar como aluno", exact: true }).click();
  await expect(cell(page, "A4")).toHaveText("92");
});

test("Studio: seletor de arquivo também abre uma única vez com Space", async ({ page }) => {
  await page.goto("/studio/import");
  await expect(page.getByRole("heading", { name: "Selecione seu arquivo", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  let opened = 0; page.on("filechooser", () => opened++);
  const chooser = page.waitForEvent("filechooser");
  await expect(page.getByRole("button", { name: "Clique para selecionar", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await (await chooser).setFiles("tests/fixtures/xlsx/controlled.xlsx");
  await expect(page.getByRole("button", { name: "Analisar arquivo", exact: false })).toBeEnabled();
  expect(opened).toBe(1);
});

for (const width of [1440, 1024]) test(`Studio Editor: painel por teclado, foco e layout ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 768 }); await editor(page);
  await cell(page, "A1").click(); await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toBeFocused();
  await cell(page, "A1").click(); await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Fornecida", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(page.getByRole("radio", { name: "Calculada", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Calculada", exact: true })).toBeFocused();
  const outline = await page.getByRole("radio", { name: "Calculada", exact: true }).evaluate(node => getComputedStyle(node).outlineWidth);
  expect(outline).toBe("2px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-14-editor-${width}.png`, fullPage: true });
});
