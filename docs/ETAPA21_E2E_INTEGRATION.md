# Etapa 21 — Integração ponta a ponta e testes E2E

Escopo: aceitação integrada, navegação, regressão e pequenos ajustes encontrados
nos testes. Foram lidas as Etapas 15–20, os refinamentos do aluno, os contratos
A/B/C/sidebar e o ajuste de células mescladas. Não foi adicionado novo modelo,
migration, dependência, persistência ou tipo de atividade.

Mapa completo: [NAVIGATION_MAP.md](NAVIGATION_MAP.md).

## Aceitação do MVP

`tests/e2e-main-flow.spec.ts` entra pelo formulário como Admin, revoga e libera
novamente o curso neural de César, sai, entra por matrícula como aluno, percorre
A/B, conclui as obrigatórias iniciais, abre o Lab de Correção de Erro, verifica
vazio e depois preenche as fórmulas reais. A aprovação do avaliador leva o curso
a 67% (quatro de seis obrigatórias). Após logout/login, o professor busca a
matrícula, confere o mesmo progresso e abre o detalhe sem expor respostas.

`tests/supabase-ui.spec.ts` conserva todas as verificações anteriores e acrescenta
o fluxo com **um aluno novo**: criação via formulário Admin e Auth Admin real do
SDK, role Student, matrícula, Curso Avulso e CourseAccess. O teste entra pela
matrícula, percorre A/B, aprova o mesmo Lab e confere 67% após refresh. O professor
consulta a nova matrícula e o detalhe persistido; César continua com seus 17%
anteriores. Os cookies são os cookies reais do Next/Supabase SSR.

Há uma precondição operacional explícita: o produto não cadastra senhas nem envia
convites nesta etapa. No teste controlado, a senha é provisionada diretamente no
serviço Auth de teste, após criar o usuário pela UI. O harness recusa criação com
senha automática. Isso representa a operação externa documentada na Etapa 19;
não há credencial nova embutida no produto nem bypass de login. No demo, novas
contas não têm credenciais: o fluxo usa César e a criação administrativa continua
coberta pelos testes históricos.

## Autoria e importação

`tests/e2e-import-flow.spec.ts` começa anônimo e autentica o professor. Faz upload
real da fixture `merged-cells.xlsx`, abre os detalhes do Compatibility Report,
confere suporte, revisa a tabela, passa pelo preview e configura uma resposta
com fórmula no Studio Editor. Salva, inspeciona a simulação do aluno, cria curso,
capítulo, dois vídeos e Lab e valida a estrutura.

Na mesma aba, Admin associa o professor e libera o curso para César. O aluno
conclui os vídeos, lê as mesclagens horizontal, vertical e retangular, incluindo
texto longo sem clipping, responde `=1+2`, aprova e atinge 100%. Professor abre o
curso novo no acompanhamento e confere a conclusão. Nenhum estado administrativo
ou de progresso é injetado no browser desses novos testes.

## Navegação, visual, permissões e console

`tests/e2e-navigation.spec.ts` cobre:

- Smoke com login por matrícula/email, Learn, Studio, Admin, refresh e logout.
- Login/home/catálogo/visão geral/capítulo/Lab em 1440×768, 1366×768, 1024×768 e
  390×844; gestão em três tamanhos desktop.
- Refresh de login, home, catálogo, curso, capítulo, Studio, Admin e Monitoring.
- Sidebar via Enter/Space, foco preservado, `aria-expanded`, seleção com foco no
  título, atividade anterior/próxima, links de retorno, Back/Forward e logo Learn.
- Todas as páginas administrativas e as rotas de autoria/importação/monitoring;
  estados controlados de curso, capítulo, usuário e rascunho inválidos/ausentes.
- Coleta automática dos links internos realmente renderizados em todas essas
  superfícies; cada destino deve responder HTTP 200. A verificação de status
  complementa a navegação UI, pois rotas protegidas no demo usam guard cliente.
- Ícone oficial declarado no HTML e asset disponível sem 404.

`tests/e2e-permissions.spec.ts` exercita Student, Teacher e Admin com login real
e URLs diretas: cada role entra em seu ambiente e é recusada nos demais, inclusive
após refresh. As shells protegidas não são montadas na recusa.

`tests/fixtures/e2e-test.ts` inicia cada caso sem AuthSession preparada. Falha
automaticamente em `pageerror`, `console.error`, hydration ou warnings críticos
de React. Não filtra erros genéricos de recurso. A nova aceitação Supabase também
confere console e busca o marcador da service role nos chunks efetivamente
entregues ao browser. Falhas HTTP deliberadas dos testes anteriores de retry são
verificadas separadamente, antes desse trecho de aceitação.

## Regressões históricas mantidas

