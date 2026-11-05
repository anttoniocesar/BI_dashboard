# Persistência administrativa no modo demo

## Problema e solução

O `AdminSessionProvider` recriava `createAdminFixtures()` e um
`InMemoryAdminRepository` a cada carregamento. Cursos criados no Studio já
possuíam storage próprio, mas seus vínculos administrativos desapareciam após
refresh/reabertura. O usuário voltava às permissões das fixtures.

No modo demo resolvido pela configuração de dados, o provider agora usa
`LocalDemoAdminRepository`. O snapshot tem chave
`bi-society:demo-admin-state:v1` e envelope:

```ts
{ version: 1, state: { users, enrollments, services, userServices, courseAccess, courseTeachers } }
```

As roles e o status fazem parte dos usuários; matrícula e seu status ficam em
`enrollments`; o status dos serviços atribuídos fica em `userServices`.
São mantidos identificadores, nomes, emails, datas, códigos de matrícula e os
vínculos completos. Senhas, AuthSession, CourseDraft e respostas do Lab não fazem
parte desse snapshot.

Sem snapshot, são usadas as fixtures atuais. Havendo snapshot válido, ele é
restaurado antes de montar o `AuthSessionProvider`, evitando autenticação contra
identidades/permissões antigas. O efeito de inicialização só lê/restaura: não
grava fixtures por cima de um snapshot antes de carregá-lo.

Cada operação administrativa passa pelo `applyAdminCommand` existente. Somente
depois de ser autorizada e resultar em um estado válido, o repositório atualiza
a memória e tenta gravar o snapshot completo. Operações recusadas não escrevem.
Não há debounce nem salvamento de estados intermediários.

## Validação e versão

`lib/admin/demo-storage.ts` valida envelope e versão, campos permitidos, tipos,
roles, status, emails, datas e códigos de matrícula de nove dígitos. Também exige
IDs/emails/matrículas únicos, vínculos sem duplicatas e referências existentes
entre usuários, matrículas, serviços e acessos. Campos extras, inclusive conteúdo
de cursos ou credenciais, não são aceitos.

Usuários e vínculos inativos permanecem armazenados. A validação confere
integridade dos relacionamentos, sem exigir que estejam ativos ou concedendo
permissão por conta própria. As regras existentes continuam decidindo quem pode
entrar, estudar, gerenciar ou acompanhar cursos.

O parser não exige que `courseId` já esteja no catálogo ao restaurar: a biblioteca
do Studio carrega depois. Isso preserva acessos a cursos criados pelo professor.
Nenhum curso inteiro é copiado para o Admin.

JSON inválido, estrutura incompatível ou versão diferente de `1` são descartados
e retornam às fixtures; somente a chave administrativa é removida. Uma mudança
futura de estrutura deve atualizar a versão e definir explicitamente migração ou
invalidação. Não há migração silenciosa nem restauração parcial de payloads.

## Autenticação, cursos e limites

**localStorage demo não é backend nem segurança real**. Os dados são locais ao
navegador/origem e podem ser editados ou apagados pelo usuário. Esta persistência
serve para desenvolvimento e testes manuais.

Logout continua removendo apenas AuthSession do sessionStorage. Os snapshots
administrativo e de cursos permanecem. Um navegador/contexto novo exige login
novamente, mas as permissões e a identidade vêm dos dados administrativos
restaurados. A geração de matrícula só ocorre na operação explícita existente;
restaurar não gera outro código.

A autenticação local e suas credenciais demo não foram alteradas. Criar um
usuário administrativo não cria automaticamente uma nova senha demo. Nenhuma
senha é salva no snapshot administrativo.

O CourseRepository mantém seu storage e implementação existentes. CourseAccess
e CourseTeacher guardam `courseId`; o catálogo compartilhado integra esses vínculos
aos cursos publicados/carregados. StudentIdentity continua derivada do estado
administrativo, inclusive nome e matrícula restaurados. Progresso demo e respostas
temporárias do Learn mantêm seus contratos anteriores; este ajuste não os torna
persistentes.

No modo Supabase o provider continua usando `HttpAdminRepository`, com estado
fornecido pelo servidor. O repositório local demo não é instanciado, não acessa
localStorage e não oferece reset. Nenhuma alteração em SupabaseAdminRepository,
RLS, RPCs, APIs, migrations, AuthSession real, CourseRepository ou attempts.

## Storage indisponível e reset

Se leitura/gravação falhar, o Admin continua em memória e mostra aviso discreto.
Uma gravação posterior bem-sucedida persiste o estado atual completo e remove o
aviso. Se todo o localStorage estiver bloqueado, o coordenador `StudioPersistence`
permite abrir somente as rotas `/admin` em modo demo apesar da falha ao carregar
o catálogo local. A recuperação normal do Studio e todos os caminhos Supabase
permanecem iguais. Nenhum fallback regrava ou apaga cursos.

