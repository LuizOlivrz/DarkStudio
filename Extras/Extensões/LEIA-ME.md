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
    │   ├── main.ds
    │   ├── styles.css
    │   └── Assets/
    │       ├── demo/
    │       │   ├── demo.txt
    │       │   └── demo.ico
    │       ├── images/
    │       ├── videos/
    │       ├── icons/
    │       ├── audio/
    │       └── fonts/
    └── Minha-Extensao/
        ├── manifest.json
        ├── main.ds
        ├── styles.css
        └── Assets/
            └── demo/
                ├── demo.txt
                └── demo.ico
```

Inclua somente as subpastas de recursos que a extensão realmente utilizar. Mantenha imagens, vídeos, ícones, áudio, fontes e outros arquivos dentro da pasta da própria extensão; não espalhe esses arquivos por `Extras/Code` nem pela raiz do website.

### Arquivos principais

- `manifest.json`: identificador, nome, versão, descrição e nomes dos arquivos de entrada.
- `main.ds`: ponto de entrada com conteúdo JavaScript (a extensão do arquivo é `.ds`).
- `Assets/demo/demo.txt` e `Assets/demo/demo.ico`: arquivos obrigatórios; sem qualquer um deles, a extensão fica listada como quebrada e não pode ser ativada. O `demo.txt` usa a primeira linha como título e a segunda linha não vazia como descrição curta exibida abaixo do título. O `demo.ico` é o ícone mostrado no menu de extensões.
- `styles.css`: estilos exclusivos da extensão.
- `Assets/`: recursos locais da extensão, organizados por tipo.

Use caminhos relativos à pasta da extensão para referenciar os recursos. Evite nomes genéricos que possam colidir com os de outras extensões.

## Como enviar uma extensão

1. Copie a pasta `Modelo` e renomeie-a com um nome descritivo.
2. Edite `manifest.json`, `main.ds` e `styles.css`; mantenha `Assets/demo/demo.txt` e `Assets/demo/demo.ico` e adicione os demais recursos em `Assets/`.
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
- O formato de pasta é importável pelo gerenciador local. A instalação verifica `manifest.json`, `main.ds`, `Assets/demo/demo.txt` e `Assets/demo/demo.ico`; pacotes incompletos aparecem como quebrados e ficam desativados. Arquivos legados `.dsx.json` podem ser importados para inspeção, mas permanecem listados como quebrados e desativados até serem reconstruídos como uma pasta com todos os arquivos obrigatórios.
- Somente após aprovação explícita do mantenedor uma extensão deve ser integrada ao catálogo oficial/fluxo de instalação.
- Não trate uma extensão de terceiros como confiável apenas porque está no repositório. Revise o conteúdo antes de aprovar.
