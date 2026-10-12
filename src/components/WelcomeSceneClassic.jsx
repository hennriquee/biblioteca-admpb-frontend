import { useId, useLayoutEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "./Icons.jsx";
import {
  BRANCH_PARTS,
  BRANCH_PIVOT_POINT,
  CLOSING_LINES,
  FIRST_PAGE,
  GOLD_LEAF,
  LOGO,
  PAGE,
  PAGE_LEFT_PATH,
  PAGE_RIGHT_PATH,
  SCENE,
  SPINE_PATH,
  SPREADS,
  TEXT,
  frameAt,
} from "../utils/welcomeClassicAnimation.js";
import {
  LOGO_BOOK,
  LOGO_WORD_MAIN,
  LOGO_WORD_SUB,
} from "../utils/logoPaths.js";

/**
 * BACKUP (12/10/2026): a versao da animacao "da pagina ao galho" como estava
 * antes de o passaro ser redesenhado em estilo de esboco. Guardada para nao
 * se perder: para voltar a usa-la, troque o componente em WelcomeModal.jsx
 * por este (WelcomeSceneClassic). O roteiro dela esta em
 * utils/welcomeClassicAnimation.js e as formas em utils/welcomeShapes.js.
 *
 * Animacao de boas-vindas ("da pagina ao galho"): a logo sobe, o livro dela
 * se abre e vem ate a tela; de perto, o texto surge na pagina e as folhas sao
 * viradas cada vez mais rapido; as linhas do texto viram um passaro de traco
 * unico, que voa para longe e pousa num galho, gira ate dar as costas, e uma
 * folha cai devagar. Fica repetindo enquanto estiver na tela.
 *
 * O roteiro (o que desenhar em cada instante, e o texto das paginas) esta em
 * utils/welcomeClassicAnimation.js; aqui so se aplica cada quadro no SVG, direto nos
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
const LAST = SPREADS.length - 1;

// O conteudo de uma pagina. "bind" guarda os elementos que a animacao mexe:
// na primeira pagina ("first"), a capitular, as linhas e os grifos, que
// surgem um a um; na ultima ("last"), as linhas que viram o passaro.
function PageContent({ content, side, bind, first, last }) {
  const edge = side === "left" ? PAGE.left : PAGE.middle;
  if (content.sprig) {
    const center = edge + (PAGE.right - PAGE.middle) / 2;
    return (
      <path
        ref={bind("sprig")}
        className="welcome-scene__sprig"
        d={"M" + (center - 8) + " " + (MIDDLE_Y + 3) + "q7 -9 16 -6q-7 9 -16 6m3 -1.6l9 -3"}
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset="1"
      />
    );
  }
  if (!content.page) return null;

  const { head, cap, lines, color, marks } = content.page;
  const left = edge + TEXT.margin;
  const top = PAGE.top + TEXT.first;
  // As tres primeiras linhas dao lugar a capitular.
  const startOf = (row) => left + (row < 3 ? TEXT.indent : 0);
  return (
    <>
      <text ref={first ? bind("head") : undefined} className="welcome-scene__head" x={left} y={PAGE.top + TEXT.head}>
        {head}
      </text>
      <path
        ref={first ? bind("rule") : undefined}
        className="welcome-scene__rule"
        d={"M" + left + " " + (PAGE.top + TEXT.head + 4.5) + "h" + TEXT.width}
      />
      {/* Os grifos ficam por baixo do texto, como marca-texto no papel. */}
      {marks.map(([row, from, to], index) => {
        const y = top + row * TEXT.leading - 2.2;
        // Cada faixa sai um pouco torta, como grifo feito a mao.
        const tilt = index % 2 ? 0.35 : -0.3;
        return (
          <path
            key={index}
            ref={first ? bind("mark" + index) : undefined}
            className="welcome-scene__mark"
            stroke={color}
            d={"M" + (startOf(row) + from).toFixed(1) + " " + (y - tilt).toFixed(2) +
              "L" + (startOf(row) + to).toFixed(1) + " " + (y + tilt).toFixed(2)}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={first ? 1 : 0}
          />
        );
      })}
      <text ref={first ? bind("cap") : undefined} className="welcome-scene__cap" x={left - 1.5} y={top + 2 * TEXT.leading + 0.6}>
        {cap}
      </text>
      {lines.map(([line, gap], row) => (
        <text
          key={row}
          ref={first ? bind("line" + row) : last && row < CLOSING_LINES ? bind("closing" + row) : undefined}
          className="welcome-scene__body"
          x={startOf(row)}
          y={top + row * TEXT.leading}
          // Justificado so pelo espaco entre as palavras, como em livro.
          style={gap ? { wordSpacing: gap + "px" } : undefined}
        >
          {line}
        </text>
      ))}
    </>
  );
}

