# POC 01 – BI.Society Lab

## 1. Objetivo

Validar tecnicamente se conseguimos criar, dentro do navegador, uma planilha semelhante ao Excel capaz de suportar os principais exercícios da BI.Society.

A POC não será ainda a plataforma completa.

Ela servirá para provar:

- edição direta em células;
- fórmulas;
- referências entre células;
- múltiplas abas;
- gráficos;
- proteção de células;
- salvamento;
- restauração do exercício.

## 2. Resultado esperado

Ao final da POC, deveremos conseguir abrir uma tela semelhante a:

```text
┌───────────────────────────────────────────────────────────┐
│ BI.Society Lab                             Salvo ✓        │
├───────────────────────────────────────────────────────────┤
│ A1      fx   =B2*$C$1                                    │
├────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│    │    A     │    B     │    C     │    D     │    E    │
├────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │          │          │          │          │          │
│ 2  │          │          │          │          │          │
│ 3  │          │          │          │          │          │
│ 4  │          │          │          │          │          │
│ 5  │          │          │          │          │          │
│    │                                                       │
│    │                     GRÁFICO                            │
│    │                                                       │
├────┴───────────────────────────────────────────────────────┤
│ Dados │ Treinamento │ Resultados                           │
└───────────────────────────────────────────────────────────┘
```

## 3. Funcionalidade 1 – Edição direta

O usuário deverá conseguir:

- clicar em uma célula;
- digitar texto;
- digitar números;
- editar conteúdo existente;
- usar Enter;
- usar Tab;
- usar Delete;
- navegar pelas setas.

### Teste

Clicar em `A1` e escrever:

```text
Temperatura
```

Clicar em `B1` e escrever:

```text
950
```

### Critério de aceite

O conteúdo deve aparecer imediatamente na célula.

## 4. Funcionalidade 2 – Barra de fórmulas

Ao selecionar uma célula, o sistema deverá mostrar:

- endereço da célula;
- conteúdo;
- fórmula.

Exemplo:

```text
F10
=B4*$C$2
```

O usuário deverá conseguir editar também pela barra.

### Critério de aceite

Alterar a fórmula na barra deve alterar a célula correspondente.

## 5. Funcionalidade 3 – Fórmulas

A POC deverá suportar:

```text
+
-
*
/
^
```

E inicialmente:

```text
SUM
AVERAGE
MIN
MAX
IF
ABS
SQRT
POWER
```

Para a prova de conceito, podemos trabalhar internamente com os nomes em inglês.

## 6. Funcionalidade 4 – Referências relativas

Exemplo:

```text
C2 = A2*B2
```

Ao copiar C2 para C3:

```text
C3 = A3*B3
```

### Critério de aceite

A referência deve mudar automaticamente.

## 7. Funcionalidade 5 – Referências absolutas

Exemplo:

```text
C2 = A2*$B$1
```

Copiar para C3:

```text
C3 = A3*$B$1
```

### Critério de aceite

`$B$1` deverá permanecer fixo.

## 8. Funcionalidade 6 – Autofill

O usuário deverá conseguir arrastar uma fórmula para baixo.

Exemplo:

```text
C2 = A2*B2
```

Arrastar até C10.

Resultado:

```text
C3 = A3*B3
C4 = A4*B4
...
C10 = A10*B10
```

## 9. Funcionalidade 7 – Múltiplas abas

A POC possuirá inicialmente quatro abas:

```text
Dados
Treinamento
Resultados
Análise
```

O usuário deverá conseguir navegar entre elas.

Cada aba deverá manter seus próprios dados.

### Critério de aceite

Alterar valores em uma aba não pode apagar o conteúdo das outras.

## 10. Funcionalidade 8 – Fórmula entre abas

Deveremos testar referências como:

```text
=Dados!B2
```

ou:

```text
=Dados!B2*Treinamento!C4
```

Isso será muito importante para os laboratórios futuros.

## 11. Funcionalidade 9 – Gráfico

A aba Resultados deverá possuir inicialmente gráficos ligados às células.

Os gráficos deverão atualizar automaticamente quando os valores da planilha mudarem.

## 12. Funcionalidade 10 – Proteção

Algumas células deverão ser bloqueadas.

Exemplo:

```text
A1:C5
```

O usuário não poderá editá-las.

Outras células ficarão livres.

### Representação visual

Sugestão:

```text
cinza → bloqueada

amarelo claro → editável
```

### Critério de aceite

Tentativa de alteração de célula protegida não deverá modificar seu conteúdo.

## 13. Funcionalidade 11 – Formatação

