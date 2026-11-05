import type { CSSProperties } from "react";
import { TRAIL_TOP } from "@/lib/courses/journey";
import "./journey-clouds.css";

/** Presentation only: no course, progress, navigation or persistent state. */
export const JOURNEY_CLOUDS = [
  { id: "cloud-01", asset: "/images/learn/clouds/cloud-01.webp", top: 8, width: 44, scale: .95, opacity: .28, duration: 84, delay: -30, restX: 5, driftY: -3 },
  { id: "cloud-02", asset: "/images/learn/clouds/cloud-02.webp", top: 25, width: 40, scale: .95, opacity: .35, duration: 64, delay: -38, restX: 32, driftY: 4 },
  { id: "cloud-03", asset: "/images/learn/clouds/cloud-03.webp", top: 38, width: 34, scale: .9, opacity: .40, duration: 46, delay: 0, restX: 65, driftY: -2 },
] as const;
// Bias toward the label, protecting the whole flag with a smaller cleared area.
export const JOURNEY_CLOUD_EXCLUSION = { x: TRAIL_TOP.x + 3, y: TRAIL_TOP.y, radiusX: 12, radiusY: 20 } as const;

export function JourneyCloudLayer() {
  return <div className="journey-cloud-layer" aria-hidden="true" style={{
    "--cloud-exclusion-x": `${JOURNEY_CLOUD_EXCLUSION.x}%`,
    "--cloud-exclusion-y": `${JOURNEY_CLOUD_EXCLUSION.y}%`,
    "--cloud-exclusion-rx": `${JOURNEY_CLOUD_EXCLUSION.radiusX}%`,
    "--cloud-exclusion-ry": `${JOURNEY_CLOUD_EXCLUSION.radiusY}%`,
  } as CSSProperties}>
    {JOURNEY_CLOUDS.map(cloud => <span key={cloud.id} className="journey-cloud-lane" style={{
      "--cloud-top": `${cloud.top}%`, "--cloud-width": `${cloud.width}%`,
      "--cloud-scale": cloud.scale, "--cloud-opacity": cloud.opacity,
      "--cloud-duration": `${cloud.duration}s`, "--cloud-delay": `${cloud.delay}s`,
      "--cloud-rest-x": `${cloud.restX}%`, "--cloud-drift-y": `${cloud.driftY}%`,
    } as CSSProperties}><span className="journey-cloud-image" style={{ backgroundImage: `url("${cloud.asset}")` }} /></span>)}
  </div>;
}
