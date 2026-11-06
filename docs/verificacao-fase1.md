# Verificação da Fase 1 (revisão 4)

Resultados observados em 31/10/2026 (UTC). O que não foi executado está listado em "Não executado".

## Executado localmente (Linux, Node 24.22.1, npm 10.9.7)

Instalação limpa (`rm -rf node_modules dist dist-test .astro`), depois `npm ci` e `npm run ci:build`, sem
arquivo de configuração alternativo. Código de saída do `ci:build`: 0.

| Etapa | Resultado |
|---|---|
| `npm ci` | 302 pacotes instalados; `package.json` e `package-lock.json` idênticos antes e depois (mesmo hash) |
| `check:node` | Node 24.22.1 confere com o `.nvmrc` |
| `check` (astro check) | 0 erros, 0 avisos |
| `test` (Vitest) | 3 arquivos, 84 testes aprovados |
| `build:test` | 3 páginas em `dist-test/` |
| `test:e2e:teste` (Playwright) | 26 aprovados |
| `build` | 3 páginas em `dist/` |
| `check:release` | aprovado (estágio `preparacao`, 0 temas, quiz ausente) |
| `check:links` | aprovado (base `/conecta-saude`) |
| `test:e2e:producao` (Playwright) | 26 aprovados |

Dependências: conferidas por script nos arquivos reais (projeto e todos os ZIPs entregues): `dependencies` contém
só `astro` e as sete ferramentas estão em `devDependencies`, sem divergência de versão com o lockfile. `npm ci --dry-run` confirma `package.json` e lockfile em sincronia; a raiz do lockfile coincide com
o `package.json`. `astro` é a única entrada de `dependencies`; `@astrojs/check`, `@axe-core/playwright`,
`@playwright/test`, `@types/node`, `cross-env`, `typescript` e `vitest` estão em `devDependencies`. No lockfile,
todos esses pacotes (exceto `@types/node`) têm `"dev": true`. O `@types/node` não recebe a marca porque o `vite`,
dependência do `astro`, o declara como peer opcional; ele só serve à tipagem e não é usado em tempo de execução.

Provas de mutação (o teste falha quando o defeito é reintroduzido e passa depois de restaurado):

- Com a implementação antiga de `lista()` (que descartava segmentos vazios), 12 testes novos falham; com a
  correção, os 84 passam.
- Script que grava e apaga um item em `localStorage` durante a carga: o teste de privacidade falha por
  `Storage.setItem`/`Storage.removeItem`, embora o estado final esteja vazio.
- Script que atribui `localStorage.x = '1'` e depois `delete localStorage.x`: o teste falha por
  `localStorage.atribuição`/`localStorage.remoção`.
- Regra `outline: none` no conteúdo principal (revisão anterior): o teste de foco falha.

## Verificado por inspeção ou lint estático

- Workflow: `actionlint` 1.7.12 (checksum SHA-256 conferido) sem apontamentos na revisão anterior; o arquivo do
  workflow não mudou nesta revisão.
- Portabilidade dos scripts de `package.json` e do `playwright.config.ts`: revisados; variáveis de ambiente usam
  `cross-env` e `webServer.env`.

## Substituição de navegador (não silenciosa)

O CDN do Playwright é inacessível no ambiente. O Playwright 1.64.1 espera o Chrome for Testing 156.0.8078.4.
Os testes rodaram com o Chromium 153.0.8010.0 (pacote npm `@sparticuz/chromium` 153.0.0), exposto por meio de
`PLAYWRIGHT_BROWSERS_PATH`, apontando para um diretório com o layout esperado pelo Playwright (links
simbólicos para esse binário). Nenhum arquivo do projeto foi alterado para isso. Os resultados dos testes de
navegador valem para o Chromium 153, não para o 156 que a CI instalará.

## Observação

`npm ls` marca `@img/sharp-wasm32` e `@napi-rs/wasm-runtime` como `extraneous`. São dependências opcionais
presentes no lockfile; um lockfile regenerado do zero numa cópia também as mantém. Não afetam build nem testes e
o lockfile não foi alterado (regenerá-lo mudaria versões não relacionadas).

## Não executado

- Windows: nenhum ambiente Windows disponível. Os comandos de desenvolvimento e teste não foram executados lá.
- Workflow no GitHub: sem acesso ao repositório; não há execução real do `ci:build` na CI, do deploy nem do
  `curl` pós-deploy.
- Safari/iOS, Firefox e leitores de tela.
- Instalação do Chromium oficial do Playwright (`npx playwright install --with-deps chromium`).
- Confirmação do patch Node 24.22.1 no nodejs.org.
- `check-quiz-persistence.mjs` e os testes de privacidade do quiz: dependem do quiz (Fase 3).
