# Contribuindo para o DarkStudio

Leia também [`AI.md`](../AI.md) antes de alterar o projeto.

## Regra central

`main` é a base estável. Cada tarefa deve ser isolada em sua própria branch e Pull Request (PR). Nenhum agente deve fazer merge, apagar branches ou executar force push sem autorização explícita do mantenedor.

## Fluxo de trabalho

1. **Verifique o estado atual.** Leia `AI.md`, examine os arquivos envolvidos, branches e PRs abertos. Não presuma que a branch de outra pessoa está pronta ou que uma PR foi integrada.
2. **Comece de `main`.** Crie uma branch nova a partir da versão mais recente de `main`; não use a branch de outra tarefa como base, salvo dependência explícita e documentada.
3. **Use um nome descritivo.** Exemplos: `fix/nightcoder-composer`, `perf/startup`, `docs/git-workflow`, `test/javascript-syntax`.
4. **Mantenha o escopo pequeno.** Um objetivo coerente por branch/PR. Não inclua formatação ou refatoração não relacionada.
5. **Evite colisões entre agentes.** Antes de editar, confira PRs e arquivos já em trabalho. Se dois agentes precisarem alterar o mesmo arquivo, combine a sequência ou divida o trabalho; não sobrescreva alterações alheias.
6. **Valide antes de publicar.** Execute as verificações disponíveis, revise o diff e informe o que foi e o que não foi testado.
7. **Abra uma PR para `main`.** Use o modelo em `.github/pull_request_template.md`. PRs incompletas devem ser marcadas como Draft.
8. **Aguarde revisão.** O responsável pelo projeto decide quando integrar. Não faça merge, não apague branches e não force push sem autorização explícita.
9. **Após a integração, sincronize com cuidado.** Atualize referências remotas e crie a próxima branch a partir de `main`. Não use reset destrutivo nem reescreva histórico compartilhado.

## Commits e histórico legível

- Prefira mensagens curtas e específicas, por exemplo `fix: keep NightCoder composer aligned`.
- Agrupe somente alterações que pertençam à mesma tarefa.
- Não crie commits vazios ou commits de merge apenas para sincronizar uma branch.
- Não faça rebase de branches compartilhadas sem combinar com quem trabalha nelas.
- Quando o mantenedor integrar a PR, prefira **Squash and merge** para manter `main` linear e condensar o trabalho em um commit por PR, se isso estiver disponível e fizer sentido para a tarefa. Essa é uma recomendação, não uma autorização para fazer merge.
- Não force push para “limpar” o gráfico. Uma visualização com linhas cruzadas não significa, por si só, que o histórico está quebrado.

## Coordenação de múltiplos agentes

Cada agente deve anunciar no início do trabalho: objetivo, branch, arquivos que pretende alterar e dependências conhecidas. Antes de concluir, registrar commit/PR e limitações de teste. Não confiar apenas em mensagens de conversa: verificar o estado real no GitHub.

Se uma tarefa depender de outra PR ainda não integrada, documente a dependência e peça revisão ao mantenedor antes de encadear branches. Evite PRs baseadas em outras PRs, pois isso torna a revisão e a integração mais difíceis.

## Verificações

O workflow `.github/workflows/validate-js.yml` verifica a sintaxe de arquivos JavaScript e módulos rastreados pelo Git. Essa checagem não substitui testes de navegador, testes funcionais ou revisão de segurança.

Não declare testes como aprovados se não foram executados. Documente falhas e verificações pendentes na PR.
