import { describe, expect, it } from 'vitest';
import quizReal from '../../src/data/quiz.json';
import release from '../../release.config.json';
import { MAX_PERGUNTAS, MIN_PERGUNTAS, quizSchema, validarQuiz } from '../../src/lib/quiz/schema';
import { aprovacoesDeTeste, quizDeTeste } from './quiz-fixtures';

function problemas(entrada: unknown): string[] {
  const resultado = quizSchema.safeParse(entrada);
  return resultado.success ? [] : resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

const com = (mudar: (quiz: ReturnType<typeof quizDeTeste>) => void) => {
  const quiz = quizDeTeste();
  mudar(quiz);
  return problemas(quiz).join('\n');
};

describe('quiz.json do repositório', () => {
  it('é válido pelo schema', () => {
    expect(() => validarQuiz(quizReal)).not.toThrow();
  });

  it('tem de 8 a 10 perguntas', () => {
    expect(quizReal.perguntas.length).toBeGreaterThanOrEqual(MIN_PERGUNTAS);
    expect(quizReal.perguntas.length).toBeLessThanOrEqual(MAX_PERGUNTAS);
  });

  it('declara exatamente as categorias de release.config.json, sem duplicar a lista', () => {
    expect(quizReal.categorias.map((c) => c.id).sort()).toEqual([...release.categoriasObrigatorias].sort());
  });

  it('vincula cada categoria a um tema obrigatório do release.config.json', () => {
    for (const categoria of quizReal.categorias) {
      expect(release.temasObrigatorios, `tema da categoria "${categoria.id}"`).toContain(categoria.tema);
    }
  });

  it('não registra aprovações enquanto estiver em demonstração', () => {
    if (quizReal.status === 'demonstracao') expect(quizReal.aprovacoes).toEqual([]);
  });
});

describe('estrutura do quiz', () => {
  it('aceita o quiz de teste', () => {
    expect(problemas(quizDeTeste())).toEqual([]);
  });

  it('rejeita menos de 8 e mais de 10 perguntas', () => {
    expect(com((q) => q.perguntas.pop())).toContain('de 8 a 10 perguntas');
    expect(
      com((q) => {
        q.perguntas.push({ ...q.perguntas[0], id: 'q9' }, { ...q.perguntas[0], id: 'q10' }, { ...q.perguntas[0], id: 'q11' });
      }),
    ).toContain('de 8 a 10 perguntas');
  });

  it.each([
    ['perguntas', (q: ReturnType<typeof quizDeTeste>) => { q.perguntas[1].id = 'q1'; }, 'perguntas.1.id: "q1" está repetido'],
    ['categorias', (q: ReturnType<typeof quizDeTeste>) => { q.categorias[1].id = 'cat-a'; }, 'categorias.1.id: "cat-a" está repetido'],
    ['faixas', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[1].id = 'baixa'; }, 'faixas.1.id: "baixa" está repetido'],
  ])('rejeita ids repetidos em %s', (_nome, mudar, trecho) => {
    expect(com(mudar)).toContain(trecho);
  });

  it('rejeita alternativas repetidas dentro da mesma pergunta', () => {
    expect(com((q) => { q.perguntas[0].opcoes[1].id = 'a'; })).toContain('a alternativa "a" está repetida na pergunta "q1"');
  });

  it('rejeita pergunta com categoria inexistente', () => {
    expect(com((q) => { q.perguntas[0].categoria = 'outra'; })).toContain('a categoria "outra" não está declarada');
  });

  it('rejeita categoria sem perguntas', () => {
    expect(com((q) => { q.categorias.push({ id: 'cat-c', rotulo: 'Categoria C', tema: 'tema-c' }); })).toContain(
      'a categoria "cat-c" não tem nenhuma pergunta',
    );
  });

  it('rejeita categoria com pontuação máxima zero', () => {
    const erros = com((q) => {
      for (const p of q.perguntas.filter((x) => x.categoria === 'cat-b')) p.opcoes.forEach((o) => { o.pontos = 0; });
    });
    expect(erros).toContain('a categoria "cat-b" não pode ter pontuação máxima zero');
  });

  it('exige de 2 a 4 alternativas por pergunta', () => {
    expect(com((q) => { q.perguntas[0].opcoes.pop(); q.perguntas[0].opcoes.pop(); })).toContain('de 2 a 4 alternativas');
    expect(com((q) => { q.perguntas[0].opcoes.push({ id: 'd', rotulo: 'Quarta', pontos: 0 }, { id: 'e', rotulo: 'Quinta', pontos: 0 }); })).toContain('de 2 a 4 alternativas');
  });

  it.each([
    ['negativos', -1, 'pontos deve ser maior ou igual a 0'],
    ['acima do máximo', 3, 'pontos deve ser no máximo 2'],
    ['decimais', 1.5, 'pontos deve ser um número inteiro'],
    ['em texto', '1', 'pontos é obrigatório e deve ser um número'],
  ])('rejeita pontos %s', (_nome, valor, trecho) => {
    expect(com((q) => { (q.perguntas[0].opcoes[0] as { pontos: unknown }).pontos = valor; })).toContain(trecho);
  });

  it('rejeita ids fora do padrão e campos desconhecidos', () => {
    expect(com((q) => { q.perguntas[0].id = 'Pergunta 1'; })).toContain('minúsculas, números e hífens');
    expect(com((q) => { (q as unknown as Record<string, unknown>).extra = 1; })).toContain('campo(s) desconhecido(s): extra');
  });
});

