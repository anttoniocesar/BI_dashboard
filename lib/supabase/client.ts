"use client";
import { createClient } from "@supabase/supabase-js";
import { dataConfiguration } from "../data/config";
/** Public configuration only; privileged operations always use the Next server. */
export function createSupabaseBrowserClient() {
  const config = dataConfiguration();
  if (config.mode !== "supabase" || config.error) throw new Error("Supabase não configurado.");
  return createClient(config.url, config.anonKey, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
}
