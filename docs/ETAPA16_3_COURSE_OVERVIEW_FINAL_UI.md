# Etapa 16.3 — Ajuste fino da Visão Geral do Curso

Escopo exclusivamente visual de `/learn/[courseId]`: header compacto, sidebar,
quatro cards de resumo, jornada central e abertura do treinamento. Não foram
alterados progresso, bloqueio, modelos, ExerciseLab, autosave ou persistência.
Nenhuma dependência foi instalada.

## Base e referência

Foram lidos integralmente os documentos existentes POC01_SPEC, Etapa 15, Etapa
16 e Etapa 16.1. O arquivo solicitado
`docs/ETAPA16_2_COURSE_OVERVIEW_REFINEMENT.md` não existe neste checkout; a busca
também não encontrou componentes/documentação dessa etapa. A divergência foi
informada antes das alterações. A entrega aplica somente o pedido da Etapa 16.3
à base presente, sem inventar um histórico de execução da Etapa 16.2.

A referência utilizada foi a composição oficial descrita no pedido: logo e curso
no topo, aluno à direita, sidebar TRILHA DO CURSO, título de visão geral, quatro
cards, montanha com checkpoints e vídeo abaixo. Não havia imagem adicional no
anexo para uma comparação pixel a pixel. Foi mantido o wordmark/símbolo existente.

## Estrutura final

```text
StudentHeader (80 px na visão geral)
  logo | Curso: título | progresso | aluno / matrícula demonstrativa
CourseOverview
  CourseOverviewSidebar | conteúdo
                       | Visão Geral do Treinamento + um CTA
                       | CourseSummaryCards (quatro cards)
                       | CourseJourneyBoard (cenário local e capítulos)
                       | CourseIntroVideo
```

O título principal passou a **Visão Geral do Treinamento**. O nome completo do
curso permanece no cabeçalho, com prefixo Curso: e divisor vertical. A descrição
real do curso apresenta a jornada. Há somente um CTA principal: Começar curso,
Continuar estudos ou Revisitar curso, segundo o mesmo destino derivado da Etapa
16. Links dos checkpoints e da sidebar são navegação contextual, sem CTAs
concorrentes nos cards de resumo.

`StudentHeader` aplica a altura/prefixo novos apenas na visão geral. O capítulo
mantém seu header anterior de 94 px. Perfil, avatar e matrícula continuam
demonstrativos, sem menu de expansão fictício ou nova identidade autenticada.

## Sidebar

`CourseOverviewSidebar` ocupa 280 px em desktop e 260 px nas larguras menores.
É sticky sob o header e ocupa toda a altura útil da viewport. Rolagem interna
acontece quando a lista completa excede essa altura, mantendo o documento como
rolagem principal do conteúdo.

Capítulos vêm de CourseDraft, ordenados pela função existente `inOrder`, e estados
vêm de `courseProgress`. Cada capítulo mostra número/checkpoint, título,
descrição curta. A linha vertical conecta visualmente os capítulos. Na entrega
inicial também eram listadas as atividades; elas deixaram de ser renderizadas
nesta sidebar no ajuste “Simplificação da sidebar da visão geral”, abaixo.

- Concluído: checkpoint verde com check e texto de conclusão.
- Atual: checkpoint laranja com borda clara e capítulo destacado.
- Bloqueado: checkpoint cinza, rótulo explícito e nenhum link ativo.

Capítulos disponíveis e concluídos usam links nativos para as mesmas rotas da
Etapa 16. O bloqueio de acesso por URL continua sendo responsabilidade do modelo
existente e do ChapterPlayer, que não foram alterados.

## Quatro cards de resumo

`CourseSummaryCards` usa quatro artigos de mesma altura e bordas discretas:

| Card | Fonte do valor |
| --- | --- |
| Capítulos | Total e quantidade concluída nos capítulos derivados. |
| Progresso geral | Percentual e contagem de obrigatórias da sessão, com anel SVG. |
| Próximo capítulo | ID atual derivado, número e título do capítulo correspondente. |
| Carga horária | `course.workload`, em horas. |

