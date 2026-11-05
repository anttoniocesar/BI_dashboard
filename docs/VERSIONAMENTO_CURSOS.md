# Versionamento de cursos

## Família e versão concreta

`CourseDraft.id` continua sendo o ID físico usado em URLs, CourseAccess,
StudentProgress, attempts e Monitoring. Foram acrescentados:

- `courseFamilyId`: identidade lógica comum às versões;
- `versionNumber`: número inteiro crescente por família;
- `basedOnCourseId`: publicação que originou a cópia;
- `publishedAt`: primeira publicação da versão, quando conhecida.

`latestPublished` é a publicação com maior `versionNumber` da família, sem
depender de timestamps. V1 e v2 podem continuar com status `published`; a v1
não é arquivada automaticamente. `archived` continua sendo uma ação explícita
que retira acesso conforme a regra anterior, e não é usado para substituir v1
ao publicar v2.

No Supabase, a migração preserva todos os IDs e atribui a cada curso existente
sua própria família e `version_number = 1`. A data de publicação legada usa
`created_at` como referência de migração; novas publicações têm data própria.
No demo, campos ausentes são interpretados como família = ID e versão = 1,
e normalizados na próxima gravação do workspace, sem apagar dados antigos.

## Fluxo do professor

Abra uma publicação e use **Criar nova versão → Confirmar nova versão**.
O sistema abre uma cópia em Draft. Ela mantém título, descrição, objetivo,
carga horária, imagem, capítulos, ordem, atividades, obrigatoriedade, URLs,
textos, metadata e configurações pedagógicas. Capítulos e atividades recebem
IDs novos e referências de origem `sourceChapterId`/`sourceActivityId`.

Os Labs conservam o mesmo par `exerciseId + exerciseVersion`; não são criados
novos ExerciseDefinitions automaticamente. No rascunho, use **Substituir
exercício** para trocar LAB 1 por LAB 2, confira o preview e publique. A
publicação anterior e seus exercícios continuam preservados.

A listagem do Studio agrupa a família em um card, mostra a publicação atual
e lista as versões. **Histórico de versões** oferece Abrir e Preview, datas e
origem. Há apenas um Draft ativo por família. Se ele já existir, a publicação
oferece **Abrir rascunho**, e o domínio/banco recusam outro clone concorrente.

**Descartar rascunho** exige confirmação e só remove o Draft nunca publicado,
sem acessos ou histórico incompatível. Não remove a publicação de origem nem
exercícios. A próxima cópia pode reutilizar o número do rascunho descartado;
números de versões publicadas não são reutilizados.

## Publicação imutável

Published e Archived têm conteúdo somente leitura no Studio. Não é mais
permitido alterar diretamente título, metadados, capítulos, atividades, texto,
vídeos, Labs ou obrigatoriedade de uma publicação. O domínio recusa `save-course`
dessas versões, e triggers impedem modificações estruturais/remoção no banco.
Publicar um rascunho valida a estrutura e os exercícios pelo fluxo existente.

Essa regra substitui a permissão anterior de alterar metadados e parte da
estrutura publicada. A operação de arquivar continua explícita; não existe
exclusão física de uma versão já publicada, nem retorno dela para Draft.

Professores autorizados podem criar uma revisão. Admin pode criá-la no catálogo
administrativo, sem receber permissão geral para editar conteúdo no Studio.
O responsável original é mantido quando existe; no banco, associações docentes
da origem são copiadas para a nova versão. Permissões herdadas da família/origem
são reconhecidas no demo. O catálogo estático de exemplos do demo permanece
somente leitura; o versionamento aplica-se aos cursos persistidos na autoria.

## Alunos e CourseAccess: regra determinística do MVP

CourseAccess continua apontando para uma versão física. Essa linha persistida
funciona como a fixação de versão do aluno; não se escolhe novamente a versão
a cada visita. O primeiro início registra StudentProgress no mesmo ID concreto.

