# Etapa 16 — Ambiente do aluno

Primeira experiência de curso no BI.Society Academy: visão geral, percurso por
capítulos e atividades, incluindo o mesmo Lab existente. Nenhuma dependência
adicionada. Não há publicação, autenticação, matrícula, backend novo ou progresso
remoto. A página `/` e sua recuperação em localStorage permanecem independentes.

## Rotas e fontes

| Rota | Conteúdo |
| --- | --- |
| `/learn/neural-demo` | Curso demonstrativo, disponível diretamente. |
| `/learn/[courseId]` | Visão geral de um CourseDraft da sessão ou da demonstração. |
| `/learn/[courseId]/chapter/[chapterId]` | Ambiente de estudo de um capítulo disponível. |

As páginas aguardam `params` antes de entregar IDs aos componentes cliente,
conforme o Next instalado. Não foram criados endpoints ou identificadores em
storage para recuperar cursos. Endereços desconhecidos mostram orientação e
acesso à demonstração; capítulos inexistentes/bloqueados oferecem volta ao curso.

No editor de curso do Studio, **Abrir como aluno** navega para o curso confirmado
na sessão. A preview **Visualizar estrutura do curso** anterior continua existindo.
Campos de metadata ainda não confirmados em Salvar dados do curso não substituem
os dados da experiência do aluno.

O provider de dados `StudioSessionProvider` foi elevado ao layout raiz para
compartilhar cursos/biblioteca entre Studio e `/learn` na navegação cliente.
`LearnSessionProvider` mantém progresso e repositório volátil no mesmo ciclo de
vida. Não renderiza componentes de autoria. Voltar pelo navegador ao curso do
Studio conserva sua estrutura. Atualizar/fechar a página recria ambos os estados.
A jornada de importação não salva continua restrita ao layout Studio: sair desse
escopo descarta o arquivo e a edição ainda não registrada na biblioteca.

## Tela 1 — Visão geral

Cabeçalho BI.Society Academy, perfil demonstrativo Aluno, título, descrição,
carga horária, quantidade de capítulos, objetivo e progresso geral. O espaço de
abertura é um placeholder explícito, sem player ou serviço externo automático.

`CourseJourney` mostra cards conectados com número, título, descrição, status e
quantidade/percentual de obrigatórias concluídas. Checkpoints disponíveis são
links nativos; bloqueados são texto, sem links que permitam contornar o bloqueio.
Concluído/Atual/Disponível/Bloqueado e o símbolo de conclusão complementam as cores.
Começar/Continuar estudos abre o primeiro capítulo disponível ainda incompleto;
curso concluído permite revisitar o percurso.

## Tela 2 — Capítulo

Título e descrição do capítulo, sidebar de capítulos e atividades, atividade
atual, obrigatoriedade, estados textuais e progresso. A navegação anterior/próxima
atividade não marca conclusão implicitamente. A sidebar permite revisitar
conteúdos e capítulos disponíveis.

| Tipo existente | Apresentação e conclusão |
| --- | --- |
| `video` | Player HTML5 para URL HTTPS de `.mp4`, `.webm` ou `.ogg`, somente após Carregar vídeo. Sem autoplay. URLs incompatíveis e erros do player mostram metadata demonstrativa. Conclusão manual. |
| `text` | Texto simples com quebras de linha; React escapa o conteúdo, sem HTML arbitrário. Conclusão manual. |
| `material` | Descrição, referência de arquivo e link externo apenas se HTTP/HTTPS absoluto, sem credenciais. Nova aba com noopener/noreferrer. Não há arquivo hospedado/upload/download próprio. Conclusão manual. |
| `assessment` | Reflexão/placeholder com descrição e conclusão manual, sem novo avaliador. |
| `spreadsheet-exercise` | Mesmo ExerciseLab, definição associada e proteção real; conclusão somente por aprovação do avaliador existente. |

Não há iframe arbitrário nem execução de URL de vídeo ao abrir uma atividade.
Carregar um vídeo é uma ação explícita e pode solicitar o arquivo ao servidor
externo informado. A compatibilidade por extensão/protocolo não garante codec,
disponibilidade ou reputação de uma origem. O curso demonstrativo usa fallback
de metadata e não requer serviço de mídia. Materiais externos são abertos somente
por ação do aluno; links da demonstração são exemplos.

Curso sem capítulos, capítulo sem atividades e exercício ausente na biblioteca
têm mensagens próprias. Um Lab ausente não recebe botão de conclusão manual.

## Progresso e conclusão

`types/student-progress.ts` representa o estado mínimo:

```ts
type StudentCourseProgress = {
  courseId: string;
  completedActivities: string[];
  currentChapterId: string | null;
};
```

`lib/learn/progress.ts` contém funções puras. Capítulos concluídos, percentuais,
contagens, status e disponibilidade são derivados, evitando listas duplicadas.
IDs e `order` vêm dos modelos da Etapa 15, sem alterar CourseDraft ou adicionar
campos de curso a ExerciseDefinition.

