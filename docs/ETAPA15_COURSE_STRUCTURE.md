# Etapa 15 — Curso, capítulos e atividades no BI.Society Studio

Primeira camada de organização pedagógica acima do exercício. Todo estado é
temporário na sessão Studio, sem dependências novas, banco, autenticação, matrícula
ou publicação. O Lab do aluno e sua persistência local continuam separados.

## Modelos

`types/course.ts` declara os contratos:

- `CourseDraft`: ID, título, descrição, objetivo, carga horária em horas, capa
  placeholder, serviço `standalone-course`, status `draft`, capítulos e `updatedAt`.
- `ChapterDraft`: ID, título, descrição opcional, ordem, atividades e
  `completionPolicy: "all-required-activities"`.
- `ActivityDraft`: união discriminada por `ActivityType`, com ID, título, ordem,
  `required` e conteúdo próprio de cada tipo.
- `ActivityType`: video, text, material, spreadsheet-exercise e assessment.
- `CourseStatus`: inicialmente apenas draft.
- `StudioExercise`/`ExerciseLibrary`: catálogo temporário dos exercícios salvos
  pelo professor, com draft de autoria, definição validada e última alteração.

O serviço representa **Curso Avulso**. Não há trilhas. A política de conclusão e
`required` são dados declarativos; não existe bloqueio ou progresso real do aluno.

```text
CourseDraft
  └─ ChapterDraft[]
      └─ ActivityDraft[]
          └─ content.exerciseId → ExerciseLibrary → ExerciseDefinition
```

Nenhum campo de curso/capítulo/atividade foi colocado em `ExerciseDefinition`.
Atividades Lab guardam somente `exerciseId`: não contêm cópias da definição.
A biblioteca compila o contrato já existente, sem criar outro formato de exercício.
O draft mutável e a definição compilada são as representações de autoria/execução
já estabelecidas na Etapa 14.

IDs de curso, capítulo e atividade usam UUID com prefixos, independentes de índice.
Ordem é explícita e começa em 1. Funções puras de `lib/studio/courseDraft.ts`
normalizam posições depois de criar, mover ou excluir, preservando identidades e
sem mutar arrays anteriores.

## Rotas e estado

| Rota | Comportamento |
| --- | --- |
| `/studio/courses` | Meus cursos, cards, contagens, última alteração e exercícios da sessão. |
| `/studio/courses/new` | Dados iniciais do Curso Avulso. |
| `/studio/courses/[courseId]` | Dados do curso, capítulos, atividades, validação e preview. |
| `/studio/editor` | Editor existente; abre o draft associado e retorna ao curso de origem. |

O segmento dinâmico aguarda `params` conforme o contrato do Next instalado.
O servidor entrega a rota; o estado do curso continua no cliente. Acesso direto
a ID desconhecido, refresh ou sessão vazia mostra recuperação para a lista,
sem falha de renderização.

`StudioSessionProvider`, em `app/studio/layout.tsx`, envolve a jornada de importação
existente. Guarda cursos, biblioteca e destino de retorno do editor. Navegação
cliente entre cursos/importação/editor conserva esses dados. Nada usa localStorage,
sessionStorage, cookies, disco ou API de persistência. Fechar, atualizar ou sair
do escopo Studio descarta a sessão. O rodapé e as ajudas informam esse limite.

Cancelar/reiniciar a importação limpa sua jornada de trabalho, mas não remove
cursos ou exercícios já salvos na biblioteca desta sessão. A navegação para
Importar Excel preserva uma análise em andamento; use Cancelar na importação
para escolher outro arquivo quando necessário.

## Curso e capítulos

A criação recebe título, descrição, objetivo, horas e descrição da capa. A capa
é um bloco visual com metadata/placeholder; não carrega imagem externa ou arquivo.
O card mostra Rascunho, capítulos, atividades e data/hora da última alteração.

Criar um rascunho sem capítulos é permitido para começar o trabalho. **Validar
estrutura** indica que ele ainda está incompleto. Salvar dados do curso confirma
os campos; alterações ainda digitadas nesse formulário não substituem os dados
confirmados usados na preview. Alterações estruturais são aplicadas imediatamente
à sessão e atualizam `updatedAt`.

Cada capítulo pode ser criado, ter título/descrição editados, ser movido por
Subir/Descer ou excluído. Exclusão abre dialog nativo e apaga também as atividades
contidas, sem remover os exercícios da biblioteca. Cancelar e Esc preservam o
capítulo e devolvem foco à origem; ao excluir, foco vai para a criação de capítulo.
Não há exclusão de curso, histórico ou desfazer nesta entrega.

