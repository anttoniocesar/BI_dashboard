# Etapa 18 — Login, autenticação local e controle de acesso

> Registro da Etapa 18. A Etapa 19 mantém esse modo demo e acrescenta autenticação,
> dados administrativos e progresso persistentes quando Supabase está configurado.
> Consulte `ETAPA19_SUPABASE_PERSISTENCE.md` para configuração e comportamento atual.

Autenticação demonstrativa local, integrada ao modelo administrativo da Etapa 17.
Somente a identidade da sessão é armazenada em sessionStorage. Usuários, perfis,
matrículas, serviços, liberações, cursos, exercícios e progresso continuam em
memória. Nenhuma dependência foi instalada.

## Credenciais e login

Abra `/login`. O formulário aceita matrícula ativa ou email, ignorando espaços
externos e diferenças de maiúsculas no email. A senha é comparada exatamente.
Credenciais incorretas, usuário inexistente ou inativo produzem a mesma mensagem:
“Identificação ou senha inválida.” Não há enumeração de usuários na mensagem.

| Pessoa | Email | Matrícula | Senha de desenvolvimento |
| --- | --- | --- | --- |
| César | `cesar@example.com` | `202700184` | `demo123` |
| Professor Neural | `professor@example.com` | Sem matrícula inicial | `demo123` |
| Administrador BI.Society | `admin@example.com` | Sem matrícula inicial | `demo123` |

`DemoCredential { userId, password }` é um contrato separado de `User`, em
`types/auth.ts`. As credenciais existem somente em `data/auth/demo-credentials.ts`.
Não são gravadas no modelo administrativo nem exibidas no header/menu. O formulário
identifica o ambiente como demonstração e remete às credenciais documentadas.
Novos usuários criados no Admin não recebem senha ou credencial automaticamente.

`createDemoAuthAdapter` implementa `LocalAuthAdapter`: recebe o estado administrativo
atual e resolve a credencial pelo ID técnico. Matrícula é um identificador de entrada,
não a chave da sessão. Matrícula inativa não autentica por esse código; o email
de um usuário ativo ainda pode autenticar, mas acesso a cursos exige matrícula ativa.

## AuthSession e recuperação

```ts
interface AuthSession {
  userId: string;
  authenticatedAt: string;
}
```

`AuthSessionProvider` envolve o LearnSession no layout raiz, dentro do provider
administrativo. Oferece login, logout, sessão, usuário atual e estado de recuperação.
O hook `useCurrentUser()` resolve sempre `AuthSession.userId → User` no estado
administrativo vigente. Não utiliza uma cópia dos perfis obtidos no login.

Chave: `bi-society:demo-auth-session:v1`. O valor contém somente `userId` e
`authenticatedAt`; nenhum nome, senha, perfil, matrícula, curso, progresso ou estado
Admin é copiado para storage. `parseAuthSession` recusa JSON inválido, arrays,
campos extras, IDs vazios e datas inválidas. Usuário ausente/inativo invalida a
sessão, remove a chave e leva ao login.

A recuperação ocorre no cliente. Durante esse intervalo, rotas protegidas mostram
`Carregando sessão...`; seus componentes não são montados. Se sessionStorage estiver
bloqueado ou indisponível, a tela informa que o login será mantido somente em memória.
Login e logout continuam utilizáveis sem prometer recuperação após refresh.

Refresh da mesma aba mantém a identidade autenticada, mas recria os dados Admin e
Studio a partir das fixtures. Portanto alterações temporárias em perfis, status,
serviços e cursos não sobrevivem a refresh. A autorização após recarregar usa os
dados administrativos recriados, e não os dados antigos do login. Fechar a aba
segue o ciclo de vida normal de sessionStorage do navegador, sem sessão remota.

## Rotas e guards

`components/auth/RouteGuard.tsx` aplica uma única política de navegação no layout
raiz. A decisão de acesso precede a renderização dos layouts e páginas protegidos.
As funções de decisão ficam em `lib/auth/access.ts`:

