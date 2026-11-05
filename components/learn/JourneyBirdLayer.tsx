import type { CSSProperties } from "react";
import "./journey-birds.css";

export const JOURNEY_BIRD_ASSET = "/images/learn/birds/silhouette.svg";
export const JOURNEY_BIRD_CYCLE = 160;
export const JOURNEY_BIRD_MOBILE_CYCLE = 94;
// The whole flight is clipped to open sky, well left of TOP and above every guide.
export const JOURNEY_BIRD_SKY = { width: 58, height: 42 } as const;
export const JOURNEY_BIRD_FLIGHTS = [
  {
    id: "flight-a", duration: 24, delay: 12,
    path: { from: { x: -22, y: 36 }, to: { x: 105, y: 50 } },
    birds: [
      { x: 8, y: 42, scale: .9, opacity: .67, wingPeriod: 1.4, wingDelay: -.4 },
      { x: 27, y: 20, scale: 1, opacity: .76, wingPeriod: 1.65, wingDelay: -.9 },
      { x: 44, y: 37, scale: .82, opacity: .62, wingPeriod: 1.45, wingDelay: -.2 },
      { x: 65, y: 8, scale: .92, opacity: .70, wingPeriod: 1.8, wingDelay: -1.1 },
      { x: 82, y: 30, scale: .78, opacity: .58, wingPeriod: 1.55, wingDelay: -.7 },
    ],
  },
  {
    id: "flight-b", duration: 22, delay: 82,
    path: { from: { x: -22, y: 74 }, to: { x: 105, y: 30 } },
    birds: [
      { x: 7, y: 20, scale: .85, opacity: .64, wingPeriod: 1.5, wingDelay: -.8 },
      { x: 32, y: 40, scale: .95, opacity: .73, wingPeriod: 1.7, wingDelay: -.3 },
      { x: 58, y: 12, scale: .8, opacity: .60, wingPeriod: 1.35, wingDelay: -1 },
      { x: 80, y: 30, scale: .9, opacity: .68, wingPeriod: 1.6, wingDelay: -.6 },
    ],
  },
] as const;

// Generate CSS timing from the same schedule used for documentation and validation.
// The component has no runtime timers or state. Only transform/opacity move the group.
function flightFrames(flight: typeof JOURNEY_BIRD_FLIGHTS[number], cycle: number, name: string) {
  const percent = (seconds: number) => Number((seconds / cycle * 100).toFixed(5));
  const { from, to } = flight.path;
  return `@keyframes ${name} {
    0%, ${percent(flight.delay)}% { opacity:0; visibility:hidden; transform:translate3d(${from.x}%,${from.y}%,0); }
    ${percent(flight.delay + flight.duration * .05)}% { opacity:1; visibility:visible; }
    ${percent(flight.delay + flight.duration * .95)}% { opacity:1; visibility:visible; }
    ${percent(flight.delay + flight.duration)}%, 100% { opacity:0; visibility:hidden; transform:translate3d(${to.x}%,${to.y}%,0); }
  }`;
}
const flightCSS = JOURNEY_BIRD_FLIGHTS.map(flight => flightFrames(flight, JOURNEY_BIRD_CYCLE, `journey-bird-${flight.id}`)).join("\n")
  + flightFrames(JOURNEY_BIRD_FLIGHTS[0], JOURNEY_BIRD_MOBILE_CYCLE, "journey-bird-mobile-flight-a");

export function JourneyBirdLayer() {
  return <div className="journey-bird-layer" aria-hidden="true" style={{
    width: `${JOURNEY_BIRD_SKY.width}%`, height: `${JOURNEY_BIRD_SKY.height}%`,
    "--bird-cycle": `${JOURNEY_BIRD_CYCLE}s`, "--bird-mobile-cycle": `${JOURNEY_BIRD_MOBILE_CYCLE}s`,
  } as CSSProperties}>
    <style>{flightCSS}</style>
    {JOURNEY_BIRD_FLIGHTS.map(flight => <div key={flight.id} className="journey-bird-flight" data-flight={flight.id}
      style={{ "--bird-flight-name": `journey-bird-${flight.id}` } as CSSProperties}>
      <div className="journey-bird-flock">{flight.birds.map((bird, index) => <svg key={index} className="journey-bird" viewBox="0 0 32 18" focusable="false" aria-hidden="true" style={{
        left: `${bird.x}%`, top: `${bird.y}%`, "--bird-scale": bird.scale, "--bird-opacity": bird.opacity,
        "--bird-wing-period": `${bird.wingPeriod}s`, "--bird-wing-delay": `${bird.wingDelay}s`,
      } as CSSProperties}>
        <use className="journey-bird-wing journey-bird-wing-left" href={`${JOURNEY_BIRD_ASSET}#wing-left`} />
        <use className="journey-bird-wing journey-bird-wing-right" href={`${JOURNEY_BIRD_ASSET}#wing-right`} />
        <use href={`${JOURNEY_BIRD_ASSET}#body`} />
      </svg>)}</div>
    </div>)}
  </div>;
}
