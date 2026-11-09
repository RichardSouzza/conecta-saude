import { afterEach, describe, expect, it } from 'vitest';
import { verificarLinks } from '../../scripts/check-links.mjs';
import { criarDist, limparDists } from './helpers';

const BASE = '/conecta-saude';
const pagina = (corpo: string) => `<!doctype html><html><body>${corpo}</body></html>`;

afterEach(limparDists);

describe('verificarLinks', () => {
  it('aceita links internos com base, externos e âncoras', () => {
    const dist = criarDist({
      'index.html': pagina(
        `<a href="${BASE}/sobre/">Sobre</a><a href="https://exemplo.org/">Externo</a><a href="#conteudo">Ir</a><link rel="icon" href="${BASE}/favicon.svg">`,
      ),
      'sobre/index.html': pagina(`<a href="${BASE}/">Início</a>`),
      'favicon.svg': '<svg/>',
    });
    expect(verificarLinks({ distDir: dist, base: BASE })).toEqual([]);
  });

  it('detecta link quebrado', () => {
    const dist = criarDist({ 'index.html': pagina(`<a href="${BASE}/nao-existe/">x</a>`) });
    expect(verificarLinks({ distDir: dist, base: BASE }).join('\n')).toContain('link quebrado');
  });

  it('detecta link absoluto sem o caminho-base', () => {
    const dist = criarDist({ 'index.html': pagina('<a href="/sobre/">x</a>'), 'sobre/index.html': pagina('') });
    expect(verificarLinks({ distDir: dist, base: BASE }).join('\n')).toContain('não usa o caminho-base');
  });

  it('resolve links relativos a partir da página', () => {
    const dist = criarDist({
      'temas/a/index.html': pagina('<a href="../b/">b</a>'),
      'temas/b/index.html': pagina(''),
    });
    expect(verificarLinks({ distDir: dist, base: BASE })).toEqual([]);
  });
});
