# Etapa 17 — Administração, usuários, matrícula e perfis

> Registro da entrega da Etapa 17. A Etapa 18 aplica login e autorização local às
> áreas antes abertas e substitui o ator/identidade fixos pelo usuário autenticado.
> Consulte `ETAPA18_AUTH_ACCESS.md` para o comportamento atual de acesso.

Primeira estrutura administrativa da BI.Society, com estado exclusivamente em
memória por aba. Não há autenticação, backend ou dependências novas. Os documentos
POC01_SPEC, Etapas 15, 16, 16.1, 16.3 e os dois documentos de navegação interna
foram consultados antes da implementação.

## Modelo

Os contratos estão em `types/admin.ts`:

| Contrato | Responsabilidade |
| --- | --- |
| `User` | Identificador técnico, nome, email, status, `roles: Role[]` e data de criação. |
| `Role` | `student`, `teacher` e `admin`, combináveis no mesmo usuário. |
| `Permission` | `course:study`, `course:author`, `users:manage` e `services:manage`. |
| `Enrollment` | Identidade educacional: ID próprio, código de matrícula único, usuário, status e data. |
| `Service` | Oferta `standalone-course`, apresentada como Curso Avulso. |
| `UserService` | Vínculo entre usuário e serviço, com ID e status próprios. |
| `CourseAccess` | Relaciona o ID de um UserService a um curso canônico. |
| `CourseTeacher` | Relaciona um professor a um curso canônico. |
| `StudentIdentity` | Projeção pública de nome, iniciais, matrícula ativa e identificação demonstrativa. |

Usuário, matrícula e vínculo de serviço têm status `active`/`inactive`. O status
do serviço adquirido pertence ao `UserService`; o catálogo de ofertas não tem
um segundo status redundante. Matrícula não contém ID de curso nem substitui o
ID técnico do usuário. A cadeia é User → Enrollment → UserService → CourseAccess
→ Course. Nesta etapa existe uma matrícula e um vínculo por oferta por usuário;
um vínculo pode liberar vários cursos avulsos.

`generateRegistrationCode` é pura: recebe as matrículas existentes e o ano,
procura um código livre no formato AAAANNNNN e informa esgotamento da faixa.
A operação de matrícula usa a data em America/Sao_Paulo. IDs técnicos novos
usam UUID com prefixo. A matrícula demonstrativa fixa não interfere no gerador.

## Permissões e operações

`lib/admin/permissions.ts` exporta `hasRole` e `hasPermission`. O mapeamento é:
aluno → estudar; professor → autoria; administrador → gerenciar usuários e
serviços. Múltiplos perfis acumulam permissões. Usuário inativo ou ausente não
tem permissões efetivas. Não há herança implícita entre perfis.

`applyAdminCommand`, em `lib/admin/session.ts`, é uma transição pura e imutável.
Todas as operações conferem permissões antes de alterar dados, independentemente
da apresentação dos botões. Valida nome, email, email duplicado sem diferenciar
maiúsculas, perfis, status, referências e vínculos duplicados. Liberação e associação
docente repetidas são idempotentes.

Operações disponíveis na interface:

- Criar usuário e editar nome, email, status e múltiplos perfis.
- Gerar matrícula de aluno ativo e ativar/inativar matrícula existente.
- Atribuir Curso Avulso a aluno com matrícula ativa e alterar status do vínculo.
- Liberar curso existente por um vínculo ativo, com aluno e matrícula ativos.
- Associar professor ativo a um curso.

`releasedCourseIds` deriva os cursos efetivamente liberados a partir de todos
os vínculos ativos. Inativar usuário, retirar perfil aluno, inativar matrícula ou
inativar serviço suspende essa projeção, preservando os relacionamentos. Reativar
restabelece a projeção sem nova cópia de curso. As listagens de matrícula e serviço
mostram também os relacionamentos cadastrados, com status textual.

## Rotas e telas

