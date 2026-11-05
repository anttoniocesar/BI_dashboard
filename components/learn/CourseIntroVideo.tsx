import { VideoActivityCard } from "./VideoActivityCard";

export function CourseIntroVideo({ objective, videoUrl }: { objective: string; videoUrl?: string }) {
  return <section className="course-intro-video" aria-labelledby="course-intro-title"><div><span className="intro-video-symbol" aria-hidden="true">▷</span><h2 id="course-intro-title">Vídeo de abertura do curso</h2><p>{objective || "Conheça o percurso e prepare-se para começar os estudos."}</p><small>Uma introdução ao seu próximo passo.</small></div>
    {videoUrl ? <VideoActivityCard url={videoUrl} summary={objective} completed={false} /> : <div className="course-intro-placeholder" role="img" aria-label="Vídeo de abertura ainda não disponível"><span aria-hidden="true">▷</span><p>Apresentação do treinamento</p><small>Espaço reservado · nenhum serviço externo carregado</small></div>}
  </section>;
}
