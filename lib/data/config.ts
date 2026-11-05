export type DataMode = "demo" | "supabase";
export interface DataConfiguration { mode: DataMode; url: string; anonKey: string; error: string | null }
export function resolveDataConfiguration(env: { mode?: string; url?: string; anonKey?: string }): DataConfiguration {
  const url = env.url?.trim() ?? "";
  const anonKey = env.anonKey?.trim() ?? "";
  const mode = env.mode || (url || anonKey ? "supabase" : "demo");
  if (mode === "demo") return { mode, url: "", anonKey: "", error: null };
  let validUrl = false;
  try { const parsed = new URL(url); validUrl = parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)); } catch { /* Invalid configuration is explicit, never a fallback to fixtures. */ }
  return { mode: "supabase", url, anonKey, error: mode !== "supabase" || !validUrl || !anonKey ? "Configuração de dados incompleta. Consulte o setup do ambiente." : null };
}
export function dataConfiguration(): DataConfiguration {
  return resolveDataConfiguration({ mode: process.env.NEXT_PUBLIC_DATA_MODE, url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
}
export const emptyAdminState = () => ({ users: [], enrollments: [], services: [], userServices: [], courseAccess: [], courseTeachers: [] });
