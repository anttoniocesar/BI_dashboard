import { grantAndOpenCourse, returnToAuthorCourse } from "./fixtures/authenticated-test";
import { test, expect, type Page } from "./fixtures/authenticated-test";

const cell = (page: Page, address: string) => page.locator(".chapter-activity-section.is-current, .author-spreadsheet").getByRole("gridcell", { name: address, exact: true });
async function openChapter(page: Page) {
  await page.goto("/learn/neural-demo");
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
}
async function finishFoundations(page: Page) {
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
}

test("Refinamento: header real, perfil demonstrativo, sidebar e blocos da atividade", async ({ page }) => {
  await openChapter(page);
  const header = page.getByRole("banner"), sidebar = page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
  await expect(header.getByText("Redes Neurais Aplicadas à Engenharia", { exact: true })).toBeVisible();
  await expect(header.getByText("Olá, César", { exact: true })).toBeVisible();
  await expect(header.getByText("Matrícula: 202700184", { exact: true })).toBeVisible();
  await expect(header.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "0");
  expect(await header.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await sidebar.evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(20, 45, 78)");
  await expect(sidebar.locator('a[aria-current="page"]')).toContainText("Fundamentos");
  await expect(sidebar.locator('button[aria-current="step"]')).toContainText("Boas-vindas");
  await expect(page.locator(".chapter-activity-header .activity-letter")).toHaveText(["A", "B", "C.1", "C.2", "C.3", "C.4", "C.5", "C.6", "D", "E"]);
  await expect(page.getByRole("button", { name: "Recolher bloco A", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".video-player-area")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo da aula", exact: true })).toBeVisible();
  await expect(page.locator(".video-lesson-summary")).toContainText("Conheça o caminho antes de começar a prática.");
  await expect(sidebar.getByText("Avaliação bloqueada · conclua os capítulos anteriores.", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: /Aplicação Industrial/ })).toHaveCount(0);
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await expect(header.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "17");
  await expect(page.locator(".chapter-activity-header .activity-state.is-done")).toHaveText(["Concluída ✓"]);
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Como um neurônio aprende", exact: true })).toBeFocused();
  await expect(sidebar.locator('button[aria-current="step"]')).toContainText("Como um neurônio aprende");
  await page.getByRole("button", { name: "Abrir bloco E", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current .material-content-labels")).toHaveText("ConteúdoReferência de arquivo");
  await expect(page.getByRole("link", { name: "Abrir link do material ↗" })).toHaveAttribute("href", "https://example.com/roteiro");
});

test("Refinamento: rodapé respeita acesso e não cria bloqueio novo entre atividades", async ({ page }) => {
  await openChapter(page);
  const navigation = page.getByRole("navigation", { name: "Navegação entre capítulos", exact: true });
  await expect(navigation.getByRole("button", { name: "← Capítulo anterior", exact: true })).toBeDisabled();
  await expect(navigation.getByRole("button", { name: "Próximo capítulo →", exact: true })).toBeDisabled();
  await finishFoundations(page);
  await expect(navigation.getByRole("link", { name: "Próximo capítulo →", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Capítulos e atividades", exact: true }).getByRole("link", { name: /1\. Fundamentos/ }).click();
  await expect(page.locator(".sidebar-chapter-symbol.is-done")).toHaveCount(1);
  await navigation.getByRole("link", { name: "Próximo capítulo →", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "← Capítulo anterior", exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Próximo capítulo →", exact: true })).toBeDisabled();
  // Existing policy permits selecting the Lab before completing the context text.
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await cell(page, "F2").click(); await page.keyboard.type("=1+1"); await page.keyboard.press("Enter");
  await expect(cell(page, "F2")).toHaveText("2");
  await page.getByText("Ver instruções", { exact: true }).click();
  await expect(page.getByText(/Conclua pelo critério do exercício e clique Verificar respostas/)).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Reiniciar planilha", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Reiniciar planilha", exact: true })).toBeFocused();
  await expect(cell(page, "F2")).toHaveText("2");
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Reiniciar planilha", exact: true }).click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await expect(cell(page, "F2")).toBeEmpty();
  await expect(page.getByRole("progressbar", { name: "Progresso do capítulo", exact: true })).toHaveAttribute("value", "0");
});

test("Refinamento: curso de autoria com blocos A/B/C/D, Lab em C e avaliação disponível pela política existente", async ({ page }) => {
  await page.goto("/studio/import");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button", { name: "Analisar arquivo", exact: false }).click();
  await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
  await page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false }).click();
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await cell(page, "A3").click(); await page.getByRole("radio", { name: "Resposta", exact: true }).check();
  await page.getByLabel("Resposta esperada", { exact: true }).fill("30");
  await page.getByLabel("Pontos", { exact: true }).fill("7");
  await page.getByLabel("Feedback quando incorreta", { exact: true }).fill("Revise as entradas da soma.");
  await page.getByRole("button", { name: "Aplicar avaliação", exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("link", { name: "Meus cursos", exact: true }).click();
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Treinamento de Engenharia");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Aplicação do conceito");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  for (const [title, type] of [["Aula gravada", "video"], ["Material de apoio", "material"], ["Exercício em Excel", "spreadsheet-exercise"], ["Avaliação do capítulo", "assessment"]]) {
    await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
    await page.getByLabel("Título da atividade", { exact: true }).fill(title);
    await page.getByLabel("Tipo de atividade", { exact: true }).selectOption(type);
    if (type === "video") await page.getByLabel("URL do vídeo", { exact: true }).fill("https://example.com/lesson.mp4");
    else if (type === "spreadsheet-exercise") await page.getByLabel("Selecionar exercício", { exact: true }).selectOption({ index: 1 });
    else if (type === "material") await page.getByLabel("Texto da atividade", { exact: true }).fill("Material já definido pelo professor.");
    else await page.getByLabel("Descrição da avaliação", { exact: true }).fill("Reflexão manual do capítulo.");
    await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  }
  await grantAndOpenCourse(page);
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await expect(page.locator(".chapter-activity-header .activity-letter")).toHaveText(["A", "B", "C", "D"]);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Carregar vídeo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir bloco C", exact: true }).click();
  await expect(page.getByRole("region", { name: "Exercício em Excel", exact: true }).getByRole("grid")).toBeVisible();
  await cell(page, "A3").click(); await page.keyboard.type("30"); await page.keyboard.press("Enter");
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.getByRole("banner").getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "25");
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await expect(page.getByText("Reflexão manual do capítulo.", { exact: true })).toBeVisible();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true })).toBeEnabled();
  await expect(page.locator(".studio-toolbar,.author-spreadsheet")).toHaveCount(0);
});

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768]]) test(`Refinamento: composição, foco, contraste e Lab em ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await openChapter(page);
  const sidebar = page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
  const video = page.locator(".video-player-area"), summary = page.locator(".video-lesson-summary");
  const vb = await video.boundingBox(), sb = await summary.boundingBox();
  expect(vb).not.toBeNull(); expect(sb).not.toBeNull();
  if (width > 1100) expect(sb!.x).toBeGreaterThan(vb!.x + vb!.width - 1); else expect(sb!.y).toBeGreaterThanOrEqual(vb!.y + vb!.height);
  expect(await sidebar.evaluate(node => getComputedStyle(node).position)).toBe("sticky");
  const back = sidebar.getByRole("link", { name: "← Visão geral do curso", exact: true });
  await page.keyboard.press("Tab");
  await back.focus();
  await expect(back).toBeFocused();
  expect(await back.evaluate(node => node.matches(":focus-visible"))).toBe(true);
  expect(await back.evaluate(node => ({ color: getComputedStyle(node).outlineColor, width: getComputedStyle(node).outlineWidth }))).toEqual({ color: "rgb(255, 255, 255)", width: "2px" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-16-1-capitulo-${width}.png`, fullPage: true });
  await finishFoundations(page);
  await page.getByRole("link", { name: "Continuar para o próximo capítulo", exact: true }).click();
  await expect(page).toHaveURL(/\/chapter\/correcao$/);
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await cell(page, "F2").click(); await page.keyboard.press("Escape"); await page.keyboard.press("Tab");
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-16-1-lab-${width}.png`, fullPage: true });
  const headerBox = await page.getByRole("banner").boundingBox();
  expect(headerBox?.y).toBe(0);
  await page.screenshot({ path: `test-results/etapa-16-1-lab-viewport-${width}.png` });
  const ratio = await sidebar.evaluate(() => {
    const luminance = (color: string) => {
      const channels = color.match(/\d+/g)!.slice(0, 3).map(Number).map(value => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const element = document.querySelector('.learn-sidebar button[aria-current="step"]')!;
    const foreground = luminance(getComputedStyle(element.querySelector("small")!).color), background = luminance(getComputedStyle(element).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(errors).toEqual([]);
});
