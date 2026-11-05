# BI.Society — mapa de navegação

Contrato vigente nas Etapas 18–22. Roles acumulam permissões; Admin não herda
Teacher ou Student. Todos os ambientes autenticados oferecem **Minha conta →
Meus ambientes / Sair**. Nenhum atalho de UI substitui CourseAccess ou associação
docente. `/` continua sendo o Lab público histórico.

```text
Login (email ou matrícula)
 ├─ Student → /learn
 ├─ Teacher → /studio/courses
 ├─ Admin → /admin
 └─ Multi-role → /home → ambiente permitido
```

Sem sessão, uma rota protegida leva a `/login?returnTo=...`. Depois do login,
somente destinos internos autorizados são aceitos. Acesso a área indevida leva
a `/unauthorized`; curso sem liberação apresenta recusa antes de montar o curso.

## Rotas finais

| Rota | Acesso e destino |
| --- | --- |
| `/login` | Público; autenticado segue ao destino permitido. |
| `/auth/forgot-password` | Solicita email de recuperação oficial no Supabase. |
| `/auth/new-password` | Define senha mediante token recovery validado no servidor. |
| `/home` | Sessão ativa; somente cards das roles atuais. |
| `/learn` | Student; catálogo de cursos existentes e liberados. |
| `/learn/[courseId]` | Student + matrícula/serviço ativos + CourseAccess. Visão geral. |
| `/learn/[courseId]/chapter/[chapterId]` | Mesmo acesso + disponibilidade pedagógica do capítulo. |
| `/studio/courses` | Teacher; autoria persistente, filtros draft/published/archived. |
| `/studio/courses/new` | Teacher; criação de curso. |
| `/studio/courses/[courseId]` | Teacher; capítulos, atividades, validação e preview. |
| `/studio/courses/[courseId]/preview` | Professor autorizado; execução do draft sem progresso/tentativa de aluno. |
| `/studio/import` | Teacher; XLSX → relatório → revisão. |
| `/studio/import/preview` | Teacher; mesmo renderer do Lab, antes da autoria. |
| `/studio/editor` | Teacher; rascunho selecionado; sem rascunho mostra recuperação. |
| `/studio/monitoring` | Teacher; somente cursos associados e existentes. |
| `/studio/monitoring/[courseId]` | Teacher + CourseTeacher; turma, filtros, busca e ordenação. |
| `/studio/monitoring/[courseId]/student/[userId]` | Mesma associação + aluno com acesso ativo àquele curso. |
| `/admin` | Admin; painel. |
| `/admin/users` | Admin; usuários. |
| `/admin/users/new` | Admin; cadastro e roles. Não provisiona senha. |
| `/admin/users/[userId]` | Admin; dados, roles, matrícula, serviço, liberação e professor. |
| `/admin/enrollments` | Admin; vínculos educacionais. |
| `/admin/services` | Admin; Curso Avulso e vínculos. |
| `/unauthorized` | Sessão ativa; recusa controlada, Meus ambientes e Sair. |
| `/` | Lab público anterior, com persistência local independente. |

## Fluxos completos

```text
Admin
 /admin → Usuários → Criar usuário → dados + Student
 → detalhe → Gerar matrícula → Atribuir Curso Avulso → Liberar curso
 → Usuários → professor → Associar professor ao curso
 → Minha conta → Sair

Professor
 /studio/courses → Novo curso → Criar capítulo → Nova atividade
 → Importar Excel → Analisar → Detalhes da análise → Revisar abas
 → Importar e abrir no Lab → Studio Editor → configurar avaliação → Salvar
 → Meus cursos → curso → vincular exercício → Validar estrutura
 → Visualizar estrutura / Abrir como aluno (exige Student + CourseAccess)

Aluno
 /login → /learn → curso → Começar/Continuar estudos → capítulo
 → A. Video Aula → B. Video Aplicação → C. Laboratório → C.1 / C.2
 → preencher → Verificar respostas → aprovação → aguardar Salvo
 → próxima/anterior atividade → Voltar para a trilha → curso
 → Meus ambientes / Sair

Professor
 /login → /studio/courses → Acompanhamento → curso associado
 → filtrar/buscar/ordenar → aluno → capítulos, atividades e progresso
```

A/B/C vem de metadata declarativa, conforme
[CHAPTER_NAVIGATION_STANDARD.md](CHAPTER_NAVIGATION_STANDARD.md). Cursos legados
mantêm letras sequenciais por atividade. Texto/material/avaliação continuam com
seus tipos. As setas entre atividades não concluem conteúdo automaticamente.

## Marca, histórico e recuperação

- Marca no Learn → `/learn`; Studio/Monitoring → `/studio/courses`; Admin → `/admin`.
- Meus ambientes é a entrada comum para alternar roles sem sair da conta.
- Back/Forward usam rotas reais. Links internos preservam os providers da aba.
- Refresh demo mantém identidade e autoria confirmada em localStorage; restaura
  fixtures administrativas, progresso e respostas temporários. Sidebar volta expandida.
- Refresh Supabase mantém identidade, vínculos, progresso e inputs confirmados do
  Lab e autoria. Cursos canônicos e criados vêm do catálogo persistente do banco.
- Curso desconhecido no Learn é recusado pelo guard; capítulo inválido, usuário
  inexistente e rascunho ausente apresentam recuperação controlada.
- Supabase: APIs revalidam ator, roles, CourseAccess e associação docente no servidor.
  Demo conserva a simulação local documentada, sem segurança de servidor.

Evidências e reprodução: [ETAPA21_E2E_INTEGRATION.md](ETAPA21_E2E_INTEGRATION.md).
Produção e persistência atual: [ETAPA22_PRODUCTION_MVP.md](ETAPA22_PRODUCTION_MVP.md).
