import { test, expect, type Page } from "@playwright/test";
import { LAB_VIEW_KEY } from "../lib/spreadsheet/labViewPreference";
import type { MemoryExerciseRepository } from "./fixtures/MemoryExerciseRepository";

const view = (page: Page) => page.locator(".lab-view");
const grid = (page: Page) => page.locator(".grid-viewport");
const handle = (page: Page) => page.getByRole("separator", { name: "Ajustar altura da planilha", exact: true });
const expand = (page: Page) => page.getByRole("button", { name: "Expandir Lab", exact: true });
const normal = (page: Page) => page.getByRole("button", { name: "Tamanho normal do Lab", exact: true });
const full = (page: Page) => page.getByRole("button", { name: "Tela cheia do Lab", exact: true });
const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const height = async (page: Page) => (await grid(page).boundingBox())!.height;
async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3002");
  await expect(page.getByRole("grid")).toBeVisible();
}
async function drag(page: Page, offset: number) {
  await handle(page).scrollIntoViewIfNeeded();
  const box = (await handle(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + offset, { steps: 8 }); await page.mouse.up();
}
async function saveCount(page: Page) {
  return page.evaluate(() => (window as unknown as { testRepository: MemoryExerciseRepository }).testRepository.calls.filter(call => call.operation === "save").length);
}

test("Lab view UI: modos, drag e teclado respeitam limites, preservam instância/seleção e não salvam respostas", async ({ page }) => {
  await open(page);
  await expect(normal(page)).toHaveAttribute("aria-pressed", "true");
  expect(await height(page)).toBe(520);
  await cell(page, "B2").click();
  await expect(page.getByRole("status", { name: "Status de salvamento", exact: true })).toContainText("Salvo");
  const original = await page.getByRole("grid").elementHandle();
  const saves = await saveCount(page);
  await expand(page).click(); await expect.poll(() => height(page)).toBe(700);
  await drag(page, 100); await expect.poll(() => height(page)).toBe(800);
  await expect(cell(page, "B2")).toHaveAttribute("aria-selected", "true");
  expect(await original!.evaluate(node => node.isConnected)).toBe(true);
  await handle(page).press("Home"); await expect.poll(() => height(page)).toBe(320);
  await drag(page, -500); await expect.poll(() => height(page)).toBe(320);
  await handle(page).press("End"); await expect.poll(() => height(page)).toBe(850);
  await drag(page, 500); await expect.poll(() => height(page)).toBe(850);
  await handle(page).press("ArrowUp"); await expect.poll(() => height(page)).toBe(818);
  await normal(page).click(); await expect.poll(() => height(page)).toBe(520);
  await page.waitForTimeout(1000);
  expect(await saveCount(page)).toBe(saves);
});

test("Lab view UI: fullscreen nativo, Esc e botão restauram altura sem remontar ou alterar preferências", async ({ page }) => {
  await open(page); await expand(page).click();
  const original = await page.getByRole("grid").elementHandle();
  const stored = await page.evaluate(key => localStorage.getItem(key), LAB_VIEW_KEY);
  await full(page).click();
  await expect(view(page)).toHaveAttribute("data-view-mode", "fullscreen");
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Treinamento", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Status de salvamento", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(view(page)).toHaveAttribute("data-view-mode", "expanded");
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(full(page)).toBeFocused();
  await full(page).click();
  await page.getByRole("button", { name: "Sair da tela cheia do Lab", exact: true }).click();
  await expect(view(page)).toHaveAttribute("data-view-mode", "expanded");
  expect(await original!.evaluate(node => node.isConnected)).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), LAB_VIEW_KEY)).toBe(stored);
  await expect.poll(() => height(page)).toBe(700);
  await full(page).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(view(page)).toHaveAttribute("data-view-mode", "expanded");
  await full(page).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.evaluate(() => (window as unknown as { remountLab: () => void }).remountLab());
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

for (const unavailable of [true, false]) {
  test(`Lab view UI: fallback CSS com API ${unavailable ? "ausente" : "recusada"}, foco, Esc e cleanup`, async ({ page }) => {
    await page.addInitScript(unavailable => {
      Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: unavailable ? undefined : () => Promise.reject(new Error("Denied")) });
    }, unavailable);
    await open(page); await full(page).click();
    await expect(view(page)).toHaveClass(/lab-view-fullscreen/);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(page.getByRole("button", { name: "Sair da tela cheia do Lab", exact: true })).toBeFocused();
    const bounds = (await view(page).boundingBox())!;
    expect(bounds.width).toBe(1440); expect(bounds.height).toBe(1000);
    await page.keyboard.press("Escape");
    await expect(view(page)).toHaveAttribute("data-view-mode", "normal");
    await expect(full(page)).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await full(page).click();
    await page.evaluate(() => (window as unknown as { remountLab: () => void }).remountLab());
    await expect(view(page)).toHaveAttribute("data-view-mode", "normal");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
}

test("Lab view UI: altura persiste após refresh/remontagem e reset não apaga preferência; fórmulas/gráficos funcionam", async ({ page }) => {
  await open(page); await drag(page, 80);
  const custom = await height(page);
  await page.getByRole("tab", { name: "Treinamento", exact: true }).click();
  await cell(page, "F2").click(); await page.keyboard.type("=");
  await cell(page, "B2").click(); await page.keyboard.type("*"); await cell(page, "D2").click(); await page.keyboard.press("Enter");
  await expect(cell(page, "F2")).toHaveText("0.04");
  await page.getByRole("tab", { name: "Resultados", exact: true }).click();
  await expect(page.getByRole("region", { name: "Erro absoluto por amostra", exact: true })).toBeVisible();
  await expect.poll(() => height(page)).toBe(custom);
  await page.getByRole("button", { name: "Reiniciar exercício", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect.poll(() => height(page)).toBe(custom);
  await page.reload(); await expect(page.getByRole("grid")).toBeVisible();
  await expect.poll(() => height(page)).toBe(custom);
  await expect(view(page)).toHaveAttribute("data-view-mode", "custom");
});

test("Lab view UI: leitura de preferência bloqueada usa Normal e mantém redimensionamento em memória", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    Storage.prototype.setItem = () => { throw new Error("blocked"); };
  });
  await open(page);
  await expect(view(page)).toHaveAttribute("data-view-mode", "normal");
  await expand(page).click(); await expect.poll(() => height(page)).toBe(700);
  await drag(page, -100); await expect.poll(() => height(page)).toBe(600);
});

test("Lab view UI: preferência inválida/storage bloqueado mantém controles e mobile sem overflow", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bi-society:lab-view-preference:v1", '{"version":1,"mode":"fullscreen","height":-50}'));
  await open(page); await expect(view(page)).toHaveAttribute("data-view-mode", "normal");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await page.setViewportSize({ width: 390, height: 844 });
  await expand(page).click();
  await expect(view(page)).toHaveAttribute("data-view-mode", "expanded");
  await expect.poll(() => height(page)).toBeCloseTo(844 * .7, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/lab-view-mobile-390.png", fullPage: true });
  await full(page).click(); await expect(view(page)).toHaveAttribute("data-view-mode", "fullscreen");
  expect((await view(page).boundingBox())!.width).toBe(390);
  await page.screenshot({ path: "test-results/lab-view-fullscreen-mobile-390.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await height(page)).toBeLessThanOrEqual(390 * .85);
});
