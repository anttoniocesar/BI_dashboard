import { SaxesParser } from "saxes";
import { posix } from "node:path";
import { IMPORT_LIMITS, ImportFailure, importAssert } from "./limits";
import type { XmlElement } from "./packageReader";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_RELS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const escapeText = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\r/g,"&#13;");
const escapeAttribute = (value: string) => escapeText(value).replace(/"/g,"&quot;").replace(/\n/g,"&#10;").replace(/\t/g,"&#9;");

/** Validate XML once, collect reusable element inventories, and adapt qualified
 * SpreadsheetML names to ExcelJS's lexical (rather than namespace-aware) parser.
 * Only namespace URIs determine normalization. Original package is never changed. */
export function normalizeWorkbookStructure(parts: Map<string, Buffer>) {
  const parserParts = new Map(parts), inventories = new Map<string, (XmlElement & {uri:string})[]>();
  const roots = new Map<string,{name:string;uri:string}>();
  let normalized = false;
  for (const [part,data] of parts) {
    if (!/\.(xml|rels)$/i.test(part)) continue;
    const parser = new SaxesParser({xmlns:true}), elements: (XmlElement & {uri:string})[] = [], active: XmlElement[] = [], output: string[] = [];
    let changed = false, elementCount = 0;
    parser.on("doctype",() => { throw new ImportFailure("INVALID_XML","DTD/entidades XML não são permitidas."); });
    parser.on("opentag",tag => {
      importAssert(active.length < 64 && ++elementCount <= 100000,"XML_LIMIT","Estrutura XML excede o limite de profundidade/elementos.");
      if (!active.length) roots.set(part,{name:tag.local,uri:tag.uri});
      const canonical = tag.uri === MAIN || tag.uri === RELS;
      const name = canonical ? tag.local : tag.name;
      changed ||= name !== tag.name;
      const attrs: Record<string,string> = {};
      for (const attribute of Object.values(tag.attributes)) {
        const key = attribute.uri === OFFICE_RELS ? `r:${attribute.local}` : attribute.name;
        changed ||= key !== attribute.name;
        attrs[key] = attribute.value;
        if (attribute.uri === OFFICE_RELS) attrs["xmlns:r"] = OFFICE_RELS;
      }
      // Explicit default namespaces preserve semantics even with nested/rebound prefixes.
      if (canonical || !tag.prefix) attrs.xmlns = tag.uri;
      output.push(`<${name}${Object.entries(attrs).map(([key,value]) => ` ${key}="${escapeAttribute(value)}"`).join("")}>`);
      const element = {name:tag.local,uri:tag.uri,attributes:Object.fromEntries(Object.values(tag.attributes).flatMap(a => [[a.name,a.value],[a.local,a.value]])),text:""};
      elements.push(element); active.push(element);
    });
    const append = (value:string) => { for (const element of active) if (element.name === "definedName") element.text += value; output.push(escapeText(value)); };
    parser.on("text",append); parser.on("cdata",append);
    parser.on("closetag",tag => { output.push(`</${tag.uri === MAIN || tag.uri === RELS ? tag.local : tag.name}>`); active.pop(); });
    try { parser.write(data.toString("utf8")).close(); }
    catch (cause) { if (cause instanceof ImportFailure) throw cause; throw new ImportFailure("INVALID_XML","O arquivo contém XML inválido e não pode ser lido."); }
    inventories.set(part,elements);
    if (changed) { parserParts.set(part,Buffer.from(output.join(""))); normalized = true; }
  }
  const elements = (part:string, names: readonly string[]) => (inventories.get(part) ?? []).filter(node => names.includes(node.name) && node.uri === (part.endsWith(".rels") ? RELS : MAIN));
  importAssert(roots.get("xl/workbook.xml")?.name === "workbook" && roots.get("xl/workbook.xml")?.uri === MAIN,"UNSUPPORTED_WORKBOOK_STRUCTURE","Estrutura de workbook não suportada: esperado SpreadsheetML XLSX.");
  const sheets = elements("xl/workbook.xml",["sheet"]), relations = elements("xl/_rels/workbook.xml.rels",["Relationship"]);
  importAssert(sheets.length,"NO_WORKSHEETS","O arquivo não contém planilhas utilizáveis.");
  importAssert(sheets.length <= IMPORT_LIMITS.sheets,"SHEET_LIMIT",`O arquivo excede ${IMPORT_LIMITS.sheets} abas.`);
  const ids = new Set<string>(), sheetIds = new Set<string>();
  for (const sheet of sheets) {
    const id = sheet.attributes.id, sheetId = sheet.attributes.sheetId;
    importAssert(id && sheetId && !ids.has(id) && !sheetIds.has(sheetId),"INVALID_SHEET_ID","Identificadores de abas ausentes ou duplicados.");
    ids.add(id); sheetIds.add(sheetId);
    const matches = relations.filter(rel => rel.attributes.Id === id);
    importAssert(matches.length === 1,"MISSING_WORKSHEET_RELATION","Relacionamento de uma planilha ausente ou ambíguo.");
    const rel = matches[0].attributes;
    importAssert(rel.Type?.endsWith("/worksheet") && rel.TargetMode?.toLowerCase() !== "external","UNSUPPORTED_SHEET","Somente worksheets locais são suportadas (não chartsheets). ");
    const target = rel.Target ?? "";
    importAssert(target && !/[\\\u0000?#]/.test(target) && !/^[a-z][a-z\d+.-]*:/i.test(target) && !target.startsWith("//"),"MISSING_WORKSHEET","Destino de planilha inválido.");
    const path = posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join("xl",target));
    importAssert(path.startsWith("xl/") && parts.has(path),"MISSING_WORKSHEET","Conteúdo de uma planilha ausente ou fora do workbook.");
    importAssert(roots.get(path)?.name === "worksheet" && roots.get(path)?.uri === MAIN,"UNSUPPORTED_WORKBOOK_STRUCTURE","Estrutura de planilha não suportada.");
  }
  return {parserParts,elements,branch:normalized ? "namespace-normalized" as const : "standard" as const,
    sheetCount:sheets.length,relationCount:[...inventories.keys()].filter(p=>p.endsWith(".rels")).reduce((sum,p)=>sum+elements(p,["Relationship"]).length,0)};
}
