import { dataConfiguration } from "./config";

/** Local storage/auth mode alone never opts a learner into sample courses. */
export function demoCatalogEnabled(): boolean {
  return dataConfiguration().mode === "demo" && process.env.NEXT_PUBLIC_DEMO_CATALOG === "1";
}
