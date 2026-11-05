# Autoria persistente de cursos no Studio

Este ajuste substitui a limitação de autoria volátil documentada nas Etapas
15/17/19/21/22. O operador mantém a orientação de preparar e validar localmente:
não foi criado projeto hospedado, enviado email nem realizado deploy público.

## Modelo e fonte dos dados

`CourseDraft.status` aceita `draft`, `published` e `archived`. Cursos persistem
título, descrição, objetivo, carga horária, serviço, capa placeholder, criador e
datas. Capítulos persistem título/descrição, política de conclusão, posição e ID;
atividades persistem tipo, título, obrigatoriedade, grupo de navegação, posição,
ID e par `exerciseId`/`exerciseVersion`. Conteúdo próprio de vídeo, texto, material
ou avaliação mantém o contrato dos renderers existentes.

No Supabase, `courses`, `course_chapters` e `course_activities` normalizam esses
campos. Os IDs continuam textuais; capítulo e atividade têm identidade composta
com seus pais, preservando IDs canônicos repetidos entre cursos. `metadata JSONB`
contém somente dados específicos do tipo. Datas de criação são mantidas nos
upserts; alteração de ordem modifica posição, preservando identidade.

`course_exercises` guarda o rascunho de autoria e a definição de execução por
`(id, version)`, além do manifesto de posições editáveis/dimensões. A definição
de execução é construída pelo compilador existente com respostas vazias; o
rascunho e workbook do autor não são entregues ao aluno. O avaliador continua
cliente e suas regras públicas de execução seguem o contrato anterior.

## Repositórios e salvamento

`CourseRepository` oferece carga e operações de agregado: salvar curso, salvar
exercício, publicar, arquivar e excluir rascunho. Criar/editar/excluir capítulo ou
atividade e reordenar são alterações atômicas do mesmo curso. Não há uma segunda
cópia administrativa do catálogo.

- `InMemoryCourseRepository` aplica as mesmas regras de domínio nos testes.
- `LocalCourseRepository` confirma gravação em localStorage antes de substituir
  o snapshot confirmado do demo.
- `HttpCourseRepository` usa `/api/courses`, cookies reais e identidade esperada.
- `SupabaseCourseRepository` carrega a projeção autorizada e grava pelo RPC
  transacional `save_course_authoring`, disponível somente à service role no servidor.

O provider externo é ligado ao usuário por um componente abaixo do Auth; isso
evita o ciclo entre catálogo administrativo, autenticação e Studio. Carga falha
oferece tentar novamente, sem iniciar uma biblioteca vazia por cima do erro.
Operações de escrita usam fila serial; falha mostra **Alterações não salvas**.

Dados do curso têm autosave de 800 ms após edição válida. Capítulos e atividades
são persistidos ao confirmar seus formulários, reordenar ou excluir. **Salvar**
confirma o formulário de dados, respeitando sua validação. **Salvando...** e
**Salvo** descrevem a confirmação do repositório. Aguarde Salvo antes de fechar;
não há garantia de concluir operações ainda pendentes durante unload.

Salvar no Editor persiste exercício, workbook, configuração e versão. Ao reabrir,
o Editor usa a última seleção local como preferência de navegação; o conteúdo
salvo vem do repositório. A importação ainda não salva continua temporária.

## Demo e Supabase

Demo usa `bi-society:course-authoring:v1` no localStorage da origem/perfil do
navegador. Refresh e fechar/reabrir nesse mesmo perfil preservam autoria. Outro
perfil/computador não compartilha esse armazenamento. A chave
`bi-society:last-editor` é somente uma preferência de interface. Bloqueio/quota
do storage aparece como erro, sem confirmar uma gravação inexistente. O demo
continua uma simulação: Auth, administração, CourseAccess, progresso e respostas
conservam seus mecanismos anteriores, sem garantia nova de persistência local.

Supabase usa PostgreSQL através do servidor, não localStorage para conteúdo.
Outro navegador, autenticado com a mesma conta, recupera os mesmos cursos e Labs.
Aplicar as migrations incrementais pelo histórico, sem reset:

1. `202610230001_admin_auth_progress.sql`;
2. `202610230002_teacher_monitoring.sql`;
3. `202610240001_exercise_attempts.sql`;
4. `202610240002_course_authoring.sql`;
5. `202610240003_course_catalog_seed.sql`;
6. `202610260001_replace_activity_exercise.sql` — troca atômica de exercício
   em atividade Lab de rascunho, com conferência de revisão no banco;
7. `202610260002_course_versions.sql` — famílias, revisão profunda atômica,
   publicação imutável e fixação de acessos por versão concreta.

