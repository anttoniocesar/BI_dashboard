import type { AdminState, User } from "../../types/admin";
import type { AuthArea, AuthSession } from "../../types/auth";
import { hasPermission, hasRole } from "../admin/permissions";
import { releasedCourseIds } from "../admin/session";

export function requireAuthenticatedUser(state: AdminState, session: AuthSession | null): User | null {
  return state.users.find(user => user.id === session?.userId && user.status === "active") ?? null;
}
export function canEnterArea(user: User | null, area: AuthArea): boolean {
  if (area === "learn") return hasPermission(user, "course:study");
  if (area === "studio") return hasPermission(user, "course:author");
  return hasPermission(user, "users:manage") || hasPermission(user, "services:manage");
}
export function requireCourseAccess(state: AdminState, user: User | null, courseId: string): boolean {
  return hasRole(user, "student") && hasPermission(user, "course:study") && !!user && releasedCourseIds(state, user.id).includes(courseId);
}
export function availableAreas(user: User | null): AuthArea[] {
  return (["learn", "studio", "admin"] as const).filter(area => canEnterArea(user, area));
}
export const areaDestinations: Record<AuthArea, string> = { learn: "/learn", studio: "/studio/courses", admin: "/admin" };
export function initialDestination(user: User): string {
  const areas = availableAreas(user);
  return areas.length === 1 ? areaDestinations[areas[0]] : "/home";
}
export function routeTarget(pathname: string): { area: AuthArea; courseId?: string } | null {
  const segments = pathname.split("/");
  const area = segments[1];
  if (area !== "learn" && area !== "studio" && area !== "admin") return null;
  let courseId: string | undefined;
  try { courseId = area === "learn" && segments[2] ? decodeURIComponent(segments[2]) : undefined; }
  catch { courseId = "invalid-course-id"; }
  return { area, courseId };
}
/** Explicit internal destinations; no protocol, host, escapes, traversal or login loops. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f#]/.test(value)) return null;
  const path = value.split("?")[0];
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return null; }
  if (decoded !== path || path.split("/").some(part => part === "." || part === "..")) return null;
  if (!/^\/(home|learn|studio|admin)(\/|$)/.test(path)) return null;
  return value;
}
export function authorizedDestination(state: AdminState, user: User, returnTo: unknown): string {
  const destination = safeReturnTo(returnTo);
  if (!destination) return initialDestination(user);
  const target = routeTarget(destination.split("?")[0]);
  if (!target) return destination === "/home" || destination.startsWith("/home?") ? destination : initialDestination(user);
  if (!canEnterArea(user, target.area) || (target.courseId && !requireCourseAccess(state, user, target.courseId))) return initialDestination(user);
  return destination;
}
