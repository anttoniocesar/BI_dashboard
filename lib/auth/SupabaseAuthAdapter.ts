import type { AuthAdapter, AuthResult } from "./AuthAdapter";
import { dataRequest, DataError } from "../data/http";
export class SupabaseAuthAdapter implements AuthAdapter {
  async restore() { try { return await dataRequest<AuthResult>("/api/auth/session"); } catch (cause) { if (cause instanceof DataError && cause.status === 401) return { session: null }; throw cause; } }
  login(identifier: string, password: string) { return dataRequest<AuthResult>("/api/auth/login", { identifier, password }); }
  async logout() { await dataRequest("/api/auth/logout", {}); }
}
