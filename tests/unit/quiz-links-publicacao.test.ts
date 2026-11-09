import { describe, expect, it } from 'vitest';
import { linkDaListagem, montarLinks } from '../../src/lib/quiz/links';
import { quizPublicavel } from '../../src/lib/quiz/publicacao';

const url = (caminho: string) => `/conecta-saude${caminho}`;
const categorias = [{ tema: 'saude-mental' }, { tema: 'alimentacao' }, { tema: 'saude-mental' }, { tema: 'prevencao' }];

describe('links dos resultados', () => {
  it('só cria links para temas publicados, com o caminho-base', () => {
    const links = montarLinks(categorias, [{ id: 'alimentacao', titulo: 'Alimentação' }, { id: 'outro', titulo: 'Outro' }], url);
    expect(links).toEqual({ alimentacao: { titulo: 'Alimentação', href: '/conecta-saude/temas/alimentacao/' } });
  });

  it('não inventa link quando nenhum tema está publicado', () => {
    expect(montarLinks(categorias, [], url)).toEqual({});
  });

  it('não duplica o link de um tema usado por mais de uma categoria', () => {
    const links = montarLinks(categorias, [{ id: 'saude-mental', titulo: 'Saúde mental' }], url);
    expect(Object.keys(links)).toEqual(['saude-mental']);
  });

  it('a listagem geral só existe quando há temas publicados', () => {
    expect(linkDaListagem([], url)).toBeNull();
    expect(linkDaListagem([{ id: 'x' }], url)).toEqual({ href: '/conecta-saude/#titulo-temas' });
  });
});

describe('quando o quiz é publicado', () => {
  it.each([
    ['build de teste, em demonstração', { modoTeste: true, estagio: 'preparacao', status: 'demonstracao' }, true],
    ['build de teste, aprovado', { modoTeste: true, estagio: 'final', status: 'aprovado' }, true],
    ['produção, preparação, em demonstração', { modoTeste: false, estagio: 'preparacao', status: 'demonstracao' }, false],
    ['produção, preparação, mesmo aprovado', { modoTeste: false, estagio: 'preparacao', status: 'aprovado' }, false],
    ['produção, final, em demonstração', { modoTeste: false, estagio: 'final', status: 'demonstracao' }, false],
    ['produção, final, aprovado', { modoTeste: false, estagio: 'final', status: 'aprovado' }, true],
  ])('%s', (_nome, entrada, esperado) => {
    expect(quizPublicavel(entrada)).toBe(esperado);
  });
});
