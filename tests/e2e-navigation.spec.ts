import { test, expect, login, logout, environments, noOverflow, screenshot } from "./fixtures/e2e-test";

test("@smoke E2E: login, Learn, Studio e Admin pelo formulário real", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/images/brand/bi-society-logo.png");
  expect((await page.request.get("/images/brand/bi-society-logo.png")).status()).toBe(200);
  for (const [identifier, destination, heading] of [
    ["202700184", "/learn", "Meus cursos"],
    ["professor@example.com", "/studio/courses", "Meus cursos"],
    ["admin@example.com", "/admin", "Painel Administrativo"],
  ]) {
    await login(page, identifier);
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await logout(page);
  }
});

for (const width of [1440, 1366, 1024, 390]) test(`E2E navegação aluno, histórico, foco e visual ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
  await page.goto("/login");
  await noOverflow(page); await screenshot(page, "login", width);
  await page.getByLabel("Matrícula ou email", { exact: true }).focus();
  await page.keyboard.press("Tab"); await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(page.getByLabel("Matrícula ou email", { exact: true })).toBeFocused();
  await login(page, "cesar@example.com");
  await noOverflow(page); await screenshot(page, "learn", width);
  await environments(page); await noOverflow(page); await screenshot(page, "home", width);
  await page.reload(); await expect(page.locator(".auth-area-card")).toHaveCount(1);
  await page.getByRole("link", { name: /Ambiente do Aluno/ }).click();
  await page.getByRole("link", { name: /Redes Neurais Aplicadas à Engenharia/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.locator(".learn-header .auth-user-menu")).toBeVisible();
  expect(await page.locator(".learn-header").evaluate(header => header.querySelector(".learn-profile")!.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom)).toBe(true);
  await noOverflow(page); await screenshot(page, "course", width);
  await page.reload(); await expect(page.getByRole("link", { name: "Começar curso", exact: true })).toBeVisible();
  const collapse = page.getByRole("button", { name: "Recolher trilha do curso", exact: true });
  await collapse.focus(); await page.keyboard.press("Enter");
  const expand = page.getByRole("button", { name: "Expandir trilha do curso", exact: true });
  await expect(expand).toBeFocused(); await expect(expand).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Space"); await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/chapter\/fundamentos$/);
  await page.reload(); await expect(page.getByRole("button", { name: "Abrir bloco B", exact: true })).toBeVisible();
  await noOverflow(page); await screenshot(page, "chapter", width);
  await page.getByRole("button", { name: "Abrir bloco B", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current h2")).toBeFocused();
  await page.getByRole("button", { name: "Atividade anterior", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current")).toContainText("Boas-vindas à engenharia aplicada");
  await page.getByRole("button", { name: "Próxima atividade →", exact: true }).click();
  await expect(page.locator(".chapter-activity-section.is-current")).toContainText("Video Aplicação");
  await page.getByRole("button", { name: "Abrir bloco C.1", exact: true }).click();
  const lab = page.locator(".chapter-activity-section.is-current");
  await expect(lab.getByRole("grid")).toBeVisible();
  await noOverflow(page); await screenshot(page, "lab", width);
  await page.getByRole("link", { name: "Voltar para a trilha", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/neural-demo$/);
  await page.goBack(); await expect(page).toHaveURL(/\/chapter\/fundamentos$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fundamentos");
  await page.goForward(); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await page.locator("a.learn-brand").click(); await expect(page).toHaveURL(/\/learn$/);
});

test("E2E links internos e refresh: Admin, Studio, Monitoring e IDs inválidos", async ({ page }) => {
  const hrefs = new Set<string>();
  const collect = async () => {
    for (const href of await page.locator('a[href^="/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("href")!))) hrefs.add(href);
  };
  await page.goto("/login"); await page.reload(); await login(page, "admin@example.com");
  for (const route of ["/admin", "/admin/users", "/admin/users/new", "/admin/users/student-cesar", "/admin/enrollments", "/admin/services"]) {
    await page.goto(route); await expect(page.locator("main h1")).toBeVisible();
    await collect(); await page.reload(); await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".admin-topbar .auth-user-menu")).toBeVisible();
  }
  await page.goto("/admin/users/not-a-user"); await expect(page.locator("main")).toContainText("Usuário não encontrado");
  await logout(page); await login(page, "professor@example.com");
  for (const route of ["/studio/courses", "/studio/courses/new", "/studio/import", "/studio/import/preview", "/studio/editor", "/studio/monitoring", "/studio/monitoring/neural-demo", "/studio/monitoring/neural-demo/student/student-cesar"]) {
    await page.goto(route); await expect(page.locator("h1")).toBeVisible();
    await collect(); await page.reload(); await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/studio/courses/not-a-course"); await expect(page.getByRole("heading", { name: "Curso não disponível nesta sessão", exact: true })).toBeVisible();
  await page.goto("/studio/editor"); await expect(page.getByRole("heading", { name: "Nenhum rascunho aberto", exact: true })).toBeVisible();
  await logout(page); await login(page, "cesar@example.com");
  for (const route of ["/learn", "/learn/neural-demo", "/learn/neural-demo/chapter/fundamentos"]) {
    await page.goto(route); await expect(page.locator("h1")).toBeVisible(); await collect();
  }
  await page.goto("/learn/neural-demo/chapter/not-a-chapter"); await expect(page.getByRole("heading", { name: "Capítulo não disponível", exact: true })).toBeVisible();
  await page.goto("/learn/not-a-course"); await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), `Broken internal link: ${href}`).toBe(200);
  }
  expect(hrefs.size).toBeGreaterThan(15);
});

for (const width of [1440, 1366, 1024]) test(`E2E visual ambientes de gestão ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 768 }); await page.goto("/login"); await login(page, "admin@example.com");
  await noOverflow(page); await screenshot(page, "admin", width);
  await logout(page); await login(page, "professor@example.com");
  await noOverflow(page); await screenshot(page, "studio-courses", width);
  await page.getByRole("link", { name: "Acompanhamento", exact: true }).click();
  await page.getByRole("link", { name: "Redes Neurais Aplicadas à Engenharia", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4); await noOverflow(page); await screenshot(page, "monitoring", width);
});
