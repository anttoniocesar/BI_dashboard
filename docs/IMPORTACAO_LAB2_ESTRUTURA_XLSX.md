# Importação do LAB 2 original

## Causa e reprodução

O arquivo `Laboratorio_2_Consumo_de_Energia_Correcao_de_Erro.xlsx` foi lido de
Downloads via `BI_SOCIETY_LAB2_REGRESSION_PATH`. Antes da correção, a chamada
real ao handler `POST /api/studio/import` retornou HTTP 422. A chamada direta
ao adapter registrou esta stack antes de qualquer alteração no parser:

```text
TypeError: Cannot read properties of undefined (reading 'sheets')
    at XLSX.load (.../node_modules/exceljs/lib/xlsx/xlsx.js:323:37)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
    at readXlsx (.../lib/excel-import/xlsxAdapter.ts:103:3)
```

Em `ExcelJS.XLSX.load`, a variável local `workbook`, retornada por
`await this.parseWorkbook(stream)`, estava `undefined`. A instrução seguinte
era `model.sheets = workbook.sheets`. O `WorkbookXform.parseClose` do ExcelJS
4.4.0 só cria o modelo ao receber o nome literal `workbook`. O LAB 2 usa
`x:workbook`, `x:sheets`, `x:sheet` etc., com o mesmo namespace SpreadsheetML
válido do LAB 1. O prefixo é permitido pelo XML; o parser do ExcelJS depende
do nome lexical. A falha ocorre no carregamento da biblioteca, antes da
normalização para o modelo do Lab, dos merges e da conversão de gráficos.

## Comparação dos originais

| Estrutura | LAB 1 | LAB 2 |
| --- | --- | --- |
| Abas | Laboratório, Prática, Gabarito | Laboratório, Prática, Gabarito |
| Visibilidade | Todas `visible` | Todas `visible` |
| Mesclagens | 20: 8 / 11 / 1 por aba | 20: 8 / 11 / 1 por aba |
| Fórmulas | 110, incluindo 85 fórmulas compartilhadas expandidas pelo adapter | 110 fórmulas normais |
| Gráficos detectados/importados | 1 / 1 | 1 / 1 |
| Drawing parts | 1 | 1 |
| Gráfico | `xl/charts/chart1.xml` | `xl/drawings/charts/chart1.xml` |
| Nomes definidos | 0 | 0 |
| Relações externas | 0 | 0 |
| Relações totais | 12 | 9 |
| Estilos normalizados | 29 | 29 |
| Namespace SpreadsheetML | Elementos sem prefixo, namespace padrão | Elementos qualificados com `x:` |
| `workbookPr` / `bookViews` | Presentes | Ausentes (opcionais) |

A contagem inicial por caminho `xl/charts/*` não detectava o gráfico aninhado
do LAB 2. O inventário correto segue as relações worksheet → drawing → chart:
há um gráfico de linha, **Evolução do erro absoluto por chapa**, em cada arquivo.
O caminho aninhado e a ausência das propriedades opcionais não são a causa do
TypeError; a causa é o tratamento lexical dos nomes qualificados pelo ExcelJS.

## Correção

`normalizeWorkbookStructure` valida as partes XML com Saxes, respeitando os
URIs dos namespaces, e cria uma representação previsível para o adapter.
Confere raiz do workbook e das worksheets, IDs únicos, relações obrigatórias
resolvíveis, partes locais existentes, XML válido e limites. Mantém inventários
reutilizáveis dos elementos usados pelo restante do pipeline.

Os nomes SpreadsheetML qualificados são serializados na forma reconhecida pelo
ExcelJS, sem alterar o significado do namespace, valores, fórmulas ou atributos.
Os atributos de relações também recebem prefixo canônico. Não há regra por
filename, patch em node_modules ou dependência nova. O arquivo original e as
partes usadas pelo parser próprio de gráficos permanecem intactos.

O ZIP de entrada é descompactado uma vez pelo leitor limitado. As partes já
validadas são passadas ao ExcelJS em um envelope ZIP STORE em memória, sem
recomprimir nem descompactar novamente os dados originais. Não há tentativa
dupla de parsing do arquivo. O inventário XML central substitui leituras repetidas
dos elementos no adapter; o parser de gráficos mantém seu cache de árvores.

Merges e drawings são tratados pelos parsers próprios; o ExcelJS ignora esses
nós, evitando que um drawing opcional ausente impeça ler as células. Objetos
ausentes/não suportados continuam descritos no relatório de compatibilidade.

## Erros, logs e segurança

Arquivos inválidos e estruturas não suportadas geram `ImportFailure` e HTTP 422,
com códigos distintos e mensagem de domínio. Exceções inesperadas geram HTTP 500
e `IMPORT_INTERNAL_ERROR`, sem TypeError, stack ou mensagem interna na resposta.
Falhas de nome/formato, tamanho e autorização continuam com seus status próprios.

