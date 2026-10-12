/**
 * Animacao de boas-vindas do acervo publico: "da pagina ao galho".
 *
 * Uma mini historia: a logo sobe; as pinceladas do livro dela se abrem num
 * livro visto de frente, de paginas brancas; letras surgem no papel e as
 * paginas sao folheadas cada vez mais rapido; as seis ultimas linhas de texto
 * viram os seis tracos de um passaro de traco unico, que voa para longe, faz
 * a volta e pousa de costas num galho, de onde uma folha cai devagar, girando.
 * No ciclo seguinte a logo sobe de novo e empurra a cena do passaro para cima.
 *
 * Este arquivo e so a "partitura": dado um instante (em segundos), devolve o
 * que desenhar. Nao mexe na tela; quem desenha e o WelcomeScene.jsx. Assim da
 * para conferir qualquer quadro isolado.
 *
 * Tudo aqui esta em unidades do palco (SCENE.width x SCENE.height). As formas
 * do passaro e do livro da logo vem de welcomeShapes.js. (A animacao anterior,
 * "uma linha so", continua guardada em welcomeLineAnimation.js.)
 */
import { BIRD, BOOK } from "./welcomeShapes.js";

export const SCENE = { width: 400, height: 240 };
export const DURATION = 12.5; // segundos de um ciclo completo

// Onde a logo fica no palco: (x, y) do palco = LOGO.x/y + (logo - origem) * escala.
export const LOGO = { x: 200, y: 104, scale: 0.118, originX: 1089, originY: 652 };

// O livro aberto, visto de frente: duas paginas brancas e a lombada no meio.
// As bordas de cima e de baixo caem "sag" unidades em direcao a lombada.
export const PAGE = { left: 68, middle: 200, right: 332, top: 32, bottom: 208, sag: 4 };
const PAGE_WIDTH = PAGE.right - PAGE.middle;

/* ---------- O que esta escrito nas paginas ----------
   Cada item e uma "abertura" do livro (pagina esquerda e pagina direita).
   - title: frase grande, uma linha por item (so na primeira; surge letra a letra)
   - word: uma palavra grande
   - text: paragrafo miudo (textura); "cap" e a capitular
   - glyph: uma letra gigante e clara (as paginas que passam rapido)
   - lines: as linhas da ultima abertura, que viram os tracos do passaro
   - sprig: uma folhinha desenhada
   Para trocar o texto, mexa so aqui. */
const PARAGRAPH = [
  "Ler para edificar. Ler para alcançar",
  "vidas para Cristo. Ler para que Deus",
  "seja louvado nos corações. Esta é a",
  "biblioteca da ADMP Brasil: um lugar",
  "para cultivar, livro a livro, uma",
  "vida de leitura.",
];
export const SPREADS = [
  { left: { sprig: true }, right: { title: ["Uma vida", "de leitura"] } },
  {
    left: {
      cap: "L",
      beside: ["er para edificar.", "Ler para alcançar", "vidas para Cristo."],
      text: ["Ler para que Deus seja louvado", "nos corações. Esta é a biblioteca", "da ADMP Brasil: um lugar para", "cultivar, livro a livro, uma vida", "de leitura."],
    },
    right: { word: "edificar" },
  },
  { left: { word: "alcançar" }, right: { text: PARAGRAPH } },
  { left: { text: PARAGRAPH }, right: { word: "louvar" } },
  { left: {}, right: { glyph: "a" } },
  { left: { glyph: "g" }, right: {} },
  { left: {}, right: { glyph: "R" } },
  { left: { glyph: "&" }, right: {} },
  { left: {}, right: { glyph: "f" } },
  { left: { glyph: "Q" }, right: {} },
  { left: {}, right: { glyph: "ç" } },
  { left: { glyph: "y" }, right: {} },
  {
    left: { lines: ["página por página,", "linha por linha,", "palavra por palavra,"] },
    right: { lines: ["uma vida", "de leitura", "ganha asas."] },
  },
];
// Linhas de base das tres linhas da ultima abertura, e o tamanho da letra.
export const CLOSING = { baselines: [95, 121, 147], size: 9.5 };
export const LEFT_CENTER = (PAGE.left + PAGE.middle) / 2;
export const RIGHT_CENTER = (PAGE.middle + PAGE.right) / 2;

