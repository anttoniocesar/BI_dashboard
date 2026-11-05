import { test as base, expect } from "@playwright/test";
import { createInitialWorkbook } from "../../data/neural-network-demo";
import { EXERCISE_STORAGE_KEY, serializeExercise } from "./neural-storage";
export type { Page } from "@playwright/test";
export { expect };

// Explicit filled example for regressions from stages 1–6. Production starts blank.
export const test = base.extend({
  page: async ({ page }, use) => {
    const session = serializeExercise({ workbook: createInitialWorkbook(), activeSheet: "dados", selections: {}, validation: "never" });
    await page.addInitScript(({ key, session }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
    }, { key: EXERCISE_STORAGE_KEY, session });
    await use(page);
  },
});
