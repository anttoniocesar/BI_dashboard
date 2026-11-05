# Etapa 16.1 — Refinamento visual do ambiente do aluno

Escopo: composição e apresentação de `/learn`, principalmente a tela do capítulo.
As rotas, curso demonstrativo, conteúdo, progresso, conclusão, critérios de
aprovação e persistência da Etapa 16 permanecem. Nenhuma dependência adicionada.

## Referência utilizada

O anexo desta solicitação continha o pedido em texto, sem arquivo de imagem. Não
foi possível comparar pixels com o mockup citado. A implementação segue a
composição descrita pelo usuário: cabeçalho horizontal claro com marca, curso,
progresso e aluno; sidebar azul-marinho; área clara com blocos de atividades
identificados por letras; Lab real incorporado; navegação inferior entre capítulos.

Não foi encontrado um arquivo de logo na árvore de fontes. Foi mantido o fallback
tipográfico BI.Society e símbolo BI. já existente, sem nova identidade gráfica.

## Composição

`StudentHeader` compartilha a nova apresentação entre visão geral e capítulo:

- Marca/wordmark à esquerda e título real do curso com subtítulo institucional.
- Barra fina de progresso com percentual e contagem de obrigatórias, derivados
  de `courseProgress`, sem percentual fixo.
- Avatar tipográfico, Olá, Aluno, matrícula `DEMO-202700184` e identificação
  explícita de perfil demonstrativo. Esses dados estão em `data/learn/student-demo.ts`,
  separados dos modelos de curso e de qualquer autenticação futura.
- Header sticky com altura desktop de 94 px, fundo branco e borda discreta.

A visão geral conserva a trilha anterior. O resumo de progresso no corpo recebeu
o rótulo Resumo do progresso; o controle Progresso do curso está no cabeçalho,
evitando dois controles com o mesmo nome acessível.

No capítulo, `ChapterSidebar` ocupa 260 px em desktop e 240 px em 1024. Usa fundo
azul-marinho, posição sticky sob o header e rolagem própria apenas quando a lista
excede a altura disponível. O documento continua sendo a rolagem principal; o Lab
mantém a rolagem necessária à sua grade. Voltar para a trilha acompanha o link de
visão geral existente.

Capítulos mostram título, descrição disponível, contagem e estado textual. Círculo
verde/check indica concluído; capítulo atual tem realce e borda; bloqueados têm
círculo cinza e permanecem sem link. Atividades do capítulo usam letras sequenciais,
marcação da atual e estado concluída/em estudo/pendente, além de obrigatoriedade.

## Blocos das atividades

`ChapterActivitySection` apresenta todos os cabeçalhos em blocos próprios, com
badge A/B/C/D…, título original, duração quando houver, status e ação de abertura.
O conteúdo da atividade selecionada fica expandido; os demais cabeçalhos continuam
visíveis. Seleção pela sidebar, pelo bloco ou pelos controles anterior/próxima
mantém o fluxo existente e leva o foco ao título da atividade selecionada.

Há uma única atividade montada por vez, preservando o ciclo de vida anterior,
evitando múltiplas grades com os mesmos IDs e mantendo uma única ação Concluir
atividade no percurso. Não foi criada uma planilha ilustrativa para os blocos
recolhidos. Abrir um bloco de Lab monta o mesmo ExerciseLab real.

As letras derivam da ordem real das atividades. Não houve reordenação do curso
demonstrativo para forçar uma letra: seu Lab permanece em B no segundo capítulo,
porque o capítulo possui texto e Lab. Um curso com vídeo, material, Lab e avaliação
produz A/B/C/D com o Lab em C, coberto por integração no navegador. A identificação
também continua após Z, sem modificar o endereço ou a ordem de nenhuma atividade.

### Vídeo

`VideoActivityCard` coloca player/placeholder à esquerda e Resumo da aula à
direita em desktop. Como ActivityDraft não possui resumo de vídeo próprio, usa
a descrição já existente do capítulo; se ausente, informa Resumo não informado.
Não foi inventado conteúdo pedagógico nem adicionado campo ao modelo.

Mantém a política anterior de URLs HTTPS compatíveis, carregamento por ação
explícita, controles nativos e fallback demonstrativo. Assistir novamente é
oferecido para um vídeo compatível já concluído; pode reapresentar o player ou
voltar ao início do vídeo montado. Não aparece um botão falso de download: a
ausência de arquivo anexado é informada como texto. A demonstração não possui
vídeo real e continua mostrando metadata/placeholder.