/* ---------- Roteiro (tempos em segundos) ---------- */
const T = {
  pushEnd: 1.1, // a logo termina de subir (empurrando a cena anterior)
  settle: 1.35,
  nameOut: 1.8, // o nome some; o livro comeca a se abrir
  thin: 1.82, // a tinta afina ate virar traco...
  open: 2, // ...e so entao as pinceladas viram o contorno do livro aberto
  openEnd: 2.7,
  paper: 2.45, // o branco das paginas entra
  write: 2.7, // as letras surgem na primeira pagina
  // Cada virada de folha: [inicio, duracao]. Tres lentas, depois acelera.
  flips: [
    [3.5, 0.6],
    [4.5, 0.45],
    [5.2, 0.32],
    [5.62, 0.26],
    [5.8, 0.22],
    [5.95, 0.19],
    [6.07, 0.16],
    [6.17, 0.14],
    [6.25, 0.12],
    [6.32, 0.11],
    [6.38, 0.1],
    [6.43, 0.1],
  ],
  lines: 6.5, // as seis linhas de texto viram seis tracos retos...
  linesEnd: 6.64,
  bird: 6.58, // ...que sobem da pagina e se curvam no passaro
  fly: 7.07, // primeira batida de asa: decola
  spineOut: 6.62, // a lombada some antes (senao cortaria o passaro ao meio)
  bookOut: 6.74, // o livro desce e some
  bookGone: 7.14,
  turn: 7.97, // meia-volta, no ponto mais longe
  turnEnd: 8.22,
  branch: 7.82, // o galho e desenhado da borda para a ponta
  branchEnd: 8.82,
  flare: 9.37, // empina para pousar
  land: 9.62, // toca o galho
  turnBack: 9.72, // vira de costas: o desenho fecha de perfil...
  folded: 9.94, // ...e reabre ja pousado, de costas
  leaf: 9.86, // a folha se solta, no retorno do galho
};
const LINE_WIDTH = 2; // traco do passaro na logo e na pagina
const BIRD_WIDTH = 1.8;
const PARTS = ["BELLY", "HD", "WL", "WR", "TE", "TL"];
// As pinceladas do livro da logo (a cabeca nao tem uma so dela: ela se deita
// sobre o comeco da pincelada de baixo).
const STROKES = PARTS.filter((part) => part !== "HD");
// Cantos vivos de cada trecho (no resto, a curva passa suave pelos pontos).
const CORNERS = { WL: [7, 16] };

/* ---------- Matematica basica ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// 0 antes de "from", 1 depois de "to", linear no meio.
const span = (t, from, to) => clamp01((t - from) / (to - from));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInQuad = (t) => t * t;
const smoothstep = (t) => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};
const n2 = (v) => Math.round(v * 100) / 100;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// Curva "cubic-bezier" do CSS: devolve y para um x de 0 a 1.
function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, u) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const pushEase = cubicBezier(0.4, 0, 0.2, 1);
const morphEase = cubicBezier(0.45, 0, 0.25, 1);
const wingDown = cubicBezier(0.5, 0, 0.2, 1);
const wingUp = cubicBezier(0.4, 0, 0.6, 1);

function rotate(point, center, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = point[0] - center[0];
  const y = point[1] - center[1];
  return [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos];
}

/* ---------- Caminhos SVG ---------- */
function curveTo(p0, p1, p2, p3) {
  return (
    "C" + n2(p1[0] + (p2[0] - p0[0]) / 6) + " " + n2(p1[1] + (p2[1] - p0[1]) / 6) +
    " " + n2(p2[0] - (p3[0] - p1[0]) / 6) + " " + n2(p2[1] - (p3[1] - p1[1]) / 6) +
    " " + n2(p2[0]) + " " + n2(p2[1])
  );
}

// Liga os pontos com uma curva suave (Catmull-Rom -> curvas de Bezier). Nos
// indices de "corners" a curva faz um canto vivo.
function smoothPath(points, corners = []) {
  let d = "";
  let start = 0;
  [...corners, points.length - 1].forEach((end) => {
    d += "M" + n2(points[start][0]) + " " + n2(points[start][1]);
    for (let i = start; i < end; i += 1) {
      d += curveTo(
        points[Math.max(start, i - 1)],
        points[i],
        points[i + 1],
        points[Math.min(end, i + 2)],
      );
    }
    start = end;
  });
  return d;
}

function polyline(points) {
  let d = "";
  for (let i = 0; i < points.length; i += 1) {
    d += (i ? "L" : "M") + n2(points[i][0]) + " " + n2(points[i][1]);
  }
  return d;
}

const posePath = (pose, parts = PARTS) =>
  parts.map((part) => smoothPath(pose[part], CORNERS[part])).join("");

const mixPose = (a, b, amount) => {
  const pose = {};
  PARTS.forEach((part) => {
    const t = typeof amount === "function" ? amount(part) : amount;
    pose[part] = a[part].map((point, i) => mix(point, b[part][i], t));
  });
  return pose;
};

