# Etapa 13 — Tela de importação XLSX do BI.Society Studio

Primeira jornada visual do professor: selecionar arquivo, analisar, revisar e
abrir um rascunho no mesmo `ExerciseLab`. A página do aluno em `/`, o exercício
neural, seu Modelo Mestre e a chave local de progresso não foram substituídos.
Nenhuma dependência foi instalada.

## Rotas e fluxo

| Rota | Responsabilidade |
| --- | --- |
| `/` | Lab do aluno, preservado. |
| `/studio/import` | Seleção, análise, relatório, revisão de abas/opções e prévia de conteúdo. |
| `/studio/import/preview` | Rascunho temporário no mesmo `ExerciseLab`. |
| `POST /api/studio/import` | Fronteira Node para a análise real da Etapa 12. |

A tela usa identidade azul-marinho/laranja, marca BI.Society, identificação de
ambiente do professor, cabeçalho, ações Voltar/Cancelar e stepper de quatro etapas.
O stepper é uma lista com `aria-current="step"`; avançar/voltar usa controles
explícitos, evitando saltos para uma etapa ainda não validada.

1. **Selecionar arquivo:** botão nativo ou drag-and-drop. Aceita um `.xlsx`, não vazio,
   com até 2 MiB. Mostra nome, tamanho, MIME informado pelo navegador, Remover e Analisar.
2. **Analisar:** mostra `Analisando arquivo...`, impede pedidos duplicados e permite
   cancelar. Sucesso apresenta o relatório; erro crítico impede avançar.
3. **Revisar:** permite marcar abas e opções, consultar metadados e prévia somente
   leitura e resolver referências a abas removidas.
4. **Abrir no Lab:** cria a definição, navega para a rota de preview e identifica
   explicitamente `Rascunho · 0.1-draft` e `Pré-visualização da importação`.

## Fronteira client/server e arquivo

Foi escolhido um **Route Handler** com `runtime = "nodejs"`. O Client Component
não importa ExcelJS, saxes, ZIP ou `importWorkbook`. Envia o próprio `File` como
corpo binário ao Next da mesma origem; o nome UTF-8 vai codificado em `X-File-Name`.
Não há arquivo/workbook em query string, URL de dados ou armazenamento permanente.

O handler:

- verifica origem quando informada, presença/nome/extensão e tamanho anunciado;
- lê o stream com contagem real, interrompendo acima de 2 MiB mesmo sem Content-Length;
- recusa corpo vazio e chama `importWorkbook(bytes, fileName)` da Etapa 12;
- devolve JSON `ImportResult` e `Cache-Control: no-store`;
- usa 400 para entrada inválida, 403 para origem divergente, 413 para tamanho e
  422 para arquivo que o importador não conseguiu analisar.

O corpo binário foi escolhido para não precisar consumir um multipart inteiro
antes de aplicar o limite. Não se confia apenas na extensão/MIME do navegador:
ZIP, XML, CRC, limites de expansão, dimensões e recursos são analisados pelo
importador existente. O MIME é informativo, pois navegadores podem informá-lo
como vazio ou `application/octet-stream` mesmo para XLSX válidos.

O arquivo chega ao próprio servidor Next **somente para análise em memória**.
Não é gravado em disco/banco nem enviado a outro serviço. Ao concluir a chamada,
o servidor não guarda uma sessão de importação; retorna o modelo e o relatório.
Esta é a única fronteira de processamento adicionada, sem serviço de publicação.

## Estado e concorrência da jornada

`ImportJourneyProvider` fica no layout compartilhado de `/studio/import` e preview.
Mantém File, resultado, etapa, abas selecionadas, opções, aba inspecionada e
rascunho em memória React. O layout preserva esse estado ao navegar entre as duas
páginas pelo Next. Voltar à revisão mantém arquivo/análise/opções.

Uma referência impede chamadas duplicadas de análise. `AbortController` e uma
sequência de operação invalidam respostas antigas ao cancelar/remover/trocar arquivo
ou sair. Cancelar zera a jornada; uma resposta que chegar depois não a repovoa.
Abortar no navegador não promete interromper uma análise síncrona já iniciada no
servidor, mas ela continua limitada e sem persistência.

Estados visíveis: seleção vazia, arquivo selecionado, erro de seleção, análise
pendente, relatório válido/com avisos, erro crítico, falha de comunicação com nova
tentativa, revisão inválida e rascunho pronto. Falhas de rede conservam o arquivo
para tentar novamente. Novo arquivo invalida análise/rascunho anteriores.

O rascunho recebe ID `import-{timestamp}-{UUID}` e versão `0.1-draft`; isso é apenas
identidade temporária, não versionamento real. O título é o nome do arquivo.

