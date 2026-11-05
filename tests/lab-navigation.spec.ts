import { test, expect, login, noOverflow } from "./fixtures/e2e-test";
import type { Page } from "@playwright/test";
import { deletionWorkspace } from "./fixtures/exercise-deletion";
import { COURSE_STORAGE_KEY } from "../lib/repositories/InMemoryCourseRepository";
import { labRoute, safeLabReturn } from "../lib/navigation/labReturn";

async function seed(page: Page) {
  const workspace = deletionWorkspace();
  await page.goto("/login");
  await page.evaluate(({ key, workspace }) => localStorage.setItem(key, JSON.stringify(workspace)), { key: COURSE_STORAGE_KEY, workspace });
  await login(page, "professor@example.com");
  const courseUrl = `/studio/courses/${workspace.courses[0].id}`;
  await page.goto(courseUrl);
  return courseUrl;
}

async function importPreview(page: Page) {
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
  await page.getByRole("button", { name: /Analisar arquivo/ }).click();
  await page.getByRole("button", { name: /Revisar abas/ }).click();
  await page.getByRole("button", { name: /Importar e abrir no BI.Society Lab/ }).click();
  await expect(page.getByRole("grid")).toBeVisible();
}

test("Navegação: destinos conhecidos e contexto aninhado preservam identidade", () => {
  for (const path of ["/studio/courses", "/studio/courses/course-123", "/studio/courses/course-123/preview", "/learn", "/learn/course-123/chapter/chapter-456", "/admin/users/student-1"]) expect(safeLabReturn(path)).toBe(path);
  const preview = labRoute("/studio/import/preview", "/studio/courses/course-123");
  expect(safeLabReturn(preview)).toBe(preview);
});

test("Navegação: rejeita URLs externas, codificadas, traversal e queries arbitrárias", () => {
  for (const value of [null, "", "/", "https://evil.example", "//evil.example", "javascript:alert(1)", "/studio/../evil", "/studio/courses/../../evil", "/studio/courses\\evil", "/studio/courses/%2e%2e", "/studio/courses/%252e%252e", "/studio/courses?returnTo=https://evil.example", "/learn\n/evil", "/unknown", labRoute("/studio/import/preview", "//evil.example"), "/studio/import?returnTo=%2Flearn&returnTo=%2Fadmin"]) expect(safeLabReturn(value), String(value)).toBeNull();
});

test("Navegação: importação retorna ao Studio por teclado", async ({ page }) => {
  await seed(page); await page.goto("/studio/import");
  const back = page.getByRole("link", { name: "Voltar ao Studio", exact: false });
  await expect(back).toHaveAttribute("href", "/studio/courses");
  await back.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/studio\/courses$/);
  await expect(page.getByRole("heading", { name: "Meus cursos", exact: true })).toBeVisible();
});