// Passa uma curva suave por alguns pontos de controle e devolve "count"
// pontos igualmente espacados ao longo dela (para desenhar formas a mao).
function trace(control, count) {
  const dense = [];
  for (let i = 0; i < control.length - 1; i += 1) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    for (let k = 0; k < 16; k += 1) {
      const u = k / 16;
      const u2 = u * u;
      const u3 = u2 * u;
      dense.push([0, 1].map((axis) =>
        0.5 * (2 * p1[axis] + (p2[axis] - p0[axis]) * u +
          (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * u2 +
          (3 * p1[axis] - p0[axis] - 3 * p2[axis] + p3[axis]) * u3),
      ));
    }
  }
  dense.push(control[control.length - 1]);
  const lengths = [0];
  for (let i = 1; i < dense.length; i += 1) lengths.push(lengths[i - 1] + distance(dense[i - 1], dense[i]));
  const total = lengths[lengths.length - 1];
  const out = [];
  let j = 1;
  for (let i = 0; i < count; i += 1) {
    const at = (total * i) / (count - 1);
    while (j < lengths.length - 1 && lengths[j] < at) j += 1;
    out.push(mix(dense[j - 1], dense[j], clamp01((at - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1))));
  }
  return out;
}
// Pontos igualmente espacados numa reta.
const straight = (from, to, count) =>
  Array.from({ length: count }, (_, i) => mix(from, to, i / (count - 1)));

/* ---------- Da logo ao livro aberto ----------
   As pinceladas do livro da logo (ja afinadas em traco) viram o contorno do
   livro aberto visto de frente: cada pincelada vai para uma borda. */
const BOOK_CENTER = {};
PARTS.forEach((part) => {
  BOOK_CENTER[part] = BOOK[part].a.map((point, i) => mix(point, BOOK[part].b[i], 0.5));
});
const { left: PL, middle: PM, right: PR, top: PT, bottom: PB, sag: SAG } = PAGE;
const OUTLINE = {
  // Pagina esquerda da logo -> borda de cima e borda esquerda da pagina esquerda.
  WL: trace([[PM, PT + SAG], [PM - 40, PT + 0.6], [PL, PT]], 17).concat(straight([PL, PT], [PL, PB], 12).slice(1)),
  // Arco de cima -> borda de cima da pagina direita.
  WR: trace([[PM, PT + SAG], [PM + 40, PT + 0.6], [PR, PT]], BIRD.WR.length),
  // Diagonal grossa -> borda direita.
  TE: straight([PR, PT], [PR, PB], BIRD.TE.length),
  // Pincelada de baixo -> as duas bordas de baixo, passando pela lombada.
  BELLY: trace([[PL, PB], [PM - 40, PB + 0.6], [PM, PB + SAG], [PM + 40, PB + 0.6], [PR, PB]], BIRD.BELLY.length),
  // Pincelada interna -> a linha da lombada.
  TL: straight([PM, PT + SAG], [PM, PB + SAG], BIRD.TL.length),
};
OUTLINE.HD = OUTLINE.BELLY.slice(0, BIRD.HD.length).reverse();
// Com o livro ja aberto, a lombada e um traco a parte (ela some antes).
const EDGES = STROKES.filter((part) => part !== "TL");
const OUTLINE_PATH = posePath(OUTLINE, EDGES);
export const SPINE_PATH = polyline(OUTLINE.TL);
// A forma de cada pagina (para o papel branco e para a folha que vira).
export const PAGE_RIGHT_PATH =
  polyline([...OUTLINE.WR, ...OUTLINE.TE, ...OUTLINE.BELLY.slice(15).reverse(), ...OUTLINE.TL.slice().reverse()]) + "Z";
export const PAGE_LEFT_PATH =
  polyline([...OUTLINE.WL, ...OUTLINE.BELLY.slice(0, 15), ...OUTLINE.TL.slice().reverse()]) + "Z";
export const BRANCH_PIVOT_POINT = [402, 150];

// Pincelada preenchida da logo: "ink" vai de 0 (traco fino) a 1 (a pincelada).
function logoInk(ink) {
  let fill = "";
  STROKES.forEach((part) => {
    const { a, b } = BOOK[part];
    const center = BOOK_CENTER[part];
    const left = [];
    const right = [];
    center.forEach((point, i) => {
      let dx = a[i][0] - b[i][0];
      let dy = a[i][1] - b[i][1];
      let length = Math.hypot(dx, dy);
      if (length < 0.05) {
        // Ponta da pincelada: os lados se encontram; usa a perpendicular.
        const next = center[Math.min(i + 1, center.length - 1)];
        const prev = center[Math.max(i - 1, 0)];
        dx = -(next[1] - prev[1]);
        dy = next[0] - prev[0];
        length = Math.hypot(dx, dy) || 1;
      }
      const thin = [(dx / length) * (LINE_WIDTH / 2), (dy / length) * (LINE_WIDTH / 2)];
      left.push([point[0] + lerp(thin[0], a[i][0] - point[0], ink), point[1] + lerp(thin[1], a[i][1] - point[1], ink)]);
      right.push([point[0] + lerp(-thin[0], b[i][0] - point[0], ink), point[1] + lerp(-thin[1], b[i][1] - point[1], ink)]);
    });
    fill += polyline(left.concat(right.reverse())) + "Z";
  });
  return fill;
}

/* ---------- O passaro em voo ---------- */
const SHOULDER_L = BIRD.WL[0]; // onde a asa de tras se prende
const SHOULDER_R = BIRD.WR[2]; // entalhe do ombro: raiz da asa da frente
const TAIL_ROOT = BIRD.TL[0];
const BELLY_TAIL = 7; // os ultimos pontos da barriga sao a ponta de baixo da cauda

