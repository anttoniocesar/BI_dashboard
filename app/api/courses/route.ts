import { apiResponse } from "@/lib/server/api";
import { courseRequest } from "@/lib/server/courses";
import { serverContext } from "@/lib/server/context";
export const runtime="nodejs";
export const GET=(request:Request)=>apiResponse(()=>courseRequest(request,serverContext));
export const POST=GET;
