# Etapa 20 — Acompanhamento do aluno e relatórios do professor

Primeira projeção pedagógica de acompanhamento. Foram consultados os documentos
das Etapas 15 a 19. Não existe outra tabela de progresso, nota ou status de curso.
Os relatórios usam `student_progress`, `StudentCourseProgress` e as mesmas funções
de conclusão do Learn. Nenhuma dependência ou lockfile foi alterado.

## Professor e rotas

O item Acompanhamento está na navegação de cursos do Studio.

| Rota | Conteúdo |
| --- | --- |
| `/studio/monitoring` | Somente cursos com associação CourseTeacher vigente e definição disponível no catálogo. |
| `/studio/monitoring/[courseId]` | Resumo, filtros e tabela de alunos com acesso ativo ao curso. |
| `/studio/monitoring/[courseId]/student/[userId]` | Identidade educacional, progresso, capítulos, atividades e datas de conclusão daquele aluno/curso. |

Os cards por curso mostram total, iniciados, concluídos, média e ausência de
atividade recente. A tela de curso mostra Total de alunos, Média de progresso,
Concluíram e Em andamento. Cada aluno aparece uma única vez, mesmo se houver
mais de um vínculo liberando o mesmo curso.

A tabela contém nome, matrícula, percentual, capítulo atual, obrigatórias
concluídas, última atividade, atualização e situação textual. O detalhe apresenta
os títulos reais e a ordem A/B/C usando `chapterNavigation`, sem montar o Lab.
Opcionais continuam identificadas e podem permanecer não iniciadas num curso
concluído. Não há células, fórmulas, respostas, pesos, notas ou snapshots.

Filtros: Todos, Não iniciados, Em andamento e Concluídos. Busca por nome ou matrícula,
ignorando maiúsculas e espaços externos. Ordenação por nome crescente, progresso
decrescente ou última atividade mais recente, com nome como desempate. Filtros afetam a
tabela; os cards continuam representando a turma inteira. Não há grid avançado,
exportação, paginação ou busca remota nesta entrega.

## Arquitetura e repositories

`types/monitoring.ts` define `StudentLearningStatus`, `MonitoredStudent` e
`MonitoringCourseData`. São DTOs educacionais: ID, nome, matrícula e linhas de
progresso de um único curso. Não contêm email, roles ou serviços administrativos.

```text
MonitoringPage → MonitoringRepository
  demo     → InMemoryMonitoringRepository → estado administrativo + linhas Learn
  supabase → HttpMonitoringRepository → GET /api/monitoring
                     → sessão verificada → teacher → RPC com associação verificada
                     → SupabaseMonitoringRepository → student_progress
```

O contrato oferece `listTeacherCourses`, `getCourseStudents` e `getStudentDetail`.
Queries não aparecem em componentes React. `lib/learn/monitoring.ts` reúne as
projeções puras, a formatação de datas e os filtros. Admin, catálogo e definições
canônicas continuam nas fontes da Etapa 19.

## Regras de progresso

`learningProjection` chama `courseProgress` e `progressFromRows`; não implementa
uma segunda regra de aprovação. O percentual usa somente atividades obrigatórias.
Capítulo vazio e curso sem capítulos continuam incompletos. O teto de 99% enquanto
há capítulo incompleto, capítulos só opcionais e o arredondamento são exatamente
os do Learn. A média é a média aritmética dos percentuais de todos os alunos com
acesso ativo, incluindo quem ainda não começou, arredondada para inteiro.

`StudentLearningStatus` é derivado:

- `not-started`: sem visita ou conclusão registrada.
- `in-progress`: visita/atividade registrada e curso ainda incompleto.
- `completed`: conclusão derivada por `courseProgress`.

Capítulos e atividades apresentam os mesmos três estados pedagógicos. O estado de
acesso Atual/Disponível/Bloqueado da jornada permanece independente e preservado.
Linhas de capítulos/atividades que já não existem na definição são ignoradas na
projeção, sem apagar registros persistentes ou inventar conclusão para outro ID.

O capítulo atual representa `currentChapterId`/último capítulo registrado; sem
registro, usa o próximo capítulo derivado pelo Learn. No catálogo do aluno,
Próximo capítulo mostra o destino de estudo derivado, que pode diferir do último
capítulo visitado. Última atividade é a linha não vazia de maior `updated_at`.
Marcadores antigos de posição de capítulo não são apresentados como atividades.
Última atualização inclui também esses marcadores. Sem registro, mostra Sem registro.
A ordenação por última atividade usa a data da atividade, não a de um marcador
de capítulo mais recente.

Selecionar uma atividade registra visita `in-progress` no repository de progresso
existente, inclusive ao revisitar. A gravação monotônica preserva uma conclusão
anterior e seu `completed_at`. `ProgressRow` agora inclui `completed_at` opcional,
e o repository em memória guarda a mesma informação. `LearnData.rows` permite
projetar datas/visitas; `StudentCourseProgress` permanece com seu contrato anterior.
Não são registradas teclas, conteúdo do Lab ou tempo assistido. Dados antigos não
recebem datas inventadas: conclusões sem data mostram Sem registro.

