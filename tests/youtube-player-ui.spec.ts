import { test, expect, grantAndOpenCourse, type Page } from "./fixtures/authenticated-test";

const id = "tuBZqgp9TD0";
const shorts = `https://www.youtube.com/shorts/${id}`;
const embed = `https://www.youtube.com/embed/${id}`;
const player = (page: Page) => page.locator('iframe[title="Vídeo da atividade no YouTube"]');

async function createCourse(page: Page, lessons: [string, string][]) {
  await page.goto("/studio/courses/new");
  await page.getByLabel("Título do curso", { exact: true }).fill("Curso Teste Completo");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Capítulo de vídeos");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  for (const [title, url] of lessons) {
    await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
    await page.getByLabel("Título da atividade", { exact: true }).fill(title);
    await page.getByLabel("Tipo de atividade", { exact: true }).selectOption("video");
    await page.getByLabel("URL do vídeo", { exact: true }).fill(url);
    await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
    await expect(page.locator(".course-activity").filter({ hasText: title })).toHaveCount(1);
  }
  await expect(page.getByRole("status").filter({ hasText: "Salvo · Rascunho" })).toBeVisible();
}

test("YouTube: Studio salva URL comum; preview e Learn incorporam o Shorts real sem concluir automaticamente", async ({ page }) => {
  // Offline: test our iframe integration, not YouTube availability or its UI.
  const embeds: string[] = [];
  await page.route("https://www.youtube.com/embed/**", route => {
    embeds.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>YouTube controlado</title><p>Player externo controlado para teste</p>" });
  });
  const lessons: [string, string][] = [["Video aula", shorts], ["Vídeo watch", `https://www.youtube.com/watch?feature=shared&v=${id}&t=10`], ["Vídeo curto", `https://youtu.be/${id}?si=shared`]];
  await createCourse(page, lessons);
  await page.getByRole("link", { name: "Visualizar como aluno", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Curso Teste Completo");
  for (const [title, original] of lessons) {
    await page.getByRole("navigation", { name: "Atividades do preview" }).getByRole("button", { name: `Capítulo de vídeos · ${title}`, exact: true }).click();
    await expect(player(page)).toHaveAttribute("src", embed);
    await expect(page.locator(".learn-url")).toHaveText(original);
    await expect(page.getByRole("button", { name: "Concluir atividade", exact: true })).toBeVisible();
    await expect(page.getByText("Atividade concluída ✓", { exact: true })).toHaveCount(0);
  }
  await player(page).scrollIntoViewIfNeeded();
  await expect.poll(() => embeds.length).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Voltar ao curso", exact: true }).click();
  await grantAndOpenCourse(page);
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Video aula", exact: true })).toBeVisible();
  await expect(player(page)).toHaveAttribute("src", embed);
  await expect(player(page)).toHaveAttribute("loading", "lazy");
  await expect(player(page)).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(player(page)).toHaveAttribute("allowfullscreen", "");
  await expect(player(page)).toHaveAttribute("allow", /encrypted-media/);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await player(page).scrollIntoViewIfNeeded();
    const size = await player(page).evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height, container: node.parentElement!.getBoundingClientRect().width, right: rect.right, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(Math.abs(size.width - size.container)).toBeLessThan(2);
    expect(size.right).toBeLessThanOrEqual(width);
    expect(size.height).toBeGreaterThanOrEqual(200);
    expect(size.overflow).toBe(false);
    if (size.width >= 356) expect(Math.abs(size.width / size.height - 16 / 9)).toBeLessThan(0.02);
    await page.screenshot({ path: `test-results/youtube-shorts-learn-${width}.png`, fullPage: true });
  }
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await expect(page.getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "33");
  await page.getByRole("button", { name: "Assistir novamente", exact: true }).click();
  await expect(player(page)).toHaveAttribute("src", embed);
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "33");
});

test("preview preserva MP4 e fallback seguro ao trocar de atividade", async ({ page }) => {
  const file = "https://media.example/lesson.mp4?token=abc";
  await createCourse(page, [["Arquivo MP4", file], ["Endereço desconhecido", "https://example.com/lesson"]]);
  await page.getByRole("link", { name: "Visualizar como aluno", exact: true }).click();
  await page.getByRole("button", { name: "Carregar vídeo", exact: true }).click();
  await expect(page.locator("video")).toHaveAttribute("src", file);
  await expect(page.locator("video")).toHaveAttribute("controls", "");
  await page.locator("video").dispatchEvent("ended");
  await expect(page.getByRole("button", { name: "Concluir atividade", exact: true })).toBeVisible();
  await page.locator("video").dispatchEvent("error");
  await expect(page.getByText("Não foi possível carregar este vídeo.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir vídeo em nova aba", exact: true })).toHaveAttribute("href", file);
  await page.getByRole("navigation", { name: "Atividades do preview" }).getByRole("button", { name: "Capítulo de vídeos · Endereço desconhecido", exact: true }).click();
  await expect(page.getByText("Este formato de vídeo ainda não possui reprodução incorporada.")).toBeVisible();
  await expect(page.locator("video,iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Abrir vídeo em nova aba", exact: true })).toHaveAttribute("href", "https://example.com/lesson");
  await page.getByRole("navigation", { name: "Atividades do preview" }).getByRole("button", { name: "Capítulo de vídeos · Arquivo MP4", exact: true }).click();
  await expect(page.getByRole("button", { name: "Carregar vídeo", exact: true })).toBeVisible();
});
