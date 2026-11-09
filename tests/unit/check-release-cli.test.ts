import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PAGINA_INICIAL, paginaQuiz, paginaTema } from './helpers';

const SCRIPT = resolve('scripts/check-release.mjs');
const LISTAS = { temasObrigatorios: ['alimentacao', 'saude-mental'], categoriasObrigatorias: ['sono', 'alimentacao'] };
const raizes: string[] = [];

function projeto(config: string | null, arquivos: Record<string, string> | null = { 'index.html': PAGINA_INICIAL }) {
  const raiz = mkdtempSync(join(tmpdir(), 'conecta-raiz-'));
  raizes.push(raiz);
  if (config !== null) writeFileSync(join(raiz, 'release.config.json'), config);
  for (const [caminho, conteudo] of Object.entries(arquivos ?? {})) {
    const completo = join(raiz, 'dist', caminho);
    mkdirSync(dirname(completo), { recursive: true });
    writeFileSync(completo, conteudo);
  }
  return raiz;
}

function rodar(raiz: string) {
  const r = spawnSync(process.execPath, [SCRIPT, '--raiz', raiz], { encoding: 'utf8' });
  return { codigo: r.status, saida: r.stdout, erro: r.stderr };
}

const config = (estagio: string, extra: object = {}) => JSON.stringify({ estagio, ...LISTAS, ...extra });

afterEach(() => {
  while (raizes.length > 0) rmSync(raizes.pop()!, { recursive: true, force: true });
});

describe('check-release na linha de comando', () => {
  it('aprova um site válido em preparacao (código 0)', () => {
    const r = rodar(projeto(config('preparacao')));
    expect(r.codigo).toBe(0);
    expect(r.saida).toContain('Portão de release (estágio "preparacao")');
  });

  it.each([
    ['arquivo ausente', null, 'release.config.json não encontrado'],
    ['JSON inválido', '{ estagio: ', 'não é um JSON válido'],
    ['JSON que não é objeto', '[]', 'deve ser um objeto JSON'],
    ['estágio inválido', config('beta'), '"estagio" deve ser um destes valores'],
    ['sem temas obrigatórios', config('final', { temasObrigatorios: [] }), '"temasObrigatorios" deve ser uma lista não vazia'],
    ['sem categorias obrigatórias', JSON.stringify({ estagio: 'final', temasObrigatorios: ['exames'] }), '"categoriasObrigatorias" deve ser uma lista não vazia'],
    ['categoria duplicada na configuração', config('final', { categoriasObrigatorias: ['sono', 'sono'] }), 'slugs duplicados'],
  ])('interrompe com falha explícita: configuração com %s (código 1)', (_nome, conteudo, mensagem) => {
    const r = rodar(projeto(conteudo));
    expect(r.codigo).toBe(1);
    expect(r.erro).toContain(mensagem);
    expect(r.saida).not.toContain('✔');
  });

  it('interrompe com falha quando o dist/ não existe (código 1)', () => {
    const r = rodar(projeto(config('preparacao'), null));
    expect(r.codigo).toBe(1);
    expect(r.erro).toContain('o build de produção não gerou o site');
  });

  it('interrompe com falha quando --raiz não recebe caminho (código 1)', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--raiz'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--raiz exige o caminho');
  });

  it('aprova o estágio final completo (código 0)', () => {
    const arquivos = {
      'index.html': PAGINA_INICIAL,
      'temas/alimentacao/index.html': paginaTema('alimentacao'),
      'temas/saude-mental/index.html': paginaTema('saude-mental'),
      'quiz/index.html': paginaQuiz(),
    };
    expect(rodar(projeto(config('final'), arquivos)).codigo).toBe(0);
  });

  it('reprova o estágio final com segmento vazio nos atributos do quiz (código 1)', () => {
    const base = {
      'index.html': PAGINA_INICIAL,
      'temas/alimentacao/index.html': paginaTema('alimentacao'),
      'temas/saude-mental/index.html': paginaTema('saude-mental'),
    };
    for (const sobrescrever of [
      { categorias: 'sono:saude-mental,,alimentacao:alimentacao' },
      { aprovacoes: 'sono,alimentacao,' },
    ]) {
      const r = rodar(projeto(config('final'), { ...base, 'quiz/index.html': paginaQuiz(sobrescrever) }));
      expect(r.codigo).toBe(1);
      expect(r.erro).toContain('segmento vazio');
    }
  });

  it('reprova o estágio final com categoria obrigatória ausente (código 1)', () => {
    const arquivos = {
      'index.html': PAGINA_INICIAL,
      'temas/alimentacao/index.html': paginaTema('alimentacao'),
      'temas/saude-mental/index.html': paginaTema('saude-mental'),
      'quiz/index.html': paginaQuiz({ categorias: 'sono:saude-mental', aprovacoes: 'sono' }),
    };
    const r = rodar(projeto(config('final'), arquivos));
    expect(r.codigo).toBe(1);
    expect(r.erro).toContain('categoria obrigatória "alimentacao" não declarada');
  });
});
