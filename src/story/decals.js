import * as THREE from "three";
import { rng } from "./cast.js";

/**
 * Letreiros, placas e paginas desenhados num canvas (tinta preta em fundo
 * transparente): o nanquim usa a transparencia como "quanto de tinta" (ver
 * USE_DECAL em sketch.js). As letras saem um pouco tortas, como pintadas a
 * mao.
 */

const FONT = 'Fraunces, Georgia, "Times New Roman", serif';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Texto "pintado a mao": cada letra com um tremido proprio. */
function handText(ctx, text, x, y, size, { weight = 600, seed = 1, spacing = 0.06, align = "center", jitter = 1 } = {}) {
  const rand = rng(seed);
  ctx.font = weight + " " + size + "px " + FONT;
  const widths = [...text].map((ch) => ctx.measureText(ch).width + size * spacing);
  const total = widths.reduce((a, b) => a + b, 0) - size * spacing;
  let cursor = align === "center" ? x - total / 2 : x;
  ctx.textBaseline = "alphabetic";
  [...text].forEach((ch, i) => {
    ctx.save();
    ctx.translate(cursor + widths[i] / 2, y + (rand() - 0.5) * size * 0.06 * jitter);
    ctx.rotate((rand() - 0.5) * 0.08 * jitter);
    ctx.textAlign = "center";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cursor += widths[i];
  });
}

/** Linha tremida de pena (para molduras e riscos). */
function wobblyLine(ctx, x0, y0, x1, y1, seed, amp = 1.5) {
  const rand = rng(seed);
  const steps = 8;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= steps; i += 1) {
    const u = i / steps;
    ctx.lineTo(x0 + (x1 - x0) * u + (rand() - 0.5) * amp, y0 + (y1 - y0) * u + (rand() - 0.5) * amp);
  }
  ctx.stroke();
}

function frame(ctx, w, h, pad, seed, width = 6) {
  ctx.lineWidth = width;
  wobblyLine(ctx, pad, pad, w - pad, pad, seed, 3);
  wobblyLine(ctx, w - pad, pad, w - pad, h - pad, seed + 1, 3);
  wobblyLine(ctx, w - pad, h - pad, pad, h - pad, seed + 2, 3);
  wobblyLine(ctx, pad, h - pad, pad, pad, seed + 3, 3);
}

/** Um livrinho aberto desenhado (icone do caminhao). */
function bookIcon(ctx, cx, cy, size) {
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.32);
  ctx.quadraticCurveTo(cx - size * 0.3, cy + size * 0.12, cx - size * 0.62, cy + size * 0.28);
  ctx.lineTo(cx - size * 0.62, cy - size * 0.3);
  ctx.quadraticCurveTo(cx - size * 0.3, cy - size * 0.46, cx, cy - size * 0.26);
  ctx.quadraticCurveTo(cx + size * 0.3, cy - size * 0.46, cx + size * 0.62, cy - size * 0.3);
  ctx.lineTo(cx + size * 0.62, cy + size * 0.28);
  ctx.quadraticCurveTo(cx + size * 0.3, cy + size * 0.12, cx, cy + size * 0.32);
  ctx.closePath();
  ctx.stroke();
  wobblyLine(ctx, cx, cy - size * 0.26, cx, cy + size * 0.32, 5, 1);
  ctx.lineWidth = size * 0.035;
  for (let i = 0; i < 4; i += 1) {
    const y = cy - size * 0.14 + i * size * 0.1;
    wobblyLine(ctx, cx - size * 0.5, y, cx - size * 0.1, y + size * 0.02, 10 + i, 1.5);
    wobblyLine(ctx, cx + size * 0.1, y + size * 0.02, cx + size * 0.5, y, 20 + i, 1.5);
  }
}

/** Placa com letreiro: moldura e o nome no meio. */
function sign(text, { width = 512, height = 128, seed = 1, size = 78, border = true } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    if (border) frame(ctx, w, h, 10, seed, 7);
    handText(ctx, text, w / 2, h / 2 + size * 0.36, size, { seed });
  });
}

/** Tijolos aparecendo onde o reboco caiu (mancha de borda irregular). */
function bricks(seed) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rand = rng(seed);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.6;
    const cx = w / 2;
    const cy = h / 2;
    for (let row = 0; row < 12; row += 1) {
      const y = row * 21 + 6;
      const offset = row % 2 ? 0 : 22;
      for (let col = -1; col < 6; col += 1) {
        const x = col * 44 + offset + 6;
        const d = Math.hypot((x + 20 - cx) / 1.2, y + 8 - cy);
        if (d > 95 + rand() * 30) continue;
        ctx.strokeRect(x + (rand() - 0.5) * 2, y + (rand() - 0.5) * 2, 38, 16);
        if (rand() < 0.3) {
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 12);
          ctx.lineTo(x + 30, y + 4);
          ctx.stroke();
        }
      }
    }
  });
}

/** Letreiro do caminhao: o nome grande, uma faixa e o livro. */
function truckSign() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    frame(ctx, w, h, 26, 3, 9);
    handText(ctx, "LIVROS", w * 0.43, h * 0.56, 210, { seed: 4, spacing: 0.1 });
    ctx.lineWidth = 7;
    wobblyLine(ctx, w * 0.12, h * 0.68, w * 0.74, h * 0.66, 6, 3);
    handText(ctx, "entregas com carinho", w * 0.43, h * 0.84, 70, { weight: 400, seed: 8, spacing: 0.02 });
    bookIcon(ctx, w * 0.84, h * 0.47, 150);
  });
}

