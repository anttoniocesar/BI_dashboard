import { test, expect, login } from "./fixtures/e2e-test";

for (const [email, allowed, forbidden] of [
  ["cesar@example.com", "/learn", ["/admin", "/studio/courses", "/studio/monitoring/neural-demo"]],
  ["professor@example.com", "/studio/courses", ["/admin", "/learn", "/learn/neural-demo"]],
  ["admin@example.com", "/admin", ["/studio/courses", "/studio/monitoring", "/learn"]],
] as const) test(`E2E matriz de permissões por URL: ${email}`, async ({ page }) => {
  await page.goto("/login"); await login(page, email); await expect(page).toHaveURL(new RegExp(allowed + "$"));
  for (const route of forbidden) {
    await page.goto(route); await expect(page).toHaveURL(/\/unauthorized\?area=/);
    await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
    await expect(page.locator(".admin-shell,.studio-shell,.learn-lab,.chapter-activity-section")).toHaveCount(0);
    await page.reload(); await expect(page.getByRole("heading", { name: "Acesso não autorizado", exact: true })).toBeVisible();
  }
});
