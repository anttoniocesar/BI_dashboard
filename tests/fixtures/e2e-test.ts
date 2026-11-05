import { test as base, expect, type Page } from "@playwright/test";

/** Acceptance tests always authenticate through the public form. */
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" || (message.type() === "warning" && /hydrati|maximum update|unmounted|unique.*key/i.test(message.text()))) errors.push(`${message.text()} ${message.location().url}`);
    });
    await use(errors);
    expect(errors, "Unexpected browser errors during acceptance flow").toEqual([]);
  }, { auto: true }],
});
export { expect };
export async function login(page: Page, identifier: string, password = "demo123") {
  await page.getByLabel("Matrícula ou email", { exact: true }).fill(identifier);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
export async function logout(page: Page) {
  await page.getByText("Minha conta", { exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
}
export async function environments(page: Page) {
  await page.getByText("Minha conta", { exact: true }).click();
  await page.locator(".auth-user-menu").getByRole("link", { name: "Meus ambientes", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
export async function noOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    overflowing: [...document.querySelectorAll("body *")].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(node => ({ tag: node.tagName, className: node.className, width: node.getBoundingClientRect().width })),
  }));
  expect(metrics.fits, `Page must keep horizontal scrolling inside tables/grids: ${JSON.stringify(metrics.overflowing)}`).toBe(true);
}
export async function screenshot(page: Page, name: string, width?: number) {
  await page.screenshot({ path: `test-results/etapa21-${name}${width ? `-${width}` : ""}.png` });
}
