import type { Faixa, Pergunta, Quiz } from './schema';

export type Respostas = Readonly<Record<string, string>>;
type Dados = Pick<Quiz, 'categorias' | 'perguntas' | 'faixas'>;

export class RespostasInvalidasError extends Error {
  constructor(
    mensagem: string,
    readonly pendentes: string[] = [],
  ) {
    super(mensagem);
    this.name = 'RespostasInvalidasError';
  }
}

export interface ResultadoCategoria {
  categoria: string;
  rotulo: string;
  tema: string;
  pontos: number;
  maximo: number;
  faixa: Pick<Faixa, 'id' | 'rotulo' | 'mensagem' | 'destacar'>;
}

export interface ResultadoQuiz {
  categorias: ResultadoCategoria[];
  destaque: ResultadoCategoria[];
  demais: ResultadoCategoria[];
}

export const maximoDaPergunta = (pergunta: Pergunta): number => Math.max(...pergunta.opcoes.map((o) => o.pontos));

export function pontosDaResposta(pergunta: Pergunta, opcaoId: string): number {
  const opcao = pergunta.opcoes.find((o) => o.id === opcaoId);
  if (!opcao) throw new RespostasInvalidasError(`Alternativa "${opcaoId}" inexistente na pergunta "${pergunta.id}".`);
  return opcao.pontos;
}

export function perguntasPendentes(quiz: Pick<Quiz, 'perguntas'>, respostas: Respostas): string[] {
  return quiz.perguntas.filter((p) => respostas[p.id] === undefined).map((p) => p.id);
}

// Compara com multiplicação (pontos/maximo x 100) para não depender de aritmética de ponto flutuante.
// A última faixa inclui o limite superior (100%); as demais são [de, ate).
export function classificar<F extends { de: number; ate: number }>(pontos: number, maximo: number, faixas: readonly F[]): F {
  if (!Number.isInteger(maximo) || maximo <= 0) throw new RangeError('A pontuação máxima deve ser um inteiro maior que zero.');
  if (!Number.isInteger(pontos) || pontos < 0 || pontos > maximo) {
    throw new RangeError(`Pontuação ${pontos} fora do intervalo de 0 a ${maximo}.`);
  }
  const escalado = pontos * 100;
  const ultima = faixas.length - 1;
  const faixa = faixas.find(
    (f, i) => escalado >= f.de * maximo && (i === ultima ? escalado <= f.ate * maximo : escalado < f.ate * maximo),
  );
  if (!faixa) throw new RangeError(`Nenhuma faixa cobre a pontuação ${pontos} de ${maximo}.`);
  return faixa;
}

export function calcularResultado(quiz: Dados, respostas: Respostas): ResultadoQuiz {
  const conhecidas = new Set(quiz.perguntas.map((p) => p.id));
  const desconhecidas = Object.keys(respostas).filter((id) => !conhecidas.has(id));
  if (desconhecidas.length > 0) {
    throw new RespostasInvalidasError(`Resposta para pergunta inexistente: ${desconhecidas.join(', ')}.`);
  }
  const pendentes = perguntasPendentes(quiz, respostas);
  if (pendentes.length > 0) {
    throw new RespostasInvalidasError(`Perguntas sem resposta: ${pendentes.join(', ')}.`, pendentes);
  }

  const categorias = quiz.categorias.map((categoria): ResultadoCategoria => {
    const perguntas = quiz.perguntas.filter((p) => p.categoria === categoria.id);
    const pontos = perguntas.reduce((soma, p) => soma + pontosDaResposta(p, respostas[p.id]), 0);
    const maximo = perguntas.reduce((soma, p) => soma + maximoDaPergunta(p), 0);
    const { id, rotulo, mensagem, destacar } = classificar(pontos, maximo, quiz.faixas);
    return { categoria: categoria.id, rotulo: categoria.rotulo, tema: categoria.tema, pontos, maximo, faixa: { id, rotulo, mensagem, destacar } };
  });

  return {
    categorias,
    destaque: categorias.filter((c) => c.faixa.destacar),
    demais: categorias.filter((c) => !c.faixa.destacar),
  };
}
