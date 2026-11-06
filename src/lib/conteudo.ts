import { getCollection, type CollectionEntry } from 'astro:content';
import { ordenarTemas, selecionarPublicaveis, validarSlug } from './tema';

export type Tema = CollectionEntry<'temas'>;

// Único ponto de acesso à coleção: páginas e listagens só enxergam o que esta função devolve.
export const modoTeste = process.env.MODO === 'teste';

export async function listarTemas(): Promise<Tema[]> {
  const todos = await getCollection('temas');
  todos.forEach((tema) => validarSlug(tema.id));
  return ordenarTemas(selecionarPublicaveis(todos, modoTeste));
}
