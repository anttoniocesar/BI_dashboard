import { test, expect } from "@playwright/test";
import { createAdminFixtures } from "../data/admin/demo";
import { DEMO_ADMIN_STORAGE_KEY, isDemoAdminState, parseDemoAdminSnapshot, serializeDemoAdminSnapshot } from "../lib/admin/demo-storage";
import { LocalDemoAdminRepository } from "../lib/repositories/LocalDemoAdminRepository";
import { releasedCourseIds, studentIdentity } from "../lib/admin/session";
import { DemoAuthAdapter } from "../lib/auth/DemoAuthAdapter";
import { authStorageKey } from "../lib/auth/demo-auth";

function store() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const admin = "admin-demo", student = "student-cesar", teacher = "teacher-neural", course = "course-studio-persistido";

test("Demo admin: fixtures iniciais, snapshot completo e cópias independentes", async () => {
  const storage = store(), repo = new LocalDemoAdminRepository(() => storage);
  expect(await repo.load()).toEqual(createAdminFixtures());
  expect(storage.values.size).toBe(0); // No overwrite on mount or intermediate state.
  await repo.grantCourseAccess("service-cesar", course, admin, [course]);
  await repo.assignTeacher(teacher, course, admin, [course]);
  const original = (await repo.getUser(student))!;
  await repo.updateUser({ type: "update-user", userId: student, ...original, name: "César Reaberto", roles: ["student", "teacher"], status: "active" }, admin, []);
  const reopened = new LocalDemoAdminRepository(() => storage);
  expect(await reopened.load()).toEqual(await repo.load());
  expect(releasedCourseIds(await reopened.load(), student)).toContain(course);
  expect(studentIdentity(await reopened.load(), student)).toMatchObject({ name: "César Reaberto", enrollment: "202700184" });
  expect((await reopened.load()).courseTeachers).toContainEqual({ userId: teacher, courseId: course });
  const raw = storage.getItem(DEMO_ADMIN_STORAGE_KEY)!;
  expect(JSON.parse(raw).version).toBe(1);
  expect(Object.keys(JSON.parse(raw).state)).toEqual(["users", "enrollments", "services", "userServices", "courseAccess", "courseTeachers"]);
  expect(raw).not.toContain('"chapters"');
  expect(raw).not.toContain('"password"');
  const external = await reopened.load(); external.users[0].name = "mutação externa";
  expect((await reopened.getUser(admin))?.name).not.toBe("mutação externa");
});

test("Demo admin: usuário criado, matrícula estável, serviço e status sobrevivem ao repositório novo", async () => {
  const storage = store(), repo = new LocalDemoAdminRepository(() => storage);
  await repo.createUser({ type: "create-user", id: "new-student", name: "Novo aluno", email: "novo@example.com", roles: ["student"], status: "active", createdAt: "2026-10-25T12:00:00Z" }, admin, []);
  await repo.execute({ type: "enroll", id: "new-enrollment", userId: "new-student", createdAt: "2026-10-25T12:00:00Z" }, admin, []);
  await repo.assignService("new-student", "standalone-course", admin);
  const state = await repo.load(), enrollment = state.enrollments.find(row => row.userId === "new-student")!;
  const service = state.userServices.find(row => row.userId === "new-student")!;
  await repo.updateUserService(service.id, "inactive", admin);
  await repo.execute({ type: "enrollment-status", id: enrollment.id, status: "inactive" }, admin, []);
  await repo.updateUser({ type: "update-user", userId: "new-student", name: "Novo nome", email: "novo@example.com", roles: ["student"], status: "inactive" }, admin, []);
  const reopened = await new LocalDemoAdminRepository(() => storage).load();
  expect(reopened.users.find(user => user.id === "new-student")).toMatchObject({ name: "Novo nome", status: "inactive" });
  expect(reopened.enrollments.find(row => row.userId === "new-student")).toMatchObject({ registrationCode: enrollment.registrationCode, status: "inactive" });
  expect(reopened.userServices.find(row => row.id === service.id)).toMatchObject({ status: "inactive", serviceId: "standalone-course" });
});

test("Demo admin: revogação e inatividade continuam restringindo acesso após restauração", async () => {
  const storage = store(), repo = new LocalDemoAdminRepository(() => storage);
  await repo.grantCourseAccess("service-cesar", course, admin, [course]);
  await repo.revokeCourseAccess("service-cesar", course, admin);
  expect(releasedCourseIds(await new LocalDemoAdminRepository(() => storage).load(), student)).not.toContain(course);
  await repo.updateUserService("service-cesar", "inactive", admin);
  expect(releasedCourseIds(await new LocalDemoAdminRepository(() => storage).load(), student)).toEqual([]);
});

