# Etapa 14 — BI.Society Studio Lab Editor

Escopo: primeira autoria pedagógica, em memória. Nenhuma dependência instalada.
A página do aluno em `/`, sua sessão local e a preview da Etapa 13 permanecem.
Não foram adicionados publicação, autenticação ou persistência remota.

## Fluxo e layout

`/studio/import` → revisar → abrir no Lab → **Abrir no Studio Editor** →
`/studio/editor`. O layout compartilhado `app/studio/layout.tsx` mantém a jornada
em memória entre importação, preview e editor. Entrar diretamente no editor ou
recarregar mostra orientação para importar novamente.

Cabeçalho com BI.Society Studio, Professor, título, Rascunho e versão `0.1-draft`.
Ações: Voltar, Visualizar como aluno, Testar exercício e Salvar rascunho.
A área principal coloca a planilha à esquerda e Configuração da célula à direita.
Abas continuam no rodapé da própria grade; não há criação, exclusão ou renomeação.
Layouts desktop verificados em 1440×1000 e 1024×768; a grade tem rolagem própria.

## Mesma grade, modo author

`SpreadsheetEditor` recebe `mode: "student" | "author"`, com padrão student.
Não existe uma segunda implementação da grade, parser, clipboard ou teclado.
No modo author, o resolvedor de escrita mantém o papel da célula e permite
edição pelo professor. O resolvedor e a guarda do aluno continuam protegendo
provided/calculated, inclusive barra de fórmulas, exclusão e colagem.

Callbacks de conteúdo confirmado e seleção conectam o editor ao draft. Conteúdo
permanece texto original, incluindo expressões com `=`; cálculo e gráficos vêm
do mesmo motor. Enter, Tab nos limites, setas, F2, Esc e copiar/colar uma célula
mantêm os comportamentos anteriores. Alterações por blur também são confirmadas.
As ações de salvar/visualizar/testar consultam uma ref com o snapshot bruto mais
recente, incluindo edição em andamento. Isso evita capturar o conteúdo anterior
enquanto a confirmação por blur ainda está sendo propagada ao estado do pai.
Não foram adicionadas funções Excel, seleção múltipla, colagem de matriz ou undo.

No professor, provided usa azul/cinza, calculated cinza, editable amarelo e answer
laranja claro. Verde/vermelho e painel de verificação aparecem apenas na simulação
do aluno. Descrições acessíveis informam papel, conteúdo, proteção do aluno e
permissão de edição do professor, sem depender somente das cores.

## ExerciseDraft e conversão

`types/exercise-draft.ts` define autoria com workbook mutável e o mesmo contrato
de regras, gráficos, dimensões, metadata e conclusão. `importedWorkbook` guarda
uma cópia dos metadados normalizados selecionados na importação, inclusive estilos,
larguras, alturas, mesclagens e inventário de gráficos não convertidos.
As mesclagens também fazem parte do workbook estrutural e são renderizadas no
Editor e nas simulações pelo mesmo componente do Lab; veja
[Células mescladas](AJUSTE_CELULAS_MESCLADAS.md) para seleção, edição e teclado.

`lib/studio/exerciseDraft.ts` fornece:

- `createDraft(definition, importedWorkbook?)`: valida a entrada e cria cópias
  independentes; nunca edita o objeto readonly ou o XLSX original.
- `applyDraftRole(draft, sheetId, range, role)`: valida limites e aplica overrides
  em `cellRules.cells`, usando a precedência do resolvedor existente.
- `buildDefinition(draft, student?)`: copia, chama `validateExerciseDefinition`
  e congela o novo mestre. Metadata de importação fica no draft, fora do descriptor.

Gráficos declarativos já configurados são copiados integralmente e continuam
recalculando na mesma grade. Gráficos apenas inventariados no XLSX permanecem
metadata, conforme a Etapa 12; não passam a ser renderizados automaticamente.
O snapshot normalizado conserva a origem e seus estilos; as edições de conteúdo
são autoritativas em `draft.workbook`, não um round-trip de XLSX.

## Painel e avaliação

Selecionar uma célula atualiza coordenada/aba no painel. Radios fornecida,
calculada, editável e resposta mapeiam diretamente os quatro papéis existentes.
Fornecida/calculada protegem somente o aluno. O campo Aplicar ao intervalo
aceita uma célula ou retângulo como `F2:F6`, na aba atual. Aplica somente o papel;
esperado, feedback e pontos são individuais. Um intervalo inválido não modifica
o draft. Mudar uma resposta para outro papel remove sua regra de avaliação.

Resposta abre `ValidationConfig`, separado do componente de simulação. Suporta:

- Número com esperado finito e tolerância opcional não negativa; sem tolerância,
  usa a comparação exata existente.
- Texto com a comparação existente, que ignora caixa e espaços externos.
- `requireFormula`: exige expressão e resultado correto, sem igualdade textual
  com uma fórmula de solução.
- Pontos finitos positivos e feedback de erro obrigatório.

**Aplicar avaliação** confirma os campos e valida o descriptor antes de atualizar
o draft e sua pontuação total. Digitação ainda não aplicada no formulário é local
à célula: salvar/testar usa a última configuração aplicada. A ajuda junto ao botão
explica essa confirmação. Trocar de célula descarta campos não aplicados.
Marcar resposta não inventa esperado: até aplicar, ela é editável mas não avaliada.
O corte de conclusão é preservado; importações continuam com o corte provisório
de 100% da Etapa 12. Não há novo avaliador ou editor do corte nesta etapa.

## Visualização como aluno e modo teste

