import type { AdminState } from "../../types/admin";

export const DEMO_ADMIN_STORAGE_KEY = "bi-society:demo-admin-state:v1";
export const DEMO_ADMIN_SNAPSHOT_VERSION = 1;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const status = (value: unknown) => value === "active" || value === "inactive";
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const fields = (value: RecordValue, names: string[]) => Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const rows = (value: unknown, validate: (row: RecordValue) => boolean): value is RecordValue[] => Array.isArray(value) && value.every(row => record(row) && validate(row));
const unique = (values: unknown[]) => new Set(values).size === values.length;

/** Validate relationships, not current access: inactive users/links remain stored.
 * Course IDs may belong to a Studio catalog that has not loaded yet. */
export function isDemoAdminState(value: unknown): value is AdminState {
  if (!record(value) || !fields(value, ["users", "enrollments", "services", "userServices", "courseAccess", "courseTeachers"])) return false;
  const { users, enrollments, services, userServices, courseAccess, courseTeachers } = value;
  if (!rows(users, user => fields(user, ["id", "name", "email", "status", "roles", "createdAt"])
    && text(user.id) && text(user.name) && typeof user.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
    && status(user.status) && date(user.createdAt) && Array.isArray(user.roles) && user.roles.length > 0
    && user.roles.every(role => ["student", "teacher", "admin"].includes(role)) && unique(user.roles))) return false;
  if (!rows(enrollments, row => fields(row, ["id", "registrationCode", "userId", "status", "createdAt"])
    && text(row.id) && text(row.userId) && typeof row.registrationCode === "string" && /^\d{9}$/.test(row.registrationCode) && status(row.status) && date(row.createdAt))) return false;
  if (!rows(services, row => fields(row, ["id", "type", "title"]) && text(row.id) && row.type === "standalone-course" && text(row.title))) return false;
  if (!rows(userServices, row => fields(row, ["id", "userId", "serviceId", "status"]) && text(row.id) && text(row.userId) && text(row.serviceId) && status(row.status))) return false;
  if (!rows(courseAccess, row => fields(row, ["userServiceId", "courseId"]) && text(row.userServiceId) && text(row.courseId))) return false;
  if (!rows(courseTeachers, row => fields(row, ["userId", "courseId"]) && text(row.userId) && text(row.courseId))) return false;
  const userIds = new Set(users.map(row => row.id)), serviceIds = new Set(services.map(row => row.id)), linkIds = new Set(userServices.map(row => row.id));
  if (![users, enrollments, services, userServices].every(collection => unique(collection.map(row => row.id)))) return false;
  if (!unique(users.map(row => (row.email as string).toLowerCase())) || !unique(enrollments.map(row => row.registrationCode)) || !unique(enrollments.map(row => row.userId))) return false;
  const pairs = (collection: RecordValue[], first: string, second: string) => unique(collection.map(row => JSON.stringify([row[first], row[second]])));
  return enrollments.every(row => userIds.has(row.userId))
    && userServices.every(row => userIds.has(row.userId) && serviceIds.has(row.serviceId))
    && courseAccess.every(row => linkIds.has(row.userServiceId)) && courseTeachers.every(row => userIds.has(row.userId))
    && pairs(userServices, "userId", "serviceId") && pairs(courseAccess, "userServiceId", "courseId") && pairs(courseTeachers, "userId", "courseId");
}

export function parseDemoAdminSnapshot(raw: string | null): AdminState | null {
  try {
    const snapshot: unknown = JSON.parse(raw ?? "null");
    return record(snapshot) && fields(snapshot, ["version", "state"]) && snapshot.version === DEMO_ADMIN_SNAPSHOT_VERSION && isDemoAdminState(snapshot.state) ? snapshot.state : null;
  } catch { return null; }
}

export function serializeDemoAdminSnapshot(state: AdminState): string {
  if (!isDemoAdminState(state)) throw new Error("Estado administrativo demo inválido.");
  return JSON.stringify({ version: DEMO_ADMIN_SNAPSHOT_VERSION, state });
}