test("Navegação: exercício do curso mantém retorno após refresh e simulação", async ({ page }) => {
  const courseUrl = await seed(page);
  await page.getByRole("button", { name: "Editar exercício", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(courseUrl);
  await page.reload();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Visualizar como aluno", exact: true }).click();
  await page.getByRole("button", { name: "Voltar ao editor", exact: true }).click();
  const back = page.getByRole("link", { name: "Voltar ao curso", exact: false });
  await expect(back).toHaveAttribute("href", courseUrl); await back.click();
  await expect(page).toHaveURL(new RegExp(`${courseUrl}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("Navegação: importação do curso propaga contexto por preview, editor e refresh", async ({ page }) => {
  const courseUrl = await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Substituir exercício", exact: true }).click();
  await page.getByRole("link", { name: "Importar novo exercício", exact: true }).click();
  await expect(page.getByRole("link", { name: "Voltar ao curso", exact: false })).toHaveAttribute("href", courseUrl);
  await importPreview(page);
  await noOverflow(page);
  await expect(page.getByRole("link", { name: "Voltar ao curso", exact: false })).toHaveAttribute("href", courseUrl);
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await noOverflow(page);
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/lab-navigation-editor-mobile.png" });
  await page.reload();
  await page.getByRole("link", { name: "Voltar ao curso", exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`${courseUrl}$`));
});

test("Navegação: biblioteca retorna aos exercícios e mantém URL após refresh", async ({ page }) => {
  await seed(page); await page.goto("/studio/courses");
  await page.locator(".exercise-library-list > li").first().getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor\?/); await page.reload();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("link", { name: "Voltar aos exercícios", exact: false }).click();
  await expect(page).toHaveURL(/\/studio\/courses$/);
});

test("Navegação: importação aberta pelo preview retorna ao mesmo preview do professor", async ({ page }) => {
  const courseUrl = await seed(page), preview = `${courseUrl}/preview`;
  await page.goto(preview);
  await page.getByRole("navigation", { name: "Navegação do Studio", exact: true }).getByRole("link", { name: "Importar Excel", exact: true }).click();
  await importPreview(page);
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao preview", exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`${preview}$`));
  await page.getByRole("link", { name: "Voltar ao curso", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${courseUrl}$`));
});

test("Navegação: importação independente retorna ao preview e preview retorna ao Studio", async ({ page }) => {
  await seed(page); await page.goto("/studio/import"); await importPreview(page);
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await page.getByRole("link", { name: "Voltar ao preview", exact: false }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao Studio", exact: false }).click();
  await expect(page).toHaveURL(/\/studio\/courses$/);
});

test("Navegação: preview sem dados e editor vazio preservam saída segura", async ({ page }) => {
  const courseUrl = await seed(page);
  await page.goto(labRoute("/studio/import/preview", courseUrl)); await page.reload();
  await expect(page.getByRole("heading", { name: "Não há uma importação nesta sessão", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao curso", exact: false })).toHaveAttribute("href", courseUrl);
  await page.goto(labRoute("/studio/editor", courseUrl));
  await expect(page.getByRole("heading", { name: "Nenhum rascunho aberto", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao curso", exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`${courseUrl}$`));
});

test("Navegação: returnTo malicioso ou ausente usa fallback sem abrir destino externo", async ({ page }) => {
  await seed(page);
  for (const query of ["?returnTo=https%3A%2F%2Fevil.example", "?returnTo=%2F%2Fevil.example", "?returnTo=%2Flearn&returnTo=%2Fadmin", ""]) {
    await page.goto(`/studio/import${query}`);
    await expect(page.getByRole("link", { name: "Voltar ao Studio", exact: false })).toHaveAttribute("href", "/studio/courses");
    await page.goto(`/studio/editor${query}`);
    await expect(page.getByRole("link", { name: "Voltar ao Studio", exact: false })).toHaveAttribute("href", "/studio/courses");
  }
});

for (const [identifier, label, destination] of [["professor@example.com", "Ir para Studio", "/studio/courses"], ["cesar@example.com", "Ir para meus cursos", "/learn"]]) test(`Navegação: Lab demo oferece saída para ${identifier} em mobile`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/login"); await login(page, identifier);
  await page.goto("/");
  const back = page.getByRole("link", { name: label, exact: false });
  await expect(back).toBeVisible(); await expect(back).toHaveAttribute("href", destination);
  await noOverflow(page);
  await page.screenshot({ path: `test-results/lab-navigation-demo-${identifier.startsWith("professor") ? "teacher" : "student"}-mobile.png` });
  await back.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  if (identifier.startsWith("professor")) { await page.goto("/studio/import"); await expect(page.getByRole("link", { name: "Voltar ao Studio", exact: false })).toBeVisible(); await noOverflow(page); }
});

test("Navegação: Learn retorna do Lab ao capítulo sem sair da atividade", async ({ page }) => {
  await page.goto("/login"); await login(page, "cesar@example.com");
  await page.goto("/learn/neural-demo/chapter/fundamentos");
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
  const back = page.getByRole("link", { name: "Voltar ao capítulo", exact: false }).first();
  await back.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn\/neural-demo\/chapter\/fundamentos#chapter-heading$/);
  await expect(page.locator("#chapter-heading")).toBeFocused();
  await expect(page.locator(".chapter-activity-section.is-current").getByRole("grid")).toBeVisible();
});