// Quanto cada ponto acompanha a asa (0 = preso ao corpo, 1 = solto) e quanto
// ele atrasa: a ponta chega depois da raiz, e e isso que faz a asa flexionar.
function wingMap(points, pivot, reach, fade) {
  const far = Math.max(...points.map((point) => distance(point, pivot)));
  return points.map((point, index) => {
    const d = distance(point, pivot);
    return {
      weight: smoothstep(d / reach) * (fade ? 1 - smoothstep(index / (points.length - 1)) : 1),
      lag: 0.08 * (d / far),
    };
  });
}
const WING = {
  WL: wingMap(BIRD.WL, SHOULDER_L, 6, false),
  WR: wingMap(BIRD.WR, SHOULDER_R, 10, false),
  // A borda de fuga estica como uma membrana: solta na ponta, presa no corpo.
  TE: wingMap(BIRD.TE, SHOULDER_R, 10, true),
};

// Batidas de asa: [inicio, duracao]. Fortes na decolagem, uma so no planeio,
// e duas curtas para frear antes do pouso.
const BEATS = [
  [T.fly, 0.46],
  [T.fly + 0.46, 0.46],
  [T.fly + 0.92, 0.42],
  [8.62, 0.44],
  [9.18, 0.22],
  [9.4, 0.22],
];

// Altura das asas: 1 = no alto, 0 = embaixo.
function wingHeight(t) {
  for (let i = 0; i < BEATS.length; i += 1) {
    const v = (t - BEATS[i][0]) / BEATS[i][1];
    if (v >= 0 && v < 1) return v < 0.38 ? 1 - wingDown(v / 0.38) : wingUp((v - 0.38) / 0.62);
  }
  return 1;
}
// Planeio: 1 enquanto ele plana (asas na pose do desenho de referencia).
const gliding = (t) => smoothstep(span(t, 8.2, 8.4)) * (1 - smoothstep(span(t, 8.95, 9.15)));

// Rota do voo: [tempo, x, y, tamanho]. Sai da pagina, sobe, vai para longe
// (fica pequeno), faz a volta e vem pousar no galho.
const ROUTE = [
  [T.fly, 200, 112, 0.95],
  [7.57, 128, 74, 0.66],
  [8.07, 66, 46, 0.36],
  [8.62, 150, 40, 0.34],
  [9.12, 232, 64, 0.42],
  [T.land, 268, 116, 0.5],
];
// Velocidade em cada ponto da rota (para a curva passar suave por todos).
const ROUTE_SPEED = ROUTE.map((key, i) => {
  if (i === 0 || i === ROUTE.length - 1) return [0, 0];
  const before = ROUTE[i - 1];
  const after = ROUTE[i + 1];
  return [(after[1] - before[1]) / (after[0] - before[0]), (after[2] - before[2]) / (after[0] - before[0])];
});

function routeAt(t) {
  if (t <= ROUTE[0][0]) return { x: ROUTE[0][1], y: ROUTE[0][2], scale: ROUTE[0][3] };
  const last = ROUTE[ROUTE.length - 1];
  if (t >= last[0]) return { x: last[1], y: last[2], scale: last[3] };
  let i = 0;
  while (t > ROUTE[i + 1][0]) i += 1;
  const a = ROUTE[i];
  const b = ROUTE[i + 1];
  const dt = b[0] - a[0];
  const u = (t - a[0]) / dt;
  const u2 = u * u;
  const u3 = u2 * u;
  const h = [2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2];
  return {
    x: h[0] * a[1] + h[1] * dt * ROUTE_SPEED[i][0] + h[2] * b[1] + h[3] * dt * ROUTE_SPEED[i + 1][0],
    y: h[0] * a[2] + h[1] * dt * ROUTE_SPEED[i][1] + h[2] * b[2] + h[3] * dt * ROUTE_SPEED[i + 1][1],
    scale: lerp(a[3], b[3], smoothstep(u)),
  };
}

// Para que lado ele esta virado: 1 = esquerda, -1 = direita (passa por zero
// na meia-volta).
const facingAt = (t) => lerp(1, -1, easeInOutSine(span(t, T.turn, T.turnEnd)));

