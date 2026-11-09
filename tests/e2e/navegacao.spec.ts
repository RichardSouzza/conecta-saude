import { expect, test } from '@playwright/test';
import { ALVO, contorno } from './helpers';

test.describe('navegação por teclado e foco visível', () => {
  test('o link "Ir para o conteúdo" é o primeiro da tabulação e tem foco visível dentro da tela', async ({ page }) => {
    await page.goto('');
    await page.keyboard.press('Tab');
    const pular = page.getByRole('link', { name: 'Ir para o conteúdo' });
    await expect(pular).toBeFocused();

    const caixa = await pular.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.y).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);

    const c = await contorno(pular);
    expect(c.estilo).not.toBe('none');
    expect(c.largura).toBeGreaterThanOrEqual(3);
  });

  test('ao ativar o link, o foco vai para o conteúdo principal e o indicador de foco continua visível', async ({ page }) => {
    await page.goto('');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    const principal = page.locator('#conteudo');
    await expect(principal).toBeFocused();

    const c = await contorno(principal);
    expect(c.estilo).not.toBe('none');
    expect(c.largura).toBeGreaterThanOrEqual(3);
    // O contorno é desenhado para dentro da caixa, que ocupa a largura toda da tela.
    expect(c.deslocamento).toBe('-3px');
    const caixa = await principal.boundingBox();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);
  });

  test('marca e itens do menu recebem foco visível na ordem esperada', async ({ page }) => {
    await page.goto('');
    const esperados = ['Ir para o conteúdo', 'Conecta Saúde', 'Início', 'Sobre', ...(ALVO === 'teste' ? ['Teste seus hábitos'] : [])];
    for (const nome of esperados) {
      await page.keyboard.press('Tab');
      const foco = page.getByRole('link', { name: nome, exact: true }).first();
      await expect(foco).toBeFocused();
      const c = await contorno(foco);
      expect(c.estilo, `contorno de "${nome}"`).not.toBe('none');
      expect(c.largura, `largura do contorno de "${nome}"`).toBeGreaterThanOrEqual(3);
    }
  });

  test('o item atual do menu usa aria-current', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    await page.goto('sobre/');
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Sobre' })).toHaveAttribute('aria-current', 'page');
  });
});
