import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "./Icons.jsx";
import {
  BACKDROP,
  LOGO,
  PHRASE,
  SCENE,
  frameAt,
} from "../utils/welcomeLineAnimation.js";
import {
  LOGO_BOOK,
  LOGO_WORD_MAIN,
  LOGO_WORD_SUB,
} from "../utils/logoPaths.js";

/**
 * Animacao de boas-vindas SECUNDARIA ("uma linha so"), guardada para nao se
 * perder: para voltar a usa-la, troque o componente em WelcomeModal.jsx.
 *
 * O que ela faz: uma linha desenha um passaro de
 * traco unico, ele voa enquanto a frase "Ler para edificar / alcancar /
 * louvar" troca a cada batida de asa e palavras de livro passam ao fundo; na
 * ultima batida os tracos viram o livro da logo e o nome da biblioteca entra.
 * Fica repetindo enquanto estiver na tela.
 *
 * O roteiro (o que desenhar em cada instante) esta em utils/welcomeLineAnimation.js;
 * aqui so se aplica cada quadro no SVG, direto nos elementos (sem re-renderizar
 * o React 60 vezes por segundo).
 *
 * - time: mostra um quadro fixo (segundos) em vez de animar. So e usado para
 *   conferir quadros isolados (testes); na tela a animacao sempre roda.
 *
 * A animacao roda inclusive para quem desligou as animacoes do sistema
 * (decisao do projeto: ela e a apresentacao da biblioteca). Por isso o botao
 * no canto permite pausar e continuar.
 */

// Quantas vezes o texto de cada linha de fundo e repetido (para sempre haver
// texto cobrindo o palco enquanto a linha desliza).
const REPEAT = 4;
const LOGO_TRANSFORM =
  "translate(" + LOGO.x + " " + LOGO.y + ") scale(" + LOGO.scale + ") translate(" +
  -LOGO.originX + " " + -LOGO.originY + ")";
const WORD_GAP = 6; // espaco entre "Ler para" e o verbo
const NBSP = " ";

