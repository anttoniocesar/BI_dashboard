import { test, expect } from "@playwright/test";
import { createAdminFixtures } from "../data/admin/demo";
import { demoCredentials } from "../data/auth/demo-credentials";
import { createDemoAuthAdapter, parseAuthSession } from "../lib/auth/demo-auth";
import { authorizedDestination, availableAreas, canEnterArea, initialDestination, requireAuthenticatedUser, requireCourseAccess, safeReturnTo } from "../lib/auth/access";
import { applyAdminCommand } from "../lib/admin/session";

const authenticatedAt = "2026-10-23T12:00:00.000Z";
const adapter = createDemoAuthAdapter(demoCredentials);
test("Auth: matrícula e email normalizado resolvem a mesma identidade sem senha em User", () => {
  const state = createAdminFixtures();
  for (const identifier of ["202700184", " CESAR@EXAMPLE.COM "]) expect(adapter.login(state, identifier, "demo123", authenticatedAt)).toEqual({ userId: "student-cesar", authenticatedAt });
  for (const user of state.users) expect(user).not.toHaveProperty("password");
  expect(state).toEqual(createAdminFixtures());
});
test("Auth: senha incorreta, ausente, usuário inexistente ou inativo e matrícula inativa falham", () => {
  const state = createAdminFixtures();
  for (const [identifier, password] of [["cesar@example.com", "wrong"], ["missing@example.com", "demo123"], ["202700184", ""], ["professor@example.com", "wrong"]]) expect(() => adapter.login(state, identifier, password, authenticatedAt)).toThrow("Identificação ou senha inválida");
  state.users[2].status = "inactive";
  expect(() => adapter.login(state, "cesar@example.com", "demo123", authenticatedAt)).toThrow();
  state.users[2].status = "active"; state.enrollments[0].status = "inactive";
  expect(() => adapter.login(state, "202700184", "demo123", authenticatedAt)).toThrow();
  expect(adapter.login(state, "cesar@example.com", "demo123", authenticatedAt).userId).toBe("student-cesar");
});
test("Auth: parse estrito da sessão e current user sempre consultam o estado atual", () => {
  const state = createAdminFixtures(); const session = { userId: "student-cesar", authenticatedAt };
  expect(parseAuthSession(JSON.stringify(session))).toEqual(session);
  for (const raw of [null, "broken", "[]", "{}", JSON.stringify({ ...session, password: "demo123" }), JSON.stringify({ ...session, authenticatedAt: "invalid" })]) expect(parseAuthSession(raw)).toBeNull();
  expect(requireAuthenticatedUser(state, session)?.name).toBe("César");
  expect(requireAuthenticatedUser(state, { ...session, userId: "missing" })).toBeNull();
  state.users[2].status = "inactive"; expect(requireAuthenticatedUser(state, session)).toBeNull();
});
test("Auth: áreas, multi-role e destino usam as permissões existentes", () => {
  const state = createAdminFixtures(); const [admin, teacher, student] = state.users;
  expect(availableAreas(student)).toEqual(["learn"]); expect(initialDestination(student)).toBe("/learn");
  expect(availableAreas(teacher)).toEqual(["studio"]); expect(initialDestination(teacher)).toBe("/studio/courses");
  expect(availableAreas(admin)).toEqual(["admin"]); expect(initialDestination(admin)).toBe("/admin");
  const multi = { ...student, roles: [...student.roles, ...teacher.roles, ...admin.roles] };
  expect(availableAreas(multi)).toEqual(["learn", "studio", "admin"]); expect(initialDestination(multi)).toBe("/home");
  expect(availableAreas({ ...multi, status: "inactive" })).toEqual([]);
  expect(canEnterArea(null, "studio")).toBe(false);
});
test("Auth: CourseAccess exige todos os elos ativos e reage a remoção de role/vínculo", () => {
  const state = createAdminFixtures(); const student = state.users[2];
  expect(requireCourseAccess(state, student, "neural-demo")).toBe(true);
  expect(requireCourseAccess(state, state.users[0], "neural-demo")).toBe(false);
  expect(requireCourseAccess(state, student, "missing")).toBe(false);
  for (const modify of [
    (copy: typeof state) => { copy.users[2].roles = ["teacher"]; },
    (copy: typeof state) => { copy.users[2].status = "inactive"; },
    (copy: typeof state) => { copy.enrollments[0].status = "inactive"; },
    (copy: typeof state) => { copy.userServices[0].status = "inactive"; },
    (copy: typeof state) => { copy.courseAccess = []; },
  ]) { const copy = structuredClone(state); modify(copy); expect(requireCourseAccess(copy, copy.users[2], "neural-demo")).toBe(false); }
});
test("Auth: returnTo interno autorizado e rejeição de URLs externas, escapes e ambientes indevidos", () => {
  const state = createAdminFixtures(); const student = state.users[2];
  for (const path of ["/home", "/learn", "/learn/neural-demo", "/learn/neural-demo/chapter/fundamentos?test=1", "/admin/users"]) expect(safeReturnTo(path)).toBe(path);
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "/api/studio/import", "/admin/../login", "/learn/%2e%2e/admin", "/%2f%2fevil.example", "/admin\n", "/admin#bad", "/admin/%ZZ"]) expect(safeReturnTo(path)).toBeNull();
  expect(authorizedDestination(state, student, "/learn/neural-demo/chapter/fundamentos")).toBe("/learn/neural-demo/chapter/fundamentos");
  expect(authorizedDestination(state, student, "/admin")).toBe("/learn");
  expect(authorizedDestination(state, student, "/learn/absent")).toBe("/learn");
  expect(authorizedDestination(state, state.users[0], "https://evil.example")).toBe("/admin");
});
test("Auth: mutação administrativa usa ator real, sem herdar permissão de administrador fixo", () => {
  const state = createAdminFixtures();
  for (const actor of ["student-cesar", "teacher-neural", "missing"]) expect(() => applyAdminCommand(state, actor, { type: "service-status", id: "service-cesar", status: "inactive" }, ["neural-demo"])).toThrow("sem permissão");
  expect(applyAdminCommand(state, "admin-demo", { type: "service-status", id: "service-cesar", status: "inactive" }, ["neural-demo"]).userServices[0].status).toBe("inactive");
  expect(() => applyAdminCommand(state, "student-cesar", { type: "revoke-course", userServiceId: "service-cesar", courseId: "neural-demo" }, [])).toThrow("sem permissão");
  const revoked = applyAdminCommand(state, "admin-demo", { type: "revoke-course", userServiceId: "service-cesar", courseId: "neural-demo" }, []);
  expect(requireCourseAccess(revoked, revoked.users[2], "neural-demo")).toBe(false);
  expect(requireCourseAccess(state, state.users[2], "neural-demo")).toBe(true);
});
