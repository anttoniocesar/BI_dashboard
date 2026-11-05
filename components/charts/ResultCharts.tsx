"use client";

import { useMemo } from "react";
import type { CalculatedWorkbook } from "@/types/spreadsheet";
import type { ChartDefinition, SheetPresentation } from "@/types/exercise";
import { chartNumber, formatChartNumber, resolveChartText, workbookChartData } from "@/lib/charts/workbookChartData";
import { WorkbookChart } from "./WorkbookChart";

export function ResultCharts({ calculatedWorkbook, charts, presentation }: {
  calculatedWorkbook: CalculatedWorkbook; charts: ChartDefinition[]; presentation?: SheetPresentation["charts"];
}) {
  const datasets = useMemo(() => charts.map(chart => ({ chart: resolveChartText(calculatedWorkbook, chart), points: workbookChartData(calculatedWorkbook, chart).points }))
    .sort((a, b) => (a.chart.anchor?.fromRow ?? 0) - (b.chart.anchor?.fromRow ?? 0) || (a.chart.anchor?.fromCol ?? 0) - (b.chart.anchor?.fromCol ?? 0)), [calculatedWorkbook, charts]);
  return <section className="results-charts" aria-label={presentation?.ariaLabel ?? "Gráficos da planilha"}>
    <header className="results-charts-heading"><div><h2>{presentation?.title ?? "Gráficos"}</h2>{presentation?.description && <p>{presentation.description}</p>}</div>
      {presentation?.metrics?.map(metric => {
        const value = chartNumber(calculatedWorkbook[metric.sheet]?.[metric.cell]);
        return <div className="metric-summary" key={metric.id}><span>{metric.title}{metric.detail && <small>{metric.detail}</small>}</span><output aria-label={metric.ariaLabel}>{value === null ? "—" : formatChartNumber(value)}</output></div>;
      })}
    </header>
    <div className={`results-chart-grid${charts.some(chart => chart.anchor) ? " imported-chart-grid" : ""}`}>{datasets.map(({ chart, points }) => {
      const anchor = chart.anchor;
      // Charts remain in document flow below the grid: no cell/merge overlays.
      // Preserve source ordering and approximate spans, constrained to the viewport.
      const width = anchor ? Math.max(320, Math.min(1400, anchor.width ?? (anchor.toCol - anchor.fromCol) * 112)) : undefined;
      const height = anchor ? Math.max(240, Math.min(520, anchor.height ?? (anchor.toRow - anchor.fromRow) * 24)) : undefined;
      return <div key={chart.id} data-chart-type={chart.type} data-chart-anchor={anchor ? `${anchor.fromRow},${anchor.fromCol}:${anchor.toRow},${anchor.toCol}` : undefined} style={width ? { width: "100%", maxWidth: width, minWidth: 0 } : { minWidth: 0 }}>
        <WorkbookChart chart={chart} points={points} height={height} />
      </div>;
    })}</div>
  </section>;
}
