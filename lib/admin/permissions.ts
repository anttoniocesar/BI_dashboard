import type { Permission, Role, User } from "../../types/admin";

export const rolePermissions: Record<Role, readonly Permission[]> = {
  student: ["course:study"],
  teacher: ["course:author"],
  admin: ["users:manage", "services:manage"],
};
export function hasRole(user: Pick<User, "roles" | "status"> | null | undefined, role: Role): boolean {
  return user?.status === "active" && user.roles.includes(role);
}
export function hasPermission(user: Pick<User, "roles" | "status"> | null | undefined, permission: Permission): boolean {
  return user?.status === "active" && user.roles.some(role => rolePermissions[role]?.includes(permission));
}