Datas usam `pt-BR` e `America/Sao_Paulo`. Sem atividade recente significa ausência
de qualquer registro ou última atualização há **mais de 7 dias corridos**. Exatamente
sete dias não aciona o indicador. O indicador também pode aparecer em curso
concluído; não é reprovação, bloqueio ou notificação. A leitura recalcula o indicador,
sem tarefa agendada ou coluna redundante no banco.

## Segurança e PostgreSQL

Migration adicional: `supabase/migrations/202610230002_teacher_monitoring.sql`.
Aplique depois da migration da Etapa 19, sem reset do banco. Não há seed remoto
novo nem alteração nas policies administrativas já existentes.

`teacher_course_progress(requested_course text, requested_student uuid)`:

1. Deriva o ator de `auth.uid()` e verifica profile ativo e role teacher.
2. Restringe os cursos a CourseTeacher desse ator, sem exceção para admin.
3. Seleciona alunos ativos com role student, matrícula ativa e ao menos um
   UserService ativo com CourseAccess para aquele curso.
4. Retorna somente nome, matrícula e progresso daquele curso, incluindo alunos
   sem linhas de progresso. Não usa apenas quem já começou para formar a turma.
5. Recusa curso não associado e detalhe de aluno fora da turma.

A RPC é SECURITY DEFINER, tem `search_path=''`, referências qualificadas e execução
revogada de PUBLIC/anon, concedida a authenticated. Professor não ganhou SELECT
geral sobre matrículas, profiles de alunos ou student_progress. As RLS anteriores
continuam aplicadas; a RPC fornece a projeção mínima autorizada. Admin sem teacher
é recusado; admin com teacher sem associação tem lista vazia e não abre curso alheio.

`GET /api/monitoring` aceita somente `courseId` e `userId` alvo opcional, com curso
obrigatório para detalhe. Valida sessão ativa e teacher antes da consulta; recusa
campos extras, parâmetros repetidos e UUID inválido. O alvo não define o ator.
O SDK usa o cliente da sessão autenticada, nunca service role. A RPC verifica
associação no banco em cada chamada, mesmo se uma UI tiver estado antigo.
Respostas são `private, no-store`; erros internos são mascarados.

Matrícula/serviço inativo, revogação de acesso ou retirada de role student retiram
o aluno da turma na próxima consulta. Os registros de progresso são preservados.
Não há atualização em tempo real: reabrir a tela/recarregar consulta o estado atual.
Os limites de segurança e privacidade do conteúdo pedagógico cliente da Etapa 19
permanecem; relatório persistido não certifica a avaliação no servidor.

## Demo e Supabase

No modo demo, `data/monitoring/demo.ts` acrescenta **somente à leitura do relatório**
três exemplos educacionais: Ana (não iniciada), Bruno (33%, sem atualização há dez
dias) e Carla (100%, atualização há um dia). As datas são relativas ao momento da
consulta. Não são contas de login nem alteram usuários/contagens do Admin. Seus
vínculos e linhas são fixtures identificadas pelo sufixo Exemplo, não snapshots
reais de planilha. Eles existem apenas no curso neural demonstrativo.

César usa os vínculos administrativos e o mesmo repository em memória da sessão
Learn. Começa vazio como antes; estudar, sair e entrar como professor na mesma aba
mostra seu avanço real. Refresh descarta esse avanço demo conforme o contrato
anterior. As três fixtures não modificam César nem seus testes históricos.

No modo Supabase, nenhuma dessas fixtures é usada. Turmas e progresso vêm da RPC
e das oito tabelas existentes. Nome/status/liberações seguem os dados persistidos.
Cursos continuam no código/Studio: um vínculo textual cujo rascunho não existe mais
não cria conteúdo fictício; sua definição precisa existir no catálogo para renderizar
o relatório. CourseDraft e tentativas completas do Lab continuam fora do banco.

## Visão do aluno e acessibilidade

`/learn` conserva seus cursos liberados e acrescenta percentual, obrigatórias
concluídas, situação, capítulo atual, próximo capítulo e última atividade. A fonte
é o LearnRepository do usuário autenticado. Não existe endpoint que aceite outro
aluno para alimentar esse catálogo. `/learn/[courseId]` conserva header, cards,
sidebar e montanha, acrescentando o estado pedagógico textual de cada capítulo.

O acompanhamento tem carregamento, erro com Tentar novamente, ausência de cursos,
ausência de alunos e ausência de resultados dos filtros. Requisições obsoletas
não substituem a tela após navegação. Tabelas têm caption, cabeçalhos e rolagem
interna; filtros têm labels explícitos, controles nativos e foco visível. Há skip
link, status textual e navegação por teclado. Não há certificação com leitor de tela.

