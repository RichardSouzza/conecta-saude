import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verificarLinks } from '../../scripts/check-links.mjs';
import { verificarRelease } from '../../scripts/check-release.mjs';
import { arquivosComExtensao, construir, criarProjeto, htmlDe, limparTemporarios, RAIZ, todoHtml } from './helpers';

const lerJson = (caminho: string) => JSON.parse(readFileSync(join(RAIZ, caminho), 'utf8'));
const release = lerJson('release.config.json');
const quizReal = lerJson('src/data/quiz.json');
const HOJE = new Date('2026-11-06T12:00:00Z');

const AREAS: Record<string, string> = {
  'alimentacao-adequada': 'Nutrição',
  'estresse-e-saude-mental': 'Psicologia',
  'vacinacao-em-dia': 'Enfermagem',
  'movimento-e-comportamento-sedentario': 'Fisioterapia',
  'higiene-bucal': 'Odontologia',
  'para-que-servem-os-exames': 'Biomedicina',
  'tecnologia-e-informacao-em-saude': 'Computação',
};

const tema = (slug: string, ordem: number, status: 'aprovado' | 'rascunho') => `---
title: "Tema ${slug} (teste)"
area: "${AREAS[slug]}"
icone: "🧪"
resumo: "Texto fictício de teste usado só para validar o contrato do portão de release."
ordem: ${ordem}
status: "${status}"
${status === 'aprovado' ? `revisadoPor: "Revisora de Teste"
revisadoEm: "2026-10-20"
referencias:
  - titulo: "Referência fictícia"
    instituicao: "Instituição fictícia"
    url: "https://example.org/ref"
    acessadoEm: "2026-10-01"
` : ''}---
Texto fictício de teste.
`;

const temasObrigatorios = Object.fromEntries(
  (release.temasObrigatorios as string[]).map((slug, i) => [`${slug}.md`, tema(slug, i + 1, 'aprovado')]),
);

const releaseFinal = JSON.stringify({ ...release, estagio: 'final' });
const quizAprovado = (mudar: (q: typeof quizReal) => void = () => {}) => {
  const q = structuredClone(quizReal);
  q.status = 'aprovado';
  q.aprovacoes = q.categorias.map((c: { id: string }) => ({ categoria: c.id, aprovadoPor: 'Revisora de Teste', aprovadoEm: '2026-10-20' }));
  mudar(q);
  return JSON.stringify(q);
};

