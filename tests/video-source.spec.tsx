import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { parseVideoSource, compatibleVideoUrl } from "../lib/learn/content";
import { VideoActivityCard } from "../components/learn/VideoActivityCard";

const id = "tuBZqgp9TD0";
for (const url of [
  `https://www.youtube.com/watch?v=${id}`,
  `https://youtu.be/${id}`,
  `https://www.youtube.com/shorts/${id}`,
  `https://www.youtube.com/watch?feature=shared&v=${id}&t=30&autoplay=1`,
  `https://youtu.be/${id}?si=share&t=10`,
  `https://www.youtube.com/shorts/${id}?feature=share#comments`,
  `https://m.youtube.com/watch?v=${id}`,
  `https://youtube.com/embed/${id}`,
  `https://www.youtube-nocookie.com/embed/${id}`,
]) test(`YouTube normaliza ${url}`, () => {
  expect(parseVideoSource(url)).toEqual({ type: "youtube", videoId: id, src: `https://www.youtube.com/embed/${id}`, href: url });
});

test("IDs inválidos, hosts falsos e caminhos inesperados não geram iframe", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=short", `https://www.youtube.com/watch?v=${id}%22%3E`,
    `https://www.youtube.com/shorts/${id}/extra`, `https://youtu.be/${id}/extra`,
    `https://youtube.com.evil.example/watch?v=${id}`, `https://evil.example/youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?list=${id}`, `https://www.youtube.com:8443/watch?v=${id}`,
    `https://www.youtube.com/watch?v=tuBZqgp9TD!`,
  ]) expect(parseVideoSource(url)).toMatchObject({ type: "unknown" });
});

test("URLs perigosas ou HTTP não fornecem link externo nem player", () => {
  for (const url of ["", "not a URL", "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///a.mp4", "//youtube.com/watch?v=" + id, `http://www.youtube.com/watch?v=${id}`, `https://evil@www.youtube.com/watch?v=${id}`, "https://user:pass@example.com/a.mp4"]) {
    expect(parseVideoSource(url)).toEqual({ type: "unknown", href: null });
  }
});

test("MP4, WebM e OGG preservam arquivo direto e parâmetros", () => {
  for (const extension of ["mp4", "webm", "ogg", "MP4"]) {
    const src = `https://media.example/lesson.${extension}?token=abc`;
    expect(parseVideoSource(src)).toEqual({ type: "file", src, href: src });
    expect(compatibleVideoUrl(src)).toBe(src);
  }
  expect(compatibleVideoUrl(`https://youtu.be/${id}`)).toBeNull();
});

test("URL HTTPS desconhecida mantém fallback e link seguro", () => {
  const url = "https://example.com/video?lesson=1";
  expect(parseVideoSource(url)).toEqual({ type: "unknown", href: url });
  const html = renderToStaticMarkup(<VideoActivityCard url={url} completed={false} />);
  expect(html).toContain("Este formato de vídeo ainda não possui reprodução incorporada.");
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("<iframe");
  expect(html).not.toContain("<video");
});

test("renderer constrói iframe acessível sem HTML arbitrário nem autoplay", () => {
  const html = renderToStaticMarkup(<VideoActivityCard url={`https://www.youtube.com/shorts/${id}?autoplay=1`} summary={'<script>alert("x")</script>'} completed={false} />);
  expect(html).toContain(`src="https://www.youtube.com/embed/${id}"`);
  expect(html).toContain('title="Vídeo da atividade no YouTube"');
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
  expect(html).toContain("allowFullScreen");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;script&gt;");
  expect(readFileSync("components/learn/VideoActivityCard.tsx", "utf8")).not.toContain("dangerouslySetInnerHTML");
});
