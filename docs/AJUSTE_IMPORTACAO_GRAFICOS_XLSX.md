# Gráficos XLSX no Lab

## Causa raiz e pipeline

O parser de células usa ExcelJS. A implementação anterior apenas inventariava
`xl/charts/chart*.xml` como `UNSUPPORTED`; a conversão gerava `charts: []` e o
renderizador interno aceitava somente gráficos de linha.

`parseWorkbookCharts` agora percorre worksheet → relationships → drawing/anchor
→ relationships → chart XML, conforme a estrutura
[DrawingML documentada pela Microsoft](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/how-to-insert-a-chart-into-a-spreadsheet).
Reutiliza as partes do ZIP já validadas, mantém cache das árvores XML necessárias
e não mistura parsing de gráficos com cálculo de fórmulas. Não há nova dependência.

## Suporte e propriedades

| Excel | Modelo/renderização BI.Society |
| --- | --- |
| `lineChart` 2D | Linha |
| `barChart`, direção `col` | Coluna, incluindo empilhamento simples |
| `barChart`, direção `bar` | Barra horizontal, incluindo empilhamento simples |
| `pieChart` 2D, uma série | Pizza |
| `scatterChart` 2D | Dispersão com pares X/Y por série |

O modelo existente `ChartDefinition` foi ampliado. Preserva título Unicode, nomes
de séries, nomes referenciados por células, categorias, ranges locais absolutos
ou relativos, referências entre abas, legenda/posição, títulos dos eixos,
mínimo/máximo e orientação quando representáveis. IDs são estáveis e únicos.
As referências são normalizadas para IDs de abas e ranges A1 sem `$`, mantendo
as mesmas células. Nomes de abas com espaços/apóstrofos são aceitos.

Valores com referências vêm exclusivamente de `CalculatedWorkbook` e acompanham
edições. `numCache`/`strCache` não substituem valores/categorias referenciados;
dados literais explícitos (`numLit`/`strLit`) também são aceitos. Texto de nome
pode usar o cache apenas como apresentação quando a referência não for resolvida,
com aviso. Fórmulas de células continuam sendo calculadas pelo mecanismo existente.

Anchors de duas células, uma célula e absolutos são normalizados. O Lab usa a
ordem e spans/tamanho aproximado em cards responsivos abaixo da grade, em fluxo
normal, evitando sobreposição a células, merges e resumo. A coordenada original
é mantida como metadata; não há reprodução pixel-perfect da posição Excel.
Cores, fontes, bordas, sombras e gradientes usam os padrões BI.Society.

## Relatório, segurança e limites

O relatório informa `Charts: Supported`, `Partially supported` ou `Unsupported`,
com totais detected/imported/unsupported e razões por gráfico. Sem gráficos,
nenhum aviso de charts é acrescentado. Gráficos incompatíveis não impedem a
importação das células. Remover uma aba na revisão remove seus gráficos; remover
uma origem necessária omite o gráfico dependente e informa o motivo.

Limites do MVP: 32 gráficos convertidos, 32 séries por gráfico e 200 pontos por
série. Combinações, 3D, radar, área, rosca, bolhas, percentuais empilhados, ranges
bidimensionais, nomes definidos e referências a outros arquivos não são convertidos.
Escala logarítmica é normalizada para linear com aviso. Charts sem vínculo local
com uma worksheet/drawing permanecem no inventário como não suportados.

O parsing mantém os limites ZIP/XML existentes, recusa DTD e só consulta partes
locais do pacote. Não faz fetch nem executa macros, scripts, links, OLE ou objetos.
Proteção, visibilidade/política pedagógica das abas, validação, autosave, progresso
e repositórios permanecem com suas regras existentes. Não são usados screenshots
ou imagens estáticas para representar os gráficos.

## LAB 1 real e testes

Foi usado `Laboratorio_1_Qualidade_Correcao_de_Erro.xlsx`, encontrado em Downloads.
Na aba **Gabarito**, o gráfico **Evolução do erro absoluto por chapa** foi detectado
e convertido, com categorias `A11:A18` (1 a 8), série **|e|** ligada a `J11:J18`
e anchor original de linha 21/coluna F até a região da linha 36/coluna N.

