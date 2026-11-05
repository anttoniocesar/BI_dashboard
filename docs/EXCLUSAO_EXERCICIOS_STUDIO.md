# Exclusão de exercícios do Studio

Em **Studio → Cursos → Exercícios da sessão**, cada versão salva tem ações
**Abrir** e **Excluir**. Antes, a lista apenas mostrava título e versão e o
contrato de autoria não tinha operação de exclusão.

**Excluir** remove a versão salva da biblioteca de autoria e sua definição
derivada. **Desvincular** significa editar a atividade para remover/substituir
sua associação; não apaga o exercício. Não existe cascata neste fluxo.

## Regra

O contrato `CourseOperation` inclui `delete-exercise`, com `id` interno e
`version`. A unidade removida é o par ID + versão, já usado pela persistência.
Nomes de arquivo não identificam a exclusão. A lista usa os registros completos
do workspace para mostrar também versões distintas do mesmo ID.

O domínio `applyCourseOperation` verifica autorização e todas as atividades de
todos os cursos do workspace antes de remover. Qualquer referência, em curso
rascunho, publicado ou arquivado, gera `ExerciseInUseError`. Referência legada
sem versão bloqueia todas as versões daquele ID. O modal lista curso, capítulo
e atividade e oferece apenas Cancelar. Em rascunhos, remova/substitua o vínculo
antes; as restrições existentes de preservação de atividades publicadas continuam
valendo.

Sem vínculo, o modal mostra nome, versão, abas e última alteração, quando
disponível. Cancelar recebe foco inicial; Tab permanece no modal; Esc cancela.
Ao cancelar, o foco volta ao botão de origem. Após excluir, como o botão deixa
de existir, o foco vai para o título da biblioteca. Falha de persistência mantém
o item e mostra erro; o sucesso atualiza a lista sem refresh.

## Demo

`LocalCourseRepository` persiste em `bi-society:course-authoring:v1`. A exclusão
continua após refresh, logout/login e fechamento/reabertura do navegador no
mesmo perfil/origem. O repositório relê a persistência antes das mutações e usa
Web Locks, quando disponíveis, para serializar gravações entre abas. Em ambientes
sem Web Locks, não há garantia de serialização entre abas concorrentes.

O componente não acessa localStorage para excluir. Não escreve no armazenamento
administrativo de demonstração, nem modifica seu fluxo de restauração.
Cursos, atividades, outras versões/exercícios, respostas, attempts, progresso,
CourseAccess e Monitoring não são apagados por esta operação.

## Supabase e limites

O contrato HTTP aceita a identidade ID + versão e aplica as verificações de
domínio. Exercício em uso é recusado com HTTP 409. Sem vínculo, a exclusão é
recusada com HTTP 501: o RPC atual `save_course_authoring` não implementa uma
exclusão atômica com proteção de referências e histórico. O modal informa a
indisponibilidade e oferece apenas Cancelar. Não há fallback demo, delete
privilegiado, mudança em migrations ou limpeza de histórico de alunos.

Uma futura implementação Supabase deverá validar referências/histórico e
autorização de forma atômica no banco. Apagar conteúdo com histórico de alunos
exige fluxo administrativo separado. A persistência demo é local e não sincroniza
entre dispositivos.

## Validação

`tests/exercise-deletion-model.spec.ts` cobre identidade, versões, autorização,
vínculos de diferentes status, persistência, falhas e leitura de vínculo criado
por outra instância. `tests/exercise-deletion-ui.spec.ts` cobre modal, teclado,
foco, lista, nomes iguais, refresh, logout/login, reinício real do Chromium com
perfil temporário e o aceite LAB 1/2. `tests/supabase-ui.spec.ts` confere a recusa
pela API e interface Supabase sem alterar a persistência demo.

O aceite importa os XLSX pelos formulários existentes, em contexto isolado.
Use `BI_SOCIETY_CHART_REGRESSION_PATH` para LAB 1 e
`BI_SOCIETY_LAB2_REGRESSION_PATH` para LAB 2. Sem essas variáveis, usa a fixture
XLSX versionada. Não altera cursos hospedados nem o perfil pessoal do navegador.