| Rota | Conteúdo |
| --- | --- |
| `/admin` | Cards derivados de usuários, alunos ativos, professores ativos, catálogo de cursos e matrículas ativas; tabela de cursos e professores. |
| `/admin/users` | Nome, email, matrícula, perfis, status, serviços e acesso aos detalhes. |
| `/admin/users/new` | Cadastro de usuário, com seleção de múltiplos perfis. |
| `/admin/users/[userId]` | Edição, matrícula, serviços, cursos liberados e associação docente. |
| `/admin/enrollments` | Matrícula, usuário, status, serviços e cursos relacionados. |
| `/admin/services` | Curso Avulso e seus vínculos, status e cursos. |

IDs desconhecidos ou descartados após refresh mostram recuperação para a lista.
As páginas dinâmicas aguardam `params`, conforme a documentação do Next instalado.
Há acesso ao Admin pela navegação de cursos do Studio e retorno para Studio/aluno
pela sidebar administrativa. O Studio continua disponível sem restrição de perfil.

A composição administrativa tem sidebar azul-marinho, logo oficial compartilhado
por `BrandLogo`, superfície clara, cards compactos, tabelas e ações laranja.
CSS é restrito à área administrativa. Tabelas têm caption/cabeçalhos, formulários
têm labels e fieldset para perfis; mensagens usam status/alert, controles nativos
oferecem teclado e foco visível. Tabelas largas têm rolagem interna. Há skip link.

## Estado, fixtures e integrações

`AdminSessionProvider` está no layout raiz, dentro do `StudioSessionProvider`,
envolvendo o `LearnSessionProvider`. Navegação cliente entre Admin, Studio e aluno
preserva a mesma sessão. Refresh ou fechar a aba recria as fixtures. Não usa
localStorage, sessionStorage, cookies, disco ou API para os dados administrativos.

`data/admin/demo.ts` fornece três usuários demonstrativos:

- Administrador BI.Society, com perfil admin e identidade de operação `admin-demo`.
- Professor Neural, com perfil teacher e associação ao `neural-demo`.
- César, com perfil student, matrícula `202700184`, Curso Avulso ativo e liberação
  do `neural-demo`.

Os emails usam example.com. A identidade de operação administrativa é fixa e
demonstrativa, sem login ou seletor de impersonação. Se esse administrador for
inativado ou perder o perfil, o painel mostra indisponibilidade e as funções
também recusam suas operações; refresh restaura as fixtures.

`lib/courses/catalog.ts` é usado por Admin e Learn. Reutiliza os objetos de curso
demonstrativos e os cursos canônicos da sessão Studio, sem copiar capítulos ou
definições e sem duplicar IDs demonstrativos. Novos cursos e edições confirmadas
no Studio aparecem no Admin durante a navegação da mesma sessão.

Learn projeta a identidade de César usando `studentIdentity`. `StudentHeader`
recebe `StudentIdentity` por props; seu adaptador usa o contexto Learn, sem buscar
o estado Admin no header. O antigo placeholder `data/learn/student-demo.ts` foi
removido. Editar César no Admin atualiza nome/matrícula na navegação seguinte.
A visão geral mostra Professor responsável derivado de `CourseTeacher`, incluindo
múltiplos professores ativos. Nenhum painel privado de autoria é renderizado.

## Limitações preservadas

Liberações são estrutura administrativa e projeção de acesso nesta etapa. As
rotas demonstrativas e a preview de cursos Studio continuam abertas, preservando
a experiência anterior, sem autorização real. Permissões locais não constituem
barreira de segurança nem substituem a autorização futura no backend.

Não foram alterados progresso, bloqueio entre capítulos, A/B/C, definições do Lab,
avaliador, motor de planilha, proteção, gráficos ou autosave. O aluno continua
precisando aguardar Salvo antes de sair para recuperar o snapshot da sessão.
O Lab da rota `/` mantém sua persistência anterior em localStorage, independente.
A avaliação no cliente conserva os limites de privacidade documentados na Etapa 16.

