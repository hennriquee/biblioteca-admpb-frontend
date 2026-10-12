import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "./Icons.jsx";
import {
  BRANCH_PARTS,
  BRANCH_PIVOT_POINT,
  CLOSING,
  GOLD_LEAF,
  LEFT_CENTER,
  LOGO,
  PAGE,
  PAGE_LEFT_PATH,
  PAGE_RIGHT_PATH,
  RIGHT_CENTER,
  SPINE_PATH,
  SCENE,
  SPREADS,
  frameAt,
} from "../utils/welcomeAnimation.js";
import {
  LOGO_BOOK,
  LOGO_WORD_MAIN,
  LOGO_WORD_SUB,
} from "../utils/logoPaths.js";

/**
 * Animacao de boas-vindas ("da pagina ao galho"): a logo sobe, o livro dela
 * se abre em paginas brancas, letras surgem e as paginas sao folheadas cada
 * vez mais rapido; as ultimas linhas de texto viram um passaro de traco
 * unico, que voa para longe e pousa de costas num galho, de onde uma folha
 * cai devagar. Fica repetindo enquanto estiver na tela.
 *
 * O roteiro (o que desenhar em cada instante, e o texto das paginas) esta em
 * utils/welcomeAnimation.js; aqui so se aplica cada quadro no SVG, direto nos
 * elementos (sem re-renderizar o React 60 vezes por segundo).
 *
 * - time: mostra um quadro fixo (segundos) em vez de animar. So e usado para
 *   conferir quadros isolados (testes); na tela a animacao sempre roda.
 *
 * A animacao roda inclusive para quem desligou as animacoes do sistema
 * (decisao do projeto: ela e a apresentacao da biblioteca). Por isso o botao
 * no canto permite pausar e continuar.
 */

const LOGO_TRANSFORM =
  "translate(" + LOGO.x + " " + LOGO.y + ") scale(" + LOGO.scale + ") translate(" +
  -LOGO.originX + " " + -LOGO.originY + ")";
const PIVOT = BRANCH_PIVOT_POINT[0] + " " + BRANCH_PIVOT_POINT[1];
const MIDDLE_Y = (PAGE.top + PAGE.bottom) / 2;
const LEAVES = [0, 1, 2]; // ate tres folhas no ar ao mesmo tempo
const TITLE = SPREADS[0].right.title;
const TITLE_LETTERS = TITLE.join("").length;

// O conteudo de uma pagina. "bind" guarda os elementos que a animacao mexe
// (as letras do titulo, a folhinha e as linhas que viram o passaro).
function PageContent({ content, side, bind }) {
  const center = side === "left" ? LEFT_CENTER : RIGHT_CENTER;
  const margin = (side === "left" ? PAGE.left : PAGE.middle) + 15;
  let letter = 0;
  return (
    <>
      {content.sprig ? (
        <path
          ref={bind("sprig")}
          className="welcome-scene__sprig"
          d={"M" + (center - 8) + " " + (MIDDLE_Y + 3) + "q7 -9 16 -6q-7 9 -16 6m3 -1.6l9 -3"}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="1"
        />
      ) : null}
      {content.title
        ? content.title.map((line, row) => (
            <text key={line} className="welcome-scene__title" x={center} y={MIDDLE_Y - 6 + row * 29} textAnchor="middle">
              {[...line].map((char, index) => {
                const name = "title-" + letter;
                letter += 1;
                return (
                  <tspan key={index} ref={bind(name)} fillOpacity="0">
                    {char === " " ? " " : char}
                  </tspan>
                );
              })}
            </text>
          ))
        : null}
      {content.word ? (
        <text className="welcome-scene__word" x={center} y={MIDDLE_Y + 9} textAnchor="middle">
          {content.word}
        </text>
      ) : null}
      {content.glyph ? (
        <text className="welcome-scene__glyph" x={center} y={MIDDLE_Y + 32} textAnchor="middle">
          {content.glyph}
        </text>
      ) : null}
      {content.cap ? (
        <>
          <text className="welcome-scene__cap" x={margin - 2} y={PAGE.top + 74}>
            {content.cap}
          </text>
          {content.beside.map((line, row) => (
            <text key={line} className="welcome-scene__small" x={margin + 33} y={PAGE.top + 49 + row * 10.5}>
              {line}
            </text>
          ))}
          {content.text.map((line, row) => (
            <text key={line} className="welcome-scene__small" x={margin} y={PAGE.top + 95 + row * 10.5}>
              {line}
            </text>
          ))}
        </>
      ) : null}
      {!content.cap && content.text
        ? content.text.map((line, row) => (
            <text
              key={line}
              className="welcome-scene__small"
              x={margin}
              y={MIDDLE_Y - ((content.text.length - 1) * 10.5) / 2 + 2 + row * 10.5}
            >
              {line}
            </text>
          ))
        : null}
      {content.lines
        ? content.lines.map((line, row) => (
            <text
              key={line}
              ref={bind("closing" + (side === "left" ? row : row + 3))}
              className="welcome-scene__closing"
              x={center}
              y={CLOSING.baselines[row]}
              fontSize={CLOSING.size}
              textAnchor="middle"
            >
              {line}
            </text>
          ))
        : null}
    </>
  );
}

