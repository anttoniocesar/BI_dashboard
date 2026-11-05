"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const LayoutContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null);

/** Presentation state only, scoped to client navigation inside /learn. */
export function LearnLayoutState({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed(value => !value), []);
  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <LayoutContext.Provider value={value}><div className={`learn-shell${collapsed ? " learn-sidebar-collapsed" : ""}`}>{children}</div></LayoutContext.Provider>;
}

export function useLearnLayoutState() {
  const value = useContext(LayoutContext);
  if (!value) throw new Error("A navegação lateral deve estar dentro de LearnLayoutState.");
  return value;
}
