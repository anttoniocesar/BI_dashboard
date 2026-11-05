# Navegação contextual do Lab

## Causa

O link inicial de `/studio/import` era literalmente `href="/"`, com o rótulo
**Voltar ao Lab**. A raiz abre a planilha de experimentação, cujo cabeçalho não
tinha saída. O editor também dependia de dois caminhos guardados somente no
estado do Studio; atualizar a página perdia a origem.

## Comportamento

| Origem / tela | Retorno |
| --- | --- |
| Importação sem contexto | **Voltar ao Studio** → `/studio/courses` |
| Biblioteca → Editor | **Voltar aos exercícios** → `/studio/courses` |
| Curso → Editor ou Importar Excel | **Voltar ao curso** → ID físico do curso de origem |
| Preview do curso → Importar Excel → Editor | **Voltar ao preview** → preview daquele curso |
| Importação independente → preview → Editor | **Voltar ao preview** → preview da importação; este oferece retorno ao Studio e à revisão |
| Simulação/teste do Editor | Retorna ao mesmo Editor, mantendo sua URL de origem |
| Learn → Lab incorporado | **Voltar ao capítulo** → cabeçalho do mesmo capítulo, sem sair da atividade |
| Demo `/` | Professor: **Ir para Studio**; aluno: **Ir para meus cursos**; Admin: **Ir para Admin**; sem sessão: **Entrar na BI.Society** |

Os links da barra de cursos e do formulário de atividade também incluem a
origem quando ela é um curso ou preview conhecido. Cancelar/reiniciar a seleção
do arquivo não apaga a origem da URL. O fluxo não associa automaticamente um
exercício recém-importado à atividade.

## Contrato e segurança

Exemplo: `/studio/editor?returnTo=%2Fstudio%2Fcourses%2Fcourse-123`.

`safeLabReturn` permite somente rotas conhecidas de cursos/importação do Studio,
Learn e Admin. Rejeita raiz, hosts externos, URLs com protocolo, barras invertidas,
controles, traversal, caminhos codificados que não correspondam às rotas e
parâmetros arbitrários. A jornada rejeita parâmetros `returnTo` duplicados.
Contexto aninhado é limitado e validado recursivamente nas rotas de importação.
Os destinos são construídos com `URLSearchParams`.

Destino ausente/inválido usa `/studio/courses`. A toolbar valida novamente o
caminho recebido. A validação de navegação não concede acesso: os guards e as
permissões existentes continuam sendo aplicados à rota de destino.

O contexto está na URL, sem dependência de histórico do navegador, referrer,
localStorage ou estado de retorno compartilhado entre abas. Os dois campos
antigos de retorno em memória foram removidos de `StudioSession`.

## Refresh, foco e mobile

Refresh conserva `returnTo`, inclusive no editor vazio e no preview sem dados.
O exercício salvo continua sendo recuperado pelo mecanismo existente da
biblioteca. Arquivo, análise e rascunho ainda não salvo continuam temporários;
preservar a origem não persiste esses dados. O preview do curso pode reiniciar
sua seleção temporária ao ser reaberto.

Links têm nomes explícitos e funcionam por teclado. O retorno ao curso usa seu
foco existente no título; a biblioteca foca **Meus cursos**; o retorno do Lab no
Learn foca o título do capítulo. Simulações mantêm o retorno ao Editor.
O cabeçalho do demo cresce e quebra linha para manter a saída visível em mobile;
o foco do novo link é visível.

## Arquivos

- `lib/navigation/labReturn.ts`: validação, montagem de URL e rótulos.
- `components/navigation/StudioImportLink.tsx`, `DemoLabExit.tsx`: entradas e saída.
- `components/studio/import/ImportJourney.tsx`, `StudioImportPage.tsx`,
  `ImportLabPreview.tsx`: propagação do contexto e retornos.
- `components/studio/editor/StudioLabEditor.tsx`, `StudioToolbar.tsx`: retorno
  explícito, inclusive sem rascunho.
- `components/studio/courses/CourseEditor.tsx`, `ExerciseLibrary.tsx`,
  `ReplaceActivityExercise.tsx`, `ActivityForm.tsx`, `CourseList.tsx`,
  `app/studio/courses/layout.tsx`: origem e foco.
- `app/studio/layout.tsx`: Suspense para leitura da query no cliente, conforme
  a documentação instalada do Next.js.
- `app/page.tsx`, `app/globals.css`: saída do demo e ajuste de cabeçalho.
- `components/learn/ActivityRenderer.tsx`, `ChapterPlayer.tsx`: retorno local ao
  título do capítulo.
- `tests/lab-navigation.spec.ts`: 13 testes novos. As regressões anteriores
  aceitam a query no editor, exigem rótulos contextuais e verificam o novo link
  na ordem de Tab do demo.

Não houve mudanças no importador XLSX, gráficos, fórmulas, ExerciseDefinition,
autosave, CourseAccess, progresso, autenticação, dependências ou migrations.

## Resultado em 26/10/2026

| Verificação no build final | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **478 aprovados, zero falhas**, em 5,7 minutos: 465 anteriores e 13 novos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno. |
| Navegação | Importação, biblioteca, curso, preview, simulação, refresh, editor vazio, destinos externos e fallback aprovados. |
| Teclado e Learn | Link de saída participa da ordem de Tab; diálogo de reset preserva foco; retorno do Lab foca o capítulo e mantém a atividade. |
| Mobile 390 px | Retornos visíveis no demo, importação, preview e Editor; sem overflow horizontal da página nos testes. |

Capturas em `test-results/`: `lab-navigation-demo-teacher-mobile.png`,
`lab-navigation-demo-student-mobile.png` e `lab-navigation-editor-mobile.png`.
As capturas de aluno e Editor foram inspecionadas. As regressões históricas
foram ajustadas para exigir os novos nomes de retorno e a ordem de Tab com a
saída do demo, mantendo as verificações anteriores de merges e foco.

Os testes usaram Node portátil em `.tools/node-v24.22.1-win-x64`, Chromium em
`.tools/playwright-browsers` e preview de produção local na porta 3001. As duas
variáveis de regressão apontaram para os XLSX originais dos LABs 1 e 2 em
Downloads. Não houve alteração de cursos hospedados ou perfil pessoal.
`test-results/.last-run.json` registra `passed`. Servidores temporários
encerrados após a validação.

Permanecem os limites existentes: a URL preserva navegação, sem recuperar
importações não salvas nem persistir a seleção temporária do preview. Rotas
novas precisam ser incluídas explicitamente na lista de destinos permitidos.