describe('faixas de classificação', () => {
  it.each([
    ['lacuna entre faixas', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[1].de = 55; }, 'sem lacuna nem sobreposição'],
    ['sobreposição entre faixas', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[1].de = 45; }, 'sem lacuna nem sobreposição'],
    ['primeira faixa fora de 0', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[0].de = 5; }, 'a primeira faixa deve começar em 0'],
    ['última faixa fora de 100', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[2].ate = 95; }, 'a última faixa deve terminar em 100'],
    ['faixa invertida', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[1].ate = 40; }, 'deve ter "de" menor que "ate"'],
    ['nenhuma faixa em destaque', (q: ReturnType<typeof quizDeTeste>) => { q.faixas[0].destacar = false; }, 'ao menos uma faixa deve ter destacar verdadeiro'],
    ['faixa única', (q: ReturnType<typeof quizDeTeste>) => { q.faixas.splice(1); q.faixas[0].ate = 100; }, 'informe ao menos duas faixas'],
  ])('rejeita %s', (_nome, mudar, trecho) => {
    expect(com(mudar)).toContain(trecho);
  });
});

describe('aprovação do quiz', () => {
  it('aceita o status "aprovado" com a aprovação de todas as categorias', () => {
    expect(com((q) => { q.status = 'aprovado'; q.aprovacoes = aprovacoesDeTeste; })).toBe('');
  });

  it('rejeita "aprovado" sem nenhuma aprovação registrada, apontando cada categoria', () => {
    const erros = com((q) => { q.status = 'aprovado'; });
    expect(erros).toContain('quiz aprovado exige a aprovação da categoria "cat-a"');
    expect(erros).toContain('quiz aprovado exige a aprovação da categoria "cat-b"');
  });

  it('rejeita "aprovado" com uma categoria sem aprovação', () => {
    const erros = com((q) => { q.status = 'aprovado'; q.aprovacoes = [aprovacoesDeTeste[0]]; });
    expect(erros).toContain('exige a aprovação da categoria "cat-b"');
    expect(erros).not.toContain('categoria "cat-a"');
  });

  it('não trata aprovações registradas como aprovação do quiz: o status precisa ser "aprovado"', () => {
    const quiz = quizDeTeste();
    quiz.aprovacoes = aprovacoesDeTeste;
    expect(quizSchema.parse(quiz).status).toBe('demonstracao');
  });

  it('rejeita aprovação duplicada e de categoria inexistente', () => {
    expect(com((q) => { q.aprovacoes = [aprovacoesDeTeste[0], aprovacoesDeTeste[0]]; })).toContain('aprovacoes.1.categoria: "cat-a" está repetido');
    expect(com((q) => { q.aprovacoes = [{ ...aprovacoesDeTeste[0], categoria: 'outra' }]; })).toContain('a categoria "outra" não está declarada');
  });

  it.each([
    ['sem revisor', { aprovadoPor: '' }, 'aprovadoPor'],
    ['data inexistente', { aprovadoEm: '2026-02-30' }, 'aprovadoEm deve ser uma data real'],
    ['data futura', { aprovadoEm: '2999-01-01' }, 'aprovadoEm não pode estar no futuro'],
  ])('rejeita aprovação %s', (_nome, mudanca, trecho) => {
    expect(com((q) => { q.aprovacoes = [{ ...aprovacoesDeTeste[0], ...mudanca }]; })).toContain(trecho);
  });

  it('rejeita status desconhecido', () => {
    expect(com((q) => { (q as { status: string }).status = 'publicado'; })).toContain('status é obrigatório');
  });
});

describe('validarQuiz', () => {
  it('lança um erro em português com o caminho de cada problema', () => {
    const quiz = quizDeTeste();
    quiz.perguntas.pop();
    quiz.faixas[0].de = 5;
    expect(() => validarQuiz(quiz, 'arquivo-de-teste.json')).toThrow(/Quiz inválido \(arquivo-de-teste\.json\):\n {2}- perguntas: o quiz deve ter de 8 a 10 perguntas/);
    expect(() => validarQuiz(quiz)).toThrow(/faixas\.0\.de: a primeira faixa deve começar em 0/);
  });
});