## Atividades

| Tipo | Conteúdo |
| --- | --- |
| video | URL HTTP/HTTPS, duração opcional em minutos e obrigatoriedade. Sem player ou integração. |
| text | Texto simples, URL e nome de arquivo opcionais como metadata. |
| material | Texto simples, URL e nome de arquivo como metadata. Sem upload/download. |
| spreadsheet-exercise | ID de um exercício salvo e validado na biblioteca da sessão. |
| assessment | Descrição e obrigatoriedade; estrutura sem novo avaliador de provas. |

Todas possuem título, ordem e `required`. O formulário permite criar e editar;
Subir/Descer reorganizam dentro do capítulo. Excluir atividade é imediato.
Não há movimentação entre capítulos, drag-and-drop, HTML rico ou execução de URLs.
Links de vídeo/material são metadata inerte; não há requests a esses serviços.

O seletor Lab não permite confirmar atividade sem exercício disponível. A área
Exercícios da sessão orienta importar e salvar no editor. Cada item reutiliza a
definição existente; pontuação, fórmulas, permissões e validação do exercício
continuam sob os contratos e o motor anteriores.

## Integração com o Studio Lab Editor

1. Importe/revise o XLSX e abra o Studio Editor como na Etapa 14.
2. Configure o exercício e clique **Salvar rascunho**. O snapshot bruto mais recente
   inclui eventual edição de célula em andamento. `buildDefinition` valida antes
   de registrar o exercício na biblioteca.
3. Abra Meus cursos, crie/edite uma atividade Exercício Lab e selecione o exercício.
4. **Editar exercício** carrega uma cópia do draft associado no mesmo editor,
   preservando gráficos/metadados. Não cria outra grade ou motor.
5. Salvar substitui a entrada canônica pelo mesmo ID; todas as atividades que
   apontam para ela passam a usar a nova definição. Essa atualização compartilhada
   é explicada junto ao seletor.
6. **Voltar** retorna ao curso de origem, conservando capítulos e atividades.

Cada abertura explícita de exercício reinicia a instância de edição para não
reutilizar workbook/seleção de outro exercício mantido pela navegação. Sem salvar,
a biblioteca mantém o último snapshot confirmado. Simular respostas de aluno
continua isolado como na Etapa 14; não altera o mestre nem a entrada da biblioteca.
Não há versionamento real: salvar atualiza a mesma entrada, sem histórico.

## Validação e preview

`validateCourseDraft(course, library)` retorna diagnósticos textuais:

- Título do curso e pelo menos um capítulo.
- Títulos de capítulos e atividades; tipos de atividade conhecidos.
- IDs presentes/únicos, posições normalizadas, `required` booleano e política padrão.
- Carga horária e duração finitas, não negativas; URLs HTTP/HTTPS quando informadas.
- Atividade Lab com referência resolvida e definição aceita por
  `validateExerciseDefinition`.

O resultado é recalculado após alterações quando a validação já foi solicitada,
evitando manter um diagnóstico obsoleto. Validar não publica e não muda status.
A validação é básica para os modelos locais tipados, não um parser geral de JSON
remoto nem avaliação de qualidade pedagógica.

**Visualizar estrutura do curso** mostra capítulos/atividades na ordem, tipos,
obrigatoriedade e exercício associado, além de dados do curso. Não monta o ambiente
final do aluno, não executa vídeos nem exibe gabaritos/configuração privada.
Rascunhos incompletos também podem ser inspecionados nessa preview.

## Acessibilidade

Campos possuem labels associados; controles usam elementos nativos, texto e foco
visível. Ordenação não depende de arraste ou ícones. Após mover um item, o foco vai
para seu título, preservado pela identidade. Abrir atividade foca o título do
formulário; salvar/cancelar devolve foco ao botão de criação. Dialog é modal nativo,
com foco inicial em Cancelar e saída por Esc. Preview recebe foco no título e
devolve ao controle de origem ao sair.

Layouts 1440×1000 e 1024×768 são cobertos por regressões; em notebook os controles
estruturais se empilham. Não há otimização específica para smartphone ou certificação
de acessibilidade completa com leitores de tela reais.

## Arquivos

Criados:

- `types/course.ts`, `lib/studio/courseDraft.ts`.
- `components/studio/StudioSession.tsx`.
- `components/studio/courses/`: lista, criação, dados, editor, capítulo, formulário
  de atividade, confirmação de exclusão e preview de estrutura.
- `app/studio/courses/`: layout, estilos, lista, new e `[courseId]`.
- `tests/course-structure-model.spec.ts`, `tests/course-structure-ui.spec.ts`.
- Este documento.

Modificados: layout Studio, `ImportJourney.tsx`, `StudioImportPage.tsx`,
`StudioLabEditor.tsx`, `StudioToolbar.tsx`, `playwright.config.ts` e README. A
configuração de testes aceita `PLAYWRIGHT_DISABLE_GPU=1` para usar renderização
por software quando necessário; não altera workers, asserções ou timeouts.
Nenhuma alteração no
SpreadsheetEditor, parser, regras/nota do exercício, gráficos, repositório do
aluno, Modelo Mestre ou schema de ExerciseDefinition.

## Testes e reprodução

Casos novos cobrem criação/edição, tipos de conteúdo, capítulos, ordenação,
exclusão, confirmação/cancelamento/Esc/foco, validação incompleta, referências Lab,
mesmo editor, retorno ao curso, atualização da entrada canônica, múltiplos exercícios,
isolamento da sessão do aluno, refresh, IDs, preview e dois tamanhos de tela.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **159 aprovados, 0 falhos**; 147 anteriores + 12 novos; aproximadamente 3,6 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; lista/criação estáticas e rota dinâmica `[courseId]`, sem nova API de persistência. |
| Visual e foco | 1440×1000 e 1024×768 inspecionados; sem transbordamento horizontal; foco claro no cabeçalho escuro e nos controles. |
| Isolamento | Curso preservado entre rotas; dois exercícios independentes; storage do aluno inalterado; sem requests externos no fluxo de vínculo. |

A suíte completa final foi executada com Chrome, renderização por software,
aplicação de produção temporária na porta 3001 e harness na 3002. Nenhuma asserção,
timeout ou teste anterior foi removido ou afrouxado; não houve retries na execução
aprovada. Os servidores temporários foram encerrados ao concluir a verificação.
Capturas em `test-results/etapa-15-curso-{1440,1024}.png`.

Para testar manualmente:

1. Execute `npm run dev` e abra `http://localhost:3000/studio/courses`.
2. Novo curso → preencha dados → Criar curso. Validar estrutura deve informar
   falta de capítulo. Crie dois capítulos e use Subir/Descer.
3. Nova atividade → escolha Vídeo, Texto, Material ou Avaliação → preencha e salve.
   Edite, reordene, exclua e confira a preview.
4. Para Lab, importe uma planilha, abra o Studio Editor, configure e salve. Vá a
   Meus cursos, abra seu curso e adicione Exercício Lab pelo seletor.
5. Editar exercício → altere uma célula e salve → Voltar. Reabra o exercício para
   confirmar a definição atualizada e a estrutura preservada.
6. Excluir capítulo → Cancelar/Esc deve preservar; confirmar remove suas atividades.
7. Refresh descarta a sessão, conforme informado na interface.

### Ambiente de verificação

A execução iniciada antes da retomada do ambiente registrou timeouts com duração
de aproximadamente 6,7 horas e foi interrompida. Após a retomada, dois testes
anteriores do Lab falharam em foco/estabilidade. Um diagnóstico isolado do Chrome,
com a página visível, registrou 0 frames na configuração padrão e 61 frames com
`--disable-gpu` numa janela de cerca de um segundo. Por isso, a verificação desta
entrega usa `PLAYWRIGHT_DISABLE_GPU=1`, opção restrita ao navegador dos testes.
Não foi alterado o comportamento da aplicação para compensar esse problema.

Para reproduzir no PowerShell, configure o Node do projeto conforme README e:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
```

## Limitações de escopo

Dados apenas em memória por sessão/aba do navegador; não há recuperação após
refresh, concorrência entre janelas, exportação ou migração. O catálogo não inclui
automaticamente exercícios do aluno: entram apenas rascunhos salvos pelo professor.
CourseStatus permanece draft e URLs/arquivos/imagem são metadata/placeholder.

Não foram implementados ambiente final do aluno, montanha, progresso real,
matrícula, login, professor autenticado, banco, Supabase, publicação, trilhas,
certificados, relatórios ou qualquer etapa posterior.
