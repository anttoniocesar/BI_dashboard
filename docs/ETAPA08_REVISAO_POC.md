# ETAPA 8 — Revisão Técnica e de Experiência da POC 01

Data: 22/10/2026. Escopo: auditoria da implementação das Etapas 1 a 7.
Nenhuma funcionalidade, dependência ou teste existente foi alterado nesta revisão.

## A. Situação atual

A POC demonstra o ciclo de edição, cálculo, visualização, proteção, avaliação e
recuperação local de um exercício. A suíte atual e o build passam. Existe uma base
reutilizável de cálculo e regras, mas o produto ainda não é um motor inteiramente
genérico: o editor, os seletores gráficos e a persistência conhecem o exercício
de Redes Neurais. Não está pronto para importar XLSX arbitrário ou operar com
identidade de vários alunos.

**Parecer:** preservar a implementação e fazer uma rodada curta de estabilização
antes de novas funcionalidades. Há um P0 confirmado de navegação por teclado.
Testes aprovados não eliminam os problemas encontrados na inspeção exploratória.

Foram lidos integralmente `POC01_SPEC.md`, `README.md` e os documentos
`ETAPA02_FORMULAS.md` a `ETAPA07_SALVAMENTO.md`. Não existe documento separado
da Etapa 1 em `docs/`; suas instruções e regressões estão no README e em
`tests/spreadsheet.spec.ts`. Os documentos antigos descrevem entregas históricas:
suas afirmações de ausência de persistência/proteção não representam a versão atual.

Ambiente: Windows, Node portátil 24.22.1, Next.js 16.4.2, React 19.3.1,
TypeScript 7.0.2, Playwright 1.64.1 e Google Chrome instalado.

### Evidências e limites da revisão

- `npm test`: **64 testes, 64 aprovados, 0 falhos**, duração de aproximadamente 1,2 minuto.
- São 28 testes de funções/modelos e 36 casos de navegador, todos executados pelo Playwright.
- `npm run typecheck`: sucesso.
- `npm run build`: sucesso; rota `/` gerada estaticamente.
- Inspeção adicional no build de produção, servidor temporário em localhost:3001,
  contexto isolado do Chrome: teclado, árvore de acessibilidade, modelo vazio,
  avaliação, dialog e layouts 1440×1000, 1024×768 e 768×800. Nenhum erro JavaScript observado.
- O servidor temporário e o navegador da auditoria foram encerrados. A sessão do
  usuário em localhost:3000 não foi apagada ou manipulada.
- Evidências locais: `test-results/etapa-8-browser-audit.json` e
  `test-results/etapa-8-resultados-{1440,1024,768}.png`, artefatos ignorados pelo Git.
- Não houve auditoria de vulnerabilidades remota, certificação de acessibilidade,
  teste com leitor de tela real ou ensaio de carga com arquivos grandes.

## B. Funcionalidades validadas

