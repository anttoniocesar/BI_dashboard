import { test, expect } from "@playwright/test";
import { neuralExerciseDefinition as definition } from "../data/exercises/neural-error-correction";
import { serializeExercise } from "../lib/storage/exerciseSessionCodec";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";
import { parseAttempt } from "../lib/attempts/validation";
import { HttpExerciseRepository } from "../lib/repositories/HttpExerciseRepository";
import { attemptRequest } from "../lib/server/attempts";
import { apiResponse } from "../lib/server/api";
import { DataError } from "../lib/data/http";
import { createAdminFixtures } from "../data/admin/demo";
import { validateEnvironment } from "../lib/data/environment";
import { passwordRequest } from "../lib/server/auth-operations";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { serverContext } from "../lib/server/context";
import { ExercisePersistenceController } from "../lib/storage/ExercisePersistenceController";
import type { ExerciseRepository } from "../types/exercise-repository";
import { neuralPilot } from "../data/courses/neural-pilot";
import { chapterNavigation } from "../lib/learn/chapter-navigation";
const identity = { courseId: "neural-demo", chapterId: "fundamentos", activityId: "fundamentos-lab-1", exerciseId: definition.id, exerciseVersion: definition.version };
const session = () => serializeExercise(definition, { workbook: cloneWorkbook(definition.workbook), activeSheet: "treinamento", selections: { treinamento: { row: 1, column: 5 } }, validation: "never" });
const post = (body: unknown, actor = "student-cesar") => new Request("http://localhost/api/attempts", { method: "POST", headers: { "Content-Type": "application/json", "X-Expected-User": actor }, body: JSON.stringify(body) });

test("Tentativas: codec permite somente inputs, identidade e seleção da definição publicada", () => {
  const state = session(); state.cells.push({ worksheetId: "treinamento", address: "F2", raw: "=Dados!$B$10*B2" });
  const result = parseAttempt({ operation: "save", identity, state });
  expect(result.state?.cells[0].raw).toBe("=Dados!$B$10*B2");
  expect(JSON.stringify(result.state)).not.toMatch(/expected|validationRules|workbook|feedback/);
  for (const invalid of [
    { operation: "save", identity, state: { ...state, expected: 123 } },
    { operation: "save", identity, state: { ...state, cells: [{ worksheetId: "dados", address: "B2", raw: "1" }] } },
    { operation: "save", identity, state: { ...state, cells: [{ ...state.cells[0], expected: "secret" }] } },
    { operation: "save", identity: { ...identity, userId: "forged" }, state },
    { operation: "load", identity: { ...identity, exerciseVersion: "absent" } },
    { operation: "load", identity: { ...identity, activityId: "intro-video" } },
    { operation: "save", identity, state: { ...state, cells: [{ worksheetId: "treinamento", address: "F2", raw: "x".repeat(16385) }] } },
  ]) expect(() => parseAttempt(invalid)).toThrow();
});

test("Tentativas: repository HTTP mantém contexto, timestamp, reset e recusa troca de conta", async () => {
  const fetchOriginal = globalThis.fetch; let current = "student-cesar"; const calls: Record<string, unknown>[] = [];
  try {
    globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return Response.json({ state: session(), lastSavedAt: "2026-10-24T12:00:00Z" }); };
    const repo = new HttpExerciseRepository(current, () => current);
    const context = { exerciseId: definition.id, exerciseVersion: definition.version, attemptId: JSON.stringify([identity.courseId, identity.chapterId, identity.activityId]) };
    expect(await repo.load(context)).toMatchObject({ exerciseId: definition.id });
    expect(await repo.save(context, session())).toEqual({ lastSavedAt: "2026-10-24T12:00:00Z" });
    await repo.clear(context); expect(calls.map(call => call.operation)).toEqual(["load", "save", "clear"]);
    expect(calls[0]).toEqual({ operation: "load", identity });
    current = "another-user"; await expect(repo.save(context, session())).rejects.toThrow("sessão mudou"); expect(calls).toHaveLength(3);
  } finally { globalThis.fetch = fetchOriginal; }
});

test("Tentativas API: sessão, CourseAccess, identidade esperada, payload e Origin antes da gravação", async () => {
  const state = createAdminFixtures(); let writes = 0;
  const context = { user: state.users.find(user => user.id === "student-cesar")!, state, attempts: { operate: async () => { writes++; return { state: null }; } } } as unknown as Awaited<ReturnType<typeof serverContext>>;
  const input = { operation: "load", identity };
  expect((await apiResponse(() => attemptRequest(post(input), async () => { throw new DataError("Entre", 401); }))).status).toBe(401);
  expect((await apiResponse(() => attemptRequest(post(input, "other"), async () => context))).status).toBe(409);
  const external = post(input); external.headers.set("Origin", "https://external.example");
  expect((await apiResponse(() => attemptRequest(external, async () => context))).status).toBe(403);
  const huge = post({ ...input, content: "x".repeat(262145) });
  expect((await apiResponse(() => attemptRequest(huge, async () => context))).status).toBe(413);
  state.courseAccess = [];
  expect((await apiResponse(() => attemptRequest(post(input), async () => context))).status).toBe(403);
  expect(writes).toBe(0);
});

