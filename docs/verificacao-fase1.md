# Verificação da Fase 1 (revisão 1)

Executada em 27/10/2026 (UTC), com Node 24.22.1 e a instalação limpa feita por `npm ci`.

## Resultados reais

| Etapa | Resultado |
|---|---|
| `npm ci` | 294 pacotes, sem erro |
| `npm run check:node` | Node 24.22.1 confere com o `.nvmrc` |
| `npm run check` (astro check) | 0 erros, 0 avisos, 0 dicas |
| `npm test` (Vitest) | 2 arquivos, 48 testes aprovados |
| `npm run build:test` | 3 páginas em `dist-test/` |
| Playwright sobre `dist-test/` | 24 testes aprovados |
| `npm run build` | 3 páginas em `dist/`, caminho-base `/conecta-saude/` |
| `npm run check:release` | aprovado (estágio `preparacao`, 0 temas, quiz ausente) |
| `npm run check:links` | aprovado (base `/conecta-saude`) |
| Playwright sobre `dist/` | 24 testes aprovados |

Conferências adicionais: nenhuma entrada oculta em `dist/`; `check:release` reprovou `dist/.nojekyll`,
`dist/.well-known` e `dist/a/b/.segredo` (exit 1); com `MODO=teste` o servidor serve `dist-test/` e sem `MODO`
serve `dist/`; o job de deploy contém só `actions/deploy-pages` e um `curl`, sem checkout, instalação nem build.

Prova de mutação: com `.principal:focus { outline: none; }` reintroduzida, o teste de foco do conteúdo principal
falha; com a correção, os 4 testes de navegação passam.

## Limitações

- O CDN do Playwright é inacessível no ambiente de verificação. Os testes de navegador rodaram com um Chromium
  153.0.8010.0 obtido por um pacote npm, usado por um arquivo de configuração temporário fora do projeto (já
  removido). A CI usará o Chromium do Playwright 1.64.1 (156.0.8078.4). Portanto, `npm run ci:build`, exatamente
  como escrito, **não foi executado aqui**: cada etapa foi executada separadamente, na mesma ordem, trocando
  apenas o arquivo de configuração do Playwright.
- Só Chromium foi usado. Safari/iOS, Firefox e leitores de tela não foram testados.
- O workflow do GitHub Actions não foi executado (depende do GitHub); foi verificado apenas por análise da
  estrutura do YAML.
- O npm do ambiente é o 10.9.7; na CI será o que acompanha o Node 24.22.1.
- O patch Node 24.22.1 ainda precisa de confirmação no nodejs.org.
- `check-quiz-persistence.mjs` não existe ainda: não há código de quiz (Fase 3).
