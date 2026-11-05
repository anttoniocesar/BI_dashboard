import { test, expect, type Page, type Locator } from "./fixtures/authenticated-test";

async function create(page: Page, title = "Redes Neurais Aplicadas à Engenharia") {
  await page.goto("/studio/courses");
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill(title);
  await page.getByLabel("Descrição do curso", { exact: true }).fill("Aprendizado aplicado ao processo industrial.");
  await page.getByLabel("Objetivo do curso", { exact: true }).fill("Praticar correção de erro.");
  await page.getByLabel("Carga horária (horas)", { exact: true }).fill("8");
  await page.getByLabel("Descrição da imagem de capa (placeholder)", { exact: true }).fill("Capa de engenharia");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}
async function chapter(page: Page, title: string) {
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  return page.getByRole("region", { name: title, exact: true });
}
async function activity(region: Locator, title: string, type: string) {
  await region.getByRole("button", { name: "Nova atividade", exact: true }).click();
  const form = region.getByRole("form", { name: "Nova atividade", exact: true });
  await form.getByLabel("Título da atividade", { exact: true }).fill(title);
  await form.getByLabel("Tipo de atividade", { exact: true }).selectOption(type);
  return form;
}
async function saveExercise(page: Page, raw = "91", navigate = true) {
  if (navigate) await page.goto("/studio/import");
  else await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button", { name: "Analisar arquivo", exact: false }).click();
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await page.getByRole("gridcell", { name: "A4", exact: true }).click();
  await page.keyboard.type(raw);
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
}

