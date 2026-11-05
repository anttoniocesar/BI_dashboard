# Etapa 7 — Salvamento, recuperação e reinício

Somente persistência local, sem backend, contas, histórico ou importação.
A Etapa 8 não foi iniciada. Nenhuma dependência foi adicionada.

## Modelo e arquitetura

`data/master-workbook.ts` deriva o modelo do exercício, esvazia as células editáveis
e congela recursivamente suas estruturas (células, worksheets, lista e raiz).
`createStudentWorkbook()` cria cópias independentes. Dados, parâmetros, referências
e cálculos protegidos permanecem. O exemplo preenchido anterior continua disponível
na fábrica de demonstração para documentação e regressão; não é o estado inicial da aplicação.

`lib/storage/exerciseStorage.ts` concentra todos os acessos ao localStorage e expõe
`loadExerciseState`, `saveExerciseState`, `clearExerciseState`, `serializeExercise`
e `deserializeExercise`. Os adaptadores opcionais permitem testes sem navegador.

`components/storage/ExerciseLab.tsx` recupera a sessão após a montagem no cliente,
antes de apresentar o editor. Isso evita sobrescrever uma sessão válida com o
modelo vazio durante a hidratação. A mesma camada coordena o reinício.
`useExerciseAutosave.ts` controla debounce, descarte de timers e flush ao sair.
`SaveStatus.tsx` mostra o estado real e a data. `ResetExerciseButton.tsx` usa um
dialog modal nativo, com foco inicial em Cancelar e fechamento por Esc.

## Formato persistido

Chave: `bi-society:poc01:exercise-state:v1`.

```json
{
  "version": 1,
  "exerciseId": "poc01-neural-v1",
  "cells": [
    { "worksheetId": "treinamento", "address": "F2", "raw": "=B2*D2+C2*E2" }
  ],
  "activeSheet": "treinamento",
  "selections": { "treinamento": { "row": 2, "column": 5 } },
  "validation": "unverified",
  "lastSavedAt": "2026-10-22T12:00:00.000Z"
}
```

Somente células editáveis com conteúdo são serializadas. Células vazias são
reconstituídas do modelo vazio. Fórmulas são strings originais, nunca resultados
numéricos substituindo expressões. Não são salvos permissões, estilos, gabarito,
valores calculados ou gráficos. Não há versionamento de tentativas; `version`
identifica somente o formato do objeto e `exerciseId` identifica o modelo compatível.

A situação da validação pode ser `never`, `verified` ou `unverified`.
Uma sessão `verified` é recalculada e avaliada ao carregar: cores, feedback,
quantidades, percentuais, pontos e conclusão são reconstruídos com as mesmas regras.
Isso evita confiar em uma nota manipulada ou duplicar dados derivados.
`unverified` recupera a indicação de alterações ainda não verificadas, sem cores
ou nota obsoletas. A restauração não cria uma nova tentativa histórica.

## Autosave e erros

Debounce: **750 ms** após a última mudança no snapshot. Não há escrita por tecla.
O snapshot inclui workbook, aba, seleções e situação da verificação. Um rascunho
pausado também participa; ao restaurar, ele vira conteúdo confirmado da célula.
Cancelar um rascunho com Esc volta ao conteúdo anterior e agenda o salvamento correto.

O indicador só mostra **Salvo ✓** após `setItem` terminar com sucesso. Durante
o debounce mostra **Salvando...**. Na abertura sem sessão, ou após reinício,
mostra **Pronto para salvar**; não afirma que houve uma gravação inexistente.
Falhas de acesso/quota mostram **Erro ao salvar**, mantendo a edição em memória.
Uma nova alteração tenta salvar novamente. O horário exibido é o último sucesso.

`beforeunload`, `pagehide` e passagem para visibilidade oculta tentam gravar
imediatamente o snapshot mais recente, incluindo rascunho. Eventos de saída não
exigem confirmação. Encerramento forçado do processo/sistema pode impedir esses
eventos; nenhuma aplicação local garante gravação nesse caso.

O leitor valida versão/modelo, aba conhecida, timestamp, marcador de verificação,
coordenadas e seleções dentro da grade, strings, duplicatas e permissões atuais.
Qualquer tentativa de gravar uma célula protegida invalida a sessão inteira.
Depois disso, aplica somente os valores aceitos a uma cópia nova do Modelo Mestre.
Conteúdo corrompido/incompatível é ignorado. Não modifica o modelo nem concede edição.

## Reinício

O botão secundário abre a confirmação solicitada. Cancelar ou Esc mantém a sessão.
Confirmar primeiro remove a chave; se a remoção falhar, mantém o exercício atual e
informa o erro no dialog. Se funcionar, remonta o editor com uma cópia do mestre:
respostas vazias, aba Dados, seleção inicial, nenhuma avaliação e nenhuma pontuação
obtida anterior. Os cálculos e gráficos são derivados novamente.

Remontar também cancela timers e listeners do editor anterior. O estado inicial
não é salvo automaticamente, portanto recarregar após reiniciar continua usando
o mesmo modelo vazio, sem recriar a sessão apagada até uma nova interação.

## Verificação e limites

`tests/exercise-storage.spec.ts` verifica imutabilidade, cópias, round-trip,
reconstrução de resultados/nota, esquema inválido, proteção e falhas do adaptador.
`tests/autosave.spec.ts` cobre os estados visuais, limite de 750 ms com relógio
controlado, agrupamento de edições, atualização/fechamento, fórmulas e aba, recuperação
da validação e gráficos, reinício/cancelamento, erro de quota e armazenamento bloqueado.
As regressões anteriores usam um exemplo preenchido explicitamente em
`tests/fixtures/demo.ts`; não há caminho de demonstração automático na aplicação.

O armazenamento é limitado à origem e ao perfil do navegador; limpar os dados do
site apaga o progresso. Não há sincronização entre janelas/dispositivos nem resolução
de edições concorrentes; a última escrita vence. Rolagem e posição do cursor dentro
do editor não são persistidas; a seleção da célula e a aba são. Não há criptografia,
autenticação, backup ou proteção de notas contra inspeção local.

Para testar: `npm run dev`, abra `http://localhost:3000`, edite respostas amarelas,
espere **Salvo ✓** e recarregue. Verifique respostas e recarregue novamente para conferir
nota/cores. Abra **Reiniciar exercício**, teste Cancelar e depois confirme Reiniciar.