Não há percentuais ou números pedagógicos hardcoded. Curso sem capítulos mostra
essa ausência, sem afirmar que o aluno terminou uma jornada vazia. Curso concluído
permite revisitar e informa a conclusão real. O anel é decorativo; percentual e
contagem são texto. O progress nativo rotulado do header foi preservado.

## Jornada central

`CourseJourneyBoard` compõe cenário, trilha, checkpoints, cards dos capítulos e
destino final. Na entrega inicial, o fundo `public/images/learn/course-mountains.svg` foi desenhado
como asset vetorial local: céu claro e montanhas em planos azulados. Não usa URL
externa, biblioteca gráfica adicional ou imagem de terceiros.

O componente aceita `backgroundImage` para substituir o cenário por outro caminho
local futuramente; caminhos externos são recusados e usam o fallback local. Não
foi adicionado campo ao CourseDraft nem configuração de upload.

O caminho SVG liga os pontos e é decorativo para tecnologia assistiva. A informação
semântica está na lista ordenada HTML, com links quando disponíveis e texto de
bloqueio quando não disponíveis. Cada checkpoint inclui número/check, capítulo,
título, descrição curta, contagem de obrigatórias e estado. O atual recebe laranja,
borda clara no checkpoint, borda laranja no card e texto Capítulo atual. O destino
final é uma bandeira com rótulo, sem ação artificial.

`journeyPositions` contém apenas coordenadas visuais, sem consultar ou modificar
elegibilidade. Há disposições para 1–6 capítulos: os três primeiros sobem uma
trilha diagonal; quatro a seis usam duas fileiras em percurso contínuo. A segunda
disposição aumenta a altura do cenário para evitar sobreposição. Para mais de
seis, o fallback é uma grade ordenada de cards sobre o cenário, sem fingir que
existe um caminho geométrico calculado para um número arbitrário de pontos.

Todos os capítulos permanecem presentes. Os títulos e descrições podem ter duas
linhas visuais no card; o texto completo permanece no DOM e no nome acessível do
link. Curso sem capítulos mantém mensagem própria. Os testes verificam contagem,
limites de layout e ausência de sobreposição com 4, 5, 6 e 9 capítulos.

## Vídeo de abertura

`CourseIntroVideo` fica abaixo da jornada, com texto à esquerda e placeholder à
direita no desktop. O objetivo do curso é reaproveitado como texto explicativo,
sem inventar mídia ou conteúdo pedagógico novo. O placeholder informa que nenhum
serviço externo foi carregado e não possui botão Play falso.

Uma prop técnica opcional `videoUrl` permite reutilizar `VideoActivityCard` e sua
política existente de carregamento explícito/URL compatível no futuro. Ela não
foi conectada a um novo campo de curso e nenhum vídeo foi configurado na demonstração.

## Responsividade e acessibilidade

- 1440×1000 e 1366×768: quatro cards alinhados, sidebar lateral e jornada central.
- 1024×768: sidebar de 260 px, cards 2×2 e vídeo empilhado; os checkpoints continuam
  distribuídos e legíveis, sem transbordamento horizontal da página.
- Perfil do header cabe dentro dos 80 px, inclusive com matrícula em duas linhas.
- Sidebar tem contraste claro sobre azul-marinho e foco branco; conteúdo mantém
  foco azul-marinho de 2 px. Estados também usam texto e símbolos.
- H1 único de visão geral; h2 para sidebar, cards, jornada e abertura; h3 nos
  capítulos da jornada. Links são nativos; SVGs decorativos não duplicam anúncios.
- Não há controles de autoria, gabarito ou campos privados na visão geral.

Não é uma certificação de acessibilidade nem uma validação com leitores de tela
reais. Smartphone tem fallback simples; não foi o alvo desta etapa. Em notebook,
a página rola verticalmente para acomodar a jornada e a abertura.

## Arquivos

Criados:

- `components/learn/CourseOverviewSidebar.tsx`, `CourseSummaryCards.tsx`,
  `CourseJourneyBoard.tsx`, `CourseIntroVideo.tsx`.
- `app/learn/overview.css`, `public/images/learn/course-mountains.svg`.
- `tests/course-overview-final.spec.tsx` e este documento.