Não foram implementados notas detalhadas, avaliação manual, mensagens, comentários,
certificados, ranking, gamificação, BI avançado, exportação, persistência do Lab ou
replay. Nenhum arquivo de ExerciseLab, ExerciseDefinition, fórmulas, gráficos,
proteção, autosave ou avaliador foi editado.

## Como conferir

1. Em demo, entre com `professor@example.com` e senha `demo123`.
2. No Studio, abra Acompanhamento → Redes Neurais Aplicadas à Engenharia.
3. Confira quatro alunos (três exemplos e César), filtros, busca e ordenação.
4. Abra Carla e confira capítulos, todas as atividades A/B/C e datas, sem respostas privadas.
5. Entre como César, conclua uma atividade e volte a Meus cursos. Entre como
   professor na mesma aba e confira o avanço de César no relatório.
6. Tente `/studio/monitoring/chapter-navigation-demo` sem associação: acesso recusado.
7. No Supabase configurado conforme a Etapa 19, aplique a migration adicional,
   associe um professor ao curso e libere alunos pelo Admin. Conclua uma atividade,
   aguarde Progresso salvo e confira o relatório após refresh.

## Verificação

Os novos testes estão em `monitoring-model.spec.ts`, `monitoring-database.spec.ts`
e `monitoring-ui.spec.ts`. A integração controlada existente de Supabase também
verifica acompanhamento real pela API Next, erro/retry, loading, isolamento e
refresh. PostgreSQL embarcado executa ambas as migrations e verifica a RPC real,
suas recusas, projeção privada e a manutenção das restrições de RLS.

Nenhum projeto hospedado foi configurado ou alterado nesta etapa. Os testes
Supabase usam Auth/PostgREST locais controlados com SDK e cookies reais; o SQL é
validado separadamente em PostgreSQL embarcado. Isso não substitui o smoke test
operacional do projeto hospedado. Todos os testes comuns continuam offline.

| Verificação | Resultado final |
| --- | --- |
| `npm.cmd test -- --workers=2` | **285 aprovados, 0 falhos**: 270 anteriores + 15 novos, aproximadamente 4,1 minutos, sem retries. |
| `npm.cmd run typecheck` | Sucesso. |
| `npm.cmd run build` | Sucesso; três páginas e um endpoint de acompanhamento adicionados. |
| PostgreSQL | Migration adicional e RPC executadas; autorização, projeção mínima, status, revogação e isolamento aprovados. |
| Supabase controlado | Professor vê progresso persistido, refresh, loading, erro/retry e recusas por sessão/perfil/associação aprovados. |
| Layout e teclado | 1440×768, 1366×768 e 1024×768 aprovados e capturas inspecionadas; foco visível e tabela com rolagem interna. |
| Artefato final | Build/typecheck refeitos e 14 casos de modelo/interface aprovados no build final após o ajuste da ordenação de última atividade. |

Ambiente: Node portátil 24, Chrome e renderização por software
(`PLAYWRIGHT_CHANNEL=chrome`, `PLAYWRIGHT_DISABLE_GPU=1`). A suíte usou produção
temporária na porta 3001 e harness na 3002. A integração Supabase compilou sua
cópia isolada depois das regressões locais. Os processos temporários foram
encerrados, sem intervenção na porta 3000. Capturas em
`test-results/monitoring-{1440,1366,1024}.png`; o resultado completo foi preservado
e a última rodada focada gravou seus artefatos em `.tools/monitoring-final-results`.

Na primeira verificação focada, labels envolvendo selects incluíam também o texto
das opções na busca exata do teste. Os filtros passaram a usar labels separados,
associados por `htmlFor`/`id`. O teste novo de detalhe foi corrigido para conferir
as 18 atividades atuais do curso neural, incluindo os Labs opcionais, em vez da
contagem antiga de sete. A inspeção visual levou a manter matrículas e cabeçalhos
inteiros, com rolagem interna em telas menores.

Uma execução intermediária também detectou um teste anterior clicando em C.1
antes de completar a navegação para Correção de Erro: o clique atingia o bloco
do capítulo anterior. Foi acrescentada a espera explícita pela rota de destino
em `student-ui-refinement.spec.ts`. Nenhuma asserção anterior foi removida ou
afrouxada e nenhum timeout anterior foi alterado. Os 21 casos focados de modelos,
PostgreSQL, acompanhamento e refinamento passaram após esses ajustes.

Arquivos novos: `types/monitoring.ts`, `lib/learn/monitoring.ts`, quatro arquivos
de MonitoringRepository, `lib/server/monitoring.ts`, `app/api/monitoring/route.ts`,
`components/monitoring/MonitoringPage.tsx`, `app/studio/monitoring/`, fixtures e
três arquivos de testes monitoring, migration adicional e este documento.
Integrações: contexto servidor, repositories Learn/DTO de linhas, LearnSession,
registro de visita no ChapterPlayer, catálogo Learn, estados na jornada,
navegação de cursos Studio, teste Supabase controlado, sincronização do teste de
refinamento e README. Dependências, lockfile e arquivos do motor/Lab preservados.