// Pontos do passaro em voo, no palco, por trecho.
function flightPose(t) {
  const { x, y, scale } = routeAt(t);
  const ahead = routeAt(t + 0.03);
  const dx = ahead.x - x;
  const dy = ahead.y - y;
  // Inclina acompanhando a subida ou a descida (metade do angulo da rota) e
  // empina para frear antes do pouso.
  const flare = easeOut(span(t, T.flare, T.land));
  const pitch = Math.hypot(dx, dy) > 0.02 ? (Math.atan2(-dy, Math.abs(dx)) * 180) / Math.PI : 0;
  const tilt = lerp(Math.max(-14, Math.min(14, pitch / 2)), -14, flare) * smoothstep(span(t, T.fly, T.fly + 0.25));
  // Meia-volta: o desenho se fecha e reabre espelhado, enquanto esta pequeno.
  const facing = facingAt(t);
  const glide = gliding(t);
  const tailSwing = 4 * (2 * wingHeight(t - 0.12) - 1) * (1 - flare) * (1 - glide);
  const bob = -1.6 * (1 - wingHeight(t - 0.05));

  const pose = {};
  PARTS.forEach((part) => {
    const map = WING[part];
    pose[part] = BIRD[part].map((point, index) => {
      let p = point;
      if (map) {
        const h = wingHeight(t - map[index].lag - (part === "WL" ? 0 : 0.04));
        // As asas oscilam em torno da pose de referencia: a de tras entre 8
        // graus acima e 4 abaixo, a da frente entre 10 acima e 9 abaixo. No
        // planeio ficam na pose de referencia; na freada, sobem mais.
        const beat = part === "WL" ? lerp(-4, 8, h) : lerp(9, -10, h);
        const degrees = beat * (1 - glide) + (part === "WL" ? 8 : -6) * flare;
        p = rotate(p, part === "WL" ? SHOULDER_L : SHOULDER_R, degrees * map[index].weight);
      } else if (part === "TL") {
        p = rotate(p, TAIL_ROOT, tailSwing * smoothstep(index / 4));
      } else if (part === "BELLY") {
        const k = index - (BIRD.BELLY.length - BELLY_TAIL);
        if (k > 0) p = rotate(p, BIRD.BELLY[BIRD.BELLY.length - BELLY_TAIL], tailSwing * smoothstep(k / 4));
      }
      p = rotate(p, [0, 0], tilt);
      return [x + p[0] * scale * facing, y + bob * scale + p[1] * scale];
    });
  });
  return pose;
}
// Traco quase constante: afina pouco quando o passaro fica pequeno.
const strokeFor = (scale) => n2(Math.max(1.3, BIRD_WIDTH * Math.pow(scale, 0.4)));

/* ---------- As linhas de texto que viram o passaro ----------
   Cada linha da ultima abertura vira um trecho do passaro: as tres da
   esquerda viram a asa de tras, a cabeca e a barriga; as tres da direita, a
   borda de ataque, a borda de fuga e a cauda. Cada trecho comeca deitado,
   reto, sobre a linha de base do seu texto. "widths" sao as larguras medidas
   das seis linhas (esquerda de cima para baixo, depois direita). */
const LINE_OF = { WL: 0, HD: 1, BELLY: 2, WR: 3, TE: 4, TL: 5 };
const MORPH_DELAY = { BELLY: 0, HD: 0.03, WL: 0.06, WR: 0.08, TE: 0.08, TL: 0.11 };
const MORPH_TIME = 0.38;

function linesPose(widths) {
  const row = (part) => {
    const index = LINE_OF[part];
    const center = index < 3 ? LEFT_CENTER : RIGHT_CENTER;
    const y = CLOSING.baselines[index % 3] - 2.2;
    const half = widths[index] / 2;
    return { from: [center - half, y], to: [center + half, y] };
  };
  const pose = {};
  PARTS.forEach((part) => {
    const { from, to } = row(part);
    const count = BIRD[part].length;
    if (part === "WL") {
      // A asa de tras vai ate a ponta e volta: dobrada sobre a mesma reta.
      pose.WL = straight(to, from, 17).concat(straight(from, to, 12).slice(1));
    } else if (part === "HD" || part === "TE") {
      pose[part] = straight(to, from, count); // estes trechos correm da direita para a esquerda
    } else {
      pose[part] = straight(from, to, count);
    }
  });
  return pose;
}
const TAKEOFF = flightPose(T.fly);

/* ---------- O galho ---------- */
// Tracos finos, da borda direita para a ponta. Cada pedaco e desenhado quando
// o traco principal chega ate ele ("at" = em que ponto do desenho, 0 a 1).
const BRANCH = trace([[402, 150], [340, 141], [290, 138], [240, 131.5], [200, 133.5], [186, 132], [176, 126]], 44);
const BRANCH_PIVOT = [402, 150];
const BRANCH_REACH = BRANCH_PIVOT[0] - BRANCH[BRANCH.length - 1][0];
const branchY = (x) => {
  let i = 1;
  while (i < BRANCH.length - 1 && BRANCH[i][0] > x) i += 1;
  const a = BRANCH[i - 1];
  const b = BRANCH[i];
  return lerp(a[1], b[1], clamp01((a[0] - x) / (a[0] - b[0] || 1)));
};

