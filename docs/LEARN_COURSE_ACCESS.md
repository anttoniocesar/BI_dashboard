# Origem dos cursos e acesso no Learn

Investigação e correção em 28/10/2026.

## Causa raiz

Os dois títulos são fixtures estáticas, independentes da autoria do professor:

| ID | Título | Definição |
| --- | --- | --- |
| `neural-demo` | Redes Neurais Aplicadas à Engenharia | `data/courses/neural-demo.ts` |
| `chapter-navigation-demo` | Navegação de capítulo — demonstração A/B/C | `data/courses/chapter-navigation-demo.ts` |

Antes da correção, `lib/courses/catalog.ts` adicionava ambos em toda chamada de
`courseCatalog(studio.courses)` quando `NEXT_PUBLIC_DATA_MODE` não era exatamente
`supabase`. Também promovia as fixtures de draft para published. Não dependia de
o array estar vazio. `NEXT_PUBLIC_PILOT_ONLY=1` trocava a coleção pelo piloto.

`data/admin/demo.ts:createAdminFixtures()` contém César (`student-cesar`), sua
matrícula `202700184`, o serviço ativo `service-cesar` e os dois CourseAccess.
`LocalDemoAdminRepository` usava essas concessões ao iniciar sem snapshot válido
e ao restaurar a demonstração. Um snapshot válido podia conservar as mesmas
concessões após refresh/reabertura.

Fluxo anterior: `/learn/page.tsx` → `LearnCourses` → `LearnSession` →
`courseCatalog(studio.courses)` + estado do `AdminSession` → filtro de publicação
e `requireCourseAccess`. O filtro de acesso já existia; catálogo e concessões
demo eram fornecidos automaticamente por fontes diferentes da autoria.

Por isso apagar cursos locais do professor não eliminava esses títulos: o
catálogo os reconstruía do código e o estado administrativo ainda tinha ou
recriava os acessos. Não era progresso, autosave, player ou a jornada.

## Armazenamento e fontes verificadas

| Fonte | Responsabilidade |
| --- | --- |
| `localStorage[bi-society:course-authoring:v1]` | Workspace autoral: cursos, exercícios e definições. `LocalCourseRepository` inicia com `emptyWorkspace()`, sem seed de cursos. |
| `localStorage[bi-society:demo-admin-state:v1]` | Snapshot `{version:1,state}` de usuários, matrículas, serviços, CourseAccess e professores; pode conservar os grants antigos. Não contém os capítulos dos dois cursos. |
| `sessionStorage[bi-society:demo-auth-session:v1]` | Identidade autenticada e data. Não contém catálogo nem CourseAccess. |
| `InMemoryLearnRepository` | Progresso local em memória, separado por usuário; não injeta cursos. |
| `data/courses/*` | Fixtures estáticas, agora ativadas explicitamente no catálogo. |
| `HttpCourseRepository` / `SupabaseCourseRepository` | Workspace da API/RPC `course_workspace`; sem fallback local se o carregamento falhar. |
| `supabase/migrations/202610240003_course_catalog_seed.sql` | Seed histórico dos três cursos canônicos no banco. Não cria CourseAccess. Não foi executado, editado nem removido nesta correção. |

Sem chaves, `dataConfiguration()` escolhe o armazenamento/autenticação local
(`mode: demo`). Isso, sozinho, agora não habilita catálogo nem concessões demo.
Configuração Supabase inválida continua gerando erro, sem fallback para fixtures.
Em Supabase, o catálogo continua usando somente o workspace retornado pelo banco,
mesmo com a flag demo definida. Cursos já persistidos e concessões reais não são
apagados por esta mudança.

A sessão do navegador pessoal do IDE não está conectada à automação. Portanto,
não foi possível extrair o snapshot já existente naquele perfil. A inspeção do
código e os testes cobrem tanto ausência da chave quanto snapshot antigo válido.
Não se afirma que um snapshot específico do navegador pessoal foi lido ou limpo.

## Regra atual

`lib/learn/courses.ts:studentCourses` lista somente curso publicado que passa em
`requireCourseAccess`: aluno ativo com permissão de estudo, matrícula ativa,
vínculo de serviço ativo e CourseAccess para aquele curso. Um acesso a outro
curso, draft, curso arquivado ou vínculo inativo não libera a listagem.

O catálogo normal retorna exclusivamente os cursos recebidos do repository.
Não preenche arrays vazios nem força publicação. Grants antigos para IDs ausentes
no workspace não conseguem reconstruir os cursos estáticos. Snapshots válidos são
preservados, inclusive acessos a outros cursos; não foi criado um reset genérico.

`createLocalAdminState()` mantém os logins locais e a matrícula de César, mas
começa sem CourseAccess ou associações de professor a fixtures. O reset
administrativo existente usa a mesma regra; não apaga a autoria.

Quando nenhum curso satisfaz a regra, a página mantém **Meus cursos** e mostra:

> Nenhum curso foi liberado para você ainda.
>
> Quando um curso for disponibilizado, ele aparecerá aqui.

## Demonstração e preview

Para habilitar as fixtures históricas, use um servidor/build isolado com:

```powershell
$env:NEXT_PUBLIC_DATA_MODE = 'demo'
$env:NEXT_PUBLIC_DEMO_CATALOG = '1'
npm.cmd run dev -- --port 3004
```

Deixe `NEXT_PUBLIC_DEMO_CATALOG` ausente ou `0` no uso normal. A variável
`NEXT_PUBLIC_` é incorporada no build; mudar somente o ambiente de `next start`
não altera um bundle existente. Reinicie o dev ou refaça o build ao mudar a flag.
Ela não transforma snapshots existentes nem concede acessos em Supabase.
Use outra origem/porta para separar o localStorage da demonstração.

O Playwright opta explicitamente pelas fixtures para as regressões históricas.
O servidor padrão de testes usa a porta 3001 para não reutilizar o servidor
normal da porta 3000. `scripts/start-demo-test-server.cjs` prepara um build em
`.tools/`, sem disputar o diretório de build/dev do ambiente normal.
`PLAYWRIGHT_BASE_URL` permite apontar explicitamente para
um servidor de regressão já preparado.
`learn-access.spec.ts` compila outra aplicação com `NEXT_PUBLIC_DEMO_CATALOG=0`
para verificar a experiência normal sem depender dessa opção da suíte.

O preview do professor continua usando `studio.courses` diretamente, incluindo
drafts, com respostas temporárias e sem exigir CourseAccess do aluno. Não houve
mudança em jornada, P1–P15, TOP, nuvens, pássaros, Labs, fórmulas, gráficos,
importador, autosave, progresso ou player.

## Validação

`tests/learn-access.spec.ts` acrescenta dez testes: zero/um/dois acessos; publicado
sem acesso; draft/arquivado com acesso; invalidação de usuário/matrícula/serviço;
catálogo normal sem fixtures e sem promoção de draft; demo explícito; César local
sem concessões; fluxo completo no navegador em aplicação isolada.

O fluxo no navegador autentica `202700184`, verifica o estado vazio, restaura um
snapshot antigo com os dois grants demo e um grant adicional e comprova sua
preservação integral sem cursos fictícios na tela. Depois valida reset das duas
chaves em seu próprio contexto de teste, publicado sem acesso e draft com acesso.
Cria um curso como professor, verifica preview, publica, confirma César ainda
sem cursos, libera como admin e confirma somente o curso liberado, inclusive após
refresh. Nenhum desses dados é gravado no perfil pessoal do navegador.

Capturas: `test-results/learn-cesar-empty.png` e
`test-results/learn-cesar-released.png`.

Uma verificação adicional autenticou a matrícula `202700184` diretamente em
`http://localhost:3000/learn`, em contexto novo, sem chaves de autoria ou snapshot
administrativo: zero cursos e mensagem de estado vazio. Relatório em
`.tools/learn-localhost-3000.json` e captura em
`.tools/learn-localhost-3000-cesar-empty.png`.

Logs de validação: `.tools/learn-access-suite-final.log`,
`.tools/learn-access-build.log` (catálogo normal),
`.tools/learn-access-demo-build.log` (build isolado para regressões históricas).

Resultados finais em 28/10/2026:

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 569 aprovados em 5,6 minutos, sem falhas ou ignorados; inclui Supabase controlado. Executado pelo wrapper local existente contra o build demo da porta 3001. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado em preview interno local com `NEXT_PUBLIC_DATA_MODE=demo`, `BI_SOCIETY_ALLOW_DEMO_PREVIEW=1` e `NEXT_PUBLIC_DEMO_CATALOG=0`. |
| Inicialização padrão de testes com servidor isolado | Login/catálogo demo aprovado em execução adicional; `.tools/learn-access-infra.log`. |

A suíte usou Chromium local de `.tools/playwright-browsers`, GPU desativada e
os XLSX originais dos LABs 1 e 2 de Downloads. O registro
`test-results/.last-run.json` contém `passed` e nenhum teste falho. As capturas
do estado vazio e do único curso liberado foram inspecionadas.

## Arquivos da correção

- `lib/data/demo-catalog.ts`: opção explícita de demonstração.
- `lib/courses/catalog.ts`: catálogo sem injeção por padrão.
- `lib/admin/local-state.ts`: identidades locais sem concessões fictícias.
- `lib/repositories/LocalDemoAdminRepository.ts`: inicialização/reset compatíveis
  com a opção explícita, preservando snapshots válidos.
- `components/admin/AdminSession.tsx`: restauração do repository sem estado
  inicial com grants fictícios.
- `lib/learn/courses.ts` e `components/learn/LearnSession.tsx`: seleção de cursos
  publicados com acesso válido.
- `components/learn/LearnCourses.tsx`: estado vazio.
- `tests/learn-access.spec.ts`: dez novas regressões e fluxo integrado normal.
- `tests/auth-ui.spec.ts` e `tests/supabase-ui.spec.ts`: texto atualizado do vazio.
- `playwright.config.ts`: demo explícito e servidor de teste separado do 3000.
- `scripts/start-demo-test-server.cjs`: aplicação de regressão com build isolado.
- `.env.example`, `README.md` e este documento: configuração e investigação.
