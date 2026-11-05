# Etapa 12 — Motor de importação XLSX

Atualização posterior: mesclagens agora chegam ao workbook do Lab e são
reproduzidas no Studio e no aluno, com spans nativos, validação e seleção da
principal. Estrutura, comportamento e testes estão em
[AJUSTE_CELULAS_MESCLADAS.md](AJUSTE_CELULAS_MESCLADAS.md). O restante registra
o escopo e os resultados históricos da Etapa 12.

Esta etapa entrega uma API técnica de leitura e conversão, sem tela de upload,
Studio, backend ou publicação. O exercício neural e sua sessão local permanecem
na página principal. `SpreadsheetEditor` não foi alterado e não conhece bibliotecas
Excel. O arquivo importado pode ser demonstrado no mesmo `ExerciseLab` pelo harness
de testes existente.

## Bibliotecas e decisão

Foram avaliados SheetJS CE e ExcelJS. SheetJS CE tem licença
[Apache-2.0](https://docs.sheetjs.com/docs/miscellany/license/) e distribuição oficial
[pelo CDN do projeto](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/).
Não foi instalado o pacote npm antigo de SheetJS nem assumida uma edição comercial.

A escolha foi **ExcelJS 4.4.0**, versão estável consultada no registro npm, com
[licença MIT](https://github.com/exceljs/exceljs/blob/v4.4.0/LICENSE). A
[documentação oficial](https://github.com/exceljs/exceljs/tree/v4.4.0) descreve leitura
XLSX, células, estilos e proteção; o pacote fornece `index.d.ts` e uma distribuição
browser. Para este escopo, sua API de estilos atende diretamente negrito, itálico,
alinhamento, preenchimento, cores, formato numérico e dimensões. Foi priorizado esse
subconjunto concreto, sem tentar converter todo recurso do Excel.

Foi adicionado também **saxes 6.0.0**, parser XML com tipos TypeScript e
[licença ISC](https://github.com/lddubeau/saxes/blob/v6.0.0/LICENSE), para inspecionar
metadados OOXML com namespaces sem usar regex como parser XML. As versões diretas
estão fixadas no `package.json` e os transitivos no lockfile. Os avisos de dependências
descontinuadas emitidos na instalação de ExcelJS ficam como limitação de manutenção;
esta entrega não certifica a cadeia de dependências. Avisos/notices de licença dos
pacotes devem ser mantidos na distribuição.

**Ambiente adotado:** o adaptador desta POC requer Node.js (`Buffer`, `node:zlib`
e `node:path`). É compatível com o runtime Node do Next.js e com TypeScript strict,
mas não é um módulo para importar em Client Components ou Edge Runtime. Não foi
criado endpoint/serviço de backend. O teste lê os bytes em Node e entrega somente
o descriptor serializável ao mesmo Lab cliente. O parser não entra no bundle da
página do aluno; a existência de uma versão browser do ExcelJS não muda essa decisão.

## Pipeline e API

```text
Uint8Array + nome .xlsx
  → inspeção limitada do ZIP/OOXML
  → ExcelJS no adaptador
  → ImportedWorkbook
  → normalização + compatibilidade de fórmulas
  → NormalizedWorkbook + ImportReport
  → createExerciseDefinitionFromImport
  → ExerciseLab + ExerciseRepository existente
```

```ts
const result = await importWorkbook(bytes, "exercicio.xlsx");
if (!result.ok) {
  // result.report.items contém erros claros; nenhum editor deve ser montado.
  return result.report;
}
const definition = createExerciseDefinitionFromImport(result.workbook, {
  id: "meu-exercicio", version: "1", title: "Exercício importado"
});
// Na composição cliente: <ExerciseLab definition={definition} repository={repository} />
```

`id` e `version` são explícitos. Uma alteração do conteúdo exige uma decisão de
identidade/versão pelo chamador, evitando reutilizar acidentalmente progresso de
outro mestre. O título padrão é o nome do arquivo sem `.xlsx`. Nada é salvo ou
publicado automaticamente durante a importação.

## Modelo intermediário próprio

`lib/excel-import/types.ts` separa os formatos brutos do descriptor pedagógico:

- `ImportedWorkbook` contém nome do arquivo, abas ordenadas, gráficos e inventário
  de partes/recursos, nomes definidos, autor e sistema de datas.
- `ImportedWorksheet` guarda nome, ordem, intervalo utilizado, dimensões, células,
  colunas, linhas, mesclagens, visibilidade e proteção Excel como metadata.
- `ImportedCell` distingue texto, número, booleano, vazio, data, erro e fórmula.
  Uma célula pode ter estilo, hyperlink inerte ou referência à célula mestre da mesclagem.
- `ImportedFormula` preserva expressão com `=`, espécie normal/compartilhada/matricial
  e resultado em cache, quando disponível. O cache nunca substitui a expressão.
- `ImportedStyle` representa o subconjunto básico em tipos próprios. Cores podem
  continuar como ARGB ou referências de tema; não se inventa sua resolução visual.
- `NormalizedWorkbook` tem `schemaVersion: 1`, IDs internos, mapas esparsos de
  células por endereço e estilos deduplicados por ID. Fórmulas incluem classificação,
  funções encontradas, motivos e indicação de bloqueio.

Os IDs de abas são `s-` seguido dos bytes UTF-8 do nome em hexadecimal. São estáveis
para o mesmo nome e independem da ordem; não dependem de slug, acentos, espaços ou
nomes válidos como identificadores de código. Nomes inválidos ou duplicados sem
distinção de caixa são erros claros antes do parser, sem renomeação silenciosa.

Dimensões consideram intervalo declarado, células armazenadas e mesclagens; a grade
parte de A1 e vai até a maior linha/coluna. O intervalo original pode começar depois
de A1. Uma aba vazia sem intervalo recebe 1×1 e um aviso. Abas ocultas são preservadas
como metadata e expostas pelo Lab, também com aviso. Não se assume 40×12.

## Conversão para o modelo atual do Lab

Política padrão: **todas as células fornecidas/protegidas**, inclusive quando uma
célula era desbloqueada no Excel. Há uma opção técnica `cellPolicy: "editable"`
para tornar toda a grade editável; não há seleção ou mapeamento de respostas.
Proteção Excel nunca determina automaticamente um papel pedagógico.

O descriptor mínimo contém mestre congelado, dimensões por aba em `sheets`, título,
subtítulo explícito de importação técnica, `validationRules: []`, `charts: []` e
`completion.minimumScore: 100`. Esse corte é **provisório**, sem gabarito ou pontuação:
o avaliador existente não conclui um exercício sem regras. A conversão é validada
por `validateExerciseDefinition` antes de ser devolvida.

O workbook textual atual exige algumas adaptações declaradas:

| Fonte | Modelo normalizado | Descriptor/grade atual |
| --- | --- | --- |
| Número | Número JavaScript | String numérica; cálculo existente. |
| Texto comum | Texto original | Texto original. |
| Texto numérico `001` | Texto, sem perder zeros | `="001"`, para preservar tipo no recálculo. |
| Texto iniciado por `=` | Texto, não fórmula | Constante textual entre aspas, sem executar sua aparência de fórmula. |
| Booleano | `true` / `false` | `=TRUE` / `=FALSE`; aviso de adaptação. |
| Data | ISO + formato numérico | Texto ISO; sem semântica de data/serial Excel. |
| Erro Excel de origem | Tipo erro e conteúdo | Texto; propagação de erro de origem não é equivalente à do Excel. |
| Fórmula compatível | Expressão original + cache separado | Expressão original, recalculada pelo motor do Lab. |
| Fórmula não habilitada, como IF | Expressão + motivo | Expressão preservada; motor atual mostra seu erro, como `#NAME?`. |
| Fórmula externa/ativa bloqueada | Expressão original + `blocked` | Constante textual inerte com a expressão; não é enviada como operação ao motor. |
| Célula subordinada de mesclagem | Vazio + `mergedInto` | Vazio; não duplica o valor da célula mestre. |

Não foram adicionadas funções ao motor. A única alteração no adaptador de cálculo
foi exportar a lista congelada das sete funções já existentes para evitar uma
segunda lista divergente no importador.

## Compatibilidade de fórmulas

Classificações: `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`.

O analisador usa lexer/parser de dependências do motor atual, **sem avaliar a
fórmula Excel ou seu cache**. Reconhece `SUM`, `AVERAGE`, `MIN`, `MAX`, `ABS`,
`SQRT`, `POWER`, referências relativas, absolutas/mistas e referências qualificadas
entre abas. Mantém a expressão, incluindo `$` e nomes entre aspas.

Uma referência fora da grade efetivamente importada ou uma fórmula
compartilhada/matricial recebe revisão parcial. A expressão compartilhada pode ser
reconstruída pelo ExcelJS, mas o Lab não ganha semântica de spill/matriz. Função
não habilitada, nome definido, referência estruturada/3D ou sintaxe não reconhecida
é reportada como não suportada. Texto entre aspas não é confundido com função/link.

`SUPPORTED` descreve compatibilidade com o subconjunto, não uma prova de equivalência
total com Excel nem garantia de resultado sem erros: ciclos, divisão por zero e
dependências de células incompatíveis ainda podem propagar erros no recálculo.
O comportamento pré-existente de copiar referências entre abas com dimensões
diferentes continua com a ressalva registrada na Etapa 10.

## Estilos, proteção e recursos não convertidos

São preservados, quando presentes na API: negrito, itálico, cor da fonte,
preenchimento padrão/cor, alinhamento horizontal/vertical, wrap, rotação, formato
numérico, largura de coluna, altura de linha, ocultação e proteção de célula.
Mesclagens e proteção da planilha são extraídas também do OOXML.

Na conversão inicial da Etapa 12, esses recursos permaneciam apenas no modelo
normalizado. Com o [ajuste de células mescladas](AJUSTE_CELULAS_MESCLADAS.md),
mesclagens, larguras, alturas mínimas, alinhamento básico e quebra de texto são
reproduzidos na revisão e no renderer compartilhado do Lab. Os demais estilos
continuam como metadados; o relatório distingue suporte completo a merges dos
recursos apenas preservados. As regras pedagógicas continuam sendo as do Lab.
Rich text é concatenado com aviso de perda de estilo por trecho; gradientes são
identificados, mas seus stops/ângulo não são representados. Não há modelo completo
de bordas, fontes, formatação condicional ou defaults de estilo de linhas/colunas.

Gráficos são detectados como partes `xl/charts/chart*.xml`, com tipos conhecidos
quando disponíveis. A contagem é de partes encontradas, inclusive partes sem vínculo
resolvido a uma worksheet; não são convertidas para `ChartDefinition`. Todo gráfico
encontrado recebe `UNSUPPORTED` e um item de aviso, mesmo se o tipo não for reconhecido.

O inventário registra VBA, possíveis consultas/Power Query ou custom XML,
pivôs/cache de pivôs, conexões, links/relacionamentos externos, nomes definidos,
objetos embutidos/ActiveX, tabelas, imagens, desenhos, views e alguns elementos
avançados da worksheet. Nem todo custom XML é Power Query; o rótulo explicita essa
ambiguidade. A lista de partes é mantida para inspeção. Essa detecção por partes
e elementos não promete reconhecer todo recurso de todas as versões do Office.

## Segurança e limites

A importação só lê bytes em memória. Não extrai arquivos em disco, segue URLs,
abre hyperlinks, resolve entidades externas, executa macros/scripts/DDE ou calcula
fórmulas externas. Hyperlinks ficam como metadata e texto, sem criar anchors no Lab.
Fórmulas com referências externas/estruturadas, DDE ou funções ativas identificadas
são convertidas em texto inerte. As demais funções não habilitadas continuam sendo
recusadas pela whitelist existente do motor, sem ampliar suas capacidades.

Antes do ExcelJS, o leitor ZIP verifica diretório, cabeçalhos, entradas duplicadas,
caminhos, tamanho e CRC. A descompressão tem limite real de saída por parte; não se
confia apenas no tamanho declarado. XMLs são validados e DTD/entidades recusadas.
Criptografia, ZIP64 e ZIP multipartes não são aceitos. Não há suporte a formato
binário XLS/XLSB, CSV, ODS ou extensão XLSM, mesmo que outra biblioteca consiga lê-los.
Partes VBA num contêiner renomeado `.xlsx` são apenas inventariadas, nunca executadas.

| Limite fixado na POC | Valor |
| --- | --- |
| Arquivo comprimido | 2 MiB |
| Saída de cada parte ZIP | 4 MiB |
| Saída total do pacote | 16 MiB |
| Partes ZIP | 256 |
| Abas | 8 |
| Linhas por aba | 200 |
| Colunas por aba | 32 (A:AF) |
| Posições de grade somadas entre abas | 20.000 |
| Células OOXML armazenadas, incluindo vazios/estilos | 5.000 |
| Texto por célula | 8.192 caracteres |
| Expressão por fórmula | 1.024 caracteres |
| Profundidade XML / elementos por documento | 64 / 100.000 |

Os limites são recusas claras (`ERROR`), sem truncamento silencioso de linhas,
colunas ou células. O preflight ocorre antes de o ExcelJS expandir intervalos.
Estes limites conservadores não constituem uma sandbox de produção, nem uma
garantia de tempo máximo contra qualquer arquivo hostil. Não há worker ou upload
público; esses controles precisariam ser revistos antes de expor importação a terceiros.

## Relatório

`ImportReport` possui `sheets`, `cells`, `populatedCells`, `formulas`,
`supportedFormulas`, `partiallySupportedFormulas`, `unsupportedFormulas`,
`charts`, `warnings`, `errors` e `items`.

Cada item tem severidade `OK`, `WARNING` ou `ERROR`, código, mensagem e, quando
relevante, aba/célula/parte. `cells` conta inclusive células vazias relevantes;
`populatedCells` exclui vazios e subordinadas de mesclagens. `charts` conta partes
encontradas, não gráficos já convertidos. Warning não impede visualizar o modelo;
erro de estrutura/limite gera `{ ok: false, report }`, sem montar um descriptor parcial.

Exemplos de códigos: `SHEET_IMPORTED`, `EMPTY_SHEET`, `FORMULA_SUPPORTED`,
`FORMULA_PARTIALLY_SUPPORTED`, `FORMULA_UNSUPPORTED`, `STYLES_METADATA_ONLY`,
`CHART_UNSUPPORTED`, `VBA_SCAN`, `SHEET_NAME_CONFLICT`, `CELL_LIMIT`,
`EXPANSION_LIMIT`, `UNSUPPORTED_FORMAT`, `CORRUPT_ZIP`, `NO_WORKSHEETS`.

## Fixture e testes

`tests/fixtures/xlsx/controlled.xlsx` é um XLSX real, pequeno e controlado,
gerado pelo script `create-fixture.cjs` no mesmo diretório. Contém:

- Dados base: números, texto, booleanos, texto numérico/parecido com fórmula,
  data, hyperlink, sete funções, cores/fonte/alinhamento/formato, largura/altura,
  proteção e um nome definido.
- Resultado & análise: referências relativas/absolutas/mistas e entre abas,
  IF não suportado, célula vazia formatada e mesclagem.
- Caches de fórmulas propositalmente incorretos (999) para provar o recálculo.

Os testes criam ainda variantes de pacote para VBA, gráfico, consulta, conexão,
pivô, link externo, corrupção, CRC, DTD, duplicidade e limites. Essas variantes
com recursos avançados são testes de detecção de partes controladas, não uma
alegação de conversão funcional desses recursos ou validação no aplicativo Excel.

Novos arquivos de teste:

- `excel-import.spec.ts`: parsing/modelo, valores/tipos, fórmulas/referências,
  estilos, classificação, relatórios, conversão, recálculo/proteção, erros e limites.
- `excel-import-browser.spec.ts`: duas integrações no mesmo Lab com política
  fornecida/editável, abas, grade com dimensões próprias, fórmulas, proteção,
  recálculo após edição e recuperação via repositório em memória. Confirma ausência
  de requests externos e erros JavaScript.
- `excel-import-file.spec.ts`: entrada reproduzível para analisar outro arquivo e
  gerar JSONs locais. Usa a fixture por padrão, sem teste ignorado condicionalmente.

Nenhum dos 98 testes anteriores foi removido ou afrouxado. O harness separado da
Etapa 11 passou apenas a aceitar um descriptor serializável de teste; os casos
anteriores de memória/soma continuam usando suas configurações originais.

### Verificações finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **112 aprovados, 0 falhos**; 98 anteriores + 14 novos, aproximadamente 2,9 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; página principal estática, sem rotas de upload ou teste no app. |
| Integração XLSX no mesmo Lab | Duas políticas, fórmulas/referências, edição, proteção, recálculo e recuperação aprovados. Sem requests externos nem erros JavaScript. |
| Isolamento de bibliotecas | Imports de ExcelJS/saxes encontrados somente em `lib/excel-import/` no código de produção. |

A suíte final usou Chrome, aplicação compilada na porta temporária 3001 e harness
de testes na 3002, com `PLAYWRIGHT_BASE_URL=http://localhost:3001` e dois workers,
como na Etapa 11. Os servidores temporários foram encerrados; o servidor e a sessão
do usuário em 3000 não foram apagados ou interrompidos. A configuração de testes,
seus timeouts e asserções anteriores não foram alterados.

Relatório real da fixture: **2 abas, 24 células armazenadas (22 preenchidas),
12 fórmulas (11 compatíveis e 1 IF não habilitada), 0 gráficos, 12 avisos e 0 erros**.
Os avisos incluem os recursos intencionalmente preservados apenas como metadados.
As capturas da integração foram inspecionadas: dados/fórmulas aparecem na grade
genérica, com foco visível, abas e controles existentes. A formatação Excel não
foi aplicada à UI, conforme a política desta etapa.

## Como testar outro XLSX

No PowerShell, usando o Node do projeto e Chrome instalado, quando necessário:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.1-win-x64;$env:Path"
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:BI_SOCIETY_XLSX_PATH = "D:\caminho\meu-arquivo.xlsx"
npm test -- tests/excel-import-file.spec.ts --workers=2
Remove-Item Env:BI_SOCIETY_XLSX_PATH
```

Serão gerados em `test-results/xlsx/`: `report.json`, `normalized-workbook.json`
e `exercise-definition.json`. Em falha de importação, o relatório é escrito e o
teste falha exibindo o diagnóstico. Os resultados são locais, ignorados pelo Git;
uma nova execução Playwright pode limpá-los. Isso não publica nem substitui o
exercício do aluno. Um erro de acesso ao caminho ocorre antes da API de importação
e é reportado pelo runner de testes.

Para demonstrar a edição no Lab com a fixture:

```powershell
npm test -- tests/excel-import-browser.spec.ts --workers=2
```

Capturas em `test-results/etapa-12-import-{provided,editable}.png`. Para regenerar
a fixture, execute `node tests/fixtures/xlsx/create-fixture.cjs`. Não é necessário
Excel instalado nem licença comercial de planilha para executar esses testes.

## Arquivos e escopo preservado

Criados: módulos de `lib/excel-import/` (`types`, `limits`, `packageReader`,
`xlsxAdapter`, `compatibility`, `normalizeWorkbook`, `importWorkbook`,
`createExerciseDefinitionFromImport`), fixture/script/writer de pacotes de teste,
três arquivos `tests/excel-import*.spec.ts` e este documento.

Modificados: `package.json`, `package-lock.json`, `README.md`,
`tests/repository-harness/app/page.tsx` e `lib/spreadsheet/formula-engine.ts`
(export da whitelist existente). Não há alterações em editor, workbook, definição
neural, regras pedagógicas, validação, pontuação, gráficos, autosave ou estilos da UI.

Não foram iniciados tela de upload, drag-and-drop, Studio, configuração pedagógica,
mapeamento de respostas, backend, Supabase, banco, autenticação, upload remoto
ou publicação. Não há garantia de equivalência completa ou round-trip Excel;
os limites e avisos acima fazem parte do contrato desta POC.
