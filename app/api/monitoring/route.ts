import { apiResponse } from "@/lib/server/api";
import { serverContext } from "@/lib/server/context";
import { monitoringRequest } from "@/lib/server/monitoring";
export const runtime = "nodejs";
export async function GET(request: Request) { return apiResponse(() => monitoringRequest(request,serverContext)); }
