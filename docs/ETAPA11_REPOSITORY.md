# Etapa 11 — Contrato assíncrono de persistência

Escopo: substituir a dependência síncrona da interface por um contrato de
repositório. A página continua usando localStorage. Não foram alterados o
ExerciseDefinition, o Modelo Mestre, fórmulas, regras pedagógicas, avaliação,
pontuação, gráficos, estilos ou navegação da grade. Nenhuma dependência instalada.

## Interface e contexto

`types/exercise-repository.ts` declara:

```ts
type ExercisePersistenceContext = {
  exerciseId: string;
  exerciseVersion: string;
  userId?: string;
  attemptId?: string;
};

type SaveResult = { lastSavedAt: string };

interface ExerciseRepository {
  load(context: ExercisePersistenceContext): Promise<ExerciseSession | null>;
  save(context: ExercisePersistenceContext, session: ExerciseSession): Promise<SaveResult>;
  clear(context: ExercisePersistenceContext): Promise<void>;
  saveOnExit?(context: ExercisePersistenceContext, session: ExerciseSession): SaveResult;
}
```

`load` retorna uma sessão serializada ou `null`; falhas operacionais rejeitam a
Promise. `save` só resolve quando a gravação foi concluída e devolve a data/hora
confirmada. `clear` resolve quando a exclusão foi concluída. Os campos opcionais
de identidade são apenas parte do contrato; não existe autenticação ou aluno real.

O payload continua sendo o formato mínimo da Etapa 10: versão 1, identidade e
versão do exercício, células editáveis com conteúdo original, aba, seleções,
checkpoint de validação e último salvamento. Não se persistem resultados de
fórmulas, gráficos, gabarito, permissões ou uma nota tomada como autoridade.

`exerciseSessionCodec.ts` contém a serialização e restauração puras, extraídas
sem mudar as verificações anteriores. O Lab valida também a sessão recebida de
qualquer repositório contra a definição atual. Protegidas e conteúdo inicial vêm
sempre da configuração. Sessões inválidas continuam sendo ignoradas como antes.

## Composição

```tsx
<ExerciseLab definition={definition} repository={repository} />
```

`ExerciseLab` não importa funções de localStorage. Recebe uma instância estável
do contrato, cria o contexto com ID/versão e eventuais `userId`/`attemptId`, aguarda
`load`, valida o conteúdo e só então monta o editor. Durante a espera, exibe
`Carregando exercício...`. Uma resolução de load de um efeito cancelado é ignorada.
Nenhum autosave existe antes da montagem do editor; o primeiro snapshot é a base
recuperada, não uma edição a gravar.

Na aplicação atual, `app/page.tsx` usa `LocalExerciseLab`. Esse pequeno componente
cliente cria `LocalStorageExerciseRepository` com `useMemo` e injeta a instância
no Lab. Isso respeita a fronteira do Next: instâncias de classes não são passadas
de um Server Component como se fossem props serializáveis.

## Adaptador local e compatibilidade

`lib/storage/LocalStorageExerciseRepository.ts` implementa o contrato por métodos
assíncronos, usando as funções locais centralizadas em `exerciseStorage.ts`.
Somente essa camada local acessa `window.localStorage`; os componentes e o
coordenador dependem do contrato/codec. Os exports síncronos anteriores são
mantidos para compatibilidade e testes históricos, não são a API do Lab.

O construtor recebe a definição e, opcionalmente, um objeto Storage para testes.
Usa ID, versão e a configuração `persistence` existente para chave, identidade e
recuperação legada. Não há literais do exercício no adaptador genérico.

A POC neural mantém exatamente:

```text
bi-society:poc01:exercise-state:v1
```

Sessões legadas `poc01-neural-v1`, sem `exerciseVersion`, continuam sendo aceitas
pela configuração neural. O adaptador entrega a identidade normalizada ao Lab e
a próxima gravação usa o formato atual. Nenhuma migração destrutiva ou limpeza
automática foi introduzida. Outros exercícios mantêm chaves derivadas do ID/versão.

O adaptador local da POC é anônimo. Rejeita contextos com usuário/tentativa ou
identidade divergente, em vez de silenciosamente misturar essas sessões na mesma
chave. O contrato já permite que um adaptador futuro use esses campos.

## Debounce, concorrência e indicadores

`ExercisePersistenceController` coordena uma sessão montada. O hook
`useExerciseAutosave` apenas comunica snapshots, assina o status e conecta os
eventos de saída. A estratégia é uma fila com **uma gravação por vez**:

1. Alteração: atualiza o snapshot em memória e mostra `Salvando...`.
2. Espera uma pausa de **750 ms**; novas alterações reiniciam o timer.
3. Inicia `repository.save` se não existe gravação em curso.
4. Alterações durante a Promise ficam como snapshot mais recente; snapshots
   intermediários são agrupados. Após a pausa e o término da operação anterior,
   somente o mais recente é enviado.
5. Só uma confirmação correspondente ao snapshot atual mostra `Salvo ✓`.

