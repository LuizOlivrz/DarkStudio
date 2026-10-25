# AI.md — Guia de colaboração para IAs no DarkStudio
| 2026-10-24 22:45 (UTC-03:00) | ChatGPT — GPT-6 | Remove o botão Extensions da Estação de Arquivos, mantendo a tela de extensões acessível pelo fluxo existente do SVG do mapa. | PR #33 |
| 2026-10-24 22:35 (UTC-03:00) | ChatGPT — GPT-6 | Renomeia os rótulos visíveis do Debugger para Depurador, altera a aba expansível para Arquivo atual e atualiza o botão para Executar/Depurar (Arquivo atual). | PR #33 |
| 2026-10-24 22:20 (UTC-03:00) | ChatGPT — GPT-6 | Faz o SVG do Mapa do Workspace abrir a mesma tela de Extensões do botão existente; oculta o painel #options e expande #main-content sobre a área das opções e do editor. | PR #33 |

> **Objetivo:** permitir que qualquer assistente de IA entenda como contribuir para o DarkStudio com autonomia, mantendo rastreabilidade, segurança e compatibilidade com o que já existe.
>
> **Idioma preferido:** português do Brasil. Código, nomes técnicos, mensagens de commit e documentação podem usar inglês quando fizer sentido.

## 1. Missão do projeto

O **DarkStudio** é um ambiente de desenvolvimento web que funciona no navegador, com editor baseado no Monaco Editor, recursos para carregar/baixar e executar código compatível, assistente de IA NightCoder, Mind Map, sistema de extensões, temas, personalização e interface multilíngue.

- Repositório: https://github.com/LuizOlivrz/DarkStudio
- Aplicação publicada: https://darkstudio-code.netlify.app/
- Branch estável: `main`
- Documentação geral: [README.md](README.md)
- Documentação da API de extensões: [Extras/Extensions/API.md](Extras/Extensions/API.md)

A missão técnica é tornar o DarkStudio **mais confiável, seguro, acessível, rápido, fácil de manter e ampliar**, sem perder as funcionalidades que o tornam único.

## 2. Autonomia para as IAs

Você tem liberdade para investigar, propor e implementar correções, refatorações, otimizações e funcionalidades novas. Não precisa pedir autorização para cada alteração pequena e reversível dentro da tarefa.

**Autonomia não significa alterar às cegas.** Para mudanças amplas, invasivas ou que possam remover comportamento existente:
1. Inspecione primeiro o código e suas dependências.
2. Entenda o comportamento atual e identifique quem depende dele.
3. Escolha uma implementação coerente, mesmo que exija reorganizar código, quando houver benefício real.
4. Registre riscos e limitações; valide o resultado.
5. Preserve o comportamento existente, a menos que a tarefa peça explicitamente para mudá-lo ou que uma correção exija isso. Se houver quebra intencional, explique-a.

Não fique apenas sugerindo melhorias quando tiver ferramentas para executá-las. Implemente o que for seguro e pertinente, documente o que fez e deixe claro o que ainda precisa ser validado.

## 3. Regras essenciais

- **Leia antes de editar.** Consulte este arquivo, o README, os arquivos relacionados e as configurações de build/deploy existentes.
- **Não presuma.** Confirme no código se uma funcionalidade existe, está incompleta, é simulada ou depende de serviço externo.
- **Evite reescritas desnecessárias.** Prefira mudanças focadas, mas não mantenha uma arquitetura ruim só por medo de refatorar.
- **Não remova funcionalidades silenciosamente.** Preserve fluxos, atalhos, preferências, traduções, compatibilidade e comportamento responsivo.
- **Não invente resultados de testes.** Informe exatamente o que executou, o que passou, o que falhou e o que não conseguiu testar.
- **Não esconda limitações.** Diferencie comportamento confirmado, hipótese, proposta e implementação concluída.
- **Evite dependências novas sem necessidade.** Avalie tamanho, manutenção, segurança, licença e impacto no carregamento.
- **Mantenha as mudanças revisáveis.** Divida refatorações grandes em partes lógicas quando isso facilitar testes e revisão.
- **Não sobrescreva trabalho alheio.** Verifique o estado da branch e diffs antes de editar, rebasear ou resolver conflitos.
- **Não faça merge, não exclua branches e não force push sem autorização explícita do responsável pelo projeto.**

## 4. O que preservar

O README descreve estas funcionalidades existentes; confirme a implementação real antes de alterar cada uma:

- Editor baseado no Monaco, realce de sintaxe, numeração de linhas, minimapa e personalização.
- Reconhecimento de linguagens e extensões de arquivo.
- Carregamento de arquivos locais, limpeza, download e execução/visualização para os formatos suportados.
- NightCoder, histórico de conversa e instruções personalizadas.
- Mind Map e suas conexões/itens.
- Instalação, ativação, desativação e isolamento de extensões `.dsx.json`; propostas comunitárias em `Extras/Extensões` não devem executar nem instalar automaticamente antes da revisão e aprovação do mantenedor.
- Temas, cores, fundos, preferências e personalização da interface.
- Traduções em português do Brasil, inglês e russo.
- Painel dinâmico e integrações externas, como clima, quando configuradas.
- Layout responsivo, central de ajuda e recursos de visualização de links.

O reconhecimento de sintaxe não garante execução de uma linguagem. Não prometa compilar ou executar uma linguagem sem verificar a implementação.

## 5. Como distinguir o que já existia do que foi adicionado

Antes de declarar uma funcionalidade como nova ou antiga, use evidências:

1. Consulte o código da branch atual.
2. Consulte o histórico de commits e compare com a branch-base, quando disponível.
3. Verifique README, documentação, testes e exemplos.
4. Registre a funcionalidade como uma destas categorias:
   - **Existente:** já estava implementada na base analisada.
   - **Correção:** comportamento existente corrigido.
   - **Refatoração/otimização:** implementação reorganizada ou melhorada, sem intenção de mudar o comportamento público.
   - **Nova funcionalidade:** comportamento novo introduzido pela alteração.
   - **Remoção/mudança incompatível:** comportamento retirado ou alterado intencionalmente; precisa ser explicitamente documentado.
   - **Não confirmado:** faltam evidências suficientes.

Não use apenas a memória de uma conversa para afirmar o estado atual do código. O repositório e seu histórico são a fonte de verdade.

## 6. Áreas importantes do projeto

A estrutura pode mudar; confirme os caminhos no repositório antes de confiar nesta lista.

| Caminho | Responsabilidade conhecida |
|---|---|
| `index.html` | Estrutura principal da aplicação |
| `Extras/Code/config.js` | Inicialização, configurações, idiomas e verificações de origem |
| `Extras/Code/main.js` | Funcionalidades centrais do editor |
| `Extras/Code/monaco.js` | Integração e configuração do Monaco Editor |
| `Extras/Code/AI.js` | Interface/integração do NightCoder no cliente |
| `netlify/functions/nightcoder.mjs` | Proxy de backend do NightCoder, se presente na branch |
| `Extras/Code/mindmap.js` | Espaço de trabalho visual/Mind Map |
| `Extras/Code/extensions.js` | Gerenciamento e execução de extensões |
| `Extras/Code/dark.css` | Estilos principais |
| `Extras/Code/mobile.css` | Estilos responsivos |
| `Extras/Extensions/API.md` | Contrato/documentação para extensões |
| `Extras/languages/` | Traduções |
| `Extras/Themes/` | Temas |

Não presuma que esta lista é completa nem que todos os caminhos existem em todas as branches.

## 7. Segurança e privacidade

- **Nunca** adicione API keys, tokens, senhas, cookies, credenciais ou dados pessoais ao código, commits, logs, testes, documentação ou respostas.
- Segredos usados no backend devem vir de variáveis de ambiente configuradas no provedor de hospedagem, por exemplo `GROQ_API_KEY` para a integração NightCoder, se essa integração estiver presente.
- Variáveis expostas ao navegador não são segredos. Não coloque credenciais privadas em JavaScript entregue ao cliente.
- Se encontrar uma credencial exposta, não a copie para este arquivo nem a reproduza em relatórios. Avise que ela precisa ser revogada/rotacionada; remover o texto do código não invalida a credencial.
- Valide dados de entrada no servidor: método HTTP, tamanho, estrutura, tipos e limites razoáveis.
- Não confie apenas em CORS/origem como autenticação ou proteção contra abuso.
- Evite registrar conteúdo de chats, código privado, tokens ou dados sensíveis.
- Ao executar código fornecido pelo usuário ou extensões, avalie isolamento, permissões, acesso à rede, DOM e armazenamento.
- Não enfraqueça políticas de segurança para facilitar testes. Separe configuração de desenvolvimento da configuração de produção.
- Não alegue que um iframe, sandbox ou controle é seguro sem verificar as permissões e os caminhos de escape.

## 8. Performance, qualidade e compatibilidade