O evento `xlsx_import` registra somente `status`, `stage`, `sheetCount`,
`parserBranch`, `chartCount` e `relationCount`. Não registra nomes, XML, fórmulas,
caminhos, conteúdo de células ou texto da exceção. O teste de falha interna
injeta um TypeError e verifica tanto a resposta sanitizada quanto o log.

Limites de ZIP/XML, CRC, bloqueio de DTD/entidades, caminhos locais e relações
externas permanecem ativos. Não são executados macros, scripts, OLE ou links.

## Testes e limites

A fixture mínima `prefixed-workbook.ts` gera SpreadsheetML com prefixo variável,
duas abas (uma oculta), propriedades opcionais ausentes, fórmulas, merges,
estilos e texto com caracteres XML. Os testes estruturais incluem drawing/relação
opcional ausentes, partes/IDs obrigatórios inválidos, namespace não suportado,
XML inválido, erro interno sanitizado e gráfico em diretório aninhado.

Os testes com os originais comparam todas as expressões explícitas de fórmula
e a quantidade total, incluindo expansão de fórmulas compartilhadas; conferem
merges, abas, visibilidade, gráfico e uma ExerciseDefinition validada. Os
diagnósticos completos são anexados aos resultados do Playwright.

Continuam valendo os limites do motor e da apresentação: as oito fórmulas com
`IF` de cada original são preservadas no modelo importado e sinalizadas como
não suportadas; sua conversão ao Lab segue a política existente de texto inerte.
Fórmulas compartilhadas do LAB 1 são expandidas e sinalizadas como suporte
parcial. Não foi adicionado suporte novo de funções Excel. Formatação condicional,
extensões e estilos avançados permanecem metadados/avisos conforme o suporte atual.

## Arquivos alterados

- `lib/excel-import/normalizeWorkbookStructure.ts`: nova normalização e validação.
- `lib/excel-import/packageReader.ts`: envelope STORE e erro de compressão de domínio.
- `lib/excel-import/xlsxAdapter.ts`: integração, inventários reutilizados e diagnósticos.
- `lib/excel-import/importWorkbook.ts`, `types.ts`: erros e contexto seguro.
- `app/api/studio/import/route.ts`: distingue falha interna de arquivo inválido.
- `tests/fixtures/xlsx/prefixed-workbook.ts`, `tests/xlsx-structure.spec.ts`:
  fixture estrutural, regressões e comparação dos originais.
- `tests/lab2-course-ui.spec.ts`: aceite do Studio ao Learn em contexto isolado.
- `docs/IMPORTACAO_LAB2_ESTRUTURA_XLSX.md`, `docs/EXCLUSAO_EXERCICIOS_STUDIO.md`:
  diagnóstico e atualização do aceite anterior.

Não foram alterados LabView, motores de fórmulas/validação, autosave, repositórios
de cursos/respostas, dependências, lockfile ou migrations.

## Resultado em 26/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | **430 aprovados, zero falhas**, em 4,6 minutos: 415 anteriores e 15 novos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno. |
| Endpoint com LAB 2 original | HTTP 200, ExerciseDefinition válida, sem TypeError. |
| Studio e previews | Todas as abas, fórmulas, gráfico, modos Normal/Expandido/Tela cheia, salvar e reabrir após refresh aprovados. |
| Curso temporário | Publicação, liberação pelo Admin e Learn aprovados; fórmula conferida na barra e avaliação temporária aprovada com resposta por fórmula. Nenhum curso real alterado. |
| Regressão LAB 1 original | HTTP 200, 110 fórmulas, 20 merges e um gráfico preservados. |
| Exclusão de exercícios | Aceite anterior repetido com os dois XLSX originais: LAB 1 vinculado bloqueado; LAB 2 sem vínculo removido de forma persistente. |
| Console e captura | Sem erros inesperados no fluxo de interface. `test-results/lab2-original-learn.png` inspecionada. |

O relatório final do LAB 2 tem 102 fórmulas suportadas, oito não suportadas
(`IF`), 21 avisos e zero erros. O LAB 1 tem 17 fórmulas suportadas, 85 parciais
(compartilhadas), oito não suportadas, 106 avisos e zero erros. Em ambos,
**um gráfico detectado e um importado**, sem gráfico descartado.

Foram usados os dois arquivos originais em Downloads, Node portátil de
`.tools/node-v24.22.1-win-x64`, Chromium de `.tools/playwright-browsers` e preview
de produção local na porta 3001. As variáveis de regressão apontaram para os
originais durante a suíte completa; não houve substituição por fixture nesse
aceite. `test-results/.last-run.json` registra `passed`. Servidor temporário
encerrado após a validação.
