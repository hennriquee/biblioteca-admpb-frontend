import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Modal from "./Modal.jsx";
import { IconRotateLeft, IconRotateRight } from "./Icons.jsx";
import {
  MAX_ANGLE,
  coverScale,
  fitOffset,
  rad,
  rotatePoint,
} from "../utils/cropGeometry.js";

// Formato padrao: capa de livro em retrato 2:3 (largura:altura), o mesmo das
// capas de verdade, salva em 600x900 px. A foto de perfil usa o mesmo recorte
// com ratio = 1 e 400x400 (ver PhotoPicker).
const MAX_ZOOM = 4;
const FRAME_MAX_W = 280;
// Passo da barra de giro, em graus.
const ANGLE_STEP = 0.5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Muda o zoom mantendo o ponto que esta no centro do quadro no mesmo lugar.
function withZoom(view, nextZoom) {
  const zoom = clamp(nextZoom, 1, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return { ...view, zoom, x: view.x * ratio, y: view.y * ratio };
}

const NO_VIEW = { zoom: 1, x: 0, y: 0, angle: 0 };

// "+12,5°" / "−7°" / "0°": o sinal diz para que lado a foto esta girada.
function angleLabel(angle) {
  if (!angle) return "0°";
  const digits = Math.abs(angle).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
  return (angle > 0 ? "+" : "−") + digits + "°";
}

function angleSide(angle) {
  if (!angle) return "sem giro";
  return angle > 0 ? "para a direita" : "para a esquerda";
}

// O que o leitor de tela fala na barra: "12,5 graus para a direita".
function angleSpoken(angle) {
  if (!angle) return angleSide(0);
  const digits = Math.abs(angle).toLocaleString("pt-BR");
  return digits + (Math.abs(angle) <= 1 ? " grau " : " graus ") + angleSide(angle);
}

/**
 * Tela de "Ajustar capa" / "Ajustar foto": a pessoa arrasta a foto, da zoom e
 * gira para enquadrar dentro do quadro. Ao confirmar, devolve a imagem
 * recortada como data URI.
 *
 * O giro vai de -45° (esquerda) a +45° (direita) e a barra comeca no meio
 * (0°). A foto gira em torno do centro do quadro (ver utils/cropGeometry.js).
 *
 * Props:
 *  - file: File/Blob da foto (camera, galeria ou webcam)
 *  - onCancel(): fechar sem usar a foto
 *  - onConfirm(dataUri): foto recortada em JPEG 600x900
 *  - onLoadError(): o navegador nao conseguiu abrir a imagem
 *  - loading: a imagem ainda esta sendo buscada (ao editar a que ja esta
 *    salva); o quadro avisa e `file` chega depois
 *  - keepAlpha: a foto tem partes transparentes (perfil sem fundo) e elas
 *    ficam transparentes: o arquivo sai em PNG, sem o fundo branco
 */
export default function CoverEditor({
  open,
  file,
  onCancel,
  onConfirm,
  onLoadError,
  loading = false,
  keepAlpha = false,
  // Formato do recorte: largura/altura. 2/3 = capa; 1 = foto de perfil.
  ratio = 2 / 3,
  // Tamanho final do arquivo, em px.
  out = { w: 600, h: 900 },
  // Mostra o quadro redondo (a foto de perfil aparece redonda no app).
  round = false,
  title = "Ajustar capa",
  hint = "Arraste a foto para enquadrar a capa.",
}) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const angleRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const [url, setUrl] = useState("");
  const [natural, setNatural] = useState(null); // { w, h } da foto original
  const [box, setBox] = useState({ w: 0, h: 0 }); // tamanho do quadro na tela
  const [view, setView] = useState(NO_VIEW);

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
    setView(NO_VIEW);
    return () => URL.revokeObjectURL(objectUrl);
  }, [open, file]);

  // O quadro e sempre 2:3 e cabe na tela (inclusive celular deitado).
  useLayoutEffect(() => {
    if (!open) return undefined;
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    function measure() {
      // Sob o quadro ficam duas barras (zoom e giro) e a dica: em tela baixa o
      // quadro cede mais altura para elas continuarem a vista.
      const share = window.innerHeight < 640 ? 0.4 : 0.46;
      const maxHeight = Math.max(200, window.innerHeight * share);
      const w = Math.floor(
        Math.min(wrap.clientWidth, FRAME_MAX_W, maxHeight * ratio),
      );
      setBox({ w, h: Math.round(w / ratio) });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, ratio]);

  // Escala minima: a foto, do jeito que esta girada, sempre cobre o quadro
  // inteiro (sem bordas vazias).
  const scale = coverScale(natural, box, view.angle) * view.zoom;

  // Aplica uma mudanca de enquadramento respeitando os limites.
  const applyView = useCallback(
    (updater) => {
      if (!natural || !box.w) return;
      setView((previous) => {
        const next = typeof updater === "function" ? updater(previous) : updater;
        const zoom = clamp(next.zoom, 1, MAX_ZOOM);
        const angle = clamp(next.angle, -MAX_ANGLE, MAX_ANGLE);
        const s = coverScale(natural, box, angle) * zoom;
        return {
          zoom,
          angle,
          ...fitOffset(natural, box, s, angle, next.x, next.y),
        };
      });
    },
    [natural, box],
  );

  // Gira a foto em torno do centro do quadro: o que estava no centro continua
  // no centro, mesmo com a foto arrastada para o lado.
  function setAngle(nextAngle) {
    applyView((v) => {
      const angle = clamp(nextAngle, -MAX_ANGLE, MAX_ANGLE);
      const grow = coverScale(natural, box, angle) / coverScale(natural, box, v.angle);
      const moved = rotatePoint(v.x, v.y, angle - v.angle);
      return { ...v, angle, x: moved.x * grow, y: moved.y * grow };
    });
  }

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

    const canvas = document.createElement("canvas");
    canvas.width = out.w;
    canvas.height = out.h;
    const ctx = canvas.getContext("2d");
    if (!keepAlpha) {
      // Fundo branco: PNG com transparencia nao vira preto no JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.w, out.h);
    }
    ctx.imageSmoothingQuality = "high";
    // Refaz no canvas o que a tela mostra: o quadro (box) vira o arquivo
    // inteiro (out); dentro dele a foto vai para o lugar, gira e escala.
    ctx.translate(out.w / 2, out.h / 2);
    ctx.scale(out.w / box.w, out.h / box.h);
    ctx.translate(view.x, view.y);
    ctx.rotate(rad(view.angle));
    ctx.scale(scale, scale);
    ctx.drawImage(img, -natural.w / 2, -natural.h / 2);

    onConfirm(
      keepAlpha
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.88),
    );
  }

  const ready = Boolean(natural && box.w);
  // Preenchimento da trilha fina do zoom, em %, so para o Chrome/Edge/Safari
  // (o Firefox preenche sozinho com ::-moz-range-progress).
  const zoomFill = ((view.zoom - 1) / (MAX_ZOOM - 1)) * 100;
  // A trilha do giro e preenchida a partir do meio (0°) ate a bolinha, para
  // a direita ou para a esquerda.
  const anglePos = ((view.angle + MAX_ANGLE) / (2 * MAX_ANGLE)) * 100;
  const sideText = angleSide(view.angle);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
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
          className={
            "cropper__frame" +
            (round ? " cropper__frame--round" : "") +
            (keepAlpha ? " cropper__frame--alpha" : "")
          }
          style={{ width: box.w, height: box.h }}
          tabIndex={0}
          role="group"
          aria-label={
            title +
            ". Arraste para posicionar a foto; use mais e menos para ampliar."
          }
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
                        "px) rotate(" +
                        view.angle +
                        "deg)",
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
          {loading && !url ? (
            <p className="cropper__loading" role="status">
              Abrindo a imagem
              <span className="loadingdots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
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
            style={{ "--zoom-fill": zoomFill + "%" }}
            onChange={(e) =>
              applyView((v) => withZoom(v, Number(e.target.value)))
            }
          />
          <span aria-hidden="true">+</span>
        </label>

        <div className="cropper__angle">
          <div className="cropper__angle-head">
            {/* Quem usa leitor de tela ouve o mesmo pelo aria-valuetext da barra. */}
            <div className="cropper__angle-value" aria-hidden="true">
              <strong>{angleLabel(view.angle)}</strong>
              <span className="muted">{sideText}</span>
            </div>
            <button
              type="button"
              className="cropper__angle-reset"
              aria-label="Zerar o giro da foto"
              onClick={() => {
                setAngle(0);
                // O botao some em 0°: o foco vai para a barra em vez de se perder.
                angleRef.current?.focus();
              }}
              disabled={!ready || !view.angle}
            >
              Zerar
            </button>
          </div>
          <label className="cropper__zoom cropper__zoom--angle">
            <IconRotateLeft width={16} height={16} aria-hidden="true" />
            <span className="cropper__rangewrap">
              <input
                ref={angleRef}
                type="range"
                min={-MAX_ANGLE}
                max={MAX_ANGLE}
                step={ANGLE_STEP}
                value={view.angle}
                disabled={!ready}
                aria-label="Giro da foto, de menos 45 a mais 45 graus"
                aria-valuetext={angleSpoken(view.angle)}
                style={{
                  "--angle-from": Math.min(anglePos, 50) + "%",
                  "--angle-to": Math.max(anglePos, 50) + "%",
                }}
                onChange={(e) => setAngle(Number(e.target.value))}
              />
            </span>
            <IconRotateRight width={16} height={16} aria-hidden="true" />
          </label>
        </div>

        <p className="cropper__hint muted">{hint}</p>
      </div>
    </Modal>
  );
}