Não foram implementados login, senha, OAuth, Supabase, banco remoto, API persistente,
pagamento, checkout, auditoria, email, notificações ou trilhas profissionais.
Não há concorrência entre abas, exclusão/desvinculação ou publicação nesta entrega.

## Como conferir

1. Execute `npm.cmd run dev` e abra `/admin`.
2. Crie um usuário com perfil Aluno; nos detalhes marque também Professor e salve.
3. Gere matrícula, atribua Curso Avulso, selecione o vínculo e libere um curso.
4. Associe o professor ao curso e confira usuários, matrículas, serviços e painel.
5. Inative/reative o vínculo ou a matrícula e confira a lista de cursos liberados.
6. Edite o nome de César e use Ambiente do aluno: o header deve refletir o modelo.
7. Abra o curso neural, suas atividades e o Lab existente. Volte ao Studio, crie
   um curso e acesse Administração para conferir o mesmo curso no catálogo.
8. Atualize a página para confirmar o descarte da sessão temporária.

## Verificação

Os testes novos estão em `tests/admin-model.spec.ts` e `tests/admin-ui.spec.ts`.
Cobrem permissões, validações, imutabilidade, unicidade, fluxo administrativo,
status, múltiplos perfis, listas, catálogo Studio, identidade reativa, isolamento
do storage, refresh, ausência de controles privados, teclado e três viewports.
O teste anterior do header foi atualizado somente para nome e matrícula exigidos
nesta etapa; suas verificações de progresso, layout e navegação foram mantidas.

| Verificação | Resultado final |
| --- | --- |
| `npm.cmd test -- --workers=2` | **234 aprovados, 0 falhos**: 221 anteriores + 13 novos, em aproximadamente 3,4 minutos, sem retries. |
| `npm.cmd run typecheck` | Sucesso. |
| `npm.cmd run build` | Sucesso; seis rotas administrativas adicionadas e rotas anteriores preservadas. |
| Navegador | Fluxo completo, múltiplos perfis, identidade reativa, serviços, professores, catálogo Studio, estados e refresh aprovados. |
| Layout e teclado | 1440×768, 1366×768 e 1024×768; sem rolagem horizontal da página, foco e skip link aprovados. |

Verificação com Node portátil do projeto, Chrome e renderização por software
(`PLAYWRIGHT_CHANNEL=chrome`, `PLAYWRIGHT_DISABLE_GPU=1`). A suíte executou sobre
o build de produção temporário na porta 3001, com harness existente na 3002;
servidores temporários encerrados ao terminar, sem intervenção na porta 3000.
Capturas em `test-results/admin-dashboard-{1440,1366,1024}.png` e
`test-results/admin-users-{1440,1366,1024}.png`. Foram inspecionadas as capturas
do painel em 1440/1024 e da lista em 1366, além das verificações de layout em
todos os tamanhos.

Na primeira execução focada, dois testes novos usavam `getByLabel` exato em
labels envolvendo selects; os seletores passaram a usar o papel `combobox` e
seu nome acessível. Outro seletor novo de alerta foi limitado ao main para
evitar o anunciador de rotas do Next. Nenhuma asserção ou timeout anterior foi
afrouxado. O build inicial na sandbox compilou e encontrou `spawn EPERM` na
criação dos processos de TypeScript; a execução autorizada fora dessa restrição
concluiu com sucesso.

Arquivos novos: `types/admin.ts`, `data/admin/demo.ts`, `lib/admin/permissions.ts`,
`lib/admin/session.ts`, `lib/courses/catalog.ts`, `components/admin/`, `app/admin/`,
os dois arquivos de testes Admin e este documento. Integrações alteradas:
layouts raiz/learn/cursos Studio, LearnSession, StudentHeader, CourseOverview,
teste de identidade do header e README; placeholder antigo do aluno removido.
Nenhuma dependência ou lockfile foi alterado.
