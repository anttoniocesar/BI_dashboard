# Células mescladas — importação, Studio e Lab

O importador já lia `mergeCell` do OOXML e preservava `mergedInto`, mas a conversão
descartava os ranges e a grade desenhava cada linha separadamente. O ajuste leva
a estrutura à definição e usa spans nativos no renderer compartilhado por Studio,
simulações, ExerciseLab e Learn. Nenhuma dependência ou lockfile foi alterado.

## Modelo, importação e validação

`Worksheet` e `ReadonlyWorkbook` aceitam `merges` opcional por aba:

```ts
type CellMerge = {
  startRow: number; startCol: number;
  endRow: number; endCol: number;
};
// Coordenadas inclusivas, base zero: A1:E1
{ startRow: 0, startCol: 0, endRow: 0, endCol: 4 }
```

Essa estrutura independe de XLSX. Definições antigas sem merges equivalem a uma
lista vazia. ImportedWorkbook/NormalizedWorkbook conservam os ranges textuais
anteriores e diagnósticos opcionais `mergeIssues`. A conversão produz CellMerge[]
na definição do Lab. `lib/spreadsheet/merges.ts` centraliza normalização, principal,
cobertura, interseção e navegação.

Ranges devem ocupar ao menos duas posições, com inteiros dentro dos limites e sem
overlap. `D4:B2` é recusado, sem ordenar silenciosamente os extremos. O primeiro
range válido é preservado; um conflito posterior é rejeitado com diagnóstico.

O adaptador reutiliza sua inspeção OOXML e a leitura de células ExcelJS. A opção
oficial `ignoreNodes: ["mergeCells"]` evita que a biblioteca lance uma exceção por
overlap antes de produzir o relatório. Os ranges inspecionados determinam as
subordinadas; os limites anteriores de ZIP/XML, células e área foram preservados.

Valor e fórmula pertencem à principal, superior esquerda. Subordinadas são vazias
com mergedInto, sem duplicar conteúdo. O motor recalcula a fórmula original da
principal, sem substituir pelo cache Excel. Referências às subordinadas continuam
sendo referências a posições vazias, sem reescrita do motor.

`validateExerciseDefinition` verifica coordenadas, limites, overlap e principal;
recusa conteúdo não vazio em célula coberta. Principal vazia é válida, inclusive
em bloco editável: a grade cria a posição mesmo sem entrada no mapa esparso.
O contrato runtime exige objetos com coordenadas normalizadas: ranges textuais
como `"A1:E1"` são aceitos na entrada do importador, mas recusados na definição.
Isso impede que a clonagem trate uma string como objeto de coordenadas.
`cloneWorkbook` copia a lista e seus objetos; `freezeWorkbook` congela a estrutura.
Draft, definição, round-trip JSON e salvar/reabrir na sessão preservam merges.
Desmarcar Formatação disponível continua omitindo-os conforme o contrato anterior.
Não foi criado exportador XLSX ou persistência nova de rascunhos.

## Renderização e estilos

SpreadsheetEditor continua sendo o mesmo componente em todos os ambientes. Em aba
mesclada, a grade externa define as tracks; wrappers de linha usam display: contents,
preservando os papéis ARIA. A principal recebe grid-column/grid-row com spans.
Subordinadas não são montadas como células, inputs ou descrições independentes.
Não existem overlays de merge. A revisão HTML SheetPreview reutiliza os mesmos
helpers e usa rowSpan/colSpan nativos da tabela existente.

- A1:E1: uma célula em cinco colunas.
- A1:A4: uma célula em quatro linhas.
- B2:D4: uma célula em três colunas e três linhas.

O bloco ocupa a soma das larguras reais. A seleção, foco e estilo pedagógico
cobrem toda a área; aria-rowspan/aria-colspan e índices descrevem a geometria.
Texto mesclado usa pre-wrap e quebra de palavras quando necessário. A altura
importada é mínima, com expansão intrínseca, inclusive em spans verticais.
O viewport mantém rolagem interna e cabeçalhos sticky.

`importedSheetPresentation` compartilha conversão básica entre revisão e Lab:
largura aproximada `width × 7 + 5` (mínimo 40 px), altura `height × 4/3` (mínimo
31 px), alinhamento horizontal/vertical suportado e wrapText. Nas abas mescladas,
as alturas são mínimos expansíveis. Não há promessa de equivalência exata de DPI,
fonte, zoom, cores, bordas, rotação, rich text ou formatos numéricos. Esses estilos
adicionais continuam como metadados, sem inferir papel pedagógico.

A revisão começa com até 10×8 posições; se um merge iniciado nessa janela cruzar
o limite, a janela cresce para incluir o bloco inteiro. O Lab na rota
`/studio/import/preview` usa diretamente SpreadsheetEditor, antes de salvar.

## Seleção, edição, teclado e persistência

Clicar em qualquer ponto visual seleciona a principal. Barra de fórmula e painel
do professor recebem esse endereço. Edição direta, F2, barra, Delete e colar alteram
somente a principal. Seleção restaurada numa posição coberta também é resolvida
visualmente para a principal. Seu papel determina proteção do bloco pelo resolver
existente. Professor conserva a edição autorizada; provided/calculated protege
todo o bloco para o aluno. Não foram reescritas precedências ou regras de papéis.

Tab/Shift+Tab percorrem principais e posições não mescladas em ordem de linha.
Setas e Enter/Shift+Enter saem do retângulo inteiro na direção pedida e resolvem
o destino para outra principal. Tab nos limites conserva a saída para barra/aba.
Durante edição, as setas continuam no input nativo; Esc mantém cancelamento e foco.

