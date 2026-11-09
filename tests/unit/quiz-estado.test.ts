import { describe, expect, it } from 'vitest';
import { estadoInicial, podeAvancar, proximoEstado, type Acao, type Estado } from '../../src/lib/quiz/estado';
import { quizDeTeste } from './quiz-fixtures';

const quiz = quizDeTeste();
const TOTAL = quiz.perguntas.length;

const aplicar = (estado: Estado, ...acoes: Acao[]) => acoes.reduce((e, a) => proximoEstado(quiz, e, a), estado);
const escolher = (n: number, opcaoId = 'a'): Acao => ({ tipo: 'selecionar', perguntaId: `q${n}`, opcaoId });
const responderTudo = (): Estado => {
  let estado = estadoInicial;
  for (let n = 1; n <= TOTAL; n++) estado = aplicar(estado, escolher(n), { tipo: 'avancar' });
  return estado;
};

describe('estado do quiz', () => {
  it('começa na primeira pergunta, sem respostas', () => {
    expect(estadoInicial).toEqual({ indice: 0, respostas: {}, fase: 'perguntas' });
    expect(podeAvancar(quiz, estadoInicial)).toBe(false);
  });

  it('bloqueia o avanço sem resposta e devolve o mesmo estado', () => {
    expect(aplicar(estadoInicial, { tipo: 'avancar' })).toBe(estadoInicial);
  });

  it('registra a resposta, libera o avanço e passa para a pergunta seguinte', () => {
    const respondido = aplicar(estadoInicial, escolher(1, 'b'));
    expect(respondido.respostas).toEqual({ q1: 'b' });
    expect(podeAvancar(quiz, respondido)).toBe(true);
    expect(aplicar(respondido, { tipo: 'avancar' })).toMatchObject({ indice: 1, fase: 'perguntas' });
  });

  it('permite voltar e alterar uma resposta sem perder as demais', () => {
    let estado = aplicar(estadoInicial, escolher(1, 'a'), { tipo: 'avancar' }, escolher(2, 'c'), { tipo: 'avancar' });
    estado = aplicar(estado, { tipo: 'voltar' }, { tipo: 'voltar' });
    expect(estado.indice).toBe(0);
    expect(estado.respostas).toEqual({ q1: 'a', q2: 'c' });
    estado = aplicar(estado, escolher(1, 'c'));
    expect(estado.respostas).toEqual({ q1: 'c', q2: 'c' });
  });

  it('não volta antes da primeira pergunta', () => {
    expect(aplicar(estadoInicial, { tipo: 'voltar' })).toBe(estadoInicial);
  });

  it('só aceita resposta para a pergunta atual e para alternativas existentes', () => {
    expect(aplicar(estadoInicial, escolher(2))).toBe(estadoInicial);
    expect(aplicar(estadoInicial, escolher(1, 'z'))).toBe(estadoInicial);
    expect(aplicar(estadoInicial, { tipo: 'selecionar', perguntaId: 'q99', opcaoId: 'a' })).toBe(estadoInicial);
  });

  it('chega ao resultado depois de responder a última pergunta, com todas as respostas', () => {
    const final = responderTudo();
    expect(final.fase).toBe('resultado');
    expect(Object.keys(final.respostas)).toHaveLength(TOTAL);
  });

  it('na última pergunta o avanço também exige resposta', () => {
    let estado = estadoInicial;
    for (let n = 1; n < TOTAL; n++) estado = aplicar(estado, escolher(n), { tipo: 'avancar' });
    expect(estado).toMatchObject({ indice: TOTAL - 1, fase: 'perguntas' });
    expect(aplicar(estado, { tipo: 'avancar' })).toBe(estado);
  });

  it('no resultado, só reiniciar tem efeito', () => {
    const final = responderTudo();
    expect(aplicar(final, { tipo: 'voltar' })).toBe(final);
    expect(aplicar(final, { tipo: 'avancar' })).toBe(final);
    expect(aplicar(final, escolher(1, 'c'))).toBe(final);
  });

  it('reiniciar limpa as respostas e volta à primeira pergunta, a partir de qualquer ponto', () => {
    const meio = aplicar(estadoInicial, escolher(1), { tipo: 'avancar' }, escolher(2));
    for (const origem of [meio, responderTudo()]) {
      const reiniciado = aplicar(origem, { tipo: 'reiniciar' });
      expect(reiniciado).toEqual(estadoInicial);
      expect(reiniciado.respostas).not.toBe(origem.respostas);
    }
  });

  it('não altera o estado anterior (imutabilidade)', () => {
    const antes = aplicar(estadoInicial, escolher(1));
    const copia = structuredClone(antes);
    aplicar(antes, { tipo: 'avancar' }, escolher(2, 'c'));
    expect(antes).toEqual(copia);
  });

  it('é determinístico para a mesma sequência de ações', () => {
    const sequencia: Acao[] = [escolher(1, 'b'), { tipo: 'avancar' }, escolher(2, 'c'), { tipo: 'voltar' }, escolher(1, 'a')];
    expect(aplicar(estadoInicial, ...sequencia)).toEqual(aplicar(estadoInicial, ...sequencia));
  });
});
