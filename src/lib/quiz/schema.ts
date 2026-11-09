import { z } from 'astro/zod';
import { camposDesconhecidos, dataCampo, SLUG, texto } from '../tema';

export const PONTOS_MAXIMO = 2;
export const MIN_PERGUNTAS = 8;
export const MAX_PERGUNTAS = 10;
export const STATUS_QUIZ = ['demonstracao', 'aprovado'] as const;

const identificador = (campo: string) =>
  z
    .string({ error: `${campo} é obrigatório e deve ser um texto` })
    .regex(SLUG, `${campo} deve usar minúsculas, números e hífens`);

const percentual = (campo: string) =>
  z
    .number({ error: `${campo} é obrigatório e deve ser um número` })
    .int(`${campo} deve ser um número inteiro`)
    .min(0, `${campo} deve ser maior ou igual a 0`)
    .max(100, `${campo} deve ser menor ou igual a 100`);

const opcaoSchema = z.strictObject(
  {
    id: identificador('id da alternativa'),
    rotulo: texto('rotulo', 2),
    pontos: z
      .number({ error: 'pontos é obrigatório e deve ser um número' })
      .int('pontos deve ser um número inteiro')
      .min(0, 'pontos deve ser maior ou igual a 0')
      .max(PONTOS_MAXIMO, `pontos deve ser no máximo ${PONTOS_MAXIMO}`),
  },
  { error: camposDesconhecidos },
);

const perguntaSchema = z.strictObject(
  {
    id: identificador('id da pergunta'),
    categoria: identificador('categoria'),
    texto: texto('texto', 10),
    opcoes: z
      .array(opcaoSchema, { error: 'opcoes deve ser uma lista' })
      .min(2, 'cada pergunta deve ter de 2 a 4 alternativas')
      .max(4, 'cada pergunta deve ter de 2 a 4 alternativas'),
  },
  { error: camposDesconhecidos },
);

const categoriaSchema = z.strictObject(
  {
    id: identificador('id da categoria'),
    rotulo: texto('rotulo', 3),
    tema: identificador('tema'),
  },
  { error: camposDesconhecidos },
);

const faixaSchema = z.strictObject(
  {
    id: identificador('id da faixa'),
    rotulo: texto('rotulo', 3),
    de: percentual('de'),
    ate: percentual('ate'),
    destacar: z.boolean({ error: 'destacar é obrigatório e deve ser verdadeiro ou falso' }),
    mensagem: texto('mensagem', 10),
  },
  { error: camposDesconhecidos },
);

const aprovacaoSchema = z.strictObject(
  {
    categoria: identificador('categoria'),
    aprovadoPor: texto('aprovadoPor', 3),
    aprovadoEm: dataCampo('aprovadoEm'),
  },
  { error: camposDesconhecidos },
);

const resultadoSchema = z.strictObject(
  {
    introducao: texto('introducao', 10),
    semDestaque: texto('semDestaque', 10),
    aviso: texto('aviso', 10),
  },
  { error: camposDesconhecidos },
);