Modificados: `CourseOverview.tsx`, `StudentHeader.tsx`, `app/learn/layout.tsx`
(import do CSS), `tests/learn-ui.spec.ts` e README.

Não houve alteração em StudentCourseProgress, CourseAccessPolicy, CourseDraft,
ExerciseDefinition, ExerciseLab, ChapterPlayer, avaliador, motor ou repositórios.
O componente anterior CourseJourney e o helper de rotas permanecem disponíveis;
a visão geral passa a usar o Board, sem criar outro fluxo de execução de cursos.

## Testes e verificação

Seis novos casos cobrem posições/contagem, sidebar completa, header, quatro cards
com valores reais, estados, checkpoints navegáveis/bloqueados, vídeo sem requests
externos, progresso após conclusão, três viewports, foco, igualdade de altura dos
cards, conteúdo dentro dos limites e layouts alternativos de 4/5/6/9 capítulos.
O teste alternativo renderiza o componente real com dados diferentes e aplica o
markup no layout carregado somente no navegador de testes; não adiciona rota,
seletor de fixture ou fluxo especial ao app de produção.

Três asserções antigas de título em `tests/learn-ui.spec.ts` foram atualizadas
para o novo H1 exigido, acrescentando a conferência do nome do curso no header.
Nenhuma verificação de progresso, aprovação, persistência, proteção ou navegação
foi removida ou afrouxada. Timeouts e critérios anteriores permanecem.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **183 aprovados, 0 falhos**; 177 anteriores + 6 novos, aproximadamente 3,3 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas, sem novos endpoints. |
| Visão geral após ajuste final da bandeira | 6 casos focados aprovados no build final, incluindo separação do marco/checkpoint, em aproximadamente 10,6 segundos. |
| Layouts | 1440×1000, 1366×768 e 1024×768 inspecionados; cards alinhados ou 2×2, foco visível e nenhuma rolagem horizontal da página. |
| Quantidade variável de capítulos | 1–6 posições preservadas; 4/5/6/9 capítulos conferidos sem sobreposição, com fallback acima de seis. |
| Regressões | Lab, proteção, avaliação, pontuação, autosave, navegação e bloqueio aprovados na suíte completa. |

A suíte completa passou após corrigir a altura das jornadas com títulos longos.
Depois dela, apenas o espaçamento visual da bandeira foi ajustado: typecheck/build
foram executados novamente e os seis testes da visão geral passaram no build
final. As capturas finais foram inspecionadas, incluindo a separação entre o
rótulo Destino final e o último checkpoint em 1024 px.

Ambiente: Chrome com renderização por software, produção temporária na porta
3001 e harness existente na 3002. Os servidores temporários foram encerrados;
o servidor e a sessão do usuário na porta 3000 foram preservados. Nenhum pacote
ou lockfile foi alterado.

O último build retornou código 0, embora seu log tenha registrado duração anômala
de 86,5 minutos no marcador de TypeScript. Esse intervalo não foi tratado como
medição de desempenho da aplicação; a causa não foi investigada nesta etapa visual.

Na rodada focada intermediária, 11 de 12 casos passaram. O caso novo de Destino
final não encontrava o rótulo exato porque o símbolo da bandeira compartilhava
o mesmo nó; o texto foi separado em um span. A inspeção também levou ao ajuste
da altura do perfil e a uma disposição mais espaçada para quatro a seis capítulos.

Uma primeira suíte completa teve 182 aprovações e uma falha no caso visual novo
de títulos longos: um card excedia a borda inferior da jornada de quatro capítulos
em cerca de 8 px. A área das disposições em duas fileiras foi ampliada, mantendo
as asserções de limites e de não sobreposição. Os seis casos focados passaram
após a correção. Na inspeção final foi reservado espaço acima do último checkpoint
para o rótulo da bandeira, com regressão explícita para impedir sua sobreposição.

Para abrir, execute `npm.cmd run dev` e acesse
`http://localhost:3000/learn/neural-demo`. Confira a sidebar, os quatro resumos e
a jornada; clique no primeiro checkpoint, conclua as obrigatórias de Fundamentos
e volte à visão geral. O progresso deve atualizar e Correção de Erro deve ficar
disponível. O capítulo futuro continua sem link.