- Cada obrigatória concluída conta uma vez. Concluir novamente é idempotente.
- Opcionais podem ser concluídas, mas não entram no denominador nem bloqueiam.
- Capítulo não vazio conclui quando todas as obrigatórias estão concluídas.
- Capítulo contendo somente opcionais satisfaz automaticamente essa política.
- Capítulo vazio permanece incompleto, assim como um curso sem capítulos.
- Curso conclui somente quando todos os capítulos concluem. O percentual geral
  usa as obrigatórias; fica no máximo em 99% enquanto houver capítulo incompleto,
  inclusive um capítulo vazio. A decisão não depende do percentual arredondado.
- Por padrão, todos os capítulos anteriores devem estar completos para abrir o
  seguinte. O bloqueio é conferido também no acesso direto à rota.
- `CourseAccessPolicy.sequentialChapters`/`defaultCourseAccess` permitem adotar
  posteriormente navegação livre. A política livre já é coberta por teste puro;
  não foi adicionado um controle de autoria para essa opção.

A conclusão é uma conquista da sessão: revisitar, editar ou reiniciar um Lab já
aprovado não revoga a atividade concluída. A avaliação exibida pelo Lab continua
invalidando/reavaliando suas respostas normalmente. Não há histórico de tentativas,
certificação ou nota oficial de curso. Alterar o curso após começar a estudá-lo
não cria revisão/migração do progresso; essa política de conteúdo dinâmico permanece
fora da POC. Refresh descarta o progresso temporário.

## Integração com ExerciseLab

`ExerciseLab` recebe `onEvaluationChange?: (result: ExerciseValidationResult |
null) => void` e o encaminha ao mesmo editor. O callback comunica o DTO público
já existente quando a avaliação muda, inclusive restauração, invalidação e reset.
Não envia esperado, expressão de gabarito ou tolerância. O avaliador e seus
critérios, pesos e tolerâncias não conhecem cursos e não foram alterados.

`ActivityRenderer` registra conclusão somente quando `result?.completed` é
verdadeiro. Não basta abrir o Lab ou verificar uma tentativa insuficiente. O
critério vem de `definition.completion`, sem outro corte de aprovação de curso.
`embedded` troca apenas o título de marca para h3 na atividade, preservando o h1
do capítulo. A execução padrão em `/` mantém seu cabeçalho anterior.

As definições do Studio passam por `buildDefinition(draft, true)`, o mesmo
conversor da simulação existente: respostas iniciais do professor são esvaziadas,
dados e fórmulas calculadas são mantidos, e o resultado é validado/congelado.
O aluno não recebe painel lateral, expected/tolerância em campos, botões de edição
ou toolbar Studio. Metadados de autoria/importação permanecem fora da definição
de execução. A biblioteca demonstrativa aponta para o exercício neural real,
com seu Modelo Mestre vazio e cinco regras originais.

O repositório é `VolatileExerciseRepository`, distinto de autoria e do adaptador
local do Lab em `/`. A tentativa usa exercício/versão e uma chave estruturada de
curso/capítulo/atividade, isolando respostas mesmo quando atividades usam o mesmo
exercício. Autosave continua com debounce de 750 ms; aguardar **Salvo ✓** antes de
navegar permite recuperar fórmula, aba e avaliação ao revisitar a atividade.
Sair antes da confirmação pode perder o snapshot pendente: não foi inventado
flush remoto/no fechamento, nem alterado o contrato de persistência anterior.

Esta POC avalia no cliente. A separação visual não garante sigilo em DevTools ou
autoridade de nota: as regras continuam necessárias ao avaliador local. Não há
promessa de avaliação privada em servidor nesta etapa. Texto/feedback fornecido
pelo professor é conteúdo público e deve ser preparado como tal.

## Demonstração

`data/courses/neural-demo.ts` fornece CourseDraft e biblioteca de definições:

1. **Fundamentos:** vídeo demonstrativo, texto e roteiro opcional.
2. **Correção de Erro:** contexto industrial e Lab neural real.
3. **Aplicação Industrial:** interpretação e reflexão manual.

São sete atividades, seis obrigatórias. O exemplo começa sem respostas e sem
progresso. As soluções usadas nos testes vêm da fixture existente, sem preencher
o Lab do aluno automaticamente.

## Acessibilidade e layout

Links/botões nativos, foco azul-marinho de 2 px e branco no cabeçalho escuro,
skip link, títulos de curso/capítulo e foco dirigido ao título da atividade após
troca. Sidebar usa `aria-current`, estados textuais e listas ordenadas. Progresso
tem `<progress>` nativo rotulado e quantidade/percentual em texto. Conclusões são
anunciadas sem depender de cor.