Em **Admin → Painel → Ambiente de demonstração**, a ação **Restaurar dados de
demonstração** usa confirmação do navegador. Ela restaura as fixtures e remove
somente `bi-society:demo-admin-state:v1`. Cursos do Studio, Lab e outras chaves
permanecem. O repositório também confere a permissão do administrador para reset.

Se a remoção do storage falhar, as fixtures são restauradas somente em memória
e o aviso explica que o snapshot anterior pode reaparecer ao reabrir. O reset
não anuncia uma exclusão persistente bem-sucedida nesse caso.

## Caso de aceite e testes

O teste de interface reproduz o caso com um curso isolado **Curso Teste Completo**:

1. Professor cria e publica o curso no Studio.
2. Admin abre César e libera o curso pelo serviço ativo.
3. Após logout/login, César abre o curso e continua vendo-o em `/learn`.
4. Admin altera seu nome, associa Professor Neural ao curso e cria outro aluno
   com matrícula e serviço.
5. O contexto original é fechado. Um novo contexto restaura o mesmo localStorage,
   sem copiar sessionStorage/AuthSession, e exige novo login.
6. César continua vendo o curso e a identidade alterada; Professor Neural vê o
   curso em Monitoring; o usuário criado mantém sua matrícula e serviço.

Esse fluxo usa o formulário e as regras reais do modo demo, sem editar os cursos
ou contas hospedadas do usuário. Os testes não fecham o navegador pessoal.

- `tests/demo-admin-storage.spec.ts`: round-trip, validação de todas as coleções,
  unicidade, referências, versões, revogação, inatividade, falhas de storage,
  permissões de reset, isolamento de outras chaves e logout.
- `tests/demo-admin-persistence-ui.spec.ts`: caso de aceite acima, identidade e
  matrícula restauradas antes da autenticação, refresh, login, revogação,
  inatividade, snapshots inválidos, confirmação/cancelamento de reset e Admin
  funcionando com localStorage bloqueado.
- `tests/admin-ui.spec.ts`: a expectativa antiga de perder o usuário no refresh
  agora exige persistência; a verificação de isolamento mantém todas as outras
  chaves e permite apenas a nova chave administrativa.
- `tests/learn-ui.spec.ts`: o cenário de curso publicado com capítulo vazio agora
  exige acesso preservado após refresh, em vez de perder a concessão demo. As
  verificações de publicação, capítulo vazio e progresso zero permanecem.
- `tests/supabase-ui.spec.ts`: instrumenta getItem/setItem/removeItem para detectar
  qualquer acesso à chave demo, exige nenhum acesso durante os fluxos Supabase e
  verifica ausência do botão de reset nessa configuração.

Para conferir manualmente, faça o fluxo de concessão, logout/login e reabertura
no mesmo navegador/perfil/origem. No Admin, confirme nome, matrícula e serviço.
Entre como professor e abra Monitoring. Revogue o acesso e repita o login do
aluno: o curso deve continuar indisponível. Para recuperar as fixtures, use o
reset administrativo confirmado; confira que o curso permanece no Studio.

As verificações usam Node portátil, Chromium do Playwright, preview demo de
produção na porta 3001 e harness na 3002, como nas etapas anteriores.

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
npm.cmd test -- --workers=2
```

Se usar o Chromium de `.tools/playwright-browsers`, configure
`PLAYWRIGHT_BROWSERS_PATH` com o caminho absoluto correspondente. As flags de
preview são somente para verificação local.

## Resultados em 25/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2`, preview de produção local | **369 aprovados, zero falhas**, em 5,8 minutos: 351 anteriores e 18 novos, incluindo integração Supabase controlada. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração de preview demo interno. |
| Curso Teste Completo → César → nova sessão/contexto | Acesso preservado no Learn; nome, matrícula, usuário criado e serviço mantidos. |
| Professor Neural → nova sessão/contexto → Monitoring | Associação ao curso preservada. |
| Supabase | Nenhuma leitura, gravação ou remoção da chave demo detectada no fluxo instrumentado; reset ausente. |
| Reset e storage bloqueado | Confirmação/cancelamento, preservação de cursos/Lab e operação em memória aprovados. Painel inspecionado em `test-results/demo-admin-reset-panel.png`. |

A primeira rodada completa encontrou somente a expectativa histórica de perder
a concessão de curso no refresh. Ela foi alinhada ao novo contrato, e a suíte
completa foi repetida com sucesso. Nenhuma verificação de autorização foi
afrouxada; revogação e inatividade continuam testadas após restauração.

`test-results/.last-run.json` registra `passed`, sem testes falhos. Não houve
alteração de dependências ou lockfile. Os servidores temporários usados nestas
verificações foram encerrados ao final.
