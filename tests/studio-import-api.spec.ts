import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { POST } from "../app/api/studio/import/route";
import { IMPORT_LIMITS } from "../lib/excel-import/limits";

const url = "http://localhost/api/studio/import";
test("fronteira Node usa importador real e retorna modelo e relatório sem cache", async () => {
  const response = await POST(new Request(url, { method: "POST", body: readFileSync("tests/fixtures/xlsx/controlled.xlsx"), headers: { "X-File-Name": encodeURIComponent("Exercício.xlsx") } }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const result = await response.json();
  expect(result.ok).toBe(true);
  expect(result.report).toMatchObject({ sheets: 2, cells: 24, formulas: 12, unsupportedFormulas: 0, errors: 0 });
  expect(result.workbook.fileName).toBe("Exercício.xlsx");
});

test("fronteira recusa ausência, extensão errada, corrupção e origem externa", async () => {
  for (const [name, body, expected] of [["", "data", 400], ["bad.xls", "data", 400], ["empty.xlsx", "", 400], ["broken.xlsx", "not zip", 422]] as const) {
    const response = await POST(new Request(url, { method: "POST", body, headers: { "X-File-Name": name } }));
    expect(response.status).toBe(expected);
    expect((await response.json()).ok).toBe(false);
  }
  const response = await POST(new Request(url, { method: "POST", body: "data", headers: { "X-File-Name": "valid.xlsx", Origin: "https://example.invalid" } }));
  expect(response.status).toBe(403);
});

test("fronteira limita tamanho declarado antes de ler e limita bytes reais sem Content-Length", async () => {
  const announced = await POST(new Request(url, { method: "POST", body: "data", headers: { "X-File-Name": "large.xlsx", "Content-Length": String(IMPORT_LIMITS.fileBytes + 1) } }));
  expect(announced.status).toBe(413);
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(IMPORT_LIMITS.fileBytes + 1)); }, cancel() { cancelled = true; } });
  const response = await POST(new Request(url, { method: "POST", body, duplex: "half", headers: { "X-File-Name": "large.xlsx" } } as RequestInit));
  expect(response.status).toBe(413);
  expect(cancelled).toBe(true);
  expect((await response.json()).report.items[0].code).toBe("FILE_LIMIT");
});
