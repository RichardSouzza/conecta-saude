// O GitHub Pages serve o site em /<repositorio>/: todo link interno deve passar por url().
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function url(caminho = '/'): string {
  const limpo = caminho.startsWith('/') ? caminho : `/${caminho}`;
  return `${base}${limpo}`;
}
