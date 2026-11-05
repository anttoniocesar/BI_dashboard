import { test, expect, login, logout, screenshot, noOverflow } from "./fixtures/e2e-test";

test("E2E autoria e XLSX: professor importa merges → curso → aluno aprova → acompanhamento", async ({ page }) => {
  await page.goto("/login"); await login(page, "professor@example.com");
  await page.getByRole("link", { name: "Importar Excel", exact: true }).click();
  await expect(page.getByRole("link", { name: "BI.Society Studio", exact: true })).toHaveAttribute("href", "/studio/courses");
  await page.getByLabel("Arquivo Excel", { exact: true }).setInputFiles("tests/fixtures/xlsx/merged-cells.xlsx");
  await page.getByRole("button", { name: /Analisar arquivo/ }).click();
  await page.getByText("Detalhes da análise", { exact: false }).click();
  await expect(page.getByText("Merged cells: Supported", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /Revisar abas/ }).click();
  await expect(page.locator('td[data-merge="A1:E1"]')).toHaveAttribute("colspan", "5");
  await page.getByRole("button", { name: /Importar e abrir no BI.Society Lab/ }).click();
  await expect(page.getByRole("gridcell", { name: "H1", exact: true })).toHaveAttribute("aria-rowspan", "4");
  await page.getByRole("button", { name: "Abrir no Studio Editor", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/editor(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Configuração da célula", exact: true })).toBeVisible();
  await page.getByRole("gridcell", { name: "F12", exact: true }).click();
  await expect(page.getByRole("complementary")).toContainText("Mesclagens · F12");
  await page.getByRole("radio", { name: "Resposta", exact: true }).check();
  await page.getByLabel("Resposta esperada", { exact: true }).fill("3");
  await page.getByLabel("Aluno deve utilizar fórmula", { exact: true }).check();
  await page.getByRole("button", { name: "Aplicar avaliação", exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible();
  for (const width of [1440, 1366, 1024]) {
    await page.setViewportSize({ width, height: 768 }); await noOverflow(page); await screenshot(page, "studio-editor", width);
  }
  await page.getByRole("button", { name: "Visualizar como aluno", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "F12", exact: true })).toBeEmpty();
  await expect(page.getByRole("gridcell", { name: "A1", exact: true })).toHaveAttribute("aria-readonly", "true");
  await page.getByRole("button", { name: "Voltar ao editor", exact: true }).click();
  await page.getByRole("link", { name: "BI.Society Studio", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses$/);
  await page.getByRole("link", { name: "Novo curso", exact: true }).click();
  await page.getByLabel("Título do curso", { exact: true }).fill("Integração Excel Etapa 21");
  await page.getByRole("button", { name: "Criar curso", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\/courses\/course-/);
  const courseId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Prática integrada");
  await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
  for (const title of ["Video Aula", "Video Aplicação", "Lab importado"]) {
    await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
    await page.getByLabel("Título da atividade", { exact: true }).fill(title);
    await page.getByLabel("Tipo de atividade", { exact: true }).selectOption(title === "Lab importado" ? "spreadsheet-exercise" : "video");
    if (title === "Lab importado") await page.getByLabel("Selecionar exercício", { exact: true }).selectOption({ index: 1 });
    else await page.getByLabel("URL do vídeo", { exact: true }).fill("https://example.com/aula");
    await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
  }
  await page.getByRole("button", { name: "Validar estrutura", exact: true }).click();
  await expect(page.getByLabel("Validação da estrutura", { exact: true })).toContainText("Estrutura válida");
  await page.getByRole("button",{name:"Publicar",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Salvo · Publicado"})).toBeVisible();
  await logout(page); await login(page, "admin@example.com");
  await page.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("link", { name: "Ver detalhes de Professor Neural", exact: true }).click();
  await page.getByRole("combobox", { name: "Curso do professor", exact: true }).selectOption(courseId);
  await page.getByRole("button", { name: "Associar professor", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("associado");
  await page.getByRole("link", { name: "Voltar aos usuários", exact: true }).click();
  await page.getByRole("link", { name: "Ver detalhes de César", exact: true }).click();
  await page.getByRole("combobox", { name: "Vínculo de serviço", exact: true }).selectOption("service-cesar");
  await page.getByRole("combobox", { name: "Curso para liberar", exact: true }).selectOption(courseId);
  await page.getByRole("button", { name: "Liberar curso", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("liberado");
  await logout(page); await login(page, "cesar@example.com");
  await page.getByRole("link", { name: /Integração Excel Etapa 21/ }).click();
  await page.getByRole("link", { name: "Começar curso", exact: true }).click();
  const active = page.locator(".chapter-activity-section.is-current");
  for (let index = 0; index < 2; index++) {
    await active.getByRole("button", { name: "Concluir atividade", exact: true }).click();
    await page.getByRole("button", { name: "Próxima atividade →", exact: true }).click();
  }
  await expect(active.getByRole("gridcell", { name: "A1", exact: true })).toHaveAttribute("aria-colspan", "5");
  await expect(active.getByRole("gridcell", { name: "H1", exact: true })).toHaveAttribute("aria-rowspan", "4");
  await expect(active.getByRole("gridcell", { name: "B8", exact: true })).toHaveAttribute("aria-colspan", "3");
  await expect(active.getByRole("gridcell", { name: "B8", exact: true })).toHaveAttribute("aria-rowspan", "3");
  for (const address of ["A1", "A3", "C6", "H1", "B8"]) {
    const target = active.getByRole("gridcell", { name: address, exact: true });
    expect(await target.evaluate(node => node.scrollHeight <= node.clientHeight + 1 && node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(target).not.toBeEmpty();
  }
  await active.getByRole("gridcell", { name: "F12", exact: true }).click();
  const bar = active.getByRole("textbox", { name: "Conteúdo da célula", exact: true });
  await bar.fill("=1+2"); await bar.press("Enter");
  await active.getByRole("button", { name: "Verificar respostas", exact: true }).click();
  await expect(active.getByText("Atividade concluída ✓", { exact: true })).toBeVisible();
  await expect(active.getByText("Salvo ✓", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso do curso", exact: true })).toHaveAttribute("value", "100");
  await screenshot(page, "imported-learn");
  await logout(page); await login(page, "professor@example.com");
  await page.getByRole("link", { name: "Acompanhamento", exact: true }).click();
  await page.getByRole("link", { name: "Integração Excel Etapa 21", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("100%");
  await expect(page.locator("tbody tr")).toContainText("Concluído");
});
