# Padrão de navegação interna dos capítulos

Este arquivo não existia no checkout ao iniciar a aplicação do padrão ao curso
principal. Foi criado para consolidar a referência solicitada. A implementação
anterior está documentada em `AJUSTE_NAVEGACAO_CAPITULO.md`.

## Contrato existente

`ActivityDraft.navigationGroup` associa atividades ao catálogo já implementado:

| Grupo | Tipo | Navegação |
| --- | --- | --- |
| `video-lesson` | `video` | A. Video Aula |
| `video-application` | `video` | B. Video Aplicação |
| `laboratory` | `spreadsheet-exercise` | C. Laboratório → C.1, C.2… |

`chapterNavigation` e `ChapterActivityNavigation` continuam sendo os únicos
responsáveis pela apresentação. Não foram alterados nesta tarefa. Títulos reais
continuam disponíveis; texto, material e avaliação aparecem como complementos
D/E/… sem conversão de tipo. Não há limite rígido de seis Labs. Grupos sem
atividades são omitidos, conforme o comportamento já validado.

## Aplicação ao neural-demo

Somente `data/courses/neural-demo.ts` foi modificado no código da aplicação.
`data/courses/chapter-navigation-demo.ts` foi analisado e preservado.

- **Fundamentos:** o vídeo `intro-video` recebeu `video-lesson`, mantendo o título
  específico Boas-vindas à engenharia aplicada no conteúdo/subtítulo da sidebar.
  Um segundo vídeo demonstrativo usa `video-application`. Seis atividades com IDs
  `fundamentos-lab-1` a `fundamentos-lab-6` usam `laboratory` e os títulos Lab 1–6.
  O texto e o roteiro anteriores permanecem como complementos D e E.
- **Correção de Erro:** vídeos demonstrativos A/B, o Lab original `neural-lab`
  em C.1 e o contexto industrial como complemento D. O Lab e o contexto mantêm
  seus IDs, conteúdos e obrigatoriedade anteriores.
- **Aplicação Industrial:** vídeos demonstrativos A/B, interpretação e reflexão
  como complementos D/E. Não foi inventado um Lab para este capítulo; o grupo C
  não aparece enquanto não houver atividade de laboratório configurada.

Vídeos adicionais são placeholders com URLs de exemplo, sem mídia real carregada
automaticamente. Os seis Labs de Fundamentos reutilizam a definição neural
existente; são práticas demonstrativas do mesmo exercício, não seis novos
exercícios pedagógicos. Todos começam com o mestre sem respostas do aluno.

## Identidade, progresso e persistência

Cada Lab tem ID exclusivo. A chave de tentativa existente combina curso,
capítulo e atividade, isolando respostas, fórmulas, avaliação e salvamento mesmo
quando a definição é compartilhada. Não se copiaram sessões ou respostas.

As práticas repetidas e os vídeos adicionais são opcionais. Foram preservadas
exatamente as seis obrigatórias anteriores: `intro-video`, `intro-text`,
`lab-context`, `neural-lab`, `industrial-text` e `reflection`. Assim não se exige
repetir seis vezes o mesmo exercício para liberar o capítulo. O contador do
grupo C inclui suas práticas concluídas; o percentual do curso continua sendo
derivado das obrigatórias, conforme a regra existente. Aprovar um Lab opcional
de Fundamentos aumenta a contagem de C, sem aumentar esse percentual.

Não foram alterados StudentCourseProgress, CourseAccessPolicy, ExerciseLab,
ExerciseDefinition, avaliador, autosave, fórmulas, proteção ou o cálculo do
progresso. A visão geral mantém seus componentes, três capítulos, títulos,
descrições, jornada, estados e seis obrigatórias. Recolher/expandir a sidebar
continua usando a implementação anterior.

## Testes e reprodução

Os cinco cenários de navegador antes aplicados somente ao
`chapter-navigation-demo` agora também rodam no `neural-demo`: A/B/C, seis Labs,
expansão por teclado, foco, aprovação real, recuperação de fórmula/nota,
isolamento entre C.1 e C.2, proteção, localStorage preservado, visão geral e três
viewports. Um novo caso de modelo confere configuração, IDs únicos e a lista
exata de obrigatórias preservadas.

Testes anteriores que usavam a posição antiga B para texto/Lab foram adaptados
para D/C.1. O cenário de teclado continua verificando Próxima atividade, agora
A → B Video Aplicação, e também alcança o texto D por teclado. O caso legado do
helper usa as três atividades originais com metadata removida apenas na fixture
do teste. Nenhum cenário, asserção de proteção, nota, bloqueio, progresso,
persistência ou timeout foi removido ou afrouxado.

