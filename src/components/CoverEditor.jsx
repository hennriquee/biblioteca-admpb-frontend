import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Modal from "./Modal.jsx";

// Formato padrao das capas: retrato 2:3 (largura:altura), o mesmo das capas
// de livro de verdade. A foto final sai sempre com 600x900 px, em JPEG - fica
// leve (~100-200 KB) e todas as capas ficam do mesmo tamanho.
const COVER_RATIO = 2 / 3;
const OUT_W = 600;
const OUT_H = 900;
const MAX_ZOOM = 4;
const FRAME_MAX_W = 280;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Muda o zoom mantendo o ponto que esta no centro do quadro no mesmo lugar.
function withZoom(view, nextZoom) {
  const zoom = clamp(nextZoom, 1, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return { zoom, x: view.x * ratio, y: view.y * ratio };
}

/**
 * Tela de "Ajustar capa": a pessoa arrasta a foto e da zoom para enquadrar
 * dentro do quadro 2:3. Ao confirmar, devolve a imagem recortada como data URI.
 *
 * Props:
 *  - file: File/Blob da foto (camera, galeria ou webcam)
 *  - onCancel(): fechar sem usar a foto
 *  - onConfirm(dataUri): foto recortada em JPEG 600x900
 *  - onLoadError(): o navegador nao conseguiu abrir a imagem
 */
export default function CoverEditor({
  open,
  file,
  onCancel,
  onConfirm,
  onLoadError,
}) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const [url, setUrl] = useState("");
  const [natural, setNatural] = useState(null); // { w, h } da foto original
  const [box, setBox] = useState({ w: 0, h: 0 }); // tamanho do quadro na tela
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });

  // Endereco temporario da foto, liberado ao fechar.
  useEffect(() => {
    if (!open || !file) {
      setUrl("");
      setNatural(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setNatural(null);
    setView({ zoom: 1, x: 0, y: 0 });
    return () => URL.revokeObjectURL(objectUrl);
  }, [open, file]);

  // O quadro e sempre 2:3 e cabe na tela (inclusive celular deitado).
  useLayoutEffect(() => {
    if (!open) return undefined;
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    function measure() {
      const maxHeight = Math.max(220, window.innerHeight * 0.5);
      const w = Math.floor(
        Math.min(wrap.clientWidth, FRAME_MAX_W, maxHeight * COVER_RATIO),
      );
      setBox({ w, h: Math.round(w / COVER_RATIO) });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  // Escala minima: a foto sempre cobre o quadro inteiro (sem bordas vazias).
  const minScale =
    natural && box.w ? Math.max(box.w / natural.w, box.h / natural.h) : 1;
  const scale = minScale * view.zoom;

  // Aplica uma mudanca de enquadramento respeitando os limites.
  const applyView = useCallback(
    (updater) => {
      if (!natural || !box.w) return;
      setView((previous) => {
        const next = typeof updater === "function" ? updater(previous) : updater;
        const zoom = clamp(next.zoom, 1, MAX_ZOOM);
        const s = minScale * zoom;
        const maxX = Math.max(0, (natural.w * s - box.w) / 2);
        const maxY = Math.max(0, (natural.h * s - box.h) / 2);
        return {
          zoom,
          x: clamp(next.x, -maxX, maxX),
          y: clamp(next.y, -maxY, maxY),
        };
      });
    },
    [natural, box, minScale],
  );

  // Se o quadro mudar de tamanho, reencaixa a foto nos novos limites.
  useEffect(() => {
    applyView((v) => v);
  }, [applyView]);

  // Roda do mouse = zoom. Precisa ser um listener nativo "nao passivo" para
  // poder impedir que a rolagem da pagina aconteca ao mesmo tempo.
  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame) return undefined;
    function onWheel(event) {
      event.preventDefault();
      applyView((v) => withZoom(v, v.zoom * Math.exp(-event.deltaY * 0.0015)));
    }
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [open, applyView]);

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: view.zoom,
      };
    }
  }

  function onPointerMove(event) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      applyView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const target = pinch.current.zoom * (distance / pinch.current.distance);
      applyView((v) => withZoom(v, target));
    }
  }

  function onPointerEnd(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // Teclado: setas movem a foto, + e - dao zoom.
  function onKeyDown(event) {
    const step = 12;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      applyView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyView((v) => withZoom(v, v.zoom + 0.15));
    } else if (event.key === "-") {
      event.preventDefault();
      applyView((v) => withZoom(v, v.zoom - 0.15));
    }
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !natural || !box.w) return;

    // Parte da foto original que esta dentro do quadro.
    const sw = box.w / scale;
    const sh = box.h / scale;
    const sx = clamp(natural.w / 2 - view.x / scale - sw / 2, 0, natural.w - sw);
    const sy = clamp(natural.h / 2 - view.y / scale - sh / 2, 0, natural.h - sh);

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    // Fundo branco: PNG com transparencia nao vira preto no JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

    onConfirm(canvas.toDataURL("image/jpeg", 0.88));
  }

  const ready = Boolean(natural && box.w);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Ajustar capa"
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={!ready}
          >
            Usar esta foto
          </button>
        </>
      }
    >
      <div className="cropper" ref={wrapRef}>
        <div
          ref={frameRef}
          className="cropper__frame"
          style={{ width: box.w, height: box.h }}
          tabIndex={0}
          role="group"
          aria-label="Área da capa. Arraste para posicionar a foto; use mais e menos para ampliar."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
        >
          {url ? (
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              className="cropper__img"
              style={
                ready
                  ? {
                      width: natural.w * scale,
                      height: natural.h * scale,
                      transform:
                        "translate(-50%, -50%) translate(" +
                        view.x +
                        "px, " +
                        view.y +
                        "px)",
                    }
                  : { visibility: "hidden" }
              }
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onError={() => onLoadError && onLoadError()}
            />
          ) : null}
          <div className="cropper__grid" aria-hidden="true" />
        </div>

        <label className="cropper__zoom">
          <span aria-hidden="true">–</span>
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={view.zoom}
            disabled={!ready}
            aria-label="Zoom"
            onChange={(e) =>
              applyView((v) => withZoom(v, Number(e.target.value)))
            }
          />
          <span aria-hidden="true">+</span>
        </label>

        <p className="cropper__hint muted">
          Arraste a foto para enquadrar a capa.
        </p>
      </div>
    </Modal>
  );
}
