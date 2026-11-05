# Sidebar retrátil no ambiente do aluno

Escopo de apresentação em `/learn/[courseId]` e
`/learn/[courseId]/chapter/[chapterId]`. Não há mudanças no curso, progresso,
acesso, atividades, conteúdos ou motor do Lab. Nenhuma dependência adicionada.

## Larguras e comportamento

| Tela | Aberta | Retraída |
| --- | --- | --- |
| Visão geral, desktop | 280 px | 72 px |
| Visão geral, notebook | 260 px | 72 px |
| Capítulo, desktop | 260 px | 72 px |
| Capítulo, notebook até 1100 px | 240 px | 72 px |

A primeira abertura começa expandida, inclusive em 1024×768. Um botão nativo junto
à borda direita, próximo ao topo, permite recolher/expandir. Permanece fora da área
interna de rolagem, evitando corte do botão na divisa com o conteúdo.

Aberta, a navegação mantém capítulos, descrições, atividades e estados anteriores.
Retraída, mostra somente checkpoints, estado visual e cadeados nos bloqueados.
Títulos, descrições, listas de atividades e avisos textuais extensos são ocultados
com `display:none`; não são comprimidos nem continuam na sequência de Tab.

O capítulo atual recebe destaque laranja/borda; concluídos mantêm o check verde.
Um capítulo concluído revisitado conserva seu check e o realce da página atual.
Bloqueados continuam sem links. O nome acessível de cada checkpoint retraído
inclui número, título e estado. Ao passar o mouse ou focar, um balão apresenta o
mesmo texto; Esc o dispensa. O balão não duplica o anúncio do nome acessível.

Os dois grids existentes mudam a primeira coluna para 72 px; o conteúdo ocupa o
espaço liberado. A grade e os gráficos do Lab se ajustam ao novo tamanho pelos
comportamentos existentes. Nada é desmontado para recolher/expandir.

O shell permanece sticky sob o header (80 px na visão geral; 94 px no capítulo),
com rolagem interna da navegação longa. Como antes, sticky respeita os limites do
bloco de conteúdo e libera espaço para o rodapé ao atingir seu fim. A transição
de colunas dura 180 ms e é desativada por `prefers-reduced-motion: reduce`.

## Estado compartilhado

`LearnLayoutState` é um provider cliente no layout de `/learn`. Mantém somente
um booleano de apresentação e sua ação de alternância. Não depende de curso,
usuário, atividade ou exercício. O mesmo estado acompanha a navegação cliente
entre visão geral, atividades e capítulos dentro desse layout.

Refresh recria o provider e volta à navegação aberta. Não usa localStorage,
sessionStorage, cookies ou backend. O estado não constitui progresso pedagógico.
Os limites de recuperação de progresso/respostas continuam sendo os anteriores.

`LearnSidebarShell` compartilha botão, região de navegação e limites sticky.
`LearnSidebarChapter` mantém links nativos para os destinos já permitidos,
além do nome compacto e balão. Os dois componentes de sidebar existentes continuam
produzindo seus capítulos/atividades a partir dos mesmos estados derivados.

## Teclado e acessibilidade

- Botão: “Recolher trilha do curso” / “Expandir trilha do curso”, `aria-expanded`
  e `aria-controls` apontando para a navegação correspondente.
- Enter e Space alternam a apresentação; o mesmo botão mantém o foco.
- Tab segue para os checkpoints e demais controles, sem ciclo de foco.
- Links atuais preservam `aria-current`. Bloqueados não ganham navegação; em modo
  compacto são grupos informativos focáveis para consultar título/estado.
- Foco branco de 2 px na navegação azul-marinho; tooltips brancos com texto
  azul-marinho e largura limitada à viewport.
- Os textos continuam disponíveis no nome acessível dos checkpoints quando os
  títulos visuais estão ocultos. Cores complementam checks, cadeados e estados.

## Arquivos

Criados:

- `components/learn/LearnLayoutState.tsx`.
- `components/learn/LearnSidebarShell.tsx`.
- `app/learn/sidebar.css`.
- `tests/student-sidebar.spec.ts`.
- Este documento.

Modificados: `app/learn/layout.tsx`, `CourseOverviewSidebar.tsx` e
`ChapterSidebar.tsx`, somente para composição e apresentação. `ChapterPlayer`,
`ExerciseLab`, `ExerciseDefinition`, `CourseDraft`, `StudentCourseProgress`,
`CourseAccessPolicy`, regras de acesso, validação e autosave não foram modificados.

