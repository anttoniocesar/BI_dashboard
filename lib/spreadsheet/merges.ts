import type { CellMerge, CellPosition, SheetBounds } from "../../types/spreadsheet";
import { cellAddress, parseCellAddress, positionInBounds } from "./coordinates";

export function mergeRange(merge: Readonly<CellMerge>) {
  return `${cellAddress({ row:merge.startRow,column:merge.startCol })}:${cellAddress({ row:merge.endRow,column:merge.endCol })}`;
}
export function mergeAt(merges: readonly Readonly<CellMerge>[], position: CellPosition) {
  return merges.find(merge => position.row >= merge.startRow && position.row <= merge.endRow && position.column >= merge.startCol && position.column <= merge.endCol);
}
export function mergeAnchor(merges: readonly Readonly<CellMerge>[], position: CellPosition): CellPosition {
  const merge=mergeAt(merges,position);
  return merge ? { row:merge.startRow,column:merge.startCol } : position;
}
export function coveredByMerge(merges: readonly Readonly<CellMerge>[], position: CellPosition) {
  const anchor=mergeAnchor(merges,position);
  return anchor.row !== position.row || anchor.column !== position.column;
}
export function validMerge(value: unknown, bounds: SheetBounds): value is CellMerge {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const merge=value as CellMerge;
  return positionInBounds({row:merge.startRow,column:merge.startCol},bounds) && positionInBounds({row:merge.endRow,column:merge.endCol},bounds)
    && merge.startRow<=merge.endRow && merge.startCol<=merge.endCol && (merge.startRow!==merge.endRow || merge.startCol!==merge.endCol);
}
export function overlappingMerge(first: Readonly<CellMerge>,second: Readonly<CellMerge>) {
  return first.startRow<=second.endRow && first.endRow>=second.startRow && first.startCol<=second.endCol && first.endCol>=second.startCol;
}
/** Shared by import, runtime validation and defensive rendering. First valid
 * range wins; callers decide whether diagnostics are warnings or hard errors. */
export function inspectMerges(input: readonly unknown[],bounds: SheetBounds) {
  const merges:CellMerge[]=[], issues:{range:string;reason:string}[]=[];
  for (const value of input) {
    let candidate:unknown=value;
    const range=typeof value === "string" ? value : JSON.stringify(value);
    try {
      if (typeof value === "string") {
        const parts=value.split(":");
        if(parts.length!==2) throw new Error();
        const from=parseCellAddress(parts[0],bounds),to=parseCellAddress(parts[1],bounds);
        candidate={startRow:from.row,startCol:from.column,endRow:to.row,endCol:to.column};
      }
      if(!validMerge(candidate,bounds)) throw new Error();
      if(merges.some(merge=>overlappingMerge(merge,candidate as CellMerge))) { issues.push({range,reason:"sobrepõe outra mesclagem"});continue; }
      merges.push({...candidate});
    } catch {issues.push({range,reason:"coordenadas inválidas, invertidas ou fora dos limites"});}
  }
  return {merges,issues};
}
/** Row-major Tab order excludes covered cells. Arrows/Enter leave the entire
 * current rectangle before resolving a destination to another anchor. */
export function moveMergedCell(active:CellPosition,rowDelta:number,columnDelta:number,tab:boolean,bounds:SheetBounds,merges:readonly Readonly<CellMerge>[]):CellPosition|null {
  if(tab) {
    const direction=columnDelta<0?-1:1;
    for(let index=active.row*bounds.columns+active.column+direction;index>=0 && index<bounds.rows*bounds.columns;index+=direction) {
      const position={row:Math.floor(index/bounds.columns),column:index%bounds.columns};
      if(!coveredByMerge(merges,position)) return position;
    }
    return null;
  }
  const merge=mergeAt(merges,active);
  const row=rowDelta>0 ? (merge?.endRow??active.row)+rowDelta : active.row+rowDelta;
  const column=columnDelta>0 ? (merge?.endCol??active.column)+columnDelta : active.column+columnDelta;
  return mergeAnchor(merges,{row:Math.max(0,Math.min(bounds.rows-1,row)),column:Math.max(0,Math.min(bounds.columns-1,column))});
}