Azul-marinho, laranja, branco e cinza preservam a identidade. Texto auxiliar usa
`#52647a`, contornos laranja escurecidos `#a64b16`. Layouts 1440×1000 e 1024×768
mantêm rolagem da planilha dentro da grade e sidebar ao lado. CSS específico
ajusta a densidade do Lab incorporado, sem mudar o visual do Lab em `/`.
Não há certificação de acessibilidade com leitores de tela reais ou otimização
completa para smartphone.

## Arquivos

Criados:

- `app/learn/layout.tsx`, `learn.css`, `[courseId]/page.tsx` e
  `[courseId]/chapter/[chapterId]/page.tsx`.
- `components/learn/`: `LearnSession`, `CourseOverview`, `CourseJourney`,
  `ChapterPlayer`, `ChapterSidebar`, `ActivityRenderer`, `CourseProgress`.
- `lib/learn/progress.ts`, `content.ts`, `types/student-progress.ts`.
- `data/courses/neural-demo.ts`.
- `tests/learn-progress.spec.ts`, `tests/learn-ui.spec.ts` e este documento.

Modificados: layouts raiz/Studio, `CourseEditor`, rodapé do layout de cursos,
ajuda de `StudioLabEditor`, `ExerciseLab`, `SpreadsheetEditor` e README.
Não houve alteração no parser, avaliador, contratos de curso/exercício,
Modelo Mestre, regras neurais ou adaptadores de persistência anteriores.

## Verificação e reprodução

Os testes novos cobrem regras de progresso, sequência/configuração livre,
opcionais/vazios/IDs, URLs, conversão para aluno, curso/capítulo inexistente,
bloqueio por rota, tipos de atividade, aprovação/reprovação do Lab neural real,
gráficos, fórmula/aba/avaliação ao revisitar, conclusão do curso, isolamento do
localStorage, curso e exercício importado da sessão Studio, respostas de autoria
vazias, teclado/foco, layout e refresh sem recuperação fictícia.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **171 aprovados, 0 falhos**; 159 anteriores + 12 novos; aproximadamente 3,3 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; `/` preservada e duas rotas dinâmicas de aprendizado, sem nova API. |
| Lab neural no capítulo | Tentativa vazia não conclui; aprovação, gráficos, recuperação de fórmula/avaliação e conclusão do curso aprovados. Sem erros JavaScript nesse fluxo. |
| Exercício importado do Studio | Célula de resposta da autoria esvaziada, proteção e mesma avaliação de 7/7 aprovadas. |
| Visual e teclado | 1440×1000 e 1024×768, sem transbordamento horizontal da página; capturas de curso, capítulo e Lab inspecionadas. |

A suíte final usou Chrome com renderização por software, aplicação compilada na
porta temporária 3001 e harness existente na 3002. Os servidores temporários foram
encerrados; a porta e a sessão do usuário em 3000 não foram interrompidas ou
apagadas. Nenhum dos 159 testes anteriores, asserções ou timeouts foi alterado,
removido ou afrouxado. A execução final passou sem retries. Não foram instaladas
dependências nem alterado o lockfile nesta etapa.

Uma execução intermediária passou 169 de 170 casos; o único erro estava no novo
teste, que capturava `page.url()` antes da navegação de criação terminar. A espera
explícita pela rota foi corrigida, sem alterar aplicação, timeout ou asserções
anteriores. O cache incremental de TypeScript também foi regenerado após adicionar
rotas; os tipos novos passaram sem afrouxar o tsconfig.

Para testar manualmente:

1. Execute `npm run dev`; abra `http://localhost:3000/learn/neural-demo`.
2. Começar curso → Concluir atividade → Próxima atividade → Concluir atividade.
   O roteiro opcional não impede liberar o capítulo seguinte.
3. Continue para Correção de Erro. Conclua o contexto e abra o Lab. Verifique vazio:
   a atividade deve permanecer pendente. Preencha e aprove pelo critério do Lab.
4. Aguarde Salvo. Volte à visão geral e revisite o capítulo; progresso e respostas
   confirmadas permanecem na mesma sessão. Conclua o terceiro capítulo.
5. No Studio, crie um curso, associe um exercício configurado/salvo e use Abrir
   como aluno. A estrutura deve aparecer sem painel ou valores de autoria.
6. Refresh reinicia a demonstração e descarta os cursos/progresso temporários.

Verificação automatizada no PowerShell desta máquina:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
npm.cmd run typecheck
npm.cmd run build
```

Use o Node portátil descrito no README quando necessário. As capturas ficam em
`test-results/etapa-16-{curso,capitulo,lab}-{1440,1024}.png`, ignoradas pelo Git.

## Limitações de escopo

Memória por sessão/aba, sem recuperação após refresh, progresso entre dispositivos,
autorização, matrícula, publicação ou certificados. Conclusões manuais não medem
tempo assistido ou leitura. Sem novo motor de provas, montanha realista, catálogo
público de cursos, analytics, pagamentos, trilhas ou dashboard de professor.
Os limites anteriores de fórmulas, XLSX, gráficos, proteção e validação permanecem.
Não foi iniciada a Etapa 17.