A POC deverá suportar inicialmente:

- negrito;
- cor de preenchimento;
- alinhamento;
- bordas;
- casas decimais;
- percentual.

Não precisamos implementar toda a barra de formatação do Excel nessa primeira prova.

## 14. Funcionalidade 12 – Salvamento automático

Quando o usuário alterar uma célula:

```text
alteração
   ↓
estado local
   ↓
pequena espera
   ↓
salvamento
```

A tela deverá mostrar algo como:

```text
Salvando...
```

e depois:

```text
Salvo ✓
```

## 15. Funcionalidade 13 – Recuperação

O teste deverá ser:

1. editar várias células;
2. fechar a página;
3. abrir novamente.

A planilha deverá voltar exatamente ao estado anterior.

Para a primeira POC, utilizar armazenamento local do navegador.

## 16. Funcionalidade 14 – Reiniciar exercício

Deverá existir:

```text
[ Reiniciar ]
```

Ao clicar:

```text
Deseja realmente reiniciar o exercício?
```

Confirmando:

- valores do usuário são apagados;
- planilha retorna ao estado original.

## 17. Exercício da POC

O exercício será baseado em Redes Neurais por Correção de Erro.

### Contexto

Uma linha de produção de chapas de aço precisa prever o desvio de espessura de uma chapa em relação ao valor nominal.

Um neurônio simples utiliza duas variáveis de processo normalizadas:

- `x1` = velocidade da linha;
- `x2` = desvio de temperatura.

A saída prevista é comparada com a saída real e o erro é utilizado para atualizar os pesos.

## 18. Aba Dados

Criar inicialmente:

| Amostra | x1 | x2 | Saída real |
|---|---:|---:|---:|
| 1 | 0.20 | 0.40 | 0.30 |
| 2 | 0.30 | 0.50 | 0.38 |
| 3 | 0.50 | 0.80 | 0.62 |
| 4 | 0.60 | 0.70 | 0.65 |
| 5 | 0.80 | 0.90 | 0.85 |

Parâmetros iniciais:

```text
Peso inicial w1 = 0.20
Peso inicial w2 = 0.30
Taxa de aprendizado = 0.10
```

Esses valores deverão ser protegidos.

## 19. Aba Treinamento

Criar as colunas:

```text
Amostra
x1
x2
w1
w2
Saída prevista
Saída real
Erro
Novo w1
Novo w2
```

## 20. Cálculo da saída prevista

A fórmula conceitual será:

```text
ŷ = x1*w1 + x2*w2
```

Exemplo de fórmula:

```text
=B4*D4+C4*E4
```

## 21. Cálculo do erro

Utilizar:

```text
erro = saída real - saída prevista
```

Exemplo:

```text
=G4-F4
```

## 22. Atualização dos pesos

Utilizar:

```text
novo_w1 = w1 + eta*erro*x1
```

e:

```text
novo_w2 = w2 + eta*erro*x2
```

A taxa de aprendizado deverá utilizar referência absoluta à aba Dados.

Exemplo conceitual:

```text
=D4+Dados!$B$10*H4*B4
```

e:

```text
=E4+Dados!$B$10*H4*C4
```

## 23. Continuidade dos pesos

Os pesos calculados em uma linha serão utilizados na amostra seguinte.

Exemplo:

```text
D5=I4
E5=J4
```

## 24. Aba Resultados

Criar:

```text
Amostra
Saída real
Saída prevista
Erro absoluto
```

Erro absoluto:

```text
=ABS(B2-C2)
```

Calcular também:

```text
MAE
```

com:

```text
=AVERAGE(D2:D6)
```

## 25. Gráficos

Criar dois gráficos.

### Gráfico 1

**Saída real × Saída prevista**

Eixo X:

```text
Amostra
```

Séries:

```text
Saída real
Saída prevista
```

### Gráfico 2

**Erro absoluto por amostra**

Eixo X:

```text
Amostra
```

Eixo Y:

```text
Erro absoluto
```

Os gráficos deverão atualizar automaticamente.

## 26. Aba Análise

Criar perguntas interpretativas:

### Questão 1

```text
Qual peso sofreu a maior variação?
```

### Questão 2

```text
O erro diminuiu durante o treinamento?
```

### Questão 3

```text
O que pode acontecer se a taxa de aprendizado for muito alta?
```

Nesta POC não é necessário corrigir automaticamente respostas discursivas.

## 27. Proteção das células

Utilizar:

```text
Cinza → protegida
Amarelo claro → aluno deve preencher
Verde → resposta validada
```

A proteção deverá impedir efetivamente a edição.

