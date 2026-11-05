# Jornada do curso — malha de autoria

A implementação anterior escolhia posições conforme a quantidade de capítulos,
limitava o mapa a seis e usava recortes diferentes da montanha. A implementação
atual usa uma malha estável sobre a imagem original de 1942 × 809. A imagem,
os marcadores e o SVG compartilham a mesma proporção, sem recorte.

## Coordenadas finais

Percentuais medidos da esquerda para a direita e do alto para baixo.
`order` corresponde ao número de P; TOP tem ordem 16.

| Ponto | x (%) | y (%) |
| --- | ---: | ---: |
| P1 | 16 | 89 |
| P2 | 24 | 84 |
| P3 | 30 | 88 |
| P4 | 36 | 77 |
| P5 | 40 | 67 |
| P6 | 46 | 73 |
| P7 | 51 | 70 |
| P8 | 56 | 60 |
| P9 | 60 | 65 |
| P10 | 65 | 55 |
| P11 | 70 | 48 |
| P12 | 66 | 42 |
| P13 | 69 | 33 |
| P14 | 72 | 25 |
| P15 | 71 | 17 |
| TOP | 72,4 | 9,5 |

As coordenadas ficam em `lib/courses/journey.ts`. TOP fica no pico da imagem,
separado da lista de pontos atribuíveis e sempre representa a conclusão.

## Distribuição e traçado

Para N entre 2 e 7, distribui-se entre P1 e P13; para N entre 8 e 15,
entre P1 e P15. Para índice i começando em zero, o número do ponto é
`1 + Math.round(i * E / (N - 1))`, com E igual a 12 ou 14, respectivamente.
Zero capítulos não produz associações; um capítulo usa P1. Mais de 15
capítulos gera aviso e usa uma lista de capítulos, sem sobrepor pontos.

| Capítulos | Distribuição |
| --- | --- |
| 2 | P1 → P13 |
| 3 | P1 → P7 → P13 |
| 4 | P1 → P5 → P9 → P13 |
| 5 | P1 → P4 → P7 → P10 → P13 |
| 6 | P1 → P3 → P6 → P8 → P11 → P13 |
| 8 | P1 → P3 → P5 → P7 → P9 → P11 → P13 → P15 |
| 10 | P1 → P3 → P4 → P6 → P7 → P9 → P10 → P12 → P13 → P15 |
| 12 | P1 → P2 → P4 → P5 → P6 → P7 → P9 → P10 → P11 → P12 → P14 → P15 |
| 15 | P1 até P15 |

Todas as jornadas terminam em TOP. O SVG usa segmentos Bézier cúbicos
com tangentes curtas, calculadas pelos vizinhos da malha (diferença dividida
por oito). Os pontos não associados funcionam como waypoints invisíveis,
incluindo a subida entre o último capítulo e TOP. Somente capítulos associados
recebem marcadores; os waypoints não geram elementos visuais ou controles
na interface do aluno. Não há execução de texto nem dependência gráfica nova.

## Autoria, aluno e versões

No editor de rascunho, **Configurar jornada** mostra P1–P15, TOP, ocupação e
as associações. O professor seleciona um capítulo e usa o mapa ou o select
**Ponto da jornada**. Os pontos são botões com nome acessível, foco e ativação
por teclado. O select desabilita escolhas inválidas; clicar em um ponto inválido
gera mensagem e preserva a configuração. TOP não é uma opção.

**Distribuir automaticamente** salva as posições equilibradas. Depois disso,
ajustes manuais preservam as demais posições. Adicionar capítulo deixa aviso
até que sua posição seja definida; o primeiro capítulo novo já usa P1.
Remover capítulo libera seu ponto; reordenar preserva as associações e avisa
quando a ordem se torna inconsistente. A publicação exige uma jornada válida.

Aluno e preview usam `CourseJourneyBoard`: número ou check, título do capítulo,
trilha e bandeira. Status permanece no nome acessível e nas cores, bordas e
cadeado. As regras existentes de disponibilidade continuam fornecendo os links.
Não há IDs de guia, pontos vazios ou controles de autoria nesse componente.
No preview, selecionar um marcador permanece no preview e usa as atividades
temporárias existentes, sem abrir a rota real do aluno. Os estados visuais usam
as conclusões temporárias já mantidas pelo preview.