| Requisito | Cobertura complementar preservada |
| --- | --- |
| Senha errada, inativo, returnTo, multi-role, Meus ambientes, revogação e ausência de flash | `auth-ui.spec.ts`, `auth-model.spec.ts` |
| Criação/edição, formulários, serviços, matrícula e feedback | `admin-ui.spec.ts`, `admin-model.spec.ts` |
| Filtros, busca, ordenação, cursos sem associação, aluno externo, loading e retry | `monitoring-ui.spec.ts`, `monitoring-model.spec.ts`, `supabase-ui.spec.ts` |
| Progresso, sequência, curso vazio, capítulo vazio e exercício ausente | `learn-ui.spec.ts`, `learn-progress.spec.ts`, `student-ui-refinement.spec.ts` |
| Tab/Shift+Tab, Enter/Space/Esc, setas, foco do dialog e retorno | `accessibility.spec.ts`, `student-sidebar.spec.ts`, `chapter-collapsible.spec.ts` |
| A/B/C, C.1/C.2 isolados, instâncias/IDs/ARIA independentes | `chapter-navigation-ui.spec.ts`, `chapter-collapsible.spec.ts` |
| Fórmulas, referências absolutas/relativas, abas, gráfico, proteção e validação | `formulas.spec.ts`, `spreadsheet.spec.ts`, `workbook.spec.ts`, `charts.spec.ts`, `protection.spec.ts`, `validation.spec.ts` |
| Debounce, recuperação, storage bloqueado e falha de gravação | `autosave.spec.ts`, `repository-browser.spec.ts`, `persistence.spec.ts` |
| Merges, seleção, geometria, teclado, copy/paste e recuperação | `merged-cells-ui.spec.ts`, `merged-cells.spec.tsx` |
| Supabase, service role, RLS, CourseAccess, teacher e isolamento | `supabase-ui.spec.ts`, `supabase-database.spec.ts`, `monitoring-database.spec.ts`, `persistence.spec.ts` |

Os estados sem cursos, sem exercícios, sem alunos, sem resultado de busca e
sem matrícula/serviço permanecem explícitos nos componentes existentes. Carregamentos
remotos de sessão, cursos/progresso e acompanhamento impedem montar os respectivos
dados antes da resposta. Erros de leitura oferecem Tentar novamente; a fila de
progresso oferece Tentar salvar novamente. Não foi criada uma segunda fonte de
progresso nem um carregamento artificial no modo demo síncrono.

## Bugs e correções pequenas

1. Requisição automática de `/favicon.ico` retornava 404 e gerava console.error.
   O metadata raiz aponta agora para o PNG oficial existente. Smoke confere o
   link/asset, e os testes novos exigem console sem erros.
2. Em 390 px, o botão da sidebar ultrapassava a viewport em 14 px. O CSS mobile
   posiciona o botão dentro da sidebar. As quatro regressões visuais conferem
   ausência de overflow da página, mantendo scroll interno de grades/tabelas.
3. Na visão geral mobile, a altura desktop de 80 px encobria progresso e conta.
   A altura mobile passa a ser intrínseca. A regressão mobile confere o layout
   e navega pelos controles da conta.
4. O provider Learn consultava dados de aluno para Admin/professor sem Student,
   gerando 403 desnecessário. A carga agora exige `course:study`; a permissão
   participa das dependências para também reagir à mudança de roles.
5. Após logout explícito, o provider Auth restaurava novamente a sessão ausente,
   gerando 401 desnecessário. O estado de logout já existente agora evita essa
   consulta. Recuperação inicial, refresh e validação de rotas continuam ativas.
   A aceitação Supabase exige console sem erros durante todas as trocas de conta.
6. As marcas da importação e do Editor eram imagens estáticas. Agora são links
   para Meus cursos, como nas outras telas do professor. O fluxo de importação
   confere o destino e usa a marca para retornar, conservando o exercício salvo.

Arquivos de aplicação alterados: `app/layout.tsx`, `app/learn/sidebar.css`,
`app/learn/overview.css`, `components/learn/LearnSession.tsx`,
`components/auth/AuthSession.tsx`, `app/studio/import/layout.tsx` e
`components/studio/editor/StudioToolbar.tsx`. Não foram modificados motor,
avaliador, contratos de tentativa, debounce ou regras de autorização.

A preparação dos novos testes também foi corrigida para abrir os detalhes antes
de conferir mensagens recolhidas, usar o nome real de Atividade anterior e manter
o título original do vídeo. Nenhuma asserção histórica foi removida ou afrouxada,
nem timeout aumentado. O limite já existente do build Supabase isolado permanece.

## Executar

