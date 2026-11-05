"use client";

import Link from "next/link";
import { useId, useState, type ReactNode, type SyntheticEvent } from "react";
import { useLearnLayoutState } from "./LearnLayoutState";

export function LearnSidebarShell({ variant, label, children }: { variant: "overview" | "chapter"; label: string; children: ReactNode }) {
  const { collapsed, toggle } = useLearnLayoutState();
  const id = useId();
  return <div className={`learn-sidebar-shell sidebar-shell-${variant}`}>
    <button type="button" className="sidebar-collapse-button" aria-label={collapsed ? "Expandir trilha do curso" : "Recolher trilha do curso"} aria-expanded={!collapsed} aria-controls={id} onClick={toggle}>
      <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
    </button>
    <nav id={id} className={variant === "overview" ? "course-overview-sidebar" : "learn-sidebar"} aria-label={label}>{children}</nav>
  </div>;
}

/** Preserve native links; blocked chapters are focusable information in compact mode. */
export function LearnSidebarChapter({ href, current, label, className, children }: {
  href?: string; current?: "page" | "step"; label: string; className?: string; children: ReactNode;
}) {
  const { collapsed } = useLearnLayoutState();
  const [tooltipTop, setTooltipTop] = useState<number | null>(null);
  const show = (event: SyntheticEvent<HTMLElement>) => {
    if (collapsed) setTooltipTop(Math.max(110, Math.min(window.innerHeight - 80, event.currentTarget.getBoundingClientRect().top)));
  };
  const shared = {
    className,
    "aria-label": collapsed ? label : undefined,
    onFocus: show,
    onMouseEnter: show,
    onBlur: (event: SyntheticEvent<HTMLElement>) => { if (!event.currentTarget.matches(":hover")) setTooltipTop(null); },
    onMouseLeave: (event: SyntheticEvent<HTMLElement>) => { if (!event.currentTarget.contains(document.activeElement)) setTooltipTop(null); },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => { if (event.key === "Escape") setTooltipTop(null); },
  };
  const content = <>{children}{collapsed && !href && <span className="sidebar-lock" aria-hidden="true">🔒</span>}{collapsed && tooltipTop !== null && <span className="sidebar-tooltip" aria-hidden="true" style={{ top: tooltipTop }}>{label}</span>}</>;
  return href ? <Link {...shared} href={href} aria-current={current}>{content}</Link> : <div {...shared} aria-disabled="true" role={collapsed ? "group" : undefined} tabIndex={collapsed ? 0 : undefined}>{content}</div>;
}
