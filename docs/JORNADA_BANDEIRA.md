# Bandeira do TOP com vento suave

`components/learn/JourneySummitFlag.tsx` substitui somente o desenho estático
da bandeira dentro do `CourseJourneyBoard`. Learn e preview do professor usam
o mesmo componente. O contêiner TOP, suas coordenadas, tamanho, z-index e label
**Conclusão do curso** permanecem exatamente como antes.

## SVG e fixação

O SVG é inline, sem asset externo ou request adicional, com os mesmos
`width="22"`, `height="28"` e `viewBox="0 0 24 28"` do desenho anterior.

- Tecido: path `M5 3h16l-4 6 4 6H5Z`, dentro de `g.summit-flag-cloth`.
- Mastro: path independente `M5 2v24`, classe `summit-flag-mast`.
- Cores preservadas: tecido `#ee7e32`, contorno `#a64b16`, mastro `#142d4e`.

O mastro é desenhado por último, sem animação, para manter a junção limpa.
O tecido usa `transform-box: view-box` e origem em `(5, 9)`, junto ao mastro.
As transformações são exclusivamente `skewY` e `scaleX`: qualquer ponto da
borda de fixação `x=5` permanece imóvel, não somente o centro da borda.
Não se aplica rotação ou escala ao SVG, ao mastro, ao contêiner TOP ou ao label.

## Ciclo e intensidade

`journey-summit-flag.css` define o ciclo contínuo de **3,2 segundos**, com
`ease-in-out` e keyframes assimétricos:

| Quadro | skewY | scaleX |
| --- | ---: | ---: |
| 0% / 100% | 0,2° | 1 |
| 19% | −2° | 0,975 |
| 47% | 2,6° | 1,025 |
| 73% | −0,8° | 0,99 |
| 88% | 1,2° | 1,012 |

Essa combinação altera discretamente o tecido e sua ponta livre, com
intervalos diferentes entre as pequenas rajadas. O primeiro e o último
quadro coincidem, evitando salto no loop. Não foi adicionada segunda camada
de tecido ou sombra, pois o tamanho atual de 22 × 28 px pede um desenho simples.

Não há timers, estado React, listeners, requestAnimationFrame ou biblioteca
de animação no componente. Apenas o transform do grupo do tecido é animado.

## Acessibilidade, fallback e responsividade

Com `prefers-reduced-motion: reduce`, a animação é desativada e o transform
volta a `none`. A bandeira completa permanece visível e estática.

O SVG é decorativo, com `aria-hidden="true"`, `focusable="false"` e
`pointer-events: none`. Não há clique, hover funcional, tabindex ou controles.
A informação acessível continua no TOP e no label existentes.

O SVG contém os paths estáticos originais, independentemente do CSS. Se o
stylesheet ou os keyframes da animação estiverem indisponíveis, o desenho
permanece estático. A implementação inline elimina a dependência de um asset
SVG externo que pudesse retornar 404.

Desktop, tablet e mobile mantêm os mesmos 22 × 28 px, proporção e coordenadas.
Em telas estreitas, o mapa preserva a rolagem horizontal anterior; as capturas
da bandeira rolam até o TOP para mostrar a conquista final.

O editor **Configurar jornada** mantém seu marcador estático `⚑ TOP`, sem
montar o componente animado. As camadas de nuvens e pássaros continuam
independentes, com seus arquivos, configurações e cronogramas inalterados.

## Validação

`tests/journey-flag.spec.tsx` acrescenta oito casos aos 551 anteriores,
cobrindo os treze cenários solicitados. As verificações incluem:

- Learn em 1440, 1024 e 390 px, com tamanho, TOP, label e trilha preservados;
- tecido animado e mastro sem animação;
- coordenadas em tela dos dois extremos do mastro e de três pontos da
  fixação do tecido, comparadas em dois quadros diferentes;
- posições do TOP e do label idênticas entre esses quadros;
- deslocamento real da ponta livre, mostrando a deformação do tecido;
- reduced-motion com bandeira estática e visível;
- keyframes indisponíveis com fallback estático;
- editor estável e preview animado;
- estados, links e progresso preservados;
- nuvens em movimento e pássaros com seu cronograma original.

Os testes congelam os quadros somente pela API de animações do navegador.
Nenhum controle de tempo foi introduzido no produto.

## Capturas

Arquivos em `test-results/`:

- `journey-flag-student-1440.png`;
- `journey-flag-student-1024.png`;
- `journey-flag-student-390.png`;
- `journey-flag-preview.png`;
- `journey-flag-wave-a.png`: 608 ms, keyframe de 19%;
- `journey-flag-wave-b.png`: 1504 ms, keyframe de 47%.

Os dois recortes da bandeira usam densidade de pixels 3× para facilitar a
comparação visual do tecido pequeno; o tamanho CSS continua 22 × 28 px.
As capturas foram inspecionadas para conferir fixação, intensidade e
legibilidade, sem conflito com nuvens ou pássaros.

Verificações finais em 27/10/2026:

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 559 aprovados, zero falhas, nenhum ignorado; 6,6 minutos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno local. |

São oito casos a mais que os 551 anteriores. A suíte usou Node portátil
`.tools/node-v24.22.1-win-x64`, Chromium de `.tools/playwright-browsers`,
`PLAYWRIGHT_DISABLE_GPU=1` e o build na porta 3001. O harness existente usou
a porta 3002. As variáveis de regressão dos LABs 1 e 2 apontaram para os
XLSX originais de Downloads. As regressões de nuvens, pássaros, jornada,
progresso, navegação, fórmulas e gráficos passaram integralmente.

As quatro capturas de contexto e os dois quadros da bandeira foram
inspecionados. `test-results/.last-run.json` registra `passed`, sem testes
falhos. Logs: `.tools/flag-build.log` e `.tools/flag-suite-final.log`.

## Limites

O vento é uma deformação discreta do tecido em SVG, sem simulação física ou
morphing de path. A intensidade é global e fixa; não há ajuste por curso.
O efeito acompanha a preferência de movimento do sistema.

Não foram alterados P1–P15, TOP, distribuição, `JOURNEY_CLOUD_EXCLUSION`,
CourseAccess, StudentProgress, Labs, exercícios, fórmulas, gráficos, player,
autosave, importador XLSX, nuvens, pássaros ou versionamento. Não houve
alteração de cursos hospedados ou perfil pessoal.