Verificação nesta máquina, com Node configurado conforme README:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
npm.cmd run typecheck
npm.cmd run build
```

Capturas em `test-results/etapa-16-3-overview-{1440,1366,1024}.png` e
`test-results/etapa-16-3-six-chapters.png`.

## Diferenças e limites

O cenário da entrega inicial era uma ilustração vetorial de montanha, substituída
pelo PNG fornecido no ajuste abaixo. Marca e perfil continuam os placeholders anteriores. Quantidade,
títulos, ordem e atividades vêm do curso real; não foram substituídos por cinco
capítulos fixos. Acima de seis capítulos, a jornada usa grade de fallback.
O vídeo é um placeholder sem mídia externa. O progresso continua apenas em memória,
com as mesmas limitações de refresh e salvamento das etapas anteriores.

A ausência do documento da Etapa 16.2 neste checkout impede atestar equivalência
com uma entrega intermediária não disponível. Foram preservadas as funcionalidades
presentes e aplicado somente o refinamento visual pedido. Não foram iniciados
autenticação, matrícula real, backend, Supabase ou outra etapa funcional.

## Novo cenário da jornada

No primeiro ajuste de cenário, a imagem fornecida pelo usuário era:

- Origem: `image/course-journey-background.png`.
- Cópia pública: `public/images/learn/course-journey-background.png`.
- URL usada pelo board: `/images/learn/course-journey-background.png`.
- Dimensões: 1942 × 809 px; tamanho: 1.880.941 bytes.
- SHA-256 de ambos: `037a9ccb5bb29a2e32cef5946867c9bcf0011c60fa6ea3769ea90972467a1b23`.

O original não foi editado. A cópia mantém os mesmos bytes. O componente existente
foi reaproveitado, sem nova jornada, biblioteca ou mudança de modelo. Sidebar,
cards de resumo, vídeo de abertura, regras, progresso, bloqueio, Lab e autosave
permanecem intactos.

O fundo usa duas camadas CSS: o PNG por cima e `course-mountains.svg` por baixo.
Se a primeira imagem falhar, o navegador mostra a camada SVG já existente. Ambas
usam `cover` e proporção preservada. A posição é central na demonstração; nas
composições mais altas de quatro a seis capítulos, usa 65% na horizontal para
manter o pico dentro do recorte, inclusive em 1024 px. O container conserva bordas
arredondadas e recorte; não há overlay escuro. Em larguras menores, o recorte
lateral de `cover` aumenta, mantendo a montanha principal visível.

Para três capítulos, os centros dos checkpoints ficam aproximadamente em
16%/63%, 49%/35% e 82%/12% da área visual: inferior esquerda, meio e proximidade
do pico. A trilha é branca tracejada com contorno azul-marinho semitransparente.
O cenário principal tem 560 px de altura. Em desktop largo, os cards alternam
lados da trilha; em notebook ficam abaixo dos pontos para manter sua largura útil.
Cards brancos translúcidos têm texto azul-marinho, borda e sombra; estados reais
continuam indicando atual em laranja, concluído em verde/check e bloqueado em cinza.

As disposições de quatro a seis capítulos usam mais altura (880 px), necessária
para acomodar títulos e descrições longos sem sobreposição. Para cinco, a sequência
sobe pelos três primeiros pontos, desvia à direita para o quarto e volta a subir
até o quinto. As coordenadas visuais são 16%/65%, 49%/52%, 49%/27%, 82%/39% e
82%/12%. A bandeira com “Destino final” permanece acima do último checkpoint,
próxima ao pico. Cursos com mais de seis capítulos mantêm a grade ordenada de
fallback. Nenhuma coordenada determina elegibilidade ou progresso.

Os números, cores e bandeira já pintados no PNG continuam sendo decoração estática.
Eles podem diferir da quantidade e do estado reais dos capítulos, especialmente
na demonstração de três capítulos. Não foram retocados nem receberam áreas
clicáveis. A informação funcional é a dos checkpoints HTML, cards e links
dinâmicos. Essa limitação do primeiro asset foi eliminada pela imagem limpa
descrita em “Background final da jornada”, abaixo.

Arquivos deste ajuste:

- Criado o PNG público e `tests/course-journey-background.spec.tsx`.
- Alterados `components/learn/CourseJourneyBoard.tsx` e as regras da jornada em
  `app/learn/overview.css`.
- Acrescentado diagnóstico de coordenadas à asserção existente de não sobreposição
  em `tests/course-overview-final.spec.tsx`, sem mudar seu critério.
- Atualizado este documento. Nenhuma dependência instalada.

Cinco novos casos verificam integridade/entrega do asset, falha deliberada do PNG
com recuperação pelo SVG, carregamento/decodificação da imagem, subida dos pontos,
cards nos limites, ausência de sobreposição, bandeira e largura da página nos três
viewports. Os testes anteriores continuam cobrindo progresso, estados e links.
As capturas ficam em `test-results/journey-background-{three,five}-{largura}.png`
e `test-results/journey-background-fallback.png`.

Na primeira conferência, a regressão existente detectou sobreposição entre cards
longos na composição de cinco capítulos. O espaçamento foi corrigido, preservando
a asserção. Os testes novos também passaram a conferir `cover, cover`, representação
computada pelo navegador para as duas camadas, em vez de uma única camada.

### Verificação do novo cenário

| Verificação | Resultado final |
| --- | --- |
| `npm test -- --workers=2` | **188 aprovados, 0 falhos**, 183 anteriores + 5 novos; aproximadamente 2,7 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; rotas e API existentes preservadas. |
| 1440×1000 | PNG carregado, cards laterais na demonstração, composição de cinco capítulos sem sobreposição e sem rolagem horizontal. |
| 1366×768 | Texto, foco e destino legíveis; checkpoints e cards dentro dos limites, sem rolagem horizontal. |
| 1024×768 | Cards abaixo dos checkpoints; recorte ajustado conserva o pico mesmo na composição alta de cinco capítulos; sem rolagem horizontal. |
| Falha deliberada no PNG | SVG carregado e visível; três checkpoints preservados e link disponível continua abrindo Fundamentos. |
| Integridade | Origem e cópia pública conservam o SHA-256 registrado acima. |

Foram inspecionadas as capturas dos três viewports e do fallback. A primeira
suíte completa já havia aprovado 188 casos; após identificar visualmente o recorte
do pico na composição alta em 1024, o fundo foi reposicionado e uma verificação
do marco visual foi acrescentada. Typecheck, build e toda a suíte foram executados
novamente com sucesso no resultado final acima. Nenhum teste anterior foi removido
ou afrouxado. Chrome com renderização por software, servidor temporário de produção
na 3001 e harness existente na 3002; servidores temporários encerrados ao final,
sem interferir no servidor ou na sessão do usuário em 3000.

Para conferir manualmente, execute `npm.cmd run dev` e abra
`http://localhost:3000/learn/neural-demo`. O PNG aparece atrás dos três capítulos.
Entre no primeiro, conclua suas obrigatórias e volte: o check/progresso e os links
devem refletir a mesma lógica anterior. O fallback pode ser inspecionado bloqueando
somente a URL do PNG no painel de rede do navegador e recarregando a página.

