import { test, expect, type Locator } from "./fixtures/authenticated-test";
import { JOURNEY_BIRD_ASSET, JOURNEY_BIRD_CYCLE, JOURNEY_BIRD_MOBILE_CYCLE, JOURNEY_BIRD_FLIGHTS } from "../components/learn/JourneyBirdLayer";
import { JOURNEY_CLOUDS } from "../components/learn/JourneyCloudLayer";

async function advanceBirds(layer: Locator, seconds: number) {
  await expect(layer.locator(".journey-bird-flight")).toHaveCount(2);
  await layer.evaluate((node,seconds)=>{
    for (const flight of node.querySelectorAll(".journey-bird-flight")) for (const animation of flight.getAnimations()) {
      animation.pause(); animation.currentTime=seconds*1000;
    }
  },seconds);
}
async function activeFlights(layer: Locator) {
  return layer.locator(".journey-bird-flight").evaluateAll(nodes=>nodes.filter(node=>{
    const css=getComputedStyle(node);return css.display!=="none" && css.visibility==="visible" && Number(css.opacity)>.001;
  }).map(node=>node.getAttribute("data-flight")));
}
async function freezeScenery(layer: Locator) {
  await layer.evaluate(node=>{
    node.getAnimations({subtree:true}).forEach(animation=>animation.pause());
    node.parentElement!.querySelector(".journey-cloud-layer")?.getAnimations({subtree:true}).forEach(animation=>animation.pause());
  });
}

test("Pássaros: SVG local leve, duas trajetórias e formação irregular", async ({request})=>{
  const response=await request.get(JOURNEY_BIRD_ASSET);expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  const svg=await response.text();expect(Buffer.byteLength(svg)).toBeLessThan(1024);
  for (const part of ["wing-left","wing-right","body"]) expect(svg).toContain(`id="${part}"`);
  expect(svg).not.toMatch(/<script|https?:\/\/(?!www.w3.org)/);
  expect(JOURNEY_BIRD_FLIGHTS).toHaveLength(2);
  expect(JOURNEY_BIRD_FLIGHTS[0].path).not.toEqual(JOURNEY_BIRD_FLIGHTS[1].path);
  for(const flight of JOURNEY_BIRD_FLIGHTS){
    expect(flight.duration).toBeGreaterThanOrEqual(18);expect(flight.duration).toBeLessThanOrEqual(30);
    expect(flight.birds.length).toBeGreaterThanOrEqual(3);expect(flight.birds.length).toBeLessThanOrEqual(5);
    expect(new Set(flight.birds.map(bird=>bird.y)).size).toBe(flight.birds.length);
  }
});

