import { defineConfig } from '@playwright/test';

// PW_ALVO=teste    -> serve dist-test/ (build de teste)
// PW_ALVO=producao -> serve dist/ (build de produção, depois de check-release e check-links)
const alvo = process.env.PW_ALVO === 'producao' ? 'producao' : 'teste';
const porta = alvo === 'producao' ? 4402 : 4401;
const origem = `http://127.0.0.1:${porta}`;
const raiz = `${origem}/conecta-saude/`; // o `base` do astro.config.mjs

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: raiz, // nos testes, use caminhos relativos: page.goto('sobre/')
    viewport: { width: 360, height: 800 },
  },
  projects: [{ name: alvo, use: { browserName: 'chromium' } }],
  webServer: {
    command: `${alvo === 'teste' ? 'MODO=teste ' : ''}npm run preview -- --host 127.0.0.1 --port ${porta}`,
    url: raiz,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
