import { apiResponse } from "@/lib/server/api";
import { serverContext } from "@/lib/server/context";
import { attemptRequest } from "@/lib/server/attempts";
export async function POST(request: Request) { return apiResponse(() => attemptRequest(request, serverContext)); }
