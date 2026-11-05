export type AppEnvironment = "development" | "test" | "production";
export function validateEnvironment(env: Record<string, string | undefined>) {
  const context = env.BI_SOCIETY_APP_ENV?.trim() || env.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(context)) throw new Error("BI_SOCIETY_APP_ENV deve ser development, test ou production.");
  const production = context === "production" || env.NODE_ENV === "production";
  const preview = env.BI_SOCIETY_ALLOW_DEMO_PREVIEW === "1";
  if (production && !(preview && env.NEXT_PUBLIC_DATA_MODE === "demo")) {
    const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN"].filter(key => !env[key]?.trim());
    if (env.NEXT_PUBLIC_DATA_MODE !== "supabase") missing.push("NEXT_PUBLIC_DATA_MODE=supabase");
    if (missing.length) throw new Error(`Configuração de produção ausente: ${missing.join(", ")}.`);
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "APP_ORIGIN"]) {
      const url = new URL(env[key]!);
      const localTest = context === "test" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
      if ((!localTest && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || (key === "APP_ORIGIN" && url.pathname !== "/")) throw new Error(`${key} deve ser uma URL HTTPS válida${key === "APP_ORIGIN" ? " sem caminho" : ""}.`);
      if (key === "APP_ORIGIN" && env[key] !== url.origin) throw new Error("APP_ORIGIN deve conter somente a origem, sem barra final.");
    }
    if (context !== "test" && env.NEXT_PUBLIC_PILOT_ONLY !== "1") throw new Error("Produção exige NEXT_PUBLIC_PILOT_ONLY=1 para excluir conteúdos demonstrativos do catálogo.");
  }
  for (const key of ["NEXT_PUBLIC_PILOT_LESSON_URL", "NEXT_PUBLIC_PILOT_APPLICATION_URL"]) if (env[key]) {
    const url = new URL(env[key]!); if (url.protocol !== "https:" || url.username || url.password || !/\.(mp4|webm|ogg)$/i.test(url.pathname)) throw new Error(`${key} deve indicar vídeo HTTPS mp4, webm ou ogg.`);
  }
  return { context: context as AppEnvironment, production, preview };
}
