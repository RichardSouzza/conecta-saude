import type { Quiz } from '../../src/lib/quiz/schema';

const opcoes = () => [
  { id: 'a', rotulo: 'Quase sempre', pontos: 2 },
  { id: 'b', rotulo: 'Às vezes', pontos: 1 },
  { id: 'c', rotulo: 'Quase nunca', pontos: 0 },
];

const pergunta = (n: number, categoria: string) => ({
  id: `q${n}`,
  categoria,
  texto: `Pergunta fictícia de teste número ${n}?`,
  opcoes: opcoes(),
});

// Quiz fictício com 2 categorias e 8 perguntas (máximo de 8 pontos por categoria).
export function quizDeTeste(): Quiz {
  return {
    status: 'demonstracao',
    categorias: [
      { id: 'cat-a', rotulo: 'Categoria A', tema: 'tema-a' },
      { id: 'cat-b', rotulo: 'Categoria B', tema: 'tema-b' },
    ],
    perguntas: [1, 2, 3, 4].map((n) => pergunta(n, 'cat-a')).concat([5, 6, 7, 8].map((n) => pergunta(n, 'cat-b'))),
    faixas: [
      { id: 'baixa', rotulo: 'Faixa baixa', de: 0, ate: 50, destacar: true, mensagem: 'Mensagem fictícia da faixa baixa.' },
      { id: 'media', rotulo: 'Faixa média', de: 50, ate: 80, destacar: false, mensagem: 'Mensagem fictícia da faixa média.' },
      { id: 'alta', rotulo: 'Faixa alta', de: 80, ate: 100, destacar: false, mensagem: 'Mensagem fictícia da faixa alta.' },
    ],
    resultado: {
      introducao: 'Introdução fictícia do resultado.',
      semDestaque: 'Mensagem fictícia sem destaque.',
      aviso: 'Aviso fictício do resultado de teste.',
    },
    aprovacoes: [],
  };
}

export const aprovacoesDeTeste = [
  { categoria: 'cat-a', aprovadoPor: 'Revisora de Teste', aprovadoEm: '2026-10-20' },
  { categoria: 'cat-b', aprovadoPor: 'Revisor de Teste', aprovadoEm: '2026-10-21' },
];

export function respostasTodas(quiz: Quiz, escolher: (pontos: number[]) => number): Record<string, string> {
  const respostas: Record<string, string> = {};
  for (const p of quiz.perguntas) {
    const alvo = escolher(p.opcoes.map((o) => o.pontos));
    respostas[p.id] = p.opcoes.find((o) => o.pontos === alvo)!.id;
  }
  return respostas;
}

export const minimo = (pontos: number[]) => Math.min(...pontos);
export const maximo = (pontos: number[]) => Math.max(...pontos);
