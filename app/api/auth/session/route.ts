import { apiResponse } from "@/lib/server/api";
import { serverContext } from "@/lib/server/context";
export async function GET() { return apiResponse(async () => { const { session,state } = await serverContext(); return { session,state }; }); }
