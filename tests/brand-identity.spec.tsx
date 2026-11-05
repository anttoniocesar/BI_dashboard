import { test, expect } from "./fixtures/authenticated-test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLogo } from "../components/brand/BrandLogo";

const asset = "/images/brand/bi-society-logo.png";
const digest = "d66ec9a2c164547c8683c475729c437247556e67ce78b59c6bb411c5fb00fb1a";

test("Marca: asset oficial íntegro, proporção e componente genérico", async ({ request }) => {
  const bytes = await readFile(`public${asset}`);
  const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
  expect(hash(bytes)).toBe(digest);
  expect(bytes.readUInt32BE(16)).toBe(4000);
  expect(bytes.readUInt32BE(20)).toBe(4000);
  const response = await request.get(asset);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(hash(await response.body())).toBe(digest);
  for (const environment of [undefined, "Studio", "ACADEMY", "Admin"]) {
    const html = renderToStaticMarkup(<BrandLogo environment={environment} />);
    expect(html).toContain(`src="${asset}"`);
    expect(html).toContain('alt="BI.Society"');
    expect(html).not.toContain("base64");
    if (environment) expect(html).toContain(environment);
  }
});

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768]]) {
  test(`Marca: aluno, capítulo, Studio e Lab em ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [index, route] of ["/learn/neural-demo", "/learn/neural-demo/chapter/fundamentos", "/studio/import", "/studio/courses", "/"].entries()) {
      await page.goto(route);
      const logo = page.locator("header img.brand-logo");
      await expect(logo).toHaveCount(1);
      await expect(logo).toHaveAccessibleName("BI.Society");
      await expect(logo).toHaveAttribute("src", asset);
      await expect.poll(() => logo.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth === 4000)).toBe(true);
      const box = (await logo.boundingBox())!;
      const header = (await page.locator("header").first().boundingBox())!;
      expect(box.width).toBe(box.height);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeLessThanOrEqual(58);
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
      await expect(logo).toHaveCSS("object-fit", "contain");
      if (route.startsWith("/learn")) {
        const course = (await page.locator(".student-header-course").boundingBox())!;
        expect(box.x + box.width).toBeLessThan(course.x);
        await expect(page.locator(".learn-mark")).toHaveCount(0);
        const link = page.getByRole("link", { name: "BI.Society ACADEMY", exact: true });
        await page.keyboard.press("Tab"); await link.focus();
        await expect(link).toBeFocused();
        expect(await link.evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
      }
      if (route.startsWith("/studio")) await expect(page.locator("header .brand-environment")).toHaveText("Studio");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-results/brand-${width}-${index}.png` });
    }
    await page.goto("/studio/import");
    await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/controlled.xlsx");
    await page.getByRole("button", { name: "Analisar arquivo", exact: false }).click();
    await page.getByRole("button", { name: "Revisar abas", exact: false }).click();
    await page.getByRole("button", { name: "Importar e abrir no BI.Society Lab", exact: false }).click();
    await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
    await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
    const editorLogo = page.locator(".studio-editor-header img.brand-logo");
    await expect(editorLogo).toHaveAccessibleName("BI.Society");
    await expect.poll(() => editorLogo.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(4000);
    await expect(page.locator(".studio-editor-header .brand-environment")).toHaveText("Studio");
    await expect(page.getByRole("complementary")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/brand-${width}-editor.png` });
  });
}