## 28. Validação

Criar botão:

```text
Verificar respostas
```

Validar pelo menos:

```text
Saída prevista inicial
Erro inicial
Novo w1
Novo w2
MAE
```

Usar tolerância quando necessário.

## 29. Fórmula obrigatória

Algumas células deverão exigir fórmula.

Criar uma propriedade conceitual:

```text
requireFormula = true
```

Nesses casos verificar:

1. existe uma fórmula;
2. o resultado calculado está correto.

Não exigir inicialmente fórmula textualmente idêntica ao gabarito.

## 30. Feedback

Depois da validação, mostrar algo como:

```text
8 respostas corretas
2 respostas precisam de revisão
```

Não mostrar automaticamente a resposta correta.

Exemplos de feedback:

```text
Revise esta fórmula.
```

```text
Verifique a referência absoluta.
```

## 31. Salvamento automático

Usar `localStorage`.

Não salvar a cada tecla.

Usar debounce.

Mostrar:

```text
Salvando...
```

e depois:

```text
Salvo ✓
```

## 32. Recuperação

Devem ser restaurados após recarregar a página:

- valores;
- fórmulas;
- aba ativa;
- progresso;
- validações relevantes.

## 33. Modelo Mestre

Criar um estado inicial imutável chamado conceitualmente:

```text
masterWorkbook
```

O usuário trabalhará sobre uma cópia desse estado.

## 34. Reiniciar exercício

Criar botão:

```text
Reiniciar exercício
```

Após confirmação:

- apagar progresso salvo;
- restaurar `masterWorkbook`;
- limpar validações;
- voltar ao estado inicial.

## 35. Tecnologias previstas

Utilizar:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS.

Para planilha e fórmulas, considerar arquitetura desacoplada.

Preferencialmente:

- Handsontable;
- HyperFormula.

Antes de adotar definitivamente qualquer biblioteca, verificar licença e compatibilidade de uso.

Para gráficos utilizar uma biblioteca React adequada, como Recharts ou Chart.js.

Para esta POC utilizar persistência via `localStorage`.

## 36. Estrutura sugerida

```text
bi-society-poc/
│
├── app/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   └── spreadsheet/
│       ├── SpreadsheetEditor.tsx
│       ├── FormulaBar.tsx
│       ├── SheetTabs.tsx
│       ├── TrainingChart.tsx
│       └── SaveStatus.tsx
│
├── data/
│   └── neural-network-demo.ts
│
├── lib/
│   ├── spreadsheet/
│   ├── validation/
│   └── storage/
│
├── types/
│   └── spreadsheet.ts
│
└── tests/
```

Não concentrar toda a implementação em um único arquivo.

## 37. Não implementar ainda

Não implementar nesta POC:

- login;
- matrícula;
- Supabase;
- PostgreSQL;
- professor;
- administrador;
- cursos completos;
- capítulos completos;
- upload de vídeo;
- importação XLSX;
- pagamento;
- IA generativa;
- versionamento avançado.

## 38. Critérios de aceite da POC

A POC será considerada aprovada quando funcionar:

1. edição direta de células;
2. barra de fórmulas;
3. fórmulas;
4. referências relativas;
5. referências absolutas;
6. referências entre abas;
7. autofill;
8. quatro abas;
9. gráficos atualizados automaticamente;
10. proteção de células;
11. validação;
12. fórmula obrigatória;
13. salvamento automático;
14. recuperação após recarregar;
15. reinicialização para o Modelo Mestre.

## 39. Forma de desenvolvimento

Não implementar tudo de uma vez.

Trabalhar incrementalmente.

Antes de cada etapa:

1. explicar brevemente o que será feito;
2. implementar;
3. executar build/testes;
4. corrigir erros encontrados;
5. informar os arquivos modificados;
6. aguardar nova instrução antes da próxima grande etapa.

## 40. Primeira etapa

Começar SOMENTE pela:

### ETAPA 1 – Estrutura inicial + planilha editável

Implementar:

- projeto Next.js com TypeScript;
- estrutura de pastas;
- página principal;
- identidade visual inicial BI.Society;
- grid semelhante a planilha;
- edição direta nas células;
- navegação por teclado.

Ainda NÃO implementar:

- fórmulas;
- múltiplas abas;
- gráficos;
- validação;
- persistência.

Ao concluir:

1. executar o build;
2. corrigir erros;
3. apresentar resumo;
4. listar arquivos criados/modificados;
5. listar dependências instaladas;
6. informar como testar manualmente.

Não iniciar a Etapa 2 sem nova instrução.
