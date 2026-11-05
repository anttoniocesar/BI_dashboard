import { test, expect } from "@playwright/test";
import { clampLabHeight, DEFAULT_LAB_VIEW, labHeightLimits, parseLabViewPreference } from "../lib/spreadsheet/labViewPreference";

test("Lab view: preferência versionada aceita modos e altura; inválidos usam default", () => {
  for (const mode of ["normal", "expanded", "custom"]) expect(parseLabViewPreference(JSON.stringify({ version: 1, mode, height: 560 }))).toEqual({ mode, height: 560 });
  for (const raw of [null, "{", "null", "[]", JSON.stringify({ version: 2, mode: "expanded", height: 560 }),
    JSON.stringify({ version: 1, mode: "fullscreen", height: 560 }), JSON.stringify({ version: 1, mode: "custom", height: -100 }),
    JSON.stringify({ version: 1, mode: "normal", height: "480" }), JSON.stringify({ version: 1, mode: "custom", height: 100000 })]) {
    expect(parseLabViewPreference(raw)).toEqual(DEFAULT_LAB_VIEW);
  }
});

test("Lab view: limites respeitam viewport, inclusive telas curtas e rotação", () => {
  expect(labHeightLimits(1000)).toEqual({ min: 320, max: 850 });
  expect(clampLabHeight(-100, 1000)).toBe(320);
  expect(clampLabHeight(10000, 1000)).toBe(850);
  expect(clampLabHeight(560, 1000)).toBe(560);
  expect(clampLabHeight(800, 300)).toBe(255);
  expect(clampLabHeight(480, 768)).toBe(480);
});
