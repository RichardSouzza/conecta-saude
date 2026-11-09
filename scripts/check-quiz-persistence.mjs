// Reforço estático da privacidade do quiz: proíbe, apenas no código do quiz, APIs que guardam ou enviam dados.
// A garantia principal é comportamental (tests/e2e/quiz.spec.ts); esta verificação impede regressões óbvias.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALVOS = ['src/components/Quiz.tsx', 'src/lib/quiz', 'src/rotas/quiz.astro'];
const EXTENSOES = /\.(ts|tsx|astro|mjs|js)$/;

const PROIBIDOS = [
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bindexedDB\b/, 'indexedDB'],
  [/\bdocument\s*\.\s*cookie\b/, 'document.cookie'],
  [/\bcookieStore\b/, 'cookieStore'],
  [/\bcaches\b/, 'Cache Storage'],
  [/\bserviceWorker\b/, 'service worker'],
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bsendBeacon\b/, 'sendBeacon'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bhistory\s*\.\s*(pushState|replaceState)\b/, 'history.pushState/replaceState'],
  [/\b(window|document)\s*\.\s*location\b/, 'window.location/document.location'],
  [/\blocation\s*\.\s*(href|assign|replace|search|hash)\b/, 'location.href/assign/replace/search/hash'],
  [/<form\b/i, '<form>'],
];

const apagar = (trecho) => trecho.replace(/[^\n]/g, ' ');

function semComentarios(conteudo) {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, apagar)
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, antes) => antes + apagar(m.slice(antes.length)));
}

export function verificarPersistencia(arquivos) {
  const violacoes = [];
  for (const { caminho, conteudo } of arquivos) {
    semComentarios(conteudo)
      .split('\n')
      .forEach((linha, i) => {
        for (const [regex, nome] of PROIBIDOS) {
          if (regex.test(linha)) violacoes.push({ caminho, linha: i + 1, api: nome });
        }
      });
  }
  return violacoes;
}

function listar(caminho) {
  if (!existsSync(caminho)) return [];
  if (!statSync(caminho).isDirectory()) return [caminho];
  return readdirSync(caminho).flatMap((nome) => listar(join(caminho, nome)));
}

export function coletarArquivos(raiz) {
  return ALVOS.flatMap((alvo) => listar(join(raiz, alvo)))
    .filter((arquivo) => EXTENSOES.test(arquivo))
    .map((arquivo) => ({
      caminho: relative(raiz, arquivo).split(sep).join('/'),
      conteudo: readFileSync(arquivo, 'utf8'),
    }));
}

function principal() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const arquivos = coletarArquivos(raiz);
  if (arquivos.length === 0) {
    console.error('✖ Nenhum arquivo do quiz encontrado: a verificação de privacidade não pode ser feita.');
    process.exit(1);
  }
  const violacoes = verificarPersistencia(arquivos);
  if (violacoes.length > 0) {
    console.error('✖ APIs proibidas no código do quiz (privacidade das respostas):');
    for (const v of violacoes) console.error(`  - ${v.caminho}:${v.linha}: ${v.api}`);
    process.exit(1);
  }
  console.log(`✔ Código do quiz sem APIs de armazenamento ou envio de dados (${arquivos.length} arquivos verificados).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