test("Produção: configuração obrigatória, HTTPS, preview explícito e contextos separados", () => {
  expect(() => validateEnvironment({ NODE_ENV: "production" })).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  expect(() => validateEnvironment({ NODE_ENV: "production", NEXT_PUBLIC_DATA_MODE: "demo" })).toThrow();
  expect(validateEnvironment({ NODE_ENV: "production", NEXT_PUBLIC_DATA_MODE: "demo", BI_SOCIETY_ALLOW_DEMO_PREVIEW: "1" }).preview).toBe(true);
  const valid = { NODE_ENV: "production", NEXT_PUBLIC_DATA_MODE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public", SUPABASE_SERVICE_ROLE_KEY: "server", APP_ORIGIN: "https://pilot.example.com", NEXT_PUBLIC_PILOT_ONLY: "1" };
  expect(validateEnvironment(valid).production).toBe(true);
  for (const invalid of [{ ...valid, SUPABASE_SERVICE_ROLE_KEY: "" }, { ...valid, APP_ORIGIN: "http://pilot.example.com" }, { ...valid, NEXT_PUBLIC_PILOT_ONLY: "" }, { ...valid, NEXT_PUBLIC_PILOT_LESSON_URL: "https://example.com/fake" }]) expect(() => validateEnvironment(invalid)).toThrow();
  expect(validateEnvironment({ NODE_ENV: "development", NEXT_PUBLIC_DATA_MODE: "supabase" }).context).toBe("development");
  expect(neuralPilot.chapters).toHaveLength(3);
  if (!process.env.NEXT_PUBLIC_PILOT_LESSON_URL && !process.env.NEXT_PUBLIC_PILOT_APPLICATION_URL) {
    expect(JSON.stringify(neuralPilot)).not.toContain("https://example.com");
    expect(neuralPilot.chapters[0].activities[0].type).toBe("text");
    expect(chapterNavigation(neuralPilot.chapters[0].activities)[0].activity.id).toBe("intro-video");
  }
});

test("Senha: recovery oficial, token validado, update e logout; sem retorno de segredo", async () => {
  const calls: string[] = [];
  const client = { auth: {
    resetPasswordForEmail: async () => { calls.push("recover"); return { error: null }; },
    verifyOtp: async () => { calls.push("verify"); return { error: null, data: { user: { id: "student" } } }; },
    getUser: async () => ({ data: { user: { id: "student" } }, error: null }),
    updateUser: async () => { calls.push("update"); return { error: null }; },
    signOut: async () => { calls.push("logout"); return { error: null }; },
  } } as unknown as SupabaseClient;
  const resolve = async () => { throw new Error("Not needed"); };
  const sent = await passwordRequest(post({ operation: "request", email: "person@example.com" }), client, resolve);
  expect(sent.message).toContain("Se o email estiver cadastrado");
  await passwordRequest(post({ operation: "update", tokenHash: "controlled-token-with-32-characters", password: "safe-password-for-tests" }), client, resolve);
  expect(calls).toEqual(["recover", "verify", "update", "logout"]);
  await expect(passwordRequest(post({ operation: "update", tokenHash: "invalid", password: "short" }), client, resolve)).rejects.toThrow();
  expect(calls).toHaveLength(4);
});

test("Health: endpoint público responde somente status sem detalhes de ambiente", async ({ request }) => {
  const response = await request.get("/api/health"); expect(response.status()).toBe(200); expect(await response.json()).toEqual({ status: "ok" });
});

test("Tentativas: retry explícito conserva debounce e reenvia a edição que falhou", async () => {
  let calls = 0;
  const repository: ExerciseRepository = { load: async () => null, clear: async () => {}, save: async () => { if (++calls === 1) throw new Error("offline"); return { lastSavedAt: new Date().toISOString() }; } };
  const controller = new ExercisePersistenceController(definition, repository, { exerciseId: definition.id, exerciseVersion: definition.version }, { status: "idle", lastSavedAt: null });
  const initial = { workbook: cloneWorkbook(definition.workbook), activeSheet: "dados", selections: {}, validation: "never" as const };
  controller.update(initial); controller.update({ ...initial, activeSheet: "treinamento" });
  expect(calls).toBe(0);
  await expect.poll(() => controller.state.status).toBe("error");
  controller.retry(); await expect.poll(() => controller.state.status).toBe("saved");
  expect(calls).toBe(2); controller.dispose();
});
