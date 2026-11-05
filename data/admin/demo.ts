import type { AdminState } from "../../types/admin";

export const demoAdminId = "admin-demo";
export const demoStudentId = "student-cesar";
export function createAdminFixtures(): AdminState {
  const createdAt = "2026-10-23T12:00:00.000Z";
  return {
    users: [
      { id: demoAdminId, name: "Administrador BI.Society", email: "admin@example.com", roles: ["admin"], status: "active", createdAt },
      { id: "teacher-neural", name: "Professor Neural", email: "professor@example.com", roles: ["teacher"], status: "active", createdAt },
      { id: demoStudentId, name: "César", email: "cesar@example.com", roles: ["student"], status: "active", createdAt },
    ],
    enrollments: [{ id: "enrollment-cesar", registrationCode: "202700184", userId: demoStudentId, status: "active", createdAt }],
    services: [{ id: "standalone-course", type: "standalone-course", title: "Curso Avulso" }],
    userServices: [{ id: "service-cesar", userId: demoStudentId, serviceId: "standalone-course", status: "active" }],
    courseAccess: [{ userServiceId: "service-cesar", courseId: "neural-demo" }, { userServiceId: "service-cesar", courseId: "chapter-navigation-demo" }],
    courseTeachers: [{ userId: "teacher-neural", courseId: "neural-demo" }],
  };
}
