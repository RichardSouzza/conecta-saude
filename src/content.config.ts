import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { temaSchema } from './lib/tema';

export const collections = {
  temas: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/temas' }),
    schema: temaSchema,
  }),
};
