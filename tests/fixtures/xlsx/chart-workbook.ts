import ExcelJS from "exceljs";
import { readPackage } from "../../../lib/excel-import/packageReader";
import { packageFixture } from "./package-fixture";

export type ChartFixtureSpec = { type: "line" | "column" | "bar" | "pie" | "scatter" | "radar"; owner?: "Gabarito" | "data"; source?: "Gabarito" | "data"; title?: string | null; fromRow?: number;
  series?: { name?: string; nameFormula?: string; valuesFormula?: string; xFormula?: string; literal?: boolean }[]; anchor?: "twoCellAnchor" | "oneCellAnchor" | "absoluteAnchor" };
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sheetRef = (name: string) => `'${name.replace(/'/g, "''")}'`;
const chartNS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const relNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const labChartTitle = "Evolução do erro absoluto por chapa";

/** Versioned source for small genuine XLSX fixtures, with OOXML drawings/charts
 * grafted onto an ExcelJS workbook. No dependency on Excel or private files. */
export async function chartWorkbookFixture(specs: ChartFixtureSpec[] = [{ type: "line", title: labChartTitle }], dataName = "Dados base", reverseSheets = false) {
  const book = new ExcelJS.Workbook();
  for (const name of reverseSheets ? ["Gabarito", dataName] : [dataName, "Gabarito"]) book.addWorksheet(name);
  const data = book.getWorksheet(dataName)!, answer = book.getWorksheet("Gabarito")!;
  data.getCell("A1").value = "Chapa"; data.getCell("B1").value = "Valor";
  answer.mergeCells("A1:E1"); answer.getCell("A1").value = "LABORATÓRIO 1 | CORREÇÃO DE ERRO";
  answer.getCell("A10").value = "Chapa"; answer.getCell("J10").value = "|e|";
  for (let i = 0; i < 8; i++) {
    data.getCell(`A${i + 2}`).value = i + 1; data.getCell(`B${i + 2}`).value = (i + 1) / 10;
    answer.getCell(`A${i + 11}`).value = i + 1; answer.getCell(`B${i + 11}`).value = -(i + 1) / 10;
    answer.getCell(`J${i + 11}`).value = { formula: `ABS(B${i + 11})`, result: 999 }; // Stale cache must never feed the chart.
  }
  answer.getCell("A21").value = "Resumo"; answer.getCell("A22").value = { formula: "AVERAGE(J11:J18)", result: 999 };
  answer.getCell("N24").numFmt = "0.00";
  for (let i = 1; i <= 14; i++) answer.getColumn(i).width = 16;
  const parts = readPackage(new Uint8Array(await book.xlsx.writeBuffer()));
  let contentTypes = parts.get("[Content_Types].xml")!.toString();
  const owners = new Map<string, string[]>();
  const relationshipType = "http://schemas.openxmlformats.org/package/2006/relationships";
  for (const [index, spec] of specs.entries()) {
    const owner = spec.owner === "data" ? dataName : "Gabarito", source = spec.source === "data" ? dataName : "Gabarito";
    const prefix = sheetRef(source), x = `${prefix}!${source === "Gabarito" ? "$A$11:$A$18" : "$A$2:$A$9"}`, y = `${prefix}!${source === "Gabarito" ? "$J$11:$J$18" : "$B$2:$B$9"}`;
    const numeric = (formula: string) => `<c:numRef><c:f>${escape(formula)}</c:f><c:numCache><c:ptCount val="8"/><c:pt idx="0"><c:v>999</c:v></c:pt></c:numCache></c:numRef>`;
    const literal = `<c:numLit><c:ptCount val="8"/>${Array.from({ length: 8 }, (_, i) => `<c:pt idx="${i}"><c:v>${(i + 1) / 10}</c:v></c:pt>`).join("")}</c:numLit>`;
    const series = (spec.series ?? [{}]).map((series, order) => {
      const nameFormula = series.nameFormula ?? (series.name ? undefined : `${prefix}!${source === "Gabarito" ? "$J$10" : "$B$1"}`);
      return `<c:ser><c:idx val="${order}"/><c:order val="${order}"/><c:tx>${nameFormula ? `<c:strRef><c:f>${escape(nameFormula)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Nome em cache</c:v></c:pt></c:strCache></c:strRef>` : `<c:v>${escape(series.name!)}</c:v>`}</c:tx>`
        + `<c:${spec.type === "scatter" ? "xVal" : "cat"}>${numeric(series.xFormula ?? x)}</c:${spec.type === "scatter" ? "xVal" : "cat"}>`
        + `<c:${spec.type === "scatter" ? "yVal" : "val"}>${series.literal ? literal : numeric(series.valuesFormula ?? y)}</c:${spec.type === "scatter" ? "yVal" : "val"}></c:ser>`;
    }).join("");
    const tag = spec.type === "column" || spec.type === "bar" ? "barChart" : `${spec.type}Chart`;
    const chart = `<c:chartSpace xmlns:c="${chartNS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart>${spec.title === null ? "" : `<c:title><c:tx><c:rich><a:p><a:r><a:t>${escape(spec.title ?? `Gráfico ${index + 1}`)}</a:t></a:r></a:p></c:rich></c:tx></c:title>`}<c:plotArea><c:${tag}>`
      + (tag === "barChart" ? `<c:barDir val="${spec.type === "bar" ? "bar" : "col"}"/><c:grouping val="clustered"/>` : "") + series + `</c:${tag}>`
      + (spec.type === "pie" ? "" : `<c:${spec.type === "scatter" ? "valAx" : "catAx"}><c:scaling><c:orientation val="minMax"/></c:scaling><c:title><c:tx><c:rich><a:p><a:r><a:t>Chapa</a:t></a:r></a:p></c:rich></c:tx></c:title></c:${spec.type === "scatter" ? "valAx" : "catAx"}><c:valAx><c:scaling><c:min val="0"/><c:max val="1"/></c:scaling><c:title><c:tx><c:rich><a:p><a:r><a:t>Erro absoluto</a:t></a:r></a:p></c:rich></c:tx></c:title></c:valAx>`)
      + `</c:plotArea><c:legend><c:legendPos val="b"/></c:legend></c:chart></c:chartSpace>`;
    const part = `xl/charts/chart${index + 1}.xml`; parts.set(part, Buffer.from(chart));
    contentTypes = contentTypes.replace("</Types>", `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
    const anchor = spec.anchor ?? "twoCellAnchor", row = spec.fromRow ?? 20 + index * 18;
    const position = anchor === "absoluteAnchor" ? `<xdr:pos x="5334000" y="5905500"/>` : `<xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`;
    const end = anchor === "twoCellAnchor" ? `<xdr:to><xdr:col>13</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 15}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` : `<xdr:ext cx="7620000" cy="3810000"/>`;
    const list = owners.get(owner) ?? [];
    list.push(`<xdr:${anchor}>${position}${end}<xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 1}" name="Chart ${index + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${chartNS}"><c:chart xmlns:c="${chartNS}" xmlns:r="${relNS}" r:id="chart${index + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:${anchor}>`);
    owners.set(owner, list);
  }
  for (const [owner, anchors] of owners) {
    const sheetIndex = book.worksheets.findIndex(sheet => sheet.name === owner) + 1;
    const drawing = owner === "Gabarito" ? "drawing-gabarito.xml" : "drawing-dados.xml";
    const sheetPart = `xl/worksheets/sheet${sheetIndex}.xml`;
    const sheetXml = parts.get(sheetPart)!.toString().replace("</worksheet>", '<drawing r:id="chartDrawing"/></worksheet>');
    parts.set(sheetPart, Buffer.from(sheetXml));
    parts.set(`xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`, Buffer.from(`<Relationships xmlns="${relationshipType}"><Relationship Id="chartDrawing" Type="${relNS}/drawing" Target="../drawings/${drawing}"/></Relationships>`));
    parts.set(`xl/drawings/${drawing}`, Buffer.from(`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join("")}</xdr:wsDr>`));
    parts.set(`xl/drawings/_rels/${drawing}.rels`, Buffer.from(`<Relationships xmlns="${relationshipType}">${specs.flatMap((spec, index) => (spec.owner === "data" ? dataName : "Gabarito") === owner ? [`<Relationship Id="chart${index + 1}" Type="${relNS}/chart" Target="../charts/chart${index + 1}.xml"/>`] : []).join("")}</Relationships>`));
    contentTypes = contentTypes.replace("</Types>", `<Override PartName="/xl/drawings/${drawing}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  }
  parts.set("[Content_Types].xml", Buffer.from(contentTypes));
  return { parts, buffer: packageFixture(parts) };
}
