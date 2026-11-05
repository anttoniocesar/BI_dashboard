export interface DemoCredential { userId: string; password: string }
export interface AuthSession { userId: string; authenticatedAt: string }
export type AuthArea = "learn" | "studio" | "admin";
