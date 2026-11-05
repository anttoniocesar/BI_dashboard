# Checklist pré-piloto BI.Society

Situação inicial: preparação local; host e Supabase hospedado ainda não criados.
Responsável operacional: preencher. Curso: `neural-pilot`. Cohort: lista controlada
de alunos e vínculos existentes, sem nova entidade de turma.

## Infraestrutura e acesso

- [ ] Projeto Supabase do piloto separado, região/limites/operador definidos.
- [ ] Migrations 17–20, `202610240001_exercise_attempts.sql`,
      `202610240002_course_authoring.sql`, `202610240003_course_catalog_seed.sql`
      `202610260001_replace_activity_exercise.sql` e `202610260002_course_versions.sql`
      aplicadas por histórico, sem reset; seed de serviço aplicado, sem contas demo.
- [ ] Professor cria/salva curso e Lab; outro navegador/login recupera a autoria;
      preview de draft, publicação, liberação e acompanhamento aprovados.
- [ ] Primeiro Admin criado no Auth e role atribuída por SQL confiável.
- [ ] Professor real criado, senha definida pelo fluxo oficial, role Teacher ativa.
- [ ] Professor associado a `neural-pilot` via Admin.
- [ ] Cada aluno criado, role Student, matrícula ativa, Curso Avulso e CourseAccess.
- [ ] Link de definição de senha entregue e login confirmado por cada aluno.
- [ ] SMTP, Site URL, allowlist de redirect e template recovery configurados.
- [ ] Domínio HTTPS e proxy/host configurados, sem flag demo preview.
- [ ] Variáveis de produção conferidas em build e runtime, sem segredos públicos.
- [ ] WAF/rate limiting do host e limites Supabase Auth revisados para a turma.

## Conteúdo e persistência

- [ ] Curso canônico `neural-pilot` revisado no deploy, capítulos e Labs disponíveis.
- [ ] Edição textual sem vídeos aceita pelo professor, ou URLs reais HTTPS testadas.
- [ ] Materiais/arquivos revisados; nenhum link de exemplo ou arquivo indisponível.
- [ ] Lab: fórmula, abas, proteção, gráfico e avaliação aprovados.
- [ ] Arquivo XLSX do professor: upload real, limites, merges, revisão e Editor aprovados.
- [ ] Aluno A preenche Lab, aguarda Salvo, fecha browser, reabre, entra e recupera.
- [ ] C.1 e C.2 preservam respostas independentes; reset só afeta o Lab ativo.
- [ ] Aluno B não vê respostas, progresso ou identidade de A.
- [ ] Progresso confirmado persiste e professor vê o mesmo avanço no Monitoring.
- [ ] Backup confirmado e restauração em projeto separado testada/documentada.

## Liberação operacional

- [ ] `/api/health` 200 e `/api/ready` 200 no domínio publicado.
- [ ] `test:production-smoke` aprovado com conta dedicada no domínio real.
- [ ] Credenciais de teste guardadas fora do Git; relatório sem dados sensíveis.
- [ ] Responsável e contato de suporte da aula definidos; procedimento de incidente lido.
- [ ] Versão do deploy, migrations, lista de alunos e horário da aula registrados.
- [ ] Operador autoriza iniciar o piloto após concluir todos os itens anteriores.

Referência: [ETAPA22_PRODUCTION_MVP.md](ETAPA22_PRODUCTION_MVP.md).
