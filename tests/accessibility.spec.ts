import { expect, test, type Page } from "./fixtures/demo";

const cell = (page: Page, address: string) => page.getByRole("gridcell", { name: address, exact: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const bar = (page: Page) => page.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
const verify = (page: Page) => page.getByRole("button", { name: "Verificar respostas", exact: true });
const reset = (page: Page) => page.getByRole("button", { name: "Reiniciar exercício", exact: true });
async function enter(page: Page, address: string, raw: string) {
  await cell(page, address).click();
  await page.keyboard.type(raw);
  await page.keyboard.press("Enter");
}

test("Tab interno, quebra de linha, Enter, Shift+Enter e setas preservam navegação", async ({ page }) => {
  await page.goto("/");
  await cell(page, "B2").focus();
  await page.keyboard.press("Tab");
  await expect(cell(page, "C2")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "B2")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cell(page, "B3")).toBeFocused();
  await page.keyboard.press("Shift+Enter");
  await expect(cell(page, "B2")).toBeFocused();
  for (const [key, address] of [["ArrowRight", "C2"], ["ArrowDown", "C3"], ["ArrowLeft", "B3"], ["ArrowUp", "B2"]]) {
    await page.keyboard.press(key);
    await expect(cell(page, address)).toBeFocused();
  }
  await cell(page, "L1").focus();
  await page.keyboard.press("Tab");
  await expect(cell(page, "A2")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "L1")).toBeFocused();
});

test("Tab em L40 sai para a aba ativa; controles externos e retorno ficam acessíveis", async ({ page }) => {
  await page.goto("/");
  await cell(page, "L40").focus();
  await page.keyboard.press("Tab");
  await expect(tab(page, "Dados")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(verify(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tab(page, "Dados")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "L40")).toBeFocused();
});

test("Shift+Tab em A1 sai para barra e cabeçalho; Tab retorna à mesma célula", async ({ page }) => {
  await page.goto("/");
  await cell(page, "A1").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(bar(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Tela cheia do Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Expandir Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Tamanho normal do Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(reset(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Tamanho normal do Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Expandir Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Tela cheia do Lab", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(bar(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cell(page, "A1")).toBeFocused();
});

test("barra confirma com Tab e mantém ordem natural em ambos os sentidos", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await cell(page, "F2").click();
  await bar(page).fill("=D2*B2+E2*C2");
  await page.keyboard.press("Tab");
  await expect(cell(page, "F2")).toBeFocused();
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(bar(page)).toHaveValue("=D2*B2+E2*C2");
  await page.keyboard.press("Tab");
  await expect(cell(page, "G2")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tab(page, "Treinamento")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "G2")).toBeFocused();
});

test("Esc cancela rascunho; sem edição sai pela aba ativa sem perder seleção", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await cell(page, "F2").focus();
  await page.keyboard.press("F2");
  await page.getByRole("textbox", { name: "Editar F2", exact: true }).fill("=999");
  await page.keyboard.press("Escape");
  await expect(cell(page, "F2")).toHaveText("0.16");
  await expect(cell(page, "F2")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tab(page, "Treinamento")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(verify(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "F2")).toBeFocused();
  await bar(page).fill("=999");
  await page.keyboard.press("Escape");
  await expect(cell(page, "F2")).toBeFocused();
  await expect(bar(page)).toHaveValue("=B2*D2+C2*E2");
});

test("células descrevem coordenada, valor, permissão, papel e estado não verificado", async ({ page }) => {
  await page.goto("/");
  await expect(cell(page, "B2")).toHaveAccessibleName("B2");
  await expect(cell(page, "B2")).toHaveAccessibleDescription("Valor 0.20. Fornecida, protegida.");
  await expect(cell(page, "B2")).toHaveAttribute("aria-readonly", "true");
  await tab(page, "Treinamento").click();
  await expect(cell(page, "F2")).toHaveAccessibleName("F2");
  await expect(cell(page, "F2")).toHaveAccessibleDescription("Valor 0.16. Resposta editável. Não verificada.");
  await expect(cell(page, "F2")).toHaveAttribute("aria-readonly", "false");
  await tab(page, "Análise").click();
  await expect(cell(page, "B3")).toHaveAccessibleDescription("Célula vazia. Resposta editável. Não verificada.");
  await enter(page, "B3", "Temperatura");
  await expect(cell(page, "B3")).toHaveAccessibleDescription("Valor Temperatura. Resposta editável. Não verificada.");
  await tab(page, "Resultados").click();
  await expect(cell(page, "B8")).toHaveAccessibleDescription(/Valor .+ Calculada, protegida\. Não verificada\./);
});

test("descrição comunica acerto, revisão, vazio, erro e invalidação sem depender das cores", async ({ page }) => {
  await page.goto("/");
  await tab(page, "Treinamento").click();
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Valor 0\.16\. Resposta editável\. Resposta correta\./);
  await tab(page, "Resultados").click();
  await expect(cell(page, "B8")).toHaveAccessibleDescription(/Calculada, protegida\. Resposta correta\./);
  await tab(page, "Treinamento").click();
  await enter(page, "F2", "0.16");
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Não verificada\./);
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Precisa de revisão\. Use uma fórmula nesta resposta\./);
  await cell(page, "F2").focus();
  await page.keyboard.press("Delete");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Célula vazia\..*Não respondida, precisa de revisão\./);
  await enter(page, "F2", "=1/0");
  await verify(page).click();
  await expect(cell(page, "F2")).toHaveAccessibleDescription(/Valor #DIV\/0!\..*Precisa de revisão\..*Erro de fórmula: #DIV\/0!/);
});

