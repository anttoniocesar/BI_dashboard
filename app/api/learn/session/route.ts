import { learnRequest, apiResponse } from "@/lib/server/api";
import { serverContext } from "@/lib/server/context";
export async function GET(request: Request) { return apiResponse(() => learnRequest(request,serverContext)); }
export async function POST(request: Request) { return apiResponse(() => learnRequest(request,serverContext)); }