## Arquivos desta implementação

| Área | Arquivos |
| --- | --- |
| Biblioteca e modal | `components/studio/courses/ExerciseLibrary.tsx`, `components/studio/courses/CourseList.tsx` |
| Visual | `app/studio/courses/courses.css` |
| Contrato e persistência demo | `lib/repositories/CourseRepository.ts`, `lib/repositories/InMemoryCourseRepository.ts` |
| Domínio e vínculos | `lib/courses/authoring.ts`, `lib/courses/exerciseDeletion.ts` |
| API Supabase | `lib/server/courses.ts` |
| Testes | `tests/exercise-deletion-model.spec.ts`, `tests/exercise-deletion-ui.spec.ts`, `tests/fixtures/exercise-deletion.ts`, `tests/supabase-ui.spec.ts` |
| Documentação | `docs/EXCLUSAO_EXERCICIOS_STUDIO.md` |

## Aceite local em 26/10/2026

- LAB 1: arquivo original `Laboratorio_1_Qualidade_Correcao_de_Erro.xlsx`
  importado como `laboratorio_1.xlsx · 0.1-draft`. Vinculado a
  `Curso Teste Completo → Capítulo 1 — Introdução → Lab`; exclusão bloqueada.
- LAB 2: o arquivo original
  `Laboratorio_2_Consumo_de_Energia_Correcao_de_Erro.xlsx` foi recusado pelo
  importador atual (HTTP 422, `Cannot read properties of undefined (reading
  'sheets')`). Esse importador não foi modificado. O aceite de exclusão foi
  concluído com a fixture XLSX salva como `laboratorio_2.xlsx · 0.1-draft`, sem
  vínculo: removida imediatamente e ausente após refresh, com curso e LAB 1
  intactos. A compatibilidade de importação do LAB 2 original permanece pendente.
- Um teste separado reiniciou o Chromium com perfil temporário persistente e
  confirmou que o exercício excluído não reaparece após novo login.

| Verificação no build final | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **415 aprovados, zero falhas**, em 4,7 minutos; 400 anteriores e 15 novos. Inclui integração Supabase controlada com testes adicionais da API e modal. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno. |
| Capturas | `test-results/exercise-deletion-confirm.png` e `test-results/exercise-deletion-linked.png`, inspecionadas. |

Nesta sessão foi usado Node portátil em `.tools/node-v24.22.1-win-x64`,
Chromium em `.tools/playwright-browsers` e preview de produção na porta 3001.
O LAB 1 original foi fornecido pela variável de regressão; LAB 2 usou a fixture
após a recusa do arquivo original. Nenhuma dependência, lockfile ou migration
foi alterada. O servidor temporário foi encerrado após as verificações.

## Atualização posterior: importação do LAB 2 corrigida

A limitação de importação registrada acima foi resolvida na tarefa seguinte.
O LAB 2 original usa SpreadsheetML com elementos qualificados (`x:workbook`,
`x:worksheet` etc.), que o parser lexical do ExcelJS não interpretava. A
normalização central por namespace corrigiu o carregamento. O aceite de
exclusão foi repetido com os **dois arquivos originais**: LAB 1 vinculado foi
bloqueado, LAB 2 sem vínculo foi excluído e permaneceu ausente após refresh.

Diagnóstico, preservação de conteúdo e fluxo Studio → Learn estão em
[IMPORTACAO_LAB2_ESTRUTURA_XLSX.md](IMPORTACAO_LAB2_ESTRUTURA_XLSX.md).

## Fluxo recomendado após a substituição direta

Para trocar o Lab em um curso rascunho, use **Substituir exercício** na
atividade, escolha outro ID + versão e confirme. Valide no preview e exclua
o antigo na biblioteca somente se ele não tiver outros vínculos. A substituição
não apaga o exercício anterior; a exclusão continua sendo uma ação separada.
Atividades publicadas/arquivadas mantêm o vínculo para preservar histórico.
Veja [SUBSTITUICAO_EXERCICIO_LAB.md](SUBSTITUICAO_EXERCICIO_LAB.md).