| Nº | Funcionalidade | Resultado e evidência |
| --- | --- | --- |
| 1 | Edição direta | Aprovada em células permitidas: clique, digitação, F2, duplo clique e confirmação; `spreadsheet.spec.ts`. |
| 2 | Enter, Tab e setas | Movimentos internos aprovados, incluindo Shift+Enter/Shift+Tab. **Ressalva:** não há saída da grade pelo fluxo normal de Tab; achado UX-01. |
| 3 | Delete e Backspace | Limpam respostas; preservam protegidas. Durante edição, atuam no texto. |
| 4 | Barra de fórmulas | Consulta, edição, cancelamento e confirmação aprovados; protegidas permanecem somente leitura. |
| 5 | Operações matemáticas | `+`, `-`, `*`, `/`, `^` e parênteses cobertos no motor. |
| 6 | Funções implementadas | `SUM`, `AVERAGE`, `MIN`, `MAX`, `ABS`, `SQRT`, `POWER` aprovadas. `IF` não está habilitada. |
| 7 | Referências relativas | Translação de uma célula copiada aprovada. |
| 8 | Referências absolutas | `$` de linha/coluna, inclusive referências mistas, preservado. |
| 9 | Referências entre abas | Referências qualificadas, nomes entre aspas, erros e ciclos entre abas aprovados; `workbook-engine.spec.ts`. |
| 10 | Copiar/colar fórmulas | Uma célula interna com coordenada de origem ajusta referências; texto externo é literal. Não há colagem de intervalos. |
| 11 | Múltiplas abas | Quatro abas funcionais; conteúdo, seleção e rolagem em memória preservados; `workbook.spec.ts`. |
| 12 | Recálculo | Automático ao confirmar edição; dependências e erros propagam. Rascunho não altera o cálculo exibido antes da confirmação. |
| 13 | Gráficos | Duas séries de saídas e uma de erro; atualização, tooltip, erro, lacunas e recuperação aprovados; `charts.spec.ts`, `chart-data.spec.ts`. |
| 14 | Proteção | Teclado, exclusão, barra e colagem bloqueados; guarda central protege também escrita sem UI; `protection.spec.ts`, `cell-rules.spec.ts`. |
| 15 | Células editáveis | F2:F6/H2:J6 em Treinamento e B3/B6/B9 em Análise continuam livres. |
| 16 | Células pedagógicas | Papéis fornecido/calculado/resposta/editável preservados; cores de avaliação são temporárias. |
| 17 | Validação | Verificação explícita, cinco alvos, vazios, erros, revalidação e invalidação de nota obsoleta aprovados. |
| 18 | Fórmula obrigatória | Literal numérico rejeitado; presença de fórmula e resultado verificados; expressões equivalentes aceitas. |
| 19 | Tolerância | Comparação exata e tolerância inclusiva, com margem de representação numérica, testadas. |
| 20 | Feedback | Mensagem por resposta, status textual e seleção da célula aprovados; painel não mostra gabarito/tolerância. |
| 21 | Pontuação | Pesos 10/10/15/15/20, total 70; acerto por quantidade separado da nota ponderada. |
| 22 | Aprovação | Corte inclusivo de 70% da pontuação, sem arredondar a decisão; teste também cobre exatamente 70%. |
| 23 | Autosave | Debounce de 750 ms, agrupamento com relógio controlado, status real, data, falhas e tentativa ao sair aprovados. |
| 24 | Recuperação | Conteúdo original/fórmulas, aba, seleção e checkpoint de avaliação recuperados; nota/cores reconstruídas. Dados inválidos não derrubam a UI. |
| 25 | Reinicialização | Cancelamento preserva; confirmação limpa chave, avaliação e respostas, volta a Dados e cancela timer anterior; recarga mantém mestre vazio. |

Evidências adicionais: `validation.spec.ts`, `exercise-validation.spec.ts`,
`exercise-storage.spec.ts` e `autosave.spec.ts`. As regressões das etapas antigas
usam o exemplo preenchido explicitamente em `tests/fixtures/demo.ts`; os testes
de autosave também exercitam o verdadeiro Modelo Mestre vazio. Nenhum teste foi
afrouxado ou alterado para esta auditoria.

### Diferenças em relação à especificação completa

`IF` está na especificação, mas a lista permitida no adaptador tem sete funções.
Foi confirmado no navegador: `=IF(1=1,10,20)` produz `#NAME?`.
Autofill por arraste, seleção/colagem de intervalos e desfazer alterações confirmadas
também não existem. Os estilos são CSS fixo, sem modelo de formatação por célula
para casas decimais, percentuais e demais estilos importados.

Esses limites já aparecem nas entregas incrementais; não são regressões novas.
Entretanto, não é correto declarar cumpridos todos os critérios da especificação
original. Registrar formalmente o escopo aceito ou planejar os itens pendentes,
sem implementá-los nesta auditoria.

## C. Arquitetura atual

