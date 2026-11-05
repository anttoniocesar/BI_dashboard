"use client";
import { useLearnSession } from "./LearnSession";
import { useAdminSession } from "@/components/admin/AdminSession";
export function LearnDataBoundary({ children }: { children: React.ReactNode }) {
  const { ready,loadError,retryLoad,progressStatus,retryProgress } = useLearnSession();
  if (loadError) return <section className="learn-card"><h1>Dados indisponíveis</h1><p role="alert">{loadError}</p><button className="learn-button" onClick={retryLoad}>Tentar novamente</button></section>;
  if (!ready) return <p role="status">Carregando cursos e progresso...</p>;
  return <>{progressStatus && <p role="status">{progressStatus}{progressStatus.startsWith("Não") && <button className="learn-button" onClick={retryProgress}>Tentar salvar novamente</button>}</p>}{children}</>;
}
export function LearnPersistenceNotice() {
  const { configuration } = useAdminSession();
  return <span>{configuration.mode === "demo" ? "Progresso e respostas apenas em memória. Atualizar ou fechar a página descarta a sessão." : "Progresso e respostas confirmadas dos Labs são preservados no servidor. Aguarde Salvo antes de sair."}</span>;
}