O campo `chapter.trailPointId` pertence à versão física do curso. A cópia em
memória usa o clone profundo existente, inclusive quando IDs mudam. A migração
`202610270001_course_journey.sql` adiciona o campo no PostgreSQL, atualiza a
gravação e a leitura do agregado e copia a posição pela relação
`source_chapter_id` na criação de revisão. Constraints rejeitam pontos
inexistentes, TOP e duplicatas. Conteúdo publicado mantém sua proteção.

Cursos legados sem qualquer associação usam a distribuição determinística ao
renderizar. Ao adicionar, remover ou reordenar seus capítulos pelo editor, as
posições anteriores são materializadas antes da operação. Configurações
explícitas incompletas ou inválidas não são redistribuídas silenciosamente.

## Responsividade e limites

O mapa mantém sua proporção em todas as telas. Para preservar títulos e alvos
de interação, o aluno tem rolagem horizontal dentro do mapa quando necessário
(largura mínima de 1100 px; 1800 px acima de oito capítulos). Esses valores
definem o tamanho do mapa, não reposicionam seus pontos. No editor, a referência
visual tem largura mínima de 1000 px e o select permanece fora da rolagem,
disponível como mecanismo principal no mobile.

Não foi criada uma segunda malha para mobile. Acima de 15 capítulos há aviso
e fallback em lista; não há expansão automática da malha. Um rascunho com
posições inconsistentes mostra os capítulos em lista no preview até o ajuste.
Títulos ocupam até duas linhas; o nome completo permanece no nome acessível
do marcador e no atributo `title` do card. Na densidade máxima, os cards da
subida final ficam ao lado ou acima dos marcadores para evitar colisões.
A migração foi preparada e testada localmente; não foi aplicada a cursos
hospedados.

## Evidências

As capturas são geradas pelos testes em `test-results/`:

- `journey-teacher-1440.png` e `journey-teacher-390.png`: professor;
- `journey-preview-1440.png` e `journey-preview-390.png`: preview;
- `journey-student-1440.png`, `journey-student-1024.png` e
  `journey-student-390.png`: aluno;
- `journey-fifteen.png`: densidade máxima.

As capturas de autoria e preview mostram o ajuste manual do segundo capítulo
para P6, preservado após recarga. As capturas do aluno usam o curso demo com
distribuição P1 → P7 → P13.

Os testes de modelo cobrem a malha, TOP, distribuições, rejeição de atribuições
inválidas, ajuste, remoção, reorder, legado, novos capítulos e isolamento de
versões. Os testes de navegador cobrem professor, teclado, select, recarga,
preview, aluno, falha da imagem e alinhamento responsivo. A regressão PostgreSQL
executa a migração e verifica cópia de posições em novos IDs e imutabilidade.

## Verificações finais — 27/10/2026

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 531 aprovados, zero falhas, nenhum ignorado; 6,4 minutos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno local. |

São 23 casos a mais que a suíte anterior de 508. A execução final usou Node
portátil `.tools/node-v24.22.1-win-x64`, Chromium de
`.tools/playwright-browsers`, `PLAYWRIGHT_DISABLE_GPU=1` e o build na porta
3001. O harness existente usou a porta 3002. As variáveis de regressão dos
LABs 1 e 2 apontaram para os XLSX originais de Downloads; não houve testes
ignorados por ausência desses arquivos.

As rodadas diagnósticas localizaram colisões de títulos na densidade máxima
e um seletor antigo que ainda procurava o texto secundário “CAPÍTULO 2”.
Os cards foram ajustados sem mover os pontos; o seletor passou a usar
“02 Correção de Erro”. Quatro outros casos passaram na repetição isolada.
A rodada completa final, após esses ajustes, terminou sem falhas.

Logs: `.tools/journey-suite-complete.log` e `.tools/journey-build-final.log`.
`test-results/.last-run.json` registra `passed`. Foram inspecionadas as
capturas de professor, aluno, preview, mobile e densidade máxima.

Não foram modificados o motor de fórmulas, gráficos, Labs, exercícios,
CourseAccess, player, cálculo de progresso ou mecanismo de autosave.
O preview reutiliza o progresso temporário que já existia, sem gravação
de progresso real. Não houve alteração de cursos hospedados ou perfil pessoal.
