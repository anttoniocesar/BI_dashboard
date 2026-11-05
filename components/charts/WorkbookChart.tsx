"use client";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartAxis, ChartDefinition } from "@/types/exercise";
import { formatChartNumber, type ResultChartPoint } from "@/lib/charts/workbookChartData";
import { useLabDomId } from "@/components/spreadsheet/LabDomScope";
import { ChartTooltip, WorkbookLineChart } from "./WorkbookLineChart";

const palette = ["#ff5a1f", "#193b62", "#238778", "#8a5aab", "#c88b20", "#357bb5"];
const domain = (axis?: ChartAxis): [number | "auto", number | "auto"] | undefined => axis?.min !== undefined || axis?.max !== undefined ? [axis.min ?? "auto", axis.max ?? "auto"] : undefined;

export function WorkbookChart({ chart, points, height }: { chart: ChartDefinition; points: ResultChartPoint[]; height?: number }) {
  const domId = useLabDomId();
  if (chart.type === "line") return <WorkbookLineChart id={chart.id} title={chart.title} xLabel={chart.xAxisLabel} yLabel={chart.yAxisLabel} data={points} series={chart.series} legend={chart.legend} legendPosition={chart.legendPosition} xAxis={chart.xAxis} yAxis={chart.yAxis} height={height} />;
  const hasData = points.some(point => chart.series.some(series => point.values[series.id] !== null && (chart.type !== "scatter" || point.x?.[series.id] !== null)));
  const legendPosition = chart.legendPosition ?? "bottom", sideLegend = legendPosition === "left" || legendPosition === "right";
  const legend = chart.legend && <Legend verticalAlign={sideLegend ? "middle" : legendPosition} align={sideLegend ? legendPosition : "right"} layout={sideLegend ? "vertical" : "horizontal"} wrapperStyle={{ fontSize: 11 }} />;
  const tooltip = <Tooltip content={props => <ChartTooltip {...props} xLabel={chart.xAxisLabel} />} isAnimationActive={false} />;
  const axes = <><XAxis type={chart.type === "bar" || chart.type === "scatter" ? "number" : "category"} dataKey={chart.type === "scatter" ? "x" : chart.type === "bar" ? undefined : "sample"}
    domain={domain(chart.type === "bar" ? chart.yAxis : chart.xAxis)} allowDataOverflow={!!domain(chart.type === "bar" ? chart.yAxis : chart.xAxis)} reversed={chart.type === "bar" ? chart.yAxis?.reversed : chart.xAxis?.reversed}
    tick={{ fontSize: 11 }} height={42} label={{ value: chart.type === "bar" ? chart.yAxisLabel : chart.xAxisLabel, position: "insideBottom", offset: -8, fontSize: 11 }} />
    <YAxis type={chart.type === "bar" ? "category" : "number"} dataKey={chart.type === "scatter" ? "y" : chart.type === "bar" ? "sample" : undefined}
      domain={domain(chart.type === "bar" ? chart.xAxis : chart.yAxis)} allowDataOverflow={!!domain(chart.type === "bar" ? chart.xAxis : chart.yAxis)} reversed={chart.type === "bar" ? chart.xAxis?.reversed : chart.yAxis?.reversed}
      width={64} tick={{ fontSize: 10 }} tickFormatter={chart.type === "bar" ? undefined : formatChartNumber}
      label={{ value: chart.type === "bar" ? chart.xAxisLabel : chart.yAxisLabel, angle: -90, position: "insideLeft", fontSize: 11 }} /></>;
  const series = chart.series[0];
  return <section className="chart-card" aria-labelledby={domId(`${chart.id}-title`)}>
    <h3 id={domId(`${chart.id}-title`)}>{chart.title}</h3>
    {hasData ? <div className="chart-plot" style={height ? { height } : undefined}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 260 }}>
      {chart.type === "pie" ? <PieChart accessibilityLayer aria-label={chart.title}>
        <Pie data={points.filter(point => point.values[series.id] !== null).map((point, index) => ({ name: point.sample, value: point.values[series.id], fill: palette[index % palette.length] }))} dataKey="value" nameKey="name" outerRadius="75%" isAnimationActive={false} />
        <Tooltip formatter={value => typeof value === "number" ? formatChartNumber(value) : String(value)} isAnimationActive={false} />{legend}
      </PieChart> : chart.type === "scatter" ? <ScatterChart margin={{ top: 12, right: 18, bottom: 16, left: 8 }} accessibilityLayer aria-label={chart.title}>
        <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />{axes}<Tooltip isAnimationActive={false} />{legend}
        {chart.series.map(series => <Scatter key={series.id} name={series.name} fill={series.color} data={points.flatMap(point => {
          const x = point.x?.[series.id], y = point.values[series.id];
          return typeof x === "number" && y !== null ? [{ x, y }] : [];
        })} isAnimationActive={false} />)}
      </ScatterChart> : <BarChart data={points} layout={chart.type === "bar" ? "vertical" : "horizontal"} margin={{ top: 12, right: 18, bottom: 16, left: 8 }} accessibilityLayer aria-label={chart.title}>
        <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />{axes}{tooltip}{legend}
        {chart.series.map(series => <Bar key={series.id} dataKey={`values.${series.id}`} name={series.name} fill={series.color} stackId={chart.grouping === "stacked" ? "values" : undefined} isAnimationActive={false} />)}
      </BarChart>}
    </ResponsiveContainer></div> : <div className="chart-empty" role="status">Sem valores numéricos para exibir.</div>}
    {chart.type === "pie" && <p className="chart-note">{series.name}</p>}
    <p className="chart-note">Passe o mouse sobre os pontos para ver os valores.</p>
  </section>;
}
