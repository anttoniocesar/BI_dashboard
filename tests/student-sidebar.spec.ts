import { test, expect, type Page, type Locator } from "./fixtures/authenticated-test";

const collapse = (page: Page) => page.getByRole("button", { name: "Recolher trilha do curso", exact: true });
const expand = (page: Page) => page.getByRole("button", { name: "Expandir trilha do curso", exact: true });
const width = async (node: Locator) => (await node.boundingBox())!.width;
async function expectWidth(node: Locator, expected: number) { await expect.poll(() => width(node)).toBe(expected); }

for (const [viewportWidth, height] of [[1440, 1000], [1366, 768], [1024, 768]]) {
  test(`Sidebar retrátil: largura, espaço, estados e sticky em ${viewportWidth}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: viewportWidth, height });
    await page.goto("/learn/neural-demo");
    const nav = page.getByRole("navigation", { name: "Trilha do curso", exact: true });
    const openWidth = viewportWidth > 1200 ? 280 : 260;
    await expectWidth(nav, openWidth);
    await expect(collapse(page)).toHaveAttribute("aria-expanded", "true");
    expect(await collapse(page).getAttribute("aria-controls")).toBe(await nav.getAttribute("id"));
    const content = page.locator(".course-overview-content");
    const before = await width(content);
    await expect(nav.locator("ol ol, ol ul")).toHaveCount(0);
    const items = nav.locator(":scope > ol > li");
    const boxes = await items.evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      const line = getComputedStyle(node, "::before");
      return { top: rect.top, bottom: rect.bottom, line: line.borderLeftWidth };
    }));
    expect(boxes).toHaveLength(3);
    expect(boxes[2].bottom - boxes[0].top).toBeLessThan(500);
    for (let index = 0; index < boxes.length - 1; index++) {
      expect(boxes[index + 1].top - boxes[index].bottom).toBe(19);
      expect(boxes[index].line).toBe("1px");
    }
    await collapse(page).click();
    await expectWidth(nav, 72);
    await expect(expand(page)).toBeFocused();
    await expect(expand(page)).toHaveAttribute("aria-expanded", "false");
    expect(await width(content)).toBeGreaterThan(before + 150);
    await expect(nav.locator(".overview-sidebar-checkpoint")).toHaveCount(3);
    for (const point of await nav.locator(".overview-sidebar-checkpoint").all()) await expect(point).toBeVisible();
    await expect(nav.locator(".overview-sidebar-chapter strong").first()).toBeHidden();
    await expect(nav.locator(".overview-sidebar-activities")).toHaveCount(0);
    await expect(nav.getByRole("link")).toHaveCount(1);
    await expect(nav.locator('[aria-current="step"] .overview-sidebar-checkpoint')).toHaveCSS("background-color", "rgb(181, 84, 24)");
    await expect(nav.locator(".sidebar-lock")).toHaveCount(2);
    await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "0");
    await expect(page).toHaveURL(/\/learn\/neural-demo$/);
    // Check sticky before the end of its containing block, where it naturally
    // releases to leave room for the page footer.
    const gridHeight = (await page.locator(".course-overview-shell").boundingBox())!.height;
    await page.evaluate(distance => window.scrollTo(0, distance), Math.max(0, Math.min(200, gridHeight - (height - 80) - 4)));
    expect((await expand(page).boundingBox())!.y).toBeGreaterThanOrEqual(80);
    expect((await expand(page).boundingBox())!.y).toBeLessThan(140);
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/sidebar-overview-${viewportWidth}.png` });
    await expand(page).click();
    await expectWidth(nav, openWidth);
    await expectWidth(content, before);
    await expect(nav.locator(".overview-sidebar-activities")).toHaveCount(0);
    await expect(nav.locator(".overview-sidebar-description").first()).toBeVisible();
    await page.screenshot({ path: `test-results/sidebar-overview-simplified-${viewportWidth}.png` });
    await page.getByRole("link", { name: "Começar curso", exact: true }).click();
    const chapterNav = page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
    const chapterOpen = viewportWidth > 1100 ? 260 : 240;
    await expectWidth(chapterNav, chapterOpen);
    const study = page.locator(".learn-study-main"), studyBefore = await width(study);
    await collapse(page).click();
    await expectWidth(chapterNav, 72);
    expect(await width(study)).toBeGreaterThan(studyBefore + 150);
    await expect(chapterNav.locator(".learn-activity-list")).toBeHidden();
    await expect(chapterNav.locator('[aria-current="page"] .sidebar-chapter-symbol')).toHaveCSS("background-color", "rgb(181, 84, 24)");
    await expect(chapterNav.getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Boas-vindas à engenharia aplicada", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/sidebar-chapter-${viewportWidth}.png` });
    await expand(page).click();
    await expectWidth(chapterNav, chapterOpen);
    await expectWidth(study, studyBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Sidebar retrátil: teclado, tooltips, bloqueio e estado compartilhado entre rotas", async ({ page }) => {
  await page.goto("/learn/neural-demo");
  await expect(page.locator(".learn-header")).toBeVisible();
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab"); // brand
  await page.keyboard.press("Tab"); // authenticated user menu
  await page.keyboard.press("Tab");
  await expect(collapse(page)).toBeFocused();
  expect(await collapse(page).evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await page.keyboard.press("Enter");
  await expect(expand(page)).toBeFocused();
  const nav = page.getByRole("navigation", { name: "Trilha do curso", exact: true });
  await expectWidth(nav, 72);
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: /Capítulo 1 — Fundamentos/ })).toBeFocused();
  await expect(nav.locator(".sidebar-tooltip")).toHaveText("Capítulo 1 — Fundamentos · Atual");
  await page.keyboard.press("Escape");
  await expect(nav.locator(".sidebar-tooltip")).toHaveCount(0);
  await page.keyboard.press("Tab");
  const locked = nav.getByRole("group", { name: /Capítulo 2 — Correção de Erro/ });
  await expect(locked).toBeFocused();
  await expect(locked).toHaveAttribute("aria-disabled", "true");
  await expect(nav.locator(".sidebar-tooltip")).toContainText("Correção de Erro");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/neural-demo$/);
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
  await expect(expand(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(collapse(page)).toBeFocused();
  await expectWidth(nav, 280);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/chapter\/fundamentos$/);
  await expect(expand(page)).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await expect(expand(page)).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("link", { name: "Continuar para o próximo capítulo", exact: true }).click();
  await expect(page).toHaveURL(/chapter\/correcao$/);
  await expect(expand(page)).toBeVisible();
  const chapterNav = page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
  await expect(chapterNav.locator(".sidebar-chapter-symbol.is-done")).toHaveText("✓");
  await expect(chapterNav.locator('[aria-current="page"]')).toHaveAccessibleName(/Correção de Erro/);
  await page.locator(".chapter-navigation").getByRole("link", { name: "Voltar para a trilha", exact: true }).click();
  await expect(expand(page)).toBeVisible();
  await expect(nav.locator('[data-status="Concluído"] .overview-sidebar-checkpoint')).toHaveCSS("background-color", "rgb(40, 105, 68)");
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "33");
});

