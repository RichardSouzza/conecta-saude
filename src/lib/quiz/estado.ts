import type { Quiz } from './schema';

export interface Estado {
  indice: number;
  respostas: Record<string, string>;
  fase: 'perguntas' | 'resultado';
}

export type Acao =
  | { tipo: 'selecionar'; perguntaId: string; opcaoId: string }
  | { tipo: 'avancar' }
  | { tipo: 'voltar' }
  | { tipo: 'reiniciar' };

export const estadoInicial: Estado = { indice: 0, respostas: {}, fase: 'perguntas' };

export function podeAvancar(quiz: Pick<Quiz, 'perguntas'>, estado: Estado): boolean {
  const pergunta = quiz.perguntas[estado.indice];
  return estado.fase === 'perguntas' && pergunta !== undefined && estado.respostas[pergunta.id] !== undefined;
}

// Ações inválidas devolvem o mesmo objeto de estado.
export function proximoEstado(quiz: Pick<Quiz, 'perguntas'>, estado: Estado, acao: Acao): Estado {
  if (acao.tipo === 'reiniciar') return { indice: 0, respostas: {}, fase: 'perguntas' };
  if (estado.fase === 'resultado') return estado;

  const pergunta = quiz.perguntas[estado.indice];
  switch (acao.tipo) {
    case 'selecionar': {
      const valida = pergunta?.id === acao.perguntaId && pergunta.opcoes.some((o) => o.id === acao.opcaoId);
      return valida ? { ...estado, respostas: { ...estado.respostas, [acao.perguntaId]: acao.opcaoId } } : estado;
    }
    case 'avancar': {
      if (!podeAvancar(quiz, estado)) return estado;
      return estado.indice === quiz.perguntas.length - 1
        ? { ...estado, fase: 'resultado' }
        : { ...estado, indice: estado.indice + 1 };
    }
    case 'voltar':
      return estado.indice > 0 ? { ...estado, indice: estado.indice - 1 } : estado;
  }
}
