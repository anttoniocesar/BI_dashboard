import { test, expect } from "./fixtures/authenticated-test";
import { JOURNEY_CLOUDS, JOURNEY_CLOUD_EXCLUSION } from "../components/learn/JourneyCloudLayer";
import { TRAIL_TOP, resolvedJourney, trailPath } from "../lib/courses/journey";
import { demoCourse } from "../data/courses/neural-demo";
import sharp from "sharp";

test("Nuvens: assets locais transparentes e três velocidades distintas", async ({ page, request }) => {
  await page.goto("/learn/neural-demo");
  expect(new Set(JOURNEY_CLOUDS.map(cloud => cloud.duration)).size).toBe(3);
  expect(JOURNEY_CLOUDS.map(cloud => cloud.opacity)).toEqual([.28,.35,.40]);
  expect(JOURNEY_CLOUDS.map(cloud => cloud.duration)).toEqual([84,64,46]);
  expect(JOURNEY_CLOUD_EXCLUSION).toMatchObject({ x:TRAIL_TOP.x+3, y:TRAIL_TOP.y, radiusX:12, radiusY:20 });
  for (const cloud of JOURNEY_CLOUDS) {
    const response=await request.get(cloud.asset);
    expect(response.status()).toBe(200); expect(response.headers()["content-type"]).toContain("image/webp");
    const pixels = await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(image,0,0);
      const alpha = (x:number,y:number) => ctx.getImageData(x,y,1,1).data[3];
      return { width:canvas.width, height:canvas.height, corner:alpha(0,0), center:alpha(Math.floor(canvas.width/2),Math.floor(canvas.height/2)) };
    },cloud.asset);
    expect(pixels.width).toBeGreaterThan(0); expect(pixels.corner / 255).toBeLessThan(.01); expect(pixels.center).toBeGreaterThan(0);
  }
});