`VolatileExerciseRepository` implementa o contrato assíncrono da Etapa 11 com mapas
em memória e cópias independentes. Não usa localStorage, sessionStorage, cookies,
disco, servidor ou `saveOnExit`. O indicador do Lab confirma somente a gravação
nessa memória temporária, como explicado pelo banner. Sair do escopo, atualizar
ou abrir a prévia diretamente não recupera o arquivo: a página orienta iniciar
uma nova importação. Não existe token de recuperação ou histórico.

## Relatório

O resumo vem diretamente de `ImportReport`, sem recalcular números arbitrários
na interface. Os seis cards mostram Abas, Células, Fórmulas, Gráficos, Avisos e
Erros. Há também fórmulas compatíveis/revisão e células preenchidas.

`OK`, `WARNING` e `ERROR` aparecem com símbolo, rótulo e cor: verde, amarelo e
vermelho. Detalhes usam HTML nativo `details/summary`, lista rolável acessível,
código, mensagem e contexto disponível (aba, célula, parte/recurso).

Warnings permitem continuar. `ok: false` mostra `Não foi possível importar este
arquivo.`, motivos e Escolher outro arquivo, sem controle para revisão/abertura.
Fórmulas não habilitadas, como IF, continuam visíveis no relatório. A interface
não tenta ocultar limitações do motor ou prometer equivalência completa com Excel.

## Revisão de abas e opções

As abas começam marcadas. A última não pode ser desmarcada: o estado continua
válido e uma mensagem informa que ao menos uma deve permanecer selecionada.
Cada aba mostra nome, linhas, colunas, preenchidas, fórmulas e avisos que possuem
essa aba explicitamente associada. Recursos globais continuam no relatório geral;
não são atribuídos artificialmente a uma worksheet.

O botão Prévia permite inspecionar inclusive uma aba desmarcada, sem importá-la.
A prévia usa tabela HTML nativa, até 10 linhas × 8 colunas, índices, conteúdo
original e expressões; não usa caches numéricos do Excel nem permite edição.
O cálculo dos resultados acontece no Lab após a conversão.

`reviewImport` projeta o `NormalizedWorkbook` sem mutar a análise original:

| Opção desmarcada | Efeito |
| --- | --- |
| Valores | Textos, números, booleanos, datas e erros de origem tornam-se vazios. Fórmulas selecionadas permanecem e podem mudar de resultado. |
| Fórmulas | Células que continham fórmulas tornam-se vazias. Não se inventa um valor substituto a partir do cache Excel. |
| Formatação disponível | Retira estilos, larguras, alturas e mesclagens do rascunho. |

As omissões geram avisos na Revisão da seleção. Se todas as opções forem
desmarcadas, é permitido gerar abas vazias com suas dimensões e aviso. A proteção
Excel permanece como metadata de origem; nunca define papéis pedagógicos.
Quando marcada, a formatação é preservada no modelo normalizado mantido durante
a jornada, sem passar a ser renderizada pela grade atual.

Ao remover uma aba, o lexer identifica qualificadores em fórmulas mantidas nas
abas selecionadas, inclusive funções não habilitadas cujo texto pode ser tokenizado.
Cada fórmula/aba ausente produz um diagnóstico, sem duplicar a mesma referência.
Texto entre aspas não é confundido com referência. O erro bloqueia Abrir no Lab;
o professor pode remarcar a aba ou optar por não importar fórmulas. Se não for
possível analisar uma expressão após remover abas, a revisão também bloqueia,
em vez de presumir que não há dependências.

Fórmulas externas já bloqueadas são texto inerte no Lab e não passam a executar.
Nomes definidos e referências avançadas não resolvidas mantêm os avisos da Etapa 12;
não foi criado um novo resolvedor de Excel. Gráficos/recursos globais permanecem
como inventário do arquivo, sem inferir vínculos de propriedade com abas.

## Rascunho no Lab

Somente uma revisão válida chama `createExerciseDefinitionFromImport`. O descriptor
contém apenas as abas selecionadas, na ordem original, com dimensões próprias,
Modelo Mestre congelado e células fornecidas/protegidas. Não se inferem respostas,
gabaritos ou validações; regras/gráficos ficam vazios e o corte provisório existente
continua sem aprovar um exercício sem regras.

A rota de preview monta **o mesmo `ExerciseLab`**, com repositório volátil injetado.
Sua barra, navegação, abas e proteção continuam funcionando. O botão de verificação
já existente não ganha regras pedagógicas. Voltar à revisão e Cancelar importação
são ações separadas; nenhuma grava em progresso do aluno ou publica o exercício.

## Acessibilidade e visual

- Seletor por botão nativo, com Enter/Space, além de drag-and-drop.
- Stepper com nomes textuais e etapa atual anunciável; foco dirigido ao título da
  etapa após navegação/análise e ao título da preview após abrir.
