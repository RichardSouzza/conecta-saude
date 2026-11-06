import { describe, expect, it } from 'vitest';
import {
  dataIsoValida,
  formatarData,
  ordenarTemas,
  selecionarPublicaveis,
  temaSchema,
  validarSlug,
} from '../../src/lib/tema';

const referencia = {
  titulo: 'Referência fictícia',
  instituicao: 'Instituição fictícia',
  url: 'https://example.org/referencia',
  acessadoEm: '2026-10-01',
};

const rascunho = {
  title: 'Título de teste',
  area: 'Computação',
  icone: '🧩',
  resumo: 'Resumo fictício com mais de vinte caracteres.',
  ordem: 1,
  status: 'rascunho',
};

const aprovado = {
  ...rascunho,
  status: 'aprovado',
  revisadoPor: 'Revisora de Teste',
  revisadoEm: '2026-10-20',
  referencias: [referencia],
};

function problemas(entrada: unknown): string[] {
  const resultado = temaSchema.safeParse(entrada);
  return resultado.success ? [] : resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('schema dos temas: estados editoriais', () => {
  it('aceita um rascunho sem metadados editoriais', () => {
    expect(problemas(rascunho)).toEqual([]);
    const resultado = temaSchema.parse(rascunho);
    expect(resultado.referencias).toEqual([]);
    expect(resultado.revisadoPor).toBeUndefined();
  });

  it('aceita um rascunho com metadados editoriais parciais', () => {
    expect(problemas({ ...rascunho, revisadoPor: 'Revisora de Teste' })).toEqual([]);
  });

  it('aceita um tema aprovado completo', () => {
    expect(problemas(aprovado)).toEqual([]);
  });

  it('exige status explícito: a ausência de metadados editoriais não vira aprovação', () => {
    const { status: _status, ...semStatus } = aprovado;
    expect(problemas(semStatus).join('\n')).toContain('status é obrigatório');
    expect(temaSchema.safeParse(semStatus).success).toBe(false);
  });

  it('rejeita status desconhecido', () => {
    expect(problemas({ ...aprovado, status: 'publicado' }).join('\n')).toContain('status é obrigatório e deve ser');
  });

  it('rejeita tema aprovado sem revisor', () => {
    const { revisadoPor: _r, ...semRevisor } = aprovado;
    expect(problemas(semRevisor)).toContain('revisadoPor: tema aprovado exige revisadoPor (quem revisou)');
  });

  it('rejeita tema aprovado com revisor vazio ou só com espaços', () => {
    expect(problemas({ ...aprovado, revisadoPor: '' }).join('\n')).toContain('revisadoPor');
    expect(problemas({ ...aprovado, revisadoPor: '   ' }).join('\n')).toContain('revisadoPor');
  });

  it('rejeita tema aprovado sem data de revisão', () => {
    const { revisadoEm: _d, ...semData } = aprovado;
    expect(problemas(semData)).toContain('revisadoEm: tema aprovado exige revisadoEm (data da revisão)');
  });

  it('rejeita tema aprovado sem referências', () => {
    const { referencias: _refs, ...semRefs } = aprovado;
    expect(problemas(semRefs)).toContain('referencias: tema aprovado exige ao menos uma referência');
    expect(problemas({ ...aprovado, referencias: [] })).toContain('referencias: tema aprovado exige ao menos uma referência');
  });

  it('informa todas as pendências de um tema aprovado sem metadados editoriais', () => {
    const erros = problemas({ ...rascunho, status: 'aprovado' }).join('\n');
    expect(erros).toContain('revisadoPor');
    expect(erros).toContain('revisadoEm');
    expect(erros).toContain('referencias');
  });
});

describe('schema dos temas: datas', () => {
  it.each([
    ['dia inexistente', '2026-02-30'],
    ['mês inexistente', '2026-13-01'],
    ['formato brasileiro', '20/10/2026'],
    ['sem zero à esquerda', '2026-1-5'],
    ['com horário', '2026-10-20T10:00:00Z'],
    ['texto', 'ontem'],
    ['vazia', ''],
  ])('rejeita revisadoEm inválida: %s', (_nome, valor) => {
    expect(problemas({ ...aprovado, revisadoEm: valor }).join('\n')).toContain('revisadoEm');
  });

  it('rejeita data no futuro', () => {
    expect(problemas({ ...aprovado, revisadoEm: '2999-01-01' })).toContain('revisadoEm: revisadoEm não pode estar no futuro');
  });

  it('rejeita data sem aspas (o YAML a converte em Date)', () => {
    expect(problemas({ ...aprovado, revisadoEm: new Date('2026-10-20') }).join('\n')).toContain('entre aspas');
  });

  it('valida as datas de acesso das referências', () => {
    const erros = problemas({ ...aprovado, referencias: [{ ...referencia, acessadoEm: '2026-02-30' }] });
    expect(erros.join('\n')).toContain('referencias.0.acessadoEm');
  });

  it('dataIsoValida e formatarData', () => {
    expect(dataIsoValida('2024-02-29')).toBe(true);
    expect(dataIsoValida('2026-02-29')).toBe(false);
    expect(formatarData('2026-10-20')).toBe('20/10/2026');
  });
});

describe('schema dos temas: demais campos', () => {
  it.each([
    ['title curto', { title: 'ab' }, 'title'],
    ['title ausente', { title: undefined }, 'title'],
    ['area fora da lista', { area: 'Medicina' }, 'area'],
    ['icone vazio', { icone: '' }, 'icone'],
    ['icone longo', { icone: 'x'.repeat(17) }, 'icone'],
    ['resumo curto', { resumo: 'curto' }, 'resumo'],
    ['resumo longo', { resumo: 'x'.repeat(281) }, 'resumo'],
    ['ordem zero', { ordem: 0 }, 'ordem'],
    ['ordem decimal', { ordem: 1.5 }, 'ordem'],
    ['ordem texto', { ordem: '1' }, 'ordem'],
    ['campo desconhecido', { revisadoPorr: 'x' }, 'campo(s) desconhecido(s): revisadoPorr'],
  ])('rejeita %s', (_nome, mudanca, trecho) => {
    expect(problemas({ ...rascunho, ...mudanca }).join('\n')).toContain(trecho);
  });

  it.each([
    ['http', 'http://example.org/x'],
    ['javascript:', 'javascript:alert(1)'],
    ['sem esquema', 'example.org/x'],
    ['texto', 'não é uma url'],
    ['vazia', ''],
  ])('rejeita url de referência inválida: %s', (_nome, url) => {
    const erros = problemas({ ...aprovado, referencias: [{ ...referencia, url }] });
    expect(erros.join('\n')).toContain('referencias.0.url');
  });

  it.each([
    ['titulo', { titulo: 'ab' }],
    ['instituicao', { instituicao: '' }],
  ])('rejeita referência com %s inválido', (campo, mudanca) => {
    expect(problemas({ ...aprovado, referencias: [{ ...referencia, ...mudanca }] }).join('\n')).toContain(`referencias.0.${campo}`);
  });

  it('rejeita campo desconhecido em referência', () => {
    const erros = problemas({ ...aprovado, referencias: [{ ...referencia, ano: 2020 }] });
    expect(erros.join('\n')).toContain('campo(s) desconhecido(s): ano');
  });
});

describe('seleção e ordenação dos temas', () => {
  const entradas = [
    { id: 'b', data: { status: 'aprovado', ordem: 2, title: 'B' } },
    { id: 'rascunho', data: { status: 'rascunho', ordem: 1, title: 'Rascunho' } },
    { id: 'a', data: { status: 'aprovado', ordem: 1, title: 'A' } },
  ];

  it('produção: só os temas aprovados', () => {
    expect(selecionarPublicaveis(entradas, false).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('teste: aprovados e rascunhos', () => {
    expect(selecionarPublicaveis(entradas, true)).toHaveLength(3);
  });

  it('ordena por ordem e, em empate, por título', () => {
    expect(ordenarTemas(entradas).map((e) => e.id)).toEqual(['a', 'rascunho', 'b']);
  });

  it('não altera a lista original', () => {
    const copia = [...entradas];
    ordenarTemas(entradas);
    expect(entradas).toEqual(copia);
  });
});

describe('nome do arquivo do tema', () => {
  it.each(['alimentacao', 'saude-mental', 'tema-2'])('aceita %s', (id) => {
    expect(() => validarSlug(id)).not.toThrow();
  });

  it.each(['Alimentação', 'saude_mental', 'saúde-bucal', 'tema final', '-inicio', 'fim-'])('rejeita "%s"', (id) => {
    expect(() => validarSlug(id)).toThrow(/Nome de arquivo inválido para um tema/);
  });
});