const atributo = (html: string, nome: string) => html.match(new RegExp(`data-${nome}="([^"]*)"`))?.[1];
const temasLinkados = (html: string) => [...new Set([...html.matchAll(/\/conecta-saude\/temas\/([a-z0-9-]+)\//g)].map((m) => m[1]))].sort();
const paresDoQuiz = (quizReal.categorias as { id: string; tema: string }[]).map((c) => `${c.id}:${c.tema}`).join(',');

afterAll(limparTemporarios);

/* describe('quiz em demonstração no estágio "preparacao" (estado atual do repositório)', () => {
  let producao: ReturnType<typeof construir>;
  let teste: ReturnType<typeof construir>;

  beforeAll(() => {
    const projeto = criarProjeto({ 'alimentacao.md': tema('alimentacao', 1, 'aprovado'), 'movimento.md': tema('movimento', 2, 'rascunho') });
    producao = construir(projeto, 'producao');
    teste = construir(projeto, 'teste');
  }, 300_000);

  describe('produção', () => {
    it('conclui o build sem gerar a página do quiz nem nenhum JavaScript', () => {
      expect(producao.codigo).toBe(0);
      expect(existsSync(join(producao.dist, 'quiz'))).toBe(false);
      expect(arquivosComExtensao(producao.dist, '.js')).toEqual([]);
    });

    it('não menciona o quiz em nenhuma página', () => {
      const html = todoHtml(producao.dist);
      expect(html).not.toContain('Teste seus hábitos');
      expect(html).not.toContain('respostas do teste');
      expect(html).not.toContain('astro-island');
    });

    it('passa pelo portão de release', () => {
      const { erros, resumo } = verificarRelease({ distDir: producao.dist, config: release, hoje: HOJE });
      expect(erros).toEqual([]);
      expect(resumo).toMatchObject({ temas: ['alimentacao'], quiz: false });
    });
  });

  describe('teste', () => {
    it('gera o quiz com o contrato de atributos e o banner de demonstração', () => {
      expect(teste.codigo).toBe(0);
      const html = htmlDe(teste.dist, 'quiz');
      expect(atributo(html, 'quiz-status')).toBe('demonstracao');
      expect(atributo(html, 'categorias')).toBe(paresDoQuiz);
      expect(atributo(html, 'aprovacoes')).toBeUndefined(); // sem aprovações, o Astro emite o atributo sem valor
      expect(html).toContain('<strong>DEMONSTRAÇÃO.</strong>');
      expect(html).toContain('<noscript>');
      expect(html).toMatch(/<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'"/);
      expect(html).not.toContain('<form');
    });

    it('só cria links para os temas que existem no build', () => {
      const html = htmlDe(teste.dist, 'quiz');
      const linkados = temasLinkados(html);
      expect(linkados).toEqual(['alimentacao', 'movimento']);
      for (const slug of linkados) expect(existsSync(join(teste.dist, 'temas', slug, 'index.html')), slug).toBe(true);
    });

    it('integra o quiz ao menu, à página inicial e à página Sobre', () => {
      expect(htmlDe(teste.dist, '')).toContain('href="/conecta-saude/quiz/"');
      expect(htmlDe(teste.dist, '')).toContain('Fazer o teste');
      expect(htmlDe(teste.dist, 'sobre')).toContain('As respostas do teste ficam apenas na memória do navegador');
    });

    it('seria reprovado pelo portão de release se fosse confundido com produção', () => {
      const { erros } = verificarRelease({ distDir: teste.dist, config: release, hoje: HOJE });
      expect(erros.join('\n')).toContain('o quiz não pode ser publicado no estágio "preparacao"');
    });
  });
});

describe('estágio "final"', () => {
  it('com o quiz em demonstração, o quiz não vai à produção e o portão barra a publicação', () => {
    const r = construir(criarProjeto(temasObrigatorios, { 'release.config.json': releaseFinal }), 'producao');
    expect(r.codigo).toBe(0);
    expect(existsSync(join(r.dist, 'quiz'))).toBe(false);
    const { erros } = verificarRelease({ distDir: r.dist, config: JSON.parse(releaseFinal), hoje: HOJE });
    expect(erros).toEqual(['quiz/: o estágio "final" exige o quiz publicado.']);
  }, 300_000);

  describe('com o quiz aprovado em todas as categorias', () => {
    let r: ReturnType<typeof construir>;

    beforeAll(() => {
      r = construir(criarProjeto(temasObrigatorios, { 'release.config.json': releaseFinal, 'src/data/quiz.json': quizAprovado() }), 'producao');
    }, 300_000);

    it('publica o quiz e passa pelo portão de release com o contrato completo', () => {
      expect(r.codigo).toBe(0);
      const { erros, resumo } = verificarRelease({ distDir: r.dist, config: JSON.parse(releaseFinal), hoje: HOJE });
      expect(erros).toEqual([]);
      expect(resumo).toMatchObject({ estagio: 'final', quiz: true });
      expect(resumo?.temas).toHaveLength(release.temasObrigatorios.length);
    });

    it('declara o status aprovado, as aprovações de todas as categorias e não mostra o banner de demonstração', () => {
      const html = htmlDe(r.dist, 'quiz');
      expect(atributo(html, 'quiz-status')).toBe('aprovado');
      expect(atributo(html, 'categorias')).toBe(paresDoQuiz);
      expect(atributo(html, 'aprovacoes')).toBe(quizReal.categorias.map((c: { id: string }) => c.id).join(','));
      expect(html).not.toContain('DEMONSTRAÇÃO');
      expect(html).toContain("connect-src 'none'");
    });

    it('liga cada categoria a um tema publicado e não deixa links quebrados', () => {
      const mapeados = [...new Set((quizReal.categorias as { tema: string }[]).map((c) => c.tema))].sort();
      expect(temasLinkados(htmlDe(r.dist, 'quiz'))).toEqual(mapeados);
      expect(verificarLinks({ distDir: r.dist, base: '/conecta-saude' })).toEqual([]);
    });

    it('integra o quiz ao site e entrega o JavaScript do quiz', () => {
      expect(htmlDe(r.dist, '')).toContain('Teste seus hábitos');
      expect(htmlDe(r.dist, 'sobre')).toContain('As respostas do teste ficam apenas na memória do navegador');
      expect(arquivosComExtensao(r.dist, '.js').length).toBeGreaterThan(0);
    });
  });
});

*/
describe('quizzes inválidos interrompem o build com mensagem clara', () => {
  const falha = (quiz: string) =>
    construir(
      criarProjeto(
        {
          [`${release.temasObrigatorios[0]}.md`]: tema(release.temasObrigatorios[0], 1, 'aprovado'),
        },
        { 'src/data/quiz.json': quiz },
      ),
      'producao',
    );

  it('aprovado sem a aprovação de uma categoria', () => {
    const r = falha(quizAprovado((q) => { q.aprovacoes = q.aprovacoes.filter((a: { categoria: string }) => a.categoria !== 'sono'); }));
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('Quiz inválido (src/data/quiz.json)');
    expect(r.saida).toContain('quiz aprovado exige a aprovação da categoria "sono"');
  }, 120_000);

  it('menos de 8 perguntas', () => {
    const q = structuredClone(quizReal);
    q.perguntas = q.perguntas.slice(0, 7);
    const r = falha(JSON.stringify(q));
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('o quiz deve ter de 8 a 10 perguntas');
  }, 120_000);

  it('faixas com lacuna', () => {
    const q = structuredClone(quizReal);
    q.faixas[1].de = 55;
    const r = falha(JSON.stringify(q));
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('sem lacuna nem sobreposição');
  }, 120_000);
});
