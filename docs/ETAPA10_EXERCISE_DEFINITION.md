# Etapa 10 — Generalização com ExerciseDefinition

Atualização posterior: Worksheet/ReadonlyWorkbook aceitam merges estruturais
opcionais por aba. ExerciseDefinition valida essa geometria e o renderer comum
do Lab conserva principal, edição, seleção e teclado. Consulte
[AJUSTE_CELULAS_MESCLADAS.md](AJUSTE_CELULAS_MESCLADAS.md) para o contrato e seus
limites. O histórico desta etapa permanece abaixo.

O Lab recebe uma definição de exercício e mantém os mecanismos de planilha,
fórmulas, proteção, avaliação, gráficos e persistência separados do dataset.
O exercício de Redes Neurais continua sendo a única configuração na página
entregue ao aluno. Não foi criado catálogo, seletor ou editor de exercícios.
Nenhuma dependência foi adicionada.

## Contrato e responsabilidades

`types/exercise.ts` define `ExerciseDefinition`, `ChartDefinition`, séries,
indicadores e apresentação de abas. As abas e seus nomes ficam no próprio workbook,
evitando uma segunda lista divergente de identidades.

| Campo | Responsabilidade |
| --- | --- |
| `id`, `version` | Identidade do conteúdo do exercício; usados na sessão e chave padrão. |
| `title`, `subtitle?` | Textos do exercício no cabeçalho, separados da marca BI.Society Lab. |
| `workbook` | Modelo Mestre profundamente readonly nos tipos, com abas, nomes e células originais. |
| `dimensions` | Dimensões padrão da grade. |
| `sheets?` | Metadata por ID: dimensões opcionais por aba, larguras de colunas, linhas de cabeçalho, altura da janela e apresentação dos gráficos/indicadores. |
| `cellRules` | Papéis fornecido, calculado, editável e resposta; usa o resolvedor existente. |
| `validationRules` | Alvos, valor esperado, tolerância, fórmula obrigatória, pontos e feedback. |
| `completion.minimumScore` | Corte da pontuação; não existe 70 fixo no controlador genérico. |
| `charts` | Lista declarativa de gráficos de linha, intervalos, títulos, eixos e séries. Pode ser vazia. |
| `persistence?` | Chave explícita opcional e identidade legada opcional para compatibilidade. |
| `ui?` | Rótulo do documento, chamada do cabeçalho e ID da aba inicial. |

`ExerciseLab` valida a configuração e congela o mestre ao recebê-lo. Sua sessão
é isolada por ID/versão; monta o editor após recuperar o armazenamento local.
`SpreadsheetEditor` recebe a definição, cria uma cópia do aluno e injeta limites,
regras e apresentação nos mecanismos existentes. Não importa datasets de Redes
Neurais nem contém condições por nomes como `resultados` ou `analise`.

O ponto de composição `app/page.tsx` escolhe a definição atual:

```tsx
<ExerciseLab definition={neuralExerciseDefinition} />
```

É esse ponto de entrada que conhece o exercício; os componentes e módulos de
`lib/` não importam seus dados. A descrição global do layout também é genérica.
Manter o mesmo ID/versão significa manter o mesmo conteúdo pedagógico compatível;
uma alteração de mestre/regras requer uma decisão explícita sobre a versão.

## Workbook, coordenadas e imutabilidade

`ReadonlyWorkbook` expressa a imutabilidade da raiz, lista de abas, objetos de aba
e mapas de células. `freezeWorkbook` aplica o congelamento em runtime;
`cloneWorkbook` cria mapas independentes e editáveis para o aluno. O mecanismo
genérico não apaga entradas editáveis com valores iniciais. O mestre vazio da
POC de Redes Neurais continua sendo produzido pela configuração específica anterior.

`lib/spreadsheet/coordinates.ts` centraliza:

- parsing de A1, letras de coluna e normalização de caixa/`$`;
- validação de posição contra dimensões;
- parsing e expansão de intervalos;
- formatação de coordenadas.

Resolvedor de proteção, feedback, restauração, seletores gráficos e motor usam
esse módulo. O lexer continua tratando os tokens e marcadores absolutos necessários
à cópia de fórmulas; não foi substituído por parsing textual de expressões.

`sheetBounds` e `workbookBounds` resolvem limites padrão e substituições por aba.
`calculateWorkbook` conserva os dois argumentos anteriores e aceita um terceiro
mapa opcional de limites. A verificação de referências usa os limites da aba
referenciada; operações matemáticas e coerção do parser permanecem iguais.
O adaptador de cópia continua usando os limites do destino para translação;
referências qualificadas entre abas com dimensões diferentes merecem cobertura
adicional antes de adotar essa variação em novos exercícios. A POC atual usa
dimensões iguais em todas as abas e suas regressões de cópia foram preservadas.

