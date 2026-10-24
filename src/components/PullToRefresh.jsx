import { useEffect, useRef, useState } from "react";
import { refreshAll } from "../utils/refresh.js";

/**
 * PUXAR PARA ATUALIZAR, em todas as telas (como nas paginas do Google no
 * celular): com a pagina no topo, arrastar o dedo de cima para baixo faz
 * descer uma bolinha (preta, com o arco marrom); soltando depois do ponto
 * certo, ela gira enquanto as telas buscam os dados de novo.
 *
 * NAO recarrega o site: cada tela atualiza so os proprios dados (ver
 * utils/refresh.js). A lista, a busca, os filtros e as janelas abertas ficam
 * como estavam - a janela aberta passa a mostrar a informacao de agora. Com
 * uma janela aberta, o gesto vale puxando dentro dela (com ela no topo).
 *
 * O "puxar" do proprio navegador fica desligado no app.css
 * (overscroll-behavior: none), entao e este que vale - tambem no app
 * instalado, onde o navegador nao oferece nenhum.
 *
 * Nao entra em acao quando:
 * - a pagina nao esta no topo, ou o dedo comecou numa area com rolagem
 *   propria que ja foi rolada (lista de sugestoes, corpo de janela...);
 * - o dedo comecou numa area com gesto proprio (recorte de foto, desenho:
 *   touch-action none, canvas, controle deslizante);
 * - o gesto e mais para o lado do que para baixo, ou tem dois dedos.
 * So existe no toque: no computador nada muda.
 */

// Quanto o dedo precisa descer (ja amortecido) para recarregar.
const THRESHOLD = 70;
const MAX_PULL = 110;
// O dedo desce o dobro do que a bolinha anda (resistencia, como no Google).
const DAMPING = 0.5;

function pageScrollTop() {
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  );
}

// Toque dentro de uma janela aberta? (Ai a rolagem da pagina por tras nao
// conta - so a da janela.)
function insideModal(target) {
  return Boolean(target?.closest?.(".modal-backdrop"));
}

// O toque comecou num lugar onde puxar para baixo nao deve atualizar?
function blockedAt(target) {
  if (target?.closest?.("canvas, input[type=range], [data-no-pull]")) return true;
  for (let node = target; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
    if (node.nodeType === 1 && getComputedStyle(node).touchAction === "none") return true;
  }
  return false;
}

// Quanto tempo a bolinha espera as telas, no maximo (rede ruim).
const MAX_WAIT_MS = 15000;
// E no minimo, para dar para ver que pegou.
const MIN_SPIN_MS = 600;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let startY = null;
    let startX = 0;
    let pulling = false;
    let distance = 0;
    let inModal = false;

    function reset() {
      startY = null;
      pulling = false;
      distance = 0;
    }

    function onTouchStart(event) {
      if (refreshingRef.current || event.touches.length !== 1) return reset();
      inModal = insideModal(event.target);
      // Com uma janela aberta, o toque fora dela (no fundo escuro) nao conta.
      if (!inModal && document.querySelector(".modal-backdrop")) return reset();
      if ((!inModal && pageScrollTop() > 0) || blockedAt(event.target)) return reset();
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      pulling = false;
      distance = 0;
      return undefined;
    }

    function onTouchMove(event) {
      if (startY === null) return;
      if (event.touches.length !== 1) {
        reset();
        setPull(0);
        return;
      }
      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;
      if (!pulling) {
        // Decide a direcao nos primeiros pixels: para baixo e mais vertical
        // do que horizontal. Qualquer outra coisa e rolagem normal.
        if (dy > 8 && dy > Math.abs(dx) && (inModal || pageScrollTop() === 0)) {
          pulling = true;
        } else if (dy < -4 || Math.abs(dx) > 12) {
          reset();
          return;
        } else {
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      distance = Math.max(0, Math.min(MAX_PULL, (dy - 8) * DAMPING));
      setPull(distance);
    }

    function onTouchEnd() {
      if (pulling && distance >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        const started = Date.now();
        Promise.race([
          refreshAll(),
          new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
        ])
          .catch(() => {})
          .then(
            () =>
              new Promise((resolve) =>
                setTimeout(resolve, Math.max(0, MIN_SPIN_MS - (Date.now() - started))),
              ),
          )
          .then(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPull(0);
          });
      } else {
        setPull(0);
      }
      reset();
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  if (!pull && !refreshing) return null;

  const progress = Math.min(1, pull / THRESHOLD);
  // Arco que vai se fechando conforme puxa (ate 3/4 da volta).
  const circumference = 2 * Math.PI * 9;
  const arc = circumference * 0.75 * progress;

  return (
    <div
      className={"ptr" + (refreshing ? " ptr--refreshing" : "")}
      style={{
        transform: "translate(-50%, " + (pull - 48) + "px)",
        opacity: refreshing ? 1 : 0.35 + 0.65 * progress,
      }}
      role={refreshing ? "status" : undefined}
      aria-live="polite"
    >
      <svg
        className="ptr__spin"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        style={refreshing ? undefined : { transform: "rotate(" + progress * 270 + "deg)" }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray={
            refreshing
              ? circumference * 0.7 + " " + circumference
              : arc + " " + circumference
          }
        />
      </svg>
      <span className="sr-only">
        {refreshing ? "Atualizando…" : progress >= 1 ? "Solte para atualizar" : ""}
      </span>
    </div>
  );
}