Ao otimizar:
- Identifique o custo real antes de adicionar cache, lazy loading, paralelismo ou complexidade.
- Evite bloquear a inicialização com recursos opcionais que podem carregar em segundo plano.
- Limpe event listeners, timers, observers e URLs de objetos quando deixarem de ser necessários.
- Evite requisições de rede redundantes e processamento repetido.
- Trate falhas de rede, respostas inválidas, ausência de APIs e carregamento parcial sem derrubar toda a aplicação.
- Mantenha acessibilidade básica: teclado, foco visível, rótulos, contraste e mensagens de erro compreensíveis.
- Teste tamanhos de tela e navegadores relevantes quando possível.
- Preserve compatibilidade com os navegadores pretendidos pelo projeto; confirme antes de introduzir APIs modernas ou dependências que possam excluir usuários.

## 9. Fluxo de Git e colaboração

Fluxo preferido:
1. Atualize e examine a branch-base.
2. Crie uma branch de trabalho com nome descritivo, por exemplo `fix/editor-download`, `perf/startup`, `security/nightcoder-proxy` ou `docs/ai-guide`.
3. Faça alterações relacionadas à tarefa; evite misturar refatorações não relacionadas.
4. Execute as verificações disponíveis e examine o diff final.
5. Faça commits com mensagens claras.
6. Abra uma Pull Request para `main`, descrevendo objetivo, arquivos, riscos, testes e passos de validação manual.
7. Deixe a revisão/merge para o responsável, salvo autorização explícita em contrário.

Não presuma que rulesets ou proteções de branch estão efetivamente aplicados: confira o estado atual do GitHub. Uma regra que o GitHub informa não ser aplicada não oferece proteção real.

## 10. Testes e verificação

Antes de concluir uma alteração, conforme o escopo:
- Verifique sintaxe JavaScript e erros óbvios.
- Execute os scripts de teste, lint ou build existentes; primeiro descubra quais estão configurados.
- Teste carregamento inicial e console do navegador.
- Teste a função alterada e os fluxos próximos que possam ter sido afetados.
- Para alterações no editor, considere abrir/editar, carregar, executar e baixar arquivos compatíveis.
- Para NightCoder, teste erros HTTP, histórico, limites de entrada e configuração ausente de segredo sem revelar credenciais.
- Para extensões, teste instalação, ativação/desativação, erros e isolamento.
- Revise responsividade e traduções quando a interface for alterada.
- Inspecione o diff para encontrar alterações acidentais, arquivos gerados, segredos ou código de depuração.

Se não houver testes automatizados, não invente um resultado. Registre que a validação foi manual ou ficou pendente. Adicione testes quando isso for viável e útil.

## 11. Como relatar cada contribuição

Ao finalizar uma tarefa, deixe um resumo objetivo com:

- **Objetivo**
- **Arquivos alterados**
- **O que mudou e por quê**
- **Classificação:** existente, correção, refatoração/otimização, funcionalidade nova ou mudança incompatível
- **Testes executados e resultados**
- **Riscos, limitações e validações pendentes**
- **Branch, commit e Pull Request**, quando aplicável

Não diga “tudo funciona” se apenas uma parte foi testada.

## 12. Assinaturas e registro de alterações feitas por IAs

Toda IA que **alterar arquivos do projeto** deve adicionar uma nova linha ao final da tabela abaixo, de preferência no mesmo PR/commit da alteração. Não registre assinatura para uma mera conversa, leitura ou sugestão sem alteração de arquivos.

Formato obrigatório:

`AAAA-MM-DD HH:MM (UTC±HH:MM) | Nome do assistente/modelo | resumo curto | branch/commit/PR ou link`

- Use a data e a hora reais disponíveis no ambiente e informe o fuso horário.
- Escreva o nome do modelo com honestidade (ex.: ChatGPT — GPT-6, Claude — modelo identificado, GitHub Copilot — modelo identificado).
- Se o modelo exato não for conhecido, escreva **modelo não identificado**; não invente.
- Não altere, apague nem reescreva assinaturas antigas de outros agentes. Corrija somente a sua própria entrada se estiver errada.
- Inclua um link para o commit/PR quando disponível.
- O registro é uma declaração do agente, não uma prova criptográfica de autoria. O histórico de commits do GitHub é a fonte independente para verificar mudanças.
- Para evitar conflitos, acrescente uma linha ao final; não reorganize a tabela inteira.

### Registro