No PowerShell desta máquina, com Node portátil:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.1-win-x64;$env:Path"
$env:NEXT_PUBLIC_DATA_MODE = "demo"
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd run test:smoke -- --workers=2
npm.cmd run test:e2e -- --workers=2
npm.cmd test -- --workers=2
npm.cmd run typecheck
npm.cmd run build
```

O Playwright inicia o aplicativo e o harness existente na 3002; pode-se fornecer
`PLAYWRIGHT_BASE_URL` para um servidor demo isolado já compilado. Não reutilize
um servidor ligado a um Supabase hospedado. O projeto Supabase controlado depende
do projeto local: incluí-lo no filtro também executa as dependências históricas.
Para diagnóstico isolado: `npm.cmd test -- tests/supabase-ui.spec.ts
--project=supabase-controlled --no-deps --workers=2`.

`test:smoke` seleciona `@smoke`; `test:e2e` seleciona os quatro arquivos de aceitação
e a integração Supabase. `npm test` continua incluindo todos os casos históricos.
Não há retries novos, downloads externos ou dependência de arquivos em Downloads.

## Capturas e checklist manual

Capturas em `test-results/etapa21-{login,home,learn,course,chapter,lab}-{largura}.png`,
`etapa21-{studio-courses,studio-editor,monitoring,admin}-{largura}.png`,
`etapa21-main-lab.png`, `etapa21-imported-learn.png` e
`etapa21-supabase-monitoring.png`. Arquivos gerados são ignorados pelo Git.

Checklist para o operador (a automação não equivale a execução humana):

- [ ] Admin cria aluno e atribui Student.
- [ ] Operador provisiona acesso no Supabase Auth, conforme Etapa 19.
- [ ] Admin gera matrícula, atribui Curso Avulso e libera curso.
- [ ] Admin associa professor ao curso.
- [ ] Aluno entra, navega pelos vídeos e conclui Lab pelo avaliador.
- [ ] Aguarda Salvo/Progresso salvo e confere curso; no Supabase, atualiza a página.
- [ ] Professor entra, localiza a matrícula e confere o mesmo progresso.
- [ ] Outra conta entra e confere sua própria identidade, respostas e progresso.

## Limitações e resultado

Demo permanece simulação local offline. Supabase usa SDK, cookies e APIs reais
contra Auth/PostgREST locais controlados; PostgreSQL/RLS/RPCs são exercitados em
testes separados com banco embarcado. Isso não é uma instalação Supabase hospedada
nem um único ambiente contendo toda a infraestrutura real de produção.

Respostas do Lab e autoria do Studio continuam voláteis. No Supabase, conclusão
de curso persiste após refresh, enquanto as respostas completas não persistem.
Vídeos demonstrativos não carregam mídia externa. A revisão não certifica WCAG,
leitor de tela, performance sob carga ou todos os navegadores. Não foram criados
certificados, mensagens, pagamentos, gamificação, notas manuais ou novos conteúdos.

### Verificação final em 24/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **311 aprovados, 0 falhos**, em aproximadamente 7,5 minutos, sem retries. 297 anteriores + 14 novos; inclui todos os E2E, smoke, PostgreSQL e Supabase controlado. |
| `npm.cmd run typecheck` | Sucesso, inclusive repetido após a suíte final. |
| `npm.cmd run build` | Sucesso; todas as rotas compiladas com as correções finais. |
| Aceitação demo | Admin libera, aluno aprova Lab, professor confere 67%; curso importado conclui 100%. |
| Aceitação Supabase | Aluno novo, matrícula, serviço, recusa antes de CourseAccess, liberação, Lab, refresh e acompanhamento aprovados; outra conta conserva seu progresso próprio. |
| Console e segurança | Novos fluxos sem erros inesperados; marcador da service role ausente dos chunks entregues. Recusas de API e RLS históricas preservadas. |
| Visual e teclado | Quatro viewports do aluno e três da gestão aprovados. 39 capturas finais geradas; amostras das dez telas solicitadas inspecionadas. |

Ambiente: Node portátil 24, Chrome, `PLAYWRIGHT_CHANNEL=chrome` e
`PLAYWRIGHT_DISABLE_GPU=1`. A rodada usou produção demo temporária na porta 3001
e o harness na 3002; Supabase compilou sua cópia isolada ao final. Os servidores
temporários foram encerrados e a cópia controlada removida, sem intervenção na
porta 3000. Resultado preservado em `test-results/.last-run.json`.

Foram inspecionados login/home/curso/capítulo/Lab em 390 px, catálogo em 1024,
visão geral em 1366, Studio Courses em 1440, Editor e Monitoring em 1024, Admin
em 1366, exercício importado e detalhe Supabase. Há rolagem vertical de documento
e rolagem interna de sidebar/tabela/grade; capturas da viewport podem mostrar
somente parte de conteúdos altos. Não foi feita comparação pixel a pixel com
uma referência externa.

As primeiras rodadas focadas identificaram os seis ajustes documentados acima e
erros de preparação dos testes novos, todos corrigidos antes desta rodada final.
Uma execução intermediária foi interrompida para recompilar os ajustes mobile.
O ambiente inicialmente recusou subprocessos com `spawn EPERM`; os testes/build
foram executados com a autorização necessária para os processos locais.

**A BI.Society possui um fluxo navegável completo e integrado, desde a administração
do aluno até sua experiência de aprendizagem e o acompanhamento pelo professor,**
nos modos e limites documentados. Etapa 21 concluída, sem iniciar nova etapa.
