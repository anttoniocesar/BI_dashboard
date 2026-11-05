import { apiResponse } from "@/lib/server/api";
import { passwordRequest } from "@/lib/server/auth-operations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverContext } from "@/lib/server/context";
export async function POST(request: Request) { return apiResponse(async () => passwordRequest(request, await createSupabaseServerClient(), serverContext)); }
