import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "./Icons.jsx";
import {
  LETTERS,
  SCENE,
  SHELF,
  STROKES,
  frameAt,
} from "../utils/welcomeAnimation.js";
import {
  LOGO_BOOK,
  LOGO_WORD_MAIN,
  LOGO_WORD_SUB,
} from "../utils/logoPaths.js";

/**
 * Animacao de boas-vindas: sobre uma estante desenhada a lapis, um passaro
 * pousa, se sacode, abre as asas e vira o livro da logo, de onde sobem as
 * letras de "LEITURA". Fica repetindo enquanto estiver na tela.
 *
 * O roteiro (o que desenhar em cada instante) esta em utils/welcomeAnimation.js;
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
export default function WelcomeScene({ time = null }) {
  const nodes = useRef({});
  const [playing, setPlaying] = useState(true);
  // Em que ponto do roteiro a animacao esta (segundos). Fica fora do efeito
  // para o "pausar" continuar de onde parou.
  const elapsedRef = useRef(0);

  const bind = (name) => (element) => {
    nodes.current[name] = element;
  };

  // O traco do passaro tem espessura fixa na tela (nao deforma quando ele se
  // amassa ou estica). Para ficar proporcional ao desenho em qualquer tamanho
  // (celular, celular deitado, computador), a escala atual do quadro vai para
  // o CSS em "--k" e as espessuras sao multiplicadas por ela.
  useEffect(() => {
    const svg = nodes.current.svg;
    if (!svg || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      const box = svg.getBoundingClientRect();
      const scale = Math.min(box.width / SCENE.width, box.height / SCENE.height);
      if (scale > 0) svg.style.setProperty("--k", scale.toFixed(3));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = nodes.current;
    // So escreve no SVG o que mudou desde o ultimo quadro: boa parte do tempo
    // (estante pronta, logo parada) quase nada muda.
    const written = {};
    function set(name, attribute, value) {
      const key = name + "|" + attribute;
      if (written[key] === value) return;
      written[key] = value;
      el[name].setAttribute(attribute, value);
    }

    function draw(seconds) {
      const frame = frameAt(seconds);
      set("all", "opacity", frame.opacity.all);
      set("rig", "transform", frame.rig);
      set("legs", "opacity", frame.opacity.legs);
      if (frame.opacity.legs > 0) {
        set("legs", "transform", frame.legsRig);
        set("legs", "d", frame.legs);
      }
      set("draft", "opacity", frame.opacity.draft);
      if (frame.opacity.draft > 0) {
        set("draft", "transform", frame.rig);
        set("draft", "d", frame.draft);
      }

      set("pencil", "opacity", frame.opacity.pencil);
      if (frame.bird) {
        STROKES.forEach((name) => {
          set(name, "d", frame.bird.strokes[name]);
          set(name + "Sketch", "d", frame.bird.sketch[name]);
        });
        if (written.pencilWidth !== frame.pencilWidth) {
          written.pencilWidth = frame.pencilWidth;
          el.pencil.style.setProperty("--pw", frame.pencilWidth);
        }
        set("head", "d", frame.bird.head);
        set("hatch", "opacity", frame.opacity.hatch);
        if (frame.opacity.hatch > 0) set("hatch", "d", frame.bird.hatch);
        set("beak", "d", frame.bird.beak);
        set("eye", "cx", frame.bird.eye.cx);
        set("eye", "cy", frame.bird.eye.cy);
        set("bits", "opacity", frame.opacity.bits);
      }

      set("book", "opacity", frame.opacity.logo);
      set("word", "opacity", frame.opacity.word);
      set("word", "transform", "translate(0 " + frame.wordLift + ")");
      set("sub", "opacity", frame.opacity.sub);
      set("sub", "transform", "translate(0 " + frame.subLift + ")");

      set("shelf", "opacity", frame.opacity.shelf);
      set("shelf", "transform", frame.shelfJitter);
      frame.shelf.forEach((drawn, index) => {
        // Traco ainda nao comecado fica escondido: com a ponta redonda, ele
        // apareceria como um pontinho.
        set("shelf" + index, "visibility", drawn > 0 ? "visible" : "hidden");
        set("shelf" + index, "stroke-dashoffset", 1 - drawn);
      });
      frame.letters.forEach((letter, index) => {
        set("letter" + index, "opacity", letter.opacity);
        if (letter.opacity > 0) {
          set(
            "letter" + index,
            "transform",
            "translate(" + letter.x + " " + letter.y + ") rotate(" + letter.rot +
              ") scale(" + letter.scale + ")",
          );
        }
      });
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
  }, [time, playing]);

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
        ref={bind("svg")}
        className="welcome-scene"
        viewBox={"0 0 " + SCENE.width + " " + SCENE.height}
        role="img"
        aria-label="Desenho a lápis: um pássaro pousa numa estante de livros, abre as asas e se transforma no livro da logo da Biblioteca ADMP Brasil."
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g ref={bind("all")}>
          <g ref={bind("shelf")} className="welcome-scene__shelf">
            {SHELF.map((d, index) => (
              <path
                key={d}
                ref={bind("shelf" + index)}
                d={d}
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            ))}
          </g>

          <g className="welcome-scene__letters" fill="currentColor" stroke="none">
            {LETTERS.map((char, index) => (
              <text
                key={index}
                ref={bind("letter" + index)}
                textAnchor="middle"
                opacity="0"
              >
                {char}
              </text>
            ))}
          </g>

          <g className="welcome-scene__thin">
            <path ref={bind("draft")} opacity="0" />
            <path ref={bind("legs")} opacity="0" />
          </g>

          <g ref={bind("rig")}>
            <g ref={bind("pencil")} className="welcome-scene__pencil">
              <g className="welcome-scene__faint">
                {STROKES.map((name) => (
                  <path key={name} ref={bind(name + "Sketch")} />
                ))}
                <path ref={bind("hatch")} />
              </g>
              {STROKES.map((name) => (
                <path key={name} ref={bind(name)} />
              ))}
              <g ref={bind("bits")}>
                <path ref={bind("head")} />
                <path ref={bind("beak")} className="welcome-scene__thin" />
                <circle
                  ref={bind("eye")}
                  r="12"
                  fill="currentColor"
                  stroke="none"
                />
              </g>
            </g>

            {/* A logo de verdade: o desenho a lapis termina em cima dela. */}
            <g fill="currentColor" stroke="none" fillRule="evenodd">
              <path ref={bind("book")} d={LOGO_BOOK} opacity="0" />
              <path ref={bind("word")} d={LOGO_WORD_MAIN} opacity="0" />
              <path ref={bind("sub")} d={LOGO_WORD_SUB} opacity="0" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
