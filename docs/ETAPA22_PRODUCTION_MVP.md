# Etapa 22 — MVP operacional de produção

Atualização posterior: [Autoria persistente](PERSISTENT_COURSE_AUTHORING.md)
substitui a limitação de rascunhos/cursos temporários descrita nesta entrega.
No Supabase, o catálogo publicado passa a vir das tabelas e do seed incremental;
o histórico e os resultados abaixo registram a situação original da Etapa 22.

Preparação para um primeiro piloto controlado. O operador confirmou que ainda
não existem host/projeto Supabase e solicitou preparação e validação locais.
Nenhuma conta real, migration remota, email real ou deploy público foi executado.
Os passos externos estão em [PILOT_CHECKLIST.md](PILOT_CHECKLIST.md); operação da
aula em [CLASSROOM_RUNBOOK.md](CLASSROOM_RUNBOOK.md).

Foram lidos integralmente Etapas 17–21 e NAVIGATION_MAP. Não há pagamento,
assinatura, certificados, chat, ranking, app mobile ou multi-tenant novo.

## Contexto e configuração

`BI_SOCIETY_APP_ENV` declara `development`, `test` ou `production`; por padrão usa
`NODE_ENV`. `NEXT_PUBLIC_DATA_MODE` continua sendo `demo` ou `supabase`, de forma
independente. Um build otimizado também é usado nos testes; isso não o transforma
automaticamente em um ambiente de dados real.

`lib/data/environment.ts` valida o contrato no carregamento de `next.config.ts`
(build/start) e no cliente Supabase de servidor. Produção exige as variáveis abaixo,
sem fallback silencioso. `NODE_ENV=production` exige configuração mesmo se o
contexto operacional for test. Test permite HTTP somente em localhost/127.0.0.1.

| Variável | Produção |
| --- | --- |
| `BI_SOCIETY_APP_ENV` | `production` |
| `NEXT_PUBLIC_DATA_MODE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto real |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do mesmo projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo somente no servidor |
| `APP_ORIGIN` | URL HTTPS canônica do aplicativo, sem caminho ou barra final |
| `NEXT_PUBLIC_PILOT_ONLY` | `1` |
| `NEXT_PUBLIC_PILOT_LESSON_URL` | Opcional: HTTPS direto mp4/webm/ogg |
| `NEXT_PUBLIC_PILOT_APPLICATION_URL` | Opcional: HTTPS direto mp4/webm/ogg |

`BI_SOCIETY_ALLOW_DEMO_PREVIEW=1` é uma exceção explícita para build interno/demo.
Nunca configure essa variável no host público. Sem ela, demo em produção falha.
O teste controlado declara contexto test, chaves fictícias e URLs locais explícitas.
Variáveis `NEXT_PUBLIC_*` são fixadas no build; build e runtime devem corresponder.
Use Node >=22 (validado com Node 24); não publique `.env.local`, backups ou tokens.

## Arquitetura de tentativa

```text
ExerciseLab → ExercisePersistenceController (debounce 750 ms, fila serial)
 demo     → VolatileExerciseRepository por usuário
 supabase → HttpExerciseRepository vinculado ao usuário da sessão
          → POST /api/attempts → sessão verificada + CourseAccess
          → catálogo canônico + atividade + exercício + versão
          → SupabaseExerciseRepository → RPC → PostgreSQL/RLS
