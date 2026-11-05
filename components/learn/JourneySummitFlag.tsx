import "./journey-summit-flag.css";

/** Inline SVG also supplies the static fallback when animation CSS is unavailable. */
export function JourneySummitFlag() {
  return <svg className="journey-summit-flag" width="22" height="28" viewBox="0 0 24 28" aria-hidden="true" focusable="false">
    <g className="summit-flag-cloth">
      <path d="M5 3h16l-4 6 4 6H5Z" fill="#ee7e32" stroke="#a64b16" />
    </g>
    <path className="summit-flag-mast" d="M5 2v24" stroke="#142d4e" strokeWidth="2" />
  </svg>;
}
