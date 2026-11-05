# Etapa 9 — Estabilização de teclado e acessibilidade básica

Escopo: corrigir o P0 de aprisionamento de teclado e os problemas de foco,
descrição de células e contraste identificados na Etapa 8. Não foram alterados
o exercício, o Modelo Mestre, o motor de fórmulas, os gráficos, o autosave ou
as regras, pesos, tolerâncias e corte da avaliação. Nenhuma dependência adicionada.

## Navegação adotada

| Contexto | Tecla | Comportamento |
| --- | --- | --- |
| Grade, fora dos limites | Tab / Shift+Tab | Confirma edição e seleciona próxima/anterior; continua na linha seguinte/anterior. |
| Última posição L40 | Tab | Confirma eventual edição e sai para a aba ativa, próximo controle na ordem atual da página. |
| Primeira posição A1 | Shift+Tab | Confirma eventual edição e sai para a barra de fórmulas, controle anterior. |
| Barra de fórmulas | Tab / Shift+Tab | Confirma o conteúdo e segue a navegação nativa: célula selecionada / botão Reiniciar exercício. Não desloca a seleção da grade. |
| Grade ou barra durante edição | Esc | Cancela o rascunho e devolve foco à célula, mantendo o comportamento anterior. |
| Grade ou barra sem edição | Esc | Saída rápida para a aba ativa, sem alterar a seleção ou o conteúdo. |
| Aba ativa | Shift+Tab | Retorna à célula selecionada. |
| Aba ativa | Tab | Avança para Verificar respostas, conforme a ordem atual do DOM. |
| Abas | Setas, Home, End | Comportamento anterior preservado, incluindo foco e indicação de seleção. |

Enter, Shift+Enter, setas, F2, Delete, Backspace, cópia/colagem e confirmação por
blur continuam funcionando. No modo de edição, setas e exclusão pertencem ao
campo de texto. A ajuda visível explica Tab nos limites e os dois usos de Esc.

A saída dos limites usa refs dos controles adjacentes. O foco é transferido
depois da confirmação, pois o input de uma célula pode ser desmontado ao confirmar.
A barra permanece montada e usa o Tab nativo. Não há foco obrigatório no container
nem novos elementos extras na sequência de Tab.

O dialog de Reiniciar continua sendo HTML nativo: Cancelar recebe foco inicial,
Tab/Shift+Tab percorrem os botões, Esc fecha e o foco retorna à origem. Não foi
adicionado um gerenciador próprio para substituir o comportamento modal do navegador.

## Conteúdo e estados acessíveis

Cada célula mantém a coordenada como nome acessível, por exemplo `F2`, e recebe
`aria-describedby` com conteúdo exibido, papel, permissão e estado de avaliação.
A combinação nome + descrição informa, por exemplo:

```text
F2 — Valor 0.16. Resposta editável. Não verificada.
B2 — Valor 0.20. Fornecida, protegida.
F2 — Valor 0.16. Resposta editável. Resposta correta.
```

Estados descritos: fornecida/protegida, calculada/protegida, resposta editável,
editável, não verificada, correta, precisa de revisão e não respondida.
Erros de fórmula e feedback público também ficam disponíveis. A descrição não
inclui valores esperados, tolerâncias ou expressão de gabarito.

As descrições ficam fora das células e fora da grade, em um bloco HTML `hidden`
referenciado por ID. Assim, não alteram o conteúdo visual/cópia da célula nem
formam uma segunda leitura de 480 textos no percurso de tecnologia assistiva.
São recuperadas pelo cálculo do nome/descrição acessível por referência.
`aria-readonly` continua refletindo as permissões reais. A barra possui agrupamento
rotulado e referência à permissão da célula e à ajuda de teclado.

O resolvedor das permissões, a guarda de escrita e a validação não foram alterados.
As cores pedagógicas e de acerto/revisão continuam como complemento à informação textual.

## Foco e contraste

- Foco em azul-marinho nos controles navegáveis, com contorno de 2 px.
- Células usam realce interno azul-marinho com detalhe laranja, visível mesmo no
  container com rolagem e em células que recortam o conteúdo.
- A célula selecionada sem foco usa laranja escurecido `#a64b16`, preservando a identidade.
- Durante edição, o input e sua célula têm indicação de foco; em modo de cores
  forçadas, a grade usa contorno de sistema `Highlight`.
- Textos auxiliares, índices e rodapé usam `#52647a`; permissões protegidas usam
  `#4f6279`. O laranja institucional `#ee7e32`, azul-marinho `#142d4e` e fundos
  branco/cinza/amarelo/verde/rosa foram preservados.
- Vários textos de 9–10 px passaram para 11–12 px, sem alterar dimensões das células
  ou transformar a grade em um layout maior. A pequena assinatura da marca tem 9 px.

Razões aproximadas calculadas a partir das cores CSS:

| Elemento | Antes | Depois |
| --- | --- | --- |
| Auxiliar sobre branco | 4,38:1 | 6,06:1 |
| Índices sobre cinza | 3,33:1 | 5,45:1 |
| Rodapé sobre fundo da página | 2,72:1 | 5,55:1 |
| Seleção sobre amarelo | Laranja institucional com contraste insuficiente | 5,28:1 |
| Foco azul-marinho sobre amarelo | — | 12,68:1 |
| Foco azul-marinho sobre rosa | — | 11,75:1 |