## Testes

Seis novos casos cobrem:

1. Visão geral e capítulo em 1440×1000: larguras, espaço liberado, foco, estados,
   expansão, sticky e ausência de transbordamento.
2. O mesmo fluxo em 1366×768.
3. O mesmo fluxo em 1024×768.
4. Tab/Enter/Space, foco mantido, tooltip/Esc, bloqueado sem navegação, estado
   compartilhado entre páginas e atividades, check e progresso após conclusão.
5. Lab real: mesma instância DOM da grade, fórmula, seleção, aba e avaliação
   preservadas; viewport e gráfico ampliam; toolbar continua funcionando.
6. Movimento reduzido, storages inalterados e refresh retornando ao estado aberto.

Os testes novos inicialmente precisaram de duas correções: conferir sticky antes
do limite do seu bloco de conteúdo e selecionar o SVG principal do gráfico em vez
de incluir os ícones de legenda. Não houve mudança nos testes anteriores.

Nas rodadas focadas, um caso anterior de curso importado não atingiu 25% após
verificar respostas (permaneceu em 0%). Uma reprodução isolada das mesmas ações
passou, sem modificar o caso, timeout ou asserções. Não se atribui causa definitiva
à ocorrência; o resultado da suíte completa é registrado separadamente abaixo.

## Limitações

A preferência dura apenas enquanto o layout React permanece montado. Não há
sincronização entre janelas nem recuperação após refresh. Smartphone conserva
um fallback de layout simples, sem otimização específica nesta entrega.
Não há certificação com leitores de tela reais ou todos os navegadores.
O nome do capítulo aparece no balão e na acessibilidade; no modo compacto,
atividades são acessadas pelo conteúdo principal ou reabrindo a sidebar.

## Resultado final

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **199 aprovados, 0 falhos**; 193 anteriores + 6 novos, aproximadamente 3,1 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas e API. |
| 1440×1000 | Abrir/retrair, checkpoints, foco e expansão do conteúdo aprovados; capturas inspecionadas. |
| 1366×768 | Larguras e controles legíveis, sidebar sticky e sem transbordamento horizontal. |
| 1024×768 | Sidebar com 72 px, conteúdo/grade/gráfico mais largos, fórmula e avaliação preservadas. |
| Estado compartilhado | Recolhimento acompanha atividade, próximo capítulo e retorno à visão geral. |
| Movimento reduzido/storage | Transição desativada; nenhum storage alterado; refresh volta à sidebar aberta. |

A primeira suíte completa teve 198 aprovações e um timeout de 30 segundos num
caso anterior em 1366 px, aguardando a aba Treinamento após abrir o bloco de Lab.
Na execução final completa, esse mesmo caso passou em aproximadamente 3,5 segundos;
o caso de curso importado também passou. Não foram alterados aplicação, testes,
timeouts ou asserções entre essas duas execuções completas. As ocorrências ficam
registradas sem atribuição definitiva de causa.

Ambiente: Chrome com renderização por software; produção temporária na porta 3001
e harness existente na 3002. Servidores temporários encerrados ao terminar; o
servidor e a sessão do usuário em 3000 foram preservados. Nenhum teste anterior
foi removido ou afrouxado.

Capturas: `test-results/sidebar-overview-{1440,1366,1024}.png`,
`test-results/sidebar-chapter-{1440,1366,1024}.png` e
`test-results/sidebar-lab-1024.png`. A conferência visual incluiu os três tamanhos
de tela e o capítulo de Lab.

Para testar manualmente:

1. Execute `npm.cmd run dev` e abra `http://localhost:3000/learn/neural-demo`.
2. Use o botão ‹ junto à borda da sidebar. Confira os checkpoints e o espaço
   ampliado; use › para expandir novamente.
3. Repita com Tab, Enter e Space. Foque um checkpoint para consultar seu título;
   use Esc para dispensar o balão. Um bloqueado não deve navegar.
4. Recolha e entre no primeiro capítulo. Navegue entre atividades e capítulos:
   a preferência deve continuar. No Lab, edite uma fórmula e alterne a sidebar;
   conteúdo, seleção e avaliação devem permanecer.
5. Atualizar a página recria o estado React e inicia a sidebar aberta, conforme
   o comportamento de sessão desta etapa.

O ajuste termina aqui, sem iniciar outra etapa funcional.
