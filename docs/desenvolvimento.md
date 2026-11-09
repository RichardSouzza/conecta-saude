# Notas de desenvolvimento

## Caminho-base

O site é publicado em `https://richardsouzza.github.io/conecta-saude/`. Se o repositório ou o domínio mudar,
altere `site` e `base` em `astro.config.mjs`. Links internos devem usar `url()` (`src/lib/url.ts`); o
`check:links` e os testes de navegador falham se algum ignorar o `base`.

## Build de teste e de produção

`MODO=teste` (definido pelos scripts via `cross-env` e, no Playwright, pela opção `webServer.env`) gera
`dist-test/`. Sem `MODO`, o build vai para `dist/`. Os testes de navegador rodam sobre os dois, mas só `dist/`
é publicado. Rascunhos de temas e o quiz em demonstração existem apenas no modo teste (ver `docs/conteudo.md` e
`docs/quiz.md`).

## Portão de release

`release.config.json` é a fonte canônica de:

- `estagio`: `preparacao` ou `final`.
- `temasObrigatorios`: slugs dos temas exigidos no estágio `final`.
- `categoriasObrigatorias`: ids das categorias do quiz exigidas no estágio `final`.

Regras de `scripts/check-release.mjs`, que roda sempre dentro do `ci:build`:

- Configuração ausente ou inválida: falha com código 1.
- Em qualquer estágio: nenhuma entrada oculta (nome começando com `.`) em `dist/`, nenhum marcador de rascunho ou
  demonstração e todo tema publicado com aprovação, revisor, data e referência.
- `preparacao`: o site pode ir ao ar sem temas e sem quiz; o quiz publicado reprova o build.
- `final`: todos os temas obrigatórios publicados e o quiz aprovado, declarando exatamente as categorias
  obrigatórias (nenhuma ausente, inesperada ou duplicada), todas com aprovação e cada uma apontando para um
  único tema publicado.
- `data-categorias` e `data-aprovacoes` são listas separadas por vírgula; segmentos vazios (`a,,b`, `a,`, `,a`)
  são rejeitados, e espaços ao redor das vírgulas são ignorados.

O portão confere os metadados da aprovação (status, revisor, data e referência), não a aprovação em si. A aprovação
escrita do responsável da área, registrada em `docs/revisoes.md`, é pré-requisito para marcar um conteúdo como
`aprovado` e publicá-lo.

Contrato com as páginas geradas: ver o cabeçalho do script. Um teste (`tests/unit/quiz-schema.test.ts`) garante que as
categorias de `quiz.json` coincidam com `categoriasObrigatorias`, sem duplicar a lista.

## Privacidade

A página Sobre só afirma o que o código e os testes confirmam.

Os testes de navegador (Chromium) verificam, em cada página:

- Nenhuma requisição a outra origem e nenhum recurso com erro HTTP.
- Nenhuma escrita registrada, durante a vida do documento, nestas vias, mesmo que o valor seja apagado depois:
  métodos de `Storage`, atribuição e remoção direta de propriedades em `localStorage` e `sessionStorage`,
  `document.cookie`, `cookieStore.set/delete`, `indexedDB.open/deleteDatabase`, `CacheStorage`/`Cache` e
  `serviceWorker.register`.
- Estado final vazio de `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, service workers e cookies
  (`document.cookie` e cookies do contexto do navegador).

Não são verificados: Web SQL, OPFS/File System Access, escritas em workers ou iframes, outros navegadores além do
Chromium e, antes do estado final, cookies enviados pelo servidor (`Set-Cookie`). Os testes reduzem o risco nas
vias listadas; não provam ausência absoluta de gravação.

Demais regras:

- Links externos: a documentação do GitHub Pages (citada na página Sobre porque informa que o IP do visitante é
  registrado e armazenado por segurança) e as referências dos temas. São apenas links: nenhum recurso externo é
  carregado, e os testes de navegador conferem isso em cada página.
- A frase sobre as respostas do quiz (não enviadas a um servidor nem guardadas no aparelho) aparece na página Sobre
  apenas quando o quiz é publicado. As verificações que a sustentam estão em `docs/quiz.md`.

## Portabilidade

Variáveis de ambiente nos scripts usam `cross-env`. Os scripts Node usam `node:path` e não dependem de shell.
A execução em Windows ainda não foi validada (ver `docs/verificacao-fase1.md`).
