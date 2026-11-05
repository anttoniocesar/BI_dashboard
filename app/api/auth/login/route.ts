import { createHash } from "node:crypto";
import { apiResponse, jsonBody } from "@/lib/server/api";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverContext } from "@/lib/server/context";
import { parseLogin } from "@/lib/data/validation";
import { DataError } from "@/lib/data/http";
import { serverEvent } from "@/lib/server/logging";

const attempts = new Map<string,{ count: number; until: number }>();
export async function POST(request: Request) { return apiResponse(async () => {
  const input = parseLogin(await jsonBody(request));
  const identifier = input.identifier.toLowerCase();
  const key = createHash("sha256").update(identifier).digest("hex");
  const now = Date.now(); const previous = attempts.get(key);
  const current = previous && previous.until > now ? previous : { count:0,until:now+60000 };
  if (++current.count > 10) throw new DataError("Aguarde antes de tentar entrar novamente.",429);
  if (attempts.size > 5000) for (const [id,value] of attempts) if (value.until < now) attempts.delete(id);
  attempts.set(key,current);
  let email = identifier;
  if (!identifier.includes("@")) {
    // This mapping never leaves the server, including for invalid identifiers.
    const privileged = createSupabaseServiceClient();
    const enrollment = await privileged.from("enrollments").select("user_id").eq("registration_code",identifier).eq("status","active").maybeSingle();
    const account = enrollment.data ? await privileged.auth.admin.getUserById(enrollment.data.user_id) : null;
    email = account?.data.user?.email ?? "invalid-login@invalid.example";
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email,password:input.password });
  if (error) { serverEvent("login_failure", 401); throw new DataError("Identificação ou senha inválida.",401); }
  try { const { session,state } = await serverContext(); attempts.delete(key); return { session,state }; }
  catch { await client.auth.signOut({ scope:"local" }); throw new DataError("Identificação ou senha inválida.",401); }
}); }
