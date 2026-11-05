import { test, expect } from "@playwright/test";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { createAdminFixtures } from "../data/admin/demo";
import { demoCourse } from "../data/courses/neural-demo";
import { createLocalAdminState } from "../lib/admin/local-state";
import { courseCatalog } from "../lib/courses/catalog";
import { studentCourses } from "../lib/learn/courses";
import { serializeDemoAdminSnapshot } from "../lib/admin/demo-storage";
import { emptyWorkspace } from "../lib/repositories/CourseRepository";
import type { CourseDraft } from "../types/course";
import { login, logout } from "./fixtures/e2e-test";

const realCourse: CourseDraft = { ...demoCourse, status: "published", id: "real-course", title: "Curso publicado pelo professor", createdBy: "teacher-neural" };
const secondCourse = { ...realCourse, id: "second-course" };
function setup(ids: string[]) {
  const state = createLocalAdminState(false);
  state.courseAccess = ids.map(courseId => ({ userServiceId: "service-cesar", courseId }));
  return { state, user: state.users.find(user => user.id === "student-cesar")! };
}

test("Learn acesso: aluno sem CourseAccess tem zero cursos", () => {
  const { state, user } = setup([]);
  expect(studentCourses([realCourse], state, user)).toEqual([]);
});
test("Learn acesso: um CourseAccess libera somente um curso", () => {
  const { state, user } = setup([realCourse.id]);
  expect(studentCourses([realCourse, secondCourse], state, user)).toEqual([realCourse]);
});
test("Learn acesso: dois CourseAccess liberam dois cursos", () => {
  const { state, user } = setup([realCourse.id, secondCourse.id]);
  expect(studentCourses([realCourse, secondCourse], state, user)).toEqual([realCourse, secondCourse]);
});
test("Learn acesso: publicado sem acesso não aparece", () => {
  const { state, user } = setup(["another-course"]);
  expect(studentCourses([realCourse], state, user)).toEqual([]);
});
test("Learn acesso: draft e arquivado não aparecem mesmo com acesso", () => {
  const { state, user } = setup([realCourse.id]);
  for (const status of ["draft", "archived"] as const) expect(studentCourses([{ ...realCourse, status }], state, user)).toEqual([]);
});
test("Learn acesso: usuário, matrícula e serviço inativos invalidam acesso", () => {
  for (const field of ["users", "enrollments", "userServices"] as const) {
    const { state, user } = setup([realCourse.id]);
    if (field === "users") user.status = "inactive";
    else state[field][0].status = "inactive";
    expect(studentCourses([realCourse], state, user)).toEqual([]);
  }
});
test("Learn acesso: catálogo normal não injeta fixtures nem usa grants antigos", () => {
  const state = createAdminFixtures();
  const user = state.users.find(user => user.id === "student-cesar")!;
  expect(courseCatalog([], false)).toEqual([]);
  expect(studentCourses(courseCatalog([realCourse], false), state, user)).toEqual([]);
  expect(courseCatalog([{ ...demoCourse, status: "draft" }], false)[0].status).toBe("draft");
});
test("Learn acesso: demo explícito continua com catálogo e acessos próprios", () => {
  const state = createLocalAdminState(true);
  expect(studentCourses(courseCatalog([], true), state, state.users.find(user => user.id === "student-cesar")!)).toHaveLength(2);
});
test("Learn acesso: estado local inicial de César não concede cursos", () => {
  const state = createLocalAdminState(false);
  expect(state.enrollments[0].registrationCode).toBe("202700184");
  expect(state.courseAccess).toEqual([]);
  expect(state.courseTeachers).toEqual([]);
});

