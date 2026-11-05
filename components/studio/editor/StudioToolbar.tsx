import Link from "next/link";
import { labReturnLabel, safeLabReturn } from "@/lib/navigation/labReturn";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function StudioToolbar({ title, saved, points, onSave, onPreview, onTest, returnTo = "/studio/courses" }: {
  title: string; saved: boolean; points: number; onSave: () => void; onPreview: () => void; onTest: () => void;
  returnTo?: string;
}) {
  const destination = safeLabReturn(returnTo) ?? "/studio/courses";
  return <header className="studio-editor-header">
    <div><div className="studio-editor-brand"><Link href="/studio/courses"><BrandLogo environment="Studio" /></Link><span className="studio-professor-label">Professor</span></div><h1>{title}</h1><span className="studio-draft-tag">Rascunho · 0.1-draft</span> <span role="status">{saved ? "Rascunho salvo" : "Alterações não salvas"}</span><p>Pontuação total: {points}</p></div>
    <nav aria-label="Ações do editor"><Link className="studio-secondary" href={destination}>← {destination === "/studio/courses" ? "Voltar aos exercícios" : labReturnLabel(destination)}</Link><button className="studio-secondary" onClick={onPreview}>Visualizar como aluno</button><button className="studio-secondary" onClick={onTest}>Testar exercício</button><button className="studio-primary" onClick={onSave}>Salvar rascunho</button><Link className="studio-secondary" href="/studio/courses">Meus cursos</Link></nav>
  </header>;
}
