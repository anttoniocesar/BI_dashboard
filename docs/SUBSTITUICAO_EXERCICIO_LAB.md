# Substituir exercício de uma atividade Lab

Na edição do curso, a atividade Lab mostra **Exercício atual: nome · versão**,
**Editar exercício** e **Substituir exercício**. A substituição abre a biblioteca
com pesquisa por nome/versão, número de abas e última alteração. O item Atual
fica identificado e indisponível para seleção; versões diferentes do mesmo ID
são opções distintas. Itens inválidos não podem ser selecionados.

Selecione outra opção, confira a confirmação com os dois nomes/versões e clique
**Substituir**. O salvamento já acontece nessa ação, sem desvinculação temporária.
Após sucesso, a atividade mostra o novo exercício imediatamente. O fluxo
recomendado é **Substituir exercício → validar no preview → excluir exercício
antigo**, se não existirem outros vínculos.

- **Substituir:** troca o par ID + versão da atividade; mantém os dois exercícios.
- **Desvincular:** remove apenas a associação, mediante edição/remoção da atividade
  conforme as regras existentes; não apaga o exercício.
- **Excluir:** remove uma versão salva da biblioteca, somente quando sem vínculos.

O formulário de metadados da atividade mantém o vínculo atual. Para trocar um
Lab já salvo, usa-se a ação explícita acima; salvar título/obrigatoriedade depois
de uma troca não restaura o vínculo anterior. Criar uma atividade nova continua
usando o seletor existente.

## Operação e concorrência

`CourseOperation` oferece `replace-activity-exercise`, contendo curso, capítulo,
atividade, par anterior, par novo e `expectedUpdatedAt`. O domínio verifica
permissão do professor, status draft, tipo Lab, revisão/vínculo anterior,
existência, validade e acesso ao novo exercício. Só altera `activity.content`
e a data de revisão do curso. Não altera identidade, posição, título,
obrigatoriedade, capítulo ou outras atividades/exercícios.

O demo usa o mesmo `LocalCourseRepository`/storage de autoria. O repositório
relê os dados atuais e usa Web Locks quando disponíveis; só publica o novo
snapshot em memória depois de gravar. Falha de persistência mantém o anterior.
As datas de revisão dos cursos locais avançam mesmo em mutações no mesmo
milissegundo. Alteração concorrente de qualquer dado do curso ou do vínculo
anterior recusa a troca com orientação para recarregar; não tenta fundir dados.
Sem Web Locks, não há garantia de serialização entre abas concorrentes.

## Cursos publicados e histórico

A regra existente é preservada: **published e archived bloqueiam a troca de
um Lab existente**. O modal explica a preservação da atividade e oferece apenas
Cancelar. Com o versionamento posterior, use **Criar nova versão** e troque o Lab
no novo rascunho, preservando a publicação anterior. Veja
[VERSIONAMENTO_CURSOS.md](VERSIONAMENTO_CURSOS.md). Para o aceite Learn, a troca ocorre em rascunho, seguida de publicação
e liberação pelos formulários existentes.

Nenhuma operação de substituição apaga `exercise_attempts`, respostas,
StudentProgress, CourseAccess ou dados de Monitoring. O RPC não escreve nessas
tabelas. Mesmo linhas históricas de outra identidade de exercício são preservadas.
Não há migração de respostas entre planilhas estruturalmente diferentes.

`exerciseUsages` é reutilizada para informar outros vínculos do exercício antigo.
A exclusão revalida todos os vínculos: o antigo fica liberado apenas sem outros
usos; o novo passa a ficar protegido. A substituição não executa exclusão.

## Supabase

O contrato usa o mesmo `/api/courses` e `HttpCourseRepository`, sem fallback demo.
`SupabaseCourseRepository.replaceExercise` chama o RPC restrito à service role
`replace_activity_exercise`. Ele autoriza novamente o professor, bloqueia a linha
do curso e da atividade e confere revisão, vínculo anterior, status, existência
e acesso ao novo exercício na mesma transação. A atualização escreve somente
o vínculo na atividade e a revisão do curso; erro causa rollback.

Aplicar por histórico a migration incremental
`supabase/migrations/202610260001_replace_activity_exercise.sql`, após as
migrations de autoria existentes. Ela é necessária para que a conferência de
concorrência e a troca sejam atômicas no banco; não cria tabelas nem muda schemas
de progresso/tentativas. Sem o RPC instalado, a operação falha sem gravar e sem
recorrer ao demo. Nenhum Supabase hospedado foi alterado nesta tarefa.

A exclusão de exercícios no Supabase continua indisponível (HTTP 501), conforme
a limitação já documentada. Trocar um vínculo em rascunho é suportado pelo novo
RPC; excluir a versão antiga no servidor permanece um fluxo futuro separado.

## Biblioteca vazia, importação e acessibilidade