Para conferir manualmente:

1. Execute `npm.cmd run dev`.
2. Abra `http://localhost:3000/learn/neural-demo/chapter/fundamentos`.
3. Veja A. Video Aula, B. Video Aplicação e C. Laboratório → C.1–C.6.
4. Edite C.1 e aguarde Salvo. Abra C.2: sua tentativa começa vazia. Volte a C.1:
   fórmula e avaliação confirmadas permanecem na mesma sessão.
5. Recolha/expanda C e a sidebar inteira. Volte à visão geral: somente capítulos
   aparecem. Conclua as obrigatórias originais para confirmar o desbloqueio.

Continuam os limites da POC: memória por sessão, perda após refresh, necessidade
de aguardar Salvo antes de navegar, vídeos demonstrativos e avaliação no cliente.
Nenhuma dependência foi instalada ou etapa funcional posterior iniciada.

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| Casos focados de navegação, aluno e visão geral | 51 aprovados, 0 falhos. |
| `npm test -- --workers=2` | **214 aprovados, 0 falhos**; 208 anteriores + 6 novos; aproximadamente 3,7 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas e endpoints. |
| Visual | 1440×1000, 1366×768 e 1024×768 inspecionados; A/B/C, indentação dos Labs, foco e recolhimento preservados. |
| Isolamento e progresso | C.1 aprovado/recuperado, C.2 vazio, contador 1/6, seis obrigatórias originais e conclusão do curso preservados. |

Execução com Chrome e renderização por software, aplicação compilada na porta
temporária 3001 e harness existente na 3002. Servidores temporários encerrados,
sem alterar o servidor ou a sessão do usuário na porta 3000. Capturas em
`test-results/neural-demo-chapter-navigation-{1440,1366,1024}.png`.

## Blocos expansíveis

Na área principal do capítulo, o cabeçalho inteiro de cada atividade é um botão
nativo. Clicar no título, no prefixo ou no chevron alterna o conteúdo. O controle
anuncia Abrir/Recolher bloco A/B/C.x, `aria-expanded` e `aria-controls`; o título
mantém nome acessível próprio e recebe foco na navegação. O chevron ▼/▶ é apenas
complemento ao texto. Enter e Space usam o comportamento nativo, com foco visível.
Não há animação de conteúdo, portanto não há movimento a reduzir.

`ChapterActivitySection` separa atividade selecionada de atividade expandida.
`ChapterPlayer` guarda um mapa React por ID: A e B podem ficar abertos juntos,
assim como vários Labs. A atividade inicial começa aberta; as demais começam
recolhidas. Fechar um bloco não conclui, não muda seleção, nota, progresso ou
bloqueios. Concluir atividade continua dentro do conteúdo, que sai do percurso
de teclado e da leitura acessível quando recolhido. O cabeçalho permanece compacto.

O grupo C também aparece na área principal, por `ChapterLaboratorySection`,
com botão próprio e contador derivado das conclusões existentes. Recolhê-lo
oculta seus Labs sem alterar o estado individual de expansão. Os Labs abertos
voltam abertos ao expandir C. Se não há Labs configurados, não se cria o grupo.
Não foi alterada a estrutura ou o comportamento da sidebar.

Selecionar uma atividade pela sidebar ou por Anterior/Próxima a expande, seleciona
e foca seu título, trazendo-o à área visível pelo comportamento de foco do
navegador. Selecionar novamente a atividade atual também reabre seu bloco. Para
um Lab, o grupo C da área principal é aberto automaticamente. Os outros blocos
conservam seus estados. O recolhimento da sidebar inteira continua independente.

### Labs e autosave

Cada conteúdo é montado somente na primeira abertura. Depois disso, permanece
montado sob `hidden`, inclusive ao selecionar outra atividade ou recolher C.
Assim a instância do editor, workbook, seleção, aba, avaliação e rascunho não
são destruídos ao recolher. A confirmação por blur já existente continua ocorrendo
ao sair do campo para clicar no cabeçalho; o debounce continua em 750 ms.
O teste recolhe com fórmula ainda no campo e confirma preservação e salvamento.

Não foram alterados os contratos de curso/progresso/exercício, dados do curso,
repositório, controlador, critérios de avaliação, proteção, importação ou Studio.
Fechar a rota continua encerrando seus componentes, com os limites de salvamento
da sessão já documentados. Expandir/recolher não é persistido em nenhum storage;
refresh ou uma nova montagem do capítulo restabelecem a apresentação inicial.

### Identificadores acessíveis de instância

