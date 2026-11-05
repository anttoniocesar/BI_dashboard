import { test, expect, type Page } from "./fixtures/authenticated-test";
import { createInitialWorkbook } from "../data/neural-network-demo";

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
const lab = (page: Page, number: number) => sidebar(page).getByRole("button", { name: new RegExp(`^C\\.${number} Lab ${number} `) });
const group = (page: Page) => sidebar(page).getByRole("button", { name: /^C\. Laboratório/ });

for (const courseId of ["chapter-navigation-demo", "neural-demo"]) {
const url = `/learn/${courseId}/chapter/fundamentos`;
test(`${courseId}: vídeos, seis Labs, expansão por teclado e identificação no conteúdo`, async ({ page }) => {
  await page.goto(url);
  await expect(sidebar(page).getByRole("button", { name: /^A\. Video Aula/ })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { name: courseId === "neural-demo" ? "Boas-vindas à engenharia aplicada" : "Video Aula", exact: true })).toBeFocused();
  await sidebar(page).getByRole("button", { name: /^B\. Video Aplicação/ }).click();
  await expect(page.getByRole("heading", { name: "Video Aplicação", exact: true })).toBeFocused();
  await expect(page.locator(".chapter-activity-section.is-current .video-activity-card")).toBeVisible();
  await expect(page.locator("video,iframe")).toHaveCount(0);
  await expect(group(page)).toContainText("0 de 6 concluídos");
  await group(page).focus(); await page.keyboard.press("Space");
  await expect(group(page)).toHaveAttribute("aria-expanded", "false");
  await expect(lab(page, 1)).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(group(page)).toHaveAttribute("aria-expanded", "true");
  for (let number = 1; number <= 6; number++) await expect(lab(page, number)).toBeVisible();
  await lab(page, 2).click();
  await expect(page.getByRole("heading", { name: "Lab 2", exact: true })).toBeFocused();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "Recolher bloco C.2", exact: true })).toHaveAttribute("aria-expanded", "true");
  await group(page).click();
  await page.getByRole("button", { name: "Próxima atividade →", exact: true }).click();
  await expect(group(page)).toHaveAttribute("aria-expanded", "true");
  await expect(lab(page, 3)).toHaveAttribute("aria-current", "step");
});

test(`${courseId}: aprovação agregada, tentativas isoladas, recuperação e visão geral preservada`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(url);
  const storage = await page.evaluate(() => ({ ...localStorage }));
  await lab(page, 1).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  const solution = createInitialWorkbook().worksheets.find(sheet => sheet.id === "treinamento")!.cells;
  for (let row = 2; row <= 6; row++) for (const column of ["F", "H", "I", "J"]) {
    const address = `${column}${row}`;
    await page.locator(".chapter-activity-section.is-current").getByRole("gridcell", { name: address, exact: true }).click();
    const bar = page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true });
    await bar.fill(solution[address]); await bar.press("Enter");
  }
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await expect(group(page)).toContainText("1 de 6 concluídos");
  await expect(lab(page, 1)).toContainText("Concluída ✓");
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Salvo ✓", { exact: true })).toBeVisible();
  await lab(page, 2).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("gridcell", { name: "F2", exact: true })).toBeEmpty();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("gridcell", { name: "B2", exact: true })).toHaveAttribute("aria-readonly", "true");
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Aguardando aprovação do exercício.", { exact: true })).toBeVisible();
  await lab(page, 1).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("tab", { name: "Treinamento", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("gridcell", { name: "F2", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue(solution.F2);
  await expect(page.locator(".chapter-activity-section.is-current").getByText("Exercício concluído", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  const overview = page.getByRole("navigation", { name: "Trilha do curso", exact: true });
  await expect(overview.locator(".overview-sidebar-chapter")).toHaveCount(courseId === "neural-demo" ? 3 : 1);
  await expect(overview.locator(".learn-activity-list,.overview-sidebar-activities")).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", courseId === "neural-demo" ? "0" : "13");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storage);
  expect(errors).toEqual([]);
});

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768]]) {
  test(`${courseId}: layout, foco, hierarquia e sidebar retrátil em ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto(url);
    await expect(lab(page, 6)).toBeVisible();
    const parent = (await group(page).boundingBox())!, child = (await lab(page, 1).boundingBox())!;
    expect(child.x).toBeGreaterThan(parent.x);
    await group(page).focus(); await page.keyboard.press("Tab");
    await expect(lab(page, 1)).toBeFocused();
    expect(await lab(page, 1).evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
    await page.keyboard.press("Enter"); await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
    await page.getByRole("button", { name: "Recolher trilha do curso", exact: true }).click();
    await expect(group(page)).toBeHidden();
    await page.getByRole("button", { name: "Expandir trilha do curso", exact: true }).click();
    await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBe(width > 1100 ? 260 : 240);
    await expect(lab(page, 1)).toHaveAttribute("aria-current", "step");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await lab(page, 6).focus();
    await expect(lab(page, 6)).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await sidebar(page).evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `test-results/${courseId}-chapter-navigation-${width}.png` });
  });
}
}