| Camada | Implementação | Separação e acoplamentos |
| --- | --- | --- |
| Interface | `SpreadsheetEditor`, `FormulaBar`, `SheetTabs`, `ExerciseLab` | Componentizada. Editor ainda coordena teclado, foco, rascunho, workbook, validação, persistência e condições de abas específicas. |
| Motor de fórmulas | `lib/spreadsheet/formula-engine.ts` | Recebe workbook e limites; não importa exercício, React, gráficos ou storage. Parser externo isolado no adaptador. |
| Workbook | `types/spreadsheet.ts`, `data/master-workbook.ts` | Texto original separado do cálculo. Tipos simples e modelo mestre específico do exercício. |
| Regras pedagógicas | `types/cell-rules.ts`, `data/cell-rules.ts`, resolvedor/guarda | Configuração separada de resolução e escrita. Papéis determinam edição e apresentação. |
| Validação | `lib/validation/`, hook e painel | Avaliadores puros, regras centralizadas e DTO público sem gabarito. Editor importa diretamente as regras de Redes Neurais. |
| Gráficos | `lib/charts/`, `components/charts/` | Derivados do cálculo, sem base paralela. Seletor e componentes de séries ainda específicos. |
| Persistência | `lib/storage/exerciseStorage.ts`, `components/storage/` | Acesso ao navegador centralizado. Contrato síncrono e serialização vinculados ao modelo atual; ainda não há repositório genérico/assíncrono. |

Fluxo atual:

```text
Modelo Mestre → cópia do aluno → confirmação de edição → workbook
                                                     ├─ cálculo → grade/gráficos
                                                     ├─ verificação solicitada → resultado público
                                                     └─ snapshot/debounce → localStorage
localStorage → validação estrutural + permissões → cópia do mestre → recálculo
```

### Tamanho, dependências e estado

Foram examinados 32 arquivos TS/TSX de `app`, `components`, `data`, `lib` e `types`.
Uma varredura dos imports/exports locais literais, incluindo import dinâmico,
não encontrou dependências circulares ou destinos locais ausentes. Isso não é
análise dos ciclos internos de bibliotecas externas.

O editor tem aproximadamente 217 linhas; o adaptador de fórmulas, 161; a camada
de storage, 83. Não há um componente enorme por contagem de linhas, mas há
concentração de responsabilidades e JSX muito comprimido no editor.

O workbook é a fonte de conteúdo. Cálculo, gráficos e nota são derivados; isso é
adequado. `checked.source` retém uma referência imutável ao workbook verificado,
não uma segunda fonte editável. `persistableWorkbook` é uma projeção do rascunho.
O estado de salvamento é espelhado entre hook e cabeçalho, criando atualizações
adicionais. `initialSession` e `checked.source` podem reter snapshots antigos.
Não foi demonstrada divergência funcional nesses estados na POC atual.

Há repetição de parsing de endereços no resolvedor, motor, storage e atalho do
feedback; o storage ainda usa regex A–L/1–40 apesar de importar dimensões.
Não existe um `ExerciseDefinition` agregando essas decisões.

### Exercício versus motor

O cálculo e a comparação de respostas são genéricos. O Lab completo ainda não é:

- Editor importa `neural-network-demo`, `master-workbook`, regras pedagógicas e regras de avaliação concretas.
- Editor decide gráficos/altura pela aba `resultados` e layout pela aba `analise`.
- `workbookChartData` fixa `resultados`, A2:D6, B8 e cinco amostras.
- `WorkbookLineChart` recebe chaves restritas a `actual`, `predicted` e `absoluteError`; eixo X chama-se Amostra.
- Painel traduz somente os IDs de Treinamento/Resultados para nomes de abas.
- `SheetTabs` exibe literalmente 40 linhas × 12 colunas.
- Storage fixa a chave, o identificador `poc01-neural-v1`, mestre, permissões e dimensões.
- Cabeçalho e metadados descrevem Redes Neurais diretamente.

