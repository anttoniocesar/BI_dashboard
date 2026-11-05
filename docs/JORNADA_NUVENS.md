# Nuvens ambientais na jornada

`JourneyCloudLayer` acrescenta três nuvens translúcidas ao `CourseJourneyBoard`,
compartilhado entre Learn e preview do professor. A imagem da montanha,
proporção, posições P1–P15, TOP, `trailPointId` e SVG da trilha permanecem
intactos. O editor da malha não renderiza a camada de nuvens.

## Assets e configuração

Foram gerados três PNGs transparentes com a ferramenta integrada **imagegen**,
sem uso de CLI/API própria. Os originais estão em `image/journey-clouds/`.
A codificação WebP preserva o canal alfa e reduz o total servido a 736.356 bytes
(aproximadamente 736 KB). Não há URLs externas ou nova dependência de runtime.

| Asset servido em `public/images/learn/clouds/` | Bytes | Duração | Atraso | Opacidade | Top | Largura | Escala |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cloud-01.webp | 252.498 | 84 s | −30 s | 0,28 | 8% | 44% | 0,95 |
| cloud-02.webp | 244.148 | 64 s | −38 s | 0,35 | 25% | 40% | 0,95 |
| cloud-03.webp | 239.710 | 46 s | 0 s | 0,40 | 38% | 34% | 0,9 |

Os PNGs originais e os WebPs têm 2172 × 724 pixels e canal alfa. As configurações
individuais ficam em `JOURNEY_CLOUDS`, no componente
`components/learn/JourneyCloudLayer.tsx`. A máscara de proteção fica em
`JOURNEY_CLOUD_EXCLUSION`, com centro derivado do TOP existente, deslocado
3 pontos percentuais à direita para acomodar seu título. Os raios são 12%
na horizontal e 20% na vertical. A posição do TOP permanece inalterada.

## Correção de visibilidade — homologação manual

O diagnóstico confirmou HTTP 200 para os três WebPs e z-index 0 sobre o
background da montanha, dentro do stacking context isolado já existente.
Não havia 404 ou imagem base cobrindo a camada.

A baixa percepção resultava da combinação de opacidades baixas, escalas
reduzidas, `background-size: contain` limitado pela altura de 24% do mapa e
deslocamento da única nuvem mobile para fora do trecho visível do mapa rolável.
A primeira nuvem ocupava aproximadamente 23% da largura com seu conteúdo visual,
apesar de seu canvas já preencher quase toda a largura do arquivo.

A análise dos pixels com alfa maior que 25/255 encontrou conteúdo em 93,7%,
93,3% e 92,6% das larguras dos assets. Portanto, não foi necessário recortar
ou substituir os arquivos. A faixa de renderização passou de 24% para 40%
da altura do mapa para que `contain` comporte as larguras ampliadas. O conteúdo
visual aparente no desktop passou para aproximadamente 39%, 35% e 28% do mapa.

As opacidades foram elevadas de 0,15/0,22/0,28 para 0,28/0,35/0,40. No primeiro
quadro, os delays −30 s e −38 s colocam as duas primeiras nuvens à esquerda/centro
e na região central; a terceira começa fora da área e entra depois. As durações
84/64/46 s e a arquitetura foram preservadas.

A máscara foi reduzida de 14% × 24% para 12% × 20%, aproximadamente 29% menos
área, com centro ajustado em direção ao título. Os quatro cantos da bandeira
e do texto continuam dentro da região inteiramente transparente da elipse.
Não foi necessário alterar z-index ou adicionar outro stacking context.
Não há outline, background de teste ou opacidade de debug no código final.

## Camadas, animação e interação

A ordem de pintura é: imagem base → nuvens (z-index 0) → trilha (1) →
capítulos (2) → TOP (3). Assim as nuvens permanecem atrás dos conteúdos.
Além dessa ordem, uma máscara radial mantém a região da bandeira e de seu
título inteiramente transparente. A área interna até 90% da elipse é
transparente; os 10% finais produzem transição suave.

As nuvens não participam do layout: a camada é absoluta, ocupa a imagem e
recorta os elementos em movimento. `pointer-events: none` vale para a camada
e seus descendentes; `aria-hidden` exclui toda a decoração da árvore acessível.
Não há listeners, timers JavaScript, elementos focáveis ou mudanças de estado.

O CSS `journey-clouds.css` anima somente `transform: translate3d(...)` e
`opacity`, da esquerda para a direita. No desktop e tablet, cada faixa se
desloca de −50% a 110% da largura do mapa. O fade de entrada/saída e os
atrasos negativos evitam reinício brusco. As escalas são
estáticas; pequenas diferenças verticais também usam transform. Não há
biblioteca de animação ou parallax por mouse.

## Responsividade, acessibilidade e fallback

- Acima de 1100 px: três nuvens.
- De 761 a 1100 px: duas nuvens.
- Até 760 px: uma nuvem, com escala adicional de 0,72.
- Com `prefers-reduced-motion: reduce`: nenhuma animação; nuvens estáticas
  em posições fixas, com 65% de suas opacidades normais.

No mobile, o deslocamento da primeira faixa fica entre −30% e 18% da largura
do mapa, para conservar a nuvem no trecho esquerdo visível em vez de fazê-la
percorrer principalmente a área fora da viewport. As capturas de 0, 20 e 40 s
confirmam sua presença. As opacidades com reduced-motion são 0,182, 0,2275 e 0,26.