- `requireAuthenticatedUser`: usuário existente e ativo, a partir da sessão.
- `canEnterArea`: usa `hasPermission` da Etapa 17 para cada ambiente.
- `requireCourseAccess`: exige perfil Aluno, permissão de estudo e a cadeia
  administrativa ativa derivada por `releasedCourseIds`.
- `availableAreas`, `initialDestination`: seleção dos ambientes e destino inicial.
- `routeTarget`, `safeReturnTo`, `authorizedDestination`: classificação de rota,
  validação de retorno interno e verificação de permissão antes do redirecionamento.

| Rota | Requisito/comportamento |
| --- | --- |
| `/login` | Formulário público. Usuário já autenticado segue ao destino autorizado. |
| `/home` | Sessão ativa; cards somente dos ambientes permitidos. |
| `/learn` | `course:study`; lista somente cursos existentes com liberação válida. |
| `/learn/[courseId]` | Sessão, perfil student, matrícula ativa, UserService ativo e CourseAccess. |
| `/learn/[courseId]/chapter/[chapterId]` | Mesma liberação, antes das regras pedagógicas de desbloqueio do capítulo. |
| `/studio/*` | `course:author`. Não há autorização individual por curso no Studio. |
| `/admin/*` | `users:manage` ou `services:manage`. |
| `/unauthorized` | Sessão ativa; ambiente solicitado, mensagem, Meus ambientes e Sair. |
| `/` | Lab público anterior, preservado. |

Aluno não recebe acesso ao Studio/Admin; professor sem perfil adicional não recebe
Admin/Learn; administrador sem perfil adicional não recebe Studio/Learn. Múltiplos
perfis acumulam as mesmas permissões existentes, sem `user.type` e sem herança
implícita entre roles.

Curso sem liberação mostra “Acesso não autorizado” com retorno aos cursos e Meus
ambientes, sem montar header, conteúdo pedagógico ou Lab. A proteção também vale
por URL direta e navegação pelo histórico. IDs de curso desconhecidos seguem essa
mesma política. Os bloqueios entre capítulos permanecem independentes e inalterados.

## Destinos e returnTo

Sem sessão, a rota protegida leva a `/login?returnTo=...`. Depois de entrar, o
retorno é aplicado somente se for interno e permitido ao usuário atual.

O validador aceita rotas em `/home`, `/learn`, `/studio` e `/admin`. Recusa URLs
externas, protocolos, `//`, barras invertidas, caracteres de controle, fragmentos,
segmentos de travessia, escapes no caminho e destinos fora dessa lista, incluindo
o próprio login. Query strings internas não são usadas como destinos independentes.
Um retorno inválido ou incompatível com as permissões usa o destino inicial.

Um único ambiente disponível leva diretamente a `/learn`, `/studio/courses` ou
`/admin`. Múltiplos ambientes levam a `/home`, com cards de Aluno, Studio e/ou
Administração. Quem não possuir ambiente disponível recebe uma mensagem nessa tela.

## Menu, logout e estado administrativo

Os ambientes autenticados mostram a identidade atual e menu nativo Minha conta,
com nome, perfis, Meus ambientes e Sair. O header do aluno continua recebendo
`StudentIdentity` por props/contexto Learn, agora projetada do usuário autenticado.
Não existe identidade fixa de César no header ou no LearnSession.

Sair remove AuthSession e sua chave, e redireciona para `/login`. Um logout
explícito não cria `returnTo` para a área anterior. Não apaga dados administrativos,
cursos, progresso ou snapshots confirmados. A autenticação seguinte reutiliza a
mesma memória da aba, até refresh/fechamento.