test("tabs mantêm setas, Home, End e entrada/saída por Tab", async ({ page }) => {
  await page.goto("/");
  await cell(page, "B2").focus();
  await page.keyboard.press("Escape");
  await expect(tab(page, "Dados")).toBeFocused();
  for (const [key, name] of [["ArrowRight", "Treinamento"], ["End", "Análise"], ["ArrowLeft", "Resultados"], ["Home", "Dados"]]) {
    await page.keyboard.press(key);
    await expect(tab(page, name)).toBeFocused();
    await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Tab");
  await expect(verify(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(tab(page, "Dados")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cell(page, "B2")).toBeFocused();
});

test("dialog mantém Cancelar inicial, Tab/Shift+Tab, Esc e retorno à origem", async ({ page }) => {
  await page.goto("/");
  await expect(reset(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".lab-exit")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(reset(page)).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Reiniciar exercício", exact: true });
  const cancel = dialog.getByRole("button", { name: "Cancelar", exact: true });
  const confirm = dialog.getByRole("button", { name: "Reiniciar", exact: true });
  await expect(cancel).toBeFocused();
  await expect(dialog).toHaveAccessibleDescription("Deseja realmente reiniciar o exercício? Todo o progresso atual será apagado.");
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(reset(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(reset(page)).toBeFocused();
});

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const [width, height] of [[1440, 1000], [1024, 768]]) test(`foco, contraste e layout em ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await expect(cell(page, "A1")).toBeVisible();
  const colors = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      indices: [style(".column-heading").color, style(".column-heading").backgroundColor],
      footer: [style(".workspace-footer").color, getComputedStyle(document.body).backgroundColor],
      helper: [style(".sheet-status").color, "rgb(255, 255, 255)"],
      muted: [style(".cell-legend").color, "rgb(255, 255, 255)"],
    };
  });
  for (const pair of Object.values(colors)) expect(contrast(pair[0], pair[1])).toBeGreaterThanOrEqual(4.5);
  await tab(page, "Treinamento").click();
  await cell(page, "F2").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, "F2")).toHaveCSS("box-shadow", /rgb\(20, 45, 78\)/);
  expect(await cell(page, "F2").evaluate(element => element.matches(":focus-visible"))).toBe(true);
  await page.screenshot({ path: `test-results/etapa-9-foco-${width}.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await expect(tab(page, "Treinamento")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(verify(page)).toHaveCSS("outline-color", "rgb(20, 45, 78)");
  await expect(verify(page)).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Pontos obtidos")).toHaveText("70 / 70");
  await page.getByRole("button", { name: "Resultados!B8", exact: true }).click();
  const chart = page.getByRole("region", { name: "Saída real × Saída prevista", exact: true });
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(2);
  await page.screenshot({ path: `test-results/etapa-9-resultados-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
