"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clampLabHeight, DEFAULT_LAB_VIEW, LAB_VIEW_KEY, labHeightLimits, parseLabViewPreference, type LabViewPreference } from "@/lib/spreadsheet/labViewPreference";

type ResizeState = { height: number; viewport: number; fullscreen: boolean; resize: (height: number) => void };
const ResizeContext = createContext<ResizeState | null>(null);

/** Layout preferences never enter the workbook or answer persistence controller. */
export function LabView({ children, heading }: { children: ReactNode; heading?: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const [preference, setPreference] = useState(DEFAULT_LAB_VIEW);
  const [viewport, setViewport] = useState(900);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try { setPreference(parseLabViewPreference(localStorage.getItem(LAB_VIEW_KEY))); } catch { /* Optional browser preference. */ }
    const measure = () => setViewport(window.innerHeight);
    measure(); window.addEventListener("resize", measure);
    return () => { mounted.current = false; window.removeEventListener("resize", measure); };
  }, []);
  function update(value: LabViewPreference) {
    setPreference(value);
    try { localStorage.setItem(LAB_VIEW_KEY, JSON.stringify({ version: 1, ...value })); } catch { /* Resizing still works without storage. */ }
  }
  function finish() {
    fullscreenRef.current = false; setFullscreen(false);
    // The entry button is rendered again only after fullscreen state commits.
    requestAnimationFrame(() => { if (mounted.current) fullscreenButton.current?.focus({ preventScroll: true }); });
  }
  async function leave() {
    if (document.fullscreenElement === root.current) {
      try { await document.exitFullscreen(); } catch { /* Retain an accessible exit even when the browser rejects it. */ }
    }
    if (!document.fullscreenElement) finish();
  }
  async function enter() {
    if (pending.current || fullscreenRef.current) return;
    pending.current = true;
    fullscreenRef.current = true; setFullscreen(true);
    const element = root.current;
    try {
      if (element?.requestFullscreen && document.fullscreenEnabled) await element.requestFullscreen();
    } catch { /* A denied or unavailable native API uses the CSS fullscreen layout. */ }
    finally {
      pending.current = false;
      if ((!mounted.current || !fullscreenRef.current) && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    }
  }
  useEffect(() => {
    const element = root.current;
    const changed = () => {
      if (document.fullscreenElement !== element && fullscreenRef.current) finish();
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    exitButton.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); void leave(); }
      // CSS fallback keeps keyboard focus inside the visible Lab, like native fullscreen.
      if (event.key === "Tab") {
        const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
          .filter(node => node.getClientRects().length > 0);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keydown, true); };
  }, [fullscreen]);

  const height = clampLabHeight(preference.mode === "expanded" ? viewport * .7 : preference.mode === "custom" ? preference.height : Math.min(520, Math.max(420, viewport * .53)), viewport);
  const style = { "--lab-grid-height": fullscreen ? "max(160px, calc(100dvh - 300px))" : `${height}px` } as CSSProperties;
  return <ResizeContext.Provider value={{ height, viewport, fullscreen, resize: value => update({ mode: "custom", height: Math.max(320, clampLabHeight(value, viewport)) }) }}>
    <div ref={root} className={`lab-view${fullscreen ? " lab-view-fullscreen" : ""}`} style={style} data-view-mode={fullscreen ? "fullscreen" : preference.mode}>
      <div className="lab-view-top">{heading}<div className="lab-view-controls" role="group" aria-label="Tamanho do Lab">
        <span>Área da planilha</span>
        <button type="button" title="Altura normal" aria-label="Tamanho normal do Lab" aria-pressed={!fullscreen && preference.mode === "normal"} disabled={fullscreen} onClick={() => update({ ...preference, mode: "normal" })}>Normal</button>
        <button type="button" title="Ampliar a área da planilha" aria-label="Expandir Lab" aria-pressed={!fullscreen && preference.mode === "expanded"} disabled={fullscreen} onClick={() => update({ ...preference, mode: "expanded" })}>Expandir</button>
        {fullscreen ? <button ref={exitButton} type="button" title="Sair da tela cheia (Esc)" aria-label="Sair da tela cheia do Lab" onClick={() => void leave()}>Sair da tela cheia</button> :
          <button ref={fullscreenButton} type="button" title="Abrir Lab em tela cheia" aria-label="Tela cheia do Lab" onClick={() => void enter()}>Tela cheia</button>}
      </div></div>
      {children}
    </div>
  </ResizeContext.Provider>;
}

export function LabResizeHandle() {
  const state = useContext(ResizeContext);
  const drag = useRef<{ y: number; height: number; pointer: number } | null>(null);
  if (!state || state.fullscreen) return null;
  const { min, max } = labHeightLimits(state.viewport);
  // Keep the grid ↔ active sheet tab keyboard path intact. The toolbar provides
  // keyboard-accessible size modes; pointer focus also enables precise arrow steps.
  return <div className="lab-resize-handle" role="separator" aria-label="Ajustar altura da planilha" aria-orientation="horizontal" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(state.height)} tabIndex={-1}
    title="Arraste para ajustar a altura; use as setas para cima e para baixo pelo teclado"
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      drag.current = { y: event.clientY, height: state.height, pointer: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (drag.current?.pointer === event.pointerId) state.resize(drag.current.height + event.clientY - drag.current.y); }}
    onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      const next = event.key === "ArrowDown" ? state.height + 32 : event.key === "ArrowUp" ? state.height - 32 : event.key === "Home" ? min : event.key === "End" ? max : null;
      if (next !== null) { event.preventDefault(); state.resize(next); }
    }}><span aria-hidden="true" /></div>;
}