for (const [width, count] of [[1440,3],[1024,2],[390,1]]) test(`Nuvens aluno: movimento sutil, camadas e responsividade ${width}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion:"no-preference" });
  await page.setViewportSize({width,height:1000}); await page.goto("/learn/neural-demo");
  const layer = page.locator(".journey-cloud-layer"), lanes = layer.locator(".journey-cloud-lane");
  await expect(layer).toHaveCount(1); await expect(layer).toHaveAttribute("aria-hidden","true");
  await expect(layer).toHaveCSS("pointer-events","none"); await expect(layer).toHaveCSS("z-index","0");
  await expect(page.locator(".journey-path")).toHaveCSS("z-index","1");
  await expect(page.locator(".trail-map ol")).toHaveCSS("z-index","2");
  await expect(page.locator(".journey-destination")).toHaveCSS("z-index","3");
  expect(await lanes.evaluateAll(nodes => nodes.filter(node=>getComputedStyle(node).display!=="none").length)).toBe(count);
  expect(await lanes.evaluateAll(nodes => nodes.map(node=>getComputedStyle(node).animationDuration))).toEqual(["84s","64s","46s"]);
  const first = lanes.first(), before = await first.evaluate(node=>getComputedStyle(node).transform);
  await expect.poll(()=>first.evaluate(node=>getComputedStyle(node).transform)).not.toBe(before);
  await expect(page.locator(".journey-path path").last()).toHaveAttribute("d",trailPath(resolvedJourney(demoCourse.chapters)));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scene = (await page.locator(".trail-map").boundingBox())!;
  expect(scene.width/scene.height).toBeCloseTo(1942/809,1);
  await layer.evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>animation.pause()));
  await page.locator(".course-journey-board").screenshot({path:`test-results/journey-clouds-student-${width}.png`});
  if (width === 390) {
    await page.locator(".journey-destination").scrollIntoViewIfNeeded();
    await expect(page.locator(".journey-destination")).toBeInViewport();
    await page.locator(".course-journey-board").screenshot({path:"test-results/journey-clouds-student-390-top.png"});
  }
});

test("Nuvens: TOP sem cobertura, cliques, foco e navegação preservados", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await page.goto("/learn/neural-demo");
  const board = page.locator(".course-journey-board"), layer = board.locator(".journey-cloud-layer");
  await layer.evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>animation.pause()));
  const top = board.locator(".journey-destination");
  await expect(top).toHaveAccessibleName("Conclusão do curso");
  const exclusion = await layer.evaluate(node=>{
    const css=getComputedStyle(node), map=node.getBoundingClientRect(), flag=node.parentElement!.querySelector(".journey-destination")!.getBoundingClientRect();
    const percent=(key:string)=>parseFloat(css.getPropertyValue(key))/100;
    const x=map.left+map.width*percent("--cloud-exclusion-x"), y=map.top+map.height*percent("--cloud-exclusion-y");
    const rx=map.width*percent("--cloud-exclusion-rx"), ry=map.height*percent("--cloud-exclusion-ry");
    return { mask:css.maskImage, distances:[flag.left,flag.right].flatMap(left=>[flag.top,flag.bottom].map(top=>Math.hypot((left-x)/rx,(top-y)/ry))) };
  });
  expect(exclusion.mask).not.toBe("none"); expect(exclusion.mask).toContain("90%");
  for (const distance of exclusion.distances) expect(distance).toBeLessThan(.9);
  const previous = await board.locator("li").evaluateAll(nodes=>nodes.map(node=>({status:node.getAttribute("data-status"),position:node.getAttribute("style"),text:node.textContent})));
  await layer.evaluate(node=>(node as HTMLElement).style.display="none");
  await expect(top).toBeVisible();
  expect(await board.locator("li").evaluateAll(nodes=>nodes.map(node=>({status:node.getAttribute("data-status"),position:node.getAttribute("style"),text:node.textContent})))).toEqual(previous);
  await layer.evaluate(node=>(node as HTMLElement).style.removeProperty("display"));
  const link = board.getByRole("link");
  await link.focus(); await expect(link).toBeFocused();
  const hit = await link.locator(".journey-checkpoint").evaluate(node=>{
    const box=node.getBoundingClientRect();return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest("a")?.getAttribute("href");
  });
  expect(hit).toBe("/learn/neural-demo/chapter/fundamentos");
  await link.click(); await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

test("Nuvens: reduced-motion para animação e preserva capítulos", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"}); await page.goto("/learn/neural-demo");
  const lanes = page.locator(".journey-cloud-lane");
  await expect(lanes).toHaveCount(3);
  for (const lane of await lanes.all()) await expect(lane).toHaveCSS("animation-name","none");
  const opacity=await lanes.evaluateAll(nodes=>nodes.map(node=>Number(getComputedStyle(node).opacity)));
  JOURNEY_CLOUDS.forEach((cloud,i)=>expect(opacity[i]).toBeCloseTo(cloud.opacity*.65,4));
  expect(await page.locator(".journey-cloud-layer").evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await expect(page.locator(".journey-checkpoint")).toHaveCount(3);
  await expect(page.locator(".journey-destination")).toBeVisible();
  await page.locator(".course-journey-board").getByRole("link").click();
  await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

for (const width of [1440,390]) test(`Nuvens perceptíveis em 0, 20 e 40 segundos, com pintura acima da montanha ${width}`, async ({ page }) => {
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width,height:1000}); await page.goto("/learn/neural-demo");
  const board=page.locator(".course-journey-board"), layer=board.locator(".journey-cloud-layer");
  await board.scrollIntoViewIfNeeded();
  for (const cloud of JOURNEY_CLOUDS) await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();},cloud.asset);
  const size=await layer.locator(".journey-cloud-image").first().evaluate(node=>{
    const image=node.getBoundingClientRect(), map=node.closest(".trail-map")!.getBoundingClientRect();
    return Math.min(image.width,image.height*3)/map.width;
  });
  expect(size).toBeGreaterThan(width===390 ? .28 : .40);
  for (const seconds of [0,20,40]) {
    await layer.evaluate((node,seconds)=>node.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=seconds*1000;}),seconds);
    const withClouds=await board.screenshot({path:`test-results/journey-clouds-visible-${width===390 ? "mobile-" : ""}${seconds}s.png`});
    // Pixel differences verify actual painting in the clipped viewport, not just DOM visibility.
    await layer.evaluate(node=>(node as HTMLElement).style.visibility="hidden");
    const withoutClouds=await board.screenshot();
    await layer.evaluate(node=>(node as HTMLElement).style.removeProperty("visibility"));
    const a=await sharp(withClouds).removeAlpha().raw().toBuffer(), b=await sharp(withoutClouds).removeAlpha().raw().toBuffer();
    expect(a.length).toBe(b.length);
    let changedPixels=0;
    for(let i=0;i<a.length;i+=3) if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>8) changedPixels++;
    expect(changedPixels,`Nuvens devem ser perceptíveis em ${seconds}s / ${width}px`).toBeGreaterThan(500);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test("Nuvens: assets ausentes não quebram imagem, trilha ou capítulos", async ({ page }) => {
  let failures=0;
  await page.route("**/images/learn/clouds/*.webp",route=>{failures++;return route.abort();});
  await page.goto("/learn/neural-demo"); await expect.poll(()=>failures).toBeGreaterThan(0);
  await expect(page.locator(".journey-checkpoint")).toHaveCount(3);
  await expect(page.locator(".journey-path path")).toHaveCount(2);
  await expect(page.locator(".journey-destination")).toBeVisible();
  expect(await page.locator(".trail-map").evaluate(node=>getComputedStyle(node).backgroundImage)).toContain("course-journey-background.png");
  await page.locator(".course-journey-board").getByRole("link").click();
  await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

test("Nuvens: autoria sem animação e preview com o mesmo efeito do aluno", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await page.goto("/studio/courses");
  await page.getByRole("link",{name:"Novo curso",exact:true}).click();
  await page.getByLabel("Título do curso",{exact:true}).fill("Paisagem viva");
  await page.getByRole("button",{name:"Criar curso",exact:true}).click();
  await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Fundamentos");
  await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();
  const editor=page.getByRole("region",{name:"Configurar jornada",exact:true});
  await expect(editor.locator(".trail-guide")).toHaveCount(15);
  await expect(editor.locator(".journey-cloud-layer")).toHaveCount(0);
  await editor.getByRole("button",{name:"Selecionar ponto P1 · ocupado por Fundamentos",exact:true}).click();
  await expect(editor.getByLabel("Ponto da jornada")).toHaveValue("P1");
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();
  const layer=page.locator(".journey-cloud-layer"); await expect(layer).toHaveCount(1);
  expect(await layer.locator(".journey-cloud-lane").evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationDuration))).toEqual(["84s","64s","46s"]);
  await layer.evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>animation.pause()));
  await page.locator(".course-journey-board").screenshot({path:"test-results/journey-clouds-preview.png"});
  await page.locator(".course-journey-board").getByRole("button").click(); await expect(page).toHaveURL(/\/preview$/);
});