- Inputs/checkboxes com labels, botões e links com foco azul-marinho visível.
- Mensagens de erro em alertas, estados em status; informações não dependem de cor.
- Relatórios expansíveis, checkbox mínimo e navegação pelo teclado testados.
- Prévia fonte é uma tabela somente leitura, não uma grade editável com ARIA falsa.
- CSS da jornada usa classes `studio-*`, separado do visual do aluno.

Foram revisados 1440×1000 e 1024×768. No notebook, revisão/preview se empilham;
rolagem horizontal fica dentro da tabela. Não há otimização específica de smartphone.
Não se trata de certificação integral de acessibilidade ou teste com leitor de tela.

## Componentes e arquivos

Criados:

- `app/studio/import/layout.tsx`, `page.tsx`, `import.css`, `preview/page.tsx`.
- `app/api/studio/import/route.ts`.
- `components/studio/import/ImportJourney.tsx`, `StudioImportPage.tsx`,
  `ImportLabPreview.tsx`, `ImportStepper.tsx`, `FileDropzone.tsx`,
  `ImportSummary.tsx`, `ImportIssues.tsx`, `SheetSelector.tsx`, `SheetPreview.tsx`.
- `lib/excel-import/reviewImport.ts`.
- `lib/storage/VolatileExerciseRepository.ts`.
- `tests/studio-import-model.spec.ts`, `studio-import-api.spec.ts`, `studio-import-ui.spec.ts`.
- Este documento.

Modificados: README e `tsconfig.json`. No tsconfig, apenas os arquivos gerados e
o next-env do harness separado foram excluídos da compilação raiz para isolar seus
tipos de rotas; fontes/testes continuam verificados, com strict mantido. O cache
incremental antigo de TypeScript foi regenerado após adicionar as rotas. Não foram
alterados nem afrouxados os 112 testes anteriores, o editor ou o importador original.

## Testes e como experimentar

Os 21 novos casos cobrem seleção, arquivo real, resumo, warnings/errors, seleção
mínima e dependências, opções, preview readonly, geração de rascunho, mesmo Lab,
ausência de escrita no storage do aluno, cancelamento/concorrência, rede, refresh,
drag-and-drop, teclado, foco e layouts. Testes do handler verificam presença,
extensão, origem e limite de stream sem Content-Length; modelos verificam projeção
sem mutação, preservação dos bloqueios e isolamento do repositório temporário.

```powershell
npm run dev
```

Abra `http://localhost:3000/studio/import`, selecione
`tests/fixtures/xlsx/controlled.xlsx`, clique Analisar arquivo, expanda detalhes,
avance para Revisar abas e abra no Lab. A fixture contém IF não suportado para
demonstrar aviso sem bloquear; se desmarcar Dados base mantendo a aba dependente,
a mensagem de referência impede abrir. A documentação da Etapa 12 continua
descrevendo limites, adaptações de tipos e recursos não convertidos.

Para executar somente esta etapa:

```powershell
npm test -- tests/studio-import-model.spec.ts tests/studio-import-api.spec.ts tests/studio-import-ui.spec.ts --workers=2
```

Nesta máquina, usar o Node portátil e `$env:PLAYWRIGHT_CHANNEL = "chrome"`, conforme
README. Capturas em `test-results/etapa-13-{selecionar,revisar}-{1440,1024}.png`.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| 21 testes novos focados | 21 aprovados, sem falhas; aproximadamente 39 segundos. |
| `npm test -- --workers=2` | **133 aprovados, 0 falhos**; 112 anteriores + 21 novos; aproximadamente 1,9 minuto. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; páginas do aluno e Studio estáticas, processamento da API em Node. |
| Visual e teclado | 1440×1000 e 1024×768, foco visível e ausência de transbordamento horizontal da página verificados. |
| Isolamento do aluno | Fluxo de importação sem alterar a chave de progresso do aluno e sem requests externos. |

A suíte completa foi executada com Chrome sobre o build de produção, em servidor
temporário na porta 3001 e harness na 3002. Os servidores temporários foram
encerrados; o servidor e a sessão do usuário na porta 3000 foram preservados.
Nenhuma dependência foi instalada e nenhum teste anterior foi removido ou afrouxado.

## Limitações e próximos escopos preservados

O arquivo, rascunho e seleção não sobrevivem a refresh/saída do escopo. A revisão
não edita células nem aplica estilos Excel na UI. Funções, nomes, matrizes, gráficos,
datas/erros e limites continuam sendo os da Etapa 12. A análise Node é limitada,
mas não implementa timeout/worker, quota por usuário ou serviço público de importação.

O rótulo de ambiente do professor não é autenticação. Não foram criados painel
completo, configuração pedagógica, respostas esperadas, publicação, Supabase,
banco, login, cursos, alunos, histórico, versionamento real ou armazenamento remoto.
