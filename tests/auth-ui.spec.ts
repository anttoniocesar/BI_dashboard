import { test, expect, type Page } from "@playwright/test";
import { authStorageKey } from "../lib/auth/demo-auth";
import { switchUser } from "./fixtures/authenticated-test";

async function signIn(page: Page, identifier: string, password = "demo123") {
  await page.getByLabel("Matrícula ou email", { exact: true }).fill(identifier);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function environments(page: Page) {
  await page.getByText("Minha conta", { exact: true }).click();
  await page.locator(".auth-user-menu").getByRole("link", { name: "Meus ambientes", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function adminSelf(page: Page) {
  await page.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("link", { name: "Ver detalhes de Administrador BI.Society", exact: true }).click();
}
async function makeMultiRole(page: Page) {
  await adminSelf(page);
  await page.getByLabel("Aluno", { exact: true }).check();
  await page.getByLabel("Professor", { exact: true }).check();
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
}

test("Auth UI: login por matrícula, cursos liberados, identidade, refresh e logout", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "202700184");
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole("heading", { name: "Meus cursos", exact: true })).toBeVisible();
  await expect(page.locator(".auth-area-card")).toHaveCount(2);
  await expect(page.getByText("Olá, César", { exact: true })).toBeVisible();
  await expect(page.getByText("Matrícula: 202700184", { exact: true })).toBeVisible();
  const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), authStorageKey);
  expect(Object.keys(stored).sort()).toEqual(["authenticatedAt", "userId"]);
  expect(stored.userId).toBe("student-cesar");
  await page.reload();
  await expect(page.getByText("Olá, César", { exact: true })).toBeVisible();
  await environments(page);
  await expect(page.locator(".auth-area-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Ambiente do Aluno/ })).toBeVisible();
  await page.getByText("Minha conta", { exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey)).toBeNull();
});
test("Auth UI: credenciais incorretas e inexistentes mantêm login sem sessão", async ({ page }) => {
  await page.goto("/login");
  for (const [identifier, password] of [["cesar@example.com", "wrong"], ["missing@example.com", "demo123"]]) {
    await signIn(page, identifier, password);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Identificação ou senha inválida.");
    expect(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey)).toBeNull();
  }
});
test("Auth UI: usuário inativo não entra e usuário autenticado inativado perde sessão", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "admin@example.com");
  await page.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("link", { name: "Ver detalhes de César", exact: true }).click();
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("inactive");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await page.getByText("Minha conta", { exact: true }).click(); await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/); await signIn(page, "cesar@example.com");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Identificação ou senha inválida.");
  await signIn(page, "admin@example.com"); await adminSelf(page);
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("inactive");
  await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey)).toBeNull();
  await expect(page.locator(".admin-shell")).toHaveCount(0);
});
test("Auth UI: aluno tem Learn e é bloqueado no Studio e Admin por URL direta", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "CESAR@example.com");
  for (const route of ["/studio/courses", "/studio/editor", "/studio/import/preview", "/admin", "/admin/users/new"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/unauthorized\?area=/);
    await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
    await expect(page.locator(".studio-shell, .admin-shell, .studio-toolbar")).toHaveCount(0);
  }
});
test("Auth UI: professor tem Studio, header correto e não recebe Admin ou Learn", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "professor@example.com");
  await expect(page).toHaveURL(/\/studio\/courses$/);
  await expect(page.getByText("Professor Neural · Professor", { exact: true })).toBeVisible();
  await environments(page);
  await expect(page.locator(".auth-area-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /BI.Society Studio/ })).toBeVisible();
  await page.goto("/admin/enrollments"); await expect(page).toHaveURL(/unauthorized\?area=admin/);
  await page.goto("/learn/neural-demo/chapter/fundamentos"); await expect(page).toHaveURL(/unauthorized\?area=learn/);
  await expect(page.locator(".chapter-player, .chapter-activity-section")).toHaveCount(0);
});
test("Auth UI: acesso anônimo não mostra conteúdo e returnTo interno autorizado funciona", async ({ page }) => {
  const flashes: string[] = [];
  await page.exposeFunction("recordProtectedFlash", (name: string) => flashes.push(name));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (!sessionStorage.getItem("bi-society:demo-auth-session:v1") && document.querySelector(".admin-shell, .studio-shell, .learn-header")) (window as unknown as { recordProtectedFlash(name: string): void }).recordProtectedFlash(location.pathname);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin%2Fusers/);
  expect(flashes).toEqual([]);
  await signIn(page, "admin@example.com");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible();
});
test("Auth UI: returnTo externo ou de ambiente indevido não redireciona fora da permissão", async ({ page }) => {
  await page.goto("/login?returnTo=https%3A%2F%2Fevil.example");
  await signIn(page, "cesar@example.com"); await expect(page).toHaveURL(/\/learn$/);
  await page.getByText("Minha conta", { exact: true }).click(); await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/login?returnTo=%2Fadmin");
  await signIn(page, "cesar@example.com"); await expect(page).toHaveURL(/\/learn$/);
});
test("Auth UI: curso e capítulo sem liberação não renderizam conteúdo; serviço inativo esvazia catálogo", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "admin@example.com");
  await page.getByRole("link", { name: "Usuários", exact: true }).click(); await page.getByRole("link", { name: "Ver detalhes de César", exact: true }).click();
  await page.getByRole("combobox", { name: "Status do serviço Curso Avulso", exact: true }).selectOption("inactive");
  await switchUser(page, "cesar@example.com");
  await expect(page.getByText("Nenhum curso foi liberado para você ainda.", { exact: true })).toBeVisible();
  // Use normal links from the history to preserve the in-memory inactive service.
  await environments(page); await page.getByRole("link", { name: /Ambiente do Aluno/ }).click();
  await expect(page.locator(".auth-area-card")).toHaveCount(0);
  // A reload recreates fixtures; direct denial is also checked on an ungranted ID.
  for (const route of ["/learn/not-granted", "/learn/not-granted/chapter/fundamentos"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
    await expect(page.locator(".learn-header, .chapter-activity-section, .course-journey-board")).toHaveCount(0);
  }
});
test("Auth UI: multi-role, permissões dinâmicas e remoção de perfil da própria sessão", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "admin@example.com"); await makeMultiRole(page);
  await environments(page); await expect(page.locator(".auth-area-card")).toHaveCount(3);
  await page.getByRole("link", { name: /BI.Society Studio/ }).click(); await expect(page).toHaveURL(/\/studio\/courses$/);
  await environments(page); await page.getByRole("link", { name: /^Administração/ }).click(); await adminSelf(page);
  await page.getByLabel("Professor", { exact: true }).uncheck(); await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await environments(page); await expect(page.locator(".auth-area-card")).toHaveCount(2); await expect(page.getByRole("link", { name: /BI.Society Studio/ })).toHaveCount(0);
  await page.getByRole("link", { name: /^Administração/ }).click(); await adminSelf(page);
  await page.getByLabel("Administrador", { exact: true }).uncheck(); await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await expect(page).toHaveURL(/unauthorized\?area=admin/);
  await page.getByRole("link", { name: "Meus ambientes", exact: true }).click(); await expect(page.locator(".auth-area-card")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Ambiente do Aluno/ })).toBeVisible();
});
test("Auth UI: logout preserva progresso e tentativa, troca de usuário isola os dados", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "admin@example.com");
  await page.getByRole("link", { name: "Usuários", exact: true }).click(); await page.getByRole("link", { name: "Ver detalhes de Professor Neural", exact: true }).click();
  await page.getByLabel("Aluno", { exact: true }).check(); await page.getByRole("button", { name: "Salvar dados e perfis", exact: true }).click();
  await page.getByRole("button", { name: "Gerar matrícula", exact: true }).click();
  await page.getByRole("combobox", { name: "Serviço", exact: true }).selectOption("standalone-course"); await page.getByRole("button", { name: "Atribuir serviço", exact: true }).click();
  await page.getByRole("combobox", { name: "Vínculo de serviço", exact: true }).selectOption({ label: "Curso Avulso" }); await page.getByRole("combobox", { name: "Curso para liberar", exact: true }).selectOption("neural-demo"); await page.getByRole("button", { name: "Liberar curso", exact: true }).click();
  await switchUser(page, "cesar@example.com"); await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click(); await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  const lab = page.locator(".chapter-activity-section.is-current");
  await lab.getByRole("tab", { name: "Treinamento", exact: true }).click(); await lab.getByRole("gridcell", { name: "F2", exact: true }).click();
  await lab.getByRole("textbox", { name: "Conteúdo da célula", exact: true }).fill("=123"); await lab.getByRole("textbox", { name: "Conteúdo da célula", exact: true }).press("Enter");
  await expect(lab.getByText("Salvo ✓", { exact: true })).toBeVisible();
  await switchUser(page, "professor@example.com"); await expect(page).toHaveURL(/\/home$/); await page.getByRole("link", { name: /Ambiente do Aluno/ }).click();
  await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click(); await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "0");
  await page.getByRole("link", { name: "Começar curso", exact: true }).click(); await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await lab.getByRole("tab", { name: "Treinamento", exact: true }).click(); await expect(lab.getByRole("gridcell", { name: "F2", exact: true })).toBeEmpty();
  await switchUser(page, "cesar@example.com"); await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click(); await expect(page.getByRole("progressbar", { name: "Progresso do curso" })).toHaveAttribute("value", "17");
  await page.getByRole("link", { name: "Continuar estudos", exact: true }).click(); await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  await lab.getByRole("tab", { name: "Treinamento", exact: true }).click(); await lab.getByRole("gridcell", { name: "F2", exact: true }).click();
  await expect(lab.getByRole("textbox", { name: "Conteúdo da célula", exact: true })).toHaveValue("=123");
});
test("Auth UI: revogar liberação impede revisitar o curso e capítulo pela mesma sessão", async ({ page }) => {
  await page.goto("/login"); await signIn(page, "admin@example.com"); await makeMultiRole(page);
  await page.getByRole("button", { name: "Gerar matrícula", exact: true }).click();
  await page.getByRole("combobox", { name: "Serviço", exact: true }).selectOption("standalone-course"); await page.getByRole("button", { name: "Atribuir serviço", exact: true }).click();
  await page.getByRole("combobox", { name: "Vínculo de serviço", exact: true }).selectOption({ label: "Curso Avulso" }); await page.getByRole("combobox", { name: "Curso para liberar", exact: true }).selectOption("neural-demo"); await page.getByRole("button", { name: "Liberar curso", exact: true }).click();
  await environments(page); await page.getByRole("link", { name: /Ambiente do Aluno/ }).click(); await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click();
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  const chapterPath = new URL(page.url()).pathname;
  await environments(page); await page.getByRole("link", { name: /^Administração/ }).click(); await adminSelf(page);
  await page.getByRole("button", { name: "Revogar curso Redes Neurais Aplicadas à Engenharia", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("revogada");
  for (let count = 0; count < 5 && new URL(page.url()).pathname !== chapterPath; count++) await page.goBack();
  await expect(page).toHaveURL(new RegExp(chapterPath + "$"));
  await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
  await expect(page.locator(".chapter-activity-section")).toHaveCount(0);
  await page.getByRole("link", { name: "Voltar aos cursos", exact: true }).click();
  await expect(page.locator(".auth-area-card")).toHaveCount(0);
});
test("Auth UI: sessão inválida ou usuário desconhecido é descartado antes do conteúdo", async ({ page }) => {
  for (const raw of ["not-json", JSON.stringify({ userId: "missing", authenticatedAt: "2026-10-23T12:00:00Z" })]) {
    await page.goto("/login"); await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: authStorageKey, value: raw });
    await page.goto("/admin"); await expect(page).toHaveURL(/\/login/); await expect(page.locator(".admin-shell")).toHaveCount(0);
    expect(await page.evaluate(key => sessionStorage.getItem(key), authStorageKey)).toBeNull();
  }
});
test("Auth UI: sessionStorage bloqueado mantém login em memória e logout utilizável", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("blocked", "SecurityError"); } }); });
  await page.goto("/login"); await expect(page.getByRole("status")).toContainText("somente em memória");
  await signIn(page, "cesar@example.com"); await expect(page).toHaveURL(/\/learn$/);
  await page.getByText("Minha conta", { exact: true }).click(); await page.getByRole("button", { name: "Sair", exact: true }).click(); await expect(page).toHaveURL(/\/login/);
});
for (const width of [1440, 1024, 390]) test(`Auth UI: login responsivo, teclado e foco ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 768 }); await page.goto("/login");
  await expect(page.getByLabel("Matrícula ou email", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab"); await expect(page.getByLabel("Matrícula ou email", { exact: true })).toBeFocused();
  expect(await page.getByLabel("Matrícula ou email", { exact: true }).evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await page.keyboard.press("Tab"); await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/auth-login-${width}.png` });
});