// Folha em forma de amendoa: sai de "base" na direcao "degrees".
function leafPath(base, degrees, length = 14, width = 3.4) {
  const rad = (degrees * Math.PI) / 180;
  const along = [Math.cos(rad), Math.sin(rad)];
  const side = [-along[1], along[0]];
  const at = (f, w) =>
    n2(base[0] + along[0] * length * f + side[0] * width * w) + " " +
    n2(base[1] + along[1] * length * f + side[1] * width * w);
  return "M" + at(0, 0) + "Q" + at(0.45, 1) + " " + at(1, 0) + "Q" + at(0.45, -1) + " " + at(0, 0);
}
const drawnAt = (x) => (BRANCH_PIVOT[0] - x) / BRANCH_REACH;
const TWIG_UP = [[346, branchY(346)], [338, 124], [326, 108]];
const TWIG_DOWN = [[214, branchY(214)], [206, 146], [196, 156]];
export const BRANCH_PARTS = [
  { d: smoothPath(BRANCH), at: 0, take: 1 },
  { d: smoothPath(trace(TWIG_UP, 8)), at: drawnAt(346), take: 0.2 },
  { d: leafPath(TWIG_UP[1], -18), at: drawnAt(346) + 0.1, take: 0.16 },
  { d: leafPath(TWIG_UP[2], -112), at: drawnAt(346) + 0.2, take: 0.16 },
  { d: smoothPath(trace(TWIG_DOWN, 8)), at: drawnAt(214), take: 0.08 },
  { d: leafPath(TWIG_DOWN[2], 128), at: drawnAt(214) + 0.07, take: 0.09 },
  // (So depois de o traco chegar a ponta.)
  { d: leafPath(BRANCH[BRANCH.length - 1], -128), at: 0.93, take: 0.07 },
];
// A folha dourada (a unica cor do filme): pende do galho, e e ela que cai.
const GOLD_BASE = [304, branchY(304) + 0.8];
export const GOLD_LEAF = { d: leafPath(GOLD_BASE, 98, 15, 3.8), base: GOLD_BASE, at: drawnAt(304), take: 0.16 };

// O galho cede quando o passaro toca e volta amortecido (graus; negativo = a
// ponta desce).
function branchSwing(t) {
  const since = t - T.land;
  if (since <= 0 || since > 1.3) return 0;
  return -2 * Math.exp(-4.3 * since) * Math.sin(2 * Math.PI * 1.9 * since) * (1 - smoothstep((since - 1) / 0.3));
}

// A folha caindo, "since" segundos depois de se soltar: desce devagar, num
// vaivem que vai diminuindo, girando e virando sobre si mesma.
function leafFall(since) {
  if (since <= 0) return { x: 0, y: 0, turn: 0, flip: 1 };
  const start = smoothstep(since / 0.5); // solta-se aos poucos
  const sway = Math.sin(since * 2 * Math.PI * 0.62);
  return {
    x: n2(-13 * since + 15 * sway * start * Math.exp(-since * 0.12)),
    y: n2(19 * since + 4 * since * start - 5 * Math.abs(sway) * start),
    // Gira acompanhando o vaivem, com uma volta lenta por cima.
    turn: n2(start * (42 * Math.cos(since * 2 * Math.PI * 0.62) + 34 * since)),
    // "Vira" sobre si mesma: a largura fecha e reabre.
    // (Nunca fica de perfil exato: ali ela viraria um fio e pareceria piscar.)
    flip: n2(lerp(1, ((c) => (c < 0 ? -1 : 1) * Math.max(0.3, Math.abs(c)))(Math.cos(since * 2 * Math.PI * 0.47)), start)),
  };
}

/* ---------- O passaro pousado, de costas ----------
   Pose desenhada a mao, com os mesmos trechos do passaro em voo (por isso um
   vira o outro): visto por tras, cabeca redonda, corpo em gota, as duas asas
   fechadas formando um "V" no dorso e a cauda pendendo atras do galho.
   Coordenadas a partir do ponto em que o corpo cruza o galho. */
const PERCH_SCALE = 0.44;
const PERCH_AT = [266, branchY(266) - 0.5];
const NECK_R = [12, -63];
const NECK_L = [-12, -63];
const PERCH = {
  // A cabeca: do pescoco (a direita), por cima, ate o pescoco (a esquerda).
  HD: trace([NECK_R, [15, -76], [9, -89], [0, -93], [-9, -89], [-15, -76], NECK_L], BIRD.HD.length),
  // Lado esquerdo: ombro, flanco e a borda esquerda da cauda, ate a ponta.
  BELLY: trace([NECK_L, [-23, -51], [-27, -28], [-21, -5], [-12, 14], [-6, 32], [0, 47]], BIRD.BELLY.length),
  // Lado direito, igual, ate a ponta da cauda.
  WR: trace([NECK_R, [23, -51], [27, -28], [21, -5], [12, 14], [6, 32], [0, 47]], BIRD.WR.length),
  // Da ponta da cauda sobe pelo meio e desenha a borda da asa direita...
  TE: trace([[0, 47], [1, 22], [5, 4], [9, -16], [6, -36], [0, -47]], BIRD.TE.length),
  // ...e a borda da asa esquerda: as duas juntas fazem o "V" do dorso.
  TL: trace([[0, -47], [-6, -36], [-9, -16], [-5, 4]], BIRD.TL.length),
  // O trecho da asa de tras vira a pontinha do bico: a cabeca esta levemente
  // virada, e isso ajuda a ler um passaro (ele continua de costas).
  WL: straight([14.5, -82], [22, -77.5], 17).concat(straight([22, -77.5], [15.5, -73.5], 12).slice(1)),
};
const PERCHED = {};
PARTS.forEach((part) => {
  PERCHED[part] = PERCH[part].map(([x, y]) => [PERCH_AT[0] + x * PERCH_SCALE, PERCH_AT[1] + y * PERCH_SCALE]);
});
const LANDING = flightPose(T.land);
const PERCHED_PATH = posePath(PERCHED);
const PERCH_STROKE = 1.7; // o mesmo peso do galho
// Estreita um desenho na horizontal em torno do ponto de pouso (o giro).
const squeeze = (pose, amount) => {
  const out = {};
  PARTS.forEach((part) => {
    out[part] = pose[part].map(([x, y]) => [PERCH_AT[0] + (x - PERCH_AT[0]) * amount, y]);
  });
  return out;
};

