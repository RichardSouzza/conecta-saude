import { afterEach, describe, expect, it } from 'vitest';
import { lerConfig, validarConfig, verificarRelease } from '../../scripts/check-release.mjs';
import { criarDist, limparDists, PAGINA_INICIAL, paginaQuiz, paginaTema } from './helpers';

const HOJE = new Date('2026-10-27T12:00:00Z');
const LISTAS = { temasObrigatorios: ['alimentacao', 'saude-mental'], categoriasObrigatorias: ['sono', 'alimentacao'] };
const PREPARACAO = { estagio: 'preparacao', ...LISTAS };
const FINAL = { estagio: 'final', ...LISTAS };

function rodar(arquivos: Record<string, string>, config = PREPARACAO) {
  return verificarRelease({ distDir: criarDist(arquivos), config, hoje: HOJE });
}

function finalCompleto(): Record<string, string> {
  return {
    'index.html': PAGINA_INICIAL,
    'temas/alimentacao/index.html': paginaTema('alimentacao'),
    'temas/saude-mental/index.html': paginaTema('saude-mental'),
    'quiz/index.html': paginaQuiz(),
  };
}

afterEach(limparDists);

describe('release.config.json', () => {
  it('o arquivo real do repositório é válido', () => {
    const { config, erros } = lerConfig(process.cwd());
    expect(erros).toEqual([]);
    expect(config).not.toBeNull();
  });

  it('aceita uma configuração válida', () => {
    expect(validarConfig(PREPARACAO)).toEqual([]);
    expect(validarConfig(FINAL)).toEqual([]);
  });

  it.each([
    ['não é objeto', null],
    ['estágio desconhecido', { estagio: 'beta', temasObrigatorios: ['alimentacao'], categoriasObrigatorias: ['sono'] }],
    ['sem temas', { estagio: 'final', temasObrigatorios: [], categoriasObrigatorias: ['sono'] }],
    ['slug inválido', { estagio: 'final', temasObrigatorios: ['Saúde Mental'], categoriasObrigatorias: ['sono'] }],
    ['slug duplicado', { estagio: 'final', temasObrigatorios: ['exames', 'exames'], categoriasObrigatorias: ['sono'] }],
    ['sem estágio', { temasObrigatorios: ['exames'], categoriasObrigatorias: ['sono'] }],
    ['sem categorias obrigatórias', { estagio: 'final', temasObrigatorios: ['exames'] }],
    ['categorias vazias', { estagio: 'final', temasObrigatorios: ['exames'], categoriasObrigatorias: [] }],
    ['categoria com id inválido', { estagio: 'final', temasObrigatorios: ['exames'], categoriasObrigatorias: ['Saúde Bucal'] }],
    ['categoria duplicada', { estagio: 'final', temasObrigatorios: ['exames'], categoriasObrigatorias: ['sono', 'sono'] }],
  ])('rejeita configuração inválida: %s', (_nome, config) => {
    expect(validarConfig(config).length).toBeGreaterThan(0);
  });
});

describe('estágio "preparacao"', () => {
  it('passa com um site sem temas e sem quiz', () => {
    const { erros, resumo } = rodar({ 'index.html': PAGINA_INICIAL });
    expect(erros).toEqual([]);
    expect(resumo).toMatchObject({ estagio: 'preparacao', temas: [], quiz: false });
  });

  it('passa com temas aprovados publicados', () => {
    const { erros } = rodar({ 'index.html': PAGINA_INICIAL, 'temas/alimentacao/index.html': paginaTema('alimentacao') });
    expect(erros).toEqual([]);
  });

  it('falha se o quiz aparecer na produção, mesmo aprovado', () => {
    const { erros } = rodar({ 'index.html': PAGINA_INICIAL, 'quiz/index.html': paginaQuiz() });
    expect(erros.join('\n')).toContain('não pode ser publicado no estágio "preparacao"');
  });

  it('falha se o dist/ não tiver index.html', () => {
    expect(rodar({ 'outra.html': PAGINA_INICIAL }).erros.length).toBeGreaterThan(0);
  });
});

