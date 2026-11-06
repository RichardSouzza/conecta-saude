import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const PERMITIDOS = new Set(['lib/conteudo.ts']);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|astro)$/.test(nome) ? [caminho] : [];
  });
}

const posix = (caminho: string) => relative(SRC, caminho).split(sep).join('/');

describe('acesso à coleção de temas', () => {
  it('somente lib/conteudo.ts consulta a coleção, para que rascunhos não vazem por outro caminho', () => {
    const infratores = arquivos(SRC)
      .filter((arquivo) => !PERMITIDOS.has(posix(arquivo)))
      .filter((arquivo) => /\b(getCollection|getEntry|getEntries)\s*\(/.test(readFileSync(arquivo, 'utf8')))
      .map(posix);
    expect(infratores).toEqual([]);
  });

  it('a página dinâmica e a página inicial obtêm os temas por listarTemas()', () => {
    for (const pagina of ['pages/temas/[slug].astro', 'pages/index.astro']) {
      expect(readFileSync(join(SRC, pagina), 'utf8'), pagina).toContain('listarTemas()');
    }
  });

  it('a coleção usa o schema compartilhado, sem redefini-lo', () => {
    const config = readFileSync(join(SRC, 'content.config.ts'), 'utf8');
    expect(config).toContain('schema: temaSchema');
  });
});