export default function WelcomeSceneClassic({ time = null }) {
  const nodes = useRef({});
  const [playing, setPlaying] = useState(true);
  // Em que ponto do roteiro a animacao esta (segundos). Fica fora do efeito
  // para o "pausar" continuar de onde parou.
  const elapsedRef = useRef(0);
  const id = useId();

  const bind = (name) => (element) => {
    nodes.current[name] = element;
  };

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
      const frame = frameAt(seconds);
      const { logo, book, nature } = frame;

      set("logo", "transform", "translate(0 " + logo.lift + ")");
      set("logoBook", "opacity", logo.book);
      set("logoName", "opacity", logo.name);

      show("book", book.visible);
      if (book.visible) {
        const { camera } = book;
        // A camera: aproxima o livro ate a pagina cobrir o palco.
        set(
          "book",
          "transform",
          "translate(" + SCENE.width / 2 + " " + SCENE.height / 2 + ") rotate(" + camera.turn + ") scale(" +
            camera.zoom + ") translate(" + -camera.x + " " + -camera.y + ")",
        );
        set("book", "opacity", book.opacity);
        set("ink", "d", book.ink);
        set("outline", "d", book.outline);
        // (Os tracos nao engrossam com a aproximacao.)
        set("outline", "stroke-width", (book.outlineWidth / camera.zoom).toFixed(3));
        set("spine", "stroke-width", (1.5 / camera.zoom).toFixed(3));
        set("spine", "opacity", book.spine);
        set("paper", "opacity", book.paper);
        set("leftPage", "href", "#" + id + "L" + book.left);
        set("rightPage", "href", "#" + id + "R" + book.right);
        trace("sprig", book.sprig);

        // Primeira pagina: o titulo, a capitular e as linhas surgem em
        // sequencia; por ultimo, o marca-texto passa sobre os trechos.
        const w = book.written;
        const fade = (from, to) => Math.min(1, Math.max(0, (w - from) / (to - from))).toFixed(2);
        set("head", "opacity", fade(0, 0.13));
        set("rule", "opacity", fade(0, 0.13));
        set("cap", "opacity", fade(0.04, 0.2));
        for (let i = 0; i < FIRST_PAGE.lines; i += 1) {
          set("line" + i, "opacity", fade(0.18 + i * 0.04, 0.32 + i * 0.04));
        }
        for (let i = 0; i < FIRST_PAGE.marks; i += 1) {
          set("mark" + i, "stroke-dashoffset", (1 - fade(0.66 + i * 0.07, 0.84 + i * 0.07)).toFixed(2));
        }
        for (let i = 0; i < CLOSING_LINES; i += 1) set("closing" + i, "opacity", book.closing);

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
          set("leafPaper" + slot, "stroke-width", (1 / camera.zoom).toFixed(3));
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
      draw(time);
      return undefined;
    }
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
        aria-label="A logo da Biblioteca ADMP Brasil se abre num livro, que vem até a tela; as páginas, com trechos grifados sobre uma vida de leitura, são folheadas cada vez mais rápido; as linhas do texto viram um pássaro em traço único, que voa para longe e pousa num galho, de onde cai uma folha."
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
                <PageContent
                  content={spread.right}
                  side="right"
                  bind={bind}
                  first={index === 0}
                  last={index === LAST}
                />
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