Recomendação: introduzir futuramente um descritor de exercício recebido pelo
controlador, com identidade, mestre, dimensões, regras, textos e gráficos.
Os avaliadores e o adaptador de fórmulas devem continuar independentes desse dataset.

## D. Pontos fortes

- Preservação do conteúdo original e das fórmulas, com resultados derivados separados.
- Proteção central e dupla checagem nos caminhos de escrita/restauração.
- Avaliação pura e declarativa, desacoplada da apresentação do gabarito.
- Tratamento de erros de fórmula sem interromper navegação, avaliação ou gráficos.
- Modelo Mestre congelado em runtime: raiz, lista de abas, objetos de aba e mapas de células.
- Cópia do aluno tem mapas próprios; strings de célula não criam compartilhamento mutável.
- Modelo e regras não dependem do DOM; podem futuramente ser carregados de dados validados de banco/Studio.
- Persistência só guarda conteúdo do aluno e metadados mínimos, não repete toda a base protegida.
- Carga no cliente antes de montar editor evita sobrescrever sessão durante hidratação.
- Dialog secundário com Cancelar inicialmente focado; Esc fecha e devolve o foco ao botão de origem, confirmado no Chrome.
- Gráficos dinâmicos carregados sob demanda, sem cálculo paralelo do treinamento.
- TypeScript com `strict: true`, testes de funções e testes de navegador cobrindo as camadas críticas.

Os papéis `provided` e `calculated` implementam proteção por `readOnly`; não há
necessidade de um booleano `protected` duplicado. `answer` e `editable` permitem
escrita. Tolerância, fórmula obrigatória, pontos e feedback são configuráveis por
regra. A estrutura é uma boa base para autoria futura, após validação de esquema,
checagem de alvos e separação entre informações públicas e privadas.

## E. Riscos técnicos

| ID | Prioridade | Risco e efeito |
| --- | --- | --- |
| R-01 | P1 | Acoplamentos concretos do exercício: trocar dataset exige editar UI, gráficos e storage, não apenas carregar configuração. |
| R-02 | P1 | Contrato síncrono de persistência: trocar localStorage por chamada remota exige adaptar controlador, debounce, confirmação de sucesso e reinício. Não basta substituir o corpo de três funções. |
| R-03 | P1 | Avaliação e gabarito no cliente: adequados à POC local, insuficientes como autoridade de nota ou segredo em ambiente real. Ver H. |
| R-04 | P1 | Checkpoint `verified` reconstrói a nota pelas regras atuais, sem revisão do conteúdo pedagógico no snapshot. Uma mudança de mestre/regras mantendo o mesmo identificador pode mudar notas recuperadas. |
| R-05 | P1 | Sessão corrompida/incompatível é ignorada silenciosamente. A aplicação sobrevive, mas o aluno pode interpretar o modelo vazio como perda inexplicada de progresso. |
| R-06 | P2 | Parser depende de lexer interno, correções de MIN/MAX e coletor de dependências especializado. Atualizações exigem regressão e decisão explícita de compatibilidade; não foi auditada sua manutenção/vulnerabilidade remota. |
| R-07 | P2 | Entrada e cálculo síncronos sem orçamento de tamanho/complexidade. As dimensões atuais limitam referências, mas não limitam comprimento de fórmula/texto. Não extrapolar a segurança de desempenho para XLSX grande. |
| R-08 | P2 | Uma sessão por origem, sem identificação de aluno/exercício variável, concorrência, histórico ou backup. Última janela a gravar vence; comportamento já documentado. |

### Performance observada e inferida

Cada render do editor percorre 480 células da aba ativa, sem virtualização ou
componentes de célula memoizados. Rascunho, seleção e atualizações do status podem
reexecutar esse trabalho. É um ponto de atenção, não uma lentidão comprovada
na escala atual.

`calculateWorkbook` está memoizado pelo workbook: seleção, troca de aba e digitação
de rascunho não recalculam tudo. Cada gravação real, inclusive resposta discursiva,
recria parsers e recalcula todas as células preenchidas, com cache apenas dentro
daquela execução. Não existe grafo incremental reutilizado entre edições.

