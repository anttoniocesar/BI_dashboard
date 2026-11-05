import { safeWebUrl } from "@/lib/learn/content";

export function MaterialActivityCard({ text, url, fileName, material = false }: { text: string; url?: string; fileName?: string; material?: boolean }) {
  const link = safeWebUrl(url);
  return <div className="material-activity-card"><div className="material-content-labels" aria-label="Conteúdo disponível"><span>Conteúdo</span>{fileName && <span>Referência de arquivo</span>}</div><p className="learn-prose">{text || (material ? "Material de apoio ainda não informado." : "Conteúdo ainda não informado.")}</p>
    {material && <>{fileName && <p className="material-file">Referência de arquivo: {fileName}</p>}{link ? <a className="learn-button learn-secondary" href={link} target="_blank" rel="noopener noreferrer">Abrir link do material ↗</a> : <p>Nenhum link válido disponível.</p>}<p className="learn-note">Referência demonstrativa; não há arquivo hospedado nesta POC.</p></>}
  </div>;
}