A proporção e a rolagem horizontal interna do mapa existente são preservadas.
A camada não amplia a área rolável nem gera overflow da página. No mobile,
a captura adicional do TOP demonstra a bandeira após rolar o mapa para o topo.

Uma falha no carregamento do WebP deixa apenas o background decorativo vazio,
sem ícone de imagem quebrada ou erro de JavaScript. Montanha, trilha, capítulos
e navegação continuam funcionando. Jornadas vazias ou em fallback de lista não
recebem a camada ambiental.

O editor continua com seus botões P1–P15, select e associações, sem nuvens.
O preview usa a mesma configuração visual do Learn e continua com seu estado
temporário existente. Não há configuração persistida nova ou migração de banco.

## Evidências e verificações

`tests/journey-clouds.spec.tsx` contém dez casos, cobrindo os onze cenários
do pedido: aluno, preview, autoria, interação, TOP, reduced-motion, mobile,
asset ausente, estados/navegação e velocidades distintas. A transparência é
verificada no navegador; a exclusão do TOP é validada com a geometria real da
bandeira e da máscara, incluindo todos os cantos do título.

Os dois casos adicionais verificam desktop e mobile em 0, 20 e 40 segundos.
A animação é pausada nesses tempos pela API do navegador somente nos testes,
sem esperar 40 segundos ou introduzir controles no produto. Cada quadro é
comparado com a mesma paisagem com a camada oculta: mais de 500 pixels da
viewport devem variar mais de oito níveis RGB. Isso confirma pintura visível,
além de apenas existência de elementos no DOM. Os testes também verificam
HTTP 200 e MIME WebP para todos os assets, ordem de pintura, tamanho efetivo,
opacidade reduzida e ausência de overflow.

Capturas em `test-results/`:

- `journey-clouds-student-1440.png`;
- `journey-clouds-student-1024.png`;
- `journey-clouds-student-390.png`;
- `journey-clouds-student-390-top.png`;
- `journey-clouds-preview.png`.
- `journey-clouds-before-0s.png`, `journey-clouds-before-20s.png`,
  `journey-clouds-before-40s.png`: diagnóstico antes da correção;
- `journey-clouds-visible-0s.png`, `journey-clouds-visible-20s.png`,
  `journey-clouds-visible-40s.png`: depois, desktop;
- `journey-clouds-visible-mobile-0s.png`, `journey-clouds-visible-mobile-20s.png`,
  `journey-clouds-visible-mobile-40s.png`: depois, mobile.

As capturas congelam a animação em um quadro para permitir inspeção. O teste
de movimento verifica separadamente que o transform varia com o tempo.

Verificação anterior, antes do ajuste de visibilidade: 539 testes aprovados.
A rodada completa após o ajuste passou, assim como typecheck e build.

Verificações finais em 27/10/2026, após o ajuste de visibilidade:

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` | 541 aprovados, zero falhas, nenhum ignorado; 5,9 minutos. Inclui Supabase controlado. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração demo de preview interno local. |

São dois casos a mais que os 539 anteriores. A suíte usou Node portátil
`.tools/node-v24.22.1-win-x64`, Chromium de `.tools/playwright-browsers`,
`PLAYWRIGHT_DISABLE_GPU=1` e o build local na porta 3001. O harness existente
usou a porta 3002. As variáveis de regressão dos LABs 1 e 2 apontaram para os
XLSX originais de Downloads. A regressão existente confirma o hash intacto da
imagem da montanha; as regressões de jornada e progresso também passaram.

As capturas antes/depois em 0, 20 e 40 segundos foram inspecionadas.
`test-results/.last-run.json` registra `passed`, sem testes falhos.
Logs atuais: `.tools/clouds-visible-build.log` e `.tools/clouds-visible-suite.log`.
O diagnóstico de carregamento, stacking e área útil dos assets está em
`.tools/cloud-visibility-before.json`.

## Limites

O efeito é apenas ambiental e local ao componente. Não há controle novo de
velocidade ou nuvens por curso, nem alteração do versionamento. A preferência
do sistema controla a redução de movimento. Em telas pequenas, o mapa mantém
a navegação horizontal anterior; TOP fica disponível ao rolar para sua região.
Não foram alterados CourseAccess, StudentProgress, Labs, exercícios, fórmulas,
gráficos, autosave, player ou importador XLSX. Não houve alteração de cursos
hospedados ou perfil pessoal.

## Prompts usados na geração

Ferramenta integrada `image_gen.imagegen`, com `transparent_background: true`,
uma chamada por variação. Prompt comum abaixo, substituindo ID e VARIANTE
pelos valores da tabela seguinte:

```text
Use case: photorealistic-natural. Asset type: local transparent PNG atmospheric overlay for a mountain course journey UI, variant ID. Primary request: one isolated VARIANTE. Realistic pale neutral white with a very faint warm ivory tint, low contrast, softly scattered light, translucent wispy body and soft fading edges. Horizontal composition centered with generous fully transparent margins, no cropped edges. Actual transparent alpha background; no sky, mountain, scene, ground, text, checkerboard drawn into pixels, shadow, outline, cartoon style, or opaque rectangle. This single cloud will be displayed at 15–28 percent opacity over a mountain photograph; keep realistic fine vapor texture.
```

| ID | VARIANTE |
| --- | --- |
| cloud-01 | a long thin horizontal high-altitude cirrus wisp, gently feathered and broken |
| cloud-02 | a small loose soft stratocumulus cloud bank, flattened and airy with wispy edges |
| cloud-03 | a delicate elongated asymmetric veil of mountain mist, tapering into fine wisps |