`ResultCharts` memoiza o seletor pelo workbook calculado. Evita refazer o dataset
por seleção, mas qualquer novo cálculo o invalida, mesmo sem mudança nas células
de origem do gráfico. Componentes gráficos ainda podem renderizar junto do pai.

O serializer varre 4 × 40 × 12 posições para escrever no máximo as 23 células
atualmente editáveis com conteúdo. O debounce evita isso a cada tecla, embora o
rascunho crie uma projeção de workbook em memória. Uma sessão de auditoria com
uma resposta textual ocupou 252 bytes em UTF-8; não é o tamanho máximo possível.

Seis confirmações de texto na versão compilada levaram aproximadamente 18–35 ms
entre comando e assertiva Playwright. A medida inclui automação e não é perfil
de render, benchmark de cálculo ou garantia para outros dispositivos. Não foi
identificado travamento nessa amostra pequena. Medir antes de otimizar.

## F. Débitos técnicos

| Item | Diagnóstico | Encaminhamento |
| --- | --- | --- |
| Modelo de célula | `Record<string,string>` não modela tipo original, estilo, formato, comentário ou metadados. Fórmula é inferida pelo prefixo `=`. | Desenhar modelo normalizado antes de importação; não converter tudo silenciosamente em texto. |
| Imutabilidade estática | Congelamento runtime correto, mas `Workbook`/`Worksheet`/`SheetData` não são tipos profundamente readonly. | Expressar mestre readonly e manter tipos próprios para atualização do aluno. |
| Validação de configuração | Regras atuais são TypeScript confiável; não há esquema completo para workbook externo, papéis desconhecidos, nomes duplicados, IDs repetidos de regras ou alvos inválidos. | Validar descritor de exercício na fronteira de entrada antes do futuro Studio/API. |
| Endereçamento | Parsing e limites se repetem; regex do storage fica desatualizada se dimensões mudarem. | Centralizar parser/normalização e validar contra limites recebidos. |
| Editor/controlador | Integração e interação concentradas; conhece concreto do exercício e autosave. | Extrair gradualmente controle da sessão/edição e receber configuração, preservando API de células. |
| Snapshot de avaliação | Nota reconstruída; nenhuma revisão explícita de mestre/regras. | Definir compatibilidade e política de reavaliação sem introduzir histórico nesta POC. |
| Testes | Cobertura funcional boa; não há teste de saída da grade, nome acessível contendo valor ou limiares de contraste. | Adicionar regressões quando corrigir achados, sem modificar os testes atuais para ocultá-los. |
| Documentação de aceite | Especificação ampla e limites incrementais divergem em IF/autofill/formatação. | Matriz única de entregue, adiado e não suportado. |

Não é necessária uma grande refatoração imediata. A prioridade é corrigir o fluxo
de teclado e definir contratos pequenos antes de novas integrações.

## G. Problemas de UX

Classificação de experiência: **Crítico**, **Importante**, **Desejável**.
Prioridades técnicas correspondentes estão em K.

