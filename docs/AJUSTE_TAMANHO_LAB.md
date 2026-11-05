# Tamanho ajustável do BI.Society Lab

## Implementação

A altura anterior vinha de `.grid-viewport`, com um valor opcional por aba.
O novo `LabView` controla somente a apresentação, sem remontar o editor ao
redimensionar. Learn, preview de importação, simulações do professor e preview
do curso usam o mesmo wrapper de `ExerciseLab`. O Studio Lab Editor também
reutiliza `LabView`, mantendo seu painel de configuração fora da tela cheia.

Os controles ficam na parte superior do Lab, próximos ao salvamento/reset:

- **Normal:** aproximadamente 420–520 px, respeitando a viewport disponível.
- **Expandir:** 70% da altura da viewport.
- **Tela cheia:** solicita a API nativa do navegador; quando ausente ou recusada,
  usa um layout CSS fixo que ocupa a viewport. Mantém controles, barra de
  fórmulas, abas e, nos Labs de aluno/simulação, status de salvamento/reset.
- **Alça inferior da grade:** arraste com mouse ou use as setas para ajustar em
  passos de 32 px após focar a alça por clique; Home/End selecionam os limites. Cursor `ns-resize`, título,
  foco visível e informações ARIA identificam o ajuste.

A alça não acrescenta uma parada de Tab entre a grade e a aba ativa. Os modos
da toolbar são acessíveis por Tab e permitem ajustar o espaço sem usar mouse.

O mínimo usual é 320 px e o máximo é 85vh. Em viewports muito baixas, o mínimo
se adapta para não ultrapassar esse máximo. A altura personalizada é limitada
novamente quando a viewport muda, inclusive na rotação do dispositivo. Os modos
por botão dispensam arraste preciso em mobile. A largura das células e o zoom
permanecem iguais; os scrolls horizontal/vertical internos continuam ativos.

Esc ou **Sair da tela cheia** restaura o modo/altura anterior e devolve o foco
ao controle de entrada. A saída nativa pelo navegador também sincroniza a UI.
A página externa fica sem scroll durante tela cheia e seu estado é restaurado
ao sair ou desmontar o Lab. O fallback mantém a navegação por Tab dentro do Lab.
Os gráficos continuam abaixo da grade no fluxo existente, acessíveis pelo scroll
da área em tela cheia; anchors, ranges e dados não são reescritos.

