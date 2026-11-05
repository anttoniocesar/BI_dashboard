/** Injective UTF-8 encoding, independent of workbook sheet order. */
export const importedSheetId = (name: string) => `s-${Array.from(new TextEncoder().encode(name), byte => byte.toString(16).padStart(2, "0")).join("")}`;