export default function WelcomeScene({ time = null }) {
  const nodes = useRef({});
  const [playing, setPlaying] = useState(true);
  // Em que ponto do roteiro a animacao esta (segundos). Fica fora do efeito
  // para o "pausar" continuar de onde parou.
  const elapsedRef = useRef(0);
  // Larguras medidas das linhas que viram o passaro (dependem da fonte).
  const widths = useRef(null);
  const redraw = useRef(null);
  const id = useId();

  const bind = (name) => (element) => {
    nodes.current[name] = element;
  };

  // Mede as seis linhas da ultima abertura: cada traco do passaro nasce com o
  // comprimento exato da sua linha de texto. Repete quando a fonte carrega.
  useEffect(() => {
    let alive = true;
    function measure() {
      const el = nodes.current;
      if (!alive || !el.closing0) return;
      const measured = [0, 1, 2, 3, 4, 5].map((index) => el["closing" + index].getComputedTextLength());
      if (measured.every((value) => value > 0)) widths.current = measured;
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
    // (logo parada, passaro pousado) quase nada muda.
    const written = {};
    function set(name, attribute, value) {
      const key = name + "|" + attribute;
      if (written[key] === value) return;
      written[key] = value;
      el[name].setAttribute(attribute, value);
    }
    // ("display", e nao "visibility": um filho marcado como visivel apareceria
    // mesmo dentro de um grupo escondido.)
    const show = (name, visible) => set(name, "display", visible ? "inline" : "none");
    // Traco desenhado aos poucos (0 a 1). Ainda nao comecado, fica escondido:
    // com a ponta redonda, ele apareceria como um pontinho.
    function trace(name, drawn) {
      show(name, drawn > 0);
      set(name, "stroke-dashoffset", 1 - drawn);
    }

    function draw(seconds) {
      const frame = frameAt(seconds, widths.current);
      const { logo, book, nature } = frame;

      set("logo", "transform", "translate(0 " + logo.lift + ")");
      set("logoBook", "opacity", logo.book);
      set("logoName", "opacity", logo.name);

      show("book", book.visible);
      if (book.visible) {
        set("book", "transform", "translate(0 " + book.drop + ")");
        set("book", "opacity", book.opacity);
        set("ink", "d", book.ink);
        set("outline", "d", book.outline);
        set("outline", "stroke-width", book.outlineWidth);
        set("spine", "opacity", book.spine);
        set("paper", "opacity", book.paper);
        set("leftPage", "href", "#" + id + "L" + book.left);
        set("rightPage", "href", "#" + id + "R" + book.right);
        for (let i = 0; i < TITLE_LETTERS; i += 1) {
          set("title-" + i, "fill-opacity", Math.min(1, Math.max(0, (book.written * (TITLE_LETTERS + 5) - i) / 5)).toFixed(2));
        }
        trace("sprig", book.sprig);
        for (let i = 0; i < 6; i += 1) set("closing" + i, "opacity", book.closing);
        LEAVES.forEach((slot) => {
          const leaf = book.leaves[slot];
          show("leaf" + slot, Boolean(leaf));
          if (!leaf) return;
          set(
            "leaf" + slot,
            "transform",
            "translate(" + PAGE.middle + " " + MIDDLE_Y + ") skewY(" + leaf.skew + ") scale(" + leaf.width + " " +
              leaf.height + ") translate(" + -PAGE.middle + " " + -MIDDLE_Y + ")",
          );
          set("leafPaper" + slot, "fill", leaf.fill);
          set("leafFront" + slot, "href", "#" + id + "R" + leaf.front);
          set("leafBack" + slot, "href", "#" + id + "L" + leaf.back);
          set("leafFront" + slot, "opacity", leaf.frontOpacity);
          set("leafBack" + slot, "opacity", leaf.backOpacity);
        });
      }

      set("bird", "d", frame.bird);
      set("bird", "stroke-width", frame.birdWidth);
      set("bird", "opacity", frame.birdOpacity);
      set("perch", "d", frame.perch);
      set("perch", "opacity", frame.perchOpacity);

      show("nature", nature.visible);
      set("sky", "transform", "translate(0 " + nature.lift + ")");
      if (nature.visible) {
        set("branch", "transform", "rotate(" + nature.swing + " " + PIVOT + ")");
        nature.parts.forEach((drawn, index) => trace("branch" + index, drawn));
        const gold = nature.gold;
        trace("gold", gold.drawn);
        set("gold", "opacity", gold.opacity);
        // Presa, a folha balanca com o galho; solta, cai girando e virando
        // sobre si mesma (em torno do proprio meio).
        const cx = GOLD_LEAF.base[0];
        const cy = GOLD_LEAF.base[1] + 7;
        set(
          "gold",
          "transform",
          gold.x === 0 && gold.y === 0
            ? "rotate(" + nature.swing + " " + PIVOT + ")"
            : "translate(" + (cx + gold.x) + " " + (cy + gold.y) + ") rotate(" + gold.turn + ") scale(" +
                gold.flip + " 1) translate(" + -cx + " " + -cy + ")",
        );
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
  }, [time, playing, id]);

  const toggleLabel = playing ? "Pausar animação" : "Continuar animação";

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
        className="welcome-scene"
        viewBox={"0 0 " + SCENE.width + " " + SCENE.height}
        role="img"
        aria-label="A logo da Biblioteca ADMP Brasil se abre num livro; as páginas são folheadas cada vez mais rápido, com as palavras “uma vida de leitura”, “edificar”, “alcançar” e “louvar”; as últimas linhas viram um pássaro em traço único, que voa para longe e pousa num galho, de onde cai uma folha."
        fill="none"
      >
        <defs>
          {/* Cada pagina do livro, desenhada uma vez e mostrada onde for
              preciso (na pagina parada e na folha que esta virando). */}
          {SPREADS.map((spread, index) => (
            <g key={index}>
              <g id={id + "L" + index}>
                <PageContent content={spread.left} side="left" bind={bind} />
              </g>
              <g id={id + "R" + index}>
                <PageContent content={spread.right} side="right" bind={bind} />
              </g>
            </g>
          ))}
        </defs>

        {/* A logo de verdade: sobe, para, e entao o livro dela se abre. */}
        <g ref={bind("logo")} fill="currentColor" fillRule="evenodd">
          <path ref={bind("logoBook")} d={LOGO_BOOK} transform={LOGO_TRANSFORM} opacity="0" />
          <g ref={bind("logoName")} transform={LOGO_TRANSFORM} opacity="0">
            <path d={LOGO_WORD_MAIN} />
            <path d={LOGO_WORD_SUB} />
          </g>
        </g>

        <g ref={bind("book")} className="welcome-scene__book" display="none">
          <path ref={bind("ink")} fill="currentColor" />
          <g ref={bind("paper")} opacity="0">
            {/* O miolo: duas linhas claras deslocadas, por fora e por baixo. */}
            <path className="welcome-scene__block" d={PAGE_LEFT_PATH} transform="translate(-4 4)" />
            <path className="welcome-scene__block" d={PAGE_RIGHT_PATH} transform="translate(4 4)" />
            <path className="welcome-scene__block" d={PAGE_LEFT_PATH} transform="translate(-2 2)" />
            <path className="welcome-scene__block" d={PAGE_RIGHT_PATH} transform="translate(2 2)" />
            <path className="welcome-scene__page" d={PAGE_LEFT_PATH} />
            <path className="welcome-scene__page" d={PAGE_RIGHT_PATH} />
            <use ref={bind("leftPage")} href={"#" + id + "L0"} />
            <use ref={bind("rightPage")} href={"#" + id + "R0"} />
            {LEAVES.map((slot) => (
              <g key={slot} ref={bind("leaf" + slot)} display="none">
                <path ref={bind("leafPaper" + slot)} className="welcome-scene__leaf" d={PAGE_RIGHT_PATH} />
                <use ref={bind("leafFront" + slot)} href={"#" + id + "R0"} />
                {/* O verso e uma pagina esquerda: desenhado espelhado, para a
                    folha (ja virada) mostra-lo do lado certo. */}
                <g transform={"translate(" + PAGE.middle * 2 + " 0) scale(-1 1)"}>
                  <use ref={bind("leafBack" + slot)} href={"#" + id + "L0"} />
                </g>
              </g>
            ))}
          </g>
          <path ref={bind("outline")} className="welcome-scene__stroke" />
          <path ref={bind("spine")} className="welcome-scene__stroke" d={SPINE_PATH} strokeWidth="1.5" opacity="0" />
        </g>

        {/* O "la fora": o galho, a folha e o passaro. Sobem juntos quando a
            logo do ciclo seguinte empurra a cena. */}
        <g ref={bind("sky")} className="welcome-scene__stroke">
          <g ref={bind("nature")} display="none">
          <g ref={bind("branch")} strokeWidth="1.7">
            {BRANCH_PARTS.map((part, index) => (
              <path
                key={index}
                ref={bind("branch" + index)}
                d={part.d}
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            ))}
          </g>
          <path
            ref={bind("gold")}
            className="welcome-scene__gold"
            d={GOLD_LEAF.d}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="1"
          />
          </g>
          <path ref={bind("bird")} />
          <path ref={bind("perch")} strokeWidth="1.7" />
        </g>
      </svg>
    </div>
  );
}
