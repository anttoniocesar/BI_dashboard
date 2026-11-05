export type Role = "student" | "teacher" | "admin";
export type Permission = "course:study" | "course:author" | "users:manage" | "services:manage";
export type AdminStatus = "active" | "inactive";
export interface User {
  id: string;
  name: string;
  email: string;
  status: AdminStatus;
  roles: Role[];
  createdAt: string;
}
export interface Enrollment {
  id: string;
  registrationCode: string;
  userId: string;
  status: AdminStatus;
  createdAt: string;
}
export interface Service { id: string; type: "standalone-course"; title: string }
export interface UserService { id: string; userId: string; serviceId: string; status: AdminStatus }
export interface CourseAccess { userServiceId: string; courseId: string }
export interface CourseTeacher { userId: string; courseId: string }
export interface AdminState {
  users: User[];
  enrollments: Enrollment[];
  services: Service[];
  userServices: UserService[];
  courseAccess: CourseAccess[];
  courseTeachers: CourseTeacher[];
}
export interface StudentIdentity {
  userId: string;
  name: string;
  initials: string;
  enrollment: string | null;
  caption: string;
}