for(const [width,count] of [[1440,5],[1024,4],[390,3]]) test(`Pássaros Learn: quantidade, asas, camadas e captura ${width}`,async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.setViewportSize({width,height:1000});
  await page.goto("/learn/neural-demo");const layer=page.locator(".journey-bird-layer");
  await expect(layer).toHaveCount(1);await expect(layer).toHaveAttribute("aria-hidden","true");
  await expect(layer).toHaveCSS("pointer-events","none");await expect(layer).toHaveCSS("z-index","0");
  await expect(layer.locator("a,button,input,[tabindex]")).toHaveCount(0);
  expect(await layer.evaluate(node=>!!(node.previousElementSibling?.classList.contains("journey-cloud-layer")))).toBe(true);
  await page.locator(".course-journey-board").scrollIntoViewIfNeeded();await advanceBirds(layer,24);
  expect(await activeFlights(layer)).toEqual(["flight-a"]);
  const birds=layer.locator('[data-flight="flight-a"] .journey-bird');
  const sizes=await birds.evaluateAll(nodes=>nodes.filter(node=>getComputedStyle(node).display!=="none").map(node=>node.getBoundingClientRect().width));
  expect(sizes).toHaveLength(count);for(const size of sizes){expect(size).toBeGreaterThanOrEqual(10);expect(size).toBeLessThanOrEqual(20);}
  expect(await birds.evaluateAll(nodes=>nodes.every(node=>node.getAttribute("focusable")==="false"))).toBe(true);
  const wing=birds.first().locator(".journey-bird-wing-left"), original=await wing.evaluate(node=>getComputedStyle(node).transform);
  await expect.poll(()=>wing.evaluate(node=>getComputedStyle(node).transform)).not.toBe(original);
  await freezeScenery(layer);
  await page.locator(".course-journey-board").screenshot({path:`test-results/journey-birds-student-${width}.png`});
  if(width!==390){
    await advanceBirds(layer,93);expect(await activeFlights(layer)).toEqual(["flight-b"]);
    await page.locator(".course-journey-board").screenshot({path:`test-results/journey-birds-student-${width}-flight-b.png`});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("Pássaros: pausas longas e apenas um grupo ativo em dois ciclos completos",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/learn/neural-demo");
  const layer=page.locator(".journey-bird-layer");await advanceBirds(layer,0);expect(await activeFlights(layer)).toEqual([]);
  const samples=await layer.evaluate(node=>{
    const flights=[...node.querySelectorAll(".journey-bird-flight")], samples=[];
    for(let second=0;second<=320;second+=.5){
      for(const flight of flights)for(const animation of flight.getAnimations()){animation.pause();animation.currentTime=second*1000;}
      const active=flights.filter(f=>{const c=getComputedStyle(f);return c.visibility==="visible"&&Number(c.opacity)>.001;}).map(f=>f.getAttribute("data-flight"));
      samples.push({second,active});
    }
    return samples;
  });
  expect(samples.every(sample=>sample.active.length<=1)).toBe(true);
  for(const second of [0,11,37,60,81,105,130,159])expect(samples.find(sample=>sample.second===second)!.active).toEqual([]);
  expect(samples.find(sample=>sample.second===24)!.active).toEqual(["flight-a"]);
  expect(samples.find(sample=>sample.second===93)!.active).toEqual(["flight-b"]);
  expect(samples.find(sample=>sample.second===184)!.active).toEqual(["flight-a"]);
  const [a,b]=JOURNEY_BIRD_FLIGHTS;
  expect(b.delay-a.delay-a.duration).toBe(46);expect(JOURNEY_BIRD_CYCLE+a.delay-b.delay-b.duration).toBe(68);
});

test("Pássaros mobile: uma trajetória e pausa maior sem alterar as nuvens",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.setViewportSize({width:390,height:1000});await page.goto("/learn/neural-demo");
  const layer=page.locator(".journey-bird-layer");await advanceBirds(layer,24);
  await expect(layer.locator('[data-flight="flight-a"]')).toHaveCSS("animation-duration",`${JOURNEY_BIRD_MOBILE_CYCLE}s`);
  await expect(layer.locator('[data-flight="flight-b"]')).toHaveCSS("display","none");
  expect(JOURNEY_BIRD_MOBILE_CYCLE-JOURNEY_BIRD_FLIGHTS[0].duration).toBe(70);
  await advanceBirds(layer,93);expect(await activeFlights(layer)).toEqual([]);
  await advanceBirds(layer,118);expect(await activeFlights(layer)).toEqual(["flight-a"]);
  const cloud=page.locator(".journey-cloud-lane").first(), original=await cloud.evaluate(node=>getComputedStyle(node).transform);
  await expect.poll(()=>cloud.evaluate(node=>getComputedStyle(node).transform)).not.toBe(original);
  expect(await page.locator(".journey-cloud-lane").evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).getPropertyValue("--cloud-opacity").trim()))).toEqual(JOURNEY_CLOUDS.map(c=>String(c.opacity)));
});

