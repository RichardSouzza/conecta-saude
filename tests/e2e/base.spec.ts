import { expect, test } from '@playwright/test';
import { BASE } from './helpers';

const DOC_PAGES = 'https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages';

test.describe('caminho-base /conecta-saude/', () => {
  test('todos os links internos usam o caminho-base', async ({ page }) => {
    for (const caminho of ['', 'sobre/', 'nao-existe/']) {
      await page.goto(caminho);
      const destinos = await page.$$eval('a[href], link[href]', (els) => els.map((e) => e.getAttribute('href') ?? ''));
      for (const href of destinos) {
        if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
        expect(href.startsWith(BASE), `href "${href}" em "${caminho}"`).toBe(true);
      }
    }
  });

  test('o favicon responde sob o caminho-base', async ({ page }) => {
    const resposta = await page.request.get('favicon.svg');
    expect(resposta.status()).toBe(200);
  });

  test('o menu navega entre as páginas mantendo o caminho-base', async ({ page }) => {
    await page.goto('');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Sobre' }).click();
    await expect(page).toHaveURL(/\/conecta-saude\/sobre\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sobre o Conecta Saúde' })).toBeVisible();
  });

  test('o único link externo do site é a documentação do GitHub Pages, citada na página Sobre', async ({ page }) => {
    const externos: string[] = [];
    for (const caminho of ['', 'sobre/', 'nao-existe/']) {
      await page.goto(caminho);
      externos.push(...(await page.$$eval('a[href^="http"], link[href^="http"], script[src], img[src]', (els) => els.map((e) => e.getAttribute('href') ?? e.getAttribute('src') ?? ''))));
    }
    expect([...new Set(externos)]).toEqual([DOC_PAGES]);
  });
});
