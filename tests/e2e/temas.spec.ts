import { expect, test } from '@playwright/test';
import { ALVO, TEMA_DEMO, TEMA_MINIMO } from './helpers';

test.describe('build de teste', () => {
  test.skip(ALVO !== 'teste', 'os rascunhos só existem no build de teste');

  test('o rascunho mostra o banner explícito de conteúdo não aprovado', async ({ page }) => {
    await page.goto(`temas/${TEMA_DEMO}/`);
    const banner = page.getByRole('note').filter({ hasText: 'Conteúdo em revisão' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('não está liberado para publicação');
    await expect(page.locator('article')).toHaveAttribute('data-conteudo', 'rascunho');
  });

  test('apresenta título, área e resumo', async ({ page }) => {
    await page.goto(`temas/${TEMA_DEMO}/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Demonstração: estrutura de um tema' })).toBeVisible();
    await expect(page.locator('.tema-area')).toContainText('Computação');
    await expect(page.locator('.tema-destaque')).toContainText('Tema fictício, usado apenas para validar a estrutura do site');
  });

  test('renderiza o conteúdo Markdown: títulos, parágrafos, listas, ênfase e links', async ({ page }) => {
    await page.goto(`temas/${TEMA_DEMO}/`);
    const corpo = page.locator('.tema-corpo');
    await expect(corpo.getByRole('heading', { level: 2, name: 'Seção de exemplo', exact: true })).toBeVisible();
    await expect(corpo.getByRole('heading', { level: 3, name: 'Subseção de exemplo', exact: true })).toBeVisible();
    await expect(corpo.locator('p').first()).toContainText('TEXTO FICTÍCIO DE DEMONSTRAÇÃO');
    await expect(corpo.locator('ul > li')).toHaveCount(3);
    await expect(corpo.locator('ol > li')).toHaveCount(3);
    await expect(corpo.locator('strong')).toHaveText('trecho em destaque');
    await expect(corpo.getByRole('link', { name: 'link fictício' })).toHaveAttribute('href', 'https://example.org/');
  });

  test('apresenta as referências com link, instituição e data de acesso', async ({ page }) => {
    await page.goto(`temas/${TEMA_DEMO}/`);
    const secao = page.getByRole('region', { name: 'Referências' });
    await expect(secao.locator('ol > li')).toHaveCount(2);
    const primeira = secao.locator('li').first();
    const link = primeira.getByRole('link', { name: 'Referência fictícia de demonstração' });
    await expect(link).toHaveAttribute('href', 'https://example.org/referencia-ficticia');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(primeira).toContainText('Instituição fictícia');
    await expect(primeira.locator('time')).toHaveAttribute('datetime', '2026-10-01');
    await expect(primeira.locator('time')).toHaveText('01/10/2026');
  });

  test('o rascunho não exibe informações de revisão', async ({ page }) => {
    await page.goto(`temas/${TEMA_DEMO}/`);
    await expect(page.locator('.tema-revisao')).toHaveCount(0);
    await expect(page.getByText('Revisado por')).toHaveCount(0);
  });

  test('o rascunho com metadados mínimos não tem seção de referências', async ({ page }) => {
    await page.goto(`temas/${TEMA_MINIMO}/`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('rascunho com metadados mínimos');
    await expect(page.getByRole('heading', { name: 'Referências' })).toHaveCount(0);
    await expect(page.getByRole('note').filter({ hasText: 'Conteúdo em revisão' })).toBeVisible();
  });

  test('a página inicial lista os rascunhos com a marca "Em revisão"', async ({ page }) => {
    await page.goto('');
    const itens = page.locator('.lista-temas > li[data-conteudo="rascunho"]');
    await expect(itens).toHaveCount(2);
    for (const item of await itens.all()) await expect(item).toContainText('Em revisão');
    await expect(itens.first().getByRole('link', { name: /Demonstração: estrutura de um tema/ })).toHaveAttribute(
      'href',
      `/conecta-saude/temas/${TEMA_DEMO}/`,
    );
  });
});

test.describe('build de produção', () => {
  test.skip(ALVO !== 'producao', 'a exclusão de rascunhos é verificada sobre o build de produção');

  for (const slug of [TEMA_DEMO, TEMA_MINIMO]) {
    test(`a página do rascunho "${slug}" não existe`, async ({ page }) => {
      const resposta = await page.goto(`temas/${slug}/`);
      expect(resposta?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
    });
  }

  test('a página inicial lista os temas aprovados e não mostra marcas de rascunho', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('.lista-temas')).toHaveCount(1);
    await expect(page.locator('.lista-temas > li[data-conteudo="aprovado"]')).toHaveCount(7);
    await expect(page.locator('a[href*="/temas/"]')).toHaveCount(7);
    await expect(page.getByText('Em revisão')).toHaveCount(0);
    await expect(page.getByText('Conteúdo em revisão')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Temas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conteúdos em preparação' })).toBeVisible();
  });

  test('nenhum HTML publicado contém o conteúdo dos rascunhos', async ({ page }) => {
    for (const caminho of ['', 'sobre/', 'nao-existe/']) {
      const html = await (await page.request.get(caminho)).text();
      for (const trecho of ['Demonstração:', 'DEMONSTRAÇÃO', 'demo-estrutura', 'demo-minimo', 'example.org']) {
        expect(html, `"${trecho}" em "${caminho}"`).not.toContain(trecho);
      }
    }
  });
});
