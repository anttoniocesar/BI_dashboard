import type { ImportIssue } from "@/lib/excel-import/types";
const severity = { OK: ["✓", "OK"], WARNING: ["!", "Aviso"], ERROR: ["×", "Erro"] };
export function ImportIssues({ items, title = "Detalhes da análise" }: { items: ImportIssue[]; title?: string }) {
  return <details className="studio-issues"><summary>{title} <span>({items.length} itens)</span></summary>
    <div className="studio-issues-scroll" tabIndex={0} role="region" aria-label={title}><ul>
      {items.map((item, index) => <li key={`${item.code}-${index}`} className={`issue-${item.level.toLowerCase()}`}>
        <span className="studio-severity"><b aria-hidden="true">{severity[item.level][0]}</b>{severity[item.level][1]}</span>
        <div><code>{item.code}</code><p>{item.message}</p>{(item.sheet || item.cell || item.part) && <small>{[item.sheet && `Aba: ${item.sheet}`, item.cell && `Célula: ${item.cell}`, item.part && `Recurso: ${item.part}`].filter(Boolean).join(" · ")}</small>}</div>
      </li>)}
    </ul></div>
  </details>;
}
