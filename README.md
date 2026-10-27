# Conecta Saúde

Site educativo do projeto interdisciplinar **Conecta Saúde**, acessado por QR Code durante a palestra
"Saúde integral: pequenos hábitos, grandes impactos na qualidade de vida".

Astro (geração 100% estática), publicado no GitHub Pages. Sem backend, banco, CMS, autenticação,
analytics, cookies próprios ou fontes externas.

## Requisitos

- Node.js **24.22.1** (veja `.nvmrc`; com nvm: `nvm use`).
- npm. Instale sempre com `npm ci` (estritamente pelo `package-lock.json`).
- Para os testes de navegador: `npx playwright install chromium` (no Linux sem as bibliotecas do sistema, use
  `npx playwright install --with-deps chromium`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` (o único que vai ao ar) |
| `npm run build:test` | Build de teste em `dist-test/` (nunca publicado) |
| `npm run preview` | Serve o build local (com `MODO=teste`, serve `dist-test/`) |
| `npm run check` | `astro check` (tipos e Astro) |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e:teste` | Playwright sobre `dist-test/` |
| `npm run test:e2e:producao` | Playwright sobre `dist/` |
| `npm run check:node` | Confere o Node em execução com o `.nvmrc` |
| `npm run check:release` | Portão de release sobre `dist/` |
| `npm run check:links` | Links internos de `dist/`, respeitando o `base` |
| `npm run ci:build` | Tudo acima, na ordem da CI |

Ordem do `ci:build`: `check:node`, `check`, `test`, `build:test`, `test:e2e:teste`, `build`, `check:release`,
`check:links`, `test:e2e:producao`. O artefato enviado ao Pages é o `dist/` que passou por todas as etapas.

## Caminho-base

O site é publicado em `https://richardsouzza.github.io/conecta-saude/`. Se o repositório ou o domínio mudar,
ajuste `site` e `base` em `astro.config.mjs`. Todos os links internos devem passar por `url()`
(`src/lib/url.ts`).

## Portão de release

`release.config.json` é a **fonte canônica** de:

- `estagio`: `preparacao` ou `final`.
- `temasObrigatorios`: slugs dos temas exigidos no estágio `final`.
- `categoriasObrigatorias`: ids das categorias do quiz exigidas no estágio `final`.

Regras (`scripts/check-release.mjs`, executado sempre dentro do `ci:build`):

- `preparacao`: o site pode ir ao ar sem temas e sem quiz. Rascunhos, demonstração e o quiz **não** podem
  aparecer em `dist/`.
- `final`: todos os temas obrigatórios publicados e o quiz aprovado, declarando **exatamente** as categorias
  obrigatórias (nenhuma ausente, nenhuma inesperada, nenhuma duplicada), todas com aprovação registrada e cada
  uma apontando para um tema publicado.
- Em qualquer estágio, qualquer arquivo ou pasta oculta (nome começando com `.`) em `dist/` reprova o build.

Contrato com a página do quiz (Fase 3): `data-categorias="categoria:tema,..."` e `data-aprovacoes="categoria,..."`.
O teste da Fase 3 deve garantir que as categorias de `quiz.json` coincidam com `categoriasObrigatorias`, sem
duplicar a lista.

## Publicação (GitHub Actions)

`.github/workflows/deploy.yml`: o job `build` roda `npm ci`, instala o Chromium do Playwright, roda
`npm run ci:build` e envia `dist/`; o job `deploy`, só na `main`, apenas publica esse artefato. Se qualquer
verificação falhar, nada é publicado e a última versão válida permanece no ar.

Primeira publicação:

1. Criar o repositório público `conecta-saude` e enviar a branch `main`.
2. Em **Settings > Pages**, definir a fonte como **GitHub Actions**.
3. Acompanhar a execução em **Actions** e abrir a URL pública.

## Privacidade: o que a página Sobre afirma e como é verificado

- O código não define cookies, não inclui ferramentas próprias de análise e não carrega recursos de terceiros:
  verificado pelos testes de navegador (sem requisições a outras origens, sem cookies, sem armazenamento local).
- O único link externo é a documentação do GitHub Pages, e o teste confere isso.
- A frase sobre o registro de IP pelo GitHub Pages vem da documentação oficial do GitHub Pages.
- **Ainda não incluído:** frases sobre as respostas do quiz (não armazenadas localmente, não enviadas a um
  backend). Só entram na página Sobre quando o quiz existir e os testes de privacidade do quiz passarem (Fase 3).

## Conteúdo de saúde

Nenhum conteúdo é publicado sem aprovação escrita do responsável da área. Veja `docs/revisoes.md`.
Versões e SHAs fixados: `docs/versoes.md`. Resultados reais da verificação: `docs/verificacao-fase1.md`.