test("Sidebar retrátil: Lab mantém instância, fórmula, seleção, avaliação e gráficos ao redimensionar", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/learn/neural-demo/chapter/fundamentos");
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("link", { name: "Continuar para o próximo capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  const f2 = page.locator(".chapter-activity-section.is-current").getByRole("gridcell", { name: "F2", exact: true });
  await f2.click();
  const bar = page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await bar.fill("=B2*D2+C2*E2"); await bar.press("Enter");
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await f2.click();
  const evaluation = await page.locator(".chapter-activity-section.is-current").locator(".exercise-validation").textContent();
  const viewport = page.locator(".chapter-activity-section.is-current").locator(".grid-viewport"), originalWidth = await width(viewport);
  await page.locator(".chapter-activity-section.is-current").getByRole("grid").evaluate(node => { (window as unknown as { sidebarGrid: Element }).sidebarGrid = node; });
  await collapse(page).click();
  await expectWidth(page.locator(".learn-sidebar"), 72);
  expect(await width(viewport)).toBeGreaterThan(originalWidth + 150);
  expect(await page.locator(".chapter-activity-section.is-current").getByRole("grid").evaluate(node => (window as unknown as { sidebarGrid: Element }).sidebarGrid === node)).toBe(true);
  await expect(bar).toHaveValue("=B2*D2+C2*E2");
  await expect(f2).toHaveText("0.16");
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.locator(".chapter-activity-section.is-current").locator(".exercise-validation").textContent()).toBe(evaluation);
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "50");
  await expand(page).click();
  await expectWidth(page.locator(".learn-sidebar"), 240);
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Resultados", exact: true }).click();
  const chart = page.getByRole("region", { name: "Saída real × Saída prevista", exact: true });
  const chartSvg = chart.getByRole("application", { name: "Saída real × Saída prevista", exact: true });
  await expect(chartSvg).toBeVisible();
  const chartBefore = await width(chartSvg);
  await collapse(page).click();
  await expectWidth(page.locator(".learn-sidebar"), 72);
  await expect.poll(() => width(chartSvg)).toBeGreaterThan(chartBefore + 150);
  await expect(page.getByRole("region", { name: "Erro absoluto por amostra", exact: true })).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click(); await f2.click();
  await expect(bar).toHaveValue("=B2*D2+C2*E2");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/sidebar-lab-1024.png" });
  expect(errors).toEqual([]);
});

test("Sidebar retrátil: movimento reduzido e refresh sem persistência", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/learn/neural-demo");
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await expect(page.locator(".course-overview-shell")).toHaveCSS("transition-duration", "0s");
  await collapse(page).click();
  await expectWidth(page.locator(".course-overview-sidebar"), 72);
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage);
  await page.reload();
  await expect(collapse(page)).toBeVisible();
  await expectWidth(page.locator(".course-overview-sidebar"), 280);
});
