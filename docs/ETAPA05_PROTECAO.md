# Etapa 5 — Proteção e diferenciação pedagógica

Este documento registra a Etapa 5. Na Etapa 6, cores temporárias de avaliação
passaram a sobrepor as cores pedagógicas após verificação explícita, sem alterar
permissões. Consulte `ETAPA06_VALIDACAO.md`.

## Configuração

`data/cell-rules.ts` define regras declarativas por ID da worksheet. Os tipos
estão em `types/cell-rules.ts`; não há endereços de proteção espalhados no editor.

Papéis:

| Papel | Edição | Aparência |
| --- | --- | --- |
| provided | Bloqueada | Azul/cinza claro, conteúdo fornecido |
| calculated | Bloqueada | Cinza claro, cálculo protegido |
| answer | Permitida | Amarelo claro, resposta |
| editable | Permitida | Amarelo claro, área livre configurada |

O resolvedor deriva `readOnly` a partir do papel. Isso evita combinações
contraditórias entre sinalização pedagógica e permissão efetiva.

Cada aba define `default` e pode ter `ranges` e `cells`:

```ts
treinamento: {
  default: "calculated",
  ranges: [
    { range: "A1:L1", role: "provided" },
    { range: "F2:F6", role: "answer" },
    { range: "H2:J6", role: "answer" },
  ],
  cells: { K2: "editable" }, // exemplo de uma nova célula livre
}
```

Para liberar um intervalo, acrescente, por exemplo,
`{ range: "K2:K6", role: "answer" }` à lista `ranges` da aba.
O exemplo K2/K2:K6 não é aplicado ao exercício inicial.

Prioridade: **célula > intervalo > padrão da aba**. Entre intervalos sobrepostos,
o último correspondente na lista vence. O resolvedor normaliza letras e `$` e
aceita colunas com várias letras. Intervalos incluem ambas as extremidades.
Abas sem configuração ficam protegidas. Endereços malformados na configuração
geram erro de configuração, em vez de liberar células silenciosamente.

## Exercício inicial

- Dados: padrão `provided`, toda a aba protegida, inclusive cabeçalhos,
  amostras, x1/x2, saídas reais, pesos e taxa de aprendizado.
- Treinamento: padrão `calculated`; cabeçalhos `provided`; respostas em F2:F6
  (saída prevista), H2:H6 (erro), I2:I6 (novo w1) e J2:J6 (novo w2).
- Resultados: padrão `calculated`; cabeçalhos e rótulo MAE `provided`.
  Tabela, referências, erro absoluto e fórmula MAE estão protegidos.
- Análise: padrão `provided`; B3/B6/B9 são respostas `answer`.

As fórmulas demonstrativas das respostas de Treinamento foram mantidas para
preservar resultados e gráficos iniciais. O aluno pode substituí-las ou apagá-las.
Os dados fixos, perguntas e fórmulas protegidas permanecem consultáveis na barra.

## Bloqueio efetivo

O editor impede abrir edição por digitação, F2 e duplo clique em células protegidas.
A barra usa um campo nativo `readOnly` e não cria rascunhos para essas células.
Os handlers de alteração também verificam a permissão.

Todas as gravações do aluno passam por `applyCellEdit`, que resolve novamente a
regra do destino antes de alterar o workbook. Isso cobre confirmação de rascunho,
limpeza, colagem e barra de fórmulas. Operações negadas retornam o mesmo estado,
preservando conteúdo e fórmulas originais, sem recálculo desnecessário.

Proteção restringe as edições do aluno, não o motor de cálculo. Fórmulas protegidas
continuam recalculando quando uma resposta permitida muda. É possível copiar
conteúdo de qualquer célula, mas colar só modifica um destino editável.

Os rascunhos continuam associados à worksheet de origem, inclusive ao trocar
para uma aba protegida durante a edição. A guarda verifica essa origem.

## Interação

Todas as células continuam selecionáveis e navegáveis. Enter, Shift+Enter, Tab,
Shift+Tab e setas mantêm os movimentos anteriores, sem pular células protegidas.
A seleção preserva a borda laranja e a cor pedagógica de fundo.

`aria-readonly` sinaliza cada célula. A barra mostra cadeado/“Protegida” ou
“Preencher”/“Editável”, e o cabeçalho tem legenda “Fornecido”/“Preencher”.
Não há verde/vermelho, comparação de respostas, notas ou feedback de acerto.

## Como testar

1. Em Dados!B2, tente digitar, usar F2, duplo clique, Delete, Backspace e colar.
   O valor `0.20` deve permanecer.
2. Selecione B2 e confira o endereço, conteúdo e “Protegida” na barra.
   Tente editar/colar também nesse campo: o conteúdo não muda.
3. Em Treinamento!F2, amarelo, digite `=Dados!B2*2` e confirme: resultado `0.4`.
4. Troque F2 para `0.20`. Resultados!C2 deve mostrar `0.2`, D2 `0.1`;
   o MAE e os gráficos recalculam, mesmo estando protegidos para edição.
5. Em Análise!B3, escreva uma resposta e alterne abas: o texto permanece na sessão.
6. Copie uma célula fornecida e cole em uma resposta amarela; a colagem é permitida.

## Testes e limites

Testes verificam prioridade, intervalos, configuração do exercício e a guarda de
escrita sem interface. No Chrome, cobrem os caminhos de bloqueio, edição permitida,
copiar/colar, barra, navegação, quatro abas e gráficos. A regressão usa agora áreas
permitidas; não há modo de teste que desative a proteção.

Regras são locais e estáticas, definidas no código. Não há editor de regras,
perfis de professor/aluno, autenticação ou autorização por backend nesta POC.
As células vazias fora das áreas liberadas também ficam protegidas pelo padrão.
Não foi adicionado pacote, validação automática, gabarito, tolerância, nota,
persistência, salvamento, reinicialização ou importação. A Etapa 6 não foi iniciada.
