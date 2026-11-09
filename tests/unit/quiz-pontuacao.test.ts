import { describe, expect, it } from 'vitest';
import quizReal from '../../src/data/quiz.json';
import { calcularResultado, classificar, maximoDaPergunta, perguntasPendentes, pontosDaResposta, RespostasInvalidasError } from '../../src/lib/quiz/pontuacao';
import { validarQuiz } from '../../src/lib/quiz/schema';
import { maximo, minimo, quizDeTeste, respostasTodas } from './quiz-fixtures';

const quiz = quizDeTeste();
const FAIXAS = quiz.faixas;
const nomes = (resultado: ReturnType<typeof calcularResultado>) => resultado.categorias.map((c) => `${c.categoria}:${c.faixa.id}`);

describe('pontuação das alternativas', () => {
  it('devolve os pontos da alternativa escolhida e o máximo da pergunta', () => {
    const pergunta = quiz.perguntas[0];
    expect(pontosDaResposta(pergunta, 'a')).toBe(2);
    expect(pontosDaResposta(pergunta, 'b')).toBe(1);
    expect(pontosDaResposta(pergunta, 'c')).toBe(0);
    expect(maximoDaPergunta(pergunta)).toBe(2);
  });

  it('rejeita alternativa inexistente', () => {
    expect(() => pontosDaResposta(quiz.perguntas[0], 'z')).toThrow(RespostasInvalidasError);
  });
});

describe('classificação por faixa (limites exatos)', () => {
  it.each([
    [4, 0, 'baixa'], [4, 1, 'baixa'], [4, 2, 'media'], [4, 3, 'media'], [4, 4, 'alta'],
    [2, 0, 'baixa'], [2, 1, 'media'], [2, 2, 'alta'],
    [5, 2, 'baixa'], [5, 3, 'media'], [5, 4, 'alta'], [5, 5, 'alta'],
    [3, 1, 'baixa'], [3, 2, 'media'], [3, 3, 'alta'],
    [10, 4, 'baixa'], [10, 5, 'media'], [10, 7, 'media'], [10, 8, 'alta'],
  ])('máximo %i, pontos %i -> %s', (max, pontos, esperado) => {
    expect(classificar(pontos, max, FAIXAS).id).toBe(esperado);
  });

  it('inclui o limite superior (100%) na última faixa e o inferior (0%) na primeira', () => {
    expect(classificar(0, 7, FAIXAS).id).toBe('baixa');
    expect(classificar(7, 7, FAIXAS).id).toBe('alta');
  });

  it('é ajustável pelos dados: limites de 34% e 67%', () => {
    const faixas = [
      { id: 'x', de: 0, ate: 34 },
      { id: 'y', de: 34, ate: 67 },
      { id: 'z', de: 67, ate: 100 },
    ];
    expect(classificar(33, 100, faixas).id).toBe('x');
    expect(classificar(34, 100, faixas).id).toBe('y');
    expect(classificar(66, 100, faixas).id).toBe('y');
    expect(classificar(67, 100, faixas).id).toBe('z');
    expect(classificar(1, 3, faixas).id).toBe('x');
    expect(classificar(2, 3, faixas).id).toBe('y');
  });

  it.each([
    ['máximo zero', 0, 0], ['máximo negativo', 1, -4], ['máximo decimal', 1, 2.5],
    ['pontos negativos', -1, 4], ['pontos acima do máximo', 5, 4], ['pontos decimais', 1.5, 4],
  ])('rejeita %s', (_nome, pontos, max) => {
    expect(() => classificar(pontos, max, FAIXAS)).toThrow(RangeError);
  });

  it('rejeita quando nenhuma faixa cobre a pontuação', () => {
    expect(() => classificar(4, 4, [{ de: 0, ate: 20 }, { de: 20, ate: 40 }])).toThrow(/Nenhuma faixa cobre/);
  });
});

describe('resultado por categoria', () => {
  it('todas as respostas mínimas colocam todas as categorias na primeira faixa', () => {
    const resultado = calcularResultado(quiz, respostasTodas(quiz, minimo));
    expect(nomes(resultado)).toEqual(['cat-a:baixa', 'cat-b:baixa']);
    expect(resultado.categorias.map((c) => [c.pontos, c.maximo])).toEqual([[0, 8], [0, 8]]);
    expect(resultado.destaque).toHaveLength(2);
    expect(resultado.demais).toHaveLength(0);
  });

  it('todas as respostas máximas colocam todas as categorias na última faixa, sem destaque', () => {
    const resultado = calcularResultado(quiz, respostasTodas(quiz, maximo));
    expect(nomes(resultado)).toEqual(['cat-a:alta', 'cat-b:alta']);
    expect(resultado.destaque).toHaveLength(0);
    expect(resultado.demais).toHaveLength(2);
  });

  it('identifica a dimensão que merece atenção quando só uma categoria está baixa', () => {
    const respostas = { ...respostasTodas(quiz, maximo), ...Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((id) => [id, 'c'])) };
    const resultado = calcularResultado(quiz, respostas);
    expect(nomes(resultado)).toEqual(['cat-a:baixa', 'cat-b:alta']);
    expect(resultado.destaque.map((c) => c.categoria)).toEqual(['cat-a']);
    expect(resultado.demais.map((c) => c.categoria)).toEqual(['cat-b']);
  });

  it('classifica a faixa intermediária pelos pontos somados da categoria', () => {
    const respostas = { ...respostasTodas(quiz, minimo), q1: 'a', q2: 'a', q3: 'b' }; // 5 de 8 = 62,5%
    const resultado = calcularResultado(quiz, respostas);
    expect(resultado.categorias[0]).toMatchObject({ categoria: 'cat-a', pontos: 5, maximo: 8, faixa: { id: 'media' } });
  });

  it('mantém a ordem das categorias do quiz e leva a mensagem e o tema de cada uma', () => {
    const resultado = calcularResultado(quiz, respostasTodas(quiz, minimo));
    expect(resultado.categorias.map((c) => c.categoria)).toEqual(['cat-a', 'cat-b']);
    expect(resultado.categorias[1]).toMatchObject({ rotulo: 'Categoria B', tema: 'tema-b', faixa: { mensagem: 'Mensagem fictícia da faixa baixa.' } });
  });
});

