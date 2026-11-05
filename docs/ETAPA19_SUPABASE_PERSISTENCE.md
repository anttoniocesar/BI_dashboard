# Etapa 19 — Supabase, PostgreSQL e persistência

Migração progressiva da administração, autenticação e progresso. A experiência
Learn/Studio/Admin, os modelos pedagógicos e o Lab foram preservados. Há dois
modos explícitos, sem migração automática das fixtures para um projeto remoto.

## Modos e configuração

`lib/data/config.ts` centraliza `dataMode` e a validação da configuração:

- Sem URL/chave pública: `demo`, com os adapters locais e fixtures anteriores.
- URL e anon key configuradas: `supabase`.
- `NEXT_PUBLIC_DATA_MODE=demo` força a demonstração mesmo quando existem chaves.
- `NEXT_PUBLIC_DATA_MODE=supabase` exige URL/chave pública válidas. Configuração
  parcial ou inválida mostra erro; falha remota nunca ativa fixtures silenciosamente.

Copie `.env.example` para `.env.local`, ignorado pelo Git:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DATA_MODE=
```

Use os valores do seu projeto, sem colocá-los em código, commits ou mensagens de
chat. A service role fica somente na variável de servidor. Nunca a copie para uma
variável `NEXT_PUBLIC_*`. O indicador discreto de modo aparece apenas em desenvolvimento.
Variáveis públicas do Next são fixadas no build: reinicie o dev server ou refaça
o build ao mudar a configuração; use os mesmos valores no build e na execução.

SDKs oficiais instalados: `@supabase/supabase-js` 2.118.0 e `@supabase/ssr` 0.12.7.
O projeto requer agora Node >=22, conforme o SDK; o Node portátil 24 permanece
compatível. `server-only` protege módulos privilegiados. `@electric-sql/pglite`
0.5.11 é uma dependência somente de desenvolvimento para executar PostgreSQL nos
testes sem Docker ou projeto remoto.

## Arquitetura

```text
UI → AuthAdapter / AdminRepository / LearnRepository
  demo     → adapters e repositories em memória
  supabase → HTTP same-origin → Route Handlers Next
                            → sessão Supabase Auth verificada
                            → autorização e payload validado
                            → SDK/RPC + PostgreSQL/RLS