Assim, a situação A lento/B rápido não pode causar duas gravações concorrentes
do controlador: B espera A antes de começar. Isso protege tanto a ordem de escrita
quanto o indicador, em vez de apenas ignorar uma resposta antiga depois de ela já
ter sobrescrito o armazenamento. Falha de uma operação obsoleta não substitui o
indicador da nova edição nem impede sua gravação.

Falha na gravação atual mostra `Erro ao salvar` e mantém todo o conteúdo em
memória. Não existe repetição infinita automática: uma alteração posterior agenda
nova tentativa, incluindo o estado completo mais recente. A data exibida permanece
a última confirmação válida. Falhas síncronas indevidas de um adaptador também
são capturadas. Desmontar cancela timers/assinaturas e impede novos envios pelo
controlador antigo; uma chamada já enviada não pode ser cancelada genericamente.

## Reinício

Após confirmar o dialog:

1. suspende autosave/flush e cancela o debounce pendente;
2. aguarda a gravação já enviada terminar, com sucesso ou erro;
3. aguarda `repository.clear(context)`;
4. só após sucesso limpa a sessão, remonta o mestre, limpa avaliação/pontuação,
   retorna à aba inicial e fecha o dialog.

Isso impede que uma gravação anterior recrie a sessão depois de clear. Durante
a espera, o dialog anuncia `Reiniciando exercício...`, expõe `aria-busy` e evita
confirmações duplicadas. Cancelar fica indisponível e Esc não fecha **apenas enquanto
a exclusão está em andamento**, pois a chamada já enviada não é cancelável pelo
contrato. O botão Reiniciar conserva o foco. Antes da confirmação, Cancelar recebe
o foco inicial e Esc fecha normalmente; ao concluir/fechar, o foco retorna à origem.

Se clear rejeitar, o dialog continua aberto, informa que o exercício atual foi
preservado e reabilita as ações. Não se altera workbook, avaliação ou sessão salva
por conta de uma exclusão que falhou. É possível cancelar, repetir ou continuar
editando. O contrato exige rejeitar somente quando a operação não foi confirmada;
um adaptador remoto terá de decidir como reconciliar uma resposta de rede ambígua.

## Fechamento da página

`saveOnExit` é uma capacidade **opcional e síncrona do adaptador local**. Eventos
`beforeunload`, `pagehide` e ocultação da página tentam gravar o último snapshot,
sem esperar debounce. Todos os writes desse adaptador completam sincronamente,
inclusive o corpo de `save`; uma geração de flush invalida confirmações antigas
que ainda estejam na fila de microtasks, preservando estado e indicador recentes.
Flush não acontece durante reset, nem depois do descarte do controlador.

Um repositório remoto não deve implementar essa capacidade como Promise ou
prometer entrega no fechamento. Sem ela, o controlador mantém o autosave normal
e não inicia um pedido remoto fingindo que o navegador aguardará sua conclusão.
Fechamento forçado/processo encerrado também não garantem eventos locais. Não há
garantia absoluta de preservação do que ainda não foi confirmado.

## MemoryRepository e testes

`tests/fixtures/MemoryExerciseRepository.ts` oferece load/save/clear, isolamento por
exercício/versão/usuário/tentativa, cópias de payload, registro das chamadas e
comportamentos configuráveis por operação: atraso, falha e uma Promise de controle
(`gate`). Cada chamada captura o comportamento no início. Não possui flush local
e não é importado pela aplicação de produção.

O harness em `tests/repository-harness` é uma aplicação Next separada, somente de
testes, servida na porta 3002 pelo Playwright. Importa o mesmo Lab/editor e injeta
memória; não cria rota, seletor ou controle de teste na aplicação do aluno.
Permite simular carga pendente, saves lentos e clear pendente/rejeitado no navegador.
O exercício de soma também é executado nesse mesmo Lab com memória, sem trocar o
motor ou as regras de UI. Suas fórmulas e nota são recuperadas ao remontar o Lab;
a memória de teste não promete sobreviver ao refresh de toda a aplicação.

Novos casos em `tests/repository.spec.ts` e `tests/repository-browser.spec.ts`:

- adaptador assíncrono, chave antiga, normalização legada e contexto incompatível;
- falhas de leitura, escrita e exclusão;
- isolamento do fake e ausência de garantia de unload remoto;
- load atrasado restaura fórmula/aba/avaliação sem gravar mestre;
- status pendente, falha, conteúdo preservado e nova tentativa;
- serialização de A lento/B mais recente e falha de operação obsoleta;
- reset aguarda save e clear, preserva sessão em falha e mantém foco;
- soma com fórmula, proteção, 7/7, recuperação e reset;
- load rejeitado permite abrir e editar sem gravação inicial.

Os 86 testes anteriores foram preservados. O teste de renderização da Etapa 10
apenas passa a fornecer o repository exigido pelo novo contrato; suas asserções
permanecem iguais. As regressões de debounce, saída imediata, proteção, validação,
gráficos, teclado e acessibilidade continuam na suíte completa.

### Resultados da entrega

