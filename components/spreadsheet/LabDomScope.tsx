"use client";
import { createContext, useContext, useId, type ReactNode } from "react";

const Context = createContext("");
/** Presentation only: exercise and persistence identities are unchanged. */
export function LabDomScope({ children }: { children: ReactNode }) {
  const id = useId();
  return <Context.Provider value={id}>{children}</Context.Provider>;
}
export function useLabDomId() {
  const prefix = useContext(Context);
  return (id: string) => prefix ? `${prefix}-${id}` : id;
}