O ajuste termina aqui, sem iniciar outra etapa funcional.

## Background final da jornada

O cenário definitivo é **Amanhecer Dourado nas Montanhas Alpinas.png**, localizado
em `D:/Users/50047539/Downloads/Amanhecer Dourado nas Montanhas Alpinas.png`.
A inspeção visual confirmou que contém somente montanhas e amanhecer, sem números,
trilha, checkpoints, bandeira, cards ou textos embutidos.

O arquivo foi copiado sem transformação para
`public/images/learn/course-journey-background.png`. A aplicação mantém somente a
URL `/images/learn/course-journey-background.png`, sem caminho absoluto no React
ou CSS. O original em Downloads e o antigo original em `image/` foram preservados.

- Dimensões da nova imagem: 1942 × 809 px.
- Tamanho: 2.323.977 bytes.
- SHA-256 da origem e da cópia pública:
  `994ac7facccb99023f17d0717a93746bdf68b53d6de3d860795a0aa8b853b5e8`.
- A regressão de integridade fixa esse hash, sem depender da pasta Downloads em
  outras máquinas; confere também os bytes entregues pela URL pública.

### Composição e camadas

Foi mantido o mesmo `CourseJourneyBoard`, com isolamento de empilhamento e ordem
explícita: background CSS, trilha SVG (`z-index: 1`), lista semântica de capítulos
(`z-index: 2`) e destino (`z-index: 3`). A bandeira agora é SVG laranja desenhado
pelo componente, decorativo junto ao texto “Destino final”. Não há imagem clicável,
mapa de áreas nem conteúdo pedagógico inserido no PNG.

