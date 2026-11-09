export interface LinkTema {
  titulo: string;
  href: string;
}

// Só devolve links para temas efetivamente publicados no build atual; os demais ficam de fora.
export function montarLinks(
  categorias: readonly { tema: string }[],
  publicados: readonly { id: string; titulo: string }[],
  url: (caminho: string) => string,
): Record<string, LinkTema> {
  const titulos = new Map(publicados.map((t) => [t.id, t.titulo]));
  const links: Record<string, LinkTema> = {};
  for (const { tema } of categorias) {
    const titulo = titulos.get(tema);
    if (titulo !== undefined && !(tema in links)) links[tema] = { titulo, href: url(`/temas/${tema}/`) };
  }
  return links;
}

export function linkDaListagem(publicados: readonly unknown[], url: (caminho: string) => string): { href: string } | null {
  return publicados.length > 0 ? { href: url('/#titulo-temas') } : null;
}
