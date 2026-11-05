import { importWorkbook } from "@/lib/excel-import/importWorkbook";
import { makeReport } from "@/lib/excel-import/compatibility";
import { IMPORT_LIMITS } from "@/lib/excel-import/limits";
import { dataConfiguration } from "@/lib/data/config";
import { hasPermission } from "@/lib/admin/permissions";
import { DataError } from "@/lib/data/http";
import { serverEvent } from "@/lib/server/logging";

export const runtime = "nodejs";

function failure(code: string, message: string, status: number) {
  serverEvent("import_failure", status);
  return Response.json({ ok: false, report: makeReport([{ level: "ERROR", code, message }]) }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Raw File body avoids buffering an unbounded multipart request before checking its size. */
export async function POST(request: Request) {
  if (dataConfiguration().mode === "supabase") {
    const { serverContext } = await import("@/lib/server/context");
    try { const { user } = await serverContext(); if (!hasPermission(user,"course:author")) return failure("AUTHORIZATION","Acesso não autorizado.",403); }
    catch (cause) { return failure("AUTHORIZATION", "Não foi possível autorizar esta solicitação.",cause instanceof DataError ? cause.status : 503); }
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== (process.env.APP_ORIGIN?.trim() || new URL(request.url).origin)) return failure("ORIGIN", "Origem da solicitação não permitida.", 403);
  let fileName: string;
  try { fileName = decodeURIComponent(request.headers.get("x-file-name") ?? ""); }
  catch { return failure("FILE_NAME", "Nome de arquivo inválido.", 400); }
  if (!fileName) return failure("MISSING_FILE", "Selecione um arquivo Excel para analisar.", 400);
  if (!/\.xlsx$/i.test(fileName)) return failure("UNSUPPORTED_FORMAT", "Formato não suportado. Selecione um arquivo .xlsx.", 400);
  const announced = Number(request.headers.get("content-length"));
  if (announced > IMPORT_LIMITS.fileBytes) return failure("FILE_LIMIT", "O arquivo excede o tamanho máximo de 2 MiB.", 413);
  if (!request.body) return failure("MISSING_FILE", "O arquivo está vazio.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > IMPORT_LIMITS.fileBytes) { await reader.cancel(); return failure("FILE_LIMIT", "O arquivo excede o tamanho máximo de 2 MiB.", 413); }
      chunks.push(value);
    }
    if (!length) return failure("MISSING_FILE", "O arquivo está vazio.", 400);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const result = await importWorkbook(bytes, fileName);
    return Response.json(result, { status: result.ok ? 200 : result.failureKind === "internal" ? 500 : 422, headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("ANALYSIS_FAILED", "Ocorreu um erro interno ao analisar o arquivo. Tente novamente.", 500);
  } finally { reader.releaseLock(); }
}
