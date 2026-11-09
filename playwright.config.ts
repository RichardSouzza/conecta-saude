import { defineConfig } from '@playwright/test';

const alvo = process.env.PW_ALVO === 'producao' ? 'producao' : 'teste';
const porta = alvo === 'producao' ? 4402 : 4401;
const raiz = `http://127.0.0.1:${porta}/conecta-saude/`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: raiz,
    viewport: { width: 360, height: 800 },
  },
  projects: [{ name: alvo, use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${porta}`,
    // MODO decide a pasta servida (dist-test/ ou dist/); vazio evita herdar MODO=teste do ambiente.
    env: { MODO: alvo === 'teste' ? 'teste' : '' },
    url: raiz,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