test("Cursos: criar/editar, capítulos, cinco conteúdos, ordenar/excluir atividades e preview", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await create(page);
  await page.getByLabel("Título do curso", { exact: true }).fill("Engenharia de Processos");
  await page.getByLabel("Descrição do curso", { exact: true }).fill("Descrição revisada");
  await page.getByRole("button", { name: "Salvar dados do curso", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Engenharia de Processos");
  const first = await chapter(page, "Fundamentos");
  await chapter(page, "Correção de Erro");
  await page.getByRole("button", { name: "Subir capítulo Correção de Erro", exact: true }).click();
  await expect(page.locator(".course-chapter h3")).toHaveText(["Correção de Erro", "Fundamentos"]);
  let form = await activity(first, "Aula gravada", "video");
  await form.getByLabel("URL do vídeo", { exact: true }).fill("https://example.com/video");
  await form.getByLabel("Duração (minutos, opcional)", { exact: true }).fill("15");
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  form = await activity(first, "Introdução", "text");
  await form.getByLabel("Texto da atividade", { exact: true }).fill("Conceitos iniciais.");
  await form.getByLabel("Atividade obrigatória", { exact: true }).uncheck();
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  form = await activity(first, "Material de apoio", "material");
  await form.getByLabel("Texto da atividade", { exact: true }).fill("Leia o material.");
  await form.getByLabel("Nome do arquivo (metadata)", { exact: true }).fill("apoio.pdf");
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  form = await activity(first, "Avaliação final", "assessment");
  await form.getByLabel("Descrição da avaliação", { exact: true }).fill("Estrutura mínima da avaliação.");
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await first.getByRole("button", { name: "Subir atividade Introdução", exact: true }).click();
  await expect(first.locator(".course-activity h4")).toHaveText(["1. Introdução", "2. Aula gravada", "3. Material de apoio", "4. Avaliação final"]);
  const video = first.getByRole("article", { name: "2. Aula gravada", exact: true });
  await video.getByRole("button", { name: "Editar atividade", exact: true }).click();
  await expect(first.getByLabel("URL do vídeo", { exact: true })).toHaveValue("https://example.com/video");
  await first.getByLabel("Título da atividade", { exact: true }).fill("Aula atualizada");
  await first.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await first.getByRole("article", { name: "4. Avaliação final", exact: true }).getByRole("button", { name: "Excluir atividade", exact: true }).click();
  await expect(first.locator(".course-activity")).toHaveCount(3);
  await page.getByRole("button", { name: "Visualizar estrutura do curso", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estrutura do curso", exact: true })).toBeFocused();
  await expect(page.locator(".course-structure")).toContainText("Introdução — Texto · Opcional");
  await expect(page.locator(".course-structure")).toContainText("Aula atualizada");
  await page.getByRole("button", { name: "Voltar à edição do curso", exact: true }).click();
  await page.getByRole("link", { name: "Voltar aos cursos", exact: true }).click();
  await expect(page.locator(".course-card")).toContainText("2 capítulos · 3 atividades");
  await expect(page.locator(".course-card")).toContainText("Descrição revisada");
  await expect(page.locator(".course-card time")).toHaveAttribute("datetime", /^\d{4}-/);
  expect(errors).toEqual([]);
});

test("Cursos: valida incompleto, edita capítulo, confirma exclusão com Cancelar/Esc e foco", async ({ page }) => {
  await create(page);
  await page.getByRole("button", { name: "Validar estrutura", exact: true }).click();
  await expect(page.getByLabel("Validação da estrutura", { exact: true })).toContainText("pelo menos um capítulo");
  let region = await chapter(page, "Capítulo inicial");
  await region.getByRole("button", { name: "Editar capítulo", exact: true }).click();
  await region.getByLabel("Título do capítulo", { exact: true }).fill("Fundamentos");
  await region.getByLabel("Descrição do capítulo", { exact: true }).fill("Base do curso.");
  await region.getByRole("button", { name: "Salvar capítulo", exact: true }).click();
  region = page.getByRole("region", { name: "Fundamentos", exact: true });
  await expect(page.getByLabel("Validação da estrutura", { exact: true })).toContainText("Estrutura válida");
  let form = await activity(region, "Sem biblioteca", "spreadsheet-exercise");
  await expect(form.getByText("Nenhum exercício disponível.", { exact: false })).toBeVisible();
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await expect(region.locator(".course-activity")).toHaveCount(0);
  await form.getByRole("button", { name: "Cancelar atividade", exact: true }).click();
  const remove = region.getByRole("button", { name: "Excluir capítulo", exact: true });
  await remove.click(); const dialog = page.getByRole("dialog", { name: "Excluir capítulo?", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(remove).toBeFocused();
  await remove.click(); await dialog.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(region).toBeVisible();
  await remove.click(); await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.locator(".course-chapter")).toHaveCount(0);
  await expect(page.getByLabel("Título do novo capítulo", { exact: true })).toBeFocused();
});

test("Cursos: vincula exercício salvo, abre o mesmo editor, atualiza definição e retorna sem perder curso", async ({ page }) => {
  const external: string[] = [], errors: string[] = [];
  page.on("request", request => { if (!request.url().startsWith("http://localhost:")) external.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("bi-society:poc01:exercise-state:v1", "untouched"));
  await saveExercise(page);
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exercícios da sessão", exact: true })).toBeVisible();
  // Keep the Studio provider mounted: client navigation, never page.goto here.
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso com Lab");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/); const courseUrl = page.url();
  const region = await chapter(page, "Prática");
  const form = await activity(region, "Exercício da planilha", "spreadsheet-exercise");
  await form.getByLabel("Selecionar exercício", { exact: true }).selectOption({ label: "controlled.xlsx · 0.1-draft" });
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await page.getByRole("button", { name: "Validar estrutura", exact: true }).click();
  await expect(page.getByLabel("Validação da estrutura", { exact: true })).toContainText("Estrutura válida");
  await region.getByRole("button", { name: "Editar exercício", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.getByRole("gridcell", { name: "A4", exact: true })).toHaveText("91");
  await page.getByRole("gridcell", { name: "A4", exact: true }).click(); await page.keyboard.type("92");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("link", { name: /Voltar ao (curso|preview)/, exact: false }).click();
  await expect(page).toHaveURL(courseUrl);
  await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1. Exercício da planilha", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar exercício", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/); await expect(page.getByRole("gridcell", { name: "A4", exact: true })).toHaveText("92");
  expect(await page.evaluate(() => localStorage.getItem("bi-society:poc01:exercise-state:v1"))).toBe("untouched");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bi-society:course-authoring:v1")!).courses)).toHaveLength(1);
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test("Cursos: IDs independentes, persistência após refresh e rota desconhecida recuperável", async ({ page }) => {
  await create(page, "Primeiro curso"); const first = page.url();
  await page.getByRole("link", { name: "Voltar aos cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Segundo curso");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/); expect(page.url()).not.toBe(first);
  await page.getByRole("link", { name: "Voltar aos cursos", exact: true }).click();
  await expect(page.locator(".course-card")).toHaveCount(2);
  await page.reload(); await expect(page.locator(".course-card")).toHaveCount(2);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["bi-society:course-authoring:v1"]);
  await page.goto(first); await expect(page.getByRole("heading", { name: "Primeiro curso", exact: true })).toBeVisible();
  await page.goto(first+"-missing");await expect(page.getByRole("heading",{name:"Curso não disponível nesta sessão",exact:true})).toBeVisible();
});

test("Cursos: dois exercícios da biblioteca mantêm identidade, conteúdo e curso ao importar novamente", async ({ page }) => {
  await saveExercise(page, "91");
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Biblioteca de exercícios");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await chapter(page, "Práticas");
  await page.getByRole("link", { name: "Importar Excel", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/import(?:\?.*)?$/);
  await saveExercise(page, "62", false);
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await expect(page.locator(".course-library li")).toHaveCount(2);
  await page.getByRole("link", { name: "Continuar editando", exact: true }).click();
  const region = page.getByRole("region", { name: "Práticas", exact: true });
  let form = await activity(region, "Primeiro Lab", "spreadsheet-exercise");
  const ids = await form.getByLabel("Selecionar exercício", { exact: true }).locator("option").evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value).filter(Boolean));
  expect(ids).toHaveLength(2); expect(ids[0]).not.toBe(ids[1]);
  await form.getByLabel("Selecionar exercício", { exact: true }).selectOption(ids[0]);
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  form = await activity(region, "Segundo Lab", "spreadsheet-exercise");
  await form.getByLabel("Selecionar exercício", { exact: true }).selectOption(ids[1]);
  await form.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  for (const [title, value] of [["1. Primeiro Lab", "91"], ["2. Segundo Lab", "62"], ["1. Primeiro Lab", "91"]]) {
    await page.getByRole("article", { name: title, exact: true }).getByRole("button", { name: "Editar exercício", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
    await expect(page.getByRole("gridcell", { name: "A4", exact: true })).toHaveText(value);
    await page.getByRole("link", { name: /Voltar ao (curso|preview)/, exact: false }).click();
    await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  }
  await expect(region.locator(".course-activity")).toHaveCount(2);
});

for (const width of [1440, 1024]) test(`Cursos: teclado, ordenação, foco e layout ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 768 });
  await create(page, "Curso de Engenharia"); const region = await chapter(page, "Fundamentos");
  await chapter(page, "Aplicação");
  const move = page.getByRole("button", { name: "Subir capítulo Aplicação", exact: true });
  await move.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Aplicação", exact: true })).toBeFocused();
  await region.getByRole("button", { name: "Nova atividade", exact: true }).focus(); await page.keyboard.press("Enter");
  const title = region.getByLabel("Título da atividade", { exact: true });
  await expect(title).toBeFocused(); await page.keyboard.type("Introdução"); await page.keyboard.press("Tab");
  await expect(region.getByLabel("Tipo de atividade", { exact: true })).toBeFocused();
  await region.getByLabel("Tipo de atividade", { exact: true }).selectOption("text");
  await region.getByRole("button", { name: "Salvar atividade", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(region.getByRole("button", { name: "Nova atividade", exact: true })).toBeFocused();
  const focus = await region.getByRole("button", { name: "Nova atividade", exact: true }).evaluate(node => getComputedStyle(node).outlineWidth);
  expect(focus).toBe("2px");
  const coursesLink = page.getByRole("navigation", { name: "Navegação do Studio", exact: true }).getByRole("link", { name: "Meus cursos", exact: true });
  await coursesLink.focus();
  expect(await coursesLink.evaluate(node => getComputedStyle(node).outlineColor)).toBe("rgb(255, 255, 255)");
  await region.getByRole("button", { name: "Nova atividade", exact: true }).focus();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-15-curso-${width}.png`, fullPage: true });
});