O Admin deixou de executar comandos como `admin-demo` fixo. `useAdminWorkspace`
vincula a operação ao usuário autenticado; `applyAdminCommand` continua verificando
suas permissões no estado administrativo mais recente. Remover o próprio perfil
Admin revoga o painel imediatamente; inativar o usuário atual encerra a sessão.
O usuário ativo que perde outro perfil deixa de ver aquele ambiente em `/home`.

A liberação e inativação de serviços/matrículas da Etapa 17 agora afetam a navegação.
Foi acrescentado Revogar na lista de cursos liberados, com comando `revoke-course`
protegido por `services:manage`. A remoção preserva curso, matrícula e serviço;
somente remove a relação CourseAccess correspondente. O acesso deixa de valer na
próxima renderização/validação, inclusive ao revisitar uma URL pelo histórico.

Os dois cursos demonstrativos têm liberação explícita para César na fixture:
`neural-demo` e `chapter-navigation-demo`. Não há exceção no guard para demonstrações.
Cursos criados no Studio exigem liberação administrativa antes de abrir como aluno;
professor sem perfil student/liberação continua usando a preview estrutural do Studio.

## Progresso e Lab

LearnSession mantém mapas de progresso e repositórios voláteis separados por
`userId`. Sair e entrar com a mesma pessoa conserva seu progresso e respostas
confirmadas; outra pessoa começa com seus próprios dados. Essa separação fica na
composição Learn, sem modificar ExerciseLab, ExerciseDefinition, avaliador, fórmulas,
gráficos, proteção, chaves internas de tentativa ou o debounce de autosave.

O progresso continua exclusivamente em memória: refresh ainda o descarta. Aguarde
Salvo antes de sair de um Lab, conforme o contrato anterior. Navegação A/B/C,
expansão individual e agrupada, foco e critérios de conclusão permanecem iguais.
O localStorage do Lab público da rota `/` não é usado pela autenticação.

## Limites de segurança e migração

**Esta autenticação local e seus guards no cliente não são segurança real.**
Credenciais demonstrativas são texto presente no código cliente. A identidade em
sessionStorage pode ser manipulada; não é token validado, assinatura ou prova de
identidade. Não há sigilo dos dados necessários à execução e avaliação no cliente.
As rotas de UI são protegidas na navegação; o endpoint existente de importação
XLSX continua uma fronteira local de demonstração, sem autenticação de servidor.

Não foram implementados Supabase, PostgreSQL, backend persistente, OAuth, Google,
Microsoft, JWT real, cookies, recuperação de senha, confirmação de email, MFA ou
criptografia de senha. Não existe cadastro de credenciais pela interface.

Na futura autenticação real, substituir LocalAuthAdapter por serviço de backend,
remover as credenciais demonstrativas do cliente, validar sessão e autorização
em todas as rotas/APIs no servidor, persistir a cadeia administrativa e mover
avaliações privadas para a fronteira apropriada. Os DTOs de identidade e as
funções puras de permissão/acesso podem ser reutilizados, alimentados por dados
confiáveis do servidor. Essa migração não foi iniciada nesta entrega.

## Como conferir

1. Execute `npm.cmd run dev` e abra `/login`.
2. Entre com a matrícula `202700184` e senha `demo123`. Abra um curso, navegue por
   A/B/C, edite um Lab e aguarde Salvo. Use Sair e entre novamente para conferir
   a recuperação do progresso/respostas na mesma aba.
3. Tente `/admin/users` e `/studio/courses` como César: deve haver recusa de área.
4. Entre com `professor@example.com`: Studio está disponível, Admin está bloqueado.
5. Entre com `admin@example.com`: Admin está disponível. Edite seus perfis, adicione
   Professor/Aluno e abra Meus ambientes para conferir múltiplas opções.
6. Para estudar como esse usuário, gere matrícula, atribua Curso Avulso e libere um
   curso. Revogue a liberação e confira a recusa ao revisitar o curso.
7. Atualize a página: a identidade permanece, mas dados administrativos e progresso
   retornam às fixtures e ao estado inicial em memória.