| Verificação | Resultado |
| --- | --- |
| 24 casos focados (repository, navegador e autosave) | 24 aprovados, sem falhas. |
| `npm test -- --workers=2`, execução final | **98 aprovados, 0 falhos**; 86 anteriores + 12 novos, aproximadamente 2,2 minutos. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; rota inicial estática, sem rotas de teste na aplicação principal. |
| Extração do codec comparada à implementação anterior | Funções de serialização/restauração preservadas integralmente. |

A execução final usou Chrome: aplicação principal compilada, em servidor temporário
na porta 3001, e harness de memória na 3002. `PLAYWRIGHT_BASE_URL` permite apontar
os mesmos testes a um servidor local de produção já iniciado; sem essa variável,
o padrão continua sendo o dev em 3000. Nenhum limite, asserção ou timeout foi mudado.
Para reproduzir, após o build, iniciar em um terminal `npm start -- --port 3001` e
em outro configurar `$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"` e executar
`npm test -- --workers=2` (Chrome instalado nesta máquina via
`$env:PLAYWRIGHT_CHANNEL = "chrome"`). Os servidores temporários desta verificação
foram encerrados. O servidor/sessão do usuário em 3000 não foi interrompido nem apagado.

A primeira suíte completa no servidor de desenvolvimento teve 97 aprovados e um
timeout de 30 segundos no teste histórico de média, durante `keyboard.type`.
Os quatro testes de fórmulas passaram isoladamente; o caso em questão levou
8,4 segundos. Na execução final completa sobre produção, levou 4,2 segundos.
Não foi observada divergência numérica, e não se atribui uma causa definitiva ao
timeout. A ocorrência fica registrada como instabilidade de execução em dev,
sem ocultar a falha nem afrouxar o teste.

## Arquivos

Criados:

- `types/exercise-repository.ts`.
- `lib/storage/LocalStorageExerciseRepository.ts`.
- `lib/storage/ExercisePersistenceController.ts`.
- `lib/storage/exerciseSessionCodec.ts` (extração das funções puras existentes).
- `components/storage/LocalExerciseLab.tsx`.
- `tests/fixtures/MemoryExerciseRepository.ts`.
- `tests/repository.spec.ts`, `tests/repository-browser.spec.ts`.
- `tests/repository-harness/` (configuração, layout e composição de testes).
- `docs/ETAPA11_REPOSITORY.md`.

Modificados:

- `components/storage/ExerciseLab.tsx`, `useExerciseAutosave.ts`,
  `ResetExerciseButton.tsx` e `SaveStatus.tsx`.
- `components/spreadsheet/SpreadsheetEditor.tsx` (injeção do coordenador no hook).
- `lib/storage/exerciseStorage.ts` (extração do codec com reexports compatíveis).
- `app/page.tsx`, `playwright.config.ts`, `tests/exercise-definition.spec.tsx`, `README.md`.

## Como testar manualmente

1. Execute `npm run dev` e abra `http://localhost:3000`.
2. Em Treinamento!F2, digite `=B2*D2+C2*E2` e confirme. Observe Salvando e Salvo.
3. Atualize a página: aba, fórmula original na barra e valor calculado permanecem.
4. Verifique respostas, aguarde Salvo e recarregue: resultado/cores são reconstruídos.
5. Reiniciar → Cancelar preserva o exercício. Reiniciar → Reiniciar restaura o mestre;
   nova recarga mantém o estado inicial.
6. Execute `npm test -- --workers=2` para simular atrasos/falhas/fila pelo harness,
   sem manipular a sessão pessoal na aplicação principal.

## Como implementar um adaptador remoto futuramente

Criar uma classe que implemente `ExerciseRepository`, recebendo suas dependências
no ponto de composição cliente. Usar o contexto como identidade da sessão, resolver
save somente após confirmação e devolver `lastSavedAt` confirmado. Validar payloads
e rejeitar falhas de load/save/clear; conservar as verificações do codec. Não
implementar `saveOnExit` para rede nem criar fallback silencioso entre contas.

A composição poderá trocar `LocalExerciseLab` por uma composição que injete esse
adaptador, mantendo `ExerciseLab`, editor, workbook, validação e gráficos. Identidade
autenticada, autorização, conflitos entre clientes e reconciliação após falha de
rede serão decisões próprias dessa integração. Nenhum SDK, schema, endpoint ou
classe `SupabaseExerciseRepository` foi implementado nesta etapa.

## Limitações

A fila coordena uma sessão montada. Não fornece concorrência entre janelas,
dispositivos ou vários controladores independentes sobre a mesma chave; a política
local anterior de última escrita permanece. Trocar repository/definição/contexto
é uma mudança de sessão e requer instâncias/props estáveis; chamadas já enviadas
podem concluir mesmo após desmontagem. O contrato ainda não inclui timeout,
cancelamento, retry com backoff, revisão otimista de servidor ou resolução de
conflitos. Um reset aguarda operações pendentes, sem inventar timeout de sucesso.

Os limites anteriores de fórmula, importação e avaliação no cliente permanecem.
Não foram iniciados Supabase, banco, login, aluno real, sincronização remota,
histórico de tentativas, XLSX ou Studio.
