import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importWorkbook } from "../../lib/excel-import/importWorkbook";

const originals = new Map<string, Promise<{ address: string; result: string }[]>>();
const captured = new Set<string>();

/** Check displayed results against the original Excel caches, not the Lab engine. */
export async function assertOriginalIfResults(page: Page, file: string | undefined, lab: number) {
  if (!file) return;
  if (!originals.has(file)) originals.set(file, (async () => {
    const imported = await importWorkbook(readFileSync(file), `lab-${lab}.xlsx`);
    if (!imported.ok) throw new Error("O XLSX original não pôde ser importado.");
    const sheet = imported.workbook.worksheets.find(sheet => sheet.name === "Gabarito")!;
    return Array.from({ length: 8 }, (_, index) => {
      const address = `Q${11 + index}`;
      const cached = sheet.cells[address].formula?.cachedResult;
      expect(typeof cached).toBe("string");
      return { address, result: String(cached) };
    });
  })());
  for (const { address, result } of await originals.get(file)!) {
    const cell = page.getByRole("gridcell", { name: address, exact: true });
    await expect(cell).toHaveText(result);
  }
  const stage = new URL(page.url()).pathname.replaceAll("/", "-");
  const key = `${lab}${stage}`;
  if (!captured.has(key)) {
    captured.add(key);
    await page.getByRole("gridcell", { name: "Q11", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/if-lab-${key}.png` });
  }
}
