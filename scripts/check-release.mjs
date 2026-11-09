// Portão de release. Roda sempre dentro de `npm run ci:build`, sobre o dist/ de produção.
// O estágio e as listas obrigatórias vêm de release.config.json (versionado); não há variável de ambiente.
//
// Contrato com as páginas geradas (Fases 2 e 3):
//   dist/temas/<slug>/index.html  elemento com data-conteudo="aprovado" data-tema="<slug>"
//                                 data-revisado-por="..." data-revisado-em="AAAA-MM-DD" data-referencias="<n>"
//   dist/quiz/index.html          elemento com data-quiz-status="aprovado"
//                                 data-categorias="<categoria>:<tema>,..."  (categoria e tema a que aponta)
//                                 data-aprovacoes="<categoria>,..."
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTAGIOS = ['preparacao', 'final'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAR_CATEGORIA_TEMA = /^([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const INTEIRO_POSITIVO = /^[1-9]\d*$/;

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

// Mantém segmentos vazios ("a,,b", "a,", ",a") para que quem chama os rejeite.
function lista(valor) {
  if (valor === null || valor.trim() === '') return [];
  return valor.split(',').map((s) => s.trim());
}

function duplicados(itens) {
  return [...new Set(itens.filter((x, i) => itens.indexOf(x) !== i))];
}

function dataValida(valor, hoje) {
  if (!valor || !DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return false;
  return valor <= hoje.toISOString().slice(0, 10);
}

function verificarCategoriasQuiz({ html, config, temasPublicados }) {
  const erros = [];
  const pares = [];

  lista(atributo(html, 'categorias')).forEach((entrada, i) => {
    if (entrada === '') {
      erros.push(`quiz/: segmento vazio em data-categorias (posição ${i + 1}).`);
      return;
    }
    const m = entrada.match(PAR_CATEGORIA_TEMA);
    if (m) pares.push({ categoria: m[1], tema: m[2] });
    else erros.push(`quiz/: entrada inválida em data-categorias: "${entrada}" (use categoria:tema).`);
  });
  const declaradas = [...new Set(pares.map((p) => p.categoria))];

  if (pares.length === 0 && erros.length === 0) erros.push('quiz/: nenhuma categoria declarada (data-categorias).');

  for (const categoria of declaradas) {
    const doPar = pares.filter((p) => p.categoria === categoria);
    const temas = [...new Set(doPar.map((p) => p.tema))];
    if (temas.length > 1) {
      erros.push(`quiz/: a categoria "${categoria}" tem vínculos conflitantes (${temas.join(', ')}).`);
    } else if (doPar.length > 1) {
      erros.push(`quiz/: categoria "${categoria}" declarada mais de uma vez.`);
    }
  }
  for (const c of config.categoriasObrigatorias.filter((c) => !declaradas.includes(c))) {
    erros.push(`quiz/: categoria obrigatória "${c}" não declarada.`);
  }
  for (const c of declaradas.filter((c) => !config.categoriasObrigatorias.includes(c))) {
    erros.push(`quiz/: categoria inesperada "${c}" (não consta em categoriasObrigatorias).`);
  }

  const aprovacoesBrutas = lista(atributo(html, 'aprovacoes'));
  aprovacoesBrutas.forEach((entrada, i) => {
    if (entrada === '') erros.push(`quiz/: segmento vazio em data-aprovacoes (posição ${i + 1}).`);
  });
  const aprovadas = aprovacoesBrutas.filter((c) => c !== '');
  for (const c of duplicados(aprovadas)) erros.push(`quiz/: aprovação da categoria "${c}" registrada mais de uma vez.`);
  for (const c of declaradas.filter((c) => !aprovadas.includes(c))) {
    erros.push(`quiz/: a categoria "${c}" não tem aprovação registrada (data-aprovacoes).`);
  }
  for (const c of [...new Set(aprovadas)].filter((c) => !declaradas.includes(c))) {
    erros.push(`quiz/: aprovação registrada para a categoria "${c}", que não está declarada.`);
  }

  const vinculos = new Set(pares.map((p) => `${p.categoria}:${p.tema}`));
  for (const vinculo of vinculos) {
    const [categoria, tema] = vinculo.split(':');
    if (!temasPublicados.includes(tema)) {
      erros.push(`quiz/: a categoria "${categoria}" aponta para o tema "${tema}", que não está publicado.`);
    }
  }
  return erros;
}

/** @param {{ distDir: string, config: { estagio: string, temasObrigatorios: string[], categoriasObrigatorias: string[] }, hoje?: Date }} opcoes */
export function verificarRelease({ distDir, config, hoje = new Date() }) {
  const erros = [];

  if (!existsSync(join(distDir, 'index.html'))) {
    return { erros: [`${distDir}/index.html não existe: o build de produção não gerou o site.`], resumo: null };
  }

  const entradas = listarEntradas(distDir);

  // O upload para o Pages descarta entradas ocultas; se existissem, o artefato deixaria de ser o dist/ validado.
  for (const e of entradas.filter((x) => x.nome.startsWith('.'))) {
    erros.push(`Entrada oculta em dist/: ${e.rel}`);
  }

  for (const e of entradas.filter((x) => !x.ehDir && x.nome.endsWith('.html'))) {
    const html = readFileSync(e.completo, 'utf8');
    for (const m of MARCADORES_PROIBIDOS) {
      if (m.re.test(html)) erros.push(`${e.rel}: contém ${m.nome}.`);
    }
  }

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
      const refs = atributo(html, 'referencias');
      if (refs === null || !INTEIRO_POSITIVO.test(refs)) {
        erros.push(`${onde}: sem referências (data-referencias deve ser um inteiro >= 1).`);
      }
    }
  }

  const paginaQuiz = join(distDir, 'quiz', 'index.html');
  const quizPresente = existsSync(join(distDir, 'quiz'));
  if (config.estagio === 'preparacao') {
    if (quizPresente) erros.push('quiz/: o quiz não pode ser publicado no estágio "preparacao".');
  } else if (!existsSync(paginaQuiz)) {
    erros.push('quiz/: o estágio "final" exige o quiz publicado.');
  } else {
    const html = readFileSync(paginaQuiz, 'utf8');
    if (atributo(html, 'quiz-status') !== 'aprovado') erros.push('quiz/: data-quiz-status deve ser "aprovado".');
    erros.push(...verificarCategoriasQuiz({ html, config, temasPublicados }));
  }

  if (config.estagio === 'final') {
    for (const t of config.temasObrigatorios.filter((t) => !temasPublicados.includes(t))) {
      erros.push(`temas/${t}: tema obrigatório não publicado (estágio "final").`);
    }
  }

  return { erros, resumo: { estagio: config.estagio, temas: temasPublicados, quiz: quizPresente } };
}

function raizDoProjeto() {
  const i = process.argv.indexOf('--raiz');
  if (i === -1) return resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const valor = process.argv[i + 1];
  if (!valor) {
    console.error('✖ --raiz exige o caminho da raiz do projeto.');
    process.exit(1);
  }
  return resolve(valor);
}

function principal() {
  const raiz = raizDoProjeto();
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