O visual dos dados/séries e o comportamento dos gráficos permanecem. Os tons
internos dos eixos e traçados, declarados nos componentes gráficos, não foram
alterados nesta estabilização.

## Arquivos

Criados:

- `lib/spreadsheet/cell-accessibility.ts`: apresentação textual do conteúdo e estado público.
- `tests/accessibility.spec.ts`: 11 regressões de navegação, descrições, foco e contraste.
- `docs/ETAPA09_ESTABILIZACAO.md`: este registro.

Modificados:

- `components/spreadsheet/SpreadsheetEditor.tsx`: limites de Tab, saída por Esc,
  refs de foco, associação de descrições e ajuda.
- `components/spreadsheet/FormulaBar.tsx`: ref, agrupamento rotulado e descrição de permissão/ajuda.
- `components/spreadsheet/SheetTabs.tsx`: ref para a aba ativa, sem mudar suas operações.
- `app/globals.css`: foco, contraste e tipografia auxiliar.
- `README.md`: instruções atuais de teclado e referências de documentação.

O componente de Reiniciar não precisou de alteração: o comportamento nativo foi
preservado e ganhou regressão explícita. Nenhum dos 64 testes anteriores foi
removido, reescrito ou afrouxado.

## Verificação

`tests/accessibility.spec.ts` cobre:

1. Tab interno, quebra de linha, Enter/Shift+Enter e quatro setas.
2. Tab em L40, acesso a Verificar respostas e retorno à grade.
3. Shift+Tab em A1, acesso à barra/Reiniciar e volta à célula.
4. Tab na barra, confirmação da fórmula e ordem nativa de foco.
5. Esc em edição de célula/barra, saída sem edição e preservação da seleção.
6. Nome/descrição com valor, permissão, papel e estado inicial, incluindo célula vazia.
7. Descrições de correto, revisão, vazio, erro e invalidação da avaliação anterior.
8. Setas/Home/End nas abas e entrada/saída natural por Tab.
9. Dialog com Cancelar inicial, Tab/Shift+Tab, Esc e retorno de foco.
10. Foco, contraste e layout em 1440×1000.
11. Foco, contraste e layout em 1024×768.

As verificações de contraste usam cores computadas dos elementos renderizados;
as de descrição usam a descrição acessível calculada pelo Playwright, não apenas
a presença de um atributo. Capturas em `test-results/etapa-9-foco-{largura}.png`
e `test-results/etapa-9-resultados-{largura}.png`. Os testes confirmam ausência de
transbordamento horizontal da página, preservação dos gráficos e avaliação de 70/70
no exemplo preenchido usado exclusivamente pelas regressões.

Resultados finais de entrega:

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | 75 aprovados, 0 falhos; 64 anteriores + 11 novos; aproximadamente 2 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; rota inicial gerada estaticamente. |
| Chrome sobre o build de produção | Saída/retorno por teclado, dialog, foco, cores forçadas, recuperação de fórmula/nota, gráficos e proteção aprovados; nenhum erro JavaScript. |

Uma execução paralela com seis workers excedeu os 30 segundos de um caso antigo
de média/edição. Os quatro testes de fórmulas passaram isoladamente; o caso em
questão levou aproximadamente 5,7 segundos nesse isolamento. A suíte final passou
com dois workers, sem mudar o timeout de 30 segundos ou qualquer asserção. A
concorrência menor reduz a disputa de recursos desta máquina; o episódio fica
registrado, sem atribuí-lo a uma divergência de cálculo não observada.

Na árvore AX do Chrome, a célula F2 expôs `name: F2` e
`description: Valor 0.16. Resposta editável. Não verificada.`; após verificar,
a descrição passou a `Valor 0.16. Resposta editável. Resposta correta.`.
Isso também foi confirmado no build, com o bloco de descrições oculto e referenciado.
Evidências adicionais em `test-results/etapa-9-producao.json` e
`test-results/etapa-9-producao-{1440,1024}.png`.

## Limitações preservadas

Esta etapa não certifica acessibilidade completa nem substitui validação com
leitores de tela reais e diferentes navegadores. Foi utilizado Chrome no Windows.
Nomes de células permanecem curtos; conteúdo e estado são apresentados na descrição,
cuja verbalização depende das configurações da tecnologia assistiva.

As posições navegáveis continuam sendo toda a grade A1:L40, incluindo protegidas.
A saída rápida por Esc evita percorrê-las todas para chegar aos controles externos.
Rolagem horizontal, texto longo em uma linha e distância entre feedback e gráficos
mantêm as características anteriores. Resultados parciais com respostas vazias,
invalidação conservadora da nota, limites de fórmulas e persistência local também
permanecem. Os demais riscos da auditoria continuam no backlog.

Não foram iniciados ExerciseDefinition, repositório assíncrono, Supabase, XLSX,
Studio, backend, autenticação ou outra etapa funcional.
