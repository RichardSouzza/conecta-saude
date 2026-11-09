import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

export const BASE = '/conecta-saude/';

export const ALVO = process.env.PW_ALVO === 'producao' ? 'producao' : 'teste';
export const TEMA_DEMO = 'demo-estrutura';
export const TEMA_MINIMO = 'demo-minimo';

export const PAGINAS = [
  { nome: 'início', caminho: '', status: 200 },
  { nome: 'sobre', caminho: 'sobre/', status: 200 },
  { nome: '404', caminho: 'nao-existe/', status: 404 },
  ...(ALVO === 'teste'
    ? [
        { nome: 'tema (rascunho demonstrativo)', caminho: `temas/${TEMA_DEMO}/`, status: 200 },
        { nome: 'quiz', caminho: 'quiz/', status: 200 },
      ]
    : []),
];

interface OpcaoDoQuiz { id: string; rotulo: string; pontos: number }
export interface PerguntaDoQuiz { id: string; categoria: string; texto: string; opcoes: OpcaoDoQuiz[] }
export interface DadosDoQuiz {
  status: string;
  categorias: { id: string; rotulo: string; tema: string }[];
  perguntas: PerguntaDoQuiz[];
  faixas: { id: string; rotulo: string; mensagem: string; destacar: boolean }[];
  resultado: { introducao: string; semDestaque: string; aviso: string };
}

export const QUIZ: DadosDoQuiz = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'quiz.json'), 'utf8'));

// Recursos com erro HTTP são acompanhados pelo evento `response`; o aviso genérico do console
// ("Failed to load resource") é ignorado porque a página 404 responde 404 de propósito.
export function observar(page: Page, baseURL: string) {
  const origem = new URL(baseURL).origin;
  const erros: string[] = [];
  const externas: string[] = [];
  const falhas: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erros.push(m.text());
  });
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('requestfailed', (r) => falhas.push(`${r.url()} (${r.failure()?.errorText ?? 'falhou'})`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.request().resourceType() !== 'document') falhas.push(`${r.url()} (HTTP ${r.status()})`);
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (new URL(u).origin !== origem) externas.push(u);
  });
  return { erros, externas, falhas };
}

export async function contorno(locator: Locator) {
  return locator.evaluate((el) => {
    const c = getComputedStyle(el);
    return { estilo: c.outlineStyle, largura: Number.parseFloat(c.outlineWidth), deslocamento: c.outlineOffset };
  });
}

// Registra, durante a vida do documento, escritas feitas por estas vias (mesmo que depois sejam apagadas):
//   métodos de Storage, atribuição e remoção de propriedades em localStorage/sessionStorage,
//   document.cookie, cookieStore.set/delete, indexedDB.open/deleteDatabase, CacheStorage/Cache e
//   serviceWorker.register.
// Não cobre: Web SQL, OPFS/File System Access, escritas feitas em workers ou iframes, Set-Cookie enviado pelo
// servidor (só o estado final, via context.cookies()) e outros navegadores além do Chromium. O init script roda
// antes dos scripts da página, mas não prova a ausência absoluta de gravações: reduz o risco nessas vias.
export async function instrumentarGravacoes(page: Page) {
  await page.addInitScript(() => {
    const registro: string[] = [];
    Object.defineProperty(window, '__gravacoes', { value: registro });

    const envolver = (alvo: any, metodo: string, nome: string) => {
      const original = alvo?.[metodo];
      if (typeof original !== 'function') return;
      alvo[metodo] = function (this: unknown, ...args: unknown[]) {
        registro.push(nome);
        return original.apply(this, args);
      };
    };

    for (const m of ['setItem', 'removeItem', 'clear']) envolver(Storage.prototype, m, `Storage.${m}`);
    envolver(IDBFactory.prototype, 'open', 'indexedDB.open');
    envolver(IDBFactory.prototype, 'deleteDatabase', 'indexedDB.deleteDatabase');
    if (typeof CacheStorage !== 'undefined') envolver(CacheStorage.prototype, 'open', 'caches.open');
    if (typeof Cache !== 'undefined') for (const m of ['put', 'add', 'addAll']) envolver(Cache.prototype, m, `Cache.${m}`);
    if (typeof ServiceWorkerContainer !== 'undefined') envolver(ServiceWorkerContainer.prototype, 'register', 'serviceWorker.register');
    if (typeof CookieStore !== 'undefined') for (const m of ['set', 'delete']) envolver(CookieStore.prototype, m, `cookieStore.${m}`);

    // O proxy só acrescenta o registro de atribuição e remoção direta de propriedades.
    for (const nome of ['localStorage', 'sessionStorage'] as const) {
      try {
        const real = window[nome];
        const proxy = new Proxy(real, {
          get(alvo, prop) {
            const valor = Reflect.get(alvo, prop, alvo);
            return typeof valor === 'function' ? valor.bind(alvo) : valor;
          },
          set(alvo, prop, valor) {
            registro.push(`${nome}.atribuição`);
            return Reflect.set(alvo, prop, valor, alvo);
          },
          deleteProperty(alvo, prop) {
            registro.push(`${nome}.remoção`);
            return Reflect.deleteProperty(alvo, prop);
          },
        });
        Object.defineProperty(window, nome, { configurable: true, get: () => proxy });
      } catch {
        // origem sem acesso a storage (ex.: about:blank sandboxed): nada a instrumentar
      }
    }

    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cookie?.get && cookie.set) {
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: cookie.get,
        set(valor: string) {
          registro.push('document.cookie');
          cookie.set!.call(this, valor);
        },
      });
    }
  });
}

export function gravacoes(page: Page): Promise<string[]> {
  return page.evaluate(() => [...((window as any).__gravacoes as string[])]);
}
