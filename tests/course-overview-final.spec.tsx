import { test, expect } from "./fixtures/authenticated-test";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseJourneyBoard, journeyPositions } from "../components/learn/CourseJourneyBoard";
import { demoCourse } from "../data/courses/neural-demo";
import { courseProgress, initialProgress } from "../lib/learn/progress";

test("Visão geral final: malha para 1–15 e fallback acima do limite preserva capítulos", () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 9, 15, 16]) {
    const course = { ...demoCourse, chapters: Array.from({ length: count }, (_, index) => ({ ...demoCourse.chapters[0], id: `chapter-${index}`, title: `Conteúdo ${index + 1}`, order: index + 1, activities: [] })) };
    const progress = courseProgress(course, initialProgress(course.id));
    const html = renderToStaticMarkup(<CourseJourneyBoard course={course} chapters={progress.chapters} />);
    expect((html.match(/class="journey-chapter-card/g) ?? []).length).toBe(count);
    expect(html).toContain("/images/learn/course-mountains.svg");
    if (count <= 15) {
      const positions = journeyPositions(count)!;
      expect(positions).toHaveLength(count);
      expect(new Set(positions.map(point => `${point.x},${point.y}`)).size).toBe(count);
      expect(positions.every(point => point.x >= 12 && point.x <= 85 && point.y >= 10 && point.y <= 90)).toBe(true);
    } else { expect(journeyPositions(count)).toBeNull(); expect(html).toContain("trail-fallback"); }
  }
});

test("Visão geral final: header, sidebar completa, cards, checkpoints e vídeo sem mídia externa", async ({ page }) => {
  const external: string[] = []; page.on("request", request => { if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) external.push(request.url()); });
  await page.goto("/learn/neural-demo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await expect(page.getByRole("banner").locator(".student-header-course")).toContainText("Curso: Redes Neurais Aplicadas à Engenharia");
  const sidebar = page.getByRole("navigation", { name: "Trilha do curso", exact: true });
  await expect(sidebar.getByRole("heading", { name: "TRILHA DO CURSO", exact: true })).toBeVisible();
  await expect(sidebar.locator(".overview-sidebar-chapter")).toHaveCount(3);
  await expect(sidebar.locator(".overview-sidebar-activities")).toHaveCount(0);
  for (const [index, chapter] of demoCourse.chapters.entries()) {
    const item = sidebar.locator(".overview-sidebar-chapter").nth(index);
    await expect(item.locator(".overview-sidebar-checkpoint")).toHaveText(String(index + 1).padStart(2, "0"));
    await expect(item.locator("strong")).toHaveText(chapter.title);
    await expect(item.locator(".overview-sidebar-description")).toHaveText(chapter.description!);
    await expect(item.locator("small")).toHaveText(`Capítulo ${index + 1} · ${index === 0 ? "Atual" : "Bloqueado"}`);
    for (const activity of chapter.activities) await expect(sidebar.getByText(activity.title, { exact: true })).toHaveCount(0);
  }
  await expect(sidebar.getByRole("link")).toHaveCount(1);
  await expect(sidebar.locator('[data-status="Bloqueado"] a')).toHaveCount(0);
  await expect(sidebar.locator('a[aria-current="step"]')).toContainText("Fundamentos");
  await expect(sidebar.getByText("Capítulo 2 · Bloqueado", { exact: true })).toBeVisible();
  const summary = page.getByRole("region", { name: "Resumo do treinamento", exact: true });
  await expect(summary.getByRole("article")).toHaveCount(4);
  await expect(summary.getByRole("article").nth(0)).toContainText("3");
  await expect(summary.getByRole("article").nth(1)).toContainText("0%");
  await expect(summary.getByRole("article").nth(1)).toContainText("0 de 6 obrigatórias concluídas");
  await expect(summary.getByRole("article").nth(2)).toContainText("1. Fundamentos");
  await expect(summary.getByRole("article").nth(3)).toContainText("8 horas");
  const journey = page.getByRole("region", { name: "Jornada do curso", exact: true });
  await expect(journey.locator("li")).toHaveCount(3);
  await expect(journey.locator('[data-status="Atual"]')).toHaveAttribute("data-status", "Atual");
  await expect(journey.getByRole("link")).toHaveCount(1);
  await expect(journey.locator('[aria-disabled="true"]')).toHaveCount(2);
  await expect(journey.getByText("Conclusão do curso", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Vídeo de abertura do curso", exact: true })).toBeVisible();
  await expect(page.locator("video,iframe")).toHaveCount(0);
  await expect(page.locator(".course-overview-hero .learn-button")).toHaveCount(1);
  await journey.getByRole("link").focus(); await page.keyboard.press("Enter");
  const chapterSidebar = page.getByRole("navigation", { name: "Capítulos e atividades", exact: true });
  await expect(chapterSidebar.locator(".sidebar-activity-letter")).toHaveText(["A.", "B.", "C.", "C.1", "C.2", "C.3", "C.4", "C.5", "C.6", "D.", "E."]);
  for (const activity of demoCourse.chapters[0].activities) await expect(chapterSidebar.getByRole("button", { name: new RegExp(activity.title) })).toBeVisible();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("button", { name: "Abrir bloco D", exact: true }).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  await expect(summary.getByRole("article").nth(1)).toContainText("33%");
  await expect(summary.getByRole("article").nth(2)).toContainText("2. Correção de Erro");
  await expect(journey.locator('[data-status="Concluído"]')).toContainText("Fundamentos");
  await expect(journey.getByRole("link")).toHaveCount(2);
  await expect(sidebar.getByText("Capítulo 1 · Concluído", { exact: true })).toBeVisible();
  await expect(sidebar.locator('[data-status="Concluído"] .overview-sidebar-checkpoint')).toHaveText("✓");
  await expect(sidebar.getByRole("link")).toHaveCount(2);
  await expect(sidebar.locator(".overview-sidebar-activities")).toHaveCount(0);
  expect(external).toEqual([]);
});

for (const [width, height] of [[1440, 1000], [1366, 768], [1024, 768]]) test(`Visão geral final: layout e acessibilidade ${width}×${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.goto("/learn/neural-demo");
  const sidebar = page.getByRole("navigation", { name: "Trilha do curso", exact: true });
  const sidebarBox = (await sidebar.boundingBox())!;
  const headerBox = (await page.getByRole("banner").boundingBox())!;
  const profileBox = (await page.locator(".learn-profile").boundingBox())!;
  expect(profileBox.y + profileBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
  expect(sidebarBox.x).toBe(0); expect(sidebarBox.width).toBeGreaterThanOrEqual(260); expect(sidebarBox.width).toBeLessThanOrEqual(290);
  expect(sidebarBox.height).toBe(height - 80);
  const cards = await page.locator(".course-summary-cards article").all();
  const rectangles = await Promise.all(cards.map(card => card.boundingBox()));
  expect(new Set(rectangles.map(rect => rect!.height)).size).toBe(1);
  if (width >= 1366) expect(new Set(rectangles.map(rect => rect!.y)).size).toBe(1);
  else expect(new Set(rectangles.map(rect => rect!.y)).size).toBe(2);
  const scene = (await page.locator(".journey-landscape").boundingBox())!;
  const nodes = await page.locator(".journey-landscape li").all();
  const destination = (await page.locator(".journey-destination").boundingBox())!;
  const lastCheckpoint = (await page.locator(".journey-checkpoint").last().boundingBox())!;
  expect(destination.y + destination.height).toBeLessThanOrEqual(lastCheckpoint.y);
  const boxes = await Promise.all(nodes.map(node => node.boundingBox()));
  for (const box of boxes) {
    expect(box!.x).toBeGreaterThanOrEqual(scene.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(scene.x + scene.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(scene.y + scene.height + 1);
  }
  await page.keyboard.press("Tab");
  const checkpoint = page.locator('.journey-landscape li[data-status="Atual"] a');
  await checkpoint.focus(); await expect(checkpoint).toBeFocused();
  expect(await checkpoint.evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/etapa-16-3-overview-${width}.png`, fullPage: true });
});

