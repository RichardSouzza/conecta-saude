# Teste seus hábitos

O quiz ajuda o visitante a refletir sobre os próprios hábitos e a encontrar conteúdos do site. Não é uma avaliação
clínica, não faz diagnóstico e não substitui a orientação de profissionais de saúde.

## Como funciona

- De 8 a 10 perguntas, uma por vez, com o progresso ("Pergunta 3 de 10"), botão Voltar e a possibilidade de alterar
  respostas. Não é possível avançar sem escolher uma alternativa.
- O resultado é apresentado por tema (categoria), sem nota geral: os temas que merecem mais atenção aparecem
  primeiro, com uma mensagem acolhedora, um link para o conteúdo relacionado e a ação "Refazer o teste".
- Tudo roda no navegador (Preact). Não há backend, endpoint, banco de dados nem integração externa.

## Onde fica cada parte

| Arquivo | Responsabilidade |
|---|---|
| `src/data/quiz.json` | Perguntas, alternativas, pontos, faixas, textos do resultado, status e aprovações. Só dados e textos. |
| `src/lib/quiz/schema.ts` | Validação do `quiz.json`; um quiz inválido interrompe o build com a lista de problemas. |
| `src/lib/quiz/pontuacao.ts` | Cálculo e classificação, independentes da interface. |
| `src/lib/quiz/estado.ts` | Navegação (responder, avançar, voltar, reiniciar) como função pura. |
| `src/lib/quiz/links.ts` | Links para temas publicados. |
| `src/lib/quiz/publicacao.ts` | Regra de quando o quiz vai ao site. |
| `src/components/Quiz.tsx` | Interface. |
| `src/rotas/quiz.astro` | Página `/quiz/`, criada por `astro.config.mjs` apenas quando o quiz é publicável. |

## Estrutura do `quiz.json`

| Campo | Conteúdo |
|---|---|
| `status` | `demonstracao` ou `aprovado` |
| `categorias` | `id`, `rotulo` e `tema` (slug do tema relacionado) |
| `perguntas` | `id`, `categoria`, `texto` e de 2 a 4 `opcoes` (`id`, `rotulo`, `pontos` de 0 a 2) |
| `faixas` | `id`, `rotulo`, `de`, `ate` (percentuais), `destacar` e `mensagem` |
| `resultado` | `introducao`, `semDestaque` e `aviso` |
| `aprovacoes` | uma por categoria: `categoria`, `aprovadoPor` e `aprovadoEm` (data entre aspas) |

Categorias e temas obrigatórios vêm de `release.config.json`, que é a fonte única dessas listas.

## Pontuação e resultado

1. Cada alternativa vale de 0 a 2 pontos, definidos no `quiz.json`.
2. A pontuação de uma categoria é a soma dos pontos das respostas às suas perguntas. O máximo é a soma do maior valor
   de cada pergunta dela.
3. O percentual (pontos ÷ máximo) é comparado com as `faixas`. Elas cobrem de 0 a 100 sem lacuna nem sobreposição;
   cada faixa vai de `de` (inclusive) até `ate` (exclusive), e a última inclui 100. A comparação usa multiplicação de
   inteiros, sem aritmética de ponto flutuante.
4. Faixas com `destacar: true` formam "Temas que merecem mais atenção"; as demais, "Demais temas". As categorias
   mantêm a ordem do `quiz.json`. Nenhum número é mostrado ao visitante.

O resultado é determinístico: as mesmas respostas sempre dão o mesmo resultado. Para ajustar limites, pontos ou
mensagens, basta editar o `quiz.json`; o código não muda.

## Adicionar ou modificar perguntas

1. Editar `src/data/quiz.json`. O build exige de 8 a 10 perguntas, ids em minúsculas com hífens, de 2 a 4
   alternativas por pergunta, ao menos uma pergunta por categoria e pontuação máxima maior que zero em cada categoria.
2. Conferir com `npm run dev`, que mostra o quiz em modo teste.
3. Rodar `npm test`. Uma categoria nova também precisa constar em `categoriasObrigatorias` do `release.config.json`
   e apontar para um tema de `temasObrigatorios`; os testes e o portão de release conferem isso.
