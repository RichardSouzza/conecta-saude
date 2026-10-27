// Todos os links internos passam por aqui para respeitar o `base` do Astro
// (no GitHub Pages o site vive em /<repositorio>/).
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** url('/sobre/') -> '/conecta-saude/sobre/' (com base configurado). */
export function url(caminho = '/'): string {
  const limpo = caminho.startsWith('/') ? caminho : `/${caminho}`;
  return `${base}${limpo}`;
}