export const quizSchema = z
  .strictObject(
    {
      status: z.enum(STATUS_QUIZ, { error: 'status é obrigatório e deve ser "demonstracao" ou "aprovado"' }),
      categorias: z.array(categoriaSchema, { error: 'categorias deve ser uma lista' }).min(1, 'informe ao menos uma categoria'),
      perguntas: z
        .array(perguntaSchema, { error: 'perguntas deve ser uma lista' })
        .min(MIN_PERGUNTAS, `o quiz deve ter de ${MIN_PERGUNTAS} a ${MAX_PERGUNTAS} perguntas`)
        .max(MAX_PERGUNTAS, `o quiz deve ter de ${MIN_PERGUNTAS} a ${MAX_PERGUNTAS} perguntas`),
      faixas: z.array(faixaSchema, { error: 'faixas deve ser uma lista' }).min(2, 'informe ao menos duas faixas'),
      resultado: resultadoSchema,
      aprovacoes: z.array(aprovacaoSchema, { error: 'aprovacoes deve ser uma lista' }).default([]),
    },
    { error: camposDesconhecidos },
  )
  .superRefine((quiz, ctx) => {
    const erro = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });

    const repetidos = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
    const marcarRepetidos = (lista: string, ids: string[], campo: string) => {
      ids.forEach((id, i) => {
        if (ids.indexOf(id) !== i) erro([lista, i, campo], `"${id}" está repetido`);
      });
    };

    const categorias = quiz.categorias.map((c) => c.id);
    marcarRepetidos('categorias', categorias, 'id');
    marcarRepetidos('perguntas', quiz.perguntas.map((p) => p.id), 'id');
    marcarRepetidos('faixas', quiz.faixas.map((f) => f.id), 'id');
    marcarRepetidos('aprovacoes', quiz.aprovacoes.map((a) => a.categoria), 'categoria');

    quiz.perguntas.forEach((pergunta, i) => {
      if (!categorias.includes(pergunta.categoria)) {
        erro(['perguntas', i, 'categoria'], `a categoria "${pergunta.categoria}" não está declarada em categorias`);
      }
      repetidos(pergunta.opcoes.map((o) => o.id)).forEach((id) => {
        erro(['perguntas', i, 'opcoes'], `a alternativa "${id}" está repetida na pergunta "${pergunta.id}"`);
      });
    });

    quiz.categorias.forEach((categoria, i) => {
      const doGrupo = quiz.perguntas.filter((p) => p.categoria === categoria.id);
      if (doGrupo.length === 0) {
        erro(['categorias', i, 'id'], `a categoria "${categoria.id}" não tem nenhuma pergunta`);
      } else if (doGrupo.reduce((soma, p) => soma + Math.max(...p.opcoes.map((o) => o.pontos)), 0) < 1) {
        erro(['categorias', i, 'id'], `a categoria "${categoria.id}" não pode ter pontuação máxima zero`);
      }
    });

    quiz.faixas.forEach((faixa, i) => {
      if (faixa.de >= faixa.ate) erro(['faixas', i], `a faixa "${faixa.id}" deve ter "de" menor que "ate"`);
      if (i === 0 && faixa.de !== 0) erro(['faixas', 0, 'de'], 'a primeira faixa deve começar em 0');
      if (i > 0 && faixa.de !== quiz.faixas[i - 1].ate) {
        erro(['faixas', i, 'de'], `a faixa "${faixa.id}" deve começar onde a anterior termina (${quiz.faixas[i - 1].ate}), sem lacuna nem sobreposição`);
      }
      if (i === quiz.faixas.length - 1 && faixa.ate !== 100) erro(['faixas', i, 'ate'], 'a última faixa deve terminar em 100');
    });
    if (!quiz.faixas.some((f) => f.destacar)) erro(['faixas'], 'ao menos uma faixa deve ter destacar verdadeiro');

    quiz.aprovacoes.forEach((aprovacao, i) => {
      if (!categorias.includes(aprovacao.categoria)) {
        erro(['aprovacoes', i, 'categoria'], `a categoria "${aprovacao.categoria}" não está declarada em categorias`);
      }
    });
    if (quiz.status === 'aprovado') {
      const aprovadas = quiz.aprovacoes.map((a) => a.categoria);
      categorias
        .filter((c) => !aprovadas.includes(c))
        .forEach((c) => erro(['aprovacoes'], `quiz aprovado exige a aprovação da categoria "${c}"`));
    }
  });

export type Quiz = z.infer<typeof quizSchema>;
export type Pergunta = Quiz['perguntas'][number];
export type Faixa = Quiz['faixas'][number];

export function validarQuiz(bruto: unknown, origem = 'src/data/quiz.json'): Quiz {
  const resultado = quizSchema.safeParse(bruto);
  if (resultado.success) return resultado.data;
  const linhas = resultado.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`);
  throw new Error(`Quiz inválido (${origem}):\n${linhas.join('\n')}`);
}
