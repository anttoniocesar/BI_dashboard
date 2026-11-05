import { validateEnvironment } from "@/lib/data/environment";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
let cached: { until: number; ok: boolean } | undefined;
export async function GET() {
  let ok = false;
  try {
    validateEnvironment(process.env);
    if (cached && cached.until > Date.now()) ok = cached.ok;
    else { const client = createSupabaseServiceClient(); const [result,catalog,auth] = await Promise.all([client.from("published_lab_activities").select("course_id").limit(1),client.from("courses").select("id").eq("status","published").limit(1),client.auth.admin.listUsers({ page: 1, perPage: 1 })]); ok = !result.error && !catalog.error && !auth.error && !!result.data?.length && !!catalog.data?.length; cached = { until: Date.now() + 10000, ok }; }
  } catch { ok = false; }
  return Response.json({ status: ok ? "ready" : "unavailable" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