Larguras, altura e linhas de cabeçalho da UI são metadata. Os valores da POC
produzem o mesmo layout anterior: 40×12, A com 176 px, B da Análise com 600 px
e janela de Resultados com 340 px. A primeira linha de um exercício novo não
recebe automaticamente aparência de cabeçalho: isso também vem da definição.

## Gráficos declarativos

Exemplo existente:

```ts
{
  id: "actual-predicted",
  sheet: "resultados",
  type: "line",
  title: "Saída real × Saída prevista",
  xRange: "A2:A6",
  xAxisLabel: "Amostra",
  yAxisLabel: "Saída",
  legend: true,
  series: [
    { id: "actual", name: "Saída real", range: "B2:B6", color: "#142d4e" },
    { id: "predicted", name: "Saída prevista", range: "C2:C6", color: "#ee7e32", dashed: true }
  ]
}
```

Os IDs de séries são livres dentro do formato validado. O seletor
`workbookChartData(calculated, chart)` retorna rótulos e `values[seriesId]`,
sem propriedades obrigatórias `actual`, `predicted` ou `absoluteError`.
O componente de linha recebe as séries configuradas. Títulos, eixos, legendas
e cores vêm da definição; os intervalos podem ser horizontais ou verticais,
unidimensionais e de comprimentos iguais, lidos em ordem de linha/coluna.

O MAE é um indicador configurado em `sheets.resultados.charts.metrics`, com
aba, célula, rótulo e descrição acessível. O código genérico não contém B8 ou
um cálculo especial de MAE. Os dois componentes específicos de previsão/erro
foram substituídos por configurações do componente de linha existente.

Valores continuam vindo exclusivamente do workbook calculado. Erros, texto,
vazios, booleanos e números não finitos conservam o tratamento anterior de
lacunas; zero numérico permanece válido. Não há cálculo paralelo do exercício.

## Persistência e compatibilidade

A camada continua síncrona e local. As funções recebem a definição explicitamente:

```ts
loadExerciseState(definition)
saveExerciseState(definition, snapshot)
clearExerciseState(definition)
serializeExercise(definition, snapshot)
deserializeExercise(definition, value)
```

Sem chave explícita, ela deriva de ID e versão, com componentes codificados:

```text
bi-society:lab:{id}:{version}:exercise-state:v1
```

`version: 1` no objeto é a versão do formato de sessão; `exerciseId` e
`exerciseVersion` identificam o exercício. Não se trata de histórico de tentativas.
Restaurar verifica identidade, limites e permissões da definição recebida.
Somente conteúdo de aluno é gravado; nota, gráficos e feedback são reconstruídos.
Exclusão de uma célula editável que possui valor inicial é gravada explicitamente
como string vazia, para não ressuscitar esse valor na recuperação.

A definição de Redes Neurais mantém a chave
`bi-society:poc01:exercise-state:v1` e declara a identidade antiga
`poc01-neural-v1` em `persistence.legacyExerciseId`. Por isso, sessões das etapas
anteriores sem `exerciseVersion` continuam legíveis e preservam fórmulas e aba.
A próxima gravação usa a identidade atual. Esses literais ficam na configuração
do exercício, não no motor. Outros exercícios não aceitam essa compatibilidade.
Ao mudar pedagogicamente a versão da POC, revisar/remover a compatibilidade legada.

Debounce de 750 ms, indicador real, flush de saída, tratamento de erro e confirmação
do reinício permanecem. Não foi criado repositório assíncrono.

## Validação de configuração

`validateExerciseDefinition` verifica em runtime:

- ID, versão, título e presença do workbook;
- dimensões positivas e IDs/nomes de abas válidos e únicos;
- células normalizadas, conteúdo textual e posições dentro dos limites;
- metadata, papéis, intervalos e endereços de regras pedagógicas;
- IDs de regras de avaliação, alvos e parâmetros numéricos/textuais;
- pesos positivos, tolerâncias válidas e corte entre 0 e 100;
- gráficos/séries/indicadores válidos, IDs únicos em seus contextos e intervalos existentes;
- aba inicial e opções de persistência.

Uma célula vazia existe pela posição na grade, mesmo sem uma entrada no mapa
esparso. Portanto é válido avaliar C1 vazia no exercício de soma.
Erros de configuração interrompem a montagem com mensagem explícita, por exemplo:

```text
ExerciseDefinition inválido: validationRule sum referencia célula inexistente ou inválida: operacao!C99.
```

Não há dependência de schema externo. A validação é estrutural, não uma prova
algébrica das respostas nem uma análise de segurança de fórmulas arbitrárias.

## Exercícios e testes

O exercício atual está em `data/exercises/neural-error-correction.ts`.
As cinco regras específicas foram movidas de `lib/validation/validationRules.ts`
para `data/exercises/neural-validation.ts`. Valores, fórmulas, tolerâncias,
pesos e corte continuam iguais. O descriptor reúne o mestre e a configuração
pedagógica já existente, sem reescrever os dados do exercício.

`tests/fixtures/simple-sum.ts` define o segundo exercício:

```ts
const simpleSumDefinition: ExerciseDefinition = {
  id: "simple-sum", version: "1.0",
  title: "Teste de Soma",
  subtitle: "Some os dois valores usando uma fórmula.",
  workbook: freezeWorkbook({ worksheets: [
    { id: "operacao", name: "Exercício", cells: { A1: "10", B1: "20" } }
  ] }),
  dimensions: { rows: 4, columns: 3 },
  cellRules: { operacao: { default: "provided", cells: { C1: "answer" } } },
  validationRules: [{
    id: "sum", worksheetId: "operacao", cell: "C1", label: "Soma",
    type: "number", expected: 30, requireFormula: true, points: 7,
    feedback: "Some os valores fornecidos."
  }],
  completion: { minimumScore: 100 }, charts: []
};
```

`tests/exercise-definition.spec.tsx` adiciona 11 testes de definição, renderização
dos mesmos componentes, soma e expressões equivalentes, proteção, corte configurado,
persistência isolada, compatibilidade legada, valor editável inicial/exclusão,
gráficos com outra estrutura, dimensões por aba, coordenadas e erros claros.

Os 75 casos anteriores permanecem. Somente bindings/imports de testes foram
adaptados às APIs injetadas: `tests/fixtures/neural-storage.ts` e
`tests/fixtures/neural-chart-data.ts` vinculam os cenários antigos à definição
neural. Os valores e asserções históricas foram preservados; seletores específicos
de compatibilidade não ficam no código de produção.

Além da suíte, um harness temporário em `.tools/sum-harness` importou diretamente
os mesmos `ExerciseLab` e `SpreadsheetEditor`. No Chrome foram conferidos título,
subtítulo, aba Exercício, grade 4×3, proteção, literal rejeitado, `=A1+B1` aceito,
7/7 pontos, corte 100%, chave própria, recuperação da fórmula/nota, reinício e
Tab nos limites A1/C4. Sem erros JavaScript. O harness é ignorado pelo Git, não
adiciona rota ou dependência à aplicação principal e seu servidor foi encerrado.
Captura local: `test-results/etapa-10-soma.png`.

Resultados da entrega:

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | 86 aprovados, 0 falhos; aproximadamente 1,8 minuto. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; somente rotas normais da POC. |
| POC compilada no Chrome | 20 fórmulas, gráficos declarativos, 70/70, recuperação e reinício aprovados; sem erros JavaScript. |
| Soma no mesmo Lab, harness compilado | Fluxo descrito acima aprovado; sem erros JavaScript. |

## Arquivos principais

Criados: `types/exercise.ts`, `lib/exercises/definition.ts`,
`lib/spreadsheet/workbook.ts`, definição e regras em `data/exercises/`,
`tests/exercise-definition.spec.tsx`, fixtures de soma/compatibilidade e este documento.

Adaptados: editor, abas, controlador do Lab, hook de autosave, painel de avaliação,
storage e tipos de sessão, coordenadas/resolvedor, limites do adaptador de fórmulas,
seletor/componentes gráficos, tipos de workbook, mestre da POC, composição da página,
metadados do layout, estilos parametrizados e README.

Removidos os wrappers gráficos `ActualVsPredictedChart.tsx` e
`AbsoluteErrorChart.tsx`; suas configurações agora estão na definição neural.

## Como adicionar um exercício posteriormente

1. Criar um módulo específico em `data/exercises/`, sem editar o motor.
2. Declarar identidade/versão, mestre readonly, dimensões e nomes de abas.
3. Configurar permissões, respostas e critério de conclusão.
4. Declarar gráficos/indicadores ou usar `charts: []`; configurar apresentação apenas se necessária.
5. Validar com `validateExerciseDefinition` e renderizar `<ExerciseLab definition={definition} />` no ponto de composição.
6. Testar cálculo, edição, reinício e recuperação. Usar a chave derivada ou assumir explicitamente a política de compatibilidade da chave customizada.

Não é necessário editar `SpreadsheetEditor`, avaliadores, seletores ou storage
para trocar entre as duas definições demonstradas.

## Limitações

O modelo de célula continua sendo texto original e cálculo separado; não há
formatação XLSX completa, importador, autoria ou novos tipos de gráficos/funções.
Os intervalos de séries são unidimensionais, de mesma aba e mesmo comprimento;
somente gráficos de linha são suportados. Descritores devem ser estáveis por
ID/versão e são fornecidos pelo código, não por upload do aluno.

Persistência continua local e síncrona, sem identidade de aluno, nuvem, conflito
entre janelas ou histórico. Uma chave customizada pode colidir se o autor a
reutilizar indevidamente. Regras esperadas continuam no frontend nesta POC;
generalização não transforma a nota em uma avaliação segura de servidor.

Não foram iniciados repositório assíncrono, Supabase, backend, autenticação,
importação XLSX, Studio, catálogo ou editor de exercícios.