/** Placa de rua (o nome do bairro da igreja). */
function streetSign() {
  return canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    frame(ctx, w, h, 12, 9, 8);
    handText(ctx, "R. BRASIL", w / 2, h / 2 + 30, 86, { seed: 12 });
  });
}

/** Linhas de texto de uma pagina (sem precisar ser legivel). */
function textLines(ctx, x, y, width, lines, seed, height = 14, gap = 30) {
  const rand = rng(seed);
  for (let i = 0; i < lines; i += 1) {
    let cursor = x;
    const end = i === lines - 1 ? x + width * (0.3 + rand() * 0.4) : x + width;
    while (cursor < end - 10) {
      const word = Math.min(end - cursor, 18 + rand() * 60);
      ctx.fillRect(cursor, y + i * gap + (rand() - 0.5) * 2, word, height * (0.55 + rand() * 0.2));
      cursor += word + 10 + rand() * 6;
    }
  }
}

export function makeDecals(sk) {
  const make = (texture) => sk.decalMaterial(texture);
  return {
    truck: make(truckSign()),
    padaria: make(sign("PADARIA", { seed: 21 })),
    farmacia: make(sign("FARMÁCIA", { seed: 22, size: 70 })),
    banca: make(sign("BANCA", { width: 384, seed: 23 })),
    sapataria: make(sign("SAPATARIA", { seed: 24, size: 64 })),
    street: make(streetSign()),
    bricks: make(bricks(31)),
    bricks2: make(bricks(37)),
    numbers: make(sign("27", { width: 128, height: 128, size: 80, seed: 41 })),
  };
}

/**
 * A capa do quinto livro (o livro sugerido), com o titulo da sugestao, e as
 * paginas do livro aberto. Ficam fora de makeDecals porque dependem do
 * titulo.
 */
export function coverTexture(title) {
  return canvasTexture(512, 720, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    frame(ctx, w, h, 34, 51, 8);
    frame(ctx, w, h, 50, 52, 3);
    const words = String(title || "").trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? current + " " + word : word;
      ctx.font = "600 72px " + FONT;
      if (ctx.measureText(next).width > w - 150 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    const shown = lines.slice(0, 4);
    if (lines.length > 4) shown[3] = shown[3].replace(/\s*\S*$/, "") + "…";
    const size = shown.some((l) => l.length > 14) ? 56 : 70;
    shown.forEach((line, i) => {
      handText(ctx, line, w / 2, h * 0.36 + (i - (shown.length - 1) / 2) * size * 1.2, size, { seed: 60 + i, spacing: 0.02 });
    });
    ctx.lineWidth = 4;
    wobblyLine(ctx, w * 0.3, h * 0.62, w * 0.7, h * 0.62, 70, 2);
    bookIcon(ctx, w / 2, h * 0.76, 110);
  });
}

/** Pagina da esquerda: texto corrido com capitular. */
export function leftPageTexture() {
  return canvasTexture(512, 720, (ctx, w, h) => {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    handText(ctx, "Capítulo 1", w / 2, 110, 40, { weight: 400, seed: 80, spacing: 0.04 });
    ctx.fillRect(w * 0.38, 128, w * 0.24, 3);
    ctx.font = "600 120px " + FONT;
    ctx.fillText("E", 52, 290);
    textLines(ctx, 140, 190, w - 200, 4, 81, 13, 32);
    textLines(ctx, 52, 318, w - 104, 11, 82, 13, 32);
    ctx.font = "400 26px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("7", w / 2, h - 40);
  });
}

/**
 * Pagina da direita: a moldura da ilustracao (a imagem entra por cima, num
 * plano proprio) e o texto embaixo. "picture" = { x, y, w, h } em fracoes da
 * pagina, onde a imagem fica.
 */
export function rightPageTexture(picture) {
  return canvasTexture(512, 720, (ctx, w, h) => {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.strokeStyle = "#000";
    const x = picture.x * w;
    const y = (1 - picture.y - picture.h) * h;
    const pw = picture.w * w;
    const ph = picture.h * h;
    ctx.lineWidth = 5;
    wobblyLine(ctx, x - 8, y - 8, x + pw + 8, y - 8, 90, 2);
    wobblyLine(ctx, x + pw + 8, y - 8, x + pw + 8, y + ph + 8, 91, 2);
    wobblyLine(ctx, x + pw + 8, y + ph + 8, x - 8, y + ph + 8, 92, 2);
    wobblyLine(ctx, x - 8, y + ph + 8, x - 8, y - 8, 93, 2);
    handText(ctx, "Era uma vez uma esquina...", w / 2, y + ph + 70, 34, { weight: 400, seed: 94, spacing: 0.01 });
    textLines(ctx, 52, y + ph + 110, w - 104, 5, 95, 12, 30);
    ctx.font = "400 26px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("8", w / 2, h - 40);
  });
}

/** Paginas que passam voando (so texto). */
export function flyingPageTexture(seed) {
  return canvasTexture(256, 360, (ctx, w) => {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    textLines(ctx, 26, 40, w - 52, 14, seed, 7, 20);
  });
}
