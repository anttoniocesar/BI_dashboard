# Etapa 4 — Gráficos dinâmicos

Registro da Etapa 4. A Etapa 5 protege Dados e Resultados e mantém as atualizações
a partir das respostas permitidas em Treinamento; consulte `ETAPA05_PROTECAO.md`.

## Biblioteca

Não havia uma biblioteca gráfica no projeto. Foi adicionado **Recharts 3.10.1**,
com licença MIT, conferida no manifesto e em `node_modules/recharts/LICENSE`.
É uma biblioteca React com gráficos SVG, containers responsivos, legenda e
tooltip, evitando implementar essas interações manualmente ou adicionar um wrapper
separado. Referência: https://github.com/recharts/recharts

A dependência direta foi fixada no manifesto e no lockfile; as dependências
transitivas foram resolvidas pelo npm. Não foi adicionada outra biblioteca gráfica.
Recharts é carregado via `next/dynamic` somente ao abrir Resultados.
Na redistribuição, preserve o aviso de copyright e o texto da licença MIT.

## Fluxo dos dados

```text
Workbook em estado React
  → calculateWorkbook (motor existente)
  → CalculatedWorkbook
  → workbookChartData (Resultados!A2:D6 e B8)
  → ResultCharts
  → ActualVsPredictedChart / AbsoluteErrorChart
```

O seletor é uma função pura, sem acesso a estado próprio, sem persistência e sem
alterar o workbook. Os cinco pontos são construídos a partir dos valores já
calculados nas células A/B/C/D das linhas 2 a 6. O MAE vem de B8, cuja fórmula
continua sendo `=AVERAGE(D2:D6)`.

Não há números de demonstração duplicados, recálculo de previsão nos componentes
nem cálculo paralelo do erro/MAE. O intervalo é configuração fixa do exercício.

Ao confirmar uma edição, o fluxo de recálculo existente produz uma nova fotografia.
Isso atualiza o dataset e os gráficos tanto ao voltar de Dados/Treinamento quanto
ao editar Resultados diretamente, sem recarregar a página.

## Componentes e apresentação

- `ResultCharts`: seleciona dados, apresenta MAE e organiza os dois gráficos.
- `ActualVsPredictedChart`: duas linhas com marcadores; azul-marinho para saída
  real e laranja tracejado para saída prevista, com legenda.
- `AbsoluteErrorChart`: linha laranja com marcadores para erro absoluto.
- `WorkbookLineChart`: container responsivo, eixos, tooltip e estado vazio comuns.

A planilha permanece editável acima dos gráficos. Em Resultados, sua janela
mostra as linhas iniciais e o MAE sem ocultar as demais linhas, acessíveis por
rolagem. A navegação entre as quatro abas continua na posição original.

Os gráficos aparecem lado a lado acima de 1000 pixels e empilhados abaixo desse
limite. Cada gráfico usa a largura do seu container. As linhas são retas entre
amostras, sem suavização; a atualização não depende de animações.

## Dados incompletos

Somente números finitos são aceitos nas séries. Células ausentes, vazias, com
erro, booleanos, texto ou resultados numéricos armazenados como string tornam-se
`null`. Zero numérico é preservado. Os pontos de uma série inválida não escondem
valores válidos da outra série na mesma amostra. `connectNulls=false` conserva
as lacunas. Amostras com rótulos vazios, inválidos ou com erro são omitidas.

Quando não há nenhum valor válido para as séries do gráfico, aparece
“Sem valores numéricos para exibir.”. O tooltip mostra apenas valores válidos.
MAE inválido aparece como “—”, sem substituir o conteúdo da célula.

O seletor respeita a semântica do motor: se uma fórmula calcular legitimamente
zero a partir de uma referência vazia, esse resultado numérico é exibido.
Não há alteração nas regras de cálculo das etapas anteriores.

## Testes e limites

Testes do seletor cobrem integração com o workbook real, recálculo, preservação
de zeros, dados inválidos, rótulos e ausência de Resultados. Testes no Chrome
cobrem duas séries, tooltips, mudança dos traçados, edição da planilha,
estados vazios/erros e larguras de 1440, 1024 e 768 pixels.

São dois gráficos fixos de cinco amostras. Não há criação de gráficos pelo aluno,
seleção de intervalos, edição de títulos/eixos, proteção, validação pedagógica,
feedback de acerto/erro, persistência, salvamento, reinicialização, importação
ou backend. A Etapa 5 não foi iniciada.

Eixos, tooltips e resumo MAE exibem até seis algarismos significativos; a precisão
do cálculo e a exibição das células permanecem como nas etapas anteriores.