A trilha branca tracejada e seu contorno azul-marinho continuam sendo SVG gerado
das posições visuais dos capítulos. Números/checks, títulos, descrições, progresso,
estado e links são elementos HTML derivados dos mesmos dados reais. Um novo teste
remove o background e confirma que essas camadas continuam presentes; depois
conclui Fundamentos e confirma check verde, próximo capítulo laranja, bloqueio dos
links futuros e progresso de 33%.

O fundo usa `cover`, sem deformação, com posição central na demonstração e 65%
horizontal nas composições altas, conservando o pico no recorte. Alturas de 560 px
e 880 px, disposições de 1–6 capítulos e fallback de lista acima de seis foram
preservados. Para três capítulos, o percurso continua inferior esquerda → meio →
proximidade do pico; com cinco, há subida central, desvio à direita e chegada ao
topo. Nenhuma coordenada visual altera desbloqueio ou conclusão.

No desktop largo, o último card da demonstração recebeu deslocamento vertical
de 60 px para deixar o pico descoberto. Em notebook, os cards continuam abaixo dos
checkpoints. As regressões conferem que nenhum card cobre os checkpoints ou o
marco visual do pico. Bordas brancas dos pontos, sombras, cards quase opacos com
texto azul-marinho e placa branca do destino mantêm a leitura no céu e na neve.
Não foi necessário overlay: a iluminação dourada foi preservada. O recorte do
container mantém border-radius e overflow hidden.

### Fallback e escopo

`course-mountains.svg` permanece como camada CSS inferior. A falha deliberada de
carregamento do PNG continua revelando o SVG, mantendo capítulos e navegação.
O asset SVG anterior não foi apagado e não é o fundo principal.

Foram alterados somente a cópia PNG pública, `CourseJourneyBoard.tsx`, regras da
jornada em `overview.css`, `tests/course-journey-background.spec.tsx` e este
documento. O teste de integridade anterior foi atualizado para a imagem solicitada;
suas verificações de integridade/entrega foram mantidas, assim como todos os casos
de fallback, contagem, layout e navegação. Acrescentou-se uma regressão de camadas
e estados, além das verificações de pico livre e cards separados dos checkpoints.
Nenhuma dependência adicionada. Sidebar, cards-resumo, abertura, modelos,
progresso, acesso, Lab, avaliação e autosave não foram modificados.

### Verificação final do fundo limpo

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **189 aprovados, 0 falhos**; 188 anteriores preservados/adaptados ao novo asset + 1 caso novo, aproximadamente 3,2 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas e API. |
| Casos focados da jornada | 12 aprovados: seis anteriores de visão geral e seis do cenário/camadas. |
| 1440×1000 | Composições de três e cinco capítulos inspecionadas; pico livre, cards dentro dos limites, bandeira por código e nenhum transbordamento horizontal. |
| 1366×768 | Trilha visível, cards legíveis e separados dos checkpoints; destino acima do último ponto. |
| 1024×768 | Cards abaixo dos pontos, montanha principal/pico preservados pelo enquadramento; nenhuma rolagem horizontal da página. |
| Progresso/estados | Fundamentos concluído verde com check, Correção de Erro atual laranja, 33% e links futuros bloqueados. |
| Fallback | PNG bloqueado deliberadamente → SVG visível e navegação disponível. |
| Originais | Novo original em Downloads e antigo em `image/` mantêm seus hashes; cópia pública idêntica ao novo. |

Ambiente: Chrome com renderização por software, build de produção temporário na
porta 3001 e harness na 3002. Servidores temporários encerrados; porta/sessão do
usuário em 3000 preservadas. Capturas de três e cinco capítulos em
`test-results/journey-background-{three,five}-{1440,1366,1024}.png`, além de
`test-results/journey-background-fallback.png`; inspecionadas visualmente.

