# Conecta Saúde

Site educativo do projeto interdisciplinar Conecta Saúde, acessado por QR Code durante a palestra
"Saúde integral: pequenos hábitos, grandes impactos na qualidade de vida". Astro, 100% estático, publicado
no GitHub Pages.

## Requisitos

- Node.js 24.22.1 (versão exata em `.nvmrc`). Instale-a com o gerenciador de sua preferência.
- npm.

## Instalação

```
npm ci
npx playwright install chromium
```

Use sempre `npm ci`: ele instala estritamente pelo `package-lock.json` e falha se o lockfile divergir do
`package.json`. No Linux, se faltarem bibliotecas do sistema para o navegador, use
`npx playwright install --with-deps chromium`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (modo teste: mostra rascunhos) |
| `npm run build` | Build de produção em `dist/` (o único que vai ao ar) |
| `npm run build:test` | Build de teste em `dist-test/` (nunca publicado) |
| `npm run preview` | Serve o build local |
| `npm run check` | `astro check` |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e:teste` | Playwright sobre `dist-test/` |
| `npm run test:e2e:producao` | Playwright sobre `dist/` |
| `npm run check:node` | Confere o Node em execução com o `.nvmrc` |
| `npm run check:quiz` | Proíbe APIs de armazenamento e envio de dados no código do quiz |
| `npm run check:release` | Portão de release sobre `dist/` |
| `npm run check:links` | Links internos de `dist/` |
| `npm run ci:build` | Todas as verificações, na ordem da CI |

## Validação

`npm run ci:build` executa, em ordem: `check:node`, `check`, `check:quiz`, `test`, `build:test`, `test:e2e:teste`,
`build`, `check:release`, `check:links` e `test:e2e:producao`. Qualquer falha interrompe a sequência. O artefato
publicado é o `dist/` que passou por todas as etapas.

## Publicação

O workflow `.github/workflows/deploy.yml` roda `npm ci`, instala o Chromium do Playwright, roda
`npm run ci:build` e envia `dist/`. O job `deploy`, só na `main`, apenas publica esse artefato; se qualquer
verificação falhar, a última versão válida permanece no ar.

Nenhum conteúdo de saúde é publicado sem aprovação escrita do responsável da área (`docs/revisoes.md`).

Primeira publicação:

1. Criar o repositório público `conecta-saude` e enviar a branch `main`.
2. Em Settings > Pages, definir a fonte como GitHub Actions.
3. Acompanhar a execução em Actions e abrir `https://richardsouzza.github.io/conecta-saude/`.

## Documentação

- `docs/conteudo.md`: como adicionar um tema, metadados obrigatórios e aprovação editorial.
- `docs/quiz.md`: como o quiz funciona, pontuação, como editar perguntas, aprovação e privacidade.
- `docs/desenvolvimento.md`: caminho-base, portão de release, privacidade e portabilidade.
- `docs/versoes.md`: versões e SHAs fixados.
- `docs/revisoes.md`: registro de aprovação do conteúdo de saúde.
- `docs/verificacao-fase1.md`: resultados reais da verificação.
