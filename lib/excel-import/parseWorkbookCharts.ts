import { posix } from "node:path";
import { createHash } from "node:crypto";
import type { ChartAnchor, ChartAxis, ChartCellReference, ChartDefinition, ChartType } from "../../types/exercise";
import { xmlTree, type XmlNode } from "./packageReader";
import { parseChartReference } from "./chartReferences";
import { importedSheetId } from "./sheetIdentity";
import type { ImportedChart, ImportedWorksheet } from "./types";

const MAX_POINTS = 200, MAX_SERIES = 32, MAX_CHARTS = 32;
const colors = ["#ff5a1f", "#193b62", "#238778", "#8a5aab", "#c88b20", "#357bb5", "#bb4d69", "#5c7942", "#6b637c"];
const child = (node: XmlNode | undefined, name: string) => node?.children.find(item => item.name === name);
function descendants(node: XmlNode | undefined, name: string): XmlNode[] { return node ? [...(node.name === name ? [node] : []), ...node.children.flatMap(item => descendants(item, name))] : []; }
const val = (node: XmlNode | undefined) => node?.attributes.val;
const number = (value: string | undefined) => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const stableId = (value: string) => `xlsx-chart-${createHash("sha256").update(value).digest("hex")}`;
const requireChart = (condition: unknown, reason: string): void => { if (!condition) throw new Error(reason); };

/** Only local package references. Never fetch/extract a relationship target. */
function targetPart(source: string, relation: XmlNode | undefined, kind: string): string {
  if (!relation || !relation.attributes.Type?.endsWith(`/${kind}`) || relation.attributes.TargetMode?.toLowerCase() === "external") throw new Error("Relacionamento de gráfico ausente, externo ou incompatível.");
  const target = decodeURIComponent(relation.attributes.Target ?? "");
  if (!target || /[\\\u0000?#]/.test(target) || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//")) throw new Error("Destino de gráfico não é uma parte local segura.");
  const part = posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join(posix.dirname(source), target));
  if (!part.startsWith("xl/") || part.split("/").includes("..")) throw new Error("Destino de gráfico fora do workbook.");
  return part;
}
const relsPart = (part: string) => posix.join(posix.dirname(part), "_rels", posix.basename(part) + ".rels");

function readAnchor(node: XmlNode): ChartAnchor {
  const from = child(node, "from"), to = child(node, "to"), ext = child(node, "ext"), pos = child(node, "pos");
  const fromRow = number(child(from, "row")?.text) ?? Math.floor((number(pos?.attributes.y) ?? 0) / 9525 / 31), fromCol = number(child(from, "col")?.text) ?? Math.floor((number(pos?.attributes.x) ?? 0) / 9525 / 112);
  const width = number(ext?.attributes.cx), height = number(ext?.attributes.cy);
  const anchor: ChartAnchor = { fromRow, fromCol, toRow: number(child(to, "row")?.text) ?? fromRow + 12, toCol: number(child(to, "col")?.text) ?? fromCol + 8,
    ...(width && width > 0 ? { width: Math.round(width / 9525) } : {}), ...(height && height > 0 ? { height: Math.round(height / 9525) } : {}) };
  requireChart([anchor.fromRow, anchor.fromCol, anchor.toRow, anchor.toCol].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1048576)
    && anchor.toRow >= fromRow && anchor.toCol >= fromCol, "Anchor de gráfico inválido.");
  return anchor;
}

type DataSource = { sheet?: string; range?: string; values?: (string | number | null)[]; length: number };
function dataSource(node: XmlNode | undefined, numeric: boolean, sheets: ImportedWorksheet[]): DataSource {
  if (!node) throw new Error("Gráfico sem origem de dados.");
  const ref = child(node, "numRef") ?? child(node, "strRef");
  if (ref) {
    const parsed = parseChartReference(child(ref, "f")?.text ?? "", sheets);
    return { sheet: parsed.sheet, range: parsed.range, length: parsed.length };
  }
  const literal = child(node, "numLit") ?? child(node, "strLit");
  if (!literal) throw new Error("Origem de gráfico não suportada (nomes definidos, múltiplos níveis ou referência ausente).");
  const points = literal.children.filter(item => item.name === "pt");
  const length = number(val(child(literal, "ptCount"))) ?? Math.max(0, ...points.map(point => Number(point.attributes.idx) + 1));
  requireChart(Number.isInteger(length) && length > 0 && length <= MAX_POINTS, "Quantidade de pontos literais do gráfico fora do limite.");
  const values: (string | number | null)[] = Array.from({ length }, () => null);
  const seen = new Set<number>();
  for (const point of points) {
    const index = Number(point.attributes.idx);
    requireChart(Number.isInteger(index) && index >= 0 && index < length && !seen.has(index), "Índice de ponto literal inválido ou duplicado.");
    seen.add(index);
    const raw = child(point, "v")?.text ?? "";
    values[index] = numeric || literal.name === "numLit" ? number(raw) ?? null : raw;
  }
  return { values, length };
}