| ID | Classe | Achado e evidência | Melhoria proposta, não implementada |
| --- | --- | --- | --- |
| UX-01 | Crítico | Grade e barra interceptam Tab/Shift+Tab. Shift+Tab em A1 permanece A1; Tab em L40 permanece L40; Esc sem edição também não sai. Usuário de teclado fica sem caminho normal aos controles externos. `SpreadsheetEditor.tsx`, `onKeyDown`/`move`. | Definir saída explícita e documentada por teclado, mantendo Tab interno; testar retorno aos botões, abas e barra. |
| UX-02 | Importante | Célula F2 com conteúdo `3` expôs no Chrome AX apenas `name: F2`, sem valor/descrição. `aria-label={id}` substitui o conteúdo no nome acessível. | Anunciar coordenada, conteúdo, permissão e estado de avaliação sem depender de consultar a barra. Validar com leitor de tela. |
| UX-03 | Importante | Contraste fraco em elementos pequenos e no realce laranja; medições abaixo. Textos auxiliares variam entre 9 e 11 px. | Aumentar legibilidade, contraste de rótulos e força do foco sem perder a identidade visual. |
| UX-04 | Importante | Modelo vazio já exibe previsões `0` e MAE `0.56`. São cálculos válidos de referências vazias, mas visualmente parecem resultados de treinamento concluído. | Indicar que faltam respostas/cálculos; distinguir resultado parcial de resultado pronto sem alterar silenciosamente semântica de fórmulas. |
| UX-05 | Importante | Em 1024×768 a avaliação começa em y≈771 e os gráficos em y≈1483 após verificar. O painel completo aumenta muito a distância entre planilha e gráficos. | Rever densidade/organização do resumo e detalhes, mantendo feedback disponível e botões encontráveis. |
| UX-06 | Importante | Sessão inválida é descartada sem aviso visível. | Informar recuperação do modelo inicial e motivo compreensível, mantendo a aplicação utilizável. |
| UX-07 | Desejável | Grade mínima de 1456 px e Análise com 1944 px; colunas de pesos exigem rolagem horizontal em notebook. Respostas discursivas têm uma linha e texto excedente é recortado. | Melhorar largura útil, visualização de texto extenso e exploração das colunas, sem prometer equivalência total ao Excel. |
| UX-08 | Desejável | Rascunho pausado pode aparecer como salvo e voltar como conteúdo confirmado após refresh; Esc pode restaurar nota anterior. Correto na documentação, pouco explicado na tela. | Explicar discretamente confirmação/rascunho quando necessário. |
| UX-09 | Desejável | Qualquer edição, até em Análise fora da nota, invalida toda a avaliação. | Avaliar invalidação por dependências ou comunicar a política; manter estratégia conservadora enquanto necessário. |

### Contraste e acessibilidade básica

Razões calculadas a partir das cores CSS; triagem adotada: pelo menos 4,5:1 para
texto normal e 3:1 para contornos/gráficos relevantes. Não é certificação completa.

| Par | Razão aproximada | Avaliação |
| --- | --- | --- |
| Conteúdo #34465c sobre resposta #fff5cf | 8,83:1 | Boa legibilidade do conteúdo principal. |
| Texto auxiliar #6b7a8e sobre branco | 4,38:1 | Abaixo do alvo para texto normal. |
| Índices #77869a sobre #f0f3f7 | 3,33:1 | Fraco para os rótulos pequenos da grade. |
| Rodapé #8a97a7 sobre #f3f5f8 | 2,72:1 | Baixo contraste. |
| Laranja #ee7e32 sobre branco | 2,74:1 | Abaixo do alvo de 3:1 para foco/traçado laranja. |

Pontos positivos: labels de campos e botões, `aria-readonly`, tabs com seleção e
setas/Home/End, ajuda de teclado, feedback textual além de cor, resumo com status,
foco explícito nos botões principais e dialog nativo. O gráfico compara séries
também por tracejado, não só por cor; Recharts tem `accessibilityLayer` habilitado.

Ainda há dependência de cor nas células pedagógicas, falta associação mais clara
com cabeçalhos/valor para tecnologia assistiva e não há alternativa tabular própria
para os gráficos (os dados existem na grade, com as limitações de anúncio acima).
Não se conclui acessibilidade integral só pela presença de atributos ARIA.

Após estabilizar ResizeObserver/Recharts, não houve transbordamento horizontal da
página em 1440, 1024 ou 768 px; a rolagem horizontal permaneceu na planilha. Uma
medição imediata ao redimensionar captou largura transitória maior; ela desapareceu
ao estabilizar e não foi classificada como defeito persistente.

## H. Segurança futura

A proteção atual é pedagógica, não autorização. O navegador pode ter seu código
e armazenamento inspecionados. Recalcular a nota na restauração evita confiar num
campo numérico salvo, mas não torna a nota confiável perante um servidor.

