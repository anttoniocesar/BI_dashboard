import { test, expect, type Locator } from "./fixtures/authenticated-test";
import { TRAIL_TOP, resolvedJourney, trailPath } from "../lib/courses/journey";
import { demoCourse } from "../data/courses/neural-demo";
import { JOURNEY_CLOUD_EXCLUSION } from "../components/learn/JourneyCloudLayer";

async function flagTime(flag: Locator, milliseconds: number) {
  const cloth=flag.locator(".summit-flag-cloth");
  await expect(cloth).toHaveCSS("animation-duration","3.2s");
  await cloth.evaluate((node,time)=>{const animation=node.getAnimations()[0];animation.pause();animation.currentTime=time;},milliseconds);
}
async function freezeEnvironment(flag: Locator) {
  await flag.evaluate(node=>node.closest(".trail-map")!.querySelectorAll(".journey-cloud-layer,.journey-bird-layer").forEach(layer=>layer.getAnimations({subtree:true}).forEach(a=>a.pause())));
}

for(const width of [1440,1024,390]) test(`Bandeira Learn: tecido animado, TOP e tamanho preservados ${width}`,async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.setViewportSize({width,height:1000});await page.goto("/learn/neural-demo");
  const flag=page.locator(".journey-summit-flag"), top=page.locator(".journey-destination"), cloth=flag.locator(".summit-flag-cloth");
  await expect(flag).toHaveCount(1);await expect(flag).toHaveAttribute("aria-hidden","true");await expect(flag).toHaveAttribute("focusable","false");
  await expect(flag).toHaveAttribute("width","22");await expect(flag).toHaveAttribute("height","28");await expect(flag).toHaveAttribute("viewBox","0 0 24 28");
  await expect(flag).toHaveCSS("pointer-events","none");await expect(flag.locator("[tabindex],a,button")).toHaveCount(0);
  await expect(top).toHaveAccessibleName("Conclusão do curso");await expect(top.locator(".trail-destination-title")).toHaveText("Conclusão do curso");
  expect(await top.evaluate(node=>({left:(node as HTMLElement).style.left,top:(node as HTMLElement).style.top}))).toEqual({left:`${TRAIL_TOP.x}%`,top:`${TRAIL_TOP.y}%`});
  await expect(top).toHaveCSS("z-index","3");await expect(flag.locator(".summit-flag-mast")).toHaveCSS("animation-name","none");
  await expect(cloth).toHaveCSS("animation-duration","3.2s");await expect(cloth.locator("path")).toHaveAttribute("fill","#ee7e32");
  const transform=await cloth.evaluate(node=>getComputedStyle(node).transform);
  await expect.poll(()=>cloth.evaluate(node=>getComputedStyle(node).transform)).not.toBe(transform);
  await expect(page.locator(".journey-path path").last()).toHaveAttribute("d",trailPath(resolvedJourney(demoCourse.chapters)));
  await flagTime(flag,1504);await freezeEnvironment(flag);await top.scrollIntoViewIfNeeded();await expect(top).toBeInViewport();
  const box=(await flag.boundingBox())!;expect(box.width).toBe(22);expect(box.height).toBe(28);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator(".course-journey-board").screenshot({path:`test-results/journey-flag-student-${width}.png`});
});

test.describe("Bandeira em dois quadros",()=>{
  test.use({deviceScaleFactor:3});
  test("mastro, toda a fixação e label ficam imóveis enquanto o tecido deforma",async({page})=>{
    await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/learn/neural-demo");
    const flag=page.locator(".journey-summit-flag");await flag.scrollIntoViewIfNeeded();await freezeEnvironment(flag);
    const geometry=()=>flag.evaluate(svg=>{
      const cloth=svg.querySelector<SVGGraphicsElement>(".summit-flag-cloth")!, mast=svg.querySelector<SVGGraphicsElement>(".summit-flag-mast")!;
      const point=(node:SVGGraphicsElement,x:number,y:number)=>{const p=new DOMPoint(x,y).matrixTransform(node.getScreenCTM()!);return {x:p.x,y:p.y};};
      return { mast:[point(mast,5,2),point(mast,5,26)], attachment:[3,9,15].map(y=>point(cloth,5,y)), tip:point(cloth,21,3),
        top:svg.parentElement!.getBoundingClientRect().toJSON(), label:svg.parentElement!.querySelector(".trail-destination-title")!.getBoundingClientRect().toJSON() };
    });
    await flagTime(flag,608);const a=await geometry();await flag.screenshot({path:"test-results/journey-flag-wave-a.png"});
    await flagTime(flag,1504);const b=await geometry();await flag.screenshot({path:"test-results/journey-flag-wave-b.png"});
    expect(b.mast).toEqual(a.mast);expect(b.top).toEqual(a.top);expect(b.label).toEqual(a.label);
    b.attachment.forEach((point,i)=>{expect(point.x).toBeCloseTo(a.attachment[i].x,4);expect(point.y).toBeCloseTo(a.attachment[i].y,4);});
    expect(Math.hypot(b.tip.x-a.tip.x,b.tip.y-a.tip.y)).toBeGreaterThan(.5);
    expect(await flag.evaluate(node=>node.getAnimations().length)).toBe(0);
    expect(await flag.locator(".summit-flag-mast").evaluate(node=>node.getAnimations().length)).toBe(0);
  });
});

