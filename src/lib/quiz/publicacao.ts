// O quiz só vai à produção no estágio "final" e aprovado; no build de teste ele sempre existe.
export function quizPublicavel({ modoTeste, estagio, status }: { modoTeste: boolean; estagio: string; status: string }): boolean {
  return modoTeste || (estagio === 'final' && status === 'aprovado');
}
