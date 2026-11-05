# Referências de fórmula com mouse

O `SpreadsheetEditor` compartilhado mantém `formulaEditMode` ativo enquanto há
edição cujo rascunho começa com `=`. Vale para digitação direta, F2, duplo clique
e Formula Bar, tanto no Studio quanto nas simulações e no ExerciseLab do Learn.

Antes deste ajuste, o foco saía do input no clique e `onBlur` confirmava o
rascunho antes de selecionar a outra célula. Durante fórmulas, `onPointerDown`
agora impede essa transferência de foco. O clique insere a referência relativa
no cursor, substituindo o texto selecionado quando houver seleção. Um layout
effect restaura o cursor logo após a referência, antes da próxima digitação.
Cliques dentro do próprio input continuam permitindo posicionar o cursor.

A seleção principal permanece na origem. Células protegidas podem ser
referenciadas, pois a inserção não passa pela autorização de edição do destino.
`mergeAnchor` resolve a referência principal de uma região mesclada. Enter e Esc
usam os caminhos existentes de confirmação/navegação e cancelamento.
Texto comum mantém a confirmação ao clicar em outra célula.

Não houve alteração no parser, cálculo, regras de proteção, validação,
repositórios, debounce, reset ou implementação dos merges. As referências
absolutas, mistas e entre abas continuam disponíveis por digitação manual.

## Limite de escopo: abas e intervalos

A seleção por clique nesta entrega atua na mesma aba. Trocar de aba confirma
a edição, como antes. O editor atual vincula permissões, endereço da Formula Bar,
input direto, mapa de elementos e navegação à aba ativa. Preservar uma origem em
outra aba exigiria separar esses vínculos e testar confirmação/cancelamento,
retorno à origem e autosave nessa condição. Esse trabalho fica para um ajuste
separado, evitando regressões na navegação e proteção existentes.

Cada clique insere uma referência. Arrastar para inserir intervalos também fica
para evolução futura; a inserção está isolada da seleção principal.

## Conferência visual/manual

1. No Studio, use uma planilha com pelo menos 12 linhas e 8 colunas.
2. Defina B11 como `2`, F11 como `6` e H11 como editável/resposta.
3. Selecione H11, digite `=`, clique B11, digite `*` e clique F11.
4. Confira `=B11*F11`, seleção principal em H11 e cursor ainda ativo no input.
5. Pressione Enter: H11 deve mostrar `12` e a navegação avançar para H12.
6. Repita iniciando pela Formula Bar, por F2 e por duplo clique.
7. Repita nas simulações de aluno e no Learn. B11/F11 podem estar protegidas.
8. Faça nova edição e pressione Esc: o valor anterior deve reaparecer.
9. Aguarde Salvo, reabra o exercício e confira a fórmula persistida.

O teste automatizado equivalente em `tests/formula-reference-ui.spec.ts` captura
`test-results/formula-reference-edit.png` antes da confirmação e verifica cálculo,
foco, validação e recuperação após remontar o Lab. O arquivo também cobre cursor
intermediário, substituição de seleção, funções, `$`, merges e texto comum.
`tests/studio-editor-ui.spec.ts` verifica Studio e ambas as simulações.

## Preparação das verificações

Os testes históricos de blur em `spreadsheet.spec.ts` e `formulas.spec.ts`
agora clicam no título da planilha antes de selecionar outro endereço: clicar
na grade durante uma fórmula passou a inserir uma referência. Suas verificações
de cálculo e navegação foram mantidas.

O typecheck encontrou ainda um observador preexistente de `page` no objeto
Browser do teste Supabase, que não emite esse evento. O helper de navegador novo
agora conecta os observadores diretamente à página criada, preservando fechamento
do browser e detecção de erros de console/JavaScript. Somente o erro de rede `401`
do endpoint exato `/api/auth/session` é reconhecido como consulta de sessão
ausente, conforme o contrato de `SupabaseAuthAdapter.restore`; outros erros de
rede/console e exceções JavaScript continuam sendo registrados. A resposta pode
chegar ao console depois da navegação. As asserções de autenticação, isolamento,
reabertura e persistência continuam exigidas em todo o fluxo.

Como nas verificações anteriores do projeto, a suíte completa usa preview de
produção local na porta 3001 e harness na 3002. O servidor de desenvolvimento
introduziu interferência do Dev Tools no foco inicial e corridas de navegação;
essas falhas desapareceram no preview, sem alterar a aplicação ou afrouxar testes.

Para reproduzir, com Node/npm no PATH e Chromium do Playwright instalado:

```powershell
$env:NEXT_PUBLIC_DATA_MODE = "demo"
$env:BI_SOCIETY_ALLOW_DEMO_PREVIEW = "1"
npm.cmd run typecheck
npm.cmd run build
npm.cmd start -- --hostname localhost --port 3001
```

Em outro terminal, mantendo o preview aberto:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
```

Nesta sessão foi usado Node portátil em `.tools/node-v24.22.1-win-x64` e
`PLAYWRIGHT_BROWSERS_PATH=.tools/playwright-browsers`, com Chromium compatível
instalado nesse diretório. As flags valem apenas para o preview interno local.

## Resultados em 25/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2`, preview de produção | 334 testes locais aprovados. A integração Supabase executou todo o fluxo, mas a checagem final registrou os 401 esperados antes da correção do observador. |
| Integração Supabase após ajuste do observador, `--project=supabase-controlled --no-deps` | 1 aprovado, incluindo navegador novo, autenticação, autoria, tentativas, recuperação, reset e isolamento. Artefato: `.tools/formula-supabase-results/.last-run.json`. |
| Total verificado nas execuções acima | 335 testes aprovados: 325 históricos e 10 novos. A suíte completa não foi repetida após o último ajuste, restrito ao observador desse teste de integração. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com preview demo interno, inclusive após o ajuste final do teste. |
| Conferência visual | Captura de H11 com `=B11*F11` inspecionada; o teste verifica foco preservado, resultado 12, validação e recuperação. |

Nenhuma alteração em dependências ou lockfile. Os servidores temporários usados
pelas verificações foram encerrados ao final.