function textSource(node: XmlNode | undefined, fallback: string, sheets: ImportedWorksheet[], notes: string[]): { text: string; ref?: ChartCellReference } {
  const rich = descendants(node, "t").map(item => item.text).join("");
  const direct = child(node, "v")?.text;
  const ref = child(node, "strRef");
  const cached = descendants(ref, "v")[0]?.text;
  if (ref) {
    try {
      const parsed = parseChartReference(child(ref, "f")?.text ?? "", sheets);
      requireChart(parsed.length === 1, "Nome de série deve referenciar uma única célula.");
      const value = sheets.find(sheet => sheet.name === parsed.sheetName)?.cells.find(cell => cell.address === parsed.range)?.value;
      return { text: String(value ?? cached ?? fallback).trim() || fallback, ref: { sheet: parsed.sheet, cell: parsed.range } };
    } catch { notes.push("Referência de título/nome não resolvida; usado texto de apresentação."); }
  }
  return { text: rich || direct || cached || fallback };
}

function axis(node: XmlNode | undefined, notes: string[]): ChartAxis | undefined {
  if (!node) return undefined;
  const scaling = child(node, "scaling");
  if (child(scaling, "logBase")) notes.push("Escala logarítmica normalizada para escala linear.");
  const min = number(val(child(scaling, "min"))), max = number(val(child(scaling, "max")));
  if (min !== undefined && max !== undefined && min >= max) { notes.push("Limites de eixo inválidos; usados defaults do Lab."); return undefined; }
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(val(child(scaling, "orientation")) === "maxMin" ? { reversed: true } : {}) };
}

function convert(root: XmlNode, id: string, owner: ImportedWorksheet, anchor: ChartAnchor, sheets: ImportedWorksheet[]): { definition: ChartDefinition; notes: string[]; types: string[] } {
  requireChart(["http://schemas.openxmlformats.org/drawingml/2006/chart", "http://purl.oclc.org/ooxml/drawingml/chart"].includes(root.uri) && root.name === "chartSpace", "Namespace ou raiz do gráfico não suportado.");
  const chart = child(root, "chart"), plot = child(chart, "plotArea");
  const plots = plot?.children.filter(node => /Chart$/.test(node.name)) ?? [];
  const types = plots.map(node => node.name);
  requireChart(plots.length === 1, "unsupported chart type: gráficos combinados não são suportados.");
  const source = plots[0];
  const type: ChartType | undefined = source.name === "lineChart" ? "line" : source.name === "barChart" ? (val(child(source, "barDir")) === "bar" ? "bar" : "column") : source.name === "pieChart" ? "pie" : source.name === "scatterChart" ? "scatter" : undefined;
  requireChart(type, `unsupported chart type: ${source.name}.`);
  const notes: string[] = [];
  const grouping = val(child(source, "grouping"));
  requireChart(!grouping || ["standard", "clustered", "stacked"].includes(grouping), `Agrupamento de gráfico não suportado: ${grouping}.`);
  requireChart(grouping !== "stacked" || type === "bar" || type === "column", "Linhas empilhadas não são suportadas.");
  const seriesNodes = source.children.filter(node => node.name === "ser");
  requireChart(seriesNodes.length > 0 && seriesNodes.length <= MAX_SERIES && (type !== "pie" || seriesNodes.length === 1), "Quantidade de séries do gráfico não suportada.");
  let categories: DataSource | undefined;
  const series = seriesNodes.map((node, index) => {
    const y = dataSource(child(node, type === "scatter" ? "yVal" : "val"), true, sheets);
    const xNode = child(node, type === "scatter" ? "xVal" : "cat");
    const x = xNode ? dataSource(xNode, type === "scatter", sheets) : { values: Array.from({ length: y.length }, (_, i) => i + 1), length: y.length };
    requireChart(x.length === y.length && x.length <= MAX_POINTS, "Categorias e valores do gráfico têm comprimentos diferentes ou excedem o limite.");
    if (categories && type !== "scatter") requireChart(JSON.stringify(categories) === JSON.stringify(x), "Categorias diferentes entre séries não são suportadas neste gráfico.");
    categories ??= x;
    const name = textSource(child(node, "tx"), `Série ${index + 1}`, sheets, notes);
    return { id: `series-${index + 1}`, name: name.text, ...(name.ref ? { nameRef: name.ref } : {}),
      ...(y.range ? { sheet: y.sheet, range: y.range } : { values: y.values as (number | null)[] }), color: colors[index % colors.length],
      ...(type === "scatter" ? x.range ? { xSheet: x.sheet, xRange: x.range } : { xValues: x.values as (number | null)[] } : {}) };
  });
  const title = textSource(child(child(chart, "title"), "tx"), "Gráfico importado", sheets, notes);
  const legend = child(chart, "legend");
  const positions = { t: "top", b: "bottom", l: "left", r: "right", tr: "right" } as const;
  const axes = plot?.children.filter(node => ["catAx", "dateAx", "valAx"].includes(node.name)) ?? [];
  const xAxisNode = axes.find(node => node.name !== "valAx") ?? axes[0], yAxisNode = axes.find(node => node.name === "valAx" && node !== (type === "scatter" ? xAxisNode : undefined));
  const definition: ChartDefinition = { id, sheet: importedSheetId(owner.name), type: type!, title: title.text, ...(title.ref ? { titleRef: title.ref } : {}), anchor,
    ...(categories?.range ? { xSheet: categories.sheet, xRange: categories.range } : { xValues: categories?.values }), series,
    legend: !!legend && val(child(legend, "delete")) !== "1", legendPosition: positions[val(child(legend, "legendPos")) as keyof typeof positions] ?? "bottom",
    xAxisLabel: textSource(child(child(xAxisNode, "title"), "tx"), "", sheets, notes).text || undefined,
    yAxisLabel: textSource(child(child(yAxisNode, "title"), "tx"), "", sheets, notes).text || undefined,
    xAxis: axis(xAxisNode, notes), yAxis: axis(yAxisNode, notes), ...(grouping === "stacked" ? { grouping: "stacked" } : {}) };
  return { definition, notes, types };
}

