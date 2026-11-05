import type { AdminState } from "../../types/admin";
import type { AuthSession, DemoCredential } from "../../types/auth";

export const authStorageKey = "bi-society:demo-auth-session:v1";
export interface AuthStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface LocalAuthAdapter {
  login(state: AdminState, identifier: string, password: string, authenticatedAt: string): AuthSession;
}
export function createDemoAuthAdapter(credentials: readonly DemoCredential[]): LocalAuthAdapter {
  return { login(state, identifier, password, authenticatedAt) {
    const normalized = identifier.trim().toLowerCase();
    const user = state.users.find(user => user.email.toLowerCase() === normalized || state.enrollments.some(enrollment => enrollment.userId === user.id && enrollment.registrationCode === normalized && enrollment.status === "active"));
    if (!user || user.status !== "active" || !credentials.some(credential => credential.userId === user.id && credential.password === password)) throw new Error("Identificação ou senha inválida.");
    return { userId: user.id, authenticatedAt };
  } };
}
export function parseAuthSession(raw: string | null): AuthSession | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.userId !== "string" || !record.userId || typeof record.authenticatedAt !== "string" || !Number.isFinite(Date.parse(record.authenticatedAt))) return null;
    return { userId: record.userId, authenticatedAt: record.authenticatedAt };
  } catch { return null; }
}
