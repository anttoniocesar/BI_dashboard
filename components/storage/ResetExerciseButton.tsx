"use client";

import { useRef, useState } from "react";
import { useLabDomId } from "@/components/spreadsheet/LabDomScope";

export function ResetExerciseButton({ onReset, triggerLabel = "Reiniciar exercício" }: { onReset: () => Promise<boolean>; triggerLabel?: string }) {
  const domId = useLabDomId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  async function reset() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      if (await onReset()) dialog.current?.close(); else setError(true);
    } catch { setError(true); }
    finally { pendingRef.current = false; setPending(false); }
  }
  return <>
    <button type="button" className="reset-exercise" onClick={() => { setError(false); dialog.current?.showModal(); cancel.current?.focus(); }}>{triggerLabel}</button>
    <dialog ref={dialog} className="reset-dialog" aria-labelledby={domId("reset-title")} aria-describedby={domId("reset-description")} aria-busy={pending} onCancel={event => { if (pendingRef.current) event.preventDefault(); }}>
      <h2 id={domId("reset-title")}>Reiniciar exercício</h2>
      <p id={domId("reset-description")}>Deseja realmente reiniciar o exercício? Todo o progresso atual será apagado.</p>
      {error && <p role="alert">Não foi possível apagar a sessão salva. O exercício atual foi preservado.</p>}
      {pending && <p role="status">Reiniciando exercício...</p>}
      <div><button ref={cancel} type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancelar</button>
        <button type="button" className="confirm-reset" aria-disabled={pending} onClick={() => { void reset(); }}>Reiniciar</button></div>
    </dialog>
  </>;
}
