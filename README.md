# BI.Society Lab — POC 01

`/learn` lista somente cursos publicados com acesso válido do aluno. O modo local
mantém os logins de desenvolvimento, mas não injeta cursos nem concessões demo.
Para uma demonstração isolada com as fixtures históricas, defina
`NEXT_PUBLIC_DATA_MODE=demo` e `NEXT_PUBLIC_DEMO_CATALOG=1` antes de iniciar/buildar.
Deixe a segunda variável ausente no uso normal. Detalhes em
[LEARN_COURSE_ACCESS.md](docs/LEARN_COURSE_ACCESS.md).

Etapa 22: tentativas do Learn persistem no Supabase, com recuperação de senha
oficial, validação de produção, health/ready e smoke remoto configurável. O piloto
usa o curso canônico `neural-pilot`. A autoria agora persiste cursos, capítulos,
atividades e Labs, com draft/published/archived, preview e publicação. Modelo,
migrations e regras em [PERSISTENT_COURSE_AUTHORING.md](docs/PERSISTENT_COURSE_AUTHORING.md).
Setup e limites em [ETAPA22_PRODUCTION_MVP.md](docs/ETAPA22_PRODUCTION_MVP.md),
[checklist pré-piloto](docs/PILOT_CHECKLIST.md) e
[runbook da aula](docs/CLASSROOM_RUNBOOK.md). Produção exige configuração explícita;
para build demo interno, defina `BI_SOCIETY_ALLOW_DEMO_PREVIEW=1`.

Etapa 21: aceitação integrada Admin → aluno → professor, autoria/importação com
merges, permissões, navegação e regressão visual. Use `npm run test:smoke` para
o smoke e `npm run test:e2e` para a aceitação (inclui a dependência histórica da
integração Supabase controlada). `npm test` mantém a suíte completa.
Veja [ETAPA21_E2E_INTEGRATION.md](docs/ETAPA21_E2E_INTEGRATION.md) e o
[mapa de navegação](docs/NAVIGATION_MAP.md).

Células mescladas de XLSX são preservadas na revisão, Studio Editor, simulações
e Learn pelo renderer comum. Modelo, interação e testes em
[AJUSTE_CELULAS_MESCLADAS.md](docs/AJUSTE_CELULAS_MESCLADAS.md).

Etapa 20: professores associados ao curso acessam `/studio/monitoring` para
acompanhar alunos, progresso, capítulos e atividades. `/learn` mostra o próprio
progresso consolidado. No Supabase, aplique também a migration de monitoramento;
setup, regras e limites em
[ETAPA20_MONITORING_REPORTS.md](docs/ETAPA20_MONITORING_REPORTS.md).

Etapa 19: configuração opcional Supabase Auth/PostgreSQL, migrations com RLS e
repositories para Admin e progresso. Sem configuração, o modo demo continua
disponível. Copie `.env.example` para `.env.local` e siga
[ETAPA19_SUPABASE_PERSISTENCE.md](docs/ETAPA19_SUPABASE_PERSISTENCE.md).
O Lab e os rascunhos pedagógicos não foram migrados para o banco.

Etapa 18: abra `/login` para entrar na demonstração local. Use matrícula
`202700184` ou `cesar@example.com` (aluno), `professor@example.com` (Studio) ou
`admin@example.com` (Admin), com senha de desenvolvimento `demo123`.
Somente AuthSession usa sessionStorage. No modo demo, dados administrativos e
cursos do Studio persistem em localStorage; progresso demo continua em memória.
As áreas exigem permissões e os cursos exigem liberação administrativa.
Consulte [ETAPA18_AUTH_ACCESS.md](docs/ETAPA18_AUTH_ACCESS.md) para fluxos,
limites da proteção no cliente, testes e futura migração para autenticação real.

