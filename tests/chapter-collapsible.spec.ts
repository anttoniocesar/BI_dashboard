import { test, expect, type Page } from "./fixtures/authenticated-test";

const route = "/learn/neural-demo/chapter/fundamentos";
const block = (page: Page, title: string) => page.locator(".chapter-activity-section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const control = (page: Page, title: string) => block(page, title).locator(".activity-header-toggle");
const labGroup = (page: Page) => page.locator(".chapter-laboratory-section > h2 > button");
const progress = (page: Page) => page.getByRole("progressbar", { name: "Progresso do curso", exact: true });
const nav = (page: Page) => page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
const selectLab = (page: Page, number: number) => nav(page).getByRole("button", { name: new RegExp(`^C\\.${number} Lab ${number} `) }).click();

test("Blocos: cabeçalhos nativos, Enter/Space, A e B independentes e progresso inalterado", async ({ page }) => {
  await page.goto(route);
  const a = block(page, "Boas-vindas à engenharia aplicada"), b = block(page, "Video Aplicação");
  await expect(control(page, "Boas-vindas à engenharia aplicada")).toHaveAttribute("aria-expanded", "true");
  await expect(control(page, "Video Aplicação")).toHaveAttribute("aria-expanded", "false");
  const before = (await a.boundingBox())!.height;
  await a.getByText("Boas-vindas à engenharia aplicada", { exact: true }).click();
  await expect(a.locator(".chapter-activity-body")).toBeHidden();
  await expect(a.getByRole("button", { name: "Concluir atividade", exact: true })).toHaveCount(0);
  expect((await a.boundingBox())!.height).toBeLessThan(before - 100);
  await control(page, "Boas-vindas à engenharia aplicada").focus(); await page.keyboard.press("Space");
  await expect(a.locator(".video-activity-card")).toBeVisible();
  await control(page, "Video Aplicação").focus(); await page.keyboard.press("Enter");
  await expect(a.locator(".video-activity-card")).toBeVisible();
  await expect(b.locator(".video-activity-card")).toBeVisible();
  await expect(page.getByRole("button", { name: "Concluir atividade", exact: true })).toHaveCount(2);
  await control(page, "Video Aplicação").focus();
  expect(await control(page, "Video Aplicação").evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await expect(progress(page)).toHaveAttribute("value", "0");
});

test("Blocos: recolher Lab e grupo preserva instância, edição pendente e autosave", async ({ page }) => {
  await page.goto(route); await selectLab(page, 1);
  const lab = block(page, "Lab 1");
  await lab.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await lab.getByRole("gridcell", { name: "F2", exact: true }).click();
  const bar = lab.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await bar.fill("=B2*D2+C2*E2");
  await lab.getByRole("grid").evaluate(node => { (window as unknown as { preservedGrid: Element }).preservedGrid = node; });
  await control(page, "Lab 1").click(); // blur confirms the draft; debounce may still be pending
  await expect(lab.locator(".chapter-activity-body")).toBeHidden();
  expect(await lab.locator('[role="grid"]').evaluate(node => node === (window as unknown as { preservedGrid: Element }).preservedGrid)).toBe(true);
  await expect.poll(() => lab.locator(".save-status").textContent()).toContain("Salvo");
  await control(page, "Lab 1").click();
  await expect(bar).toHaveValue("=B2*D2+C2*E2");
  await expect(lab.getByRole("gridcell", { name: "F2", exact: true })).toHaveText("0.16");
  await labGroup(page).focus(); await page.keyboard.press("Space");
  await expect(lab).toBeHidden();
  await page.keyboard.press("Enter"); await expect(lab).toBeVisible();
  expect(await lab.getByRole("grid").evaluate(node => node === (window as unknown as { preservedGrid: Element }).preservedGrid)).toBe(true);
  await expect(bar).toHaveValue("=B2*D2+C2*E2");
});

test("Blocos: dois Labs simultâneos têm IDs, ARIA, foco das abas e respostas isolados", async ({ page }) => {
  await page.goto(route); await selectLab(page, 1);
  const first = block(page, "Lab 1"), second = block(page, "Lab 2");
  await first.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await first.getByRole("gridcell", { name: "F2", exact: true }).click();
  await first.getByRole("textbox", { name: "Conteúdo da célula", exact: true }).fill("=1+1");
  await first.getByRole("textbox", { name: "Conteúdo da célula", exact: true }).press("Enter");
  await selectLab(page, 2);
  await expect(page.getByRole("grid")).toHaveCount(2);
  await second.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await expect(second.getByRole("gridcell", { name: "F2", exact: true })).toBeEmpty();
  await expect(first.getByRole("gridcell", { name: "F2", exact: true })).toHaveAccessibleDescription(/Valor 2/);
  await expect(second.getByRole("gridcell", { name: "F2", exact: true })).toHaveAccessibleDescription(/Célula vazia/);
  const tab = second.getByRole("tab", { name: "Treinamento", exact: true });
  await tab.focus(); await page.keyboard.press("ArrowRight");
  await expect(second.getByRole("tab", { name: "Resultados", exact: true })).toBeFocused();
  await expect(first.getByRole("tab", { name: "Treinamento", exact: true })).toHaveAttribute("aria-selected", "true");
  const duplicates = await page.locator("[id]").evaluateAll(nodes => {
    const ids = nodes.map(node => node.id); return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicates).toEqual([]);
  await second.getByRole("button", { name: "Reiniciar planilha", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Reiniciar exercício");
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(second.getByRole("button", { name: "Reiniciar planilha", exact: true })).toBeFocused();
});

test("Blocos: sidebar e anterior/próxima reabrem o alvo, com foco e estados independentes", async ({ page }) => {
  await page.goto(route);
  await control(page, "Boas-vindas à engenharia aplicada").click();
  await page.getByRole("button", { name: "Próxima atividade →", exact: true }).click();
  await expect(control(page, "Video Aplicação")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Video Aplicação", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Atividade anterior", exact: true }).click();
  await expect(control(page, "Boas-vindas à engenharia aplicada")).toHaveAttribute("aria-expanded", "true");
  await expect(control(page, "Video Aplicação")).toHaveAttribute("aria-expanded", "true");
  await selectLab(page, 1); await labGroup(page).click();
  await selectLab(page, 1); // selecting the current activity again must also reopen it
  await expect(labGroup(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Lab 1", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Recolher trilha do curso", exact: true }).click();
  await expect(labGroup(page)).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Expandir trilha do curso", exact: true }).click();
  await expect(control(page, "Lab 1")).toHaveAttribute("aria-expanded", "true");
  await expect(progress(page)).toHaveAttribute("value", "0");
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  await expect(page.locator(".course-overview-sidebar .overview-sidebar-chapter")).toHaveCount(3);
  await expect(page.locator(".course-overview-sidebar .learn-activity-list")).toHaveCount(0);
});

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768]]) test(`Blocos: layout e memória de visualização em ${width}×${height}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height }); await page.goto(route);
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  await control(page, "Video Aplicação").click();
  await selectLab(page, 1);
  await control(page, "Lab 1").click();
  await expect(control(page, "Lab 1")).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/chapter-collapsible-${width}.png` });
  await control(page, "Boas-vindas à engenharia aplicada").click();
  await control(page, "Video Aplicação").click();
  await expect(labGroup(page)).toHaveAttribute("aria-expanded", "true");
  await page.locator(".chapter-laboratory-section").screenshot({ path: `test-results/chapter-collapsible-labs-${width}.png` });
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storage);
  await page.reload();
  await expect(control(page, "Boas-vindas à engenharia aplicada")).toHaveAttribute("aria-expanded", "true");
  await expect(control(page, "Video Aplicação")).toHaveAttribute("aria-expanded", "false");
});