| Data e hora (com fuso) | Assistente/modelo | Resumo | Referência |
|---|---|---|---|
| 2026-10-19 10:50 (UTC-03:00) | ChatGPT — GPT-6 | Criou este guia inicial de colaboração e rastreabilidade para IAs; alteração limitada a `AI.md`. | Branch `docs/ai-contributor-guide`; commit/PR a vincular após criação. |
| 2026-10-19 17:34 (UTC-03:00) | ChatGPT — GPT-6 | Padronizou colaboração por branches/PRs, modelo de revisão e verificação automática de sintaxe JavaScript. | Branch `chore/git-collaboration-workflow`; PR #9: https://github.com/LuizOlivrz/DarkStudio/pull/9 |
| 2026-10-19 19:57 (UTC-03:00) | ChatGPT — GPT-6 | Extrai a detecção de linguagem de `main.js` para `language-detection.js`; validação de sintaxe aprovada pelo GitHub Actions. | PR #10: https://github.com/LuizOlivrz/DarkStudio/pull/10 |
| 2026-10-19 19:58 (UTC-03:00) | ChatGPT — GPT-6 | Extrai constantes e utilitários de linguagem/extensão de `mindmap.js` para `workspace-language.js`. | PR #10: https://github.com/LuizOlivrz/DarkStudio/pull/10 |
| 2026-10-19 19:59 (UTC-03:00) | ChatGPT — GPT-6 | Extrai a lógica de redimensionamento dos painéis para `panel-resizers.js`, recebendo o contêiner por parâmetro. | PR #10: https://github.com/LuizOlivrz/DarkStudio/pull/10 |

| 2026-10-22 10:20 (UTC-03:00) | ChatGPT — GPT-6 | Organiza a área de extensões da comunidade, move o manifesto de atualização para Extras e padroniza a pasta do desktop. | PR #13: https://github.com/LuizOlivrz/DarkStudio/pull/13 |
| 2026-10-23 10:00 (UTC-03:00) | ChatGPT — GPT-6 | Atualiza a visibilidade dos botões do editor ao abrir arquivos pelo Workspace. | Branch `fix/botoes-editor-ao-abrir-arquivo` |
| 2026-10-23 14:29 (UTC-03:00) | ChatGPT — GPT-6 | Corrige visibilidade dos botões, persistência de Workspaces grandes, origem local de desenvolvimento e ícone SVG. | PR #28: https://github.com/LuizOlivrz/DarkStudio/pull/28 |
| 2026-10-24 19:25 (UTC-03:00) | ChatGPT — GPT-6 | Combina a interface atual do Workspace com o botão de doações e a extração dos eventos inline para arquivos JavaScript. | PR #29: https://github.com/LuizOlivrz/DarkStudio/pull/29 |
| 2026-10-24 19:40 (UTC-03:00) | ChatGPT — GPT-6 | Adiciona janela de doação Pix com código Copia e Cola e ação para copiar, em módulo JavaScript separado. | Branch `feature/pix` |
| 2026-10-24 19:55 (UTC-03:00) | ChatGPT — GPT-6 | Corrige a inicialização do Monaco removendo a importação duplicada dos módulos de contribuição HTML/TypeScript, que provocava erro AMD e impedia a criação do editor. | PR #32 |
| 2026-10-24 20:46 (UTC-03:00) | ChatGPT — GPT-6 | Adiciona a navegação lateral entre Estação de Arquivos e Debugger, com ação de execução e aviso visual para linguagens ainda não suportadas. | PR #33 |
| 2026-10-24 21:10 (UTC-03:00) | ChatGPT — GPT-6 | Exibe a marca e “WorkSpace Vazio” quando não há arquivos no Explorer e ajusta o cabeçalho do Debugger para o estilo simples do Explorer. | PR #33 |
| 2026-10-24 21:25 (UTC-03:00) | ChatGPT — GPT-6 | Remove os botões legados de execução e Iframe e seus manipuladores, preservando o executor usado pelo Debugger. | PR #33 |
| 2026-10-24 21:35 (UTC-03:00) | ChatGPT — GPT-6 | Adiciona o ícone SVG do Mapa do Workspace entre Estação de Arquivos e Debugger na barra lateral. | PR #33 |
| 2026-10-24 21:45 (UTC-03:00) | ChatGPT — GPT-6 | Remove o botão Limpar editor e seu evento; padroniza o botão de execução do Debugger e conecta o SVG do mapa à troca entre mapa e painel de opções, mantendo a seleção até outro SVG ser clicado. | PR #33 |

## 13. Checklist rápido antes de enviar uma PR

- [ ] Li este guia e os arquivos relacionados.
- [ ] Confirmei o comportamento atual antes de modificar.
- [ ] Preservei funcionalidades existentes ou documentei mudanças intencionais.
- [ ] Não incluí segredos nem dados sensíveis.
- [ ] Revisei o diff e removi alterações acidentais.
- [ ] Executei as verificações possíveis e registrei resultados reais.
- [ ] Atualizei a documentação necessária.
- [ ] Adicionei minha assinatura ao registro se alterei arquivos do projeto.
- [ ] Descrevi riscos e validações pendentes na PR.

---

**Regra final:** explore, experimente e melhore o DarkStudio com iniciativa. O limite não é evitar mudanças grandes; é evitar mudanças irresponsáveis, opacas ou impossíveis de revisar.
