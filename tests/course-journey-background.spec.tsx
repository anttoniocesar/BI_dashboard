import { test, expect } from "./fixtures/authenticated-test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseJourneyBoard } from "../components/learn/CourseJourneyBoard";
import { demoCourse } from "../data/courses/neural-demo";
import { courseProgress, initialProgress } from "../lib/learn/progress";

const scenery = "/images/learn/course-journey-background.png";
const fallback = "/images/learn/course-mountains.svg";

test("Cenário da jornada: PNG limpo fornecido é servido íntegro e o original anterior permanece preservado", async ({ request }) => {
  const original = await readFile("image/course-journey-background.png");
  const copied = await readFile(`public${scenery}`);
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  // The new original was supplied in Downloads, outside the checkout. Pin its
  // verified hash so this regression stays portable without that local directory.
  expect(hash(copied)).toBe("994ac7facccb99023f17d0717a93746bdf68b53d6de3d860795a0aa8b853b5e8");
  expect(hash(original)).toBe("037a9ccb5bb29a2e32cef5946867c9bcf0011c60fa6ea3769ea90972467a1b23");
  const response = await request.get(scenery);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(hash(await response.body())).toBe(hash(copied));
});

test("Jornada: falha no PNG mantém fallback, capítulos e navegação", async ({page}) => {
 await page.route(`**${scenery}`, route => route.abort());
 await page.goto("/learn/neural-demo");
 const board=page.locator(".course-journey-board");
 await expect(board.locator(".journey-checkpoint")).toHaveCount(3);
 expect(await board.locator(".journey-landscape").evaluate(n=>getComputedStyle(n).backgroundImage)).toContain(fallback);
 await board.getByRole("link").click();await expect(page).toHaveURL(/chapter\/fundamentos$/);
});
for(const width of [1440,1024,390]) test(`Jornada: coordenadas relativas e TOP em ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto("/learn/neural-demo");
 const map=page.locator(".trail-map");const box=(await map.boundingBox())!;
 expect(box.width/box.height).toBeCloseTo(1942/809,1);
 await expect(map.locator(".journey-path path")).toHaveCount(2);
 await expect(map.locator(".journey-path path").last()).toHaveAttribute("d",/72.4 9.5$/);
 await expect(map.locator(".trail-guide")).toHaveCount(0);
 const first=(await map.locator(".journey-checkpoint").first().boundingBox())!;
 expect((first.x+first.width/2-box.x)/box.width).toBeCloseTo(.16,2);
 expect((first.y+first.height/2-box.y)/box.height).toBeCloseTo(.89,2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator(".course-journey-board").screenshot({path:`test-results/journey-student-${width}.png`});
});
test("Jornada: somente títulos e estados visuais, sem textos secundários",async({page})=>{
 await page.goto("/learn/neural-demo");const board=page.locator(".course-journey-board");
 await expect(board.locator(".journey-chapter-card h3")).toHaveText(demoCourse.chapters.map(ch=>ch.title));
 await expect(board.locator(".journey-chapter-card small,.journey-chapter-card p,.journey-chapter-card strong")).toHaveCount(0);
 await expect(board.locator('[data-status="Bloqueado"] a')).toHaveCount(0);
 await expect(board.locator('[data-status="Atual"] .journey-checkpoint')).toHaveCSS("background-color","rgb(181, 84, 24)");
 await expect(board.locator(".journey-destination")).toHaveAccessibleName("Conclusão do curso");
});

test("Jornada: 15 capítulos mantêm títulos e marcadores legíveis", async ({ page }) => {
 await page.goto("/learn/neural-demo");
 const course = { ...demoCourse, chapters: Array.from({ length: 15 }, (_, i) => ({ ...demoCourse.chapters[0], id: `dense-${i}`, title: `Aplicação industrial ${i + 1}`, order: i + 1, activities: [] })) };
 const state = courseProgress(course, initialProgress(course.id));
 const html = renderToStaticMarkup(<CourseJourneyBoard course={course} chapters={state.chapters}/>);
 await page.locator(".course-journey-board").evaluate((node, html) => { node.outerHTML=html; },html);
 const map=page.locator(".trail-map");
 await expect(map.locator(".journey-checkpoint")).toHaveCount(15);
 const cards=await map.locator(".journey-chapter-card").evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 const markers=await map.locator(".journey-checkpoint").evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 const overlaps=(a:typeof cards[number],b:typeof cards[number])=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 await page.setViewportSize({width:2400,height:1200});
 await map.screenshot({path:"test-results/journey-fifteen.png"});
 cards.forEach((card,i)=>{cards.slice(i+1).forEach((other,j)=>expect(overlaps(card,other),`Cards ${i+1} e ${i+j+2}: ${JSON.stringify({card,other})}`).toBe(false));markers.forEach((marker,j)=>expect(overlaps(card,marker),`Card ${i+1}, marcador ${j+1}: ${JSON.stringify({card,marker})}`).toBe(false));});
});