### Texto e material

`MaterialActivityCard` organiza o texto original com chips informativos de
Conteúdo e, quando existir, Referência de arquivo. Não usa role tab nem controles
sem conteúdo associado. Não foram inventadas abas Fórmulas/Imagens/Exemplo
industrial. Texto continua escapado pelo React, sem HTML arbitrário; links de
material passam pelo mesmo filtro HTTP/HTTPS anterior e abrem por ação do aluno.

### Lab incorporado

Faixa de prática acima da planilha: Agora é a sua vez de aplicar o conceito.
Utilize a planilha abaixo para resolver o exercício. **Ver instruções** é um
details/summary nativo com a orientação real e o subtítulo da definição, se existir.

O modo embedded existente continua recebendo a mesma definição, repositório e
callback público de avaliação. CSS restrito a `.learn-lab` ajusta bordas, toolbar,
densidade, tabs, janela da grade e faixa de status/reinício. Não há ribbon falsa,
ícones decorativos acionáveis ou novas operações Excel. Os controles continuam
sendo os reais: barra, células, abas, verificação e reinício.

O trigger do dialog existente recebeu a opção visual `triggerLabel`. ExerciseLab
usa **Reiniciar planilha** quando incorporado; fora desse modo, preserva Reiniciar
exercício. O mesmo dialog pede confirmação, começa em Cancelar, fecha com Esc,
retorna foco à origem e usa a mesma rotina assíncrona de reset. Nem o controlador
de persistência nem a rotina de reinício foram modificados.

### Avaliação e bloqueio

A Etapa 16 bloqueia capítulos futuros, não avaliações individuais depois de um
Lab dentro do mesmo capítulo. A exigência desta etapa de preservar
CourseAccessPolicy/progresso tem precedência sobre inventar essa dependência.

A sidebar mostra **Avaliação bloqueada · conclua os capítulos anteriores** quando
um capítulo bloqueado contém avaliação, e não oferece link para ele. Após o
capítulo estar disponível, a avaliação conserva a conclusão manual existente.
Não se afirma que uma avaliação já disponível depende de aprovação do Lab. O
teste A/B/C/D confirma essa política existente, sem acrescentar novo avaliador.

## Navegação inferior

`ChapterNavigation` oferece Capítulo anterior, Voltar para a trilha e Próximo
capítulo. Destinos vêm dos mesmos estados derivados de acesso:

- Anterior fica desabilitado quando não existe ou não está disponível.
- Próximo fica desabilitado enquanto estiver bloqueado ou quando não existe.
- Links ativos usam as rotas existentes e conservam progresso em memória.

O aviso Capítulo concluído e sua ação Continuar para o próximo capítulo foram
preservados, assim como a navegação entre atividades.

## Responsividade e acessibilidade

Layout verificado em 1440×1000, 1366×768 e 1024×768. Em desktop, vídeo e resumo
ficam lado a lado. Em 1024, empilham; a sidebar reduz para 240 px, o header fica
mais denso e os controles quebram linha. A página não deve rolar horizontalmente;
a grade possui seu viewport horizontal próprio. Não há otimização completa para
smartphone.

Header claro mantém texto/foco azul-marinho. A sidebar usa texto claro, contornos
de foco brancos de 2 px, status textual e símbolos. Texto auxiliar sobre a
atividade atual é verificado por contraste computado de pelo menos 4,5:1.
Cabeçalhos de blocos usam h2, atividade selecionada recebe foco e os botões expõem
aria-expanded/aria-controls. O conteúdo recolhido usa hidden. O perfil é
explicitamente demonstrativo, sem controles de conta fictícios.

Teclado da grade, barra de fórmulas, abas, Esc e saída por Tab continuam intactos.
O novo botão de instruções usa comportamento nativo de teclado. Não houve
certificação de acessibilidade nem teste com leitor de tela real.

## Arquivos

Criados:

- `data/learn/student-demo.ts`.
- `components/learn/StudentHeader.tsx`, `ChapterActivitySection.tsx`,
  `VideoActivityCard.tsx`, `MaterialActivityCard.tsx`, `ChapterNavigation.tsx`.
- `tests/student-ui-refinement.spec.ts` e este documento.

Modificados:

- `app/learn/layout.tsx`, `app/learn/learn.css`.
- `components/learn/ChapterPlayer.tsx`, `ChapterSidebar.tsx`,
  `ActivityRenderer.tsx`, `CourseOverview.tsx`.
