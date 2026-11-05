export const LAB_VIEW_KEY = "bi-society:lab-view-preference:v1";
export type LabViewPreference = { mode: "normal" | "expanded" | "custom"; height: number };
export const DEFAULT_LAB_VIEW: LabViewPreference = { mode: "normal", height: 480 };

export function parseLabViewPreference(raw: string | null): LabViewPreference {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.version !== 1 || !["normal", "expanded", "custom"].includes(value.mode) ||
      typeof value.height !== "number" || !Number.isFinite(value.height) || value.height < 320 || value.height > 4000) return DEFAULT_LAB_VIEW;
    return { mode: value.mode, height: value.height };
  } catch { return DEFAULT_LAB_VIEW; }
}

export function labHeightLimits(viewport: number) {
  const max = Math.max(160, Math.floor(viewport * .85));
  return { min: Math.min(320, max), max };
}
export function clampLabHeight(height: number, viewport: number) {
  const { min, max } = labHeightLimits(viewport);
  return Math.min(max, Math.max(min, height));
}
