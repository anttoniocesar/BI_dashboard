# Player de YouTube no Studio e Learn

## Diagnóstico e implementação

O Studio já aceitava URLs HTTP/HTTPS e preservava o endereço fornecido pelo
professor. O `VideoActivityCard`, usado pelo `ActivityRenderer` tanto no preview
quanto no Learn, só reconhecia arquivos diretos HTTPS. Por isso Shorts e links
comuns de YouTube caíam no placeholder.

`parseVideoSource`, em `lib/learn/content.ts`, agora classifica o endereço como
`youtube`, `file` ou `unknown`. O modelo continua armazenando a URL original.
Links existentes passam pelo mesmo parser ao renderizar, sem migração de dados.

Os formatos `watch?v=`, `youtu.be/`, `shorts/`, `embed/` e `live/` são reconhecidos
em hosts explicitamente permitidos. O ID deve conter exatamente 11 caracteres
ASCII alfanuméricos, `_` ou `-`. O iframe recebe somente a URL construída
`https://www.youtube.com/embed/VIDEO_ID`. Parâmetros e fragmentos da URL de entrada
não são copiados para o iframe, inclusive autoplay e rastreamento. A URL original
permanece disponível no link externo.

URLs sem HTTPS, credenciais embutidas, esquemas executáveis, hosts semelhantes
e IDs inválidos não geram iframe. Endereços HTTPS desconhecidos mantêm o fallback
e um link com `target="_blank"` e `rel="noopener noreferrer"`. O HTML fornecido
pelo professor nunca é interpretado; não há `dangerouslySetInnerHTML`.

O iframe possui título, lazy loading, fullscreen, permissões de mídia e
`referrerPolicy="strict-origin-when-cross-origin"`. A URL e os atributos seguem a
[documentação oficial de incorporação do YouTube](https://developers.google.com/youtube/player_parameters).
O layout usa largura de 100%, proporção 16:9 e altura mínima de 200 px para manter
o player utilizável em telas estreitas. Shorts usam o mesmo container neste MVP.

Arquivos `.mp4`, `.webm` e `.ogg` HTTPS continuam usando `<video controls>`, com
carregamento solicitado pelo usuário. Falhas de mídia têm fallback e link para
abrir o arquivo. Ao trocar a URL, o estado de carregamento/erro é reiniciado.
O botão Assistir novamente reinicia o arquivo ou recarrega o iframe.

O formulário do Studio agora informa que aceita YouTube e arquivos diretos,
sem pedir conversão manual. Não houve alteração em progresso, botão Concluir
atividade, CourseAccess, Monitoring, repositórios, tentativas ou autosave do Lab.
Abrir, assistir ou terminar o vídeo não conclui automaticamente a atividade.

## Caso informado e limites de verificação

Entrada: `https://www.youtube.com/shorts/tuBZqgp9TD0`.

Embed: `https://www.youtube.com/embed/tuBZqgp9TD0`.

O curso existente do usuário não estava disponível nos dados locais. O teste
de ponta a ponta cria um curso isolado chamado **Curso Teste Completo**, cadastra
**Video aula** com essa URL exata pelo Studio, verifica o preview, publica e libera
acesso pelo Admin e então confere o mesmo iframe no Learn como aluno.
Nenhum registro de curso hospedado foi alterado para realizar a verificação.

O endpoint público oEmbed do YouTube respondeu HTTP 200 para esse ID e devolveu
o mesmo embed. Os testes automatizados interceptam o documento externo do iframe:
validam nossa integração, atributos e layout, sem depender da rede ou do conteúdo
do YouTube. Isso não equivale a verificar reprodução audiovisual de ponta a ponta.

Na tentativa adicional de reprodução externa, tanto o Chromium quanto o Chrome
de teste foram redirecionados pela rede corporativa para autenticação Zscaler.
O navegador novo não conseguiu concluir essa autenticação dentro do iframe.
Portanto, som/imagem do vídeo real não foram confirmados nesta sessão; a
incorporação precisa ser conferida em um navegador com acesso ao YouTube.

Capturas locais com o documento externo controlado foram inspecionadas em
`test-results/youtube-shorts-learn-1440.png` e
`test-results/youtube-shorts-learn-390.png`, sem overflow horizontal.

## Testes e conferência manual

- `tests/video-source.spec.tsx`: nove variações de YouTube, parâmetros adicionais,
  IDs inválidos, hosts falsos, URLs perigosas, arquivos diretos, fallback seguro,
  atributos do iframe e ausência de injeção de HTML.
- `tests/youtube-player-ui.spec.ts`: cadastro no Studio, URL original preservada,
  preview e Learn compartilhados, Shorts informado, desktop/mobile, progresso
  manual, replay e manutenção do player MP4/fallback.
- `tests/learn-ui.spec.ts`: o caso demonstrativo de URL desconhecida agora exige
  a nova mensagem amigável; as verificações anteriores de ausência de iframe e
  de requisições externas nesse caso foram mantidas.

Para conferir no curso existente, abra **Video aula** no **Curso Teste Completo**
no preview e no Learn. O iframe deve apontar para o embed acima e mostrar o player
do YouTube. Pressione Play e confira som/imagem, fullscreen e tela mobile. O
progresso deve permanecer inalterado até clicar em **Concluir atividade**.

As verificações locais usam Node portátil, Chromium do Playwright e preview demo
interno na porta 3001, com harness na 3002, como nas verificações anteriores.

```powershell
$env:NEXT_PUBLIC_DATA_MODE = "demo"
$env:BI_SOCIETY_ALLOW_DEMO_PREVIEW = "1"
npm.cmd run typecheck
npm.cmd run build
npm.cmd start -- --hostname localhost --port 3001
```

Em outro terminal, com o preview aberto:

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
npm.cmd test -- --workers=2
```

Se usar o navegador instalado em `.tools/playwright-browsers`, configure também
`PLAYWRIGHT_BROWSERS_PATH` com o caminho absoluto desse diretório. As flags demo
acima são apenas para verificação local.

## Resultados em 25/10/2026

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test -- --workers=2` no preview de produção | **351 aprovados, zero falhas**, em 4,6 minutos: 335 anteriores e 16 novos; inclui integração Supabase controlada. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run build` | Aprovado com configuração de preview demo interno. |
| Shorts informado no preview e Learn | Embed correto, URL original preservada, 1440/390 px sem overflow e progresso apenas manual. Documento externo do iframe controlado nos testes. |
| Consulta pública ao oEmbed do vídeo | HTTP 200; YouTube devolveu o mesmo ID e URL de incorporação. |
| Reprodução externa real | Não confirmada: navegador de teste redirecionado pela rede corporativa à autenticação Zscaler. |

Artefato da suíte completa: `test-results/.last-run.json` com status `passed` e
nenhum teste falho. Nenhuma dependência ou lockfile foi alterado. Os navegadores
e servidores temporários destas verificações foram encerrados ao final.
