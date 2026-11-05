# Navegação interna do capítulo — A/B/C

Escopo: navegação pedagógica na página interna do capítulo, usando os mesmos
renderers de vídeo e ExerciseLab. Não foram alterados componentes da visão geral,
montanha, regras de progresso, aprovação, motor de planilha ou autosave.
Nenhuma dependência foi instalada.

Foram lidos integralmente os documentos das Etapas 15, 16 e 16.1. O anexo do
pedido termina no título “21. Títulos”, sem conteúdo dessa seção. Esta entrega
implementa as seções completas 1–20; não presume requisitos posteriores.

## Configuração declarativa

`ActivityDraft` mantém sua união por tipo e recebe metadata opcional:

```ts
navigationGroup?: "video-lesson" | "video-application" | "laboratory";
```

O catálogo `chapterActivityGroups`, em `lib/learn/chapter-navigation.ts`, define
ordem, rótulos e tipos compatíveis: A. Video Aula (`video`), B. Video Aplicação
(`video`) e C. Laboratório (`spreadsheet-exercise`). Não se infere a função
pedagógica de um vídeo a partir de sua posição no array.

O helper puro `chapterNavigation` gera a ordem de apresentação e os prefixos.
Labs são numerados C.1, C.2… sem limite rígido de seis. Dentro de cada grupo,
respeita-se `activity.order`. Grupos vazios não criam atividades fictícias.
Vários vídeos no mesmo grupo recebem A.1/A.2 ou B.1/B.2, sem perda de conteúdo.
Títulos reais são preservados; quando diferem do rótulo do vídeo, também aparecem
na sidebar. Os títulos dos Labs não são substituídos pelo número.

Exemplo de configuração de uma atividade já existente:

```ts
{
  id: "pratica-1", title: "Lab 1", order: 3, required: true,
  type: "spreadsheet-exercise", navigationGroup: "laboratory",
  content: { exerciseId: "identidade-do-exercicio" }
}
```

A validação do curso rejeita grupos desconhecidos ou incompatíveis com o tipo.
O renderer conserva atividades incompatíveis como conteúdo complementar, sem
executar outro tipo de renderer nem descartá-las. Cursos sem metadata mantêm a
ordem e identificação anteriores. Em capítulos configurados, texto, material,
avaliação e atividades sem grupo ficam depois de C, com identificação D/E/… e
seus títulos reais. Não são convertidos em vídeos ou Labs.

O formulário existente de atividade preserva metadata compatível ao editar;
ao trocar o tipo, remove apenas o grupo que deixou de ser compatível. Nesta
entrega não foi criado um seletor novo de agrupamento no Studio: a configuração
é declarativa no modelo, demonstrada no arquivo de dados abaixo.

## Sidebar e conteúdo

`ChapterActivityNavigation` apresenta A e B no primeiro nível. C é um botão
nativo com `aria-expanded` e `aria-controls`, acionável por Enter/Space. Seus
Labs ficam em lista aninhada e indentada, inicialmente expandida. A troca da
atividade ativa para um Lab reabre o grupo. Recolher manualmente o grupo não
desmonta o Lab ativo nem muda a seleção.

Cada atividade comunica Pendente, Em estudo ou Concluída, além da obrigatoriedade.
O grupo informa quantos Labs foram concluídos, contando os IDs no progresso
existente. Isso não cria nota nem critério de conclusão novos. O bloqueio continua
por capítulo: capítulos bloqueados não oferecem link e sua rota recusa acesso;
não há um bloqueio novo entre A, B e os Labs de um capítulo disponível.

`ChapterPlayer` usa a mesma ordem de apresentação na sidebar, nos blocos e em
Anterior/Próxima atividade. Os blocos recebem os prefixos correspondentes, incluindo
`Abrir bloco C.1`. Selecionar uma atividade mantém o foco dirigido ao seu título.
Somente o conteúdo selecionado é montado, como antes.

Cada Lab continua no mesmo ExerciseLab e repositório volátil, com a identidade
de tentativa já existente composta por curso/capítulo/atividade. Seis atividades
podem apontar para a mesma definição e manter respostas separadas. Nada foi
alterado no avaliador, proteção, fórmulas, gráficos ou debounce de 750 ms.
É necessário aguardar Salvo antes de sair para conservar o último snapshot.

## Demonstração e compatibilidade

Abra `/learn/chapter-navigation-demo/chapter/fundamentos`.
`data/courses/chapter-navigation-demo.ts` configura dois vídeos demonstrativos e
seis atividades Lab, com IDs distintos. Os vídeos usam placeholders sem mídia
carregada automaticamente. Os seis Labs reutilizam o exercício neural real para
demonstrar navegação e isolamento; não representam seis exercícios inéditos.