Ambos montam o mesmo `ExerciseLab` com `buildDefinition(draft, true)` e um
`VolatileExerciseRepository` novo por entrada. Todas as células com papel answer
têm seu conteúdo inicial esvaziado, inclusive soluções que o professor deixou
na grade; dados fornecidos, parâmetros editáveis e fórmulas calculadas permanecem.
Painel, esperado, tolerância e configurações privadas não são renderizados.
Feedback e pontuação são apresentados pelo DTO público de avaliação existente.

Testar exercício permite responder, verificar, consultar feedback/nota e sair.
Ao sair, o componente e o repositório temporário são descartados; voltar ao teste
começa novamente sem respostas/cores. O draft, o mestre e a nota do aluno real
não são modificados. Visualizar como aluno oferece a mesma interação de aluno,
com identificação própria para distinguir a finalidade da simulação.

Esta separação é de componentes e apresentação na POC cliente. Não fornece sigilo
contra inspeção de memória/DevTools: a avaliação local ainda precisa das regras.
Avaliação privada e autorização de servidor permanecem fora do escopo. O professor
também deve evitar escrever soluções explícitas em células fornecidas ou feedback,
que são conteúdo público por definição.

## Salvar e estado temporário

Alterações aplicadas ficam no estado React da jornada. Salvar rascunho valida e
guarda uma cópia independente em `savedAuthorDraft`. A comparação com o draft atual
mostra Alterações não salvas ou Rascunho salvo. Voltar à preview de importação e
reabrir o editor conserva conteúdo e configuração da autoria. Essa preview de
importação continua mostrando sua fonte; a preview de autoria usa os botões do editor.

Nada é gravado no localStorage/sessionStorage do aluno, em disco ou banco. Refresh,
sair do Studio, cancelar a importação ou importar outra planilha descarta o rascunho.
Salvar não significa publicação, download ou garantia de recuperação posterior.

## Arquivos

Criados:

- `app/studio/layout.tsx`, `app/studio/editor/page.tsx` e `editor.css`.
- `types/exercise-draft.ts`, `lib/studio/exerciseDraft.ts`.
- `components/studio/editor/StudioLabEditor.tsx`, `StudioToolbar.tsx`,
  `CellConfigPanel.tsx`, `ValidationConfig.tsx`, `ExercisePreview.tsx`.
- `tests/studio-editor-model.spec.ts`, `tests/studio-editor-ui.spec.ts`.
- Este documento.

Modificados: `SpreadsheetEditor.tsx` (modo/callbacks), `ImportJourney.tsx` (autoria
em memória), `ImportLabPreview.tsx` (entrada), `app/studio/import/layout.tsx`
(provider elevado ao layout Studio), `FileDropzone.tsx` (ativação explícita por
Enter/Space, sem duplicar a abertura nativa) e README. A entrada no editor foi
colocada após as ações anteriores da preview para preservar sua ordem de foco.
Nenhuma dependência foi instalada.

## Testes e uso manual

Os testes novos cobrem cópias/congelamento, descriptor válido, regras por intervalo,
limites, preservação de gráficos/metadados, tolerância/texto e dados do aluno;
edição na grade/barra, fórmulas, clipboard, exclusão, navegação, papéis, expected,
tolerância, requireFormula, pontos, feedback, simulação, nota, descarte, salvamento,
retorno entre rotas, isolamento do storage, teclado, foco e layout.
Há também regressões de salvar durante edição ainda não confirmada e abrir o
seletor nativo uma única vez com Space; o teste anterior de Enter foi preservado.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **147 aprovados, 0 falhos**; 133 anteriores + 14 novos; aproximadamente 2,1 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; nova rota estática `/studio/editor`, sem novos endpoints. |
| Layout e teclado | 1440×1000 e 1024×768, foco visível e ausência de transbordamento horizontal da página. |
| Isolamento | Respostas simuladas descartadas; autoria/mestre preservados; chave local do aluno inalterada. |

A suíte final usou Chrome sobre o build de produção na porta temporária 3001 e
harness na 3002, com `PLAYWRIGHT_BASE_URL=http://localhost:3001`. Os servidores
temporários foram encerrados ao terminar. Nenhum teste anterior, asserção ou
timeout foi removido ou afrouxado. Capturas inspecionadas em
`test-results/etapa-14-editor-{1440,1024}.png`.

As execuções intermediárias revelaram o salvamento com blur ainda em propagação,
agora coberto pelo snapshot e regressão explícita, e problemas de acionamento do
seletor, cobertos por Enter/Space. O novo teste de retorno ao editor aguarda a
navegação antes de selecionar células; o de Space confirma o foco antes de acionar
o botão. A execução completa final passou sem retries nem aumento de timeouts.

Para testar manualmente:

1. Execute `npm run dev` e abra `http://localhost:3000/studio/import`.
2. Importe `tests/fixtures/xlsx/controlled.xlsx`, revise, abra no Lab e clique
   Abrir no Studio Editor.
3. Edite A1 ou uma fórmula diretamente/pela barra; alterne abas.
4. Em Dados base!A3, marque Resposta, esperado 30, tolerância 0.005, fórmula
   obrigatória, 10 pontos e feedback. Clique Aplicar avaliação.
5. Salve o rascunho. Testar exercício deve abrir A3 vazia, com A1/B1 protegidas.
   Insira `=A1+B1`, verifique e observe 10/10, caso A1/B1 mantenham 10 e 20.
6. Saia do teste e reabra: respostas da simulação foram descartadas. Voltar à
   importação e reabrir o editor mantém a autoria durante a mesma jornada.

## Limitações preservadas

Sem publicação, banco, autenticação, cursos, capítulos, alunos, colaboração,
histórico, versionamento real, editor de gráficos ou editor completo de estilos.
Estilos importados são preservados como metadata e não renderizados integralmente.
Acessibilidade básica foi verificada com Chrome, sem certificação nem teste com
leitor de tela real. Limites de fórmulas, clipboard e importação anteriores permanecem.
