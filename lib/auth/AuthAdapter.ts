import type { AuthSession } from "../../types/auth";
import type { AdminState } from "../../types/admin";
export interface AuthResult { session: AuthSession | null; state?: AdminState; notice?: string }
export interface AuthAdapter {
  restore(): Promise<AuthResult>;
  login(identifier: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
}
