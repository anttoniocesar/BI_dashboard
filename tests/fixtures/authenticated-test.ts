import { test as base, expect } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page, Locator } from "@playwright/test";

/** Existing feature regressions start with an authenticated fixture for their area.
 * Only AuthSession is seeded; permissions and course access still use the real model.
 * Authentication/denial tests import the original test runner and start anonymous.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const area = location.pathname.split("/")[1];
      const userId = area === "admin" ? "admin-demo" : area === "studio" ? "teacher-neural" : area === "learn" ? "student-cesar" : null;
      if (userId) sessionStorage.setItem("bi-society:demo-auth-session:v1", JSON.stringify({ userId, authenticatedAt: new Date().toISOString() }));
    });
    await use(page);
  },
});

export async function switchUser(page: import("@playwright/test").Page, email: string) {
  await page.getByText("Minha conta", { exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Matrícula ou email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("demo123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
export async function grantAndOpenCourse(page: import("@playwright/test").Page) {
  await page.getByRole("button",{name:"Distribuir automaticamente",exact:true}).click();
  await page.getByRole("button",{name:"Publicar",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Salvo · Publicado"})).toBeVisible();
  const href = await page.getByRole("link", { name: "Abrir como aluno", exact: true }).getAttribute("href");
  const courseId = href!.split("/").at(-1)!;
  await switchUser(page, "admin@example.com");
  await page.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("link", { name: "Ver detalhes de César", exact: true }).click();
  await page.getByRole("combobox", { name: "Vínculo de serviço", exact: true }).selectOption("service-cesar");
  await page.getByRole("combobox", { name: "Curso para liberar", exact: true }).selectOption(courseId);
  await page.getByRole("button", { name: "Liberar curso", exact: true }).click();
  await switchUser(page, "cesar@example.com");
  await page.locator(`a[href="${href}"]`).click();
}
export async function returnToAuthorCourse(page: import("@playwright/test").Page, studioUrl: string) {
  await switchUser(page, "professor@example.com");
  await page.locator(`a[href="${new URL(studioUrl).pathname}"]`).first().click();
}
