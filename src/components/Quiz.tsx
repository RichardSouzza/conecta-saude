import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { estadoInicial, podeAvancar, proximoEstado, type Acao, type Estado } from '../lib/quiz/estado';
import type { LinkTema } from '../lib/quiz/links';
import { calcularResultado, type ResultadoCategoria } from '../lib/quiz/pontuacao';
import type { Quiz as DadosDoQuiz } from '../lib/quiz/schema';

interface Props {
  quiz: Pick<DadosDoQuiz, 'categorias' | 'perguntas' | 'faixas' | 'resultado'>;
  links: Record<string, LinkTema>;
  listagem: { href: string } | null;
}

function ItemResultado({ item, link, avisarSemLink }: { item: ResultadoCategoria; link?: LinkTema; avisarSemLink: boolean }) {
  return (
    <li class="quiz-item" data-faixa={item.faixa.id}>
      <h4 class="quiz-item-titulo">{item.rotulo}</h4>
      <p class="quiz-faixa">{item.faixa.rotulo}</p>
      <p>{item.faixa.mensagem}</p>
      {link ? (
        <p>
          <a href={link.href}>Ler sobre o tema: {link.titulo}</a>
        </p>
      ) : (
        avisarSemLink && <p class="quiz-sem-link">O conteúdo desta área ainda está em preparação.</p>
      )}
    </li>
  );
}

export default function Quiz({ quiz, links, listagem }: Props) {
  const [estado, despachar] = useReducer((atual: Estado, acao: Acao) => proximoEstado(quiz, atual, acao), estadoInicial);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const montado = useRef(false);

  useEffect(() => {
    if (montado.current) titulo.current?.focus();
    montado.current = true;
  }, [estado.fase, estado.indice]);

  const resultado = useMemo(
    () => (estado.fase === 'resultado' ? calcularResultado(quiz, estado.respostas) : null),
    [estado.fase, estado.respostas],
  );

  const total = quiz.perguntas.length;

  if (resultado) {
    return (
      <section class="quiz-painel" aria-labelledby="quiz-etapa">
        <h2 id="quiz-etapa" class="quiz-etapa" ref={titulo} tabIndex={-1}>
          Seu resultado
        </h2>
        <p>{quiz.resultado.introducao}</p>
        {resultado.destaque.length > 0 ? (
          <>
            <h3>Temas que merecem mais atenção</h3>
            <ul class="quiz-lista">
              {resultado.destaque.map((item) => (
                <ItemResultado key={item.categoria} item={item} link={links[item.tema]} avisarSemLink />
              ))}
            </ul>
          </>
        ) : (
          <p>{quiz.resultado.semDestaque}</p>
        )}
        {resultado.demais.length > 0 && (
          <>
            <h3>Demais temas</h3>
            <ul class="quiz-lista">
              {resultado.demais.map((item) => (
                <ItemResultado key={item.categoria} item={item} link={links[item.tema]} avisarSemLink={false} />
              ))}
            </ul>
          </>
        )}
        <p class="quiz-aviso">{quiz.resultado.aviso}</p>
        {listagem && (
          <p>
            <a href={listagem.href}>Ver todos os temas do site</a>
          </p>
        )}
        <div class="quiz-acoes">
          <button
            type="button"
            class="botao"
            onClick={() => {
              setTentouAvancar(false);
              despachar({ tipo: 'reiniciar' });
            }}
          >
            Refazer o teste
          </button>
        </div>
      </section>
    );
  }

  const pergunta = quiz.perguntas[estado.indice];
  const resposta = estado.respostas[pergunta.id];
  const liberado = podeAvancar(quiz, estado);
  const ultima = estado.indice === total - 1;
  const status = liberado
    ? 'Alternativa selecionada. Você pode continuar.'
    : tentouAvancar
      ? 'Escolha uma alternativa antes de continuar.'
      : 'Escolha uma alternativa para continuar.';

  const avancar = () => {
    if (!liberado) {
      setTentouAvancar(true);
      return;
    }
    setTentouAvancar(false);
    despachar({ tipo: 'avancar' });
  };

  return (
    <section class="quiz-painel" aria-labelledby="quiz-etapa">
      <h2 id="quiz-etapa" class="quiz-etapa" ref={titulo} tabIndex={-1}>
        Pergunta {estado.indice + 1} de {total}
      </h2>
      <progress class="quiz-progresso" max={total} value={estado.indice + 1} aria-label="Progresso do teste" />
      <fieldset class="quiz-pergunta" key={pergunta.id}>
        <legend>{pergunta.texto}</legend>
        {pergunta.opcoes.map((opcao) => {
          const selecionada = resposta === opcao.id;
          return (
            <label key={opcao.id} class={`quiz-opcao${selecionada ? ' quiz-opcao-selecionada' : ''}`}>
              <input
                type="radio"
                name={`pergunta-${pergunta.id}`}
                value={opcao.id}
                checked={selecionada}
                onChange={() => {
                  setTentouAvancar(false);
                  despachar({ tipo: 'selecionar', perguntaId: pergunta.id, opcaoId: opcao.id });
                }}
              />
              <span>{opcao.rotulo}</span>
            </label>
          );
        })}
      </fieldset>
      <p class="quiz-status" role="status">
        {status}
      </p>
      <div class="quiz-acoes">
        <button
          type="button"
          class="botao botao-secundario"
          disabled={estado.indice === 0}
          onClick={() => {
            setTentouAvancar(false);
            despachar({ tipo: 'voltar' });
          }}
        >
          Voltar
        </button>
        <button type="button" class="botao" aria-disabled={liberado ? 'false' : 'true'} onClick={avancar}>
          {ultima ? 'Ver resultado' : 'Próxima'}
        </button>
      </div>
    </section>
  );
}
