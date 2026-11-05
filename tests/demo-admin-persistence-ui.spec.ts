import { test, expect, login, logout } from "./fixtures/e2e-test";
import { grantAndOpenCourse, switchUser } from "./fixtures/authenticated-test";
import { DEMO_ADMIN_STORAGE_KEY, serializeDemoAdminSnapshot } from "../lib/admin/demo-storage";
import { createAdminFixtures } from "../data/admin/demo";
import type { Page } from "@playwright/test";

const courseTitle = "Curso Teste Completo";
async function createCourse(page: Page) {
  await page.goto("/login"); await login(page, "professor@example.com");
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill(courseTitle);
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Capítulo de teste");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel("Título da atividade", { exact: true }).fill("Video aula");
  await page.getByLabel("URL do vídeo", { exact: true }).fill("https://example.com/aula");
  await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvo · Rascunho" })).toBeVisible();
  return id;
}

test("Demo admin: Curso Teste Completo continua para César e professor em um novo contexto com o mesmo storage", async ({ page, browser }) => {
  const id = await createCourse(page);
  await grantAndOpenCourse(page);
  await expect(page.getByRole("heading", { name: courseTitle, exact: true })).toBeVisible();
  await switchUser(page, "admin@example.com");
  await page.goto("/admin/users/student-cesar");
  await expect(page.getByRole("button", { name: `Revogar curso ${courseTitle}`, exact: true })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("César Demo Persistente");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("César Demo Persistente");
  await expect(page.getByRole("button", { name: `Revogar curso ${courseTitle}`, exact: true })).toBeVisible();
  await page.goto("/admin/users/teacher-neural");
  await page.getByRole("combobox", { name: "Curso do professor", exact: true }).selectOption(id);
  await page.getByRole("button", { name: "Associar professor", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Professor associado");
  await page.goto("/admin/users/new");
  await page.getByLabel("Nome", { exact: true }).fill("Aluno Criado Persistente");
  await page.getByLabel("Email", { exact: true }).fill("novo-persistente@example.com");
  await page.getByLabel("Aluno", { exact: true }).check();
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users\/user-/);
  const userPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Gerar matrícula", exact: true }).click();
  const registration = await page.locator(".admin-registration").innerText();
  await page.getByRole("combobox", { name: "Serviço", exact: true }).selectOption("standalone-course");
  await page.getByRole("button", { name: "Atribuir serviço", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Serviço atribuído");
  await switchUser(page, "cesar@example.com");
  await page.goto("/learn");
  await expect(page.locator(`a[href="/learn/${id}"]`)).toBeVisible();
  const saved = await page.context().storageState(), origin = new URL(page.url()).origin;
  await page.context().close();
  // localStorage survives, sessionStorage/AuthSession does not. Login again.
  const reopened = await browser.newContext({ storageState: saved });
  try {
    const next = await reopened.newPage();
    await next.goto(origin + "/login"); await login(next, "cesar@example.com");
    await next.goto(origin + "/learn");
    await expect(next.locator(`a[href="/learn/${id}"]`)).toBeVisible();
    await expect(next.getByRole("banner").getByText("Olá, César Demo Persistente", { exact: true })).toBeVisible();
    await expect(next.getByRole("banner")).toContainText("202700184");
    await switchUser(next, "professor@example.com");
    await next.goto(origin + "/studio/monitoring");
    await expect(next.getByRole("link", { name: courseTitle, exact: true })).toBeVisible();
    await switchUser(next, "admin@example.com"); await next.goto(origin + userPath);
    await expect(next.getByLabel("Nome", { exact: true })).toHaveValue("Aluno Criado Persistente");
    await expect(next.locator(".admin-registration")).toHaveText(registration);
    await expect(next.getByRole("combobox", { name: "Status do serviço Curso Avulso", exact: true })).toHaveValue("active");
    await next.reload(); await expect(next.locator(".admin-registration")).toHaveText(registration);
    const raw = await next.evaluate(key => localStorage.getItem(key), DEMO_ADMIN_STORAGE_KEY);
    expect(raw).not.toContain('"chapters"');
    expect(JSON.parse(raw!).state.courseAccess).toContainEqual({ userServiceId: "service-cesar", courseId: id });
  } finally { await reopened.close(); }
});

test("Demo admin: revogação, serviço e usuário inativo sobrevivem ao refresh e logout/login", async ({ page }) => {
  await page.goto("/login"); await login(page, "admin@example.com");
  await page.goto("/admin/users/student-cesar");
  await page.getByRole("button", { name: "Revogar curso Redes Neurais Aplicadas à Engenharia", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Revogar curso Redes Neurais Aplicadas à Engenharia", exact: true })).toHaveCount(0);
  await switchUser(page, "cesar@example.com");
  await expect(page.getByRole("heading", { name: "Redes Neurais Aplicadas à Engenharia", exact: true })).toHaveCount(0);
  await switchUser(page, "admin@example.com"); await page.goto("/admin/users/student-cesar");
  await page.getByRole("combobox", { name: "Status do serviço Curso Avulso", exact: true }).selectOption("inactive");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status do serviço Curso Avulso", exact: true })).toHaveValue("inactive");
  await page.locator('select[name="status"]').selectOption("inactive");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await page.reload(); await expect(page.locator('select[name="status"]')).toHaveValue("inactive");
  await logout(page);
  await page.getByLabel("Matrícula ou email", { exact: true }).fill("cesar@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("demo123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Identificação ou senha inválida" })).toBeVisible();
});

test("Demo admin: identidade e matrícula são restauradas antes da autenticação local", async ({ page }) => {
  const state = createAdminFixtures();
  state.users.find(user => user.id === "student-cesar")!.name = "César Nova Identidade";
  state.enrollments[0].registrationCode = "202799999";
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: DEMO_ADMIN_STORAGE_KEY, raw: serializeDemoAdminSnapshot(state) });
  await page.goto("/login"); await login(page, "202799999");
  await expect(page.getByRole("banner").getByText("Olá, César Nova Identidade", { exact: true })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("202799999");
  await page.reload();
  await expect(page.getByRole("banner").getByText("Olá, César Nova Identidade", { exact: true })).toBeVisible();
});

for (const raw of ["{broken", JSON.stringify({ version: 99, state: createAdminFixtures() }), JSON.stringify({ version: 1, state: { users: [] } })]) {
  test(`Demo admin: snapshot inválido restaura fixtures (${raw.slice(0, 20)})`, async ({ page }) => {
    await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: DEMO_ADMIN_STORAGE_KEY, raw });
    await page.goto("/login"); await login(page, "admin@example.com");
    await expect(page.locator(".admin-metric strong")).toHaveText(["3", "1", "1", "2", "1"]);
    expect(await page.evaluate(key => localStorage.getItem(key), DEMO_ADMIN_STORAGE_KEY)).toBeNull();
  });
}

test("Demo admin: reset confirmado remove apenas snapshot administrativo e preserva cursos e Lab", async ({ page }) => {
  await createCourse(page);
  await switchUser(page, "admin@example.com"); await page.goto("/admin/users/student-cesar");
  await page.getByLabel("Nome", { exact: true }).fill("Nome a restaurar");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("demo-lab-reset-marker", "preserved"));
  const courseBefore = await page.evaluate(() => localStorage.getItem("bi-society:course-authoring:v1"));
  await page.goto("/admin");
  await page.screenshot({ path: "test-results/demo-admin-reset-panel.png", fullPage: true });
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Restaurar dados de demonstração", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), DEMO_ADMIN_STORAGE_KEY)).not.toBeNull();
  page.once("dialog", dialog => { expect(dialog.message()).toContain("Cursos salvos no Studio e respostas do Lab serão preservados"); return dialog.accept(); });
  await page.getByRole("button", { name: "Restaurar dados de demonstração", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Dados administrativos de demonstração restaurados");
  expect(await page.evaluate(key => localStorage.getItem(key), DEMO_ADMIN_STORAGE_KEY)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("bi-society:course-authoring:v1"))).toBe(courseBefore);
  expect(await page.evaluate(() => localStorage.getItem("demo-lab-reset-marker"))).toBe("preserved");
  await page.reload(); await page.goto("/admin/users/student-cesar");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("César");
  await page.screenshot({ path: "test-results/demo-admin-restored.png", fullPage: true });
});

test("Demo admin: localStorage bloqueado não impede administrar em memória", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } }));
  await page.goto("/login"); await login(page, "admin@example.com");
  await expect(page.getByRole("heading", { name: "Painel Administrativo", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("somente em memória");
  await page.goto("/admin/users/student-cesar");
  await page.getByLabel("Nome", { exact: true }).fill("César em memória");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await expect(page.getByRole("heading", { name: "César em memória", exact: true })).toBeVisible();
});
