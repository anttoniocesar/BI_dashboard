"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useImportJourney } from "./ImportJourney";
import { ImportStepper } from "./ImportStepper";
import { FileDropzone } from "./FileDropzone";
import { ImportSummary } from "./ImportSummary";
import { ImportIssues } from "./ImportIssues";
import { SheetSelector } from "./SheetSelector";
import { SheetPreview } from "./SheetPreview";
import { labReturnLabel } from "@/lib/navigation/labReturn";

export function StudioImportPage() {
  const journey = useImportJourney();
  const { step, file, result, busy, error, reviewed } = journey;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step, result]);
  const preview = result?.ok ? result.workbook.worksheets.find(sheet => sheet.id === journey.previewSheet) : null;
  return <>
    <div className="studio-page-heading"><div><div className="eyebrow">AMBIENTE DO PROFESSOR</div><h1>BI.Society <span>Studio</span></h1><p>Importar exercício do Excel</p></div>
      <nav aria-label="Ações da importação">
        <Link href={journey.returnTo} onClick={journey.reset}>← {labReturnLabel(journey.returnTo)}</Link>
        {step !== 1 && <button type="button" onClick={() => journey.setStep(step === 3 ? 2 : 1)} disabled={busy}>← Voltar</button>}
        <button type="button" onClick={journey.reset}>Cancelar</button>
        <Link href="/studio/courses">Meus cursos</Link>
      </nav>
    </div>
    <ImportStepper step={step} />
    <section className="studio-panel" aria-labelledby="studio-stage-heading" aria-busy={busy}>
      <div className="studio-section-heading"><div><span className="studio-kicker">IMPORTAÇÃO DE PLANILHA</span>
        <h2 ref={heading} id="studio-stage-heading" tabIndex={-1}>{step === 1 ? "Selecione seu arquivo" : busy ? "Analisando arquivo..." : step === 3 ? "Revise a importação" : result?.ok ? "Importação analisada" : "Não foi possível importar este arquivo."}</h2>
        <p>{step === 1 ? "Comece com uma planilha Excel para criar um rascunho de exercício." : step === 3 ? "Confira as abas e o conteúdo que deseja levar para o Lab." : "Confira a compatibilidade com os recursos disponíveis no BI.Society Lab."}</p>
      </div><span className="studio-draft-tag">Rascunho</span></div>
      {error && <p className="studio-callout is-error" role="alert"><b aria-hidden="true">×</b> {error}</p>}
      {step === 1 && <>
        <FileDropzone onChoose={journey.choose} />
        {file && <div className="studio-selected-file" role="status"><span className="studio-file-symbol" aria-hidden="true">X</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KiB · {file.type || "XLSX — tipo não informado pelo navegador"}</small></div><button type="button" className="studio-text-button" onClick={journey.reset}>Remover</button></div>}
        <div className="studio-panel-footer"><p>O arquivo será usado apenas nesta sessão de importação.</p><button type="button" className="studio-primary" disabled={!file} onClick={() => { void journey.analyze(); }}>Analisar arquivo <span aria-hidden="true">→</span></button></div>
      </>}
      {busy && <div className="studio-analyzing" role="status"><span className="studio-spinner" aria-hidden="true" /><strong>Analisando arquivo...</strong><p>Conferindo abas, fórmulas e compatibilidade.</p></div>}
      {step === 2 && !busy && result && <>
        <p className={`studio-callout ${result.ok ? result.report.warnings ? "is-warning" : "is-success" : "is-error"}`} role="status"><b aria-hidden="true">{result.ok ? result.report.warnings ? "!" : "✓" : "×"}</b>{result.ok ? result.report.warnings ? "O arquivo pode ser importado, mas alguns itens precisarão de revisão." : "O arquivo está pronto para revisão." : "Não foi possível importar este arquivo. Veja o motivo abaixo e escolha outro arquivo."}</p>
        <ImportSummary report={result.report} />
        {!result.ok && <div className="studio-failure-reasons" role="alert">{result.report.items.filter(item => item.level === "ERROR").map((item, index) => <p key={index}>{item.message}</p>)}</div>}
        <ImportIssues items={result.report.items} />
        <div className="studio-panel-footer"><p>{file?.name}</p>{result.ok ? <button type="button" className="studio-primary" onClick={() => journey.setStep(3)}>Revisar abas <span aria-hidden="true">→</span></button> : <button type="button" className="studio-primary" onClick={journey.reset}>Escolher outro arquivo</button>}</div>
      </>}
      {step === 2 && !busy && !result && <div className="studio-panel-footer"><button type="button" className="studio-secondary" onClick={journey.reset}>Escolher outro arquivo</button><button type="button" className="studio-primary" onClick={() => { void journey.analyze(); }}>Tentar novamente</button></div>}
      {step === 3 && result?.ok && <>
        <div className="studio-review-grid"><div>
          <SheetSelector workbook={result.workbook} selected={journey.selected} preview={journey.previewSheet} report={result.report} onToggle={journey.toggleSheet} onPreview={journey.setPreviewSheet} />
          <fieldset className="studio-import-options"><legend>Opções de importação</legend>
            {([["values", "Valores"], ["formulas", "Fórmulas"], ["formatting", "Formatação disponível"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={journey.options[key]} onChange={event => journey.setOptions(previous => ({ ...previous, [key]: event.target.checked }))} />{label}</label>)}
            <p>A formatação será preservada como metadata quando aplicável.</p>
          </fieldset>
        </div>{preview && <SheetPreview sheet={preview} styles={result.workbook.styles} />}</div>
        {reviewed && !reviewed.ok && <div className="studio-callout is-error" role="alert"><strong>Revise as referências antes de continuar.</strong>{reviewed.report.items.filter(item => item.level === "ERROR").map((item, index) => <p key={index}>{item.message}</p>)}</div>}
        {reviewed && <ImportIssues items={reviewed.report.items} title="Revisão da seleção" />}
        <div className="studio-panel-footer"><p>{journey.selected.length} de {result.workbook.worksheets.length} abas selecionadas <small>O rascunho não será publicado nem salvo permanentemente.</small></p><button type="button" className="studio-primary" disabled={!reviewed?.ok} onClick={journey.openDraft}>Importar e abrir no BI.Society Lab <span aria-hidden="true">→</span></button></div>
      </>}
    </section>
    <p className="studio-bottom-note">Seu arquivo, sua estrutura. Confira os avisos antes de continuar.</p>
  </>;
}