Na entrega inicial, o curso `/learn/neural-demo` manteve sua navegação legada.
Em ajuste posterior, recebeu a mesma metadata A/B/C, preservando as atividades
e obrigatórias anteriores como descrito em `CHAPTER_NAVIGATION_STANDARD.md`.
Outros cursos podem adotar a mesma metadata.
A visão geral continua mostrando somente capítulos, estados e descrição breve;
nenhum componente, estilo ou regra dessa tela foi modificado.

## Acessibilidade e layout

Identificadores A/B/C.1 fazem parte do nome acessível dos novos controles.
Botões nativos, `aria-current`, texto de estado e foco visível complementam cores.
O grupo possui ID único e os itens recolhidos saem da sequência de teclado.
Recolher/expandir a sidebar inteira continua funcionando sem perder seleção.
Em notebooks, a sidebar mantém sua rolagem interna para alcançar todos os Labs.
Não há certificação com leitor de tela real ou otimização específica de smartphone.

## Arquivos

Criados: `lib/learn/chapter-navigation.ts`,
`components/learn/ChapterActivityNavigation.tsx`,
`data/courses/chapter-navigation-demo.ts`, `tests/chapter-navigation.spec.ts`,
`tests/chapter-navigation-ui.spec.ts` e este documento.

Modificados: `types/course.ts`, `lib/studio/courseDraft.ts`,
`components/studio/courses/ActivityForm.tsx` (preservação de metadata),
`components/learn/ChapterSidebar.tsx`, `ChapterPlayer.tsx`,
`ChapterActivitySection.tsx`, `LearnSession.tsx` e `app/learn/learn.css`
(somente estilos da sidebar interna).

## Testes

Quatro casos de modelo cobrem ordem declarativa independente do array, ausência
de mutação, zero/um/seis/nove Labs, títulos reais, compatibilidade de tipos,
conteúdo complementar, legado e preservação do progresso.

Cinco casos de navegador cobrem A/B/C, os seis Labs, Enter/Space, expansão ao
trocar de Lab, identificação/foco no conteúdo, aprovação real, contagem agregada,
isolamento/recuperação de fórmula e nota, proteção, localStorage inalterado,
visão geral sem atividades e layouts 1440×1000, 1366×768 e 1024×768.

A primeira execução nova identificou que prefixos decorativos não apareciam no
nome acessível dos controles. Os prefixos dos grupos passaram a ser anunciados;
os nove casos focados passaram após a correção. Na inspeção das capturas,
foi acrescentada espera pela largura final da transição de expansão antes de
capturar, além de verificar foco e acesso ao sexto Lab pela rolagem interna.
Nenhum teste anterior ou timeout foi alterado.

### Resultados finais

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **208 aprovados, 0 falhos**, 199 anteriores + 9 novos; aproximadamente 3,6 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; mesmas rotas e endpoints. |
| Layouts | 1440×1000, 1366×768 e 1024×768 inspecionados; hierarquia, foco, rolagem interna e expansão preservados, sem rolagem horizontal da página. |
| Isolamento | Lab 1 aprovado e recuperado; Lab 2 inicialmente vazio; grupo mostra 1/6; localStorage do aluno permanece inalterado. |

Execução com Chrome e renderização por software, build de produção temporário
na porta 3001 e harness existente na 3002. Os servidores temporários foram
encerrados; o servidor e a sessão do usuário em 3000 foram preservados. Capturas
em `test-results/chapter-navigation-{1440,1366,1024}.png`. Os 199 testes anteriores
foram executados integralmente, sem alteração de suas asserções ou timeouts.

## Como conferir

1. Execute `npm.cmd run dev` e abra a demonstração pelo endereço acima.
2. Selecione A e B: o renderer de vídeo mostra a atividade correspondente.
3. Recolha C com Space e expanda com Enter. Abra C.1 e depois C.2.
4. Em C.1, edite respostas em Treinamento e aguarde Salvo. C.2 deve começar vazio;
   ao voltar a C.1, sua fórmula permanece. Aprovação aumenta a contagem do grupo.
5. Recolha/expanda a sidebar inteira; seleção e Lab permanecem. Volte à visão
   geral: apenas capítulos aparecem. O curso neural anterior continua disponível.

Progresso e respostas deste ambiente continuam apenas em memória por sessão.
Refresh descarta a sessão. Não foram implementados backend, autenticação,
publicação, persistência nova, outro motor ou uma etapa funcional posterior.