Para abrir, execute `npm.cmd run dev` e acesse
`http://localhost:3000/learn/neural-demo`. O cenário deve mostrar somente a
montanha limpa, com três checkpoints funcionais e uma única trilha/bandeira
desenhadas pelo componente. Concluir as obrigatórias de Fundamentos e voltar
à visão geral deve atualizar progresso/cores conforme o comportamento anterior.

Permanecem os limites anteriores: recorte lateral com `cover` em notebook, maior
altura para quatro a seis capítulos, grade alternativa acima de seis e progresso
em memória. Não foi iniciada outra etapa funcional.

## Simplificação da sidebar da visão geral

Em `/learn/[courseId]`, `CourseOverviewSidebar` apresenta somente os capítulos:
número/checkpoint, estado, título e descrição. As listas internas de atividades,
suas letras, títulos, tipos e estados individuais deixaram de ser renderizadas.
Nenhuma atividade foi removida do `CourseDraft`; modelos e dados permanecem iguais.

O único componente da aplicação alterado foi `CourseOverviewSidebar`. A página
interna e `ChapterSidebar` não foram modificadas: atividades A/B/C, seleção,
navegação, vídeo, material, avaliação e Lab continuam no mesmo fluxo anterior.
Progresso, conclusão, bloqueios, autosave, cards de resumo e montanha permanecem.

Capítulo atual conserva destaque e checkpoint laranja; concluído conserva check,
verde e texto Concluído; bloqueado conserva cinza, texto Bloqueado e ausência de
link. Os capítulos disponíveis continuam usando os mesmos links nativos.
Recolher/expandir mantém o funcionamento existente: aberta mostra títulos e
descrições; recolhida mostra checkpoints, estados acessíveis e tooltips.

A remoção das listas reduz automaticamente a altura dos itens. O CSS existente
mantém margem de 19 px entre eles e a linha vertical de conexão, sem reservar
espaço para atividades ausentes. Não foi necessário alterar estilos compartilhados.
Foram inspecionadas as capturas em 1440×1000, 1366×768 e 1024×768: textos legíveis,
trilha compacta e nenhuma rolagem horizontal da página. Larguras anteriores de
280/260 px e 72 px recolhida foram preservadas.

Os testes existentes em `tests/course-overview-final.spec.tsx` e
`tests/student-sidebar.spec.ts` foram atualizados para a nova apresentação e
ampliados: ausência de listas e títulos de atividades na visão geral, campos de
cada capítulo, estados, links, conclusão, atividades A/B/C dentro do capítulo,
espaçamentos, linha vertical e expansão sem reintroduzir atividades. Nenhum caso
foi removido; verificações funcionais, timeouts e critérios pedagógicos continuam.

Para conferir, abra `http://localhost:3000/learn/neural-demo`, recolha e expanda
a sidebar, entre em Fundamentos e confira suas três atividades. Conclua as duas
obrigatórias e volte à visão geral: o primeiro capítulo mostra check/Concluído e
o segundo fica disponível. As atividades continuam restritas à página interna.

### Verificação da simplificação

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **199 aprovados, 0 falhos**, aproximadamente 3,9 minutos, sem retries. |
| Casos focados de visão geral e sidebar | 12 aprovados, incluindo estados, atividades internas, teclado e Lab. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas. |
| Conferência visual | 1440×1000, 1366×768 e 1024×768 inspecionados, com trilha compacta e expansão preservada. |

A suíte foi executada sobre produção temporária na porta 3001, com o harness
existente na 3002, Chrome e renderização por software. Os servidores temporários
foram encerrados, sem interferir no servidor ou na sessão do usuário em 3000.
Capturas em `test-results/sidebar-overview-simplified-{1440,1366,1024}.png`.
Foram mantidos os 199 casos anteriores, com atualização apenas das expectativas
visuais incompatíveis com o novo pedido e acréscimo das verificações descritas.

Permanecem as limitações anteriores de sessão em memória e de acessibilidade
sem certificação por leitores de tela reais. Nenhuma dependência foi instalada
e nenhuma nova etapa funcional foi iniciada.
