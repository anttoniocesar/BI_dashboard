# Etapa 6 — Validação e feedback pedagógico

Registro histórico da Etapa 6. A Etapa 7 acrescentou persistência e alterou o
estado inicial para respostas vazias; os exemplos preenchidos são usados apenas
nas regressões. Consulte `ETAPA07_SALVAMENTO.md` para o comportamento atual.

A avaliação ocorre apenas ao clicar em **Verificar respostas**. Não há salvamento,
histórico, reinicialização ou alterações na proteção pedagógica. A Etapa 7 não foi iniciada.

## Arquitetura

- `types/validation.ts`: união discriminada de regras numéricas/textuais, configuração e resultados públicos.
- `lib/validation/validationRules.ts`: alvos, valores esperados, tolerâncias, pesos e feedback centralizados.
- `lib/validation/validateCell.ts`: comparação pura de uma célula calculada.
- `lib/validation/validateExercise.ts`: valida configuração e agrega resultados e pontuação.
- `components/validation/useExerciseValidation.ts`: avaliação separada do workbook, com invalidação por edição.
- `components/validation/ExerciseValidationSummary.tsx`: botão, resumo, feedback e atalhos para células.
- `SpreadsheetEditor.tsx`: integra o painel, confirma rascunhos e aplica classes temporárias à grade.

O painel recebe somente resultados públicos: status, mensagem e pontos. Não recebe
valor esperado, tolerância ou fórmula de referência. As regras ficam no frontend
nesta POC local; isso não constitui proteção de gabarito contra inspeção do código.
A separação permite futuramente mover a avaliação para um serviço.

## Regras configuradas

| Aba | Célula | Objetivo | Tolerância absoluta | Pontos |
| --- | --- | --- | --- | --- |
| Treinamento | F2 | Saída prevista | 0.0001 | 10 |
| Treinamento | H2 | Erro | 0.0001 | 10 |
| Treinamento | I2 | Novo w1 | 0.0001 | 15 |
| Treinamento | J2 | Novo w2 | 0.0001 | 15 |
| Resultados | B8 | MAE das cinco amostras | 0.000001 | 20 |

Os valores esperados correspondem ao workbook inicial e estão exclusivamente no
módulo de configuração. Dados e parâmetros permanecem protegidos. Resultados!B8
é calculado e protegido, mas participa da avaliação. As demais respostas amarelas
continuam editáveis; somente os cinco alvos acima compõem a nota.

Cada regra inclui `id`, `worksheetId`, `cell`, `label`, `type`, `expected`,
`feedback` e, opcionalmente, `points` e `requireFormula`. Regras numéricas também
aceitam `tolerance`. Sem peso, vale um ponto. A configuração rejeita alvos duplicados,
pesos não positivos, valores numéricos não finitos, tolerância negativa e corte fora de 0–100.

## Semântica

Uma célula vazia recebe `unanswered`. Erros do motor recebem `incorrect` com
orientação para corrigir a fórmula. Texto, booleano e valores não finitos não
passam por coerção numérica. Zero é um número válido.

Sem tolerância, números são comparados exatamente. Com tolerância, o limite é
inclusivo; uma pequena margem de ponto flutuante é usada apenas nesse limite.
Texto é comparado sem distinguir maiúsculas/minúsculas, removendo espaços externos.
Esse suporte está testado, mas as perguntas discursivas de Análise não são avaliadas.

As cinco regras exigem fórmula. O motor verifica sua presença e o resultado
calculado, sem comparar a expressão com uma fórmula modelo. Expressões equivalentes
são aceitas. Uma expressão constante como `=0.16` também satisfaz a exigência de
fórmula se o valor estiver correto; inspeção de referências e equivalência algébrica
avançada ficam fora desta etapa.

## Pontuação e estado

O total é 70 pontos. Resposta correta recebe seu peso integral; incorreta ou vazia
recebe zero. Acerto é a quantidade correta dividida pelo número de regras. Nota
ponderada é pontos obtidos divididos pelos pontos possíveis. O corte `minimumScore: 70`
usa a nota ponderada sem arredondamento: exatamente 70% conclui o exercício.
A apresentação arredonda percentuais para uma casa decimal.

Só existe a última avaliação em memória, separada das células. Qualquer edição
confirmada retira toda a avaliação, inclusive do MAE, para não manter resultados
obsoletos de dependências. Um rascunho alterado também oculta a avaliação; Esc pode
restaurá-la se o workbook não mudou. Tentativa bloqueada pela proteção não invalida.
Trocar de aba ou selecionar células não invalida. Nova verificação substitui o resultado.

Verde e rosa são sobreposições temporárias. Amarelo/cinza e permissões originais
continuam definidos pelas regras pedagógicas. A borda laranja da seleção permanece.
Os feedbacks não exibem valor esperado, fórmula modelo ou tolerância.

## Limitações e verificação

As fórmulas demonstrativas preexistentes foram preservadas. Portanto a verificação
inicial resulta em 5/5; esta etapa não transforma o workbook em um exercício vazio.
Recarregar perde alterações e avaliação, como antes. Não há persistência, histórico,
backend ou correção discursiva. Nenhuma dependência foi adicionada.

`tests/validation.spec.ts` testa comparação exata, tolerância, texto, fórmula obrigatória,
erros, pontuação e corte de 70%. `tests/exercise-validation.spec.ts` verifica o fluxo
no navegador: cores, feedback, expressão equivalente, literal rejeitado, revalidação,
rascunho, respostas vazias, gráficos e proteção. A suíte completa inclui as regressões
de edição, navegação, referências, abas, gráficos e proteção das etapas anteriores.

Execute `npm run typecheck`, `npm test` e `npm run build`. Para testar manualmente,
abra Treinamento, altere F2, confirme e clique em **Verificar respostas**. Use uma
fórmula correta, um número literal, uma fórmula errada e uma célula vazia. Corrija e
verifique novamente. Selecione Resultados para conferir MAE e gráficos preservados.