- `components/storage/ExerciseLab.tsx`, `ResetExerciseButton.tsx` somente na
  escolha do texto do trigger, sem alterar execução/reset.
- README.

Não foram alterados StudentCourseProgress, CourseAccessPolicy,
ExerciseValidationResult, ExerciseDefinition, ExerciseRepository, modelos de
curso, avaliador, parser, autosave, repositórios ou dados pedagógicos da demonstração.

## Verificações

Seis novos testes de navegador cobrem header com curso/progresso/perfil, sidebar,
seleção e estados, blocos por letras, vídeo/resumo, material, progresso atualizado,
bloqueio existente, navegação inferior, instruções e confirmação/reinício real,
curso importado A/B/C/D com Lab em C e aprovação no mesmo avaliador, teclado,
contraste e três tamanhos de tela. Os testes anteriores do aluno continuam
cobrindo o fluxo completo do exercício neural e conclusão do curso.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **177 aprovados, 0 falhos**; 171 anteriores + 6 novos, aproximadamente 2,8 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; rotas e API existentes preservadas. |
| Viewports | 1440×1000, 1366×768 e 1024×768 aprovadas; vídeo/resumo lado a lado ou empilhados conforme largura; sem transbordamento horizontal da página. |
| Lab e progresso | Exercício neural completo e curso de autoria com Lab em C aprovados pelo avaliador anterior; header reage ao progresso real. |
| Reinício | Mesmo dialog, Cancelar/Esc/foco preservados; confirmação restaura a planilha pelo reset existente. |
| Conferência adicional da viewport | 3 casos visuais aprovados após a suíte completa, incluindo header em y=0 durante a navegação da grade e capturas da viewport. |

A execução usou Chrome com renderização por software, produção temporária na
porta 3001 e harness existente na 3002. Os servidores temporários foram encerrados;
o servidor e a sessão do usuário na 3000 foram preservados. Todos os 171 testes
anteriores permanecem sem alteração. Nenhuma dependência ou lockfile foi alterado.

Capturas de página inteira com a janela já rolada podem posicionar os elementos
sticky no ponto da rolagem dentro da imagem longa. As capturas adicionais
`etapa-16-1-lab-viewport-{1440,1366,1024}.png` mostram a viewport efetiva: header
no topo, sidebar e foco do botão de verificação visíveis. Essas capturas também
foram inspecionadas, sem tratar o artefato da captura longa como layout real.

Uma execução focada intermediária passou os sete testes anteriores do aluno e
dois novos casos funcionais. Três novos testes visuais detectaram que a preparação
de foco era feita após uso do mouse, sem ativar :focus-visible. A preparação foi
corrigida para usar teclado antes de medir o contorno, e o contorno branco foi
declarado explicitamente. Nenhum teste anterior, timeout ou asserção histórica
foi afrouxado.

Para abrir:

```powershell
npm.cmd run dev
```

Abra `http://localhost:3000/learn/neural-demo`, comece o curso, selecione blocos
pela sidebar ou pelo botão Abrir e conclua as obrigatórias. Observe o progresso
do cabeçalho e o estado do botão Próximo capítulo. No Lab, edite uma célula,
consulte Ver instruções, abra Reiniciar planilha e teste Cancelar/Esc/confirmar.

Para verificar nesta máquina, com o Node do README:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
npm.cmd run typecheck
npm.cmd run build
```

Capturas locais em `test-results/etapa-16-1-{capitulo,lab}-{1440,1366,1024}.png`.

## Diferenças e limitações preservadas

Sem comparação pixel a pixel com a imagem ausente. A marca é fallback textual;
perfil/matrícula são placeholders, sem autenticação. Blocos ficam compactos e
expandem a atividade selecionada; não exibem todos os conteúdos/Labs simultaneamente.
Letras e quantidade de blocos dependem do curso real. Avaliações não ganham uma
dependência individual de Lab que não existe no modelo atual. Não há download
real de vídeo nem conteúdo fictício nas chips de material.

Progresso e respostas do curso continuam em memória; refresh descarta a sessão.
É preciso aguardar Salvo antes de sair de um Lab para conservar o último snapshot.
As regras de aprovação permanecem no cliente nesta POC, com os limites da Etapa
16. Não foram iniciados autenticação, matrícula real, banco, Supabase, publicação
ou a Etapa 17.