/** Traverse worksheet → drawing → chart once, reusing the already bounded ZIP.
 * Each XML tree is cached; no formula evaluation, external resources or images. */
export function parseWorkbookCharts(parts: Map<string, Buffer>, sources: { part: string; name: string; drawingIds: string[] }[], sheets: ImportedWorksheet[]): ImportedChart[] {
  const trees = new Map<string, XmlNode>();
  const tree = (part: string) => { if (!trees.has(part)) { const bytes = parts.get(part); if (!bytes) throw new Error(`Parte de gráfico ausente: ${part}.`); trees.set(part, xmlTree(bytes)); } return trees.get(part)!; };
  const relationships = (part: string) => parts.has(relsPart(part)) ? tree(relsPart(part)).children.filter(node => node.name === "Relationship") : [];
  const output: ImportedChart[] = [], visited = new Set<string>();
  for (const source of sources) {
    const owner = sheets.find(sheet => sheet.name === source.name)!;
    for (const [drawingIndex, drawingId] of source.drawingIds.entries()) {
      let drawingPart: string;
      try { drawingPart = targetPart(source.part, relationships(source.part).find(rel => rel.attributes.Id === drawingId), "drawing"); }
      catch { continue; } // Existing feature inventory reports unresolved drawings.
      if (!parts.has(drawingPart)) continue;
      tree(drawingPart).children.forEach((drawingAnchor, index) => {
        for (const [refIndex, ref] of descendants(drawingAnchor, "chart").entries()) {
          let part = `${drawingPart}#${ref.attributes.id}`;
          const id = stableId(`${source.name}\0${drawingPart}\0${drawingIndex}\0${index}\0${refIndex}\0${ref.attributes.id}`);
          let types: string[] = [];
          try {
            part = targetPart(drawingPart, relationships(drawingPart).find(rel => rel.attributes.Id === ref.attributes.id), "chart");
            visited.add(part);
            const root = tree(part);
            types = descendants(root, "plotArea")[0]?.children.filter(node => /Chart$/.test(node.name)).map(node => node.name) ?? [];
            requireChart(output.filter(chart => chart.definition).length < MAX_CHARTS, "Limite de 32 gráficos importados excedido.");
            const converted = convert(root, id, owner, readAnchor(drawingAnchor), sheets);
            output.push({ id, part, types, sheetName: owner.name, definition: converted.definition, compatibility: converted.notes.length ? "PARTIALLY_SUPPORTED" : "SUPPORTED", reasons: converted.notes });
          } catch (cause) {
            output.push({ id, part, types, sheetName: owner.name, compatibility: "UNSUPPORTED", reasons: [cause instanceof Error ? cause.message : "Gráfico não convertido."] });
          }
        }
      });
    }
  }
  for (const part of parts.keys()) if (/^xl\/charts\/chart[^/]*\.xml$/i.test(part) && !visited.has(part)) {
    const types = descendants(tree(part), "plotArea")[0]?.children.filter(node => /Chart$/.test(node.name)).map(node => node.name) ?? [];
    output.push({ id: stableId(part), part, types, compatibility: "UNSUPPORTED", reasons: ["Gráfico sem relacionamento local com uma aba/drawing suportado."] });
  }
  return output;
}
