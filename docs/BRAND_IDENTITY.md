# Identidade visual — logo BI.Society

## Asset oficial

Origem fornecida: `C:/0_Cesar/16 - bisociety-identidade-visual (1)/bi-society.png`.
Cópia pública: `public/images/brand/bi-society-logo.png`.
URL exclusiva no componente: `/images/brand/bi-society-logo.png`.

O original foi preservado; a cópia é idêntica, sem recorte, redesenho, filtros,
remoção de fundo, base64 ou mudança de cores. Dimensões: 4000 × 4000 px; tamanho:
181.517 bytes. SHA-256:
`d66ec9a2c164547c8683c475729c437247556e67ce78b59c6bb411c5fb00fb1a`.

A inspeção do canal alfa confirmou transparência real (PNG RGBA, alfa entre 0 e
255, não opaco). O preto mostrado pelo visualizador não é fundo preto embutido.
Uma base branca no elemento de imagem mantém o desenho azul legível nos headers
escuros; o arquivo não foi alterado. Em headers brancos, a base se integra ao fundo.

## Componente compartilhado

`components/brand/BrandLogo.tsx` centraliza imagem, dimensões intrínsecas, texto
alternativo `BI.Society` e identificação opcional do ambiente:

```tsx
<BrandLogo />
<BrandLogo environment="Studio" />
<BrandLogo environment="ACADEMY" />
```

O componente renderiza somente o logo completo fornecido. Nenhum símbolo compacto
foi extraído do PNG. Outras variantes encontradas junto ao original não foram
adotadas nesta tarefa; um asset compacto aprovado poderá ser integrado depois.
O termo do ambiente fica em texto separado, sem editar o wordmark.

Não havia uso de `next/image` no código da aplicação. Foi mantido `<img>` nativo,
com configuração centralizada e dimensões explícitas, sem nova dependência ou
pipeline de transformação. CSS usa altura de 58 px (52 px até 1100 px), largura
automática, proporção quadrada e `object-fit: contain`. A imagem não é escondida
de tecnologia assistiva nem recebe alt redundante com outro texto BI.Society.
Links mantêm seus destinos e foco visível.

## Inventário e aplicação

| Ponto | Tratamento |
| --- | --- |
| `StudentHeader` em `/learn`, visão geral e capítulo | Remove o símbolo BI. e wordmark textual; usa BrandLogo com ACADEMY separado. Curso, divisor, perfil e progresso preservados. |
| Header de `/` | Logo oficial com identificação Lab. |
| Layout de `/studio/import`, incluindo preview | Logo oficial com Studio separado. |
| Layout de `/studio/courses`, criação e edição de curso | Mesmo componente dentro do link existente. |
| `StudioToolbar` do editor com exercício aberto | Logo oficial com Studio e indicação Professor; ações e estado de autoria preservados. |
| Título BI.Society Lab em `ExerciseLab` | Mantido como título do produto; não recebeu outro logo, conforme escopo de preservar o Lab. |
| H1 BI.Society Studio da importação | Mantido como título da página, sem segundo logo. |
| Rodapés, descrições, instruções, botões e metadata | Referências textuais institucionais mantidas; não representam fallbacks gráficos. |

Não foram implementados `/admin`, login ou outro ambiente. Admin/Login futuros
devem importar BrandLogo em seu cabeçalho e definir o ambiente em texto separado,
sem duplicar o caminho/configuração da imagem. O componente não depende de curso,
sessão, autenticação ou lógica do Studio.

## Arquivos

Criados: asset público, `components/brand/BrandLogo.tsx`,
`tests/brand-identity.spec.tsx` e este documento.

Modificados: `StudentHeader.tsx`, `StudioToolbar.tsx`, `app/page.tsx`, layouts de
importação e cursos do Studio e `app/globals.css`. O editor recebeu somente a
marca em sua toolbar; `StudioLabEditor`, `ExerciseLab`, progresso, importador,
persistência, definições e regras não foram alterados.

## Limitações do arquivo

O arquivo é um lockup vertical/quadrado com margens internas. Preservado inteiro
na altura disponível, seu wordmark é pequeno. Não foi recortado, ampliado com
overflow ou substituído por uma recriação textual. Uma versão horizontal oficial
e um símbolo compacto aprovado seriam adequados para uma futura revisão.
Não há certificação de acessibilidade com leitores de tela reais; as verificações
usam nome acessível, foco por teclado e layout no Chrome.

## Verificação da entrega

| Verificação | Resultado |
| --- | --- |
| `npm test -- --workers=2` | **193 aprovados, 0 falhos**; 189 anteriores intactos + 4 novos, aproximadamente 2,8 minutos, sem retries. |
| `npm run typecheck` | Sucesso. |
| `npm run build` | Sucesso; rotas/API preservadas. |
| Asset | PNG servido com HTTP 200, tipo correto e SHA-256 igual ao original. |
| 1440×1000, 1366×768, 1024×768 | Aluno, capítulo, importação, cursos, Lab e editor real com logo carregado; proporção preservada, sem rolagem horizontal. |
| Acessibilidade | Alt BI.Society, nome do link com ambiente e foco de 2 px preservados. |

O teste novo confere a cópia pública contra o hash verificado do original, sem
depender do diretório Windows em outras máquinas. Exercita também o componente
genérico com ambientes distintos, sem criar páginas Admin/Login. As regressões de
layout verificam imagem completa/carregada, dimensões, object-fit, posição dentro
do header, separação do título do curso, teclado, navegação e o mesmo editor após
importar a fixture controlada. Capturas em `test-results/brand-{largura}-{0..4}.png`
e `test-results/brand-{largura}-editor.png`; páginas do aluno/Studio e editor foram
inspecionados visualmente.

Chrome com renderização por software, produção temporária na porta 3001 e harness
existente na 3002. Servidores temporários encerrados ao concluir; servidor/sessão
do usuário em 3000 preservados. Nenhuma dependência adicionada, nenhum teste
anterior removido ou alterado e nenhuma regra funcional modificada.

Para conferir manualmente, execute `npm.cmd run dev` e abra
`http://localhost:3000/learn/neural-demo`, entre no primeiro capítulo e visite
`/studio/import` ou `/studio/courses`. Após importar uma planilha, o editor também
deve mostrar o logo com Studio. Esta entrega termina no ajuste da marca.
