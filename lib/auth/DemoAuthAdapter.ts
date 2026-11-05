import type { AdminState } from "../../types/admin";
import type { AuthAdapter } from "./AuthAdapter";
import { demoCredentials } from "../../data/auth/demo-credentials";
import { authStorageKey, createDemoAuthAdapter, parseAuthSession, type AuthStorage } from "./demo-auth";
export class DemoAuthAdapter implements AuthAdapter {
  constructor(private state: () => AdminState, private storage: () => AuthStorage) {}
  async restore() { const session = parseAuthSession(this.storage().getItem(authStorageKey)); if (!session) this.storage().removeItem(authStorageKey); return { session }; }
  async login(identifier: string, password: string) {
    const session = createDemoAuthAdapter(demoCredentials).login(this.state(),identifier,password,new Date().toISOString());
    // An unavailable store must not prevent an in-memory demo login.
    let notice: string | undefined;
    try { this.storage().setItem(authStorageKey, JSON.stringify(session)); }
    catch { try { this.storage().removeItem(authStorageKey); } catch {} notice="Armazenamento da aba indisponível. O login será mantido somente em memória."; }
    return { session,notice };
  }
  async logout() { try { this.storage().removeItem(authStorageKey); } catch { /* Memory-only demo. */ } }
}