Etapa 17: administração demonstrativa disponível em `/admin`, com usuários,
múltiplos perfis, matrículas, Curso Avulso, liberação de cursos e professores.
O catálogo é compartilhado com o Studio; a identidade de César no aluno deriva
do modelo administrativo. No modo demo, usuários, matrículas, serviços e vínculos
agora persistem após refresh e reabertura. O Painel oferece **Restaurar dados de
demonstração**, com confirmação, preservando cursos e Lab. localStorage demo não
é backend nem segurança real. Consulte
[AJUSTE_PERSISTENCIA_ADMIN_DEMO.md](docs/AJUSTE_PERSISTENCIA_ADMIN_DEMO.md) e
[ETAPA17_ADMIN_USERS.md](docs/ETAPA17_ADMIN_USERS.md) para modelos, rotas,
integrações, testes e limites históricos dessa etapa.

Etapas 1 a 16: workbook em Next.js, React e TypeScript, com quatro abas funcionais,
fórmulas, referências entre abas, gráficos dinâmicos, proteção, validação pedagógica
e recuperação automática em localStorage. Sem backend.

## Executar

Requer Node.js >= 22 e npm (SDK Supabase; Node portátil 24 disponível neste ambiente).

Neste ambiente foi preparado um Node.js portátil em `.tools/` (ignorado no Git).
Para utilizá-lo no PowerShell desta máquina, antes dos comandos abaixo:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.1-win-x64;$env:Path"
```

```bash
npm ci
npm run dev
```

Abra http://localhost:3000. Para testar edição, abra Análise e clique
em B3, digite `Temperatura` e pressione Enter. Em B6, digite `950` e pressione Tab.
Os valores são salvos automaticamente neste navegador, inclusive fórmulas e aba ativa.

- Clique para selecionar qualquer célula. Edição e colagem são permitidas apenas nas células amarelas.
- Duplo clique ou F2 para editar o conteúdo existente; as setas movem o cursor durante a edição.
- Enter confirma e desce; Shift+Enter sobe.
- Na grade, Tab confirma e avança; Shift+Tab retorna. No fim da linha, continua na seguinte.
- Tab em L40 sai para a aba ativa; Shift+Tab em A1 sai para a barra. Na barra, Tab/Shift+Tab seguem a ordem natural da página.
- As setas movem a seleção quando não há edição em andamento.
- Delete ou Backspace limpam uma célula permitida; Esc cancela uma edição. Sem edição, Esc leva à aba ativa; Shift+Tab volta à célula selecionada.
- Clicar fora da célula confirma a edição.

Recarregar recupera a sessão salva. Use **Reiniciar exercício** e confirme para
apagar o progresso e retornar ao Modelo Mestre com respostas vazias.

## Workbook — Etapa 3

As quatro abas compartilham um único estado. Cada uma mantém células, seleção
e posição de rolagem próprias. Trocar de aba confirma a edição na aba de origem.
As abas também podem ser percorridas pelo teclado: setas, Home e End com foco nelas.

| Aba | Conteúdo inicial |
| --- | --- |
| Dados | Amostras em A1:D6; w1 em B8, w2 em B9 e taxa η em B10 |
| Treinamento | Cinco amostras em A1:J6; referências protegidas e respostas amarelas inicialmente vazias |
| Resultados | A1:D6 vinculados a Treinamento; erro absoluto com ABS e MAE em B8 |
| Análise | Perguntas em B2/B5/B8; respostas livres em B3/B6/B9 |

Para testar a comunicação entre abas:

1. Em Treinamento, selecione B2: a barra mostra `=Dados!B2` e a célula mostra `0.2`.
2. Em Treinamento, altere a resposta amarela F2 para `0.20` e confirme com Enter ou clicando em outra aba.
3. Os dados fornecidos em Dados e as referências fixas permanecem protegidos.
4. Em Resultados, C2 passa a `0.2`, D2 (erro absoluto) passa a `0.1`
   e o MAE em B8 também recalcula.
5. Volte a Treinamento: F2 continua com `0.20`.

Teste a referência absoluta digitando `=Dados!$B$10*Dados!B2` em Treinamento!F2.
Copie essa célula e cole em F3. A barra mostrará `=Dados!$B$10*Dados!B3`:
a taxa continua fixa enquanto a referência B2 acompanha a linha.

Com todas as fórmulas corretamente preenchidas, o exercício produz saída prevista
`0.16`, erro `0.14`, novos pesos `0.2028` e `0.3056` na primeira amostra, e MAE
aproximado de `0.238859976362`. A partir da Etapa 7, o Modelo Mestre tem respostas
vazias; os exemplos preenchidos são mantidos apenas para referência e testes de
regressão. A verificação manual avalia cinco células configuradas.

## Fórmulas — Etapa 2

A grade mostra o resultado; a barra `fx` e o editor de célula mostram o conteúdo original.
Nas células permitidas, edite por qualquer um dos dois locais e confirme com Enter ou Tab, ou clique fora.
Em células protegidas, a barra permite consultar e copiar o conteúdo, sem editar.
Esc cancela o rascunho. O cálculo ocorre ao confirmar, não durante a digitação.

- Operações: `+`, `-`, `*`, `/`, `^` e parênteses.
- Funções: `SUM`, `AVERAGE`, `MIN`, `MAX`, `ABS`, `SQRT`, `POWER`.
- Use nomes em inglês, ponto decimal e vírgulas entre argumentos: `=POWER(2,3)`.
- Referências locais: `=B2*D2+C2*E2`.
- Referências entre abas: `=Dados!B2`, `=Dados!B2*Treinamento!D2`, `=Dados!$B$10`.
- Nomes podem estar entre aspas simples: `='Análise'!B3`.

Para experimentar uma fórmula, digite `=Dados!B2+Dados!C2` na resposta
Treinamento!F2: resultado `0.6`. A barra mostra a fórmula original. Esses testes
alteram as respostas e são salvos. Recarregar recupera essas alterações.

Para copiar uma **célula**, selecione-a sem estar editando e use Ctrl+C / Ctrl+V
(Cmd+C / Cmd+V no macOS). De F2 para F3, `=Dados!B2` vira `=Dados!B3`.
Uma referência como `Dados!$B$10` permanece fixa. Referências mistas também são ajustadas.
Pode copiar células protegidas; a colagem só modifica destinos permitidos.
O conteúdo copiado é uma fotografia da célula no momento da cópia.
Durante a edição, copiar/colar texto mantém o comportamento nativo do campo.
Fórmulas vindas de texto externo são coladas literalmente, pois não têm coordenada de origem.

Experimente `=AVERAGE(Dados!B2:B6)`, `=1/0`, `=Z99` ou `=B2+`: erros são exibidos
na célula e a fórmula continua disponível para correção.

Limites: uma célula por cópia/colagem; sem fill handle, colagem de intervalos,
faixas de linhas/colunas inteiras ou referências 3D como Dados:Resultados!A1. Referências devem
estar na grade A1:L40. Ciclos mostram `#CYCLE!`. Exibição de resultados numéricos
usa até 12 algarismos significativos; o valor calculado mantém a precisão JavaScript.