Esse arquivo local contém **nove séries**, todas preservadas, incluindo `|e|`.
Não corresponde à descrição de uma única série do pedido. Uma fixture equivalente
versionada em código reproduz separadamente o caso com **uma** série `|e|` e oito
categorias, incluindo cache propositalmente incorreto para provar o recálculo.

Os testes verificam Studio Import, Studio Editor, duas simulações e Learn,
edição reativa de células/tooltip, proteção, merges, vários gráficos e desktop/
viewports de 768 e 390 px. As capturas `lab-1-chart-studio-1440.png`,
`lab-1-chart-studio-768.png`, `xlsx-chart-learn.png` e `xlsx-chart-types-390.png`
ficam em `test-results`; as capturas reais e estreitas foram inspecionadas.
`test-results/xlsx-charts/lab-1.json` registra relatório, definição e pontos reais.

Para repetir com outro XLSX local, configure `BI_SOCIETY_CHART_REGRESSION_PATH`.
Sem essa variável, os testes usam a fixture equivalente. A suíte utiliza o preview
demo de produção local na porta 3001 e harness na 3002, como nas etapas anteriores:

```powershell
$env:NEXT_PUBLIC_DATA_MODE = "demo"
$env:BI_SOCIETY_ALLOW_DEMO_PREVIEW = "1"
npm.cmd run typecheck
npm.cmd run build
npm.cmd start -- --hostname localhost --port 3001
# Em outro terminal, com o preview aberto e Node/npm no PATH:
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
$env:BI_SOCIETY_CHART_REGRESSION_PATH = "D:\caminho\laboratorio_1.xlsx"
npm.cmd test -- --workers=2
```

## Arquivos alterados/criados

| Área | Arquivos |
| --- | --- |
| Parsing | `lib/excel-import/parseWorkbookCharts.ts`, `chartReferences.ts`, `packageReader.ts`, `xlsxAdapter.ts` |
| Modelo e normalização | `types/exercise.ts`, `lib/excel-import/types.ts`, `sheetIdentity.ts`, `normalizeWorkbook.ts`, `lib/exercises/definition.ts` |
| Conversão/relatório | `createExerciseDefinitionFromImport.ts`, `compatibility.ts`, `reviewImport.ts`, `components/studio/import/ImportSummary.tsx` |
| Dados/renderização | `lib/charts/workbookChartData.ts`, `components/charts/WorkbookChart.tsx`, `WorkbookLineChart.tsx`, `ResultCharts.tsx`, `app/globals.css` |
| Testes/fixture | `tests/xlsx-charts.spec.ts`, `tests/xlsx-charts-ui.spec.ts`, `tests/fixtures/xlsx/chart-workbook.ts` |

Arquivos do importador sem prefixo na tabela ficam em `lib/excel-import/`.

## Resultados em 25/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2`, preview de produção local | **390 aprovados, zero falhas**, em 4,6 minutos: 369 anteriores e 21 novos, incluindo integração Supabase controlada. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração de preview demo interno. |
| LAB 1 real local | Gráfico convertido no Gabarito, título preservado, nove séries incluindo `|e|`, oito categorias e referências reativas. Capturas de Studio em 1440/768 px inspecionadas. |
| Fixture equivalente | Uma série `|e|`, oito categorias; edição atualiza cálculo, curva e tooltip no mesmo renderer compartilhado com preview e Learn. |
| Cinco tipos e responsividade | Linha, coluna, barra, pizza e dispersão aprovados; sem overflow horizontal nos viewports testados. |

`test-results/.last-run.json` registra `passed`, sem testes falhos. A suíte
completa utilizou o arquivo real pela variável de regressão. Não houve alteração
de dependências ou lockfile. Os servidores temporários das verificações foram
encerrados; as portas 3001 e 3002 ficaram sem listeners.
