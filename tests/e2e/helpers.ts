import type { Page } from '@playwright/test';

export const BASE = '/conecta-saude/';

export const PAGINAS = [
  { nome: 'início', caminho: '', status: 200 },
  { nome: 'sobre', caminho: 'sobre/', status: 200 },
  { nome: '404', caminho: 'nao-existe/', status: 404 },
];

/**
 * Observa, enquanto a página carrega: erros de console e de JavaScript, requisições a outras origens
 * e recursos (CSS, imagens, scripts...) que respondem com erro HTTP.
 * O status do próprio documento é verificado à parte: a página 404 responde 404 de propósito, e o
 * navegador registra isso no console, então esse aviso específico é ignorado.
 */
export function observar(page: Page, baseURL: string) {
  const origem = new URL(baseURL).origin;
  const erros: string[] = [];
  const externas: string[] = [];
  const falhas: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text());
  });
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('requestfailed', (r) => falhas.push(`${r.url()} (${r.failure()?.errorText ?? 'falhou'})`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.request().resourceType() !== 'document') falhas.push(`${r.url()} (HTTP ${r.status()})`);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (new URL(u).origin !== origem) externas.push(u);
  });
  return { erros, externas, falhas };
}

/** Estilo de contorno efetivo do elemento (para provar que o foco é visível). */
export async function contorno(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((el) => {
    const c = getComputedStyle(el);
    return { estilo: c.outlineStyle, largura: Number.parseFloat(c.outlineWidth), deslocamento: c.outlineOffset };
  });
}
