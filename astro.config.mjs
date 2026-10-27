import { defineConfig } from 'astro/config';

// MODO=teste gera o build de teste em dist-test/ (nunca publicado), usado pelos testes de navegador.
// Sem MODO, o build é o de produção em dist/ (o único que vai ao ar).
const modoTeste = process.env.MODO === 'teste';

// GitHub Pages em repositório de projeto: https://<usuario>.github.io/<repositorio>/
// Se o repositório ou o domínio mudar, só `site` e `base` precisam ser alterados.
export default defineConfig({
  site: 'https://richardsouzza.github.io',
  base: '/conecta-saude',
  trailingSlash: 'always',
  outDir: modoTeste ? './dist-test' : './dist',
});
