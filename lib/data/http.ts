export class DataError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function dataRequest<T>(path: string, body?: unknown, extraHeaders?: Record<string,string>): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new DataError("Não foi possível conectar. Tente novamente.", 503); }
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new DataError(typeof value?.error === "string" ? value.error : "Não foi possível concluir a operação.", response.status);
  return value as T;
}