## Gráficos — Etapa 4

Na aba **Resultados**, a planilha protegida e selecionável permanece acima de dois gráficos:

- **Saída real × Saída prevista**: linhas com marcadores, legenda e duas séries
  (azul-marinho para saída real; laranja tracejado para previsão).
- **Erro absoluto por amostra**: linha laranja com marcadores.

Passe o mouse sobre os pontos para consultar amostra e valores. O MAE continua
em B8 e aparece também no resumo acima dos gráficos. A alteração de Treinamento!F2
para `0.20`, confirmada com Enter, muda a primeira previsão para `0.2`
e o erro absoluto para `0.1`. Ao voltar a Resultados, os gráficos
atualizam sem recarregar. Resultados acompanha as respostas de Treinamento,
mas suas próprias células calculadas estão protegidas.

Os componentes leem exclusivamente o workbook calculado, nas células
Resultados!A2:D6 e B8. Não existe uma segunda base de demonstração ou cálculo
paralelo do erro/MAE. Gráficos são previamente configurados para essas cinco amostras.

Vazios, texto, erros, booleanos e valores não finitos são tratados como lacunas
em cada série; zero numérico continua válido. Amostras sem rótulo válido são
omitidas. Sem dados numéricos, o gráfico apresenta uma mensagem de estado vazio.
O motor de fórmulas mantém suas próprias regras de cálculo: se uma fórmula produzir
um zero válido, o gráfico respeita esse resultado.

