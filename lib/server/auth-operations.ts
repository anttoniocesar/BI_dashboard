import type { SupabaseClient } from "@supabase/supabase-js";
import { DataError } from "../data/http";
import { record, exactKeys, text } from "../data/validation";
import { hasPermission } from "../admin/permissions";
import { jsonBody, type AuthorizedContext } from "./api";
import { serverEvent } from "./logging";
import { createHash } from "node:crypto";

const limits = new Map<string, { count: number; until: number }>();
export function authRateLimit(identifier: string) {
  const now = Date.now();
  for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
  const key = createHash("sha256").update(identifier).digest("hex");
  const value = limits.get(key) ?? { count: 0, until: now + 60000 };
  if (++value.count > 5 || limits.size >= 5000) throw new DataError("Aguarde antes de tentar novamente.", 429);
  limits.set(key, value);
}
export async function passwordRequest(request: Request, client: SupabaseClient, resolve: () => Promise<AuthorizedContext>) {
  const body = record(await jsonBody(request));
  const origin = process.env.APP_ORIGIN?.trim() || new URL(request.url).origin;
  if (body.operation === "request" || body.operation === "admin-request") {
    let email: string;
    if (body.operation === "admin-request") {
      exactKeys(body, ["operation", "userId"]);
      const context = await resolve();
      if (!hasPermission(context.user, "users:manage")) throw new DataError("Acesso não autorizado.", 403);
      const target = context.state.users.find(user => user.id === body.userId && user.status === "active");
      if (!target) throw new DataError("Usuário não encontrado.", 404);
      email = target.email;
    } else {
      exactKeys(body, ["operation", "email"]); email = text(body.email, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DataError("Informe um email válido.");
    }
    authRateLimit(email);
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/new-password` });
    if (error) { serverEvent("login_failure", 503); throw new DataError("Não foi possível enviar a solicitação. Tente novamente mais tarde.", 503); }
    return { message: "Se o email estiver cadastrado, você receberá as instruções para definir sua senha." };
  }
  exactKeys(body, ["operation", "tokenHash", "password"]);
  if (body.operation !== "update" || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256 || !/^[a-zA-Z0-9_-]{20,512}$/.test(String(body.tokenHash))) throw new DataError("Use um link válido e uma senha de 12 a 256 caracteres.");
  authRateLimit(String(body.tokenHash));
  const verified = await client.auth.verifyOtp({ token_hash: String(body.tokenHash), type: "recovery" });
  if (verified.error || !verified.data.user) { serverEvent("login_failure", 400); throw new DataError("Link inválido ou expirado. Solicite outro link."); }
  try {
    const user = await client.auth.getUser();
    if (user.error || user.data.user?.id !== verified.data.user.id) throw new DataError("Link inválido ou expirado.");
    const updated = await client.auth.updateUser({ password: body.password });
    if (updated.error) throw new DataError("Não foi possível definir a senha. Use uma senha diferente ou solicite outro link.");
  } finally { await client.auth.signOut({ scope: "local" }); }
  return { message: "Senha definida. Entre com sua nova senha." };
}