```

`ExerciseRepository` mantém load/save/clear e não ganhou flush remoto no unload.
O adapter remoto exige sucesso na carga: falha ou snapshot incompatível mostra
**Tentar carregar novamente** e não permite editar um mestre vazio. Falha ao salvar
mantém a edição e oferece **Tentar salvar novamente**. Aguarde **Salvo ✓** antes
de sair, fechar o navegador ou atualizar. Alterações ainda não confirmadas não
ganham garantia de gravação no fechamento.

Migration incremental: `supabase/migrations/202610240001_exercise_attempts.sql`,
depois das duas anteriores. Cria:

- `published_lab_activities`: manifesto público de identidades, posições editáveis
  e dimensões; não contém expected, pesos, tolerâncias, feedback privado ou mestre.
- `exercise_attempts`: UUID, user/course/chapter/activity/exercise/version,
  status draft/submitted, estado JSONB, revision, created_at, updated_at e submitted_at.

A chave única é usuário + curso + capítulo + atividade + exercício + versão.
O JSONB usa o codec existente: inputs editáveis (incluindo fórmulas), aba ativa,
seleções e checkpoint de verificação. Não copia workbook, definição ou regras.
Os valores fornecidos/calculados são reconstruídos da definição canônica.

`POST /api/attempts` recebe operation load/save/clear, identity e state somente no
save. Toda leitura também usa POST para não colocar identidades em query strings.
O ator vem dos cookies, nunca de userId do corpo. `X-Expected-User` somente recusa
trocas de conta; não autentica. Campos extras, versão/atividade inexistentes,
células protegidas e conteúdo pedagógico extra são recusados.

Limites: corpo de até 256 KiB, até 2000 inputs e até 16.384 caracteres por input.
O banco também limita o JSONB a 256 KiB, valida formas/chaves, whitelist de células,
abas e seleções. O conjunto publicado atual tem 23 posições editáveis. Um payload
com caracteres multibyte pode atingir o limite de bytes antes do limite de caracteres.

RLS permite SELECT somente do próprio aluno ativo com acesso atual ao curso.
Criação/atualização/reset usam RPC restrita que deriva auth.uid() e repete acesso,
manifesto e validação. Anon não executa. Teacher/Admin não herdam leitura de respostas;
somente uma role Student adicional com sua própria matrícula/acesso permite estudar.
Não há serviço privilegiado no caminho de salvar/ler tentativas.

Concorrência MVP: última operação confirmada pelo servidor vence entre browsers;
revision cresce atomicamente e updated_at é do servidor. Na instância aberta,
gravações continuam serializadas e coalescidas pelo controlador existente. Não há
merge colaborativo ou alerta de conflito entre abas. Evite editar o mesmo Lab
simultaneamente em duas janelas no piloto.

Reset grava um tombstone (`state=null`, draft) somente na identidade ativa. Não
remove definição, outros Labs, versões nem progresso do curso. Status submitted
significa que o aluno acionou a verificação, não aprovação certificada. O avaliador
cliente continua responsável pela conclusão; não é uma nota privada em servidor.

## Publicação e versões de conteúdo

`neural-pilot`, em `data/courses/neural-pilot.ts`, é conteúdo canônico versionado
no deploy, com os conceitos, práticas e exercício neural existentes. Não depende
de um rascunho em memória para sobreviver ao reinício/deploy. O catálogo de produção
mostra somente esse curso quando `NEXT_PUBLIC_PILOT_ONLY=1`. Acesso continua exigindo
liberação administrativa; o professor associado o vê no Studio e no Monitoring.

Sem URLs de vídeo configuradas, o piloto usa orientações textuais explícitas.
Com mídia incompleta, mantém a ordem legada A/B/C por atividade, colocando a
orientação antes da prática; com ambos os vídeos, conserva os grupos A/B/C.1….
Materiais não apontam para example.com ou arquivos fictícios. URLs de mídia
opcionais precisam ser HTTPS diretas e devem ser revisadas pelo operador antes
da aula, inclusive disponibilidade, permissão de distribuição e reprodução.
Não há streaming, upload de vídeo ou hospedagem própria de arquivos.

Rascunhos do Studio e exercícios XLSX importados continuam temporários. Upload,
limites, merges, preview e editor permanecem funcionais. Para usá-los com alunos
após um deploy, é necessário promover a definição/curso para o catálogo de código
e acrescentar o manifesto correspondente em **nova migration**. Esta etapa não
cria publicação arbitrária ou persistência de toda a autoria.

Se a definição mudar, incremente `exerciseVersion` e publique um novo manifesto
de posições editáveis. Nunca altere silenciosamente o mestre da mesma versão.
Tentativas antigas continuam no banco com sua identidade anterior; não são
migradas/copied para a versão nova. A API aceita somente a definição atualmente
publicada; retenção de dados antigos não implica um seletor de versões na UI.
Para rollback, restaure também a versão de código compatível com os manifestos.

## Senha inicial e recuperação oficial

Fluxo escolhido: **reset/set password oficial do Supabase**, sem tabela de senha
ou envio de senha pelo Admin. Admin cria a conta e configura roles como antes;
**Enviar link para definir senha** solicita o email oficial para o usuário ativo.
O próprio usuário também pode usar **Esqueci minha senha** em `/login`.

Configuração necessária no Supabase hospedado:

1. Configure Site URL com `APP_ORIGIN`, sem curingas amplos de produção.
2. Autorize a URL `/auth/new-password` no projeto correto.
3. Configure SMTP de produção e teste entrega em endereços fora da equipe.
4. No template **Reset Password**, use um link para a página de definição:

   ```html
   <a href="{{ .SiteURL }}/auth/new-password#type=recovery&token_hash={{ .TokenHash }}">Definir senha</a>
   ```

O fragmento mantém o token fora dos logs HTTP e referrers. A página lê o token
e limpa a URL; a verificação ocorre por POST **somente ao enviar a nova senha**,
evitando consumo automático por um GET de scanner de email. Não há navegação para
URL arbitrária. Token inválido/expirado/reutilizado recebe recuperação controlada.
A API usa verifyOtp(type=recovery), getUser, updateUser e signOut local. A senha
deve ter 12–256 caracteres; regras adicionais de força/vazamento ficam no Auth.
Após definir senha, o usuário volta ao login. Abrir novamente uma página cujo
fragmento já foi limpo exige reabrir o link original ou solicitar outro email.

O formulário público responde de forma genérica. Há proteção local de 5 operações
por identificador/token por minuto, além do limite de login existente e dos
controles do Supabase Auth. Em hosting com múltiplas instâncias, limites de memória
não são globais: configure rate limiting/WAF do host para login/password e as
proteções Auth do provedor antes de abrir o piloto. Não foi aberto CORS global.
Mutações validam Origin contra `APP_ORIGIN`; mantenha o domínio canônico correto
atrás do proxy e redirecione domínios alternativos no host.

O Supabase recomenda SMTP próprio para produção; o serviço padrão tem restrições
de destinatários e limites inadequados para uma turma. Consulte
[SMTP oficial](https://supabase.com/docs/guides/auth/auth-smtp),
[senhas](https://supabase.com/docs/guides/auth/passwords) e
[rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Deploy e primeiro administrador

Hosting: Vercel ou servidor Node compatível com Next.js, sem export estático.
O produto usa APIs same-origin e cookies; não depende de APIs específicas do host.

1. Crie um Supabase separado para piloto; não reutilize dados sensíveis de produção.
2. Aplique migrations 001 administrativa, 002 monitoring e a migration de tentativas,
   nessa ordem, usando o histórico de migrations (`supabase db push`) ou o SQL Editor
   com registro operacional. Nunca execute reset em produção nem reaplique arquivos
   antigos manualmente: as migrations são incrementais, não scripts de reset.
3. Aplique `supabase/seed.sql` para o serviço. Não rode `--demo-users` no piloto real.
4. Crie o primeiro usuário Admin no Supabase Auth (painel confiável). No SQL Editor,
   com o UUID real confirmado, atribua explicitamente a role admin:

   ```sql
   insert into public.user_roles(user_id, role)
   values ('UUID-DO-ADMIN-CONFIRMADO'::uuid, 'admin') on conflict do nothing;
   ```

5. Configure a senha pelo fluxo oficial e confira profile ativo. Não há bootstrap público.
6. Configure as variáveis da tabela no host e no build. No Vercel selecione Next.js;
   em Node use `npm ci --include=dev`, `npm run build`, `npm run start` com proxy
   HTTPS e porta privada. O build/typecheck usa dependências de desenvolvimento;
   não as omita antes da compilação.
7. Faça deploy. O host deve oferecer limite de upload >=2 MiB e memória/tempo
   suficientes para o importador Node existente. Teste XLSX real na revisão/preview.
8. Confirme `/api/health`, `/api/ready`, Auth, Admin e acesso Learn antes de liberar alunos.

`/api/health` retorna somente `{status:"ok"}`. `/api/ready` valida configuração,
consulta o manifesto e o Auth com cliente exclusivamente servidor, devolvendo
somente ready/503 unavailable; cache em memória de 10 segundos reduz consultas.
Não retorna URL, erro interno, usuários ou chaves. Configure monitoramento externo
sem armazenar cookies/token nos logs. Cookies permanecem HttpOnly, SameSite=Lax,
Secure quando APP_ORIGIN é HTTPS.

Logging servidor usa eventos fixos e status/timestamp para login, API/autorização,
persistência e falha de importação. Não registra senha, email, token, service role,
URL com query ou conteúdo de tentativa. Logs do host/Supabase também devem ter
retenção/acesso restritos; evite body logging e tracing de dados de alunos.

## Smoke publicado

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://DOMINIO-DO-PILOTO"
# Fornecer credenciais de conta de TESTE pelo gerenciador de segredos do terminal/CI:
# PRODUCTION_SMOKE_IDENTIFIER, PRODUCTION_SMOKE_PASSWORD
$env:PRODUCTION_SMOKE_COURSE = "neural-pilot"
npm.cmd run test:production-smoke
```