4. Alterar texto, pontos ou faixas de conteúdo já aprovado exige nova aprovação da categoria afetada.

## Relacionar resultados e temas

Cada categoria aponta para um tema (`categorias[].tema`). A proposta atual, ainda pendente de aprovação:

| Categoria | Tema |
|---|---|
| Sono | `saude-mental` |
| Alimentação | `alimentacao` |
| Movimento | `movimento` |
| Saúde bucal | `saude-bucal` |
| Estresse e bem-estar | `saude-mental` |
| Acompanhamento da saúde | `prevencao` |

O link só aparece quando o tema está publicado no build: temas aprovados em produção e, no build de teste, também os
rascunhos. Sem tema publicado, o resultado informa que o conteúdo da área ainda está em preparação, sem criar link.
O link "Ver todos os temas do site" só existe quando há ao menos um tema publicado.

## Publicação e aprovação editorial

O quiz só vai ao site em produção quando `release.config.json` está em `estagio: "final"` **e** o `quiz.json` está
com `status: "aprovado"`. Nos demais casos a rota nem é criada: nenhum HTML nem JavaScript do quiz entra em `dist/`,
e o portão de release reprova qualquer vestígio. No build de teste e em `npm run dev` ele sempre existe, com o banner
"DEMONSTRAÇÃO".

Todo o conteúdo atual está como `demonstracao`, sem nenhuma aprovação registrada. Dependem de aprovação escrita:

| Conteúdo | Quem aprova |
|---|---|
| Perguntas, alternativas e pontuação de cada categoria | responsável da área correspondente à categoria |
| Vínculo de cada categoria com um tema | responsável da área, junto com o do tema |
| Faixas: limites (50% e 80%), rótulos e mensagens | todos os responsáveis, ou quem o grupo definir (pendente) |
| Textos do resultado (`introducao`, `semDestaque`, `aviso`) | idem |

Para aprovar: registrar a aprovação em `docs/revisoes.md` (mesmo processo dos temas), preencher `aprovacoes` com uma
entrada por categoria, trocar `status` para `aprovado` e, quando os temas obrigatórios também estiverem aprovados,
`estagio` para `final`. O schema recusa `aprovado` sem a aprovação de todas as categorias, e o portão confere o
resultado no site gerado. O build não verifica que a aprovação foi dada, apenas que ela está registrada.

## Privacidade das respostas

As respostas existem apenas na memória do componente enquanto a página está aberta. Camadas que sustentam isso:

1. **Arquitetura:** sem backend, endpoints ou banco; o estado é uma função pura usada por `useReducer`.
2. **Código:** `npm run check:quiz` proíbe, apenas no código do quiz, `localStorage`, `sessionStorage`, `indexedDB`,
   cookies, `cookieStore`, Cache Storage, service workers, `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`,
   `EventSource`, alteração de URL ou histórico e `<form>`.
3. **Navegador:** a página do quiz inclui uma política de segurança (`connect-src 'none'; form-action 'none'`) que
   bloqueia envio de dados por `fetch`, XHR, `sendBeacon`, WebSocket e formulários. Ela não é aplicada em
   `npm run dev`, para não bloquear o recarregamento automático.
4. **Testes de navegador** (`tests/e2e/quiz.spec.ts`): zero requisições e zero violações da política durante o
   preenchimento, nenhuma chamada às APIs de armazenamento instrumentadas (inclusive atribuição direta), armazenamento
   e cookies vazios no fim, URL e histórico inalterados e respostas apagadas ao recarregar.

Limites: os testes cobrem o Chromium e as vias listadas em `docs/desenvolvimento.md`; não provam ausência absoluta de
gravação. Extensões do navegador e o registro de IP feito pelo GitHub Pages estão fora do alcance do código.

## Interface e acessibilidade

Alternativas são botões de rádio nativos dentro de `fieldset`/`legend`, com áreas de toque de ao menos 44 px. O foco
vai para o título da etapa a cada mudança; o status ("Escolha uma alternativa para continuar.") é um `role="status"`.
O botão "Próxima" usa `aria-disabled` para continuar focável e explicar o bloqueio. A seleção aparece por marcador,
borda e negrito, não só por cor. O quiz não usa animações. Sem JavaScript, a página explica que o teste precisa dele.