O fluxo atual para melhorar uma publicação é **Criar nova versão**, conforme
[VERSIONAMENTO_CURSOS.md](VERSIONAMENTO_CURSOS.md). A permissão anterior de editar
metadados/conteúdo publicado foi substituída por versões somente leitura.

O seed insere `neural-demo`, `chapter-navigation-demo` e `neural-pilot`, sem
duplicar/sobrescrever entidades existentes. No Supabase, esses três cursos e os
cursos criados têm uma única fonte de verdade: as tabelas. Não existe fallback
estático quando o banco falha. No demo, o catálogo estático publicado é combinado
com a autoria local, sem duplicar IDs. O conteúdo inicial do piloto é textual;
configurar mídia/conteúdo persistente no Studio antes da aula. Variáveis de mídia
do build não sobrescrevem posteriormente o catálogo do banco.

## Estados, acesso e preview

Rascunho pode ser salvo incompleto; publicar exige títulos, IDs não duplicados,
ordem/políticas válidas, URLs válidas, grupos compatíveis e referências de Labs
existentes com versão válida. Mensagens apontam os problemas encontrados.

`Visualizar como aluno` abre preview do professor, inclusive para draft, com
os renderers reais de vídeo/material/Lab. Usa repositório volátil separado e
conclusão local; não registra progresso/tentativas de aluno nem concede Student
ou CourseAccess ao professor. A visualização da estrutura anterior permanece.

`/learn` exige curso publicado **e** CourseAccess válido com matrícula/serviço
ativos. Draft e archived ficam indisponíveis ao aluno, inclusive por URL direta.
Admin vê todos os cursos persistentes e libera somente publicados pelo vínculo
administrativo existente. O criador é associado como professor no Supabase;
Monitoring projeta publicados associados e o progresso já existente.

Professor ativo edita apenas como criador ou CourseTeacher. Admin pode consultar
o catálogo inteiro, mas a role Admin isolada não autoriza autoria. O servidor
verifica sessão, usuário esperado e origem, valida estrutura/tamanho e aplica as
regras de domínio antes da escrita privilegiada. O RPC também verifica o ator
contra profiles/roles e propriedade/associação. Authenticated não tem DML direto
nas tabelas nem execução do writer. RLS restringe leituras; rascunhos de exercícios
são privados e não têm SELECT direto para authenticated. `course_workspace`
entrega somente projeções permitidas.

## Edição publicada, IDs, progresso e tentativas

Para o MVP, alterações válidas em publicado ficam disponíveis assim que salvas;
o aluno as recebe na próxima carga/refresh. Não há cópia editorial paralela.
Títulos, descrições e ordem não regeneram IDs nem apagam `student_progress` ou
`exercise_attempts`. Alterar obrigatoriedade/adicionar atividades pode modificar
o percentual calculado, preservando as conclusões por identidade.

Capítulo publicado é preservado. Atividade publicada não pode ser removida,
movida para outro capítulo, trocar de tipo nem trocar seu par Lab/versão.
Para substituir um Lab, criar outra atividade com ID próprio.
Versões de exercício referidas por curso publicado/arquivado são imutáveis:
salvar a alteração sob outra versão no Editor e vincular uma nova atividade.
O manifesto publicado é acrescentado por identidade, sem apagar versões antigas.
Tentativas antigas permanecem associadas ao par original, sem migração silenciosa.

Arquivar retira o curso de Learn e de novos acessos pela UI, preservando vínculos,
progresso, exercícios e tentativas. Republicar exige validação novamente. Exclusão
física é limitada a draft sem CourseAccess, progresso ou tentativa; curso em uso
deve ser arquivado. Rascunhos incompletos não recebem progresso pelo produto.

## Verificação e limites

Os testes de modelo cobrem armazenamento/reabertura, falha de quota, publicação,
isolamento, versões e IDs. O teste PostgreSQL executa todas as migrations/seed,
RLS e RPCs reais; valida curso persistido, catálogo sem duplicação, acesso,
progresso e inputs preservados após renomear e arquivar.

A regressão demo cobre autosave, refresh de lista/curso/preview, publicação,
archive e filtros. A aceitação Supabase controlada amplia o teste histórico com
criação por formulário, dois vídeos e Lab, fechamento real do Chrome, outro
processo/login, refresh do Editor, publicação, Admin, aluno e Monitoring.
Resultados finais das execuções serão registrados após concluir a verificação.

Não há colaboração simultânea, merge de edições concorrentes, revisão editorial,
aprovação, marketplace ou novos meios de pagamento. Uma edição por curso/vez:
a última gravação aceita prevalece. Limite de requisição de autoria: 2 MiB.
Sem projeto hospedado, a validação local não comprova SMTP, disponibilidade,
backups ou operação real do piloto; continuar a checklist externa antes da aula.
