import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gravacoes, instrumentarGravacoes, observar, PAGINAS } from './helpers';

for (const pagina of PAGINAS) {
  test.describe(`página ${pagina.nome}`, () => {
    test('carrega sem erros de console e sem requisições a outras origens', async ({ page, baseURL }) => {
      const obs = observar(page, baseURL!);
      const resposta = await page.goto(pagina.caminho);
      expect(resposta?.status()).toBe(pagina.status);
      await page.waitForLoadState('networkidle');
      expect(obs.erros).toEqual([]);
      expect(obs.falhas).toEqual([]);
      expect(obs.externas).toEqual([]);
    });

    test('não tem rolagem horizontal em 360 px', async ({ page }) => {
      await page.goto(pagina.caminho);
      const medidas = await page.evaluate(() => ({
        janela: window.innerWidth,
        conteudo: document.documentElement.scrollWidth,
      }));
      expect(medidas.janela).toBe(360);
      expect(medidas.conteudo).toBeLessThanOrEqual(medidas.janela);
    });

    test('não tem violações sérias ou críticas de acessibilidade (axe)', async ({ page }) => {
      await page.goto(pagina.caminho);
      const resultado = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const graves = resultado.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help}`);
      expect(graves).toEqual([]);
    });

    test('não usa as vias de armazenamento instrumentadas e termina com o armazenamento vazio', async ({ page, context }) => {
      await instrumentarGravacoes(page);
      await page.goto(pagina.caminho);
      await page.keyboard.press('Tab');
      await page.waitForLoadState('networkidle');

      expect(await gravacoes(page)).toEqual([]);
      const estado = await page.evaluate(async () => ({
        local: localStorage.length,
        sessao: sessionStorage.length,
        cookie: document.cookie,
        bancos: 'databases' in indexedDB ? (await indexedDB.databases()).length : 0,
        caches: 'caches' in window ? (await caches.keys()).length : 0,
        workers: 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
      }));
      expect(estado).toEqual({ local: 0, sessao: 0, cookie: '', bancos: 0, caches: 0, workers: 0 });
      expect(await context.cookies()).toEqual([]);
    });

    test('declara o idioma e tem título', async ({ page }) => {
      await page.goto(pagina.caminho);
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      await expect(page).toHaveTitle(/Conecta Saúde/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });
  });
}

test('a página 404 mostra a mensagem e leva de volta ao início', async ({ page }) => {
  await page.goto('nao-existe/');
  await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL(/\/conecta-saude\/$/);
});

test('controle: a instrumentação registra gravações, inclusive atribuição direta e escrita seguida de remoção', async ({ page }) => {
  await instrumentarGravacoes(page);
  await page.goto('');
  await page.evaluate(async () => {
    localStorage.setItem('chave', '1');
    sessionStorage.setItem('chave', '1');
    localStorage.direta = '1';
    sessionStorage.direta = '1';
    delete localStorage.direta;
    document.cookie = 'a=b';
    indexedDB.open('banco');
    await cookieStore.set('c', 'd');
    localStorage.clear();
  });
  expect(await gravacoes(page)).toEqual(
    expect.arrayContaining([
      'Storage.setItem',
      'Storage.clear',
      'localStorage.atribuição',
      'sessionStorage.atribuição',
      'localStorage.remoção',
      'document.cookie',
      'indexedDB.open',
      'cookieStore.set',
    ]),
  );
});

test('o proxy de storage não altera o comportamento de leitura e escrita da página', async ({ page }) => {
  await instrumentarGravacoes(page);
  await page.goto('');
  const resultado = await page.evaluate(() => {
    localStorage.direta = '1';
    localStorage.setItem('b', '2');
    return { direta: localStorage.getItem('direta'), b: localStorage.b, tamanho: localStorage.length };
  });
  expect(resultado).toEqual({ direta: '1', b: '2', tamanho: 2 });
});