test("Visão geral final: jornadas com 4, 5, 6 e mais capítulos continuam legíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/learn/neural-demo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Visão Geral do Treinamento");
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  await page.getByRole("link", { name: "← Visão geral do curso", exact: true }).click();
  // Render the real board with alternate data in the loaded layout, without
  // introducing a test route, fixture selector or another course runtime.
  for (const count of [4, 5, 6, 9]) {
    const course = { ...demoCourse, chapters: Array.from({ length: count }, (_, index) => ({ ...demoCourse.chapters[0], id: `chapter-${index}`, title: `Conceitos industriais e aplicações ${index + 1}`, order: index + 1, activities: [] })) };
    const state = courseProgress(course, initialProgress(course.id));
    const markup = renderToStaticMarkup(<CourseJourneyBoard course={course} chapters={state.chapters} />);
    await page.locator(".course-journey-board").evaluate((node, html) => { node.outerHTML = html; }, markup);
    const scene = (await page.locator(".journey-landscape").boundingBox())!;
    const nodes = await page.locator(".journey-landscape li").all();
    expect(nodes).toHaveLength(count);
    const rectangles = await Promise.all(nodes.map(node => node.boundingBox()));
    for (let i = 0; i < rectangles.length; i++) {
      const box = rectangles[i]!;
      expect(box.x).toBeGreaterThanOrEqual(scene.x);
      expect(box.x + box.width).toBeLessThanOrEqual(scene.x + scene.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(scene.y + scene.height + 1);
      for (let j = i + 1; j < rectangles.length; j++) {
        const other = rectangles[j]!;
        expect(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y, JSON.stringify({ count, i, j, box, other })).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (count === 6) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: "test-results/etapa-16-3-six-chapters.png", fullPage: true }); }
  }
});