Para testar o tratamento de erro, selecione Treinamento!F2, digite `=1/0` e confirme.
Os pontos com erro deixam de aparecer; a interface continua funcionando.
Para testar exclusão permitida, use Delete em Treinamento!F2. A exclusão também é salva.

Os gráficos se ajustam à largura disponível, lado a lado em telas maiores e
empilhados em telas menores. Tooltips, eixos e resumo MAE usam até seis algarismos
significativos; as células mantêm o comportamento anterior de exibição.

## Proteção — Etapa 5

- **Cinza/azul claro — Fornecido**: dados e cálculos protegidos. É possível selecionar,
  navegar, consultar a fórmula e copiar. Digitação, exclusão, colagem e edição pela barra são bloqueadas.
- **Amarelo claro — Preencher**: células para respostas, com edição de texto, valores e fórmulas.
- A borda laranja identifica a seleção em qualquer tipo de célula. A barra indica
  `Protegida` ou `Preencher`. Após verificar, as células avaliadas recebem cores de acerto/revisão.

| Aba | Permissões |
| --- | --- |
| Dados | Toda a aba protegida, incluindo entradas e parâmetros |
| Treinamento | Respostas editáveis F2:F6 e H2:J6; restante protegido |
| Resultados | Toda a aba protegida, incluindo fórmulas e MAE |
| Análise | Respostas editáveis B3, B6 e B9; perguntas e demais células protegidas |

Regras ficam em `data/cell-rules.ts`. Prioridade: **célula > intervalo > padrão da aba**.
Se dois intervalos se sobrepuserem, o último declarado vence. Regras são resolvidas
antes da edição e verificadas novamente no ponto de gravação no workbook.
Tab e Enter mantêm navegação normal, incluindo células protegidas.

Para liberar uma nova célula, adicione `K2: "answer"` em `cells` da aba desejada.
Para um intervalo, adicione `{ range: "K2:K6", role: "answer" }` em `ranges`.
O papel `editable` também permite edição; `provided` e `calculated` bloqueiam.
Exemplos e detalhes em `docs/ETAPA05_PROTECAO.md`.

## Validação — Etapa 6

Clique em **Verificar respostas**, abaixo da planilha. A validação só ocorre
por solicitação: verde significa correto; rosa significa revisar ou não respondida.
O painel mostra feedback por resposta e permite selecionar a célula correspondente.
Não revela valores esperados, fórmulas de referência ou tolerâncias.

| Célula | Resposta | Pontos |
| --- | --- | --- |
| Treinamento!F2 | Saída prevista | 10 |
| Treinamento!H2 | Erro | 10 |
| Treinamento!I2 | Novo w1 | 15 |
| Treinamento!J2 | Novo w2 | 15 |
| Resultados!B8 | MAE calculado, protegido | 20 |

Todas exigem fórmula e comparam o resultado calculado com tolerância numérica.
Um número literal correto não basta. Expressões diferentes com o mesmo resultado
são aceitas. A conclusão exige **pelo menos 70% dos 70 pontos**, sem arredondamento
na decisão. O percentual de respostas corretas é mostrado separadamente da nota ponderada.

Qualquer edição confirmada invalida a avaliação inteira, pois outras respostas
podem depender dela. Um rascunho alterado também oculta a avaliação; cancelar com
Esc restaura a avaliação anterior se nada foi gravado. Verifique novamente após corrigir.
Cores pedagógicas originais e proteção permanecem preservadas.

O Modelo Mestre inicia com respostas vazias. Para testar a revisão, preencha
Treinamento!F2 com um número literal ou uma fórmula incorreta. As respostas discursivas de Análise
continuam fora da nota; o motor já suporta regras de texto simples.

Configuração e detalhes em `docs/ETAPA06_VALIDACAO.md`. Nenhuma dependência nova.

## Salvamento e reinício — Etapa 7

O autosave usa debounce de **750 ms** e a chave
`bi-society:poc01:exercise-state:v1`. O cabeçalho mostra **Salvando...**, **Salvo ✓**
ou **Erro ao salvar**, além da data/hora do último salvamento bem-sucedido.
Uma sessão nova ou reiniciada mostra **Pronto para salvar** até haver uma alteração.