Manter dois Labs montados revelou a necessidade de isolar os identificadores
HTML antes fixos. `LabDomScope` fornece um prefixo React `useId` somente na
composição do capítulo. Abas/painéis, descrição das células, barra de fórmulas,
ajuda, títulos de avaliação, gráficos e dialog usam IDs correspondentes por
instância. O foco das setas nas abas procura o ID da própria instância.

Essas alterações são exclusivamente de markup/ARIA nos componentes compartilhados.
Em ExerciseLab mudou apenas o identificador HTML do título: nenhuma rotina de
carga, edição, reset, nota ou persistência foi modificada. Fora desse provider,
os IDs anteriores permanecem iguais. Não se usam esses prefixos para identidade
de exercício ou tentativa. A regressão com dois Labs verifica IDs sem duplicatas,
descrições diferentes de F2, foco na aba correta e dialog com Cancelar/Esc/retorno.

### Verificação dos blocos

Sete casos novos cobrem A/B independentes, clique no título, Enter/Space,
conteúdo compacto, C, Lab recolhido com fórmula pendente, preservação da instância,
autosave, dois Labs abertos, IDs/ARIA, abas, dialog, sidebar, Anterior/Próxima,
progresso inalterado, visão geral, refresh e três viewports. Os testes anteriores
foram ajustados para localizar os controles dentro da atividade selecionada,
pois várias atividades podem agora oferecer os mesmos controles simultaneamente.
As asserções de conteúdo, nota, proteção e recuperação foram mantidas.

Na primeira execução focada, seletores globais antigos encontraram múltiplos
controles, como esperado com a nova UX. A atualização dos seletores também foi
corrigida para distinguir a preparação no editor do professor da execução no
capítulo. Um teste novo foi ajustado ao texto acessível existente “Célula vazia”,
sem modificar a descrição da aplicação. Nenhum timeout foi aumentado.

### Arquivos deste ajuste

- `components/learn/ChapterPlayer.tsx`, `ChapterActivitySection.tsx`,
  `ActivityRenderer.tsx` e novo `ChapterLaboratorySection.tsx`.
- `app/learn/learn.css`, somente regras dos blocos da página interna.
- Novo `components/spreadsheet/LabDomScope.tsx` e consumo de IDs nos componentes
  SpreadsheetEditor, FormulaBar, SheetTabs, ExerciseLab, ResetExerciseButton,
  ExerciseValidationSummary e WorkbookLineChart.
- Novo `tests/chapter-collapsible.spec.ts`; seletores de testes de capítulo,
  navegação, aluno, sidebar e visão geral ajustados ao conteúdo simultâneo.
- Este documento. Nenhuma dependência instalada.

Para conferir, abra Fundamentos, clique nos títulos A e B e deixe ambos abertos.
Abra C.1, edite uma célula e recolha/expanda seu cabeçalho ou C: o conteúdo deve
permanecer. Abra C.2 para ver as duas tentativas separadas. Selecione pela sidebar
e use Anterior/Próxima para confirmar expansão/foco. O progresso só muda pelas
ações de conclusão e aprovação anteriores.

Conteúdos visitados ocupam memória até sair do capítulo; capítulos com muitos
Labs abertos podem consumir mais recursos. Vídeos já carregados permanecem
montados; recolher não adiciona uma nova política de pausa/reprodução. Continuam
os limites de persistência em memória e de avaliação no cliente. A visão geral
e a sidebar não receberam alterações nesta entrega.

### Resultado final dos blocos expansíveis

| Verificação | Resultado |
| --- | --- |
| Casos focados após ajustes dos seletores | 30 aprovados, 0 falhos. |
| `npm test -- --workers=2` | **221 aprovados, 0 falhos**; 214 anteriores + 7 novos; aproximadamente 3,4 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas e endpoints. |
| Visual | 1440×1000, 1366×768 e 1024×768 inspecionados; A/B simultâneos, cabeçalhos compactos, grupo C e Labs individuais. |
| Preservação | Mesma instância ao recolher, rascunho confirmado por blur, autosave, dois Labs isolados, abas/dialog corretos e IDs sem duplicatas. |

Chrome com renderização por software, produção temporária na porta 3001 e
harness existente na 3002. Servidores temporários encerrados; servidor e sessão
do usuário em 3000 preservados. Capturas em
`test-results/chapter-collapsible-{1440,1366,1024}.png`, além dos recortes do grupo
`chapter-collapsible-labs-{1440,1366,1024}.png`. Recortes de elementos altos podem
incluir o header sticky na posição de rolagem; as capturas da viewport são a
referência para o layout da página. Nenhuma dependência instalada.
