import { expect, test } from "@playwright/test";
import { LocalStorageExerciseRepository } from "../lib/storage/LocalStorageExerciseRepository";
import { ExercisePersistenceController } from "../lib/storage/ExercisePersistenceController";
import { serializeExercise } from "../lib/storage/exerciseSessionCodec";
import { exerciseStorageKey } from "../lib/storage/exerciseStorage";
import { neuralExerciseDefinition as neural } from "../data/exercises/neural-error-correction";
import { simpleSumDefinition as sum } from "./fixtures/simple-sum";
import { MemoryExerciseRepository } from "./fixtures/MemoryExerciseRepository";
import { cloneWorkbook } from "../lib/spreadsheet/workbook";

const context = { exerciseId: neural.id, exerciseVersion: neural.version };
const initial = () => ({ workbook: cloneWorkbook(neural.workbook), activeSheet: "treinamento", selections: {}, validation: "never" as const });

test("adaptador local assíncrono preserva chave e sessão legada, normaliza identidade e limpa", async () => {
  const snapshot = initial();
  snapshot.workbook.worksheets[1].cells.F2 = "=B2*D2+C2*E2";
  const { exerciseVersion: _version, ...session } = serializeExercise(neural, snapshot);
  const map = new Map([[exerciseStorageKey(neural), JSON.stringify({ ...session, exerciseId: "poc01-neural-v1" })]]);
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } } as Storage;
  const repository = new LocalStorageExerciseRepository(neural, storage);
  expect(exerciseStorageKey(neural)).toBe("bi-society:poc01:exercise-state:v1");
  const pending = repository.load(context);
  expect(pending).toBeInstanceOf(Promise);
  const loaded = (await pending)!;
  expect(loaded).toMatchObject({ exerciseId: neural.id, exerciseVersion: neural.version, activeSheet: "treinamento" });
  expect(loaded.cells).toContainEqual({ worksheetId: "treinamento", address: "F2", raw: "=B2*D2+C2*E2" });
  expect(await repository.save(context, loaded)).toHaveProperty("lastSavedAt");
  await repository.clear(context);
  expect(await repository.load(context)).toBeNull();
  await expect(repository.load({ ...context, userId: "unsupported" })).rejects.toThrow(/Contexto/);
  await expect(repository.load({ ...context, exerciseVersion: "other" })).rejects.toThrow(/Contexto/);
});

test("adaptador local rejeita falhas de leitura, escrita e exclusão", async () => {
  const denied = () => { throw new Error("denied"); };
  const repository = new LocalStorageExerciseRepository(neural, { getItem: denied, setItem: denied, removeItem: denied } as unknown as Storage);
  await expect(repository.load(context)).rejects.toThrow();
  await expect(repository.save(context, serializeExercise(neural, initial()))).rejects.toThrow();
  await expect(repository.clear(context)).rejects.toThrow();
});

test("MemoryRepository isola exercício, versão, usuário e tentativa e simula falha", async () => {
  const repository = new MemoryExerciseRepository();
  const sumContext = { exerciseId: sum.id, exerciseVersion: sum.version, userId: "test", attemptId: "one" };
  const session = serializeExercise(sum, { workbook: cloneWorkbook(sum.workbook), activeSheet: "operacao", selections: {}, validation: "never" });
  await repository.save(sumContext, session);
  expect(await repository.load(sumContext)).toEqual(session);
  for (const other of [context, { ...sumContext, exerciseVersion: "other" }, { ...sumContext, userId: "other" }, { ...sumContext, attemptId: "other" }]) expect(await repository.load(other)).toBeNull();
  repository.behavior.clear.fail = true;
  await expect(repository.clear(sumContext)).rejects.toThrow();
  expect(await repository.load(sumContext)).toEqual(session);
  repository.behavior.clear.fail = false;
  await repository.clear(sumContext);
  expect(await repository.load(sumContext)).toBeNull();
});

test("contrato genérico não promete escrita no unload e descarte cancela debounce", async () => {
  const repository = new MemoryExerciseRepository();
  const controller = new ExercisePersistenceController(neural, repository, context, { status: "idle", lastSavedAt: null });
  controller.update(initial());
  controller.update(initial());
  controller.flushOnExit();
  expect(repository.calls).toHaveLength(0);
  controller.dispose();
  await new Promise(resolve => setTimeout(resolve, 800));
  expect(repository.calls).toHaveLength(0);
});