/**
 * O que desenhar no instante "time" (segundos). Aceita qualquer valor: o
 * ciclo se repete sozinho. "widths" sao as larguras medidas das seis linhas
 * da ultima abertura (sem elas, usa uma estimativa).
 */
export function frameAt(time, widths) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  const firstRun = time < DURATION;
  const lineWidths = widths || [...SPREADS[SPREADS.length - 1].left.lines, ...SPREADS[SPREADS.length - 1].right.lines].map((text) => text.length * CLOSING.size * 0.46);

  /* ----- A logo sobe (empurrando a cena anterior) e para ----- */
  const push = pushEase(span(t, 0, T.pushEnd));
  const settle = span(t, T.pushEnd, T.settle);
  const appear = firstRun ? span(t, 0, 0.3) : 1;
  const logo = {
    // Chega passando um pouco do ponto e assenta.
    lift: n2(SCENE.height * (1 - push) - 3 * Math.sin(Math.PI * settle) * (1 - settle)),
    book: t < T.thin ? n2(appear) : 0,
    name: n2(appear * (1 - easeInQuad(span(t, T.nameOut, T.nameOut + 0.3)))),
  };

  /* ----- O livro: abre, e folheado, e sai ----- */
  const leaving = easeIn(span(t, T.bookOut, T.bookGone));
  const flipsStarted = T.flips.filter(([start]) => t >= start).length;
  const flipsDone = T.flips.filter(([start, length]) => t >= start + length).length;
  const book = {
    visible: t >= T.thin && t < T.bookGone,
    opacity: n2(1 - leaving),
    drop: n2(36 * leaving),
    ink: "", // as pinceladas da logo, afinando
    outline: OUTLINE_PATH, // o contorno do livro (as pinceladas, ja abertas)
    outlineWidth: 1.5,
    spine: n2(t < T.openEnd ? 0 : 1 - span(t, T.spineOut, T.spineOut + 0.18)),
    paper: n2(span(t, T.paper, T.paper + 0.3)), // o branco das paginas
    left: flipsDone, // qual abertura esta a mostra de cada lado
    right: flipsStarted,
    // Primeira pagina: quanto do texto ja surgiu, e a folhinha sendo desenhada.
    written: n2(span(t, T.write, T.write + 0.72)),
    sprig: n2(easeOut(span(t, T.write, T.write + 0.4))),
    // As seis linhas viram tinta: o texto some e o traco reto assume.
    closing: n2(1 - span(t, T.lines, T.linesEnd)),
    leaves: [null, null, null],
  };
  if (t >= T.thin && t < T.openEnd) {
    const ink = 1 - easeInOut(span(t, T.thin, T.open - 0.02));
    const open = morphEase(span(t, T.open, T.openEnd));
    book.ink = ink > 0 ? logoInk(ink) : "";
    const shape = mixPose(BOOK_CENTER, OUTLINE, open);
    // A pincelada de baixo comeca, na logo, a esquerda da pagina: no caminho
    // ela e trazida para o pe da borda esquerda, para as duas nao se cruzarem.
    const foot = shape.WL[shape.WL.length - 1];
    const join = smoothstep((open - 0.1) / 0.2);
    const dx = (foot[0] - shape.BELLY[0][0]) * join;
    const dy = (foot[1] - shape.BELLY[0][1]) * join;
    shape.BELLY = shape.BELLY.map(([x, y], i) => {
      const pull = 1 - smoothstep(i / 9);
      return [x + dx * pull, y + dy * pull];
    });
    book.outline = posePath(shape, STROKES);
    book.outlineWidth = n2(ink > 0 ? LINE_WIDTH * (1 - ink) : lerp(LINE_WIDTH, 1.5, open));
  }
  T.flips.forEach(([start, length], index) => {
    if (t < start || t >= start + length) return;
    const u = (t - start) / length;
    const angle = Math.PI * (index < 3 ? easeInOut(u) : easeInOutSine(u));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const shade = Math.round(255 - 12 * sin);
    book.leaves[index % 3] = {
      front: index, // a pagina direita que esta sendo virada
      back: index + 1, // o verso: a proxima pagina esquerda
      // A folha gira presa a lombada: estreita ate sumir de perfil e reabre
      // do outro lado; a borda solta sobe ao passar pelo meio.
      width: n2(cos),
      skew: n2(-(index < 3 ? 9 : 12) * sin * Math.sign(cos || 1)),
      height: n2(1 + 0.06 * sin),
      // O texto some antes de a folha ficar de perfil (senao apareceria espremido).
      frontOpacity: n2(clamp01((cos - 0.5) / 0.25)),
      backOpacity: n2(clamp01((-cos - 0.5) / 0.25)),
      fill: "rgb(" + shade + "," + Math.round(255 - 19 * sin) + "," + Math.round(255 - 35 * sin) + ")",
    };
  });

  /* ----- O passaro: nasce das linhas, voa, pousa ----- */
  let bird = "";
  let birdWidth = BIRD_WIDTH;
  let birdOpacity = 1;
  let perch = ""; // o passaro ja de costas (um segundo desenho, para o giro)
  let perchOpacity = 1;
  let swing = 0;
  if (t >= T.lines && t < T.fly) {
    const lines = linesPose(lineWidths);
    birdOpacity = n2(span(t, T.lines, T.linesEnd));
    bird = posePath(
      mixPose(lines, TAKEOFF, (part) => morphEase(span(t, T.bird + MORPH_DELAY[part], T.bird + MORPH_DELAY[part] + MORPH_TIME))),
    );
    birdWidth = n2(lerp(BIRD_WIDTH, strokeFor(ROUTE[0][3]), span(t, T.bird, T.fly)));
  } else if (t >= T.fly && t < T.land) {
    bird = posePath(flightPose(t));
    // Na meia-volta o desenho passa por largura zero: em vez de virar uma
    // barra, ele afina e some por um instante.
    const facing = Math.abs(facingAt(t));
    birdOpacity = n2(clamp01((facing - 0.15) / 0.35));
    // Chegando ao galho, o traco ganha o mesmo peso dele.
    birdWidth = n2(lerp(strokeFor(routeAt(t).scale), PERCH_STROKE, smoothstep(span(t, 9.3, T.land))) * Math.sqrt(Math.max(0.05, facing)));
  } else if (t >= T.land) {
    // Pousa e vira de costas num giro no lugar: o desenho do voo estreita ate
    // quase sumir de perfil, e o desenho de costas abre no mesmo ponto.
    swing = branchSwing(t);
    // (Pousado, ele balanca junto com o galho.)
    const sway = (pose) => {
      if (!swing) return pose;
      const out = {};
      PARTS.forEach((part) => { out[part] = pose[part].map((point) => rotate(point, BRANCH_PIVOT, swing)); });
      return out;
    };
    const closing = easeInQuad(span(t, T.land, T.turnBack + 0.06));
    if (closing < 1) {
      bird = posePath(sway(squeeze(LANDING, lerp(1, 0.25, closing))));
      birdOpacity = n2(1 - span(t, T.turnBack - 0.02, T.turnBack + 0.06));
    }
    birdWidth = PERCH_STROKE;
    if (t >= T.turnBack) {
      const opening = easeOut(span(t, T.turnBack, T.folded));
      perch = opening >= 1 && !swing ? PERCHED_PATH : posePath(sway(squeeze(PERCHED, lerp(0.25, 1, opening))));
      perchOpacity = n2(span(t, T.turnBack, T.turnBack + 0.08));
    }
  }

  /* ----- O galho e a folha que cai ----- */
  const grown = easeInOutSine(span(t, T.branch, T.branchEnd));
  const nature = {
    visible: t >= T.branch,
    lift: 0,
    swing: n2(swing),
    parts: BRANCH_PARTS.map((part) => n2(span(grown, part.at, part.at + part.take))),
    gold: { drawn: n2(span(grown, GOLD_LEAF.at, GOLD_LEAF.at + GOLD_LEAF.take)), opacity: 1, ...leafFall(t - T.leaf) },
  };
  // Ciclo seguinte: a logo sobe e empurra para cima a cena do passaro pousado
  // (que sai um instante depois, como algo empurrado). A folha continua
  // caindo e some enquanto a cena sobe.
  if (t < T.pushEnd + 0.06 && !firstRun) {
    nature.visible = true;
    nature.lift = n2(-SCENE.height * pushEase(span(t, 0.06, T.pushEnd + 0.06)));
    nature.parts = BRANCH_PARTS.map(() => 1);
    nature.gold = { drawn: 1, opacity: n2(1 - smoothstep(span(t, 0.1, 0.75))), ...leafFall(DURATION - T.leaf + t) };
    bird = "";
    perch = PERCHED_PATH;
    perchOpacity = 1;
  }

  return { logo, book, bird, birdWidth, birdOpacity, perch, perchOpacity, nature };
}
