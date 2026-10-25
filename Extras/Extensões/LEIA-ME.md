# Extensões da comunidade do DarkStudio

Esta pasta organiza propostas de extensões. **Cada extensão deve ter sua própria pasta**, contendo o manifesto, o código e todos os recursos usados por ela. Adicionar arquivos aqui não torna a extensão oficial nem faz seu código ser executado automaticamente.

## Estrutura de uma extensão

```text
Extras/
└── Extensões/
    ├── Catalogo.json
    ├── LEIA-ME.md
    ├── API.md
    ├── Modelo/
    │   ├── manifest.json
    │   ├── main.js
    │   ├── styles.css
    │   └── assets/
    │       ├── images/
    │       ├── videos/
    │       ├── icons/
    │       ├── audio/
    │       └── fonts/
    └── Minha-Extensao/
        ├── manifest.json
        ├── main.js
        ├── styles.css
        └── assets/
```

Inclua somente as subpastas de recursos que a extensão realmente utilizar. Mantenha imagens, vídeos, ícones, áudio, fontes e outros arquivos dentro da pasta da própria extensão; não espalhe esses arquivos por `Extras/Code` nem pela raiz do website.

### Arquivos principais

- `manifest.json`: identificador, nome, versão, descrição e nomes dos arquivos de entrada.
- `main.js`: lógica da extensão.
- `styles.css`: estilos exclusivos da extensão.
- `assets/`: recursos locais da extensão, organizados por tipo.

Use caminhos relativos à pasta da extensão para referenciar os recursos. Evite nomes genéricos que possam colidir com os de outras extensões.

## Como enviar uma extensão

1. Copie a pasta `Modelo` e renomeie-a com um nome descritivo.
2. Edite `manifest.json`, `main.js` e `styles.css`; adicione os recursos necessários em `assets/`.
3. Use um identificador único e estável, como `comunidade.nome-da-extensao`.
4. Confira o contrato da API em `API.md` e teste a extensão no ambiente de desenvolvimento.
5. Adicione uma entrada a `Catalogo.json` para que a proposta apareça na aba Extensões. O índice contém apenas metadados, nunca o código executável. Exemplo:

   ```json
   {
     "path": "Minha-Extensao",
     "name": "Minha extensão",
     "description": "O que ela faz e para que serve."
   }
   ```

6. Envie uma Pull Request contendo a pasta inteira, a entrada no índice e uma descrição do comportamento, dos testes e de qualquer acesso a DOM, rede ou dados.
7. Aguarde a revisão. Não inclua segredos, tokens, credenciais ou código que colete dados sem necessidade e transparência.

## Processo de aprovação

- O mantenedor revisa o código, os recursos, a segurança, o impacto na interface e a compatibilidade.
- Propostas não aprovadas não devem ser publicadas como extensões oficiais.
- A aba Extensões lê `Catalogo.json` apenas para mostrar nome, descrição e pasta. Ela não carrega, instala nem executa os arquivos listados nessa área.
- O formato de pasta organiza as contribuições do repositório. A instalação local existente por arquivo `.dsx.json` continua separada e não é substituída por este catálogo de propostas.
- Somente após aprovação explícita do mantenedor uma extensão deve ser integrada ao catálogo oficial/fluxo de instalação.
- Não trate uma extensão de terceiros como confiável apenas porque está no repositório. Revise o conteúdo antes de aprovar.
