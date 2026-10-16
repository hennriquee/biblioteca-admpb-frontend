/**
 * Foto redonda de uma pessoa. Sem foto, mostra as iniciais do nome - nunca um
 * quadrado vazio. Se o endereco da foto falhar (link quebrado), cai nas
 * iniciais tambem.
 *
 * Props:
 *  - src: endereco da foto (opcional)
 *  - name: nome completo, de onde saem as iniciais
 *  - size: diametro em px (padrao 44)
 */
import { useEffect, useState } from "react";

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

export default function Avatar({ src, name, size = 44, className = "" }) {
  const [failed, setFailed] = useState(false);

  // Foto trocada: tenta carregar a nova mesmo que a anterior tenha falhado.
  useEffect(() => setFailed(false), [src]);

  const style = { width: size, height: size };
  const classes = "avatar" + (className ? " " + className : "");

  if (src && !failed) {
    return (
      <img
        className={classes}
        style={style}
        src={src}
        alt={name ? "Foto de " + name : ""}
        loading="lazy"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onError={() => setFailed(true)}
      />
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