Configuração separada, sem webServer local ou dependências históricas. Exige HTTPS
e credenciais explícitas. Testa health/ready, login UI, catálogo, curso, capítulo e
logout. Não cadastra contas, reseta respostas ou conclui atividades. Abrir capítulo
pode registrar a visita normal do curso; por isso use uma conta dedicada de teste.
Trace/video/screenshot estão desligados para não gerar artefatos com credenciais.
No ambiente sem host, o script deve falhar claramente por falta de configuração;
isso não equivale a um smoke remoto aprovado.

## Backup, recuperação e rollback

Política operacional proposta para piloto: backup antes da primeira aula e antes
de cada migration/deploy relevante; backup diário, retenção de pelo menos 7 diários
e 4 semanais em local protegido. Confirme capacidade real do plano contratado.
Use backups/PITR do Supabase ou dump lógico via CLI/pg_dump conforme os
[procedimentos oficiais](https://supabase.com/docs/guides/platform/backups).
Não há implementação própria de backup neste produto.

O operador deve testar restauração em um projeto separado antes do piloto e
registrar duração, ponto recuperado e resultado de Auth/vínculos/tentativas.
Não prometa RPO/RTO sem esse teste. Backup de banco não substitui cópia de arquivos
de mídia ou configuração SMTP/host. Mantenha código, manifests/migrations, versões
de deploy e configuração de segredos recuperáveis separadamente; dumps nunca no Git.

Deployment ruim: suspenda novas sessões, preserve banco, reverta o host para o
último build compatível e execute ready/smoke. Não apague tentativas e não faça
rollback destrutivo das migrations. Corrija schema por migration incremental.
Incidente de banco: faça backup do estado atual para diagnóstico, restaure primeiro
num projeto separado, confira Auth/roles/RLS/manifestos e as contas de teste A/B;
só então programe a troca do ambiente com o operador responsável.

## Testes e limites

Casos novos: `attempts-model.spec.ts`, `attempts-database.spec.ts` e extensão do
`supabase-ui.spec.ts`. A suíte controlada agora valida respostas após refresh,
logout/login, browser novo, C.1/C.2, reset sem revogar progresso, conta B vazia,
carga indisponível/retry, senha inicial por email oficial simulado, recuperação
UI, rejeição de replay e ausência de demo123/service role nos chunks.

O teste histórico que exigia respostas vazias após refresh Supabase foi atualizado
para exigir as fórmulas restauradas, conforme o novo contrato desta etapa. Não
foi removida a verificação de isolamento nem afrouxado o critério de aprovação.
Testes comuns continuam offline e demo continua volátil; os arquivos de teste
não são usados para operar o piloto. O Lab público `/` conserva seu armazenamento
local anterior. Não há certificação de avaliação server-side, histórico de notas,
publicação completa de autoria ou recuperação garantida de inputs ainda não salvos.

### Verificação local final — 24/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **319 aprovados, 0 falhos**, cerca de 6,5 minutos, sem retries; 311 históricos + 8 casos novos. |
| `npm.cmd run test:smoke` | **1 aprovado**, no preview isolado. |
| `npm.cmd run test:e2e` | **15 aprovados**, cerca de 1,5 minuto, com `--workers=2 --no-deps`; dependências históricas já verificadas na suíte completa. |
| Casos focados de tentativa/configuração | **8 aprovados** após a conferência final do fallback textual do piloto e versionamento SQL. |
| `npm.cmd run typecheck` | Sucesso. |
| `npm.cmd run build` — preview interno | Sucesso com demo explicitamente autorizado por flag. |
| `npm.cmd run build` — Supabase/production | Sucesso com configuração HTTPS sintética e catálogo pilot-only; valida compilação, não conectividade a projeto hospedado. |
| Build demo sem flag em produção | Recusado antes de compilar, com nomes das variáveis/configuração ausentes. Resultado negativo esperado. |
| Smoke remoto | Recusa URL/credenciais ausentes; aceita configuração HTTPS explícita na listagem. Não executado contra host real. |
| Senha/tentativas | Novo browser recupera fórmulas; C.1/C.2 e usuários isolados; reset não revoga progresso; definição de senha, recovery UI e recusa de replay aprovados com SDK real/serviço controlado. |
| Segurança | Migration/RLS executadas em PostgreSQL embarcado; demo123 e marcador da service role ausentes dos chunks servidos no teste Supabase. |

Uma rodada E2E intermediária encontrou uma corrida na preparação do teste antigo:
clicar no detalhe e fazer refresh imediatamente podia recarregar a lista. Foi
acrescentada a espera explícita pela URL do aluno antes do refresh; a asserção de
67% e o timeout permaneceram. A repetição dos 15 E2E passou. A coleta inicial
também levou a separar o smoke remoto do projeto local, preservando o contrato offline.

Artefatos: `test-results/.last-run.json`, `.tools/etapa22-smoke-results`,
`.tools/etapa22-e2e-results` e `.tools/etapa22-attempt-results`. Node portátil 24,
Chrome e renderização por software; preview temporário na 3001, harness na 3002,
ambos encerrados ao final. Nenhuma intervenção na porta 3000. Nenhum pacote ou
lockfile alterado. A cópia Supabase controlada foi removida após cada execução.

O último build em `.next` usa configuração Supabase **sintética de teste**, sem
segredos ou projeto real; não deve ser publicado como está. Um deploy real exige
novo build com as variáveis reais do host, conforme a checklist. Nenhuma variável
real foi gravada em `.env.local` nem em arquivos versionados.

**Preparação e validação locais da Etapa 22 concluídas.** A autorização para iniciar
o piloto com alunos depende de concluir a checklist externa: host/projeto reais,
SMTP, migrations, contas/acessos, revisão de conteúdo, backup/restauração e smoke
HTTPS publicado. Esses itens permanecem deliberadamente desmarcados, conforme a
orientação do operador de preparar e validar apenas localmente nesta entrega.