| Informação atualmente no frontend | Local | Tratamento para versão real |
| --- | --- | --- |
| Valores esperados dos cinco alvos | `lib/validation/validationRules.ts` | Manter na avaliação privada do servidor. |
| Tolerâncias e lógica completa de comparação | Regras e `validateCell.ts` | Não expor critérios privados; servidor decide resultado oficial. |
| Regras `requireFormula`, pesos e corte | Regras e `validateExercise.ts` | Servidor deve ser autoridade. Pesos/corte podem ser públicos por decisão pedagógica, mas cliente não os autoriza. |
| Fórmulas de solução de todas as linhas | `data/neural-network-demo.ts` | Separar material de autoria/demonstração do pacote entregue ao aluno. A fábrica é importada pelo mestre; apagar células em runtime não remove as expressões do código distribuído. |
| Fórmulas/valores de exemplo em documentação | README e documentos de etapas | Definir quais documentos são de autor/professor antes de publicá-los ao aluno. |
| Checkpoint, respostas e sessão editáveis localmente | localStorage | Tratar como entrada não confiável; não usar como comprovação oficial de conclusão. |

O painel visual não revela diretamente o gabarito, o que é adequado para a POC.
Não foram encontrados `eval` ou `dangerouslySetInnerHTML` no código próprio das
camadas analisadas; isso não equivale a auditoria completa das dependências.
Não foram implementados backend, autenticação, controle de acesso ou dados de alunos.

Antes de vários alunos/notas reais: avaliação autoritativa no servidor,
identidade/autorização por aluno e exercício, regras privadas separadas do payload
público e validação de todo conteúdo recebido. Não há razão para implantar isso
durante esta tarefa de auditoria.

## I. Preparação para importação Excel

| Parte conceitual do workbook | Estado atual |
| --- | --- |
| Worksheets | Lista com ID e nome; quatro abas do exercício, sem operações de autoria. |
| Cells | Mapa esparso por endereço, com strings; útil como base, insuficiente para todos os tipos XLSX. |
| Formulas | Expressão original preservada e adaptador isolado; somente subconjunto de funções/referências. |
| Styles | Ausentes no modelo; CSS da UI aplica padrões fixos. |
| Protection | Configuração pedagógica externa, não proteção/estilos importados do Excel. |
| Metadata | Sem identidade genérica de workbook, revisão de conteúdo, origem, formatos, dimensões por aba ou configuração de gráficos. |

**Preparação parcial.** O adaptador de cálculo e os IDs de abas ajudam, mas não
há pipeline XLSX nem garantia de round-trip. Antes de implementar importação,
definir um modelo normalizado que represente tipos/formatos, dimensões, fórmulas,
estilos, proteção e metadados. O importador deverá declarar capacidades e rejeitar
ou sinalizar funções não suportadas, datas, mesclagens, nomes definidos, links
externos e demais recursos, em vez de descartá-los silenciosamente.

O mestre pode futuramente vir do banco/Studio: hoje é um objeto puro independente
do DOM. Será necessário substituir a fábrica concreta por entrada validada,
assegurar identidade e compatibilidade, congelar o modelo aceito e construir a
cópia do aluno. A rotina atual que esvazia toda célula editável também precisará
distinguir resposta vazia de entrada editável com valor inicial intencional.

Gráficos precisam de uma configuração como tipo, título, aba, intervalo, eixo X
e séries. Atualmente há um componente de linha reaproveitável, mas as chaves,
intervalos e textos são fixos. Não há editor de gráficos nem ele foi criado aqui.

## J. Preparação para Supabase

**Camada localizada, troca ainda não transparente.** Somente
`lib/storage/exerciseStorage.ts` acessa localStorage, ponto positivo. Entretanto:

- `loadExerciseState` retorna de forma síncrona; a montagem assume esse contrato.
- O autosave considera sucesso ao receber imediatamente timestamp ou `null`.
- O reinício espera booleano imediato para fechar o dialog/remontar o editor.
- Flush em saída usa escrita local síncrona; uma chamada remota não tem a mesma garantia.
- Serializer, chave e mestre não recebem contexto genérico de exercício/aluno.

Antes da integração remota, propor um contrato de repositório assíncrono com
`load(context)`, `save(context, snapshot)` e `clear(context)`, onde o contexto
identifica exercício e sessão/aluno. O controlador deve tratar pendência, erro,
confirmação de sucesso e respostas fora de ordem. O localStorage poderá ser um
adaptador desse contrato. Isso preserva a grade e os avaliadores, mas exige
ajustes nos hooks/controlador; não é uma troca sem alterações de integração.

Identidade, políticas de acesso, conflitos de escrita, compatibilidade do modelo
e autoridade da avaliação devem ser definidos antes de notas reais. Nenhum schema
de banco, SDK ou endpoint foi implementado nesta etapa.

## K. Recomendações

P0: corrigir antes de continuar. P1: corrigir em breve, especialmente antes da
integração correspondente. P2: evolução futura, orientada por escopo e medição.

| ID | Prioridade | Recomendação e critério de verificação |
| --- | --- | --- |
| K-01 | **P0** | Corrigir a saída da grade por teclado. O aluno deve alcançar Verificar, abas, barra e Reiniciar sem mouse, sem perder Tab interno; criar regressão para A1/L40 e retorno de foco. |
| K-02 | P1 | Corrigir anúncio de conteúdo/estado das células e os contrastes identificados; verificar árvore acessível, leitor de tela e foco. |
| K-03 | P1 | Definir `ExerciseDefinition` e injetar mestre, dimensões, regras, nomes e gráficos no controlador; demonstrar troca de configuração sem condições de Redes Neurais no motor. Fazer em passos pequenos. |
| K-04 | P1 | Definir repositório de persistência assíncrono e contratos de sucesso/erro/reset antes de Supabase, mantendo o adaptador local e as regressões. |
| K-05 | P1 | Indicar cálculos parciais e respostas faltantes; reduzir distância entre planilha, feedback e gráficos. Não alterar a semântica de referências vazias incidentalmente. |
| K-06 | P1 | Avisar quando sessão for rejeitada; definir identidade/revisão de modelo e política de nota reconstruída para manter compatibilidade. |
| K-07 | P1 | Consolidar matriz de aceite para IF, autofill, formatação, limites da grade e subconjunto de fórmulas. Não declarar XLSX/Excel completo com o escopo atual. |
| K-08 | P1 | Antes de carregar dados do Studio/API, validar esquema/endereços/identidades, centralizar coordenadas e expressar imutabilidade do mestre nos tipos. |
| K-09 | P1 | Antes de liberar notas reais, mover gabarito e autoridade da avaliação para serviço privado e separar pacote do aluno de exemplos de solução. Essa é condição de produção, não bloqueio adicional da POC local. |
| K-10 | P2 | Definir o modelo XLSX normalizado e o contrato declarativo de gráficos antes de implementar seus editores/importadores. |
| K-11 | P2 | Medir cargas representativas; então decidir memoização de células, virtualização, cache incremental, worker e serialização por patches. Não otimizar às cegas. |
| K-12 | P2 | Evoluir visualização de texto longo/área útil e comunicação de rascunho; avaliar invalidação mais seletiva da nota. |
| K-13 | P2 | Planejar concorrência entre janelas, migrações, recuperação e exportação/backup quando o escopo exigir. Rever dependências com seus testes ao atualizá-las. |

**Próxima etapa técnica recomendada:** uma rodada de estabilização do teclado e
acessibilidade, começando por K-01/K-02 e novas regressões desses achados. Depois,
uma extração limitada de contratos de exercício e persistência (K-03/K-04), antes
de iniciar importação Excel, Supabase ou Studio. O restante deve continuar como
backlog priorizado; nenhuma dessas mudanças foi antecipada nesta revisão.