Sem alternativa válida, o modal mostra **Nenhum outro exercício disponível para
substituição** e **Importar novo exercício**. O link usa `/studio/import`, com
`returnTo` validado na URL e propagado pelo preview e Editor. **Voltar ao curso**
retorna ao curso correto para escolher a nova opção. Não há seleção automática.
O contexto de retorno sobrevive ao refresh; os dados de uma importação ainda
não salva continuam temporários. O vínculo já salvo independe da navegação e
persiste após refresh, logout/login e reinício do navegador no mesmo perfil.
Veja também `docs/NAVEGACAO_CONTEXTUAL_LAB.md`.

Cancelar recebe foco inicial; Tab/Shift+Tab permanecem no modal e Esc cancela.
O foco volta ao botão de origem após fechar, inclusive após sucesso. Controles
ficam bloqueados durante a gravação para evitar duplicação. A lista tem scroll
interno; nomes longos quebram linha. A navegação superior do Studio também quebra
linha para não causar overflow horizontal na página mobile.

## Arquivos

| Área | Arquivos |
| --- | --- |
| Operação e regras | `lib/repositories/CourseRepository.ts`, `lib/courses/authoring.ts`, `lib/courses/exerciseReplacement.ts` |
| API e persistência Supabase | `lib/server/courses.ts`, `lib/repositories/SupabaseCourseRepository.ts`, `supabase/migrations/202610260001_replace_activity_exercise.sql` |
| Atividade e modal | `components/studio/courses/ReplaceActivityExercise.tsx`, `ChapterCard.tsx`, `ActivityForm.tsx`, `CourseEditor.tsx`, `CourseStructurePreview.tsx` |
| Navegação de retorno | `lib/navigation/labReturn.ts`, `components/studio/import/ImportJourney.tsx`, `components/studio/editor/StudioLabEditor.tsx` |
| Estilo | `app/studio/courses/courses.css` |
| Testes | `tests/exercise-replacement-model.spec.ts`, `tests/exercise-replacement-ui.spec.ts`, `tests/exercise-replacement-database.spec.ts`, `tests/supabase-ui.spec.ts` |
| Documentação | Este documento, `docs/EXCLUSAO_EXERCICIOS_STUDIO.md`, `docs/PERSISTENT_COURSE_AUTHORING.md`, `docs/PILOT_CHECKLIST.md` |

Não foram modificados importador XLSX, gráficos, fórmulas, LabView, merges,
validation engine, autosave de respostas, CourseAccess, autenticação ou player.

## Aceite em 26/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **451 aprovados, zero falhas**, em 5,1 minutos: 430 anteriores e 21 novos; inclui Supabase controlado com novas verificações de troca e revisão. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno. |
| Operação de domínio | 10 testes novos: identidade/versão, atomicidade, autorização, status, revisão, falha de storage e integração com exclusão. |
| PostgreSQL | Migration aplicada em PGlite isolado; RPC, permissões, rollback, revisão e preservação integral das linhas de attempts/progresso verificados. |
| Interface | 10 testes novos: busca, Atual, confirmação, cancelar/Esc/Tab/foco, falhas, nomes iguais/versões, refresh, logout/login, reinício real do Chromium e mobile 390 px sem overflow. |
| LAB 1 → LAB 2 | Os dois arquivos originais de Downloads foram importados pelo fluxo existente, em perfil isolado. `Curso Teste Completo → Capítulo 1 — Introdução → Lab` iniciou com LAB 1, trocou para LAB 2 e manteve o vínculo após Salvar e refresh. |
| Abrir, preview e Learn | Editor abriu LAB 2; preview mostrou LAB 2; depois da publicação e liberação, Learn mostrou LAB 2 e seu gráfico no Gabarito. |
| Exclusão | LAB 1 foi bloqueado antes da troca e excluído após ficar sem vínculos. LAB 2 permaneceu bloqueado, com curso/capítulo/atividade listados. Outro vínculo do antigo mantém sua proteção, conforme teste de domínio. |
| Supabase | Interface e `/api/courses` usaram o novo RPC; reabertura preservou a troca e pedido com revisão antiga retornou 409. Dados de tentativas/progresso permaneceram iguais durante a troca de rascunho. |
| Capturas | `test-results/exercise-replacement-confirm.png` e `test-results/exercise-replacement-mobile.png`, inspecionadas. |

Foram usados `BI_SOCIETY_CHART_REGRESSION_PATH` e
`BI_SOCIETY_LAB2_REGRESSION_PATH` apontando para os originais, Node portátil em
`.tools/node-v24.22.1-win-x64`, Chromium em `.tools/playwright-browsers` e preview
de produção local na porta 3001. `test-results/.last-run.json` registra `passed`.
Os servidores temporários foram encerrados. Nenhum curso real, banco hospedado,
dependência ou lockfile foi alterado. A nova migration fica preparada para
aplicação pelo histórico no ambiente de destino.
