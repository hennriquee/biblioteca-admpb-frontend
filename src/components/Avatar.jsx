/**
 * Foto redonda de uma pessoa. Sem foto, mostra as iniciais do nome - nunca um
 * quadrado vazio. Se o endereco da foto falhar (link quebrado), cai nas
 * iniciais tambem.
 *
 * Props:
 *  - src: endereco da foto (opcional)
 *  - name: nome completo, de onde saem as iniciais
 *  - size: diametro em px (padrao 44)
 *  - zoomable: clicar na foto abre ela maior (ImageLightbox), sem opcao de
 *    baixar - so faz sentido onde a foto e so para OLHAR (ex.: StaffModal).
 *    Onde o clique ja faz outra coisa (abrir a edicao, escolher na lista),
 *    nao usa: o clique continua fazendo so aquilo.
 */
import { useEffect, useState } from "react";
import ImageLightbox from "./ImageLightbox.jsx";

function initialsOf(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = 44,
  className = "",
  zoomable = false,
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  // Foto trocada: tenta carregar a nova mesmo que a anterior tenha falhado.
  useEffect(() => setFailed(false), [src]);

  const style = { width: size, height: size };
  const classes = "avatar" + (className ? " " + className : "");
  const alt = name ? "Foto de " + name : "";

  if (src && !failed) {
    const img = (
      <img
        className={classes}
        style={style}
        src={src}
        alt={zoomable ? "" : alt}
        loading="lazy"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onError={() => setFailed(true)}
      />
    );

    if (!zoomable) return img;

    return (
      <>
        <button
          type="button"
          className="imagebtn"
          style={style}
          onClick={() => setOpen(true)}
          aria-label={"Ver" + (name ? " a foto de " + name : " a foto") + " maior"}
        >
          {img}
        </button>
        <ImageLightbox open={open} onClose={() => setOpen(false)} src={src} alt={alt} />
      </>
    );
  }

  return (
    <span
      className={classes + " avatar--empty"}
      style={{ ...style, fontSize: Math.round(size * 0.38) + "px" }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
