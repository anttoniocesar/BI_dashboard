# Pássaros ocasionais na jornada

`components/learn/JourneyBirdLayer.tsx` acrescenta pequenos grupos de pássaros
ao `CourseJourneyBoard`, compartilhado entre Learn e preview do professor.
O editor **Configurar jornada** não renderiza essa camada. Nuvens, imagem da
montanha, trilha SVG, P1–P15, TOP e suas configurações permanecem inalterados.

## SVG e formação

O asset local `public/images/learn/birds/silhouette.svg` tem 333 bytes e
contém três partes vetoriais: asa esquerda, asa direita e corpo. Cada pássaro
reutiliza essas partes com `<use>`, sem biblioteca ou imagens externas.
São silhuetas azul-escuras, com opacidades individuais entre 0,58 e 0,76.

A configuração `JOURNEY_BIRD_FLIGHTS` centraliza trajetórias, duração, início
e formação. Os pássaros diferem em posição, escala, opacidade, período e fase
do movimento das asas. A formação é irregular, sem uma linha reta ou V
perfeitamente simétrico. As asas alternam discretamente rotação de até 12° e
escala vertical até 0,68, enquanto o corpo mantém sua forma.

## Cronograma e trajetórias

O ciclo de desktop/tablet tem 160 segundos. Os primeiros 12 segundos são uma
pausa; não há pássaros permanentemente visíveis.

| Grupo | Pássaros desktop | Início | Passagem | Fim | Pausa até o próximo grupo |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 5 | 12 s | 24 s | 36 s | 46 s |
| B | 4 | 82 s | 22 s | 104 s | 68 s |

O próximo A começa em 172 s, já no segundo ciclo. As janelas não se sobrepõem.
Cada passagem usa fade de entrada e saída em 5% de sua duração. Fora das
janelas, o grupo fica com `visibility: hidden` e opacidade zero.

As trajetórias percorrem uma região de céu com 58% da largura e 42% da altura
do mapa, posicionada no canto superior esquerdo. O recorte termina bem antes
da bandeira e do pico e acima dos capítulos situados na parte esquerda.

As coordenadas de movimento abaixo são percentuais dessa região, e não
posições dos capítulos:

| Grupo | Entrada (x, y) | Saída (x, y) | Movimento |
| --- | --- | --- | --- |
| A | (−22%, 36%) | (105%, 50%) | Esquerda → direita, descida suave |
| B | (−22%, 74%) | (105%, 30%) | Esquerda → direita, subida suave |

Os grupos entram e saem fora do recorte. Os pássaros não sobrevoam TOP,
“Conclusão do curso” ou seus arredores. A camada é recortada com
`overflow: hidden` e `contain: paint`; seu tamanho não altera o mapa.

## Camadas e execução

A ordem de pintura é: imagem → nuvens → pássaros → trilha → capítulos → TOP.
Nuvens e pássaros usam z-index 0; os pássaros aparecem depois das nuvens no
DOM. A trilha continua em 1, os capítulos em 2 e TOP em 3. Não foi necessário
alterar o CSS ou a configuração das nuvens.

`journey-birds.css` controla o voo com `transform: translate3d(...)` e
`opacity`. Os keyframes de cada grupo são derivados do cronograma central
durante a renderização do componente. Não há timers, estado React, listeners,
sorteios ou cálculos por frame em JavaScript. As asas também usam transform.

A camada e seus descendentes têm `pointer-events: none`. A decoração inteira
tem `aria-hidden="true"`; os SVGs têm `focusable="false"`. Não há controles,
links ou elementos com tabindex na camada. Se o SVG falhar, as referências
vetoriais ficam vazias; não há ícone de imagem quebrada ou erro de JavaScript,
e os demais elementos da jornada continuam funcionando.

## Desktop, tablet, mobile e movimento reduzido

