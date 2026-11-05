// Only application routes may be used as return destinations. Nested context is
// limited to the import preview; arbitrary query strings are never forwarded.
export function safeLabReturn(value: string | null | undefined, depth = 0): string | null {
  if (!value || depth > 2 || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  const [path, query, ...extra] = value.split("?");
  if (extra.length || path.includes("#") || path.split("/").some(part => part === "." || part === "..")) return null;
  const id = "[A-Za-z0-9_-]+";
  const known = new RegExp(`^(?:/studio/(?:courses(?:/${id}(?:/preview)?)?|import(?:/preview)?)|/learn(?:/${id}(?:/chapter/${id})?)?|/admin(?:/(?:users(?:/${id})?|services|enrollments))?)$`);
  if (!known.test(path)) return null;
  if (!query) return path;
  if (path !== "/studio/import/preview" && path !== "/studio/import") return null;
  const params = new URLSearchParams(query);
  if (Array.from(params.keys()).some(key => key !== "returnTo") || params.getAll("returnTo").length !== 1) return null;
  const nested = safeLabReturn(params.get("returnTo"), depth + 1);
  return nested ? labRoute(path, nested) : null;
}

export function labRoute(path: string, returnTo: string) {
  return `${path}?${new URLSearchParams({ returnTo })}`;
}

export function labReturnLabel(path: string) {
  if (path.startsWith("/studio/import/preview")) return "Voltar ao preview";
  if (path.startsWith("/studio/import")) return "Voltar à importação";
  if (/^\/studio\/courses\/[^/]+\/preview$/.test(path)) return "Voltar ao preview";
  if (/^\/studio\/courses\/[^/]+$/.test(path)) return "Voltar ao curso";
  if (path.includes("/chapter/")) return "Voltar ao capítulo";
  if (path.startsWith("/learn/")) return "Voltar ao curso";
  if (path === "/learn") return "Ir para meus cursos";
  if (path.startsWith("/admin")) return "Voltar ao Admin";
  return "Voltar ao Studio";
}
