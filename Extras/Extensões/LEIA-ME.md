# Extensões da comunidade do DarkStudio

Esta pasta é o ponto de organização para propostas de extensões criadas por fãs e colaboradores. **Adicionar um arquivo aqui não o torna uma extensão oficial e não faz seu código ser executado automaticamente.**

## Como enviar uma extensão

1. Crie um arquivo JSON baseado em `Modelo.dsx.json`.
2. Use um identificador único e estável, como `comunidade.nome-da-extensao`.
3. Descreva claramente o que a extensão faz e quais permissões/capacidades utiliza.
4. Teste a extensão no ambiente de desenvolvimento e confira o contrato em `Extras/Extensions/API.md`.
5. Envie uma Pull Request contendo o arquivo e uma descrição do comportamento, dos testes e de qualquer acesso a DOM, rede ou dados.
6. Aguarde a revisão. Não inclua segredos, tokens, credenciais ou código que colete dados sem necessidade e transparência.

## Processo de aprovação

- O mantenedor revisa o código, a segurança, o impacto na interface e a compatibilidade.
- Propostas não aprovadas não devem ser publicadas como extensões oficiais.
- A lista `Catalogo.json` é apenas um índice informativo de propostas e não autoriza a execução de seus arquivos.
- Somente após aprovação explícita do mantenedor uma extensão deve ser integrada ao catálogo oficial e disponibilizada aos usuários.
- Não trate uma extensão de terceiros como confiável apenas porque está no repositório. Revise o conteúdo antes de aprovar.

## Arquivos desta pasta

- `Modelo.dsx.json`: estrutura inicial para novas propostas.
- `Catalogo.json`: lista informativa de contribuições em análise; não instala nem executa código.
