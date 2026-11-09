import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ALVO, BASE, contorno, gravacoes, instrumentarGravacoes, QUIZ, type PerguntaDoQuiz } from './helpers';

const TOTAL = QUIZ.perguntas.length;
const PRIMEIRA_FAIXA = QUIZ.faixas[0];
const ULTIMA_FAIXA = QUIZ.faixas[QUIZ.faixas.length - 1];

type Escolha = 'min' | 'max';
const alternativa = (pergunta: PerguntaDoQuiz, escolha: Escolha) => {
  const ordenadas = [...pergunta.opcoes].sort((a, b) => a.pontos - b.pontos);
  return escolha === 'min' ? ordenadas[0] : ordenadas[ordenadas.length - 1];
};

const titulo = (n: number) => `Pergunta ${n} de ${TOTAL}`;
const escolherNaTela = (page: Page, rotulo: string) => page.getByRole('radio', { name: rotulo, exact: true }).check();

async function abrir(page: Page) {
  await page.goto('quiz/');
  await expect(page.getByRole('heading', { level: 2, name: titulo(1) })).toBeVisible();
}

async function responderTudo(page: Page, escolher: (pergunta: PerguntaDoQuiz) => Escolha) {
  for (const [i, pergunta] of QUIZ.perguntas.entries()) {
    await expect(page.getByRole('heading', { level: 2, name: titulo(i + 1) })).toBeVisible();
    await escolherNaTela(page, alternativa(pergunta, escolher(pergunta)).rotulo);
    await page.getByRole('button', { name: i === TOTAL - 1 ? 'Ver resultado' : 'Próxima' }).click();
  }
  await expect(page.getByRole('heading', { level: 2, name: 'Seu resultado' })).toBeVisible();
}

const grave = (resultados: { impact?: string | null; id: string; help: string }[]) =>
  resultados.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);

