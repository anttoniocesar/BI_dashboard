# Etapa 3 — Workbook e referências entre abas

Registro da Etapa 3. A Etapa 4 adiciona os gráficos descritos em
`ETAPA04_GRAFICOS.md`, preservando a estrutura do workbook abaixo.

## Estado compartilhado

`Workbook` possui uma lista de `Worksheet`, cada uma com `id`, `name` e `cells`.
Os IDs (`dados`, `treinamento`, `resultados`, `analise`) são identidades da interface;
os nomes (`Dados`, `Treinamento`, `Resultados`, `Análise`) aparecem nas fórmulas.

O editor mantém **um único workbook** em estado React. Uma edição substitui
somente o mapa de células da aba correspondente. A inicialização ocorre na
montagem, nunca na troca de abas. O rascunho guarda o ID da aba de origem para
confirmá-lo corretamente mesmo quando o usuário troca de aba durante a edição.
Cada aba também conserva sua seleção e rolagem durante a sessão.

Os dados digitados continuam separados dos resultados calculados. O motor deriva
uma fotografia `CalculatedWorkbook`, indexada por ID da aba e endereço de célula,
com `raw`, `formula`, `calculatedValue` e `error`.

## Cálculo

Foi preservado `fast-formula-parser` 1.0.19 (MIT), sem novos pacotes. Seu uso
continua isolado em `lib/spreadsheet/formula-engine.ts`.

O cache e a detecção de ciclos usam a combinação de **aba + endereço**. Células
sem prefixo pertencem à aba da fórmula; referências como `Dados!B2` consultam
o workbook comum. A resolução dos nomes não diferencia maiúsculas/minúsculas.
Aspas simples são aceitas em nomes, por exemplo `='Análise'!B3`.

A biblioteca deduplica algumas dependências por coordenadas sem considerar a aba.
O adaptador especializa apenas o coletor de dependências para conservar todas
as referências qualificadas. O parser e o avaliador de expressões são os da
biblioteca. Há testes que colocam a aba dependente antes das abas de origem,
com intervalos idênticos em abas diferentes, para evitar que a ordem do cache
oculte problemas. O pacote instalado não foi modificado.

Alterações confirmadas recalculam o workbook inteiro, com cache por fotografia.
Referências a abas inexistentes exibem `#REF!`; ciclos, inclusive entre abas,
exibem `#CYCLE!`. Erros se propagam aos dependentes.

## Exercício inicial

| Aba | Posições |
| --- | --- |
| Dados | Cabeçalhos A1:D1; cinco amostras A2:D6 |
| Dados | w1 em B8 = 0.20; w2 em B9 = 0.30; η em B10 = 0.10 |
| Treinamento | Cabeçalhos A1:J1 e cinco amostras A2:J6 |
| Resultados | Cabeçalhos A1:D1, referências nas linhas 2:6; MAE em B8 |
| Análise | Perguntas B2/B5/B8 e respostas livres B3/B6/B9 |

Treinamento usa `Dados!$B$8` e `Dados!$B$9` como pesos iniciais. As linhas
seguintes recebem os pesos I/J da amostra anterior. A atualização usa
`=D2+Dados!$B$10*H2*B2` e `=E2+Dados!$B$10*H2*C2`.

Resultados referencia Treinamento e calcula `=ABS(B2-C2)`. O MAE é
`=AVERAGE(D2:D6)`. Foram preenchidas as cinco linhas iniciais para obter um MAE
significativo e demonstrar a cadeia de referências, sem motor de treinamento
adicional: os cálculos são fórmulas comuns editáveis.

Primeira amostra: saída prevista 0.16, erro 0.14, novos pesos 0.2028 e 0.3056.
MAE inicial: aproximadamente 0.238859976362.

## Cópia e edição

Enter, Tab, Shift+Tab, setas, F2, exclusão, Esc e barra de fórmulas foram
preservados. Ao trocar de aba, confirma-se o rascunho na origem.

Na cópia de uma célula, a translação conserva os prefixos de aba e os `$`.
Exemplo, K2 → K3: `=Dados!$B$10*B2` torna-se `=Dados!$B$10*B3`.
Copiar para outra aba mantém referências explicitamente qualificadas; referências
sem prefixo continuam locais à aba de destino, como em uma planilha eletrônica.

## Limites

Quatro abas fixas, cada uma com grade A1:L40. Não há criação, exclusão ou
renomeação de abas. Cópia de uma célula por vez; sem intervalos 3D, faixas de
linhas/colunas inteiras, fill handle ou desfazer alterações confirmadas.

Funções habilitadas: SUM, AVERAGE, MIN, MAX, ABS, SQRT, POWER; nomes em inglês,
ponto decimal e argumentos separados por vírgula. Valores numéricos usam ponto
flutuante JavaScript e a exibição limita-se a 12 algarismos significativos.

Tudo fica na memória da sessão. Recarregar restaura o exercício inicial.
Não há proteção, validação pedagógica, gráficos, persistência, salvamento,
botão de reiniciar, importação ou backend. A Etapa 4 não foi iniciada.
