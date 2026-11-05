import { test, expect } from "@playwright/test";
test("piloto publicado: health, login, curso, capítulo e logout", async ({ page, request }) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/ready")).status()).toBe(200);
  await page.goto("/login");
  await expect(page.getByText(/demo123|Perfil demonstrativo|Ambiente de demonstração local/)).toHaveCount(0);
  try {
    await page.getByLabel("Matrícula ou email", { exact: true }).fill(process.env.PRODUCTION_SMOKE_IDENTIFIER!);
    await page.getByLabel("Senha", { exact: true }).fill(process.env.PRODUCTION_SMOKE_PASSWORD!);
  } catch { throw new Error("Não foi possível preencher o formulário do smoke."); }
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(learn|home)$/);
  if (new URL(page.url()).pathname === "/home") await page.getByRole("link", { name: /Ambiente do Aluno/ }).click();
  await page.locator(`a[href="/learn/${process.env.PRODUCTION_SMOKE_COURSE ?? "neural-pilot"}"]`).click();
  await page.getByRole("link", { name: /Começar curso|Continuar estudos|Revisitar curso/, exact: true }).click();
  await expect(page).toHaveURL(/\/chapter\//); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByText("Minha conta", { exact: true }).click(); await page.getByRole("button", { name: "Sair", exact: true }).click(); await expect(page).toHaveURL(/\/login/);
});