describe('respostas incompletas ou inválidas', () => {
  it('rejeita respostas incompletas informando as perguntas pendentes', () => {
    const respostas = respostasTodas(quiz, minimo);
    delete respostas.q3;
    delete respostas.q8;
    expect(perguntasPendentes(quiz, respostas)).toEqual(['q3', 'q8']);
    try {
      calcularResultado(quiz, respostas);
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(RespostasInvalidasError);
      expect((erro as RespostasInvalidasError).pendentes).toEqual(['q3', 'q8']);
      expect((erro as Error).message).toContain('Perguntas sem resposta: q3, q8');
    }
  });

  it('rejeita um conjunto vazio de respostas', () => {
    expect(() => calcularResultado(quiz, {})).toThrow(/Perguntas sem resposta/);
  });

  it('rejeita resposta para pergunta inexistente e alternativa inexistente', () => {
    expect(() => calcularResultado(quiz, { ...respostasTodas(quiz, minimo), q99: 'a' })).toThrow(/pergunta inexistente: q99/);
    expect(() => calcularResultado(quiz, { ...respostasTodas(quiz, minimo), q1: 'z' })).toThrow(/Alternativa "z" inexistente/);
  });
});

describe('determinismo', () => {
  it('o mesmo conjunto de respostas gera sempre o mesmo resultado, em qualquer ordem das chaves', () => {
    const respostas = { ...respostasTodas(quiz, minimo), q2: 'a', q6: 'b' };
    const invertidas = Object.fromEntries(Object.entries(respostas).reverse());
    expect(calcularResultado(quiz, respostas)).toEqual(calcularResultado(quiz, respostas));
    expect(calcularResultado(quiz, invertidas)).toEqual(calcularResultado(quiz, respostas));
  });

  it('não altera o quiz nem as respostas recebidos', () => {
    const respostas = Object.freeze({ ...respostasTodas(quiz, maximo) });
    const copiaQuiz = structuredClone(quiz);
    calcularResultado(quiz, respostas);
    expect(quiz).toEqual(copiaQuiz);
  });

  it('para todas as 6.561 combinações de respostas: partição consistente e faixa nunca cai com mais pontos', () => {
    const letras = ['a', 'b', 'c'];
    const ids = quiz.perguntas.map((p) => p.id);
    const total = 3 ** ids.length;
    const indiceDaFaixa = (id: string) => quiz.faixas.findIndex((f) => f.id === id);
    const melhorPorPontos = new Map<string, number>();

    for (let n = 0; n < total; n++) {
      const respostas: Record<string, string> = {};
      ids.forEach((id, i) => { respostas[id] = letras[Math.floor(n / 3 ** i) % 3]; });
      const resultado = calcularResultado(quiz, respostas);

      expect(resultado.destaque.length + resultado.demais.length).toBe(resultado.categorias.length);
      for (const c of resultado.categorias) {
        expect(c.pontos).toBeGreaterThanOrEqual(0);
        expect(c.pontos).toBeLessThanOrEqual(c.maximo);
        const chave = `${c.categoria}:${c.pontos}`;
        const indice = indiceDaFaixa(c.faixa.id);
        if (melhorPorPontos.has(chave)) expect(indice).toBe(melhorPorPontos.get(chave));
        melhorPorPontos.set(chave, indice);
      }
    }
    for (const categoria of ['cat-a', 'cat-b']) {
      const indices = Array.from({ length: 9 }, (_, p) => melhorPorPontos.get(`${categoria}:${p}`)!);
      expect(indices).toEqual([...indices].sort((x, y) => x - y));
    }
  });
});

describe('quiz.json do repositório', () => {
  const real = validarQuiz(quizReal);

  it('respostas mínimas e máximas levam à primeira e à última faixa em todas as categorias', () => {
    const minimas = calcularResultado(real, respostasTodas(real, minimo));
    const maximas = calcularResultado(real, respostasTodas(real, maximo));
    expect(minimas.categorias.every((c) => c.faixa.id === real.faixas[0].id)).toBe(true);
    expect(maximas.categorias.every((c) => c.faixa.id === real.faixas.at(-1)!.id)).toBe(true);
  });

  it('cada categoria tem pontuação máxima maior que zero', () => {
    const resultado = calcularResultado(real, respostasTodas(real, minimo));
    expect(resultado.categorias.every((c) => c.maximo > 0)).toBe(true);
  });
});
