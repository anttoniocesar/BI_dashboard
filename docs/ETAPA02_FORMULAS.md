# Etapa 2 — Fórmulas e referências

Registro da entrega da Etapa 2. A Etapa 3 ampliou o motor para múltiplas abas;
consulte `ETAPA03_WORKBOOK.md` para a estrutura e os limites atuais.

## Decisão

Foi avaliado HyperFormula, que oferece GPLv3 ou licença proprietária:
https://handsontable.com/docs/hyperformula/guide/licensing

Para esta POC foi adotado `fast-formula-parser` **1.0.19**, licença **MIT**,
confirmada no manifesto e no arquivo LICENSE do pacote instalado:
https://github.com/LesterLyu/fast-formula-parser
https://github.com/LesterLyu/fast-formula-parser/blob/master/LICENSE

O parser existente interpreta as expressões, identifica dependências e executa
operações/funções. Não foi criado um parser próprio nem utilizado `eval`.
O grid continua sendo React, sem dependência comercial de planilha.
Ao redistribuir o pacote ou suas partes substanciais, mantenha o aviso de copyright
e o texto da licença MIT. O pacote tem manutenção menos recente; a versão está
fixada no lockfile e os comportamentos usados possuem testes de regressão.

## Integração

- Somente `lib/spreadsheet/formula-engine.ts` importa o pacote e seu lexer.
- `SheetData` mantém o texto original. Uma fotografia derivada separada contém
  `raw`, `formula`, `calculatedValue` e `error` por célula.
- Ao confirmar uma alteração, recalculam-se as células preenchidas com cache
  por fotografia. Dependências são resolvidas antes de executar cada fórmula,
  evitando chamar recursivamente o parser, que é stateful.
- Ciclos são detectados pela pilha de dependências; erros se propagam para
  células dependentes e aparecem como códigos, sem interromper a interface.
- MIN e MAX são stubs na versão publicada. Foram completados pelo mecanismo
  `functions` do parser, usando seu helper de coerção e expansão de intervalos.
- O lexer identifica tokens de células para a translação na cópia. Não são
  alterados nomes de funções nem referências que estejam dentro de strings.
  O import do lexer é uma API interna, isolada no adaptador; atualizar a biblioteca
  exige executar os testes de cópia antes de trocar a versão.
- A cópia fornece texto e metadados de origem em um tipo MIME próprio. A colagem
  de uma célula interna ajusta as referências relativas e preserva `$`. Sem esses
  metadados (por exemplo, texto externo), o conteúdo é colado literalmente.

## Escopo e limites

Funções habilitadas: SUM, AVERAGE, MIN, MAX, ABS, SQRT e POWER. Outras funções
retornam `#NAME?` nesta etapa. Nomes em inglês, argumentos separados por vírgulas
e números com ponto decimal. Não há aliases em português.

Uma planilha A1:L40, valores escalares e intervalos explícitos como A1:A3.
Referências fora da grade e referências entre abas mostram `#REF!`.
Não há faixas de colunas/linhas inteiras, matrizes dinâmicas ou nomes definidos.
Resultados numéricos usam aritmética de ponto flutuante JavaScript; a grade limita
a exibição a 12 algarismos significativos sem alterar o resultado interno.

Copiar/colar uma célula é suportado; copiar intervalos, cortar, arrastar para
preencher e desfazer alterações confirmadas não fazem parte desta entrega.
A edição mantém Enter, Tab, Shift+Tab, setas, exclusão e cancelamento com Esc.

Não foram implementados múltiplas abas funcionais, gráficos, persistência,
validação pedagógica, backend, importação ou restauração de exercício.

## Verificação

`npm test` executa testes do motor, dos ajustes de referências e dos fluxos reais
no navegador, incluindo a regressão da Etapa 1. `npm run typecheck` e
`npm run build` verificam tipagem e compilação de produção.
