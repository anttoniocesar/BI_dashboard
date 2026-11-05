import { grantAndOpenCourse, returnToAuthorCourse } from "./fixtures/authenticated-test";
import { test, expect, type Page } from "./fixtures/authenticated-test";
import { createInitialWorkbook } from "../data/neural-network-demo";

const cell = (page: Page, address: string) => page.locator(".chapter-activity-section.is-current, .author-spreadsheet").getByRole("gridcell", { name: address, exact: true });
async function finishFoundations(page: Page) {
  await page.goto("/learn/neural-demo");
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
}
async function openLab(page: Page) {
  await finishFoundations(page);
  await page.getByRole("link", { name: "Continuar para o próximo capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
}

test("Aluno: visão geral, checkpoints, bloqueio inclusive por URL e recuperação", async ({ page }) => {
  await page.goto("/learn/neural-demo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.getByRole("banner").getByText("Redes Neurais Aplicadas à Engenharia", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Jornada do curso" }).locator("li")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Vídeo de abertura do curso", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "0");
  await expect(page.locator(".learn-locked")).toHaveCount(2);
  await page.goto("/learn/neural-demo/chapter/correcao");
  await expect(page.getByRole("heading", { name: "Capítulo bloqueado", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar à visão geral" }).click();
  await page.goto("/learn/neural-demo/chapter/absent");
  await expect(page.getByRole("heading", { name: "Capítulo não disponível", exact: true })).toBeVisible();
  await page.goto("/learn/absent");
  await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar aos cursos" }).click();
  await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.getByRole("banner").getByText("Redes Neurais Aplicadas à Engenharia", { exact: true })).toBeVisible();
});

test("Aluno: vídeo inerte, texto, material, obrigatórias e memória entre telas", async ({ page }) => {
  const external: string[] = []; page.on("request", request => { if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) external.push(request.url()); });
  await finishFoundations(page);
  await expect(page.getByRole("heading", { name: "Capítulo concluído ✓", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do capítulo" })).toHaveAttribute("value", "100");
  await page.getByRole("button", { name: /Roteiro de estudo/ }).click();
  await expect(page.getByRole("heading", { name: "Roteiro de estudo", exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: "Abrir link do material ↗" })).toHaveAttribute("href", "https://example.com/roteiro");
  await expect(page.getByText("Referência de arquivo: roteiro-de-estudo.pdf")).toBeVisible();
  await page.getByRole("button", { name: /Boas-vindas à engenharia aplicada/ }).click();
  await expect(page.getByText("Este formato de vídeo ainda não possui reprodução incorporada.")).toBeVisible();
  await expect(page.locator("iframe,video")).toHaveCount(0);
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "33");
  await expect(page.locator(".learn-locked")).toHaveCount(1);
  await page.getByRole("link", { name: "Continuar estudos", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Correção de Erro");
  expect(external).toEqual([]);
});

test("Aluno: Lab real, reprovação/aprovação, gráficos, isolamento e conclusão do curso", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("bi-society:poc01:exercise-state:v1", "preservado"));
  await openLab(page);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/etapa-16-lab-${width}.png`, fullPage: true });
  }
  for (const label of ["Resposta esperada", "Tolerância", "Feedback quando incorreta"]) await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Configuração da célula" })).toHaveCount(0);
  await expect(page.locator(".studio-toolbar,.author-spreadsheet")).toHaveCount(0);
  await cell(page, "A1").click(); await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(cell(page, "A1")).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Dados", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Aguardando aprovação do exercício.", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do capítulo" })).toHaveAttribute("value", "50");
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await expect(cell(page, "F2")).toBeEmpty();
  await expect(cell(page, "B2")).toHaveAttribute("aria-readonly", "true");
  const solution = createInitialWorkbook().worksheets.find(sheet => sheet.id === "treinamento")!.cells;
  for (let row = 2; row <= 6; row++) for (const column of ["F", "H", "I", "J"]) {
    const address = `${column}${row}`;
    await cell(page, address).click();
    const bar = page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true });
    await bar.fill(solution[address]); await bar.press("Enter");
  }
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Capítulo concluído ✓", exact: true })).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Resultados", exact: true }).click();
  await expect(page.getByRole("region", { name: "Gráficos de Resultados", exact: true })).toBeVisible();
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Salvo ✓", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "67");
  await page.getByRole("link", { name: /02 Correção de Erro/ }).click();
  await page.getByRole("button", { name: /Laboratório de correção de erro/ }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Exercício concluído", { exact: true })).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click(); await cell(page, "F2").click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("=B2*D2+C2*E2");
  await page.getByRole("link", { name: "Continuar para o próximo capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Próxima atividade →", exact: true }).click();
  await expect(page.getByText(/Reflexão com conclusão manual/)).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("link", { name: "Curso concluído — ver progresso", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "100");
  await expect(page.getByText("Curso concluído ✓", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("bi-society:poc01:exercise-state:v1"))).toBe("preservado");
  expect(errors).toEqual([]);
});

test("Aluno: rascunho vazio fica no preview, publicação e acesso ao capítulo vazio persistem no demo", async ({ page }) => {
  await page.goto("/studio/courses/new");
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso da sessão");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  const studioUrl = page.url();
  await page.getByRole("button",{name:"Publicar",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"pelo menos um capítulo"}).first()).toBeVisible();
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();await expect(page.getByText("Nenhuma atividade neste curso.",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Voltar ao curso",exact:true}).click();await expect(page).toHaveURL(studioUrl);
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Capítulo vazio");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  await grantAndOpenCourse(page);
  await expect(page).toHaveURL(/\/learn\/course-/);
  const learnUrl=page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.getByRole("banner").getByText("Curso da sessão", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await expect(page.getByText("Este capítulo ainda não possui atividades.", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do capítulo" })).toHaveAttribute("value", "0");
  await page.reload();
  await expect(page.getByText("Este capítulo ainda não possui atividades.", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do capítulo" })).toHaveAttribute("value", "0");
  await page.goto(learnUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.getByRole("banner").getByText("Curso da sessão", { exact: true })).toBeVisible();
});

test("Aluno: exercício importado associado ao curso usa mestre sem gabarito e a mesma avaliação", async ({ page }) => {
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button", { name: "Analisar arquivo", exact: false }).click();
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await cell(page, "A3").click(); await page.keyboard.type("=A1+B1"); await page.keyboard.press("Enter");
  await cell(page, "A3").click(); await page.getByRole("radio", { name: "Resposta", exact: true }).check();
  await page.getByLabel("Resposta esperada", { exact: true }).fill("30");
  await page.getByLabel("Aluno deve utilizar fórmula", { exact: true }).check();
  await page.getByLabel("Pontos", { exact: true }).fill("7");
  await page.getByLabel("Feedback quando incorreta", { exact: true }).fill("Confira as entradas fornecidas.");
  await page.getByRole("button", { name: "Aplicar avaliação", exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso importado");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Prática importada");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel("Título da atividade", { exact: true }).fill("Lab de soma");
  await page.getByLabel("Tipo de atividade", { exact: true }).selectOption("spreadsheet-exercise");
  await page.getByLabel("Selecionar exercício", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await grantAndOpenCourse(page);
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await expect(cell(page, "A3")).toBeEmpty();
  await expect(cell(page, "A1")).toHaveAttribute("aria-readonly", "true");
  await expect(page.getByLabel("Resposta esperada", { exact: true })).toHaveCount(0);
  await expect(page.locator(".studio-shell,.studio-toolbar,.author-spreadsheet")).toHaveCount(0);
  await cell(page, "A3").click(); await page.keyboard.type("=A1+B1"); await page.keyboard.press("Enter");
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.getByLabel("Pontos obtidos", { exact: true })).toHaveText("7 / 7");
  await expect(page.getByRole("heading", { name: "Capítulo concluído ✓", exact: true })).toBeVisible();
});

for (const width of [1440, 1024]) test(`Aluno: teclado, foco e layout ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 768 });
  await page.goto("/learn/neural-demo");
  const start = page.getByRole("link", { name: "Começar curso", exact: true });
  await start.focus();
  expect(await start.evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await page.screenshot({ path: `test-results/etapa-16-curso-${width}.png`, fullPage: true });
  await page.keyboard.press("Enter");
  const finish = page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true });
  await finish.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Próxima atividade →", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Video Aplicação", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Como um neurônio aprende", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-16-capitulo-${width}.png`, fullPage: true });
});
