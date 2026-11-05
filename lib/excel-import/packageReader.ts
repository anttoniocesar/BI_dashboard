import { inflateRawSync } from "node:zlib";
import { SaxesParser } from "saxes";
import { IMPORT_LIMITS as limits, importAssert } from "./limits";

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** In-memory STORE envelope for already validated parts. No second inflation,
 * filesystem extraction, library internals or new ZIP dependency. */
export function packageForParser(parts: Map<string, Buffer>): Buffer {
  const local: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const [name,data] of parts) {
    const label = Buffer.from(name), header = Buffer.alloc(30), central = Buffer.alloc(46), crc = crc32(data);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6);
    header.writeUInt32LE(crc,14); header.writeUInt32LE(data.length,18); header.writeUInt32LE(data.length,22); header.writeUInt16LE(label.length,26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0x800,8);
    central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(label.length,28); central.writeUInt32LE(offset,42);
    local.push(header,label,data); directory.push(central,label); offset += header.length + label.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(parts.size,8); end.writeUInt16LE(parts.size,10); end.writeUInt32LE(central.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,central,end]);
}

/** Bounded, in-memory ZIP reader. No path extraction and no external resource resolution. */
export function readPackage(input: Uint8Array): Map<string, Buffer> {
  importAssert(input.byteLength <= limits.fileBytes, "FILE_LIMIT", "Arquivo excede o limite de 2 MiB.");
  const bytes = Buffer.from(input);
  importAssert(bytes.length >= 22 && bytes.readUInt32LE(0) === 0x04034b50, "INVALID_FILE", "Arquivo inválido: esperado um pacote XLSX/ZIP.");
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  importAssert(end >= 0, "CORRUPT_ZIP", "Arquivo XLSX corrompido: diretório ZIP ausente.");
  importAssert(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0, "UNSUPPORTED_ZIP", "ZIP multipartes não suportado.");
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  importAssert(count <= limits.zipEntries && count === bytes.readUInt16LE(end + 8), "PACKAGE_LIMIT", "Quantidade de partes ZIP excedida ou ZIP64 não suportado.");
  importAssert(start + size === end, "CORRUPT_ZIP", "Diretório ZIP inválido ou formato ZIP64 não suportado.");
  const entries: { name: string; compressed: number; expanded: number; offset: number; method: number; crc: number }[] = [];
  let cursor = start, total = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    importAssert(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50, "CORRUPT_ZIP", "Entrada ZIP inválida.");
    const nameLength = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    importAssert(cursor + 46 + nameLength + extra + comment <= end, "CORRUPT_ZIP", "Entrada ZIP truncada.");
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const expanded = bytes.readUInt32LE(cursor + 24), compressed = bytes.readUInt32LE(cursor + 20);
    const method = bytes.readUInt16LE(cursor + 10), flags = bytes.readUInt16LE(cursor + 8);
    total += expanded;
    importAssert(!names.has(name) && !name.includes("\\") && !name.startsWith("/") && !name.split("/").includes(".."), "INVALID_PACKAGE_PATH", "Parte ZIP duplicada ou caminho inválido.");
    names.add(name);
    importAssert(!(flags & 1) && [0, 8].includes(method), "UNSUPPORTED_ZIP", "ZIP criptografado ou compressão não suportada.");
    importAssert(expanded <= limits.partBytes && total <= limits.expandedBytes, "EXPANSION_LIMIT", "Pacote excede o limite de expansão (4 MiB por parte / 16 MiB no total).");
    entries.push({ name, expanded, compressed, method, offset: bytes.readUInt32LE(cursor + 42), crc: bytes.readUInt32LE(cursor + 16) });
    cursor += 46 + nameLength + extra + comment;
  }
  importAssert(cursor === end, "CORRUPT_ZIP", "Tamanho do diretório ZIP divergente.");
  const parts = new Map<string, Buffer>();
  for (const entry of entries) {
    const offset = entry.offset;
    importAssert(offset + 30 <= start && bytes.readUInt32LE(offset) === 0x04034b50, "CORRUPT_ZIP", "Cabeçalho local ZIP inválido.");
    const nameLength = bytes.readUInt16LE(offset + 26);
    const dataStart = offset + 30 + nameLength + bytes.readUInt16LE(offset + 28);
    importAssert(bytes.subarray(offset + 30, offset + 30 + nameLength).toString("utf8") === entry.name && bytes.readUInt16LE(offset + 8) === entry.method && !(bytes.readUInt16LE(offset + 6) & 1) && dataStart + entry.compressed <= start, "CORRUPT_ZIP", "Parte ZIP inconsistente ou truncada.");
    const compressed = bytes.subarray(dataStart, dataStart + entry.compressed);
    let data: Buffer;
    try { data = entry.method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: limits.partBytes }); }
    catch { importAssert(false,"CORRUPT_ZIP","Conteúdo comprimido inválido ou acima do limite permitido."); }
    importAssert(data.length === entry.expanded && crc32(data) === entry.crc, "CORRUPT_ZIP", "Conteúdo ZIP com tamanho/CRC inválido.");
    parts.set(entry.name, data);
  }
  return parts;
}

export type XmlElement = { name: string; attributes: Record<string, string>; text: string };
export type XmlNode = XmlElement & { uri: string; children: XmlNode[] };

/** Context-preserving tree for drawing/chart parts only. Same limits/DTD policy. */
export function xmlTree(data: Buffer): XmlNode {
  const parser = new SaxesParser({ xmlns: true });
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined, count = 0;
  parser.on("doctype", () => { throw new Error("DTD/entidades XML não são permitidas."); });
  parser.on("opentag", tag => {
    importAssert(stack.length < 64 && ++count <= 100000, "XML_LIMIT", "Estrutura XML excede o limite de profundidade/elementos.");
    const node: XmlNode = { name: tag.local, uri: tag.uri, attributes: Object.fromEntries(Object.values(tag.attributes).flatMap(a => [[a.name, a.value], [a.local, a.value]])), text: "", children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node); else root = node;
    stack.push(node);
  });
  const append = (value: string) => { if (stack.length) stack[stack.length - 1].text += value; };
  parser.on("text", append); parser.on("cdata", append); parser.on("closetag", () => { stack.pop(); });
  parser.write(data.toString("utf8")).close();
  importAssert(root, "INVALID_XML", "Parte XML sem raiz.");
  return root;
}
/** Read selected elements with a real namespace-aware XML parser. DTD is never accepted. */
export function xmlElements(data: Buffer | string | undefined, selected: readonly string[]): XmlElement[] {
  if (data === undefined) return [];
  const parser = new SaxesParser({ xmlns: true });
  const result: XmlElement[] = [], active: (XmlElement | null)[] = [];
  let elementCount = 0;
  parser.on("doctype", () => { throw new Error("DTD/entidades XML não são permitidas."); });
  parser.on("opentag", tag => {
    importAssert(active.length < 64 && ++elementCount <= 100000, "XML_LIMIT", "Estrutura XML excede o limite de profundidade/elementos.");
    const element = selected.includes(tag.local) ? { name: tag.local, attributes: Object.fromEntries(Object.values(tag.attributes).flatMap(attribute => [[attribute.name, attribute.value], [attribute.local, attribute.value]])), text: "" } : null;
    active.push(element);
    if (element) result.push(element);
  });
  const append = (text: string) => { for (const element of active) if (element) element.text += text; };
  parser.on("text", append);
  parser.on("cdata", append);
  parser.on("closetag", () => { active.pop(); });
  parser.write(typeof data === "string" ? data : data.toString("utf8")).close();
  return result;
}
