import { defineConfig } from 'astro/config';

// MODO=teste gera dist-test/ (nunca publicado); sem MODO, o build de produção vai para dist/.
const modoTeste = process.env.MODO === 'teste';

// Se o repositório ou o domínio mudar, só `site` e `base` precisam ser alterados.
export default defineConfig({
  site: 'https://richardsouzza.github.io',
  base: '/conecta-saude',
  trailingSlash: 'always',
  outDir: modoTeste ? './dist-test' : './dist',
});
