import { adminRequest, apiResponse } from "@/lib/server/api";
import { serverContext } from "@/lib/server/context";
export async function GET(request: Request) { return apiResponse(() => adminRequest(request,serverContext)); }
export async function POST(request: Request) { return apiResponse(() => adminRequest(request,serverContext)); }