Copy/paste conserva o contrato de célula única e ajuste de referências existentes,
com conteúdo/endereço da principal. Não copia geometria nem cria merges no destino.
Não foram alterados ExerciseRepository, codec da sessão, debounce de 750 ms,
autosave, identidade de tentativa, progresso, Admin, Auth ou Supabase. A recuperação
usa a estrutura do mestre e os inputs confirmados. Mudança estrutural de mestre
continua exigindo decisão de identidade/versão; não há migração de tentativas.

## Relatório de compatibilidade

Por aba, o relatório agora informa:

- MERGES_SUPPORTED: **Merged cells: Supported**, com quantidade reproduzida.
- MERGES_PARTIALLY_SUPPORTED: **Merged cells: Partially supported**.
- INVALID_MERGE: range e motivo (overlap, inversão ou limite inválido).

MERGES_METADATA_ONLY foi substituído. O aviso de estilos distingue o subconjunto
aplicado dos estilos restantes em metadata. Proteção Excel não infere respostas.

## Fixtures, arquivo local e comparação visual

`tests/fixtures/xlsx/merged-cells.xlsx` é um XLSX real pequeno, reproduzível com
`node tests/fixtures/xlsx/create-merged-fixture.cjs`. Contém A1:E1, A3:B4, C6:F6,
H1:H4, B8:D10 e fórmula em A12:C12. Inclui textos distintos e orientação longa.
O teste confirma resultado recalculado 7, em vez do cache fictício 999.

O nome exato `laboratorio_1.xlsx` não foi localizado no workspace, anexos ou
Downloads. A regressão adicional usa
`D:/Users/50047539/Downloads/Laboratorio_1_Qualidade_Correcao_de_Erro.xlsx`, sem
editar o original. Esse arquivo contém Laboratório, Prática e Gabarito, com título
A1:H2, contexto A6:H10, objetivo A12:H12 e orientação A13:H15. Studio e simulação
do aluno mostraram esses textos completos. Não se afirma que esse arquivo de nome
diferente seja o arquivo exato citado no pedido.

`BI_SOCIETY_MERGE_REGRESSION_PATH` seleciona outro arquivo nessa regressão de
navegador. Sem a variável, usa a fixture versionada e funciona offline em CI,
sem depender de Downloads. `BI_SOCIETY_XLSX_PATH` continua disponível para análise
técnica local, conforme a Etapa 12.

Capturas de comparação em test-results: merges-review.png,
merges-import-preview.png, merges-studio-editor.png, merges-learn.png,
merges-laboratorio-studio.png e merges-laboratorio-student.png. São comparações
entre superfícies do aplicativo; não houve automação/captura do Microsoft Excel.

## Testes e verificação

Oito casos em merged-cells.spec.tsx cobrem geometria, teclado, XLSX válido/inválido,
fórmula, cópias, draft/definição/JSON, runtime, papel da principal e renderers.
Quatro casos em merged-cells-ui.spec.ts cobrem upload real, revisão, preview,
Editor, simulações, salvar/reabrir, Learn com liberação administrativa, teclado,
proteção, copy/paste e recuperação por autosave. A geometria medida confere soma
das tracks e ausência de overflow dos textos mesclados.

Os 12 casos focados passaram após corrigir a preparação do clipboard no teste:
copy/paste usa a célula ativa; o teste passou a selecionar origem e destino antes
dos eventos sintéticos. O clipboard da aplicação não foi alterado.
O teste anterior do relatório passou a exigir MERGES_SUPPORTED no lugar do aviso
antigo, preservando as demais verificações. Nenhuma asserção anterior foi removida
ou afrouxada e nenhum timeout aumentado.

A revisão final encontrou também uma contagem antiga no teste de interface do
relatório: a fixture passou de 12 para 11 avisos porque merge é agora um item OK.
O teste mantém a contagem exata atualizada e exige explicitamente
`Merged cells: Supported`, além das verificações anteriores de IF e avisos.
A validação runtime passou a recusar strings no lugar de CellMerge, null e
coordenadas fracionárias; principal vazia em mapa esparso permanece válida.

Verificação final em 23/10/2026:

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **297 aprovados, 0 falhos**, aproximadamente 3,9 minutos, sem retries: 285 anteriores e 12 de merges. Inclui PostgreSQL e Supabase local controlado. |
| `npm.cmd run typecheck` | Sucesso após os ajustes finais. |
| `npm.cmd run build` | Sucesso com o validador final; todas as rotas compiladas. |
| XLSX local em Downloads | Upload real e regressão de cabeçalhos/contexto aprovados no Studio e na simulação do aluno (1 caso adicional). |
| Inspeção visual | Capturas de import preview, Editor, Learn e laboratório local inspecionadas; spans sem divisões internas e textos com quebra preservados. |

Ambiente: Node portátil 24, Chrome, `PLAYWRIGHT_CHANNEL=chrome` e
`PLAYWRIGHT_DISABLE_GPU=1`. A suíte usou o build de produção temporário na porta
3001 e harness na 3002; a integração Supabase compilou sua cópia isolada. Não houve
intervenção na porta 3000. O primeiro build compilou, mas o ambiente bloqueou a
criação do subprocesso TypeScript (`spawn EPERM`); a execução autorizada passou.

O resultado completo permanece em `test-results/.last-run.json`, e o caso com o
arquivo local em `.tools/merges-local-regression-results/.last-run.json`. As
capturas ficam nos caminhos listados acima. A verificação não inclui um projeto
Supabase hospedado nem o arquivo de nome exato `laboratorio_1.xlsx`, indisponível
na busca realizada.