- Acessos existentes continuam na versão já liberada, inclusive se o aluno
  ainda não iniciou atividades. Não há promoção automática desses acessos.
- Uma nova liberação sem acesso anterior à família resolve a maior versão
  publicada e grava seu ID físico em CourseAccess.
- Liberar novamente a família para quem já tem acesso preserva a versão
  anterior. O mesmo vale ao usar outro vínculo de serviço do mesmo aluno.
- Regressos após refresh, logout/login ou outro navegador leem o mesmo acesso.

Essa decisão evita mudar o contrato e a política de autorização de CourseAccess
e adota a alternativa conservadora permitida para alunos ainda não iniciados.
Revogar e liberar novamente sem acesso remanescente é uma ação administrativa
explícita, que resolve a publicação atual; não é migração de progresso.

No demo, a resolução usa `courseForNewGrant` no repositório administrativo.
Na API ela também é validada; no Supabase, o trigger de CourseAccess faz a
resolução na própria transação, com lock por aluno/família. Linhas existentes
não são reescritas pela publicação.

## Progresso, tentativas e Monitoring

Clone não copia CourseAccess individual, StudentProgress, exercise_attempts,
respostas, conclusões, sessões ou autenticação. IDs concretos de curso e novos
IDs de atividades impedem que progresso/attempts de v1 sejam usados em v2.
Não há migração ou limpeza automática de histórico.

Monitoring consulta cada ID físico separadamente e mostra a versão no card,
relatório e detalhe do aluno. Exemplo: César em v1 e Ana em v2 ficam em
relatórios separados, sem somar métricas de estruturas diferentes. No demo,
o professor também acompanha suas próprias versões de autoria pela autorização
de proprietário/família. As limitações anteriores de dados demo em memória
para progresso/respostas permanecem; não foi criado autosave novo de aluno.

## Exercícios e exclusão

`exerciseUsages` percorre todas as versões do workspace. Se v1 usa LAB 1 e v2
usa LAB 2, ambos permanecem protegidos. Trocar o Lab do rascunho não libera
o exercício ainda usado pela publicação histórica. As restrições existentes
de editar uma versão de exercício já publicada continuam valendo.

A exclusão real de exercícios no Supabase continua indisponível (HTTP 501),
como documentado anteriormente; a proteção de referências não foi contornada.

## Operações, atomicidade e migration

`create-course-revision` recebe `sourceCourseId` e `expectedUpdatedAt`. O domínio
verifica autorização, publicação de origem, revisão e Draft ativo, e faz cópia
profunda. `CourseRepository.execute` retorna o workspace confirmado, usado para
abrir a nova versão. Falha de persistência não adota cópia parcial em memória.
O repositório local relê os dados e serializa abas com Web Locks, quando
disponíveis. Sem Web Locks, permanece a limitação anterior entre abas simultâneas.

Aplicar por histórico, após as migrations anteriores, sem reset:

`supabase/migrations/202610260002_course_versions.sql`

Ela acrescenta campos e índices únicos para `(course_family_id, version_number)`
e para um único Draft por família. `create_course_revision` é um RPC exclusivo
da service role, chamado após validar a sessão. Ele autoriza novamente o ator,
confere a revisão sob lock, serializa clones da família, copia toda a estrutura
e associa professores na mesma transação. Um erro aborta toda a cópia.

