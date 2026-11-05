# IF no motor de fórmulas — homologação em 26/10/2026

## Causa e implementação

A fórmula importada estava correta. A lista permitida do adaptador excluía
`IF`, causando `#NAME?` e classificação `UNSUPPORTED` no relatório.
Somente adicionar o nome não bastava: o motor propagava erros de todas as
referências antes do cálculo, inclusive referências do ramo não escolhido.

`lib/spreadsheet/formula-engine.ts` inclui `IF` e resolve suas chamadas pelos
tokens do lexer existente. Parênteses e vírgulas de chamadas internas são
respeitados; texto entre aspas permanece texto. A condição usa os operadores
existentes `>`, `<`, `>=`, `<=`, `=` e `<>`. Somente o ramo selecionado é avaliado,
inclusive com IF aninhado, expressões, funções permitidas e referências entre abas.
Seu resultado escalar é recolocado na expressão com aspas escapadas, sem `eval`
ou execução de texto. A fórmula original permanece intacta.

A sintaxe dos dois ramos é validada antes da avaliação. Erros da condição ou do
ramo selecionado são propagados; divisão por zero, referência inválida e ciclos
no ramo não escolhido não contaminam IF. Funções fora da lista continuam
`#NAME?`, inclusive quando presentes em um ramo não selecionado.

O motor calcula um snapshot completo a cada edição, sem grafo incremental
persistente. As referências dos dois ramos permanecem na fórmula original.
Cada snapshot resolve a condição novamente e lê as referências do ramo escolhido.
Os testes alteram a condição, o ramo ativo e o inativo, incluindo outras abas.

O relatório reutiliza a lista de funções do motor. Fórmulas compartilhadas já
expandidas pelo adaptador passam pela mesma classificação das expressões normais:
compartilhamento não representa limitação de cálculo. Isso permite classificar
Q12:Q18 do LAB 1 como `SUPPORTED`. Fórmulas matriciais continuam parciais.
Não houve alteração no importador estrutural XLSX.

## Arquivos originais e resultados

Foram usados os arquivos de Downloads:

- `Laboratorio_1_Qualidade_Correcao_de_Erro.xlsx`;
- `Laboratorio_2_Consumo_de_Energia_Correcao_de_Erro.xlsx`.

Os 16 textos calculados coincidem exatamente com os resultados salvos pelo Excel
nos arquivos originais. A comparação usa o cache importado, sem usá-lo para
calcular o resultado do Lab. Não foi executado Excel para atualizar esses caches.

| Gabarito | LAB 1 | LAB 2 |
| --- | --- | --- |
| Q11 | Previsão acima do real | Consumo subestimado |
| Q12 | Previsão abaixo do real | Consumo subestimado |
| Q13 | Previsão acima do real | Consumo superestimado |
| Q14 | Previsão abaixo do real | Consumo subestimado |
| Q15 | Previsão abaixo do real | Consumo superestimado |
| Q16 | Previsão acima do real | Consumo superestimado |
| Q17 | Previsão abaixo do real | Consumo subestimado |
| Q18 | Previsão acima do real | Consumo superestimado |

| Relatório final | LAB 1 | LAB 2 |
| --- | --- | --- |
| Fórmulas | 110 | 110 |
| Supported | 110 | 110 |
| Partially supported | 0 | 0 |
| Unsupported | 0 | 0 |
| IF supported | 8 | 8 |
| Gráficos detectados/importados | 1/1 | 1/1 |
| Avisos/erros | 13/0 | 13/0 |

O aumento em Supported inclui a retirada da classificação parcial automática de
fórmulas compartilhadas expandidas, além da habilitação de IF.

## Cobertura e limites

`tests/formula-if.spec.ts` cobre retornos numéricos, texto, booleanos, referências,
expressões, funções, três níveis de IF, os seis operadores, string vazia, aspas,
precedência, avaliação preguiçosa, erros e recálculo entre abas. Os dois testes
dos originais exigem as variáveis `BI_SOCIETY_CHART_REGRESSION_PATH` e
`BI_SOCIETY_LAB2_REGRESSION_PATH`; sem elas ficam explicitamente ignorados.

As regressões históricas agora exigem o resultado de IF em vez de `#NAME?`.
`tests/fixtures/assert-original-if.ts` compara os oito textos exibidos contra os
caches originais no preview, Studio e Learn dos dois Labs, pelas regressões de
curso existentes. As capturas usam o prefixo `test-results/if-lab-`.
`tests/formula-if-ui.spec.ts` altera I11 no Studio: positivo produz
“Previsão abaixo do real”, zero produz “Sem erro”, negativo produz
“Previsão acima do real”, sem comando manual de recálculo.

O contrato implementado é IF escalar com três argumentos, separados por vírgula.
`;` já não era um separador habilitado no Lab e continua assim. Não foram
adicionados aliases localizados, retornos matriciais nem AND, OR, SUMIF, COUNTIF,
XLOOKUP ou VLOOKUP. As demais restrições de fórmulas permanecem.

Código de gráficos, merges, LabView, autosave, CourseAccess, versionamento,
player e navegação contextual permanece sem alterações nesta tarefa.

## Verificações finais

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 508 aprovados, zero falhas, nenhum ignorado, em 4,7 minutos; 478 anteriores e 30 novos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno local. |

A suíte usou Node portátil `.tools/node-v24.22.1-win-x64`, Chromium em
`.tools/playwright-browsers` e o build local na porta 3001. As duas variáveis de
regressão apontaram para os XLSX originais de Downloads. O harness de repositório
usou seu servidor de desenvolvimento existente na porta 3002.

Os textos foram verificados automaticamente no preview, Studio Editor e Learn
dos dois Labs. Foram inspecionadas as capturas do Editor dos dois Labs e também
do preview e Learn do LAB 2. A regressão de criação de referências por clique
passou nas entradas por digitação, F2, duplo clique e barra de fórmulas.

O log completo está em `.tools/if-suite-final.log`; diagnósticos individuais
dos originais são anexados pelo Playwright. `test-results/.last-run.json`
registra `passed`. Não houve alteração de cursos hospedados ou perfil pessoal.
