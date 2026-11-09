import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const criados: string[] = [];

export function criarDist(arquivos: Record<string, string>): string {
  const raiz = mkdtempSync(join(tmpdir(), 'conecta-dist-'));
  criados.push(raiz);
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    const completo = join(raiz, caminho);
    mkdirSync(dirname(completo), { recursive: true });
    writeFileSync(completo, conteudo);
  }
  return raiz;
}

export function limparDists(): void {
  while (criados.length > 0) {
    rmSync(criados.pop()!, { recursive: true, force: true });
  }
}

export const PAGINA_INICIAL = '<!doctype html><html><body><main><h1>Conecta Saúde</h1></main></body></html>';

export function paginaTema(
  slug: string,
  sobrescrever: Partial<Record<'conteudo' | 'tema' | 'revisadoPor' | 'revisadoEm' | 'referencias', string>> = {},
): string {
  const v = {
    conteudo: 'aprovado',
    tema: slug,
    revisadoPor: 'Revisora de Teste',
    revisadoEm: '2026-10-20',
    referencias: '2',
    ...sobrescrever,
  };
  return `<!doctype html><html><body><article data-conteudo="${v.conteudo}" data-tema="${v.tema}" data-revisado-por="${v.revisadoPor}" data-revisado-em="${v.revisadoEm}" data-referencias="${v.referencias}"><h1>${slug}</h1></article></body></html>`;
}

export function paginaQuiz(
  sobrescrever: Partial<Record<'status' | 'categorias' | 'aprovacoes', string>> = {},
): string {
  const v = {
    status: 'aprovado',
    categorias: 'sono:saude-mental,alimentacao:alimentacao',
    aprovacoes: 'sono,alimentacao',
    ...sobrescrever,
  };
  return `<!doctype html><html><body><main data-quiz-status="${v.status}" data-categorias="${v.categorias}" data-aprovacoes="${v.aprovacoes}"><h1>Quiz</h1></main></body></html>`;
}