A projeção `course_workspace` inclui identidade/rastreabilidade das versões.
A migration também protege conteúdo publicado, preserva tabelas de histórico
e mantém a compatibilidade dos RPCs existentes. Não cria tabelas novas de
progresso, attempts ou autenticação. Nenhum banco hospedado foi alterado nesta
tarefa; a migration deve ser aplicada no ambiente de destino antes do recurso.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Modelo/domínio | `types/course.ts`, `lib/courses/versions.ts`, `lib/courses/authoring.ts`, `lib/studio/courseDraft.ts`, `lib/repositories/CourseRepository.ts` |
| Persistência/API | `lib/repositories/SupabaseCourseRepository.ts`, `lib/repositories/LocalDemoAdminRepository.ts`, `lib/server/courses.ts`, `lib/server/api.ts`, nova migration |
| Studio | `components/studio/StudioSession.tsx`, `components/studio/courses/CourseVersions.tsx`, `CourseEditor.tsx`, `CourseList.tsx` |
| Acessos/admin | `components/admin/AdminSession.tsx`, `AdminDashboard.tsx`, `UserDetails.tsx` |
| Aluno/Monitoring | `components/learn/LearnCourses.tsx`, `components/monitoring/MonitoringPage.tsx` |
| Testes | `tests/course-versions-model.spec.ts`, `tests/course-versions-database.spec.ts`, `tests/course-versions-ui.spec.ts`; regressões de autoria/Supabase ajustadas à imutabilidade |

Importador XLSX, gráficos, fórmulas, LabView, validation engine, player e
autenticação não foram modificados. A fixture Ana do teste demo usa AuthSession
de teste, pois o demo só tem três credenciais; login de um novo aluno real é
coberto pela integração Supabase controlada, com formulário e cookies oficiais.

## Resultado em 26/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **465 aprovados, zero falhas**, em 7,0 minutos: 451 anteriores e 14 novos. Inclui Supabase controlado; regressões anteriores de edição publicada foram atualizadas para exigir imutabilidade. |
| `npm.cmd run typecheck` | Aprovado, inclusive após os ajustes finais de apresentação. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno. |
| Aceite no build final | Repetido e aprovado com os dois XLSX originais de Downloads. |
| Domínio | 7 novos testes agregam cópia profunda, IDs/origem, exercício sem duplicação, autorização (incluindo Admin), draft único, revisão, concorrência entre repositórios, falha sem cópia parcial, publicação/descarte e acessos fixos. |
| PostgreSQL | Migration completa aplicada em PGlite isolado. Clone transacional, índices, permissões, imutabilidade direta, liberação resolvida no banco e manutenção de progresso e tentativa não vazia (`F2 = =42`) aprovados. |
| Interface | 6 testes novos: confirmação/Esc/foco, grupo/histórico, mobile 390 px sem overflow, descarte, falha de storage, Admin, refresh/logout/login e reinício real do Chromium com o mesmo perfil. |
| Supabase controlado | Professor criou/editou/publicou v2 e substituiu seu Lab. César recuperou v1 e a resposta anterior `=321`; outro aluno fez login pelo formulário e recebeu v2 com progresso inicial zero. |

O **Curso Teste Completo** isolado foi publicado como v1 usando
`laboratorio_1.xlsx · 0.1-draft`, e César iniciou essa versão. A nova v2 copiou
a estrutura com IDs próprios e iniciou referenciando o mesmo LAB 1. O professor
substituiu por `laboratorio_2.xlsx · 0.1-draft`, conferiu o preview e publicou.
V1 permaneceu idêntica ao snapshot anterior e continuou acessível a César.
Uma nova liberação para Ana apontou para v2, e Learn mostrou LAB 2.

Monitoring mostrou César no relatório v1 e Ana no relatório v2. A biblioteca
recusou excluir tanto LAB 1 (ainda usado pela v1 histórica) quanto LAB 2 (usado
pela v2). Nenhum curso hospedado ou perfil pessoal foi alterado.

Capturas `test-results/course-version-history.png` e
`test-results/course-version-mobile.png` inspecionadas. Os testes usaram Node
portátil em `.tools/node-v24.22.1-win-x64`, Chromium em
`.tools/playwright-browsers`, preview de produção na porta 3001 e as variáveis
de regressão dos LABs 1/2 apontando para os originais.
`test-results/.last-run.json` registra `passed`. Servidores temporários
encerrados após a validação. Nenhuma dependência ou lockfile foi alterado.
