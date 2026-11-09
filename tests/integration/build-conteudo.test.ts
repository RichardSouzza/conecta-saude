import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verificarRelease } from '../../scripts/check-release.mjs';
import { construir, criarProjeto, htmlDe, limparTemporarios, todoHtml } from './helpers';

const APROVADO = `---
title: "Tema aprovado de teste"
area: "Nutrição"
icone: "🥗"
resumo: "Texto fictício de teste usado só para validar a renderização de temas aprovados."
ordem: 1
status: "aprovado"
revisadoPor: "Revisora de Teste"
revisadoEm: "2026-10-20"
referencias:
  - titulo: "Referência fictícia de teste"
    instituicao: "Instituição fictícia"
    url: "https://example.org/ref-teste"
    acessadoEm: "2026-10-01"
---
## Seção de teste

Parágrafo com **destaque** e [link](https://example.org/).

- Item A
- Item B

1. Passo 1
2. Passo 2
`;

const RASCUNHO = `---
title: "Rascunho de teste"
area: "Psicologia"
icone: "🧪"
resumo: "Rascunho fictício que nunca deve aparecer no build de produção."
ordem: 2
status: "rascunho"
---
Texto fictício do rascunho.
`;

const APROVADO_SEM_METADADOS = `---
title: "Tema aprovado sem metadados editoriais"
area: "Nutrição"
icone: "🥗"
resumo: "Tema que declara status aprovado sem revisor, sem data e sem referências."
ordem: 1
status: "aprovado"
---
Texto fictício.
`;

afterAll(limparTemporarios);

const CONFIG = { estagio: 'preparacao', temasObrigatorios: ['aprovado-teste'], categoriasObrigatorias: ['sono'] };


describe('build com um tema aprovado e um rascunho', () => {
  let producao: ReturnType<typeof construir>;
  let teste: ReturnType<typeof construir>;

  beforeAll(() => {
    const projeto = criarProjeto({ 'aprovado-teste.md': APROVADO, 'rascunho-teste.md': RASCUNHO });
    producao = construir(projeto, 'producao');
    teste = construir(projeto, 'teste');
  }, 240_000);

  describe('produção', () => {
    it('conclui o build', () => {
      expect(producao.saida).not.toMatch(/\[ERROR\]|error:/i);
      expect(producao.codigo).toBe(0);
    });

    it('gera a página do tema aprovado e não gera a do rascunho', () => {
      expect(existsSync(join(producao.dist, 'temas', 'aprovado-teste', 'index.html'))).toBe(true);
      expect(existsSync(join(producao.dist, 'temas', 'rascunho-teste'))).toBe(false);
    });

    it('não expõe o rascunho em nenhum HTML publicado nem em listagens', () => {
      const html = todoHtml(producao.dist);
      expect(html).not.toContain('rascunho-teste');
      expect(html).not.toContain('Rascunho de teste');
      expect(html).not.toContain('Conteúdo em revisão');
      expect(html).not.toContain('Em revisão');
      expect(htmlDe(producao.dist, '')).toContain('/conecta-saude/temas/aprovado-teste/');
    });

    it('renderiza título, área, resumo, Markdown, referências e dados da revisão', () => {
      const html = htmlDe(producao.dist, 'temas/aprovado-teste');
      expect(html).toContain('<h1>Tema aprovado de teste</h1>');
      expect(html).toContain('Nutrição');
      expect(html).toContain('Texto fictício de teste usado só para validar');
      expect(html).toMatch(/<h2 id="[^"]*">Seção de teste<\/h2>/);
      expect(html).toContain('<strong>destaque</strong>');
      expect(html).toMatch(/<ul>\s*<li>Item A<\/li>/);
      expect(html).toMatch(/<ol>\s*<li>Passo 1<\/li>/);
      expect(html).toContain('<h2 id="titulo-referencias">Referências</h2>');
      expect(html).toContain('href="https://example.org/ref-teste"');
      expect(html).toContain('Referência fictícia de teste');
      expect(html).toContain('<time datetime="2026-10-01">01/10/2026</time>');
      expect(html).toMatch(/Revisado por <strong>Revisora de Teste<\/strong> em\s*<time datetime="2026-10-20">20\/10\/2026<\/time>/);
      expect(html).not.toContain('aviso-rascunho');
    });

    it('cumpre o contrato do portão de release', () => {
      const { erros, resumo } = verificarRelease({ distDir: producao.dist, config: CONFIG, hoje: new Date('2026-10-27T12:00:00Z') });
      expect(erros).toEqual([]);
      expect(resumo?.temas).toEqual(['aprovado-teste']);
    });
  });

  describe('teste', () => {
    it('conclui o build e gera as páginas do tema aprovado e do rascunho', () => {
      expect(teste.codigo).toBe(0);
      expect(existsSync(join(teste.dist, 'temas', 'aprovado-teste', 'index.html'))).toBe(true);
      expect(existsSync(join(teste.dist, 'temas', 'rascunho-teste', 'index.html'))).toBe(true);
    });

    it('identifica o rascunho com banner explícito e o lista com a marca "Em revisão"', () => {
      const pagina = htmlDe(teste.dist, 'temas/rascunho-teste');
      expect(pagina).toContain('class="aviso-rascunho"');
      expect(pagina).toContain('Conteúdo em revisão.');
      expect(pagina).toContain('não está liberado para publicação');
      expect(pagina).toContain('data-conteudo="rascunho"');
      expect(pagina).not.toContain('Revisado por');

      const home = htmlDe(teste.dist, '');
      expect(home).toContain('/conecta-saude/temas/rascunho-teste/');
      expect(home).toMatch(/Psicologia\s*<span class="tema-estado">Em revisão<\/span>/);
    });

    it('não coloca banner no tema aprovado', () => {
      expect(htmlDe(teste.dist, 'temas/aprovado-teste')).not.toContain('aviso-rascunho');
    });

    it('seria reprovado pelo portão de release se fosse confundido com produção', () => {
      const { erros } = verificarRelease({ distDir: teste.dist, config: CONFIG, hoje: new Date('2026-10-27T12:00:00Z') });
      expect(erros.join('\n')).toContain('rascunho');
    });
  });
});

describe('metadados inválidos interrompem o build com mensagem clara', () => {
  it('tema aprovado sem revisor, data e referências', () => {
    const r = construir(criarProjeto({ 'incompleto.md': APROVADO_SEM_METADADOS }), 'producao');
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('incompleto.md');
    expect(r.saida).toContain('tema aprovado exige revisadoPor');
    expect(r.saida).toContain('tema aprovado exige revisadoEm');
    expect(r.saida).toContain('tema aprovado exige ao menos uma referência');
    expect(existsSync(join(r.dist, 'temas'))).toBe(false);
  }, 120_000);

  it('data de revisão inexistente', () => {
    const invalido = APROVADO.replace('revisadoEm: "2026-10-20"', 'revisadoEm: "2026-02-30"');
    const r = construir(criarProjeto({ 'data-invalida.md': invalido }), 'producao');
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('revisadoEm deve ser uma data real no formato AAAA-MM-DD');
  }, 120_000);

  it('nome de arquivo fora do padrão', () => {
    const r = construir(criarProjeto({ 'Saúde Mental.md': RASCUNHO }), 'producao');
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('Nome de arquivo inválido para um tema');
  }, 120_000);
});