test.describe('quiz (build de teste)', () => {
  test.skip(ALVO !== 'teste', 'o quiz só existe no build de teste enquanto o estágio for "preparacao"');

  test('renderização inicial: título, avisos, primeira pergunta e progresso', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Teste seus hábitos' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'DEMONSTRAÇÃO' })).toBeVisible();
    await expect(page.getByText('não é uma avaliação clínica, não faz diagnóstico')).toBeVisible();
    await expect(page.locator('.quiz-privacidade')).toContainText('não são enviadas a nenhum servidor nem guardadas');

    const barra = page.getByRole('progressbar', { name: 'Progresso do teste' });
    await expect(barra).toHaveAttribute('value', '1');
    await expect(barra).toHaveAttribute('max', String(TOTAL));
    await expect(page.getByRole('group', { name: QUIZ.perguntas[0].texto })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(QUIZ.perguntas[0].opcoes.length);
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Próxima' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Escolha uma alternativa para continuar.');
  });

  test('bloqueia o avanço sem resposta e anuncia o motivo', async ({ page }) => {
    await abrir(page);
    // O Playwright trata aria-disabled como desabilitado e esperaria para sempre; uma pessoa consegue clicar.
    await page.getByRole('button', { name: 'Próxima' }).click({ force: true });
    await expect(page.getByRole('heading', { level: 2, name: titulo(1) })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Escolha uma alternativa antes de continuar.');
    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');
  });

  test('selecionar libera o avanço; avançar atualiza o progresso e move o foco para o título', async ({ page }) => {
    await abrir(page);
    await escolherNaTela(page, QUIZ.perguntas[0].opcoes[0].rotulo);
    await expect(page.getByRole('button', { name: 'Próxima' })).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByRole('status')).toHaveText('Alternativa selecionada. Você pode continuar.');

    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByRole('heading', { level: 2, name: titulo(2) })).toBeFocused();
    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '2');
    await expect(page.getByRole('group', { name: QUIZ.perguntas[1].texto })).toBeVisible();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeEnabled();
  });

  test('permite voltar, ver a resposta anterior e alterá-la sem perder as demais', async ({ page }) => {
    await abrir(page);
    const [p1, p2] = QUIZ.perguntas;
    await escolherNaTela(page, alternativa(p1, 'max').rotulo);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await escolherNaTela(page, alternativa(p2, 'min').rotulo);

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('heading', { level: 2, name: titulo(1) })).toBeFocused();
    await expect(page.getByRole('radio', { name: alternativa(p1, 'max').rotulo, exact: true })).toBeChecked();

    await escolherNaTela(page, alternativa(p1, 'min').rotulo);
    await expect(page.getByRole('radio', { name: alternativa(p1, 'min').rotulo, exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: alternativa(p1, 'max').rotulo, exact: true })).not.toBeChecked();

    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByRole('radio', { name: alternativa(p2, 'min').rotulo, exact: true })).toBeChecked();
  });

  test('funciona só com o teclado: setas escolhem a alternativa e Enter avança', async ({ page }) => {
    await abrir(page);
    await page.getByRole('radio').first().focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio').first()).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio').nth(1)).toBeChecked();

    const proxima = page.getByRole('button', { name: 'Próxima' });
    for (let i = 0; i < 4 && !(await proxima.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(proxima).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: titulo(2) })).toBeVisible();
  });

  test('foco visível nas alternativas e nos botões', async ({ page }) => {
    await abrir(page);
    await page.keyboard.press('Tab'); // link para pular
    await page.getByRole('radio').first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const alternativaFocada = page.getByRole('radio').first();
    await expect(alternativaFocada).toBeFocused();
    expect((await contorno(alternativaFocada)).largura).toBeGreaterThanOrEqual(3);

    await escolherNaTela(page, QUIZ.perguntas[0].opcoes[0].rotulo);
    const proxima = page.getByRole('button', { name: 'Próxima' });
    await page.keyboard.press('Tab');
    await expect(proxima).toBeFocused();
    const c = await contorno(proxima);
    expect(c.estilo).not.toBe('none');
    expect(c.largura).toBeGreaterThanOrEqual(3);
  });

  test('resultado com as respostas mais baixas: todas as categorias na primeira faixa', async ({ page }) => {
    await abrir(page);
    await responderTudo(page, () => 'min');
    await expect(page.getByRole('heading', { level: 2, name: 'Seu resultado' })).toBeFocused();
    await expect(page.getByText(QUIZ.resultado.introducao)).toBeVisible();
    await expect(page.getByText(QUIZ.resultado.aviso)).toBeVisible();

    const itens = page.locator('.quiz-item');
    await expect(itens).toHaveCount(QUIZ.categorias.length);
    for (const item of await itens.all()) {
      await expect(item).toHaveAttribute('data-faixa', PRIMEIRA_FAIXA.id);
      await expect(item).toContainText(PRIMEIRA_FAIXA.rotulo);
      await expect(item).toContainText(PRIMEIRA_FAIXA.mensagem);
    }
    for (const categoria of QUIZ.categorias) {
      await expect(page.getByRole('heading', { level: 4, name: categoria.rotulo, exact: true })).toBeVisible();
    }
    if (PRIMEIRA_FAIXA.destacar) {
      await expect(page.getByRole('heading', { level: 3, name: 'Temas que merecem mais atenção' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: 'Demais temas' })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Refazer o teste' })).toBeVisible();
  });

  test('resultado com as respostas mais altas: última faixa em todas as categorias', async ({ page }) => {
    await abrir(page);
    await responderTudo(page, () => 'max');
    for (const item of await page.locator('.quiz-item').all()) {
      await expect(item).toHaveAttribute('data-faixa', ULTIMA_FAIXA.id);
      await expect(item).toContainText(ULTIMA_FAIXA.rotulo);
    }
    if (!ULTIMA_FAIXA.destacar) {
      await expect(page.getByRole('heading', { level: 3, name: 'Temas que merecem mais atenção' })).toHaveCount(0);
      await expect(page.getByText(QUIZ.resultado.semDestaque)).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: 'Demais temas' })).toBeVisible();
    }
  });

  test('resultado misto: destaca só a categoria com respostas mais baixas', async ({ page }) => {
    const alvo = 'movimento';
    await abrir(page);
    await responderTudo(page, (p) => (p.categoria === alvo ? 'min' : 'max'));
    for (const categoria of QUIZ.categorias) {
      const faixa = categoria.id === alvo ? PRIMEIRA_FAIXA : ULTIMA_FAIXA;
      await expect(page.locator('.quiz-item').filter({ has: page.getByRole('heading', { name: categoria.rotulo, exact: true }) })).toHaveAttribute('data-faixa', faixa.id);
    }
    if (PRIMEIRA_FAIXA.destacar && !ULTIMA_FAIXA.destacar) {
      const destaque = page.locator('.quiz-lista').first().locator('.quiz-item');
      await expect(destaque).toHaveCount(1);
      await expect(destaque).toContainText(QUIZ.categorias.find((c) => c.id === alvo)!.rotulo);
      await expect(page.locator('.quiz-lista').nth(1).locator('.quiz-item')).toHaveCount(QUIZ.categorias.length - 1);
    }
  });

  test('refazer o teste volta à primeira pergunta, sem respostas, e o teste pode ser repetido', async ({ page }) => {
    await abrir(page);
    await responderTudo(page, () => 'min');
    await page.getByRole('button', { name: 'Refazer o teste' }).click();
    await expect(page.getByRole('heading', { level: 2, name: titulo(1) })).toBeFocused();
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');
    await expect(page.getByRole('heading', { name: 'Seu resultado' })).toHaveCount(0);

    await responderTudo(page, () => 'max');
    await expect(page.locator('.quiz-item').first()).toHaveAttribute('data-faixa', ULTIMA_FAIXA.id);
  });

  test('os links do resultado existem e respondem: nenhum link quebrado', async ({ page }) => {
    await abrir(page);
    await responderTudo(page, () => 'min');
    const hrefs = await page.locator('.quiz-painel a').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(BASE), `href "${href}"`).toBe(true);
      expect((await page.request.get(href)).status(), `GET ${href}`).toBe(200);
    }
    await expect(page.getByRole('link', { name: 'Ver todos os temas do site' })).toBeVisible();
    // Nenhum tema aprovado existe ainda: os itens destacados avisam, em vez de gerar link.
    const destacados = await page.locator('.quiz-item').filter({ has: page.locator('xpath=self::*[@data-faixa]') }).count();
    expect(destacados).toBeGreaterThan(0);
    await expect(page.getByText('O conteúdo desta área ainda está em preparação.')).toHaveCount(PRIMEIRA_FAIXA.destacar ? QUIZ.categorias.length : 0);
  });

  test('integração no site: link no menu, chamada na página inicial e frase de privacidade em Sobre', async ({ page }) => {
    await page.goto('');
    const menu = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Teste seus hábitos' });
    await expect(menu).toHaveAttribute('href', `${BASE}quiz/`);
    await expect(page.getByRole('link', { name: 'Fazer o teste' })).toHaveAttribute('href', `${BASE}quiz/`);
    await menu.click();
    await expect(page).toHaveURL(/\/conecta-saude\/quiz\/$/);
    await page.goto('sobre/');
    await expect(page.getByText('As respostas do teste ficam apenas na memória do navegador')).toBeVisible();
  });

  test.describe('viewport móvel (360 px)', () => {
    test('sem rolagem horizontal e com áreas de toque de ao menos 44 px', async ({ page }) => {
      const semRolagem = async () => {
        const m = await page.evaluate(() => ({ janela: window.innerWidth, conteudo: document.documentElement.scrollWidth }));
        expect(m.janela).toBe(360);
        expect(m.conteudo).toBeLessThanOrEqual(m.janela);
      };
      await abrir(page);
      await semRolagem();
      for (const opcao of await page.locator('.quiz-opcao').all()) expect((await opcao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      for (const botao of await page.locator('.quiz-acoes .botao').all()) {
        const caixa = (await botao.boundingBox())!;
        expect(caixa.height).toBeGreaterThanOrEqual(44);
        expect(caixa.width).toBeGreaterThanOrEqual(44);
      }
      await escolherNaTela(page, QUIZ.perguntas[0].opcoes[0].rotulo);
      await semRolagem();
      await page.getByRole('button', { name: 'Próxima' }).click();
      await semRolagem();

      await page.goto('quiz/');
      await responderTudo(page, () => 'min');
      await semRolagem();
      for (const botao of await page.locator('.quiz-acoes .botao').all()) expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('acessibilidade (axe)', () => {
    const analisar = async (page: Page) =>
      grave((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations);

    test('pergunta, pergunta com alternativa selecionada e resultado', async ({ page }) => {
      await abrir(page);
      expect(await analisar(page)).toEqual([]);
      await escolherNaTela(page, QUIZ.perguntas[0].opcoes[0].rotulo);
      expect(await analisar(page)).toEqual([]);
      await page.getByRole('button', { name: 'Próxima' }).click();
      await page.getByRole('button', { name: 'Próxima' }).click({ force: true }); // bloqueado: mostra o aviso
      expect(await analisar(page)).toEqual([]);
      await page.goto('quiz/');
      await responderTudo(page, () => 'min');
      expect(await analisar(page)).toEqual([]);
    });
  });

  test.describe('privacidade das respostas', () => {
    test('percorrer o teste não faz requisições, não grava nada e não altera a URL', async ({ page, context }) => {
      await instrumentarGravacoes(page);
      await page.addInitScript(() => {
        const violacoes: string[] = [];
        Object.defineProperty(window, '__violacoes', { value: violacoes });
        document.addEventListener('securitypolicyviolation', (e) => violacoes.push(e.violatedDirective));
      });
      await abrir(page);
      await page.waitForLoadState('networkidle');

      const urlInicial = page.url();
      const historico = await page.evaluate(() => history.length);
      const requisicoes: string[] = [];
      page.on('request', (r) => requisicoes.push(`${r.method()} ${r.url()}`));

      await responderTudo(page, (p) => (QUIZ.perguntas.indexOf(p) % 2 === 0 ? 'min' : 'max'));
      expect(page.url()).toBe(urlInicial);
      await page.getByRole('button', { name: 'Refazer o teste' }).click();
      await responderTudo(page, () => 'max');

      expect(requisicoes, 'nenhuma requisição durante o preenchimento').toEqual([]);
      expect(await page.evaluate(() => [...((window as unknown as { __violacoes: string[] }).__violacoes)]), 'nenhuma tentativa bloqueada pela política de segurança').toEqual([]);
      expect(page.url()).toBe(urlInicial);
      expect(await page.evaluate(() => history.length)).toBe(historico);
      expect(await gravacoes(page), 'nenhuma escrita em armazenamento instrumentado').toEqual([]);
      await expect(page.locator('form')).toHaveCount(0);

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

    test('recarregar a página apaga as respostas', async ({ page }) => {
      await abrir(page);
      await escolherNaTela(page, QUIZ.perguntas[0].opcoes[0].rotulo);
      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect(page.getByRole('heading', { level: 2, name: titulo(2) })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { level: 2, name: titulo(1) })).toBeVisible();
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });

    test('o navegador bloqueia envio de dados pela página (CSP connect-src e form-action)', async ({ page }) => {
      await abrir(page);
      await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /connect-src 'none'/);
      const resultado = await page.evaluate(async () => {
        const violacoes: string[] = [];
        document.addEventListener('securitypolicyviolation', (e) => violacoes.push(e.violatedDirective));
        const fetchBloqueado = await fetch(location.href).then(() => false, () => true);
        const xhrBloqueado = await new Promise<boolean>((resolver) => {
          const xhr = new XMLHttpRequest();
          xhr.onerror = () => resolver(true);
          xhr.onload = () => resolver(false);
          xhr.open('GET', location.href);
          xhr.send();
        });
        navigator.sendBeacon(location.href, 'dados'); // devolve true ao enfileirar; o bloqueio vem como violação
        const formulario = document.createElement('form');
        formulario.action = location.href;
        document.body.append(formulario);
        formulario.requestSubmit();
        await new Promise((resolver) => setTimeout(resolver, 300));
        return { fetchBloqueado, xhrBloqueado, violacoes };
      });
      expect(resultado.fetchBloqueado).toBe(true);
      expect(resultado.xhrBloqueado).toBe(true);
      expect(resultado.violacoes.filter((v) => v.startsWith('connect-src'))).toHaveLength(3);
      expect(resultado.violacoes.filter((v) => v.startsWith('form-action')).length).toBeGreaterThanOrEqual(1);
    });

    test.describe('sem JavaScript', () => {
      test.use({ javaScriptEnabled: false });

      test('explica que o teste precisa de JavaScript e não mostra perguntas', async ({ page }) => {
        await page.goto('quiz/');
        const texto = await page.locator('body').innerText();
        expect(texto).toContain('O teste precisa de JavaScript ativado no navegador.');
        expect(texto).not.toContain('Carregando o teste');
        await expect(page.getByRole('radio')).toHaveCount(0);
      });
    });
  });
});

test.describe('quiz (build de produção)', () => {
  test.skip(ALVO !== 'producao', 'a ausência do quiz é verificada sobre o build de produção');

  test('a página do quiz não existe enquanto o estágio for "preparacao"', async ({ page }) => {
    const resposta = await page.goto('quiz/');
    expect(resposta?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible();
  });

  test('o site não menciona o quiz e continua sem nenhum JavaScript', async ({ page }) => {
    for (const caminho of ['', 'sobre/', 'nao-existe/']) {
      const html = await (await page.request.get(caminho)).text();
      expect(html, caminho).not.toContain('Teste seus hábitos');
      expect(html, caminho).not.toContain('respostas do teste');
      expect(html, caminho).not.toContain('<script');
    }
    await page.goto('');
    await expect(page.getByRole('link', { name: 'Teste seus hábitos' })).toHaveCount(0);
  });
});