```

`AuthSessionProvider` mantém login, logout, currentUser e recuperação. A interface
de login/logout passou a ser assíncrona. `AuthAdapter` tem implementações
`DemoAuthAdapter` e `SupabaseAuthAdapter`. O adapter local conserva sessionStorage
e a senha demo anterior; o remoto usa somente as APIs Next com cookies de sessão.
No modo Supabase, AuthSession local/sessionStorage não concede acesso ao servidor.

`lib/supabase/client.ts` oferece cliente browser exclusivamente com anon key e sem
persistência automática de tokens. As operações autenticadas desta etapa passam
pelo Next. `lib/supabase/server.ts` usa `createServerClient`, `cookies()` assíncrono
e cookies HttpOnly/SameSite=Lax, seguros em HTTPS. Um cliente separado de service
role, sem persistência/refresh de sessão, existe somente no servidor.

`serverContext()` chama `auth.getUser()`, resolve profile/roles atuais e recusa
usuário ausente/inativo. Não confia em um userId recebido pelo browser nem somente
em dados decodificados de cookie/JWT. As chaves e os tokens não entram no DTO de
sessão retornado ao cliente. O servidor renova cookies nas chamadas às APIs; não
há autenticação em Server Component nem dependência de gravação de cookies em SSR.

## Repositories

`AdminRepository`/`AdminRepositoryBase` oferecem leitura de usuários/matrículas,
criação/edição, roles, matrícula, serviço, liberação/revogação e associação docente.
`execute(AdminCommand)` preserva o contrato de comandos existente. Implementações:

- `InMemoryAdminRepository`: mesma transição pura `applyAdminCommand` e fixtures.
- `HttpAdminRepository`: bridge do provider para a API same-origin.
- `SupabaseAdminRepository`: SDK/RPC no servidor, com sessão do usuário real.

`AdminSessionProvider` mantém um cache de apresentação; queries não foram espalhadas
pelos componentes. `useAdminFeedback` aguarda a operação, mostra Salvando e só
confirma sucesso depois da resposta. Criar usuário usa o ID retornado pelo Auth,
sem presumir que um UUID gerado no formulário será o ID real.

`LearnRepository` contém `getStudentIdentity`, `getReleasedCourses`, `getProgress`,
`saveProgress` e `load`. Existem implementações InMemory, HTTP e Supabase. O catálogo
continua vindo dos objetos canônicos de curso no código/Studio. A projeção de acesso
usa os dados persistidos e as funções puras `hasRole`, `hasPermission`,
`releasedCourseIds` e `requireCourseAccess` existentes.

Learn aguarda o carregamento remoto antes de montar o conteúdo pedagógico. Falhas
mostram mensagem e Tentar novamente. Revalidação de sessão/dados administrativos
ocorre na navegação; alterações de roles/status/liberação afetam o guard vigente.

## Banco e relacionamentos

Migration versionada: `supabase/migrations/202610230001_admin_auth_progress.sql`.

| Tabela | Campos/relações principais |
| --- | --- |
| `profiles` | `id → auth.users.id`, nome, status e timestamps. Sem email/senha próprios. |
| `user_roles` | `user_id → profiles`, role student/teacher/admin, PK composta. |
| `enrollments` | UUID próprio, registration_code único de nove dígitos, usuário único, status/timestamps. |
| `services` | UUID, tipo standalone-course único, título e criação. |
| `user_services` | Usuário/serviço, status/timestamps, unicidade do par. |
| `course_access` | UUID, vínculo UserService, course_id textual, unicidade do par. |
| `course_teachers` | Usuário/course_id textual, PK composta e criação. |
| `student_progress` | Usuário/course/chapter/activity, status, completed_at/updated_at; unicidade da identidade completa. |

IDs administrativos remotos são UUIDs reais. `course_id` continua textual, incluindo
`neural-demo`, `chapter-navigation-demo` e IDs de rascunhos Studio. Não existe tabela
duplicando `auth.users`. Profile nasce por trigger sem atribuição automática de
roles a partir de user_metadata. A migration também cria profiles para usuários
Auth já existentes; nenhum deles recebe privilégio administrativo implicitamente.

Status administrativos têm CHECK active/inactive; roles e tipo de serviço têm
CHECKs. FKs, unicidades, índices e triggers de updated_at ficam no banco. Matrícula
é gerada no servidor com sequence PostgreSQL, ano em America/Sao_Paulo e verificação
de colisões com códigos do seed. A sequence tem limite explícito, sem reutilização
silenciosa de códigos ou geração concorrente por contagem no browser.

## RLS e autorização no servidor

Todas as oito tabelas têm RLS. Sem policies públicas permissivas ou `using (true)`.
Anon não consulta tabelas administrativas. Authenticated tem leitura governada por
RLS e não tem escrita direta nas tabelas; escritas passam por RPCs restritas.

- Usuário ativo lê próprio profile, roles, matrícula, serviços, liberações e progresso.
- Professor lê suas associações docentes; não recebe cadastro geral de alunos ou Admin.
- Admin ativo pode ler o conjunto administrativo e executar as operações autorizadas.
- Usuário inativo não recebe essas leituras nem executa as RPCs.

Helpers em `app_private` usam auth.uid() e funções SECURITY DEFINER com
`search_path=''` e referências qualificadas para evitar recursão de RLS e shadowing.
Não são lookups de usuário arbitrário. As RPCs públicas também têm search_path
fixo, execução revogada de PUBLIC/anon e concedida explicitamente a authenticated:

- `app_snapshot()`: DTO administrativo completo para Admin; somente dados próprios
  para outros usuários ativos. Email vem de auth.users e não é exposto em tabela pública.
- `admin_command(jsonb)`: confirma admin ativo novamente no PostgreSQL e aplica
  comandos administrativos em transação, com pré-requisitos de aluno/professor,
  matrícula/vínculo ativos, enums e constraints.
- `save_student_progress(...)`: resolve auth.uid() internamente e exige a cadeia
  de liberação ativa. Não aceita user_id como parâmetro.
- `course_teacher_names()`: somente nomes e courseIds dos responsáveis por cursos
  acessíveis/associados; não libera profiles/emails de professores ao aluno.

As mesmas regras de domínio permanecem nas funções puras para demo/projeção UI;
SQL e APIs conferem os limites de confiança do servidor, sem depender de esconder
controles. O browser não pode se promover a admin por editar o estado local.

## APIs e criação de usuários

| Endpoint | Comportamento |
| --- | --- |
| `POST /api/auth/login` | Email/senha ou resolução privada de matrícula, Supabase Auth, profile ativo. |
| `GET /api/auth/session` | Sessão verificada e snapshot autorizado, sem cache. |
| `POST /api/auth/logout` | Encerra sessão local Supabase e limpa cookies. |
| `GET/POST /api/admin/session` | Sessão → perfil/permissão → payload → repository/RPC. |
| `GET/POST /api/learn/session` | Sessão → study → acesso ao curso → leitura/gravação própria. |
| `POST /api/studio/import` | No modo Supabase exige course:author no servidor antes de analisar o XLSX. Demo preserva o contrato anterior. |

Login por matrícula consulta enrollment ativo com service role exclusivamente no
servidor, resolve o email via Auth Admin e autentica com o cliente anon/session.
A lista matrícula→email não é enviada ao cliente. Erros de identificação, senha e
usuário inativo usam a mesma mensagem. Há limite local de tentativas por identificador
hash, além dos controles do Supabase Auth; não é um rate limiter distribuído.

Criação de usuário usa Auth Admin no servidor, sem senha enviada pelo formulário
ou tabela de credenciais. A conta nova não recebe senha automaticamente: esta etapa
não implementa convite/recuperação de senha; configure o acesso pelo fluxo operacional
do Supabase até a etapa correspondente. Nome/status/roles são configurados pela RPC.
Email permanece no Auth, inclusive nas edições administrativas.

Auth e PostgreSQL não compartilham uma única transação: se a configuração do profile/
roles falhar após criar a conta, o repository tenta compensar removendo a conta;
se uma edição de email falhar no comando de banco, tenta restaurar o email anterior.
Falha de compensação pode exigir revisão operacional, sem prometer atomicidade
distribuída. Uma conta órfã sem roles não recebe autorização administrativa.

Schemas leves validam tipos, enums, email, UUIDs, campos extras e comprimento. JSON
é limitado a 16 KiB e mutações rejeitam Origin externo. Operações do usuário atual
derivam identidade da sessão; userId no comando administrativo identifica somente
o alvo e nunca o ator. Erros internos de PostgreSQL/Supabase não são exibidos ao usuário.

## Progresso e limites do Lab

Conclusões e posição de capítulo são gravadas em student_progress. A atividade
vazia representa somente a posição no capítulo e nunca conclusão. Reconstrução
gera o mesmo `StudentCourseProgress`, com IDs concluídos deduplicados e capítulo
da atualização mais recente. Conclusão é monotônica: uma visita posterior não a revoga.

O fluxo conserva atualização visual imediata e fila serial de persistência, com
Salvando progresso, Progresso salvo e retry em falha. A fila é vinculada ao usuário;
pendências de uma pessoa não são enviadas com os cookies da pessoa seguinte.
Além da fila, a API recusa uma gravação cuja identidade esperada não corresponda
à sessão verificada, cobrindo a troca de conta durante o envio. Essa indicação
serve somente para recusar inconsistências; nunca define o autor da gravação.
Espere Progresso salvo antes de refresh em conexão instável. Supabase ativo preserva
conclusões após refresh/logout/login; outra pessoa lê somente seu próprio progresso.

Nada da planilha é salvo nessa tabela. ExerciseLab, ExerciseDefinition, workbook,
fórmulas, avaliação, gráficos, proteção e autosave de respostas não foram migrados.
Respostas do Lab continuam no repository volátil do Learn, por usuário; refresh
descarta essas respostas mesmo quando o progresso de curso persiste. A rota `/`
conserva seu adaptador local anterior. Persistência de tentativas completas exigirá
outra tabela/repository e política própria em etapa futura.

A avaliação continua no cliente como antes; persistir uma conclusão não a transforma
em nota certificada pelo servidor. Não foram migrados CourseDraft, ChapterDraft,
ActivityDraft, definições de exercícios, XLSX, vídeos, materiais ou pagamentos.
Rascunhos Studio continuam temporários. Grants textuais de um rascunho podem persistir,
mas o curso só aparece no catálogo enquanto sua definição existir na sessão/código.
As definições necessárias ao motor e ao conteúdo no cliente também não ganham
sigilo pelo uso de Auth: conteúdo/avaliação privados exigirão outra fronteira de
entrega e execução. A autorização nova protege os dados persistentes e suas APIs.

## Setup de um projeto de desenvolvimento

1. Crie um projeto Supabase separado para desenvolvimento.
2. Copie a Project URL e a anon key pública em `.env.local`; configure a service
   role somente na variável de servidor indicada acima.
3. Execute a migration versionada via SQL Editor ou Supabase CLI. Com CLI instalada,
   vincule o projeto (`supabase link --project-ref ...`) e use `supabase db push`.
   Não execute reset em um projeto existente para aplicar esta entrega.
4. Aplique opcionalmente `supabase/seed.sql` para criar Curso Avulso sem usuários.
5. Para fixtures opcionais, defina localmente `SUPABASE_DEMO_PASSWORD` com ao menos
   12 caracteres e execute:

   ```powershell
   node --env-file=.env.local scripts/seed-supabase.mjs --demo-users
   ```

   O script cria somente contas demo ausentes, não altera senhas existentes e
   configura roles, matrícula de César, serviço, liberações e professor. Nenhuma
   senha está no SQL ou é impressa pelo script. Execute somente em projeto demo.
   Sem `--demo-users`, o script cria apenas o serviço.
6. Para contas manuais, crie-as no Auth e atribua o primeiro admin pela administração
   confiável do banco, usando seu UUID real em user_roles. Não há bootstrap público
   capaz de criar um administrador pela UI.
7. Use Node >=22, `npm ci`, `npm run dev` e abra `/login`. Para produção faça novo
   build com a configuração do projeto e sirva a aplicação em HTTPS.
8. Confira Admin, liberação de curso e uma conclusão. Aguarde Progresso salvo,
   atualize a página e confira nome, vínculos e conclusão preservados.

## Testes e referências

A suíte comum funciona offline, sem chaves reais e sem projeto Supabase. Os testes
novos verificam configuração, repositories em memória, AuthAdapters, SDK com
transporte mock, validação/recusas das APIs, não exposição da service role e fila
de progresso. PostgreSQL embarcado executa a migration e testa RLS/RPCs reais,
incluindo promoção indevida, isolamento, status, matrícula, curso e progresso.
Para verificar uma instalação que já tenha configuração remota, faça o build e
inicie o servidor de testes com `NEXT_PUBLIC_DATA_MODE=demo`, em porta isolada,
antes de executar a suíte. Não reutilize um servidor ligado a um projeto remoto
para os testes de regressão do modo demo. A integração controlada configura seu
próprio modo Supabase em uma cópia temporária, sem alterar essa configuração.

Uma integração adicional compila cópia isolada do aplicativo em modo Supabase,
usa Auth/PostgREST locais controlados e navega com cookies reais do Next. Confere
nome administrativo persistido, login por matrícula, refresh e logout/login com
progresso, além de recusa das APIs para aluno/professor sem permissão. Esse teste
nunca usa credenciais reais nem altera o build principal ou a porta do usuário.

Não havia projeto/chaves Supabase neste ambiente. Nenhuma migration/seed foi
aplicada a um projeto hospedado. A validação controlada não substitui o smoke test
do projeto configurado pelo operador, suas políticas de rede e configurações Auth.

Referências oficiais consultadas:
[SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funções PostgreSQL](https://supabase.com/docs/guides/database/functions).
Também foram lidos os guias locais da versão instalada do Next para Route Handlers
e cookies assíncronos, além das documentações das Etapas 15–18.

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **270 aprovados, 0 falhos**: 257 anteriores + 13 novos, em aproximadamente 4,6 minutos, sem retries. |
| `npm.cmd run typecheck` | Sucesso. |
| `npm.cmd run build` | Sucesso. |
| PostgreSQL | Migration e seed executados em PostgreSQL embarcado; constraints, RLS, RPCs e isolamento aprovados. |
| Supabase controlado | SDK real com Auth/PostgREST locais controlados; cookies, Admin, matrícula, refresh e progresso aprovados. |

Execução com Node portátil 24, Chrome e renderização por software
(`PLAYWRIGHT_CHANNEL=chrome`, `PLAYWRIGHT_DISABLE_GPU=1`). A regressão usou build
de produção temporário na porta 3001 e harness na 3002. A integração Supabase
compilou outra cópia temporária, com portas e chaves fictícias próprias, depois
das 269 verificações locais. Nenhum teste remoto exige projeto ou internet.
Captura da integração em `test-results/supabase-controlled-learn.png`.

A coleta inicial detectou que o teste existente do importador carrega seu Route
Handler diretamente em Node. A autorização server-only passou a ser importada
dinamicamente no ramo Supabase, preservando esse contrato do modo demo.
Execuções intermediárias identificaram duas disputas de sincronização em testes
anteriores: a retomada de foco após Esc na planilha e a abertura do seletor nativo
de arquivo por teclado. O primeiro agora aguarda explicitamente o foco da célula;
o segundo direciona Enter pelo locator do botão após registrar a espera do evento.
As asserções anteriores foram preservadas, sem aumento de timeouts. As verificações
focadas passaram em três e cinco repetições, respectivamente, e a suíte completa
final passou. O projeto de integração controlada depende do projeto local para
compilar sua cópia somente após as regressões.

Arquivos novos incluem `lib/data/`, `lib/supabase/`, `lib/server/`, adapters Auth,
`lib/repositories/`, rotas `app/api/auth/`, `app/api/admin/` e `app/api/learn/`,
`components/data/`, `supabase/migrations/`, seed SQL/script, `.env.example`,
os três testes de persistência/Supabase e este documento. Integrações alteradas:
providers Auth/Admin/Learn, formulários administrativos, login/guard, indicador
de modo, autorização do importador, configuração Playwright, README, nota histórica
da Etapa 18, dependências e lockfile. Nenhum arquivo do motor, ExerciseLab,
ExerciseDefinition, avaliador, proteção, fórmulas, gráficos ou autosave foi editado.
