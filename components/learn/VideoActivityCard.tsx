"use client";
import { useRef, useState } from "react";
import { parseVideoSource } from "@/lib/learn/content";

type VideoActivityCardProps = { url: string; duration?: number; summary?: string; completed: boolean };

export function VideoActivityCard(props: VideoActivityCardProps) {
  return <VideoActivityContent key={props.url} {...props} />;
}

function VideoActivityContent({ url, duration, summary, completed }: VideoActivityCardProps) {
  const [playing, setPlaying] = useState(false), [failed, setFailed] = useState(false);
  const [replayVersion, setReplayVersion] = useState(0);
  const player = useRef<HTMLVideoElement>(null);
  const source = parseVideoSource(url);
  const supported = source.type !== "unknown";
  function replay() {
    if (source.type === "youtube") { setReplayVersion(version => version + 1); return; }
    setPlaying(true);
    if (player.current) { player.current.currentTime = 0; player.current.focus(); void player.current.play().catch(() => {}); }
  }
  return <div className="video-activity-card">
    <div className="video-player-area">{source.type === "youtube" ?
      <iframe key={replayVersion} src={source.src} title="Vídeo da atividade no YouTube" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      : source.type === "file" && playing && !failed ? <video ref={player} controls autoPlay={false} preload="none" src={source.src} aria-label="Vídeo da atividade" onError={() => setFailed(true)} />
      : <div className="learn-video-placeholder"><span aria-hidden="true">▷</span>{source.type === "file" && !failed ? <button className="learn-button" onClick={() => setPlaying(true)}>Carregar vídeo</button>
        : <p>{failed ? "Não foi possível carregar este vídeo." : "Este formato de vídeo ainda não possui reprodução incorporada."}</p>}</div>}
      {source.href && <a className="learn-note" href={source.href} target="_blank" rel="noopener noreferrer">Abrir vídeo em nova aba</a>}
    </div>
    <div className="video-lesson-summary"><h3>Resumo da aula</h3><p>{summary || "Resumo não informado para esta aula."}</p>{duration !== undefined && <p className="learn-note">Duração: {duration} minutos</p>}<p className="learn-url">{url || "Vídeo ainda não informado."}</p>
      {supported && !failed && completed && <button className="learn-button learn-secondary" onClick={replay}>Assistir novamente</button>}
      <p className="learn-note">Download não disponível. Nenhum arquivo de vídeo foi anexado ao curso.</p>
    </div>
  </div>;
}