## Verificação

`tests/auth-model.spec.ts` cobre autenticação por identificador, DTO de sessão,
permissões, liberações e validação de returnTo. `tests/auth-ui.spec.ts` cobre login,
erros, logout, refresh, bloqueio por área/curso/capítulo, multi-role, alterações
administrativas, revogação, isolamento por usuário, ausência de flash de conteúdo,
storage inválido/bloqueado e login responsivo.

Os testes anteriores de áreas protegidas usam `tests/fixtures/authenticated-test.ts`
para preparar exclusivamente AuthSession das pessoas demonstrativas. Os novos
testes de autenticação começam anônimos e usam o formulário real. Fluxos antigos
Studio → Learn agora passam pelo login administrativo, liberação do curso e login
do aluno na mesma aba, sem bypass de produção. As expectativas de curso inexistente
foram atualizadas para a recusa exigida nesta etapa; as verificações de progresso,
proteção, avaliação, fórmulas e isolamento foram preservadas. Testes de teclado
aguardam a recuperação da sessão e incluem o novo menu na ordem natural de foco.

| Verificação | Resultado final |
| --- | --- |
| `npm.cmd test -- --workers=2` | **257 aprovados, 0 falhos**, 234 anteriores + 23 novos; aproximadamente 5,4 minutos, sem retries. |
| `npm.cmd run typecheck` | Sucesso. |
| `npm.cmd run build` | Sucesso; quatro páginas novas: login, home, catálogo Learn e unauthorized. |
| Identidade e sessão | Matrícula/email, erros, usuário inativo, refresh, logout e storage inválido/bloqueado aprovados. |
| Autorização | Áreas, multi-role, mudança de perfis, CourseAccess, capítulo, revogação e returnTo aprovados. |
| Preservação | Progresso e tentativa conservados ao sair/entrar; outro usuário isolado; Lab e navegação anteriores aprovados. |
| Visual e teclado | Login em 1440×768, 1024×768 e 390×768 inspecionado; sem rolagem horizontal e com foco visível. |

Ambiente: Node portátil do projeto, Chrome com renderização por software,
`PLAYWRIGHT_CHANNEL=chrome` e `PLAYWRIGHT_DISABLE_GPU=1`. A suíte executou
`npm test -- --workers=2` sobre o build de produção temporário na porta 3001,
com o harness existente na 3002. Servidores temporários encerrados ao terminar;
nenhuma intervenção na porta 3000. Capturas em
`test-results/auth-login-{1440,1024,390}.png`, além das regressões visuais anteriores.

A verificação focada detectou uma disputa entre o redirecionamento de logout e o
guard anônimo, corrigida com o estado explícito de saída para não gerar returnTo
no logout. Preparações de teclado passaram a aguardar os controles após recuperar
a sessão; seletores novos foram limitados ao menu correto quando havia também um
link Meus ambientes na navegação. As verificações de foco foram preservadas e
nenhum timeout foi aumentado. A suíte completa final passou na primeira execução
com o código e os seletores corrigidos.

Arquivos novos: `types/auth.ts`, `data/auth/demo-credentials.ts`, `lib/auth/`,
`components/auth/`, `components/admin/useAdminWorkspace.ts`,
`components/learn/LearnCourses.tsx`, `app/auth.css`, páginas login/home/learn/
unauthorized, testes auth-model/auth-ui, fixture de regressão autenticada e este
documento. Integrações alteradas: layout raiz e Studio, navegação de cursos Studio,
AdminSession e componentes Admin, LearnSession, StudentHeader, fixtures Admin,
testes anteriores que acessam áreas protegidas, README e nota histórica na Etapa 17.
Nenhuma dependência ou lockfile foi alterado. Nenhum arquivo do motor, ExerciseLab,
ExerciseDefinition, avaliador, proteção, fórmulas, gráficos ou autosave foi editado.