test("Demo admin: valida estrutura, enums, unicidade, datas e integridade sem depender do catálogo", () => {
  const good = createAdminFixtures();
  good.courseAccess.push({ userServiceId: "service-cesar", courseId: course });
  expect(parseDemoAdminSnapshot(serializeDemoAdminSnapshot(good))).toEqual(good);
  const invalid: unknown[] = [null, [], {}, { ...good, courses: [] }, { ...good, users: "invalid" }];
  for (const mutate of [
    (s: typeof good) => { s.users[0].roles = ["owner" as "admin"]; },
    (s: typeof good) => { s.users[0].roles = []; },
    (s: typeof good) => { s.users[0].roles = ["admin", "admin"]; },
    (s: typeof good) => { s.users[0].status = "deleted" as "active"; },
    (s: typeof good) => { s.users[0].createdAt = "bad-date"; },
    (s: typeof good) => { s.users[0].email = "bad"; },
    (s: typeof good) => { s.users[1].email = s.users[0].email; },
    (s: typeof good) => { s.users.push(s.users[0]); },
    (s: typeof good) => { s.enrollments[0].userId = "missing"; },
    (s: typeof good) => { s.enrollments[0].registrationCode = "123"; },
    (s: typeof good) => { s.enrollments.push({ ...s.enrollments[0], id: "other" }); },
    (s: typeof good) => { s.services[0].type = "unknown" as "standalone-course"; },
    (s: typeof good) => { s.userServices[0].serviceId = "missing"; },
    (s: typeof good) => { s.courseAccess[0].userServiceId = "missing"; },
    (s: typeof good) => { s.courseAccess.push(s.courseAccess[0]); },
    (s: typeof good) => { s.courseTeachers[0].userId = "missing"; },
    (s: typeof good) => { s.courseTeachers.push(s.courseTeachers[0]); },
  ]) { const value = structuredClone(good); mutate(value); invalid.push(value); }
  for (const value of invalid) {
    expect(isDemoAdminState(value)).toBe(false);
    expect(parseDemoAdminSnapshot(JSON.stringify({ version: 1, state: value }))).toBeNull();
  }
});

for (const raw of ["{broken", JSON.stringify({ version: 2, state: createAdminFixtures() }), JSON.stringify({ version: 1, state: { users: [] } })]) {
  test(`Demo admin: snapshot inválido/versão futura usa fixtures (${raw.slice(0, 20)})`, async () => {
    const storage = store(); storage.setItem(DEMO_ADMIN_STORAGE_KEY, raw); storage.setItem("course-marker", "preserved");
    expect(await new LocalDemoAdminRepository(() => storage).load()).toEqual(createAdminFixtures());
    expect(storage.getItem(DEMO_ADMIN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("course-marker")).toBe("preserved");
  });
}

test("Demo admin: operação recusada não escreve e reset apaga somente o snapshot administrativo", async () => {
  const storage = store(), repo = new LocalDemoAdminRepository(() => storage);
  await repo.grantCourseAccess("service-cesar", course, admin, [course]);
  const raw = storage.getItem(DEMO_ADMIN_STORAGE_KEY);
  await expect(repo.grantCourseAccess("service-cesar", "absent", admin, [])).rejects.toThrow();
  await expect(repo.reset(student)).rejects.toThrow("sem permissão");
  expect(storage.getItem(DEMO_ADMIN_STORAGE_KEY)).toBe(raw);
  storage.setItem("bi-society:course-authoring:v1", "courses"); storage.setItem("lab-snapshot", "answers");
  expect(await repo.reset(admin)).toEqual(createAdminFixtures());
  expect(storage.getItem(DEMO_ADMIN_STORAGE_KEY)).toBeNull();
  expect(storage.getItem("bi-society:course-authoring:v1")).toBe("courses");
  expect(storage.getItem("lab-snapshot")).toBe("answers");
  expect(await new LocalDemoAdminRepository(() => storage).load()).toEqual(createAdminFixtures());
});

test("Demo admin: storage bloqueado/quota mantém operações em memória e avisa", async () => {
  const storage = store(); let blocked = true;
  const repo = new LocalDemoAdminRepository(() => { if (blocked) throw new Error("blocked"); return storage; });
  expect(await repo.load()).toEqual(createAdminFixtures()); expect(repo.notice).toContain("somente em memória");
  await repo.grantCourseAccess("service-cesar", course, admin, [course]);
  expect(releasedCourseIds(await repo.load(), student)).toContain(course); expect(repo.notice).toContain("somente em memória");
  blocked = false;
  await repo.assignTeacher(teacher, course, admin, [course]);
  expect(repo.notice).toBe("");
  expect(releasedCourseIds(await new LocalDemoAdminRepository(() => storage).load(), student)).toContain(course);
  const failing = new LocalDemoAdminRepository(() => ({ ...storage, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } }));
  await failing.revokeCourseAccess("service-cesar", course, admin);
  expect(releasedCourseIds(await failing.load(), student)).not.toContain(course);
  expect(failing.notice).toContain("somente em memória");
  expect(await failing.reset(admin)).toEqual(createAdminFixtures());
  expect(failing.notice).toContain("podem reaparecer");
});

test("Demo admin: logout apaga apenas AuthSession e matrícula restaurada continua autenticando", async () => {
  const storage = store(), session = store(), repo = new LocalDemoAdminRepository(() => storage);
  await repo.grantCourseAccess("service-cesar", course, admin, [course]);
  const state = await new LocalDemoAdminRepository(() => storage).load();
  const adapter = new DemoAuthAdapter(() => state, () => session);
  await adapter.login("202700184", "demo123");
  expect(session.getItem(authStorageKey)).not.toBeNull();
  const before = storage.getItem(DEMO_ADMIN_STORAGE_KEY);
  await adapter.logout(); expect(session.getItem(authStorageKey)).toBeNull();
  expect(storage.getItem(DEMO_ADMIN_STORAGE_KEY)).toBe(before);
  expect((await adapter.login("cesar@example.com", "demo123")).session.userId).toBe(student);
});