test("Learn normal: César vazio, snapshot antigo, reset, preview e publicação/liberação pela UI", async ({ page }) => {
  test.setTimeout(180000);
  const workspace = process.cwd();
  await mkdir(path.join(workspace, ".tools"), { recursive: true });
  const project = await mkdtemp(path.join(workspace, ".tools", "learn-access-"));
  let application: ChildProcess | undefined;
  let build: ChildProcess | undefined;
  let logs = "";
  try {
    await Promise.all(["app", "components", "data", "lib", "types", "public"].map(name => cp(path.join(workspace, name), path.join(project, name), { recursive: true })));
    await Promise.all(["tsconfig.json", "postcss.config.mjs", "next-env.d.ts", "next.config.ts"].map(name => cp(path.join(workspace, name), path.join(project, name))));
    await writeFile(path.join(project, "package.json"), JSON.stringify({ name: "normal-learn-access", private: true }));
    const env = { ...process.env, NEXT_PUBLIC_DATA_MODE: "demo", NEXT_PUBLIC_DEMO_CATALOG: "0", NEXT_PUBLIC_PILOT_ONLY: "", BI_SOCIETY_ALLOW_DEMO_PREVIEW: "1", BI_SOCIETY_APP_ENV: "test", NEXT_TELEMETRY_DISABLED: "1" };
    const next = path.join(workspace, "node_modules/next/dist/bin/next");
    build = spawn(process.execPath, [next, "build", project], { cwd: workspace, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    build.stdout?.on("data", chunk => { logs += chunk; }); build.stderr?.on("data", chunk => { logs += chunk; });
    expect(await new Promise(resolve => build!.once("exit", resolve)), logs.slice(-4000)).toBe(0);
    const reservation = createServer();
    await new Promise<void>(resolve => reservation.listen(0, "127.0.0.1", resolve));
    const port = (reservation.address() as import("node:net").AddressInfo).port;
    await new Promise<void>(resolve => reservation.close(() => resolve()));
    application = spawn(process.execPath, [next, "start", project, "--port", String(port), "--hostname", "localhost"], { cwd: workspace, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    application.stdout?.on("data", chunk => { logs += chunk; }); application.stderr?.on("data", chunk => { logs += chunk; });
    const origin = `http://localhost:${port}`;
    await expect.poll(async () => { try { return (await fetch(origin + "/login")).status; } catch { return 0; } }, { timeout: 30000 }).toBe(200);
    await page.goto(origin + "/login");
    await login(page, "202700184");
    await expect(page.getByRole("heading", { name: "Meus cursos", exact: true })).toBeVisible();
    await expect(page.getByText("Nenhum curso foi liberado para você ainda.", { exact: true })).toBeVisible();
    await expect(page.locator(".learn-course-list .auth-area-card")).toHaveCount(0);
    await page.screenshot({ path: "test-results/learn-cesar-empty.png" });
    // Preserve old demo grants and unrelated real grants byte for byte.
    const old = createAdminFixtures(); old.courseAccess.push({ userServiceId: "service-cesar", courseId: "preserved-real-course" });
    const snapshot = serializeDemoAdminSnapshot(old);
    await page.evaluate(value => localStorage.setItem("bi-society:demo-admin-state:v1", value), snapshot);
    await page.reload();
    await expect(page.locator(".learn-course-list .auth-area-card")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("bi-society:demo-admin-state:v1"))).toBe(snapshot);
    await page.evaluate(() => { localStorage.removeItem("bi-society:demo-admin-state:v1"); localStorage.removeItem("bi-society:course-authoring:v1"); });
    await page.reload();
    await expect(page.getByText("Nenhum curso foi liberado para você ainda.", { exact: true })).toBeVisible();
    // A published course without a grant stays hidden; draft stays hidden with a grant.
    const state = createLocalAdminState(false);
    state.courseAccess.push({ userServiceId: "service-cesar", courseId: "draft-course" });
    await page.evaluate(({ state, courses }) => {
      localStorage.setItem("bi-society:demo-admin-state:v1", state);
      localStorage.setItem("bi-society:course-authoring:v1", JSON.stringify(courses));
    }, { state: serializeDemoAdminSnapshot(state), courses: { ...emptyWorkspace(), courses: [realCourse, { ...realCourse, id: "draft-course", status: "draft" }] } });
    await page.reload();
    await expect(page.locator(".learn-course-list .auth-area-card")).toHaveCount(0);
    await page.evaluate(() => { localStorage.removeItem("bi-society:demo-admin-state:v1"); localStorage.removeItem("bi-society:course-authoring:v1"); });
    await page.reload(); await logout(page); await login(page, "professor@example.com");
    await page.getByRole("link", { name: "Novo curso", exact: true }).click();
    await page.getByLabel("Título do curso", { exact: true }).fill("Curso real liberado para César");
    await page.getByLabel("Descrição do curso", { exact: true }).fill("Curso criado pelo professor no fluxo normal.");
    await page.getByLabel("Objetivo do curso", { exact: true }).fill("Validar liberação real.");
    await page.getByRole("button", { name: "Criar curso", exact: true }).click();
    await page.getByLabel("Título do novo capítulo", { exact: true }).fill("Capítulo real");
    await page.getByRole("button", { name: "Criar capítulo", exact: true }).click();
    await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
    await page.getByLabel("Título da atividade", { exact: true }).fill("Leitura real");
    await page.getByLabel("Tipo de atividade", { exact: true }).selectOption("text");
    await page.getByLabel("Texto da atividade", { exact: true }).fill("Conteúdo do professor preservado.");
    await page.getByRole("button", { name: "Salvar atividade", exact: true }).click();
    await page.getByRole("link", { name: "Visualizar como aluno", exact: true }).click();
    await expect(page.getByText("Conteúdo do professor preservado.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Voltar ao curso", exact: true }).click();
    await page.getByRole("button", { name: "Distribuir automaticamente", exact: true }).click();
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Salvo · Publicado" })).toBeVisible();
    const href = await page.getByRole("link", { name: "Abrir como aluno", exact: true }).getAttribute("href");
    await logout(page); await login(page, "202700184");
    await expect(page.getByText("Nenhum curso foi liberado para você ainda.", { exact: true })).toBeVisible();
    await logout(page); await login(page, "admin@example.com");
    await page.getByRole("link", { name: "Usuários", exact: true }).click();
    await page.getByRole("link", { name: "Ver detalhes de César", exact: true }).click();
    await page.getByRole("combobox", { name: "Vínculo de serviço", exact: true }).selectOption("service-cesar");
    await page.getByRole("combobox", { name: "Curso para liberar", exact: true }).selectOption(href!.split("/").at(-1)!);
    await page.getByRole("button", { name: "Liberar curso", exact: true }).click();
    await logout(page); await login(page, "202700184");
    await expect(page.locator(".learn-course-list .auth-area-card")).toHaveCount(1);
    await expect(page.locator(".learn-course-list .auth-area-card")).toContainText("Curso real liberado para César");
    await page.reload();
    await expect(page.locator(".learn-course-list .auth-area-card")).toHaveCount(1);
    await page.screenshot({ path: "test-results/learn-cesar-released.png" });
  } finally {
    application?.kill(); if (build?.exitCode === null) build.kill();
    await writeFile(path.join(project, "validation.log"), logs);
  }
});
