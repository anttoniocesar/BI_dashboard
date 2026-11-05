"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatChartNumber, type ResultChartPoint } from "@/lib/charts/workbookChartData";
import type { ChartAxis, ChartSeriesDefinition } from "@/types/exercise";
import { useLabDomId } from "@/components/spreadsheet/LabDomScope";

type WorkbookLineChartProps = {
  id: string;
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: ResultChartPoint[];
  series: ChartSeriesDefinition[];
  legend?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
  xAxis?: ChartAxis; yAxis?: ChartAxis; height?: number;
};

export function ChartTooltip({ active, label, payload, xLabel }: TooltipContentProps & { xLabel?: string }) {
  if (!active) return null;
  const entries = payload.filter(entry => typeof entry.value === "number" && Number.isFinite(entry.value));
  if (!entries.length) return null;
  return (
    <div className="chart-tooltip" role="tooltip">
      <strong>{xLabel ? `${xLabel} ` : ""}{label}</strong>
      {entries.map(entry => <div key={String(entry.dataKey)}><span className="chart-tooltip-dot" style={{ background: entry.color }} aria-hidden="true" /><span>{entry.name}:</span><b>{formatChartNumber(entry.value as number)}</b></div>)}
    </div>
  );
}

export function WorkbookLineChart({ id, title, xLabel, yLabel, data, series, legend = false, legendPosition = "top", xAxis, yAxis, height }: WorkbookLineChartProps) {
  const domId = useLabDomId();
  const hasData = data.some(point => series.some(item => point.values[item.id] !== null));
  const hasGaps = data.some(point => series.some(item => point.values[item.id] === null));
  const numericX = (xAxis?.min !== undefined || xAxis?.max !== undefined) && data.every(point => typeof point.sample === "number");
  const sideLegend = legendPosition === "left" || legendPosition === "right";
  return (
    <section className="chart-card" aria-labelledby={domId(`${id}-title`)}>
      <h3 id={domId(`${id}-title`)}>{title}</h3>
      {hasData ? <div className="chart-plot" style={height ? { height } : undefined}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 260 }}>
          <LineChart data={data} margin={{ top: 12, right: 18, bottom: 16, left: 8 }} accessibilityLayer aria-label={title}>
            <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="sample" type={numericX ? "number" : "category"} domain={numericX ? [xAxis?.min ?? "auto", xAxis?.max ?? "auto"] : undefined} reversed={xAxis?.reversed} tick={{ fontSize: 11, fill: "#6b7a8e" }} tickLine={false} axisLine={{ stroke: "#d7dfe8" }} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: "#6b7a8e", fontSize: 11 }} height={42} />
            <YAxis width={64} domain={yAxis?.min !== undefined || yAxis?.max !== undefined ? [yAxis.min ?? "auto", yAxis.max ?? "auto"] : undefined} reversed={yAxis?.reversed} allowDataOverflow={yAxis?.min !== undefined || yAxis?.max !== undefined} tick={{ fontSize: 10, fill: "#6b7a8e" }} tickFormatter={formatChartNumber} tickLine={false} axisLine={false} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#6b7a8e", fontSize: 11 }} />
            <Tooltip content={props => <ChartTooltip {...props} xLabel={xLabel} />} isAnimationActive={false} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
            {legend && <Legend verticalAlign={sideLegend ? "middle" : legendPosition} align={sideLegend ? legendPosition : "right"} layout={sideLegend ? "vertical" : "horizontal"} height={sideLegend ? undefined : 30 * Math.min(4, Math.ceil(series.length / 3))} iconType="plainline" wrapperStyle={{ fontSize: 11, paddingBottom: 10, overflowWrap: "anywhere" }} />}
            {series.map(item => <Line key={item.id} dataKey={`values.${item.id}`} name={item.name} type="linear" stroke={item.color} strokeWidth={2} strokeDasharray={item.dashed ? "5 4" : undefined}
              dot={{ r: 3.5, fill: "#ffffff", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div> : <div className="chart-empty" role="status">Sem valores numéricos para exibir.</div>}
      <p className="chart-note">{hasGaps ? "Pontos sem valor numérico aparecem como lacunas." : "Passe o mouse sobre os pontos para ver os valores."}</p>
    </section>
  );
}
