import { useEffect, useRef, useState } from "react";
import { IconBookPlus, IconPause, IconPlay } from "./Icons.jsx";

/**
 * A animacao do "obrigado pela sugestao": desenho a nanquim em 3D (ver
 * story/index.js e story/script.js). Numa pagina em branco, livros sao
 * jogados no chao, cada vez mais, e se amontoam numa montanha de livros que
 * afina ate um so la em cima; a camera se afasta devagar e a pagina vira,
 * comecando tudo de novo. E sempre a mesma animacao (nao depende do livro
 * sugerido).
 *
 * O three.js e as cenas sao pesados: so baixam quando o modal abre (ou antes,
 * com preloadSuggestScene, enquanto a pessoa preenche a sugestao). Sem WebGL,
 * fica um desenho parado no lugar.
 *
 * Como a animacao de boas-vindas, roda mesmo com "menos movimento" ligado no
 * sistema (decisao do projeto), com o botao de pausar no canto.
 *
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
  "Desenho a nanquim: numa página em branco, livros são jogados no chão, cada vez mais, e vão se amontoando numa montanha de livros que afina até sobrar um só lá em cima. A câmera se afasta devagar, a página vira e os livros começam a cair de novo.";

export default function SuggestScene({ time = null }) {
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
          story = createSuggestStory(canvas);
        } catch {
          setStatus("failed");
          return;
        }
        let ready = false;
        const draw = () => story.draw(time ?? elapsedRef.current);
        const fit = () => {
          const rect = wrap.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return;
          story.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
          if (ready) draw();
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(wrap);
        // Desenhar antes de a placa de video montar os programas travaria a
        // tela: espera (os pontinhos continuam na tela enquanto isso).
        return story.ready.then(() => {
          if (!alive) return;
          ready = true;
          draw();
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
        });
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
  }, [time]);

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
          <span className="sr-only">Carregando a animação</span>
          <span className="loadingdots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
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
