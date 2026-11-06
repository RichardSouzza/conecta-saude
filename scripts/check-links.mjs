// Links externos (com esquema) e âncoras puras ficam fora da verificação.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function arquivosHtml(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const completo = join(dir, nome);
    if (statSync(completo).isDirectory()) saida.push(...arquivosHtml(completo));
    else if (nome.endsWith('.html')) saida.push(completo);
  }
  return saida;
}

export function verificarLinks({ distDir, base }) {
  const erros = [];
  const regex = /\s(?:href|src)=(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;

  for (const arquivo of arquivosHtml(distDir)) {
    const rel = relative(distDir, arquivo).split(sep).join('/');
    const caminhoPagina = rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel;
    const urlPagina = new URL(`${base}/${caminhoPagina}`, 'http://local');
    const html = readFileSync(arquivo, 'utf8');

    for (const m of html.matchAll(regex)) {
      const bruto = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (bruto === '' || bruto.startsWith('#') || bruto.startsWith('//')) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(bruto)) continue; // http:, https:, mailto:, tel:, data:

      const destino = new URL(bruto, urlPagina);
      if (base !== '' && destino.pathname !== `${base}` && !destino.pathname.startsWith(`${base}/`)) {
        erros.push(`${rel}: link "${bruto}" não usa o caminho-base "${base}".`);
        continue;
      }
      const restante = decodeURIComponent(destino.pathname.slice(base.length)) || '/';
      const candidatos = restante.endsWith('/')
        ? [join(distDir, restante, 'index.html')]
        : [join(distDir, restante), join(distDir, restante, 'index.html')];
      if (!candidatos.some((c) => existsSync(c) && statSync(c).isFile())) {
        erros.push(`${rel}: link quebrado "${bruto}".`);
      }
    }
  }
  return erros;
}

async function principal() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { default: config } = await import('../astro.config.mjs');
  const base = (config.base ?? '').replace(/\/+$/, '');
  const distDir = join(raiz, 'dist');
  if (!existsSync(distDir)) {
    console.error('✖ dist/ não existe. Rode o build antes.');
    process.exit(1);
  }
  const erros = verificarLinks({ distDir, base });
  if (erros.length > 0) {
    console.error('✖ Links internos com problema:');
    for (const e of erros) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✔ Links internos íntegros (base "${base || '/'}").`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await principal();
}