São salvos conteúdo original das células editáveis (incluindo fórmulas), aba,
seleções e situação da verificação. Resultados, gráficos, feedback e pontuação
são reconstruídos com o motor e as regras atuais. Células protegidas e permissões
sempre vêm do Modelo Mestre/configuração; tentativas de sobrescrevê-las no arquivo
salvo invalidam a sessão. JSON inválido, formato incorreto e versões incompatíveis
são ignorados sem interromper a aplicação.

Um rascunho pausado também pode ser salvo e recuperado como conteúdo de célula.
No adaptador local, ao sair/ocultar a página há uma tentativa síncrona de gravar
o último estado sem esperar o debounce. O contrato genérico não garante escrita remota no fechamento.
**Reiniciar exercício** exige confirmação; Cancelar preserva o progresso.
Confirmar remove a chave, esvazia respostas, limpa avaliação e retorna a Dados.
Nenhum timer anterior deve recriar a sessão apagada.

O progresso pertence ao navegador e à origem (endereço e porta). Não há
sincronização entre abas/janelas ou dispositivos. Se o navegador negar armazenamento
ou exceder a quota, a edição continua em memória e o indicador informa o erro.
Detalhes em `docs/ETAPA07_SALVAMENTO.md`.

## Definição de exercício — Etapa 10

O Lab recebe um `ExerciseDefinition`. Identidade, mestre readonly, dimensões,
abas, regras, corte e gráficos declarativos estão na configuração específica em
`data/exercises/neural-error-correction.ts`. O editor e as camadas genéricas não
importam o dataset de Redes Neurais.

Um segundo exercício de soma fica exclusivamente nos testes e usa o mesmo Lab,
com uma aba, grade 4×3, uma fórmula obrigatória e aprovação de 100%.
Novas chaves de sessão derivam do ID/versão; a POC mantém sua chave e compatibilidade
com sessões anteriores. Não há seletor de exercícios na interface do aluno.
Modelo, exemplos, responsabilidades e limites em `docs/ETAPA10_EXERCISE_DEFINITION.md`.

## Repositório assíncrono — Etapa 11

`ExerciseLab` recebe `definition` e `repository`. `ExerciseRepository` oferece
`load`, `save` e `clear` por Promise, com contexto de ID/versão e campos opcionais
de usuário/tentativa. Na página atual, `LocalExerciseLab` injeta o adaptador local,
preservando a chave e sessões anteriores. Não há login ou persistência remota.

O editor só monta após o load. O autosave mantém 750 ms de debounce, serializa
gravações e agrupa alterações enquanto uma operação está pendente. Somente a
confirmação da versão atual mostra Salvo. Erros preservam o trabalho em memória;
uma alteração posterior tenta salvar novamente. Reiniciar aguarda gravação em
curso e exclusão; se a exclusão falhar, preserva a sessão e informa o erro.
Detalhes e limitações em `docs/ETAPA11_REPOSITORY.md`.

## Importação XLSX — Etapa 12

API técnica em `lib/excel-import/`: lê um `.xlsx` local em Node, normaliza tipos,
fórmulas e metadados, gera relatório de compatibilidade e converte para
`ExerciseDefinition`. ExcelJS 4.4.0 e saxes 6.0.0 ficam isolados nessa camada.
O Lab principal continua com o exercício neural, sem tela de upload ou Studio.

Política padrão de importação: células fornecidas/protegidas, sem inferir respostas
ou gabarito. Mesclagens, dimensões e alinhamento básico são reproduzidos no Lab;
os demais estilos e a proteção Excel permanecem como metadata, sem promessa de
reprodução integral do visual do Excel. Há limites explícitos e recursos externos
são bloqueados/reportados. Veja `docs/ETAPA12_IMPORT_XLSX.md` para a API, licenças,
limites, testes no mesmo Lab e análise de outro arquivo com JSONs locais.

## Importação visual no Studio — Etapa 13

Abra `http://localhost:3000/studio/import` para selecionar/arrastar um XLSX,
analisar compatibilidade, revisar abas/opções e abrir um rascunho no mesmo Lab.
Teste com `tests/fixtures/xlsx/controlled.xlsx`. Avisos permitem continuar;
arquivos inválidos e referências a abas desmarcadas bloqueiam a abertura.

