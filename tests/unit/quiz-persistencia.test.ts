import { describe, expect, it } from 'vitest';
import { coletarArquivos, verificarPersistencia } from '../../scripts/check-quiz-persistence.mjs';

const arquivo = (conteudo: string) => [{ caminho: 'src/components/Quiz.tsx', conteudo }];
const apis = (conteudo: string) => verificarPersistencia(arquivo(conteudo)).map((v: { api: string }) => v.api);

describe('verificação estática de privacidade do quiz', () => {
  it.each([
    ['localStorage', "localStorage.setItem('a', '1')", 'localStorage'],
    ['sessionStorage', "sessionStorage.getItem('a')", 'sessionStorage'],
    ['indexedDB', "indexedDB.open('db')", 'indexedDB'],
    ['cookie', "document.cookie = 'a=b'", 'document.cookie'],
    ['cookieStore', "await cookieStore.set('a', 'b')", 'cookieStore'],
    ['Cache Storage', "await caches.open('c')", 'Cache Storage'],
    ['service worker', "navigator.serviceWorker.register('/sw.js')", 'service worker'],
    ['fetch', "fetch('/api', { method: 'POST' })", 'fetch'],
    ['XMLHttpRequest', 'const x = new XMLHttpRequest()', 'XMLHttpRequest'],
    ['sendBeacon', "navigator.sendBeacon('/x', dados)", 'sendBeacon'],
    ['WebSocket', "new WebSocket('wss://exemplo.org')", 'WebSocket'],
    ['EventSource', "new EventSource('/eventos')", 'EventSource'],
    ['history.pushState', "history.pushState({}, '', '?r=1')", 'history.pushState/replaceState'],
    ['window.location', "window.location = '/x'", 'window.location/document.location'],
    ['location.hash', "location.hash = '#a'", 'location.href/assign/replace/search/hash'],
    ['formulário', '<form onSubmit={enviar}>', '<form>'],
  ])('detecta %s', (_nome, codigo, esperado) => {
    expect(apis(codigo)).toContain(esperado);
  });

  it('informa o arquivo e a linha da violação', () => {
    const resultado = verificarPersistencia(arquivo("const a = 1;\nconst b = fetch('/x');\n"));
    expect(resultado).toEqual([{ caminho: 'src/components/Quiz.tsx', linha: 2, api: 'fetch' }]);
  });

  it('ignora menções em comentários, mas não ignora URLs em textos', () => {
    expect(apis("// não usar localStorage aqui\n/* nem fetch( */\n<!-- document.cookie -->")).toEqual([]);
    expect(apis("const u = 'https://exemplo.org'; localStorage.clear();")).toEqual(['localStorage']);
  });

  it('aceita código sem APIs de armazenamento ou envio', () => {
    expect(apis("const [estado, despachar] = useReducer(reducer, inicial);\nreturn <button type=\"button\">Próxima</button>;")).toEqual([]);
  });

  it('o código atual do quiz não tem violações e a verificação encontra os arquivos esperados', () => {
    const arquivos = coletarArquivos(process.cwd());
    const caminhos = arquivos.map((a: { caminho: string }) => a.caminho);
    expect(caminhos).toEqual(
      expect.arrayContaining(['src/components/Quiz.tsx', 'src/rotas/quiz.astro', 'src/lib/quiz/pontuacao.ts', 'src/lib/quiz/estado.ts']),
    );
    expect(verificarPersistencia(arquivos)).toEqual([]);
  });

  it('não encontra arquivos em uma raiz sem o quiz', () => {
    expect(coletarArquivos('/caminho/que/nao/existe')).toEqual([]);
  });
});
