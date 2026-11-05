# Operação da aula — piloto BI.Society

Preencher antes da turma: domínio, projeto Supabase, professor, Admin de suporte,
data/horário, versão do deploy, matrícula da conta de teste e contato de suporte.
Senhas e chaves ficam no gerenciador de segredos; não nesta ficha.

## Antes da aula

1. Confirme health/ready no domínio e execute o smoke da conta de teste.
2. Entre como professor: Studio mostra o curso associado e Monitoring abre a turma.
3. Confira a lista de matrículas/acessos pelo Admin, sem usar conta Admin na projeção.
4. Entre como aluno de teste: abra curso, capítulo, Lab, preencha uma resposta e
   aguarde Salvo. Reabra o navegador e confira recuperação; use somente essa conta.
5. Teste vídeo/material realmente configurado e o XLSX do professor, quando usados.
6. Confirme backup recente, status Supabase/host e possibilidade de voltar o deploy.

## Durante a aula

- Login: conferir email ou matrícula, status ativo e role. Não pedir senha do aluno.
  Se necessário, Admin usa Enviar link para definir senha ou aluno usa Esqueci minha
  senha. Conferir spam e entrega SMTP; não enviar senha manual em chat/lista de turma.
- Curso ausente: conferir matrícula, serviço, CourseAccess e existência no catálogo
  publicado. Conceder acesso pelo Admin, nunca editar identidade no navegador.
- Resposta não recuperada: não preencher o mestre por cima de erro de carga. Usar
  Tentar carregar novamente; conferir usuário, curso, atividade e versão. Registrar
  horário/rota e status do serviço, sem copiar conteúdo completo de tentativa.
- Falha ao salvar: manter a aba aberta; Tentar salvar novamente. Pedir que aguarde
  Salvo antes de atualizar/sair. Em queda de rede, não prometer gravação no fechamento.
- Reset: no Lab ativo, Reiniciar planilha → confirmar. Limpa só aquela tentativa;
  não desfaz conclusão de curso nem apaga C.2, outras versões ou colegas.
- Acompanhar: professor abre Monitoring, busca matrícula e atualiza a página para
  consultar o progresso confirmado. Ausência de tempo real não significa perda.
- Incidente amplo: interromper novas tentativas, comunicar a turma e preservar abas.
  Operador confere health/ready e logs restritos. Não resetar banco nem limpar storage.

## Depois da aula

1. Confirme o progresso da turma com o professor e registre problemas sem respostas
   privadas, tokens ou senhas. Identificadores acadêmicos ficam em registro restrito.
2. Confira falhas de API/autorização/persistência, status do host e backup diário.
3. Antes de alterar um Lab publicado, salve nova versão no Studio e crie outra
   atividade; preserve a atividade/versão antiga e suas tentativas. Alterações
   válidas de texto/título em curso publicado ficam disponíveis ao salvar.
4. Se houver rollback, preserve tentativas e reverta só o deploy compatível. Para
   restaurar banco, siga o teste de restauração em ambiente separado e aprovação
   operacional descritos na documentação; não improvisar SQL destrutivo na aula.
5. Registre versão usada, itens pendentes e decisão sobre a próxima aula.

Veja [PILOT_CHECKLIST.md](PILOT_CHECKLIST.md) e
[ETAPA22_PRODUCTION_MVP.md](ETAPA22_PRODUCTION_MVP.md).
