/** Only explicit absolute web URLs; no script/data/file schemes or embedded credentials. */
export function safeWebUrl(value?: string): string | null {
  try {
    const url = new URL(value ?? "");
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export type VideoSource =
  | { type: "youtube"; videoId: string; src: string; href: string }
  | { type: "file"; src: string; href: string }
  | { type: "unknown"; href: string | null };

/** Normalize for rendering only; course content retains the teacher's URL. */
export function parseVideoSource(value: string): VideoSource {
  const safe = safeWebUrl(value);
  if (!safe) return { type: "unknown", href: null };
  const url = new URL(safe);
  if (url.protocol !== "https:") return { type: "unknown", href: null };
  const unknown: VideoSource = { type: "unknown", href: safe };
  const youtube = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(url.hostname);
  const short = ["youtu.be", "www.youtu.be"].includes(url.hostname);
  const embedHost = ["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname);
  if (youtube || short || embedHost) {
    if (url.port) return unknown;
    let id: string | undefined;
    if (short) id = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
    else if (youtube && url.pathname === "/watch") id = url.searchParams.get("v") ?? undefined;
    else id = (youtube ? /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/ : /^\/embed\/([A-Za-z0-9_-]{11})\/?$/).exec(url.pathname)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? { type: "youtube", videoId: id, src: `https://www.youtube.com/embed/${id}`, href: safe }
      : unknown;
  }
  return /\.(mp4|webm|ogg)$/i.test(url.pathname) ? { type: "file", src: safe, href: safe } : unknown;
}

/** Legacy direct-file contract used by existing callers. */
export function compatibleVideoUrl(value: string): string | null {
  const source = parseVideoSource(value);
  return source.type === "file" ? source.src : null;
}
