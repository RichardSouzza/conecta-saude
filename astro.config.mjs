import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';
import release from './release.config.json' with { type: 'json' };
import quiz from './src/data/quiz.json' with { type: 'json' };
import { quizPublicavel } from './src/lib/quiz/publicacao.ts';

// MODO=teste gera dist-test/ (nunca publicado); sem MODO, o build de produção vai para dist/.
const modoTeste = process.env.MODO === 'teste';

// Sem quiz publicável, nem a rota nem o Preact entram no build: nenhum HTML ou JavaScript dele chega a dist/.
const incluirQuiz = quizPublicavel({ modoTeste, estagio: release.estagio, status: quiz.status });

const rotaDoQuiz = {
  name: 'rota-do-quiz',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => injectRoute({ pattern: '/quiz', entrypoint: './src/rotas/quiz.astro' }),
  },
};

// Se o repositório ou o domínio mudar, só `site` e `base` precisam ser alterados.
export default defineConfig({
  site: 'https://richardsouzza.github.io',
  base: '/conecta-saude',
  trailingSlash: 'always',
  outDir: modoTeste ? './dist-test' : './dist',
  integrations: incluirQuiz ? [preact(), rotaDoQuiz] : [],
});
