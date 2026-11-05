import { apiResponse, emptyPayload, jsonBody } from "@/lib/server/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataError } from "@/lib/data/http";
export async function POST(request: Request) { return apiResponse(async () => {
  emptyPayload(await jsonBody(request));
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new DataError("Não foi possível sair. Tente novamente.",503);
  return { signedOut: true };
}); }