test("Bandeira: reduced-motion mantém desenho estático e visível",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/learn/neural-demo");
  const flag=page.locator(".journey-summit-flag");await expect(flag).toBeVisible();await expect(flag.locator("path")).toHaveCount(2);
  await expect(flag.locator(".summit-flag-cloth")).toHaveCSS("animation-name","none");await expect(flag.locator(".summit-flag-cloth")).toHaveCSS("transform","none");
  expect(await flag.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await expect(page.locator(".journey-destination")).toHaveAccessibleName("Conclusão do curso");
});

test("Bandeira: keyframes indisponíveis deixam o SVG original estático",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/learn/neural-demo");
  const flag=page.locator(".journey-summit-flag");await expect(flag.locator(".summit-flag-cloth")).toHaveCSS("animation-name","journey-summit-flag-wave");
  await page.addStyleTag({content:".summit-flag-cloth { animation-name:unavailable-summit-flag-wave !important; }"});
  await expect(flag.locator(".summit-flag-cloth")).toHaveCSS("transform","none");
  expect(await flag.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await expect(flag.locator("path")).toHaveCount(2);await expect(flag).toBeVisible();
  await expect(flag.locator(".summit-flag-cloth path")).toHaveAttribute("d","M5 3h16l-4 6 4 6H5Z");
  await expect(page.locator(".journey-destination")).toHaveAccessibleName("Conclusão do curso");
});

test("Bandeira: nuvens, pássaros, progresso e navegação independentes",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/learn/neural-demo");
  const flag=page.locator(".journey-summit-flag");
  const state=()=>page.locator(".trail-map li").evaluateAll(nodes=>nodes.map(node=>({status:node.getAttribute("data-status"),position:node.getAttribute("style"),text:node.textContent,href:node.querySelector("a")?.getAttribute("href")})));
  await expect(page.locator(".trail-map li")).toHaveCount(3);
  const original=await state();await flagTime(flag,608);await flagTime(flag,1504);expect(await state()).toEqual(original);
  expect(JOURNEY_CLOUD_EXCLUSION).toEqual({x:75.4,y:9.5,radiusX:12,radiusY:20});
  const cloud=page.locator(".journey-cloud-lane").first(), before=await cloud.evaluate(node=>getComputedStyle(node).transform);
  await expect.poll(()=>cloud.evaluate(node=>getComputedStyle(node).transform)).not.toBe(before);
  const birds=page.locator(".journey-bird-flight");await expect(birds).toHaveCount(2);
  await birds.evaluateAll(nodes=>nodes.forEach(node=>node.getAnimations().forEach(a=>{a.pause();a.currentTime=24000;})));
  await expect(birds.first()).toHaveCSS("opacity","1");await expect(birds.last()).toHaveCSS("opacity","0");
  await expect(page.getByRole("progressbar",{name:"Progresso do curso",exact:true})).toHaveAttribute("value","0");
  const link=page.locator(".course-journey-board").getByRole("link");await link.focus();await page.keyboard.press("Enter");await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

test("Bandeira: editor estático e preview animado",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/studio/courses");
  await page.getByRole("link",{name:"Novo curso",exact:true}).click();await page.getByLabel("Título do curso",{exact:true}).fill("Conquista no topo");
  await page.getByRole("button",{name:"Criar curso",exact:true}).click();await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Fundamentos");
  await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();
  const editor=page.getByRole("region",{name:"Configurar jornada",exact:true});await expect(editor.locator(".trail-guide")).toHaveCount(15);
  await expect(editor.locator(".trail-guide-top")).toContainText("TOP · Conclusão do curso");await expect(editor.locator(".journey-summit-flag")).toHaveCount(0);
  expect(await editor.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();const flag=page.locator(".journey-summit-flag");
  await expect(flag.locator(".summit-flag-cloth")).toHaveCSS("animation-name","journey-summit-flag-wave");
  await flagTime(flag,1504);await freezeEnvironment(flag);await page.locator(".course-journey-board").screenshot({path:"test-results/journey-flag-preview.png"});
  await page.locator(".course-journey-board").getByRole("button").click();await expect(page).toHaveURL(/\/preview$/);
});