A análise usa um Route Handler Node na mesma origem, em memória, sem salvar o
arquivo. A prévia em `/studio/import/preview` é temporária: atualizar ou sair da
jornada descarta a importação. O progresso do aluno em `/` continua separado.
Não há publicação, login ou painel completo do professor. Arquitetura, opções,
testes e limitações em `docs/ETAPA13_STUDIO_IMPORT_UI.md`.

## Studio Editor — autoria temporária

Após importar e abrir no Lab, clique **Abrir no Studio Editor** para acessar
`/studio/editor`. Edite conteúdo e fórmulas na mesma grade e configure papéis,
respostas, tolerância, fórmula obrigatória, pontos e feedback no painel lateral.
Confirme os campos com **Aplicar avaliação**. **Visualizar como aluno** e
**Testar exercício** aplicam proteção e começam com respostas vazias; sair descarta
as respostas simuladas. **Salvar rascunho** mantém a autoria apenas na memória
da jornada Studio, sem alterar o progresso do aluno. Refresh/saída descarta os dados.
Arquitetura, testes e limites em `docs/ETAPA14_STUDIO_EDITOR.md`.

## Cursos no Studio — estrutura temporária

Abra `/studio/courses` para criar um **Curso Avulso**, editar seus dados e
organizar capítulos e atividades de vídeo, texto, material, Lab e avaliação.
Subir/Descer ordenam os itens. A exclusão de capítulo pede confirmação.
**Validar estrutura** aponta lacunas; **Visualizar estrutura do curso** mostra
uma prévia da organização, sem progresso real do aluno.

**Salvar rascunho** no Studio Editor disponibiliza o exercício na biblioteca
temporária. Uma atividade Lab guarda uma referência a esse exercício e oferece
**Editar exercício**; Voltar retorna ao curso. Novos salvamentos atualizam a
definição vinculada. Tudo permanece apenas na memória do Studio, separado da
sessão do aluno, e se perde ao atualizar/sair. Sem publicação ou banco.
Modelos, rotas, testes e limites em `docs/ETAPA15_COURSE_STRUCTURE.md`.

## Ambiente do aluno — Etapa 16

Abra `http://localhost:3000/learn/neural-demo` para percorrer o curso demonstrativo
com três capítulos. Conclua vídeo/texto de Fundamentos para liberar Correção de
Erro. O Lab neural usa o mesmo editor e conta para o progresso somente após
aprovação em Verificar respostas. Atividades opcionais não bloqueiam o percurso.

No curso do Studio, **Abrir como aluno** usa o curso e os exercícios salvos na
sessão. A navegação cliente conserva cursos, biblioteca e progresso em memória;
refresh/fechamento descarta esses dados. O Lab em `/` continua com seu localStorage
independente. Na jornada do curso, aguarde Salvo antes de navegar para conservar
as respostas na memória temporária. Não há autenticação, matrícula ou publicação.

Rotas, regras de conclusão e limites em `docs/ETAPA16_STUDENT_ENVIRONMENT.md`.

O refinamento da Etapa 16.1 adiciona cabeçalho claro com curso/progresso/perfil
demonstrativo, sidebar azul-marinho, blocos de atividades A/B/C/D… e navegação
inferior. O conteúdo da atividade selecionada fica expandido; o Lab usa a mesma
grade real e oferece Ver instruções e Reiniciar planilha com confirmação.
Não altera regras de progresso/aprovação. Composição, limites e verificações em
`docs/ETAPA16_1_STUDENT_UI_REFINEMENT.md`.

Na Etapa 16.3, a visão geral passou a apresentar sidebar com a trilha completa,
quatro cards de resumo, cenário de montanha local com checkpoints e abertura
horizontal. O título é Visão Geral do Treinamento; curso e progresso permanecem
no cabeçalho. Os mesmos capítulos, bloqueios e regras de progresso são usados.
Detalhes em `docs/ETAPA16_3_COURSE_OVERVIEW_FINAL_UI.md`.

## Verificar

```bash
npm run typecheck
npx playwright install chromium
npm test -- --workers=2
npm run build
npm start
```

