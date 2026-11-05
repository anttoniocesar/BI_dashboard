"use client";
import { useRef, useState } from "react";

export function FileDropzone({ onChoose, disabled }: { onChoose: (files: File[]) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return <div className={`studio-dropzone ${dragging ? "is-dragging" : ""}`}
    onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!disabled) onChoose(Array.from(event.dataTransfer.files)); }}>
    <span className="studio-upload-icon" aria-hidden="true">↑</span>
    <strong>Arraste seu arquivo Excel aqui</strong>
    <span>ou <button type="button" aria-describedby="studio-file-help" onClick={() => input.current?.click()} disabled={disabled}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!event.repeat) input.current?.click();
        }
      }}>Clique para selecionar</button></span>
    <input ref={input} id="studio-xlsx-file" hidden type="file" accept=".xlsx" aria-label="Arquivo Excel" disabled={disabled}
      onChange={event => { if (event.target.files?.length) onChoose(Array.from(event.target.files)); event.target.value = ""; }} />
    <small id="studio-file-help">Formato aceito: XLSX · Tamanho máximo: 2 MiB</small>
  </div>;
}
