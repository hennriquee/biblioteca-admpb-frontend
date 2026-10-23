import { useEffect, useRef, useState } from "react";
import { IconBookPlus, IconPause, IconPlay } from "./Icons.jsx";

/**
 * A animacao do "obrigado pela sugestao": desenho a nanquim em 3D (ver
 * story/index.js e story/script.js). Na esquina, o menino espera; o caminhao
 * desengoncado chega, o entregador entrega a sacola de livros, o menino
 * confere e leva para casa; de perto, os livros chegam na pilha e o quinto -
 * o livro sugerido, com o titulo na capa - se abre, e a historia recomeca
 * dentro dele.
 *
 * O three.js e as cenas sao pesados: so baixam quando o modal abre (ou antes,
 * com preloadSuggestScene, enquanto a pessoa preenche a sugestao). Sem WebGL,
 * fica um desenho parado no lugar.
 *
 * Como a animacao de boas-vindas, roda mesmo com "menos movimento" ligado no
 * sistema (decisao do projeto), com o botao de pausar no canto.
 *
 * - title: o livro sugerido (vai na capa do quinto livro)
 * - time: desenha um instante fixo (segundos) em vez de animar - so para
 *   conferir quadros isolados (testes).
 */

let loading = null;
export function preloadSuggestScene() {
  if (!loading) {
    loading = import("../story/index.js").catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

const LABEL =
  "Desenho a nanquim: numa esquina, um menino espera; um caminhão desengonçado chega chacoalhando e para perto do poste; o entregador entrega uma sacola de livros, que o menino confere, abraça e leva para casa. De perto, os livros chegam um a um na pilha; o quinto, o livro sugerido, se abre, e a história recomeça dentro dele.";

export default function SuggestScene({ title = "", time = null }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  playingRef.current = playing;
  // Em que ponto da historia esta (segundos): o pausar continua de onde parou.
  const elapsedRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let story = null;
    let frame = 0;
    let observer = null;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    function onLost(event) {
      event.preventDefault();
      cancelAnimationFrame(frame);
      if (alive) setStatus("failed");
    }
    canvas.addEventListener("webglcontextlost", onLost);

    preloadSuggestScene()
      .then(({ createSuggestStory }) => {
        if (!alive) return;
        try {
          story = createSuggestStory(canvas, { title });
        } catch {
          setStatus("failed");
          return;
        }
        // A primeira volta comeca com o desenho "se fazendo".
        const draw = () => {
          const seconds = time ?? elapsedRef.current;
          story.draw(seconds, time === null && seconds < story.duration);
        };
        const fit = () => {
          const rect = wrap.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return;
          story.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
          draw();
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(wrap);
        setStatus("ready");
        if (time !== null) return;

        // Relogio proprio: soma so o tempo em que a aba esta desenhando.
        let previous = null;
        const tick = (now) => {
          if (playingRef.current) {
            if (previous !== null) elapsedRef.current += Math.min(0.1, (now - previous) / 1000);
            previous = now;
            draw();
          } else {
            previous = null;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (alive) setStatus("failed");
      });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      story?.dispose();
    };
  }, [title, time]);

  const toggleLabel = playing ? "Pausar animação" : "Continuar animação";

  return (
    <div className="suggest-scene" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="suggest-scene__canvas"
        role="img"
        aria-label={LABEL}
        hidden={status === "failed"}
      />
      {status === "loading" ? (
        <p className="suggest-scene__wait">
          <span>
            Desenhando
            <span className="loadingdots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </p>
      ) : null}
      {status === "failed" ? (
        <div className="suggest-scene__fallback" aria-hidden="true">
          <IconBookPlus width={64} height={64} />
        </div>
      ) : null}
      {status === "ready" && time === null ? (
        <button
          type="button"
          className="welcome-scene__toggle"
          onClick={() => setPlaying((current) => !current)}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {playing ? <IconPause width={16} height={16} /> : <IconPlay width={16} height={16} />}
        </button>
      ) : null}
    </div>
  );
}
