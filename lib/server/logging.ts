/** Fixed metadata only. Never pass request bodies, errors, URLs, tokens or identities. */
export function serverEvent(event: "api_failure" | "login_failure" | "import_failure" | "persistence_failure" | "authorization_failure", status: number) {
  console.warn(JSON.stringify({ event, status, timestamp: new Date().toISOString() }));
}
