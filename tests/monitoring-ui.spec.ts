import { test,expect,switchUser } from "./fixtures/authenticated-test";

test("Acompanhamento: cursos associados, métricas, filtros, busca, ordenação e detalhe sem respostas",async({page})=>{
  await page.goto("/studio/courses");await page.getByRole("link",{name:"Acompanhamento",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Acompanhamento",exact:true})).toBeVisible();
  await expect(page.locator(".monitoring-course-grid article")).toHaveCount(1);
  await expect(page.locator(".monitoring-course-grid")).not.toContainText("Demonstração de navegação");
  await page.getByRole("link",{name:"Redes Neurais Aplicadas à Engenharia",exact:true}).click();
  await expect(page.locator(".monitoring-metrics strong")).toHaveText(["4","33%","1","1"]);
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByLabel("Situação",{exact:true}).selectOption("completed");await expect(page.locator("tbody tr")).toHaveCount(1);await expect(page.locator("tbody")).toContainText("Carla Exemplo");
  await page.getByLabel("Situação",{exact:true}).selectOption("not-started");await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Situação",{exact:true}).selectOption("in-progress");await expect(page.locator("tbody tr")).toHaveCount(1);await expect(page.locator("tbody")).toContainText("Bruno Exemplo");
  await page.getByLabel("Situação",{exact:true}).selectOption("all");
  const search=page.getByLabel("Buscar por nome ou matrícula",{exact:true});await search.fill("césar");await expect(page.locator("tbody tr")).toHaveCount(1);await expect(page.locator("tbody")).toContainText("202700184");
  await search.fill("202799901");await expect(page.locator("tbody")).toContainText("Bruno Exemplo");await search.fill("ausente");await expect(page.getByText("Nenhum aluno corresponde aos filtros.",{exact:true})).toBeVisible();await search.fill("");
  await page.getByLabel("Ordenar por",{exact:true}).selectOption("progress");await expect(page.locator("tbody tr").first()).toContainText("Carla Exemplo");
  await page.getByLabel("Ordenar por",{exact:true}).selectOption("recent");await expect(page.locator("tbody tr").first()).toContainText("Carla Exemplo");
  await page.getByRole("link",{name:"Carla Exemplo",exact:true}).click();await expect(page.getByRole("heading",{name:"Carla Exemplo",exact:true})).toBeVisible();await expect(page.getByText("Progresso geral:")).toContainText("100%");
  await expect(page.getByRole("heading",{name:/Capítulo 1/})).toBeVisible();await expect(page.locator(".monitoring-card li")).toHaveCount(18);
  await expect(page.locator(".monitoring-card").first()).toContainText("C.6. Lab 6");
  await expect(page.locator(".monitoring-card").first()).toContainText("A.");await expect(page.locator(".monitoring-card").first()).toContainText("Concluída em");
  await expect(page.locator(".spreadsheet-editor,.learn-lab,input,textarea")).toHaveCount(0);
});
test("Acompanhamento: URL de curso não associado e aluno externo não expõem dados",async({page})=>{
  await page.goto("/studio/monitoring/chapter-navigation-demo");await expect(page.getByRole("heading",{name:"Acompanhamento indisponível"})).toBeVisible();await expect(page.locator("main")).not.toContainText("César");
  await page.goto("/studio/monitoring/neural-demo/student/admin-demo");await expect(page.getByRole("heading",{name:"Acompanhamento indisponível"})).toBeVisible();await expect(page.locator("table")).toHaveCount(0);
});
test("Aluno: dashboard consolida progresso real e professor vê o mesmo avanço de César",async({page})=>{
  await page.goto("/learn");const card=page.locator('.auth-area-card[href="/learn/neural-demo"]');await expect(card).toContainText("0% concluído");await expect(card).toContainText("0 de 6 atividades obrigatórias concluídas");
  await card.click();await page.getByRole("link",{name:"Começar curso",exact:true}).click();
  await page.locator(".chapter-activity-section.is-current").getByRole("button",{name:"Concluir atividade",exact:true}).click();
  await page.getByRole("link",{name:"Voltar para a trilha",exact:true}).click();
  await page.getByText("Minha conta",{exact:true}).click();await page.getByRole("link",{name:"Meus ambientes",exact:true}).last().click();
  // Direct client navigation preserves the tab's in-memory progress.
  await page.getByRole("link",{name:/Meus cursos|Aluno/}).first().click();
  await expect(page.locator('.auth-area-card[href="/learn/neural-demo"]')).toContainText("17% concluído");
  await switchUser(page,"professor@example.com");await page.getByRole("link",{name:"Acompanhamento",exact:true}).click();await page.getByRole("link",{name:"Redes Neurais Aplicadas à Engenharia",exact:true}).click();
  const cesar=page.locator("tbody tr").filter({has:page.getByRole("link",{name:"César",exact:true})});await expect(cesar).toContainText("17%");await expect(cesar).toContainText("1 de 6 obrigatórias");await expect(cesar).toContainText("Em andamento");
});
for(const width of [1440,1366,1024]) test(`Acompanhamento: layout, tabela e teclado ${width}×768`,async({page})=>{
  await page.setViewportSize({width,height:768});await page.goto("/studio/monitoring/neural-demo");await expect(page.locator("tbody tr")).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const status=page.getByLabel("Situação",{exact:true});await status.focus();await page.keyboard.press("Tab");await expect(page.getByLabel("Buscar por nome ou matrícula",{exact:true})).toBeFocused();
  await expect(page.getByLabel("Buscar por nome ou matrícula",{exact:true})).toHaveCSS("outline-style","solid");
  const region=page.getByRole("region",{name:"Tabela de alunos",exact:true});await expect(region).toHaveCSS("overflow-x","auto");
  await expect(page.locator("tbody tr").first().locator("td").first()).toHaveCSS("white-space","nowrap");
  await expect(page.getByRole("columnheader",{name:"Matrícula",exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/monitoring-${width}.png`,fullPage:true});
});
