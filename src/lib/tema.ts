import { z } from 'astro/zod';

export const AREAS = [
  'Enfermagem',
  'Nutrição',
  'Fisioterapia',
  'Odontologia',
  'Psicologia',
  'Biomedicina',
  'Computação',
] as const;

export const STATUS = ['rascunho', 'aprovado'] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function dataIsoValida(valor: string): boolean {
  if (!DATA_ISO.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Datas só são aceitas como texto: o YAML converte datas sem aspas em Date e "2026-02-30" viraria 02/03.
const dataCampo = (campo: string) =>
  z
    .string({ error: `${campo} deve ser um texto entre aspas no formato "AAAA-MM-DD"` })
    .refine(dataIsoValida, `${campo} deve ser uma data real no formato AAAA-MM-DD`)
    .refine((valor) => !dataIsoValida(valor) || valor <= new Date().toISOString().slice(0, 10), `${campo} não pode estar no futuro`);

const texto = (campo: string, minimo: number) =>
  z
    .string({ error: `${campo} é obrigatório e deve ser um texto` })
    .trim()
    .min(minimo, `${campo} deve ter ao menos ${minimo} caracteres`);

const camposDesconhecidos = (iss: { code: string; keys?: string[] }) =>
  iss.code === 'unrecognized_keys' ? `campo(s) desconhecido(s): ${(iss.keys ?? []).join(', ')}` : undefined;

const urlHttps = z
  .string({ error: 'url é obrigatória e deve ser um texto' })
  .refine((valor) => {
    try {
      return new URL(valor).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'url deve ser um endereço https válido');

const referenciaSchema = z.strictObject(
  {
    titulo: texto('titulo', 3),
    instituicao: texto('instituicao', 2),
    url: urlHttps,
    acessadoEm: dataCampo('acessadoEm'),
  },
  { error: camposDesconhecidos },
);

export const temaSchema = z
  .strictObject(
    {
      title: texto('title', 3).max(120, 'title deve ter no máximo 120 caracteres'),
      area: z.enum(AREAS, { error: `area deve ser uma destas: ${AREAS.join(', ')}` }),
      icone: texto('icone', 1).max(16, 'icone deve ter no máximo 16 caracteres'),
      resumo: texto('resumo', 20).max(280, 'resumo deve ter no máximo 280 caracteres'),
      ordem: z
        .number({ error: 'ordem é obrigatória e deve ser um número' })
        .int('ordem deve ser um número inteiro')
        .min(1, 'ordem deve ser maior ou igual a 1'),
      status: z.enum(STATUS, { error: 'status é obrigatório e deve ser "rascunho" ou "aprovado"' }),
      revisadoPor: texto('revisadoPor', 3).optional(),
      revisadoEm: dataCampo('revisadoEm').optional(),
      referencias: z.array(referenciaSchema, { error: 'referencias deve ser uma lista' }).default([]),
    },
    { error: camposDesconhecidos },
  )
  .superRefine((tema, ctx) => {
    if (tema.status !== 'aprovado') return;
    if (!tema.revisadoPor) {
      ctx.addIssue({ code: 'custom', path: ['revisadoPor'], message: 'tema aprovado exige revisadoPor (quem revisou)' });
    }
    if (!tema.revisadoEm) {
      ctx.addIssue({ code: 'custom', path: ['revisadoEm'], message: 'tema aprovado exige revisadoEm (data da revisão)' });
    }
    if (tema.referencias.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['referencias'], message: 'tema aprovado exige ao menos uma referência' });
    }
  });

export type TemaData = z.infer<typeof temaSchema>;

type ComStatus = { data: { status: string } };
type Ordenavel = { id: string; data: { ordem: number; title: string } };

// Rascunhos só existem no build de teste; o status ausente nunca equivale a aprovado (o schema o exige).
export function selecionarPublicaveis<T extends ComStatus>(entradas: readonly T[], modoTeste: boolean): T[] {
  return entradas.filter((entrada) => modoTeste || entrada.data.status === 'aprovado');
}

export function ordenarTemas<T extends Ordenavel>(entradas: readonly T[]): T[] {
  return [...entradas].sort(
    (a, b) => a.data.ordem - b.data.ordem || a.data.title.localeCompare(b.data.title, 'pt-BR') || a.id.localeCompare(b.id),
  );
}

export function validarSlug(id: string): void {
  if (!SLUG.test(id)) {
    throw new Error(
      `Nome de arquivo inválido para um tema: "${id}.md". Use minúsculas, números e hífens, sem acentos (ex.: saude-mental.md).`,
    );
  }
}