| Tela | Grupos possíveis | Pássaros por grupo | Tamanho base | Ciclo |
| --- | --- | --- | --- | --- |
| Acima de 1100 px | A e B alternados | 5 / 4 | 18 px | 160 s, duas passagens |
| 761–1100 px | A e B alternados | 4 / 4 | 16 px | 160 s, duas passagens |
| Até 760 px | Somente A | 3 | 14 px | 94 s, uma passagem |

As escalas individuais reduzem discretamente esses tamanhos. No mobile, o
voo continua com 24 s, seguido por 70 s de pausa, com frequência menor que
as duas passagens do desktop. As nuvens mantêm integralmente sua configuração
anterior, inclusive o tratamento mobile.

Com `prefers-reduced-motion: reduce`, a camada de pássaros fica oculta e as
animações de voo e asas são desativadas. As nuvens seguem sua própria regra
existente, permanecendo estáticas e discretas. O conteúdo funcional continua
visível e navegável.

## Validação e capturas

`tests/journey-birds.spec.tsx` acrescenta dez casos aos 541 anteriores.
Os testes verificam asset local, formação, duas trajetórias, asas, tamanho,
contagem responsiva, preview, autoria sem camada, ARIA, interação, TOP,
reduced-motion, fallback do SVG, nuvens independentes e ausência de overflow.

O teste do cronograma percorre dois ciclos completos no navegador, em passos
de meio segundo, verificando que nunca há dois grupos ativos. Também confirma
os intervalos sem pássaros e as pausas de 46, 68 e 70 segundos. Para as capturas,
somente os testes avançam e pausam as animações pela API do navegador.

Capturas em `test-results/`:

- `journey-birds-student-1440.png`: grupo A;
- `journey-birds-student-1440-flight-b.png`: grupo B;
- `journey-birds-student-1024.png`: tablet, grupo A;
- `journey-birds-student-1024-flight-b.png`: tablet, grupo B;
- `journey-birds-student-390.png`: mobile com três pássaros;
- `journey-birds-preview.png`: preview do professor.

A inspeção complementar usa `.tools/capture-bird-moments.cjs` para capturar
o mesmo grupo A em 18 e 30 segundos e a pausa em 60 segundos:
`journey-birds-flight-a-18s.png`, `journey-birds-flight-a-30s.png` e
`journey-birds-pause-60s.png`. Esses controles de tempo existem somente nas
ferramentas de validação, sem controles ou timers no produto.

Os quadros dos grupos A e B correspondem a 24 e 93 segundos desde a montagem
da jornada. Foram inspecionadas as silhuetas, a escala, a separação do TOP e
a legibilidade da trilha e dos títulos.

Verificações finais em 27/10/2026:

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 551 aprovados, zero falhas, nenhum ignorado; 6,4 minutos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno local. |

São dez casos a mais que os 541 anteriores. A suíte usou Node portátil
`.tools/node-v24.22.1-win-x64`, Chromium de `.tools/playwright-browsers`,
`PLAYWRIGHT_DISABLE_GPU=1` e o build na porta 3001. O harness existente usou
a porta 3002. As variáveis de regressão dos LABs 1 e 2 apontaram para os
XLSX originais de Downloads. As regressões de nuvens, jornada, progresso,
navegação, fórmulas e gráficos passaram integralmente.

As capturas de desktop, tablet, mobile e preview foram inspecionadas,
incluindo os dois momentos do grupo A e a pausa sem pássaros. O registro
`test-results/.last-run.json` contém `passed`, sem testes falhos.
Logs: `.tools/birds-build.log` e `.tools/birds-suite-final.log`.

## Limites

O cronograma é global e determinístico, sem preferência por curso ou
persistência de fase. Ao remontar a jornada, ele reinicia com a pausa de 12 s.
Os pássaros ficam restritos ao céu esquerdo/central, e o mapa mantém sua
rolagem horizontal anterior em telas estreitas. Não há parallax por mouse ou
alteração do versionamento.

Não foram modificados CourseAccess, StudentProgress, Labs, exercícios,
fórmulas, gráficos, autosave, player, importador XLSX, distribuição da jornada
ou nuvens atuais. Não houve alteração de cursos hospedados ou perfil pessoal.