Os testes Playwright iniciam servidores locais automaticamente (aplicação na porta
3000 e harness isolado de repositório na 3002) e verificam os fluxos
de edição e navegação no Chromium. Captura desktop em `test-results/`.
Para usar um Google Chrome já instalado, no PowerShell execute
`$env:PLAYWRIGHT_CHANNEL = "chrome"` antes de `npm test`; nesse caso, o download
do Chromium não é necessário.
Se o Chrome deixar de renderizar frames após suspensão/retomada no Windows,
`$env:PLAYWRIGHT_DISABLE_GPU = "1"` habilita renderização por software apenas no
navegador de testes, preservando asserções, timeouts e dois workers. O diagnóstico
observado nesta máquina está registrado na documentação da Etapa 15.

## Organização

- `app/`: página, layout e estilos (Tailwind CSS com estilos próprios).
- `components/spreadsheet/`: editor, barra da célula e abas funcionais.
- `components/charts/`: gráficos, container de Resultados e tooltip compartilhado.
- `components/validation/`: estado separado da avaliação e painel de feedback.
- `components/storage/`: recuperação inicial, autosave, status e confirmação de reinício.
- `data/master-workbook.ts`: modelo congelado com respostas vazias e cópias do aluno.
- `types/exercise-session.ts`: esquema persistido e estado de salvamento.
- `types/exercise-repository.ts`: contrato assíncrono, contexto e confirmação de gravação.
- `lib/storage/LocalStorageExerciseRepository.ts`: adaptador padrão local, assíncrono.
- `lib/storage/ExercisePersistenceController.ts`: debounce, fila e coordenação do reinício.
- `lib/storage/exerciseStorage.ts`: único acesso direto a localStorage; funções locais de compatibilidade.
- `lib/storage/exerciseSessionCodec.ts`: serialização/validação independente do meio de persistência.
- `types/validation.ts`: regras tipadas e resultados públicos da avaliação.
- `types/exercise.ts`: contrato de exercício, gráficos e metadata das abas.
- `data/exercises/`: configuração e regras específicas de Redes Neurais.
- `lib/exercises/definition.ts`: validação de configuração e resolução de dimensões.
- `lib/excel-import/`: adaptador XLSX, modelo normalizado, compatibilidade e conversão de descriptor.
- `components/studio/import/`: jornada de importação, relatório, seleção e prévia.
- `lib/storage/VolatileExerciseRepository.ts`: repositório em memória da prévia do professor.
- `lib/validation/`: funções puras de validação, sem dataset de exercício.
- `types/spreadsheet.ts`: tipos independentes de bibliotecas de grid.
- `types/cell-rules.ts`: tipos das permissões e papéis pedagógicos.
- `data/cell-rules.ts`: regras centralizadas do exercício.
- `lib/spreadsheet/cell-rules.ts`: resolução de prioridades e guarda de escrita.
- `lib/spreadsheet/coordinates.ts`: endereçamento das células.
- `lib/spreadsheet/formula-engine.ts`: adaptador do parser, cálculo do workbook e ajuste de referências.
- `lib/spreadsheet/clipboard.ts`: metadados de origem da cópia de célula.
- `lib/charts/workbookChartData.ts`: seleção segura das células calculadas para os gráficos.
- `data/neural-network-demo.ts`: inicializador do workbook e fórmulas do exercício.
- `tests/`: testes de modelos/interação; MemoryRepository e harness de falhas/atrasos fora do bundle da aplicação.

Nenhuma biblioteca de planilha foi adotada: o grid usa React e controles nativos.
O cálculo usa `fast-formula-parser` 1.0.19 (MIT), isolado do grid.
A decisão de licença está em `docs/ETAPA02_FORMULAS.md`; a estrutura atual e
os limites estão em `docs/ETAPA03_WORKBOOK.md`.
Os gráficos usam Recharts 3.10.1 (MIT), carregado apenas ao abrir Resultados.
Arquitetura e limites em `docs/ETAPA04_GRAFICOS.md`.
A especificação completa está em `docs/POC01_SPEC.md`. A auditoria está em
`docs/ETAPA08_REVISAO_POC.md`; as correções de teclado, descrições acessíveis,
contraste e foco estão em `docs/ETAPA09_ESTABILIZACAO.md`.