Referências da API: [requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
e [fullscreenchange](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event).

## Preferência visual

Chave local: `bi-society:lab-view-preference:v1`.

```ts
{ version: 1, mode: "normal" | "expanded" | "custom", height: number }
```

O storage é lido na montagem; só uma ação de ajuste escreve a preferência.
Payload inválido usa Normal. Falhas de leitura/gravação mantêm os controles
funcionando em memória. A preferência é compartilhada pelos Labs no mesmo
navegador/perfil/origem, inclusive no modo Supabase, sem sincronização no servidor.
Não é específica por exercício nem separada por conta neste MVP.

Tela cheia é transitória: não é persistida nem reaberta automaticamente.
**Reiniciar planilha** altera somente as respostas; preserva a preferência visual.
O estado visual não entra no snapshot de respostas e seus ajustes não disparam
autosave. Seleção, fórmulas, proteção, merges, validação, progresso, importador
XLSX, ExerciseDefinition, repositórios, attempts e schemas Supabase não foram
alterados.

## Conferência do LAB 1

O teste importa o arquivo local `Laboratorio_1_Qualidade_Correcao_de_Erro.xlsx`
de Downloads, quando `BI_SOCIETY_CHART_REGRESSION_PATH` está configurada. Sem a
variável, usa a fixture equivalente de gráficos já versionada em código.
Cria um **Curso Teste Completo** isolado, cadastra a atividade **LAB 1** e usa os
formulários existentes para publicar e liberar o acesso. Nenhum curso hospedado
ou navegador pessoal é alterado.

Confere Gabarito e seu gráfico, troca todas as abas (Laboratório, Prática e
Gabarito no arquivo real), alterna modos, abre os previews e o Learn como aluno,
sai/reabre a atividade e exige a preferência restaurada. O harness verifica
também drag/teclado, limites, reset independente, leitura/storage bloqueados,
referências de fórmula por clique, permanência da instância/seleção e contagem
de chamadas de salvamento antes/depois de ajustes exclusivamente visuais.

Capturas em `test-results/`:

- `lab-view-learn-desktop-1440.png`
- `lab-view-learn-fullscreen-1440.png`
- `lab-view-learn-mobile-390.png`
- `lab-view-mobile-390.png`
- `lab-view-fullscreen-mobile-390.png`

As capturas desktop/mobile de tela cheia foram inspecionadas. Os testes de
mobile exigem ausência de overflow horizontal da página; a planilha mantém
seu próprio scroll horizontal para colunas que não cabem.

## Arquivos

| Área | Arquivos |
| --- | --- |
| Layout compartilhado e alça | `components/spreadsheet/LabView.tsx` |
| Preferência e limites | `lib/spreadsheet/labViewPreference.ts` |
| Integração | `components/storage/ExerciseLab.tsx`, `components/spreadsheet/SpreadsheetEditor.tsx`, `components/studio/editor/StudioLabEditor.tsx` |
| Estilo | `app/globals.css` |
| Testes | `tests/lab-view-preference.spec.ts`, `tests/lab-view-ui.spec.ts`, `tests/lab-view-course-ui.spec.ts`, `tests/accessibility.spec.ts` |

O teste histórico do cabeçalho passa a exigir os três novos botões entre reset
e barra de fórmulas, nos dois sentidos de Tab. As verificações anteriores de
grade → aba ativa → Verificar respostas e retorno à célula foram mantidas.
A primeira suíte completa identificou a alça como uma parada adicional no
retorno à grade; o ajuste retirou essa parada sem alterar a navegação da planilha.

## Reproduzir

Com Node/npm no PATH, Chromium do Playwright instalado e configuração demo de
preview interno:

```powershell
$env:NEXT_PUBLIC_DATA_MODE = "demo"
$env:BI_SOCIETY_ALLOW_DEMO_PREVIEW = "1"
npm.cmd run typecheck
npm.cmd run build
npm.cmd start -- --hostname localhost --port 3001
```

Em outro terminal:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
$env:BI_SOCIETY_CHART_REGRESSION_PATH = "D:\caminho\laboratorio_1.xlsx"
npm.cmd test -- --workers=2
```

Nesta sessão foi usado Node portátil em `.tools/node-v24.22.1-win-x64`,
`PLAYWRIGHT_BROWSERS_PATH` apontando para `.tools/playwright-browsers` e harness
na porta 3002, como nas verificações anteriores. As flags demo são somente para
o preview interno local.

## Resultados em 25/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2`, preview de produção local | **400 aprovados, zero falhas**, em 4,8 minutos: 390 anteriores e 10 novos, incluindo integração Supabase controlada. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração de preview demo interno. |
| Teclado e controles de tamanho | 21 testes direcionados aprovados antes da repetição completa; navegação histórica preservada e novos controles acessíveis. |
| Curso Teste Completo → LAB 1 → Gabarito | Arquivo real local importado; modos disponíveis no Studio, previews e Learn, todas as abas funcionando e preferência preservada ao reabrir. |
| Desktop/mobile | Capturas de tela cheia 1440/390 px e Learn mobile inspecionadas; sem overflow horizontal da página nos testes. |
| Autosave/reset | Ajustes somente visuais não geram chamadas adicionais de save; reset de respostas mantém a altura personalizada. |

`test-results/.last-run.json` registra `passed`, sem testes falhos. Nenhuma
dependência ou lockfile foi alterado. Os servidores temporários foram encerrados.
A verificação de navegador foi realizada com Chromium; disponibilidade da API
nativa depende do navegador, com fallback CSS coberto por testes de ausência e
recusa. Preferências permanecem locais ao navegador/origem, sem sincronização
entre dispositivos ou separação por conta.