export default function WelcomeSceneLine({ time = null }) {
  const nodes = useRef({});
  const [playing, setPlaying] = useState(true);
  // Em que ponto do roteiro a animacao esta (segundos). Fica fora do efeito
  // para o "pausar" continuar de onde parou.
  const elapsedRef = useRef(0);
  // Larguras medidas do texto (dependem da fonte ja carregada).
  const layout = useRef({ blocks: BACKDROP.map((row) => row.text.length * row.size * 0.5) });
  const redraw = useRef(null);
  const id = useId();

  const bind = (name) => (element) => {
    nodes.current[name] = element;
  };

  // Mede o texto e posiciona a frase: "Ler para" nunca se mexe, e a frase
  // mais comprida fica centralizada. Repete quando a fonte termina de carregar.
  useEffect(() => {
    let alive = true;
    function measure() {
      const el = nodes.current;
      if (!alive || !el.prefix) return;
      const prefix = el.prefix.getComputedTextLength();
      const verbs = PHRASE.verbs.map((_, index) => el["verb" + index].getComputedTextLength());
      const left = (SCENE.width - (prefix + WORD_GAP + Math.max(...verbs))) / 2;
      const verbX = left + prefix + WORD_GAP;
      el.prefix.setAttribute("x", left.toFixed(1));
      PHRASE.verbs.forEach((_, index) => {
        el["verb" + index].setAttribute("x", verbX.toFixed(1));
        const y = PHRASE.baseline + 5.5;
        const w = verbs[index];
        // Sublinhado feito a mao: uma linha quase reta, de leve torta.
        el["underline" + index].setAttribute(
          "d",
          "M" + (verbX + 1).toFixed(1) + " " + (y + 0.5) + "C" + (verbX + w * 0.3).toFixed(1) + " " +
            (y - 1.1) + " " + (verbX + w * 0.65).toFixed(1) + " " + (y + 1) + " " +
            (verbX + w - 1).toFixed(1) + " " + (y - 0.3),
        );
      });
      layout.current = {
        blocks: BACKDROP.map((_, index) => el["row" + index].getComputedTextLength() / REPEAT),
      };
      if (redraw.current) redraw.current();
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = nodes.current;
    // So escreve no SVG o que mudou desde o ultimo quadro: boa parte do tempo
    // (logo parada) nada muda.
    const written = {};
    function set(name, attribute, value) {
      const key = name + "|" + attribute;
      if (written[key] === value) return;
      written[key] = value;
      el[name].setAttribute(attribute, value);
    }
    function letters(name, list) {
      list.forEach((letter, index) => {
        set(name + "-" + index, "dx", letter.dx);
        set(name + "-" + index, "fill-opacity", letter.opacity);
      });
    }

    function draw(seconds) {
      const frame = frameAt(seconds);

      set("line", "d", frame.line);
      set("line", "stroke-width", frame.lineWidth);
      set("lead", "d", frame.lead);
      set("ink", "d", frame.ink);
      set("nib", "opacity", frame.nib.opacity);
      if (frame.nib.opacity > 0) {
        set("nib", "cx", frame.nib.x);
        set("nib", "cy", frame.nib.y);
      }

      set("book", "opacity", frame.logo);
      set("word", "opacity", frame.word.opacity);
      set("word", "transform", "translate(0 " + frame.word.lift + ")");
      set("sub", "opacity", frame.sub.opacity);
      set(
        "sub",
        "transform",
        "translate(" + SCENE.width / 2 + " 0) scale(" + frame.sub.stretch + " 1) translate(" +
          -SCENE.width / 2 + " 0)",
      );

      set("prefix", "opacity", frame.phrase.prefix.opacity);
      if (frame.phrase.prefix.opacity > 0) letters("prefix", frame.phrase.prefix.letters);
      frame.phrase.verbs.forEach((verb, index) => {
        set("verb" + index, "opacity", verb.opacity);
        set("underline" + index, "opacity", verb.underlineOpacity);
        if (!verb.letters) return;
        set("verb" + index, "transform", "translate(" + verb.shift + " 0)");
        set("underline" + index, "transform", "translate(" + verb.shift + " 0)");
        set("underline" + index, "stroke-dashoffset", 1 - verb.underline);
        letters("verb" + index, verb.letters);
      });

      set("backdrop", "opacity", frame.backdrop.opacity);
      if (frame.backdrop.opacity > 0) {
        frame.backdrop.travel.forEach((travel, index) => {
          const block = layout.current.blocks[index] || 1;
          set("row" + index, "x", ((travel % block) - block).toFixed(1));
        });
      }
    }

    if (time !== null) {
      redraw.current = () => {
        Object.keys(written).forEach((key) => delete written[key]);
        draw(time);
      };
      draw(time);
      return undefined;
    }
    redraw.current = () => draw(elapsedRef.current);
    draw(elapsedRef.current);
    if (!playing) return undefined;

    // Relogio proprio: soma so o tempo em que a aba esta de fato desenhando,
    // para a animacao continuar de onde parou (e nao dar um salto) ao voltar.
    let previous = null;
    let request = 0;
    function tick(now) {
      if (previous !== null) {
        elapsedRef.current += Math.min(0.1, (now - previous) / 1000);
      }
      previous = now;
      draw(elapsedRef.current);
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [time, playing]);

  const toggleLabel = playing ? "Pausar animação" : "Continuar animação";
  const fadeId = id + "fade";
  const clearId = id + "clear";
  const maskId = id + "mask";
  const clipId = id + "clip";

  return (
    <div className="welcome-scene-wrap">
      {time === null ? (
        <button
          type="button"
          className="welcome-scene__toggle"
          onClick={() => setPlaying((current) => !current)}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {playing ? (
            <IconPause width={16} height={16} />
          ) : (
            <IconPlay width={16} height={16} />
          )}
        </button>
      ) : null}

      <svg
        ref={bind("svg")}
        className="welcome-scene"
        viewBox={"0 0 " + SCENE.width + " " + SCENE.height}
        role="img"
        aria-label="Uma linha desenha um pássaro em traço único; ele voa entre palavras de livros enquanto passa a frase “Ler para edificar, alcançar, louvar”, e então se transforma no livro da logo da Biblioteca ADMP Brasil."
        fill="none"
      >
        <defs>
          {/* As linhas de fundo somem nas laterais e abrem uma clareira em
              volta do passaro: nenhuma letra cruza o traco. */}
          <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0.02" stopColor="#000" />
            <stop offset="0.11" stopColor="#fff" />
            <stop offset="0.89" stopColor="#fff" />
            <stop offset="0.98" stopColor="#000" />
          </linearGradient>
          <radialGradient id={clearId}>
            <stop offset="0.76" stopColor="#000" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={SCENE.width} height={SCENE.height}>
            <rect width={SCENE.width} height={SCENE.height} fill={"url(#" + fadeId + ")"} />
            <ellipse cx="200" cy="90" rx="126" ry="88" fill={"url(#" + clearId + ")"} />
          </mask>
          {/* "ADMP BRASIL" sobe por tras da sua linha de base. */}
          <clipPath id={clipId}>
            <rect x="0" y="140" width={SCENE.width} height="37.2" />
          </clipPath>
        </defs>

        <g ref={bind("backdrop")} className="welcome-scene__backdrop" mask={"url(#" + maskId + ")"}>
          {BACKDROP.map((row, index) => (
            <text
              key={row.y}
              ref={bind("row" + index)}
              y={row.y}
              fontSize={row.size}
              fillOpacity={row.opacity}
              xmlSpace="preserve"
            >
              {row.text.replace(/ /g, NBSP).repeat(REPEAT)}
            </text>
          ))}
        </g>

        <g className="welcome-scene__phrase" fontSize={PHRASE.size}>
          <text ref={bind("prefix")} className="welcome-scene__prefix" y={PHRASE.baseline} opacity="0">
            {[...PHRASE.prefix].map((char, index) => (
              <tspan key={index} ref={bind("prefix-" + index)}>
                {char === " " ? NBSP : char}
              </tspan>
            ))}
          </text>
          {PHRASE.verbs.map((verb, verbIndex) => (
            <text
              key={verb}
              ref={bind("verb" + verbIndex)}
              className="welcome-scene__verb"
              y={PHRASE.baseline}
              opacity="0"
            >
              {[...verb].map((char, index) => (
                <tspan key={index} ref={bind("verb" + verbIndex + "-" + index)}>
                  {char}
                </tspan>
              ))}
            </text>
          ))}
          {PHRASE.verbs.map((verb, verbIndex) => (
            <path
              key={verb}
              ref={bind("underline" + verbIndex)}
              className="welcome-scene__underline"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset="1"
              opacity="0"
            />
          ))}
        </g>

        <g className="welcome-scene__ink">
          <path ref={bind("lead")} className="welcome-scene__line" />
          <path ref={bind("line")} className="welcome-scene__line" />
          <path ref={bind("ink")} fill="currentColor" />
          <circle ref={bind("nib")} className="welcome-scene__nib" r="2" opacity="0" />
        </g>

        {/* A logo de verdade: as pinceladas terminam exatamente em cima dela. */}
        <g fill="currentColor" fillRule="evenodd">
          <g transform={LOGO_TRANSFORM}>
            <path ref={bind("book")} d={LOGO_BOOK} opacity="0" />
          </g>
          <g clipPath={"url(#" + clipId + ")"}>
            <g ref={bind("word")} opacity="0">
              <path d={LOGO_WORD_MAIN} transform={LOGO_TRANSFORM} />
            </g>
          </g>
          <g ref={bind("sub")} opacity="0">
            <path d={LOGO_WORD_SUB} transform={LOGO_TRANSFORM} />
          </g>
        </g>
      </svg>
    </div>
  );
}
