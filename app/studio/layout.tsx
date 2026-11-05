import { ImportJourneyProvider } from "@/components/studio/import/ImportJourney";
import "./import/import.css";
import { StudioUserBar } from "@/components/auth/StudioUserBar";
import { Suspense } from "react";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status">Carregando Studio…</p>}><ImportJourneyProvider><StudioUserBar />{children}</ImportJourneyProvider></Suspense>;
}
