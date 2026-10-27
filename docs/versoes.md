# Versões fixadas

Verificado em 26 e 27/10/2026 (consulta ao registro npm, `npm ci` e `npm run ci:build` completos).

## Ambiente

| Item | Versão | Observação |
|---|---|---|
| Node.js | 24.22.1 (`.nvmrc`, `engines`, workflow) | Na verificação local, o binário veio do pacote npm `node@24.22.1`. **Pendente:** confirmar no nodejs.org que 24.22.1 é o patch 24.x mais recente com as correções de segurança de outubro/2026. |
| npm | 10.9.7 (ambiente de verificação) | Na CI, é o npm que acompanha o Node 24.22.1 instalado pelo `actions/setup-node`. |

## Dependências (exatas, conforme `package-lock.json`)

| Pacote | Versão | Requisitos conferidos |
|---|---|---|
| astro | 7.4.2 (`latest` estável em 26/10/2026) | node >=22.23.4, npm >=9.6.5 |
| @astrojs/check | 0.9.12 | peer typescript ^5 ou ^6 |
| typescript | 6.0.3 | a 7.x está fora do peer do `@astrojs/check` |
| vitest | 5.0.5 | node ^22.12 ou ^24 ou >=26 |
| @types/node | 24.19.2 | alinhado ao Node 24 |
| @playwright/test | 1.64.1 | node >=20 |
| @axe-core/playwright | 4.14.0 | node >=22.12; peer playwright-core >=1, atendido pelo 1.64.1 do `@playwright/test` |

Resolvidas por transitividade: vite 8.3.5 (única versão), zod 4.6.7, @astrojs/language-server 2.17.3, playwright e playwright-core 1.64.1 (única versão), axe-core 4.14.0.

`npm ls` não mostrou duplicidade de vite, typescript ou @types/node, nem peer obrigatório ausente
(só dependências opcionais específicas de outras plataformas).

## Planejadas para as próximas fases (ainda não instaladas)

| Fase | Pacote | Versão |
|---|---|---|
| 3 | @astrojs/preact | 6.1.1 |
| 3 | preact | 11.0.1 |

Antes de instalar, repetir `npm view <pacote> dist-tags` e `npm ls` e registrar aqui as versões resolvidas.

## Navegador dos testes

Na CI, `npx playwright install --with-deps chromium` instala o Chromium compatível com o Playwright 1.64.1
(Chrome for Testing 156.0.8078.4). Esse passo baixa um navegador, não uma dependência npm; o `npm ci` continua
sendo a única instalação de dependências.

## Actions do GitHub (fixadas por SHA; tags resolvidas com `git ls-remote` em 26/10/2026)

| Action | Tag | SHA |
|---|---|---|
| actions/checkout | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-node | v6.4.0 | 48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e |
| actions/upload-pages-artifact | v5.0.0 | fc324d3547104276b827a68afc52ff2a11cc49c9 |
| actions/deploy-pages | v5.0.1 | 368f82528645a54fb793d4d04e342629a3f51346 |
