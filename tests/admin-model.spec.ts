import { test, expect } from "@playwright/test";
import { createAdminFixtures, demoAdminId, demoStudentId } from "../data/admin/demo";
import { applyAdminCommand, generateRegistrationCode, releasedCourseIds, studentIdentity, type AdminCommand } from "../lib/admin/session";
import { hasPermission, hasRole } from "../lib/admin/permissions";
import { courseCatalog } from "../lib/courses/catalog";
import { demoCourse } from "../data/courses/neural-demo";

const createdAt = "2027-01-01T12:00:00Z";
const newUser: AdminCommand = { type: "create-user", id: "new-user", name: "Nova pessoa", email: " NOVA@example.com ", roles: ["student", "teacher"], status: "active", createdAt };
test("Admin: roles múltiplas, permissões por união, inatividade e usuário ausente", () => {
  const state = createAdminFixtures();
  const student = state.users.find(user => user.id === demoStudentId)!;
  expect(hasRole(student, "student")).toBe(true);
  expect(hasPermission(student, "course:study")).toBe(true);
  expect(hasPermission(student, "users:manage")).toBe(false);
  const multiple = { ...student, roles: ["student", "teacher"] as const };
  const user = { ...multiple, roles: [...multiple.roles] };
  expect(hasPermission(user, "course:author")).toBe(true);
  expect(hasPermission(user, "course:study")).toBe(true);
  expect(hasPermission({ ...user, status: "inactive" }, "course:author")).toBe(false);
  expect(hasRole({ ...user, status: "inactive" }, "student")).toBe(false);
  expect(hasRole(null, "admin")).toBe(false);
  expect(hasPermission(undefined, "users:manage")).toBe(false);
  expect(hasPermission(state.users[0], "services:manage")).toBe(true);
  expect(hasPermission(state.users[0], "course:author")).toBe(false);
});
test("Admin: fluxo completo imutável, IDs separados, vínculos idempotentes e matrícula única", () => {
  const original = createAdminFixtures(); const snapshot = structuredClone(original);
  let state = applyAdminCommand(original, demoAdminId, newUser, [demoCourse.id]);
  expect(state.users.at(-1)?.email).toBe("nova@example.com");
  for (const command of [
    { type: "enroll", id: "enrollment-new", userId: "new-user", createdAt },
    { type: "assign-service", id: "link-new", userId: "new-user", serviceId: "standalone-course" },
    { type: "grant-course", userServiceId: "link-new", courseId: demoCourse.id },
    { type: "assign-teacher", userId: "new-user", courseId: demoCourse.id },
  ] as AdminCommand[]) state = applyAdminCommand(state, demoAdminId, command, [demoCourse.id]);
  expect(state.enrollments.at(-1)).toMatchObject({ registrationCode: "202700001", userId: "new-user", id: "enrollment-new" });
  expect(releasedCourseIds(state, "new-user")).toEqual([demoCourse.id]);
  expect(state.courseTeachers).toContainEqual({ userId: "new-user", courseId: demoCourse.id });
  expect(applyAdminCommand(state, demoAdminId, { type: "grant-course", userServiceId: "link-new", courseId: demoCourse.id }, [demoCourse.id])).toBe(state);
  expect(applyAdminCommand(state, demoAdminId, { type: "assign-teacher", userId: "new-user", courseId: demoCourse.id }, [demoCourse.id])).toBe(state);
  expect(() => applyAdminCommand(state, demoAdminId, { type: "enroll", id: "another", userId: "new-user", createdAt }, [])).toThrow("já possui matrícula");
  expect(original).toEqual(snapshot);
  expect(generateRegistrationCode(state.enrollments, 2027)).toBe("202700002");
});
test("Admin: funções de mutação recusam operações sem permissão, mesmo fora da UI", () => {
  const state = createAdminFixtures();
  const commands: AdminCommand[] = [newUser,
    { type: "enroll", id: "e", userId: demoStudentId, createdAt },
    { type: "assign-service", id: "s", userId: demoStudentId, serviceId: "standalone-course" },
    { type: "grant-course", userServiceId: "service-cesar", courseId: demoCourse.id },
    { type: "assign-teacher", userId: "teacher-neural", courseId: demoCourse.id },
  ];
  for (const command of commands) for (const actor of [demoStudentId, "teacher-neural", "missing"]) expect(() => applyAdminCommand(state, actor, command, [demoCourse.id])).toThrow("sem permissão");
});
test("Admin: validações de email, roles, status, referências e pré-requisitos", () => {
  const state = createAdminFixtures();
  for (const command of [
    { ...newUser, email: "CESAR@example.com" }, { ...newUser, name: " " }, { ...newUser, roles: [] }, { ...newUser, email: "invalid" },
    { ...newUser, status: "unknown" }, { ...newUser, roles: ["owner"] },
    { type: "enroll", id: "e", userId: "teacher-neural", createdAt },
    { type: "assign-service", id: "l", userId: demoStudentId, serviceId: "missing" },
    { type: "grant-course", userServiceId: "service-cesar", courseId: "missing" },
    { type: "grant-course", userServiceId: "missing", courseId: demoCourse.id },
    { type: "assign-teacher", userId: demoStudentId, courseId: demoCourse.id },
    { type: "assign-teacher", userId: "teacher-neural", courseId: "missing" },
  ]) expect(() => applyAdminCommand(state, demoAdminId, command as AdminCommand, [demoCourse.id])).toThrow();
  const fresh = applyAdminCommand(state, demoAdminId, newUser, []);
  expect(() => applyAdminCommand(fresh, demoAdminId, { type: "assign-service", id: "l", userId: "new-user", serviceId: "standalone-course" }, [])).toThrow("matrícula");
});
test("Admin: inativar usuário, matrícula ou serviço suspende a liberação derivada", () => {
  const original = createAdminFixtures();
  expect(releasedCourseIds(original, demoStudentId)).toEqual([demoCourse.id, "chapter-navigation-demo"]);
  const user = original.users.find(item => item.id === demoStudentId)!;
  const commands: AdminCommand[] = [
    { type: "update-user", userId: user.id, name: user.name, email: user.email, roles: user.roles, status: "inactive" },
    { type: "update-user", userId: user.id, name: user.name, email: user.email, roles: ["teacher"], status: "active" },
    { type: "enrollment-status", id: "enrollment-cesar", status: "inactive" },
    { type: "service-status", id: "service-cesar", status: "inactive" },
  ];
  for (const command of commands) {
    const state = applyAdminCommand(original, demoAdminId, command, [demoCourse.id]);
    expect(releasedCourseIds(state, demoStudentId)).toEqual([]);
    expect(() => applyAdminCommand(state, demoAdminId, { type: "grant-course", userServiceId: "service-cesar", courseId: demoCourse.id }, [demoCourse.id])).toThrow();
    expect(state.courseAccess).toEqual(original.courseAccess);
  }
});
test("Admin: identidade deriva do modelo e catálogo usa cursos canônicos sem duplicar", () => {
  const state = createAdminFixtures();
  expect(studentIdentity(state, demoStudentId)).toMatchObject({ name: "César", enrollment: "202700184", initials: "C" });
  expect(studentIdentity(state, "missing")).toBeNull();
  state.users.find(user => user.id === demoStudentId)!.name = "César Silva";
  state.enrollments[0].status = "inactive";
  expect(studentIdentity(state, demoStudentId)).toMatchObject({ name: "César Silva", initials: "CS", enrollment: null });
  const draft = { ...demoCourse, id: "studio-course" };
  const courses = courseCatalog([demoCourse, draft]);
  expect(courses.filter(course => course.id === demoCourse.id)).toHaveLength(1);
  expect(courses.find(course => course.id === draft.id)).toBe(draft);
  expect(createAdminFixtures().users.find(user => user.id === demoStudentId)?.name).toBe("César");
});
