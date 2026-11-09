import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

export const RAIZ = resolve('.');
const EXCLUIDOS = new Set(['node_modules', 'dist', 'dist-test', '.astro', 'tests', 'test-results', 'playwright-report', '.git']);
const temporarios: string[] = [];

export function limparTemporarios(): void {
  for (const dir of temporarios) rmSync(dir, { recursive: true, force: true });
}

// Copia o projeto para uma pasta temporária, troca os temas e, opcionalmente, outros arquivos (caminho relativo -> conteúdo).
export function criarProjeto(temas: Record<string, string>, outros: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'conecta-build-'));
  temporarios.push(dir);
  cpSync(RAIZ, dir, { recursive: true, filter: (origem) => !EXCLUIDOS.has(origem.slice(RAIZ.length + 1).split(sep)[0]) });
  symlinkSync(join(RAIZ, 'node_modules'), join(dir, 'node_modules'), 'junction');
  const pasta = join(dir, 'src', 'content', 'temas');
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  for (const [nome, conteudo] of Object.entries(temas)) writeFileSync(join(pasta, nome), conteudo);
  for (const [caminho, conteudo] of Object.entries(outros)) {
    const destino = join(dir, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return dir;
}

// O Vitest define BASE_URL, MODE, NODE_ENV e outras variáveis que o Vite leria no build; só herdamos o necessário.
const VARIAVEIS_HERDADAS = ['PATH', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL'];

function ambienteDoBuild(modo: 'producao' | 'teste'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { MODO: modo === 'teste' ? 'teste' : '' };
  for (const nome of VARIAVEIS_HERDADAS) if (process.env[nome] !== undefined) env[nome] = process.env[nome];
  return env;
}

export function construir(dir: string, modo: 'producao' | 'teste') {
  const r = spawnSync(process.execPath, [join(dir, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'], {
    cwd: dir,
    env: ambienteDoBuild(modo),
    encoding: 'utf8',
  });
  return { codigo: r.status, saida: `${r.stdout}\n${r.stderr}`, dist: join(dir, modo === 'teste' ? 'dist-test' : 'dist') };
}

export function htmlDe(dist: string, caminho: string): string {
  return readFileSync(join(dist, caminho, 'index.html'), 'utf8');
}

export function todoHtml(dir: string): string {
  return readdirSync(dir)
    .map((nome) => {
      const completo = join(dir, nome);
      if (statSync(completo).isDirectory()) return todoHtml(completo);
      return nome.endsWith('.html') ? readFileSync(completo, 'utf8') : '';
    })
    .join('\n');
}

export function arquivosComExtensao(dir: string, extensao: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const completo = join(dir, nome);
    if (statSync(completo).isDirectory()) return arquivosComExtensao(completo, extensao);
    return nome.endsWith(extensao) ? [completo] : [];
  });
}