describe('entradas ocultas', () => {
  it('falha com arquivo oculto na raiz', () => {
    const { erros } = rodar({ 'index.html': PAGINA_INICIAL, '.nojekyll': '' });
    expect(erros.join('\n')).toContain('Entrada oculta em dist/: .nojekyll');
  });

  it('falha com arquivo oculto em subpasta e com pasta oculta', () => {
    const { erros } = rodar({
      'index.html': PAGINA_INICIAL,
      'a/b/.env': 'segredo',
      '.well-known/x.txt': 'x',
    });
    const texto = erros.join('\n');
    expect(texto).toContain('a/b/.env');
    expect(texto).toContain('Entrada oculta em dist/: .well-known');
  });
});

describe('marcadores de rascunho e demonstração', () => {
  it.each([
    ['data-conteudo de rascunho', '<p data-conteudo="rascunho">x</p>'],
    ['data-conteudo de demonstração', '<p data-conteudo="demonstracao">x</p>'],
    ['banner de revisão', '<p>Conteúdo em revisão</p>'],
    ['selo de demonstração', '<p>DEMONSTRAÇÃO: não validado</p>'],
  ])('falha com %s', (_nome, trecho) => {
    const { erros } = rodar({ 'index.html': `${PAGINA_INICIAL}${trecho}` });
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe('temas publicados', () => {
  it.each([
    ['rascunho', { conteudo: 'rascunho' }, 'data-conteudo="aprovado"'],
    ['slug diferente', { tema: 'outro' }, 'data-tema'],
    ['sem revisor', { revisadoPor: '' }, 'sem revisor'],
    ['sem data', { revisadoEm: '' }, 'data da revisão'],
    ['data inválida', { revisadoEm: '2026-02-30' }, 'data da revisão'],
    ['data no futuro', { revisadoEm: '2026-12-01' }, 'data da revisão'],
    ['sem referências', { referencias: '0' }, 'sem referências'],
  ])('falha com tema %s', (_nome, sobrescrever, trecho) => {
    const { erros } = rodar({
      'index.html': PAGINA_INICIAL,
      'temas/alimentacao/index.html': paginaTema('alimentacao', sobrescrever),
    });
    expect(erros.join('\n')).toContain(trecho);
  });
});

describe('data-referencias de temas publicados', () => {
  const comReferencias = (valor: string | null) => {
    let html = paginaTema('alimentacao', { referencias: valor ?? '' });
    if (valor === null) html = html.replace(/ data-referencias="[^"]*"/, '');
    return rodar({ 'index.html': PAGINA_INICIAL, 'temas/alimentacao/index.html': html }).erros;
  };

  it.each(['1', '2', '10'])('aceita %s', (valor) => {
    expect(comReferencias(valor)).toEqual([]);
  });

  it.each([
    ['0', '0'],
    ['negativo', '-1'],
    ['parcialmente numérico', '1abc'],
    ['decimal', '1.5'],
    ['decimal com zero', '2.0'],
    ['vazio', ''],
    ['só espaços', '  '],
    ['hexadecimal', '0x10'],
    ['notação científica', '1e2'],
    ['com sinal positivo', '+2'],
    ['com zero à esquerda', '01'],
    ['não numérico', 'abc'],
    ['Infinity', 'Infinity'],
  ])('rejeita %s (%s)', (_nome, valor) => {
    expect(comReferencias(valor).join('\n')).toContain('data-referencias deve ser um inteiro >= 1');
  });

  it('rejeita o atributo ausente', () => {
    expect(comReferencias(null).join('\n')).toContain('data-referencias deve ser um inteiro >= 1');
  });
});

describe('estágio "final"', () => {
  it('passa com todos os temas obrigatórios e o quiz aprovado', () => {
    const { erros } = rodar(finalCompleto(), FINAL);
    expect(erros).toEqual([]);
  });

  it('falha se faltar um tema obrigatório', () => {
    const arquivos = finalCompleto();
    delete arquivos['temas/saude-mental/index.html'];
    const { erros } = rodar(arquivos, FINAL);
    expect(erros.join('\n')).toContain('temas/saude-mental: tema obrigatório não publicado');
  });

  it('falha se o quiz estiver ausente', () => {
    const arquivos = finalCompleto();
    delete arquivos['quiz/index.html'];
    expect(rodar(arquivos, FINAL).erros.join('\n')).toContain('exige o quiz publicado');
  });

  it('falha se o quiz não estiver aprovado', () => {
    const arquivos = { ...finalCompleto(), 'quiz/index.html': paginaQuiz({ status: 'demonstracao' }) };
    expect(rodar(arquivos, FINAL).erros.join('\n')).toContain('data-quiz-status');
  });
});

describe('estágio "final": categorias do quiz', () => {
  function comQuiz(sobrescrever: Parameters<typeof paginaQuiz>[0]) {
    return rodar({ ...finalCompleto(), 'quiz/index.html': paginaQuiz(sobrescrever) }, FINAL).erros.join('\n');
  }

  it('passa quando todas as categorias obrigatórias estão declaradas, aprovadas e vinculadas', () => {
    expect(comQuiz({})).toBe('');
  });

  it('aceita a ordem das categorias diferente da configuração', () => {
    expect(comQuiz({ categorias: 'alimentacao:alimentacao,sono:saude-mental', aprovacoes: 'alimentacao,sono' })).toBe('');
  });

  it('falha se uma categoria obrigatória não for declarada, mesmo com as demais aprovadas', () => {
    const erros = comQuiz({ categorias: 'sono:saude-mental', aprovacoes: 'sono' });
    expect(erros).toContain('categoria obrigatória "alimentacao" não declarada');
  });

  it('falha se o quiz não declarar nenhuma categoria', () => {
    const erros = comQuiz({ categorias: '', aprovacoes: '' });
    expect(erros).toContain('nenhuma categoria declarada');
    expect(erros).toContain('categoria obrigatória "sono" não declarada');
    expect(erros).toContain('categoria obrigatória "alimentacao" não declarada');
  });

  it('falha se uma categoria declarada não tiver aprovação', () => {
    expect(comQuiz({ aprovacoes: 'sono' })).toContain('categoria "alimentacao" não tem aprovação');
  });

  it('falha se houver aprovação para categoria não declarada', () => {
    expect(comQuiz({ aprovacoes: 'sono,alimentacao,estresse' })).toContain('aprovação registrada para a categoria "estresse", que não está declarada');
  });

  it('falha com categoria inesperada, mesmo aprovada e vinculada a tema publicado', () => {
    const erros = comQuiz({
      categorias: 'sono:saude-mental,alimentacao:alimentacao,extra:alimentacao',
      aprovacoes: 'sono,alimentacao,extra',
    });
    expect(erros).toContain('categoria inesperada "extra"');
  });

  it('falha com categoria duplicada e o mesmo vínculo', () => {
    const erros = comQuiz({ categorias: 'sono:saude-mental,sono:saude-mental,alimentacao:alimentacao' });
    expect(erros).toContain('categoria "sono" declarada mais de uma vez');
    expect(erros).not.toContain('vínculos conflitantes');
  });

  it('falha com categoria duplicada e vínculos conflitantes', () => {
    const erros = comQuiz({ categorias: 'sono:saude-mental,sono:alimentacao,alimentacao:alimentacao' });
    expect(erros).toContain('a categoria "sono" tem vínculos conflitantes (saude-mental, alimentacao)');
  });

  it('verifica todos os vínculos de uma categoria duplicada, não só o último', () => {
    const erros = comQuiz({ categorias: 'sono:exames,sono:saude-mental,alimentacao:alimentacao' });
    expect(erros).toContain('a categoria "sono" aponta para o tema "exames", que não está publicado');
  });

  it('falha com aprovação registrada em duplicidade', () => {
    expect(comQuiz({ aprovacoes: 'sono,sono,alimentacao' })).toContain('aprovação da categoria "sono" registrada mais de uma vez');
  });

  it('falha com entrada malformada em data-categorias', () => {
    expect(comQuiz({ categorias: 'sono,alimentacao:alimentacao' })).toContain('entrada inválida em data-categorias: "sono"');
  });

  it.each([
    ['vínculo vazio', 'sono:,alimentacao:alimentacao', 'sono:'],
    ['categoria vazia', ':saude-mental,alimentacao:alimentacao', ':saude-mental'],
    ['tema com letras maiúsculas', 'sono:Saude-Mental,alimentacao:alimentacao', 'sono:Saude-Mental'],
    ['mais de um separador', 'sono:saude-mental:extra,alimentacao:alimentacao', 'sono:saude-mental:extra'],
    ['espaço dentro do id', 'sono :saude-mental,alimentacao:alimentacao', 'sono :saude-mental'],
  ])('falha com %s em data-categorias', (_nome, categorias, entrada) => {
    expect(comQuiz({ categorias })).toContain(`entrada inválida em data-categorias: "${entrada}"`);
  });

  it('falha com aprovações vazias', () => {
    const erros = comQuiz({ aprovacoes: '' });
    expect(erros).toContain('categoria "sono" não tem aprovação registrada');
    expect(erros).toContain('categoria "alimentacao" não tem aprovação registrada');
  });

  it('falha quando só parte das categorias foi aprovada e há aprovação sem declaração', () => {
    const erros = comQuiz({ aprovacoes: 'sono,estresse' });
    expect(erros).toContain('categoria "alimentacao" não tem aprovação registrada');
    expect(erros).toContain('aprovação registrada para a categoria "estresse", que não está declarada');
  });

  it('falha com categoria obrigatória ausente mesmo que haja categoria inesperada aprovada no lugar', () => {
    const erros = comQuiz({ categorias: 'sono:saude-mental,extra:alimentacao', aprovacoes: 'sono,extra' });
    expect(erros).toContain('categoria obrigatória "alimentacao" não declarada');
    expect(erros).toContain('categoria inesperada "extra"');
  });

  it.each([
    ['segmento vazio no meio', 'sono:saude-mental,,alimentacao:alimentacao', 2],
    ['vírgula final', 'sono:saude-mental,', 2],
    ['vírgula inicial', ',sono:saude-mental', 1],
    ['segmento só com espaços', 'sono:saude-mental, ,alimentacao:alimentacao', 2],
  ])('rejeita %s em data-categorias', (_nome, categorias, posicao) => {
    expect(comQuiz({ categorias })).toContain(`segmento vazio em data-categorias (posição ${posicao})`);
  });

  it('rejeita o segmento vazio mesmo quando todas as categorias obrigatórias estão presentes e aprovadas', () => {
    expect(comQuiz({ categorias: 'sono:saude-mental,,alimentacao:alimentacao' })).toBe(
      'quiz/: segmento vazio em data-categorias (posição 2).',
    );
  });

  it('rejeita data-categorias formado só por vírgulas', () => {
    const erros = comQuiz({ categorias: ',' });
    expect(erros).toContain('segmento vazio em data-categorias (posição 1)');
    expect(erros).toContain('segmento vazio em data-categorias (posição 2)');
    expect(erros).toContain('categoria obrigatória "sono" não declarada');
  });

  it.each([
    ['segmento vazio no meio', 'sono,,alimentacao', 2],
    ['vírgula final', 'sono,', 2],
    ['vírgula inicial', ',sono,alimentacao', 1],
    ['segmento só com espaços', 'sono, ,alimentacao', 2],
  ])('rejeita %s em data-aprovacoes', (_nome, aprovacoes, posicao) => {
    expect(comQuiz({ aprovacoes })).toContain(`segmento vazio em data-aprovacoes (posição ${posicao})`);
  });

  it('rejeita o segmento vazio em data-aprovacoes mesmo com todas as categorias aprovadas', () => {
    expect(comQuiz({ aprovacoes: 'sono,,alimentacao' })).toBe('quiz/: segmento vazio em data-aprovacoes (posição 2).');
  });

  it('continua aceitando espaços ao redor das vírgulas', () => {
    expect(comQuiz({ categorias: 'sono:saude-mental, alimentacao:alimentacao', aprovacoes: 'sono, alimentacao' })).toBe('');
  });

  it('falha se a categoria apontar para um tema não publicado', () => {
    expect(comQuiz({ categorias: 'sono:exames,alimentacao:alimentacao' })).toContain(
      'a categoria "sono" aponta para o tema "exames", que não está publicado',
    );
  });

  it('não aceita vínculo com tema que existe só como obrigatório mas não foi publicado', () => {
    const arquivos = finalCompleto();
    delete arquivos['temas/saude-mental/index.html'];
    const erros = rodar(arquivos, FINAL).erros.join('\n');
    expect(erros).toContain('a categoria "sono" aponta para o tema "saude-mental", que não está publicado');
    expect(erros).toContain('temas/saude-mental: tema obrigatório não publicado');
  });
});
