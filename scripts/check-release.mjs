// Portão de release do Conecta Saúde.
//
// Roda SEMPRE dentro de `npm run ci:build`, sobre o dist/ de produção, e não
// depende de variável de ambiente: o estágio vem de release.config.json
// (versionado). Se o arquivo faltar ou for inválido, o portão falha.
//
// Contrato com o template das páginas (Fases 2 e 3):
//   dist/temas/<slug>/index.html  contém um elemento com
//     data-conteudo="aprovado" data-tema="<slug>" data-revisado-por="..."
//     data-revisado-em="AAAA-MM-DD" data-referencias="<n>"
//   dist/quiz/index.html          contém um elemento com
//     data-quiz-status="aprovado"
//     data-categorias="<categoria>:<tema>,..."   (cada categoria e o tema a que ela aponta)
//     data-aprovacoes="<categoria>,..."          (categorias com aprovação registrada)
//
// Fonte canônica das listas obrigatórias: release.config.json
//   temasObrigatorios      slugs dos temas
//   categoriasObrigatorias ids das categorias do quiz
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTAGIOS = ['preparacao', 'final'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Qualquer um destes textos no dist/ de produção derruba o build.
const MARCADORES_PROIBIDOS = [
  { re: /data-conteudo=["']?(rascunho|demonstracao)\b/i, nome: 'atributo data-conteudo de rascunho ou demonstração' },
  { re: /Conteúdo em revisão/, nome: 'banner "Conteúdo em revisão"' },
  { re: /DEMONSTRAÇÃO/, nome: 'selo "DEMONSTRAÇÃO"' },
];

function validarListaSlugs(config, campo, erros) {
  const itens = config[campo];
  if (!Array.isArray(itens) || itens.length === 0) {
    erros.push(`"${campo}" deve ser uma lista não vazia de slugs.`);
    return;
  }
  if (itens.some((t) => typeof t !== 'string' || !SLUG.test(t))) {
    erros.push(`"${campo}" contém slug inválido (use minúsculas, números e hífens).`);
  }
  if (new Set(itens).size !== itens.length) {
    erros.push(`"${campo}" contém slugs duplicados.`);
  }
}

/** Valida o objeto de release.config.json. Retorna a lista de erros. */
export function validarConfig(config) {
  const erros = [];
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return ['release.config.json deve ser um objeto JSON.'];
  }
  if (!ESTAGIOS.includes(config.estagio)) {
    erros.push(`"estagio" deve ser um destes valores: ${ESTAGIOS.join(', ')}.`);
  }
  validarListaSlugs(config, 'temasObrigatorios', erros);
  validarListaSlugs(config, 'categoriasObrigatorias', erros);
  return erros;
}

/** Lê e valida release.config.json a partir da raiz do projeto. */
export function lerConfig(raiz) {
  const caminho = join(raiz, 'release.config.json');
  if (!existsSync(caminho)) {
    return { config: null, erros: ['release.config.json não encontrado.'] };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (e) {
    return { config: null, erros: [`release.config.json não é um JSON válido: ${e.message}`] };
  }
  const erros = validarConfig(config);
  return { config: erros.length === 0 ? config : null, erros };
}

function listarEntradas(dir, base = dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const completo = join(dir, nome);
    const rel = completo.slice(base.length + 1).split('\\').join('/');
    const ehDir = statSync(completo).isDirectory();
    saida.push({ completo, rel, nome, ehDir });
    if (ehDir) saida.push(...listarEntradas(completo, base));
  }
  return saida;
}

function atributo(html, nome) {
  const m = html.match(new RegExp(`data-${nome}=(?:"([^"]*)"|'([^']*)'|([^\\s>"']+))`, 'i'));
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

function lista(valor) {
  return (valor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function dataValida(valor, hoje) {
  if (!valor || !DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return false;
  return valor <= hoje.toISOString().slice(0, 10);
}

function duplicados(itens) {
  return [...new Set(itens.filter((x, i) => itens.indexOf(x) !== i))];
}

/** Compara as categorias declaradas pelo quiz publicado com a lista canônica do release.config.json. */
function verificarCategoriasQuiz({ html, config, temasPublicados }) {
  const erros = [];
  const declaradas = [];
  const vinculos = new Map();

  for (const par of lista(atributo(html, 'categorias'))) {
    const m = par.match(/^([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (!m) {
      erros.push(`quiz/: entrada inválida em data-categorias: "${par}" (use categoria:tema).`);
      continue;
    }
    declaradas.push(m[1]);
    vinculos.set(m[1], m[2]);
  }
  const unicas = [...new Set(declaradas)];

  if (declaradas.length === 0) erros.push('quiz/: nenhuma categoria declarada (data-categorias).');
  for (const c of duplicados(declaradas)) erros.push(`quiz/: categoria "${c}" declarada mais de uma vez.`);
  for (const c of config.categoriasObrigatorias.filter((c) => !unicas.includes(c))) {
    erros.push(`quiz/: categoria obrigatória "${c}" não declarada.`);
  }
  for (const c of unicas.filter((c) => !config.categoriasObrigatorias.includes(c))) {
    erros.push(`quiz/: categoria inesperada "${c}" (não consta em categoriasObrigatorias).`);
  }

  const aprovadas = lista(atributo(html, 'aprovacoes'));
  for (const c of duplicados(aprovadas)) erros.push(`quiz/: aprovação da categoria "${c}" registrada mais de uma vez.`);
  for (const c of unicas.filter((c) => !aprovadas.includes(c))) {
    erros.push(`quiz/: a categoria "${c}" não tem aprovação registrada (data-aprovacoes).`);
  }
  for (const c of [...new Set(aprovadas)].filter((c) => !unicas.includes(c))) {
    erros.push(`quiz/: aprovação registrada para a categoria "${c}", que não está declarada.`);
  }

  for (const [categoria, tema] of vinculos) {
    if (!temasPublicados.includes(tema)) {
      erros.push(`quiz/: a categoria "${categoria}" aponta para o tema "${tema}", que não está publicado.`);
    }
  }
  return erros;
}

/**
 * Verifica o dist/ de produção contra o estágio configurado.
 * @param {{ distDir: string, config: { estagio: string, temasObrigatorios: string[] }, hoje?: Date }} opcoes
 */
export function verificarRelease({ distDir, config, hoje = new Date() }) {
  const erros = [];

  if (!existsSync(join(distDir, 'index.html'))) {
    return { erros: [`${distDir}/index.html não existe: o build de produção não gerou o site.`], resumo: null };
  }

  const entradas = listarEntradas(distDir);

  // 1. Nenhuma entrada oculta, em qualquer nível. O upload para o Pages as
  //    descarta, então o artefato deixaria de ser idêntico ao dist/ validado.
  for (const e of entradas.filter((x) => x.nome.startsWith('.'))) {
    erros.push(`Entrada oculta em dist/: ${e.rel}`);
  }

  // 2. Nenhum marcador de rascunho ou demonstração em nenhum HTML publicado.
  for (const e of entradas.filter((x) => !x.ehDir && x.nome.endsWith('.html'))) {
    const html = readFileSync(e.completo, 'utf8');
    for (const m of MARCADORES_PROIBIDOS) {
      if (m.re.test(html)) erros.push(`${e.rel}: contém ${m.nome}.`);
    }
  }

  // 3. Temas publicados: todos aprovados, com revisor, data e referência.
  const temasPublicados = [];
  const dirTemas = join(distDir, 'temas');
  if (existsSync(dirTemas)) {
    for (const slug of readdirSync(dirTemas)) {
      const pagina = join(dirTemas, slug, 'index.html');
      if (!existsSync(pagina)) continue;
      temasPublicados.push(slug);
      const html = readFileSync(pagina, 'utf8');
      const onde = `temas/${slug}`;
      if (atributo(html, 'conteudo') !== 'aprovado') erros.push(`${onde}: tema publicado sem data-conteudo="aprovado".`);
      if (atributo(html, 'tema') !== slug) erros.push(`${onde}: data-tema ausente ou diferente do slug.`);
      if (!atributo(html, 'revisado-por')) erros.push(`${onde}: sem revisor (data-revisado-por).`);
      if (!dataValida(atributo(html, 'revisado-em'), hoje)) erros.push(`${onde}: data da revisão ausente, inválida ou no futuro (data-revisado-em).`);
      const refs = Number.parseInt(atributo(html, 'referencias') ?? '', 10);
      if (!(refs >= 1)) erros.push(`${onde}: sem referências (data-referencias deve ser >= 1).`);
    }
  }

  // 4. Quiz: proibido em preparacao; obrigatório e aprovado em final.
  const paginaQuiz = join(distDir, 'quiz', 'index.html');
  const quizPresente = existsSync(join(distDir, 'quiz'));
  if (config.estagio === 'preparacao') {
    if (quizPresente) erros.push('quiz/: o quiz não pode ser publicado no estágio "preparacao".');
  } else {
    if (!existsSync(paginaQuiz)) {
      erros.push('quiz/: o estágio "final" exige o quiz publicado.');
    } else {
      const html = readFileSync(paginaQuiz, 'utf8');
      if (atributo(html, 'quiz-status') !== 'aprovado') erros.push('quiz/: data-quiz-status deve ser "aprovado".');
      erros.push(...verificarCategoriasQuiz({ html, config, temasPublicados }));
    }
  }

  // 5. Estágio final: todos os temas obrigatórios publicados.
  if (config.estagio === 'final') {
    for (const t of config.temasObrigatorios.filter((t) => !temasPublicados.includes(t))) {
      erros.push(`temas/${t}: tema obrigatório não publicado (estágio "final").`);
    }
  }

  return { erros, resumo: { estagio: config.estagio, temas: temasPublicados, quiz: quizPresente } };
}

function principal() {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { config, erros: errosConfig } = lerConfig(raiz);
  if (!config) {
    for (const e of errosConfig) console.error(`✖ ${e}`);
    process.exit(1);
  }
  const { erros, resumo } = verificarRelease({ distDir: join(raiz, 'dist'), config });
  if (erros.length > 0) {
    console.error(`✖ Portão de release (estágio "${config.estagio}") reprovado:`);
    for (const e of erros) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✔ Portão de release (estágio "${resumo.estagio}"): ${resumo.temas.length} tema(s) publicado(s), quiz ${resumo.quiz ? 'publicado' : 'ausente'}.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal();
}
