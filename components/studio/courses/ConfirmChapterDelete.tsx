"use client";
import { useEffect, useRef } from "react";
import type { ChapterDraft } from "@/types/course";

export function ConfirmChapterDelete({ chapter, onCancel, onConfirm }: { chapter: ChapterDraft | null; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (chapter && !dialog.current?.open) { dialog.current?.showModal(); cancel.current?.focus(); }
    if (!chapter && dialog.current?.open) dialog.current.close();
  }, [chapter]);
  return <dialog ref={dialog} className="course-delete-dialog" aria-labelledby="delete-chapter-title" aria-describedby="delete-chapter-description" onCancel={onCancel} onClose={onCancel}>
    <h2 id="delete-chapter-title">Excluir capítulo?</h2><p id="delete-chapter-description">Deseja excluir {chapter?.title} e todas as suas atividades? Esta ação não pode ser desfeita nesta sessão.</p>
    <div className="course-actions"><button className="studio-secondary" ref={cancel} onClick={() => dialog.current?.close()}>Cancelar</button><button className="studio-primary" onClick={() => { onConfirm(); dialog.current?.close(); }}>Excluir</button></div>
  </dialog>;
}
