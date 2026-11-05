import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { dataConfiguration } from "../data/config";
import { DataError } from "../data/http";
import { validateEnvironment } from "../data/environment";

export async function createSupabaseServerClient() {
  validateEnvironment(process.env);
  const config = dataConfiguration();
  if (config.mode !== "supabase" || config.error) throw new DataError("Serviço de dados indisponível.", 503);
  const store = await cookies();
  return createServerClient(config.url, config.anonKey, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) { for (const { name, value, options } of values) store.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: (process.env.APP_ORIGIN?.trim() || config.url).startsWith("https:"), path: "/" }); },
  } });
}
/** Isolated client: never shares an authenticated browser/session client. */
export function createSupabaseServiceClient() {
  const config = dataConfiguration();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (config.mode !== "supabase" || config.error || !key) throw new DataError("Operação administrativa indisponível. Verifique a configuração do servidor.", 503);
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