test("Pássaros: céu separado do TOP, títulos, foco e navegação preservados",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/learn/neural-demo");
  const layer=page.locator(".journey-bird-layer");await advanceBirds(layer,24);
  const safe=await layer.evaluate(node=>{
    const sky=node.getBoundingClientRect(), map=node.parentElement!.getBoundingClientRect(), top=node.parentElement!.querySelector(".journey-destination")!.getBoundingClientRect();
    const cards=[...node.parentElement!.querySelectorAll(".journey-chapter-card")].map(n=>n.getBoundingClientRect());
    return {clearTop:top.left-sky.right>map.width*.1,clearCards:cards.every(c=>c.left>=sky.right||c.top>=sky.bottom||c.right<=sky.left||c.bottom<=sky.top),clip:getComputedStyle(node).overflow};
  });expect(safe).toEqual({clearTop:true,clearCards:true,clip:"hidden"});
  await expect(page.locator(".journey-destination")).toHaveAccessibleName("Conclusão do curso");
  const previous=await page.locator(".trail-map li").evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,status:n.getAttribute("data-status"),style:n.getAttribute("style")})));
  await layer.evaluate(node=>(node as HTMLElement).style.visibility="hidden");
  expect(await page.locator(".trail-map li").evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,status:n.getAttribute("data-status"),style:n.getAttribute("style")})))).toEqual(previous);
  await layer.evaluate(node=>(node as HTMLElement).style.removeProperty("visibility"));
  const link=page.locator(".course-journey-board").getByRole("link");await link.focus();await expect(link).toBeFocused();await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

test("Pássaros: reduced-motion oculta grupos e desliga voo e asas",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/learn/neural-demo");
  const layer=page.locator(".journey-bird-layer");await expect(layer).toHaveCSS("display","none");
  expect(await layer.evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await expect(page.locator(".journey-cloud-layer")).toBeVisible();
  expect(await page.locator(".journey-cloud-layer").evaluate(node=>node.getAnimations({subtree:true}).length)).toBe(0);
  await expect(page.locator(".journey-checkpoint")).toHaveCount(3);
});

test("Pássaros: falha no SVG preserva montanha, nuvens, trilha e capítulos",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});let failed=0;const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route(`**${JOURNEY_BIRD_ASSET}`,route=>{failed++;return route.abort();});
  await page.goto("/learn/neural-demo");await expect.poll(()=>failed).toBeGreaterThan(0);
  await advanceBirds(page.locator(".journey-bird-layer"),24);
  await expect(page.locator(".journey-cloud-layer")).toHaveCount(1);await expect(page.locator(".journey-path path")).toHaveCount(2);
  await expect(page.locator(".journey-checkpoint")).toHaveCount(3);await expect(page.locator(".journey-destination")).toBeVisible();expect(errors).toEqual([]);
  await page.locator(".course-journey-board").getByRole("link").click();await expect(page).toHaveURL(/chapter\/fundamentos$/);
});

test("Pássaros: editor estável sem camada e preview com voo final",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/studio/courses");
  await page.getByRole("link",{name:"Novo curso",exact:true}).click();await page.getByLabel("Título do curso",{exact:true}).fill("Céu com pássaros");
  await page.getByRole("button",{name:"Criar curso",exact:true}).click();await page.getByLabel("Título do novo capítulo",{exact:true}).fill("Fundamentos");
  await page.getByRole("button",{name:"Criar capítulo",exact:true}).click();
  const editor=page.getByRole("region",{name:"Configurar jornada",exact:true});await expect(editor.locator(".trail-guide")).toHaveCount(15);
  await expect(editor.locator(".journey-bird-layer,.journey-cloud-layer")).toHaveCount(0);
  await page.getByRole("link",{name:"Visualizar como aluno",exact:true}).click();
  const layer=page.locator(".journey-bird-layer");await advanceBirds(layer,24);expect(await activeFlights(layer)).toEqual(["flight-a"]);
  await freezeScenery(layer);await page.locator(".course-journey-board").screenshot({path:"test-results/journey-birds-preview.png"});
  await page.locator(".course-journey-board").getByRole("button").click();await expect(page).toHaveURL(/\/preview$/);
});
