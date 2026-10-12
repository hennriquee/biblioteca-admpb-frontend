/**
 * Animacao de boas-vindas SECUNDARIA: "uma linha so" (roteiro do componente
 * WelcomeSceneLine.jsx; a principal esta em welcomeAnimation.js).
 *
 * Uma linha entra pela direita e desenha, de uma vez, um passaro de traco
 * unico. Ele voa; a cada batida de asa uma palavra troca na frase "Ler para
 * ..." e linhas de texto passam ao fundo. Na ultima batida, os proprios
 * tracos do passaro viram as pinceladas do livro da logo, a tinta engrossa e
 * o nome da biblioteca entra. No fim o livro sai pela direita, de onde a
 * linha volta no ciclo seguinte.
 *
 * Este arquivo e so a "partitura": dado um instante (em segundos), devolve o
 * que desenhar. Nao mexe na tela; quem desenha e o WelcomeScene.jsx. Assim da
 * para conferir qualquer quadro isolado.
 *
 * Tudo aqui esta em unidades do palco (SCENE.width x SCENE.height). As formas
 * do passaro e do livro vem de welcomeShapes.js.
 */
import { BIRD, BIRD_DRAW, BOOK } from "./welcomeShapes.js";

export const SCENE = { width: 400, height: 240 };
export const DURATION = 10; // segundos de um ciclo completo

// Onde a logo fica no palco: (x, y) do palco = LOGO.x/y + (logo - origem) * escala.
export const LOGO = { x: 200, y: 104, scale: 0.118, originX: 1089, originY: 652 };

/* ---------- Roteiro (tempos em segundos) ---------- */
const T = {
  drawStart: 0.15, // a linha entra pela direita...
  drawEnd: 1.06, // ...e termina o passaro
  releaseStart: 1.02, // o fio de entrada e recolhido ate a cauda
  releaseEnd: 1.3,
  beats: [1.55, 2.45, 3.35], // inicio de cada batida de asa (uma a cada 0,9 s)
  anticipate: 4.25, // freia e estica as asas
  morph: 4.52, // a ultima batida: o passaro vira livro
  inkStart: 5.14, // a forma ja chegou; a tinta engrossa
  inkEnd: 5.58,
  swapStart: 5.54, // a arte oficial da logo assume
  swapEnd: 5.66,
  wordStart: 5.4,
  subStart: 5.68,
  nameOut: 9.2,
  bookOut: 9.3, // a tinta afina e a linha sai pela direita
  bookGone: 9.88,
  backdropIn: 9.6,
};
const BEAT = 0.9;
const DOWN = 0.34; // a asa desce rapido...
const UP = BEAT - DOWN; // ...e sobe mais devagar

const LINE_WIDTH = 2;
const ENTRY = [408, 128]; // por onde a linha entra e sai (borda direita)
const BIRD_HOME = [206, 98]; // centro do passaro ao ser desenhado
const PARTS = ["BELLY", "HD", "WL", "WR", "TE", "TL"];
// As pinceladas do livro. A cabeca (HD) nao tem uma so dela: ela se deita
// sobre o comeco da pincelada de baixo (BELLY) e some dentro dela.
const STROKES = PARTS.filter((part) => part !== "HD");
// Em que instante (depois de T.morph) cada trecho comeca a virar livro.
// (A cabeca vai na frente da asa de tras, para as duas linhas nao se cruzarem.)
const MORPH_DELAY = { HD: 0, BELLY: 0.03, WL: 0.08, WR: 0.08, TE: 0.08, TL: 0.1 };
const MORPH_TIME = 0.56;
// Emendas do traco: pontas de trechos vizinhos que no passaro sao o mesmo
// ponto. Ficam coladas ate boa parte do caminho, e so entao a linha se parte
// nas pinceladas do livro. [trecho, "first" | "last"]
const SEAMS = [
  [["HD", "first"], ["WL", "first"], ["WR", "first"]], // ombro
  [["WR", "last"], ["TE", "first"]], // ponta da asa da frente
  [["TE", "last"], ["TL", "first"]], // laco da cauda
];
// Cantos vivos de cada trecho (no resto, a curva passa suave pelos pontos).
const CORNERS = { WL: [7, 16] };

/* ---------- Texto ---------- */
export const PHRASE = {
  prefix: "Ler para",
  verbs: ["edificar", "alcançar", "louvar"],
  baseline: 186,
  size: 23,
};
const PREFIX_IN = 0.5;
const VERB_IN = [0.68, 2.45, 3.35];
const VERB_OUT = [2.26, 3.16, 4.3];
const LETTER_GAP = 0.022;
const LETTER_TIME = 0.18;

// Linhas de texto que passam ao fundo, da esquerda para a direita (o passaro
// voa para a esquerda). "speed" em unidades do palco por segundo.
const DOT = "  ·  ";
export const BACKDROP = [
  { y: 24, size: 11, opacity: 0.26, speed: 150, words: ["capítulo", "página", "prefácio", "índice", "margem", "rodapé"] },
  { y: 46, size: 9, opacity: 0.18, speed: 95, words: ["salmos", "cartas", "histórias", "biografias", "devocionais", "poesia"] },
  { y: 124, size: 10, opacity: 0.22, speed: 190, words: ["palavra", "sabedoria", "graça", "verdade", "esperança"] },
  { y: 150, size: 9, opacity: 0.18, speed: 120, words: ["ler", "reler", "sublinhar", "guardar", "emprestar", "devolver"] },
].map((line) => ({ ...line, text: line.words.join(DOT) + DOT }));

/* ---------- Matematica basica ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// 0 antes de "from", 1 depois de "to", linear no meio.
const span = (t, from, to) => clamp01((t - from) / (to - from));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeIn = (t) => t * t * t;
const easeInQuad = (t) => t * t;
const smoothstep = (t) => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};
const n2 = (v) => Math.round(v * 100) / 100;

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
const wingDown = cubicBezier(0.5, 0, 0.2, 1);
const wingUp = cubicBezier(0.4, 0, 0.6, 1);
const morphEase = cubicBezier(0.45, 0, 0.25, 1);

function rotate(point, center, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = point[0] - center[0];
  const y = point[1] - center[1];
  return [center[0] + x * cos - y * sin, center[1] + x * sin + y * cos];
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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

/* ---------- A linha que desenha o passaro ---------- */
// Fio de entrada (da borda direita ate a ponta da cauda) + o passaro inteiro,
// na ordem do traco. Guardado com o comprimento acumulado, para desenhar "ate
// tal ponto" e saber onde esta a ponta da pena.
const DRAW = (() => {
  const first = [BIRD_HOME[0] + BIRD_DRAW[0][0], BIRD_HOME[1] + BIRD_DRAW[0][1]];
  const second = [BIRD_HOME[0] + BIRD_DRAW[1][0], BIRD_HOME[1] + BIRD_DRAW[1][1]];
  const step = distance(first, second);
  // Chega na cauda ja na direcao em que o traco continua.
  const handle = [
    first[0] - ((second[0] - first[0]) / step) * 34,
    first[1] - ((second[1] - first[1]) / step) * 34,
  ];
  const control = [ENTRY[0] - 46, ENTRY[1]];
  const points = [];
  const LEAD = 26;
  for (let i = 0; i < LEAD; i += 1) {
    const u = i / LEAD;
    const k = 1 - u;
    points.push([
      k * k * k * ENTRY[0] + 3 * k * k * u * control[0] + 3 * k * u * u * handle[0] + u * u * u * first[0],
      k * k * k * ENTRY[1] + 3 * k * k * u * control[1] + 3 * k * u * u * handle[1] + u * u * u * first[1],
    ]);
  }
  BIRD_DRAW.forEach(([x, y]) => points.push([BIRD_HOME[0] + x, BIRD_HOME[1] + y]));
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  return { points, lengths, total: lengths[lengths.length - 1], lead: lengths[LEAD] };
})();

// Ponto da linha a uma distancia "at" do comeco.
function drawPoint(at) {
  const { points, lengths } = DRAW;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < at) i += 1;
  const u = clamp01((at - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1));
  return [lerp(points[i - 1][0], points[i][0], u), lerp(points[i - 1][1], points[i][1], u)];
}

// Trecho da linha entre as distancias "from" e "to".
function drawSlice(from, to, dy) {
  if (to - from < 0.05) return "";
  const { points, lengths } = DRAW;
  const out = [drawPoint(from)];
  for (let i = 0; i < points.length; i += 1) {
    if (lengths[i] > from && lengths[i] < to) out.push(points[i]);
  }
  out.push(drawPoint(to));
  return polyline(dy ? out.map(([x, y]) => [x, y + dy]) : out);
}

/* ---------- O passaro em voo ---------- */
const SHOULDER_L = BIRD.WL[0]; // onde a asa de tras se prende
const SHOULDER_R = BIRD.WR[2]; // entalhe do ombro: raiz da asa da frente
const TAIL_ROOT = BIRD.TL[0];

// Quanto cada ponto acompanha a asa (0 = preso ao corpo, 1 = solto) e quanto
// ele atrasa: a ponta chega depois da raiz, e e isso que faz a asa flexionar
// em vez de girar como uma regua.
function wingMap(points, pivot, reach, fade) {
  const far = Math.max(...points.map((point) => distance(point, pivot)));
  return points.map((point, index) => {
    const d = distance(point, pivot);
    return {
      weight: smoothstep(d / reach) * (fade ? 1 - smoothstep(index / (points.length - 1)) : 1),
      lag: 0.09 * (d / far),
    };
  });
}
const WING = {
  WL: wingMap(BIRD.WL, SHOULDER_L, 6, false),
  WR: wingMap(BIRD.WR, SHOULDER_R, 10, false),
  // A borda de fuga estica como uma membrana: solta na ponta, presa no corpo.
  TE: wingMap(BIRD.TE, SHOULDER_R, 10, true),
};
const BELLY_TAIL = 7; // os ultimos pontos da barriga sao a ponta de baixo da cauda

// Altura das asas: 1 = no alto, 0 = embaixo.
function wingHeight(t) {
  for (let i = 0; i < T.beats.length; i += 1) {
    const v = t - T.beats[i];
    if (v >= 0 && v < BEAT) {
      if (v < DOWN) return 1 - wingDown(v / DOWN);
      const u = (v - DOWN) / UP;
      // Sobe e passa um pouco do ponto antes de assentar.
      return wingUp(u) + 0.1 * Math.sin(Math.PI * u) * u;
    }
  }
  return 1;
}

// Pontos do passaro no palco, por trecho, no instante t.
function birdPose(t) {
  const live = easeInOut(span(t, T.drawEnd, T.beats[0])); // sai da pose do desenho
  const stretch = easeOut(span(t, T.anticipate, T.morph)); // antecipacao
  const glide = span(t, T.releaseEnd - 0.05, T.anticipate);
  const height = wingHeight(t - 0.05);

  const center = [
    lerp(BIRD_HOME[0], 194, easeInOut(glide)),
    BIRD_HOME[1] +
      3 * Math.sin(Math.PI * span(t, T.releaseStart, T.releaseStart + 0.5)) - // afunda ao ser solto
      3.5 * live * (1 - height) - // o corpo sobe quando a asa desce
      5 * stretch,
  ];
  const scale = 1 + 0.04 * stretch;
  const tilt = 2 * live * (0.5 - height) * 2 * (1 - stretch);
  const tailSwing = 4 * live * (2 * wingHeight(t - 0.12) - 1) * (1 - stretch);

  const pose = {};
  PARTS.forEach((part) => {
    const map = WING[part];
    pose[part] = BIRD[part].map((point, index) => {
      let p = point;
      if (map) {
        const h = wingHeight(t - map[index].lag - (part === "WL" ? 0 : 0.04));
        // As asas oscilam em torno da pose de referencia (graus positivos
        // giram no sentido horario): a de tras entre 8 acima e 4 abaixo, a da
        // frente entre 10 acima e 9 abaixo. Nenhuma passa da horizontal, e a
        // da frente nao chega a deitar sobre a cauda.
        const degrees =
          part === "WL"
            ? live * lerp(-4, 8, h) + stretch * 9
            : live * lerp(9, -10, h) - stretch * 4;
        p = rotate(p, part === "WL" ? SHOULDER_L : SHOULDER_R, degrees * map[index].weight);
      } else if (part === "TL") {
        p = rotate(p, TAIL_ROOT, tailSwing * smoothstep(index / 4));
      } else if (part === "BELLY") {
        const k = index - (BIRD.BELLY.length - BELLY_TAIL);
        if (k > 0) p = rotate(p, BIRD.BELLY[BIRD.BELLY.length - BELLY_TAIL], tailSwing * smoothstep(k / 4));
      }
      p = rotate(p, [0, 0], tilt);
      return [center[0] + p[0] * scale, center[1] + p[1] * scale];
    });
  });
  return pose;
}

/* ---------- O livro ---------- */
// Linha central de cada pincelada (o meio entre os dois lados) e, por ponto,
// o vetor do meio ate o lado "a" na espessura do traco fino.
const BOOK_CENTER = {};
const BOOK_THIN = {};
const BOOK_INK_DELAY = {};
const SPINE = [190, 134]; // de onde a tinta comeca a engrossar
PARTS.forEach((part, partIndex) => {
  const { a, b } = BOOK[part];
  BOOK_CENTER[part] = a.map((point, i) => [(point[0] + b[i][0]) / 2, (point[1] + b[i][1]) / 2]);
  BOOK_THIN[part] = a.map((point, i) => {
    let dx = point[0] - b[i][0];
    let dy = point[1] - b[i][1];
    let length = Math.hypot(dx, dy);
    if (length < 0.05) {
      // Ponta da pincelada: os lados se encontram; usa a perpendicular ao traco.
      const center = BOOK_CENTER[part];
      const next = center[Math.min(i + 1, center.length - 1)];
      const prev = center[Math.max(i - 1, 0)];
      dx = -(next[1] - prev[1]);
      dy = next[0] - prev[0];
      length = Math.hypot(dx, dy) || 1;
    }
    return [(dx / length) * (LINE_WIDTH / 2), (dy / length) * (LINE_WIDTH / 2)];
  });
  // A tinta corre da lombada para fora, uma pincelada apos a outra.
  BOOK_INK_DELAY[part] = BOOK_CENTER[part].map(
    (point) => 0.02 * partIndex + 0.07 * Math.min(1, distance(point, SPINE) / 120),
  );
});

const MORPH_FROM = birdPose(T.morph);
const PIVOT_FROM = MORPH_FROM.WL[0];
const PIVOT_TO = [203, 108]; // a calha do livro: as paginas giram em torno dela
const POLAR = { WL: true, WR: true, TE: true };

// Trecho "part" a caminho do livro. u = 0 passaro, 1 livro (pode passar um
// pouco de 1: as paginas abrem alem do ponto e voltam).
function morphPart(part, u) {
  const from = MORPH_FROM[part];
  const to = BOOK_CENTER[part];
  if (part === "TL") {
    // O laco da cauda primeiro se desfaz em reta, e so entao viaja.
    const last = from.length - 1;
    const straight = from.map((_, i) => [
      lerp(from[0][0], from[last][0], i / last),
      lerp(from[0][1], from[last][1], i / last),
    ]);
    const untie = easeInOut(clamp01(u / 0.3));
    const travel = clamp01((u - 0.2) / 0.8) + Math.max(0, u - 1);
    return from.map((point, i) => [
      lerp(lerp(point[0], straight[i][0], untie), to[i][0], travel),
      lerp(lerp(point[1], straight[i][1], untie), to[i][1], travel),
    ]);
  }
  if (!POLAR[part]) {
    return from.map((point, i) => [lerp(point[0], to[i][0], u), lerp(point[1], to[i][1], u)]);
  }
  // As asas giram em torno do ombro (que vira a calha), em vez de encolher
  // em linha reta atravessando o corpo.
  const pivot = [lerp(PIVOT_FROM[0], PIVOT_TO[0], u), lerp(PIVOT_FROM[1], PIVOT_TO[1], u)];
  return from.map((point, i) => {
    const r0 = distance(point, PIVOT_FROM);
    const r1 = distance(to[i], PIVOT_TO);
    const a0 = Math.atan2(point[1] - PIVOT_FROM[1], point[0] - PIVOT_FROM[0]);
    const a1 = Math.atan2(to[i][1] - PIVOT_TO[1], to[i][0] - PIVOT_TO[0]);
    let turn = a1 - a0;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    // Perto do pivo o angulo nao quer dizer nada: ali vai em linha reta.
    const polar = smoothstep(Math.min(r0, r1) / 8);
    const r = lerp(r0, r1, u);
    const angle = a0 + turn * u;
    return [
      lerp(lerp(point[0], to[i][0], u), pivot[0] + r * Math.cos(angle), polar),
      lerp(lerp(point[1], to[i][1], u), pivot[1] + r * Math.sin(angle), polar),
    ];
  });
}

// Mantem as emendas coladas: as pontas vizinhas vao para o ponto medio entre
// elas, e os pontos proximos acompanham cada vez menos. "glue" = 1 colado.
function joinSeams(shapes, glue) {
  if (glue <= 0) return;
  SEAMS.forEach((seam) => {
    const ends = seam.map(([part, side]) => shapes[part][side === "first" ? 0 : shapes[part].length - 1]);
    const middle = [
      ends.reduce((sum, point) => sum + point[0], 0) / ends.length,
      ends.reduce((sum, point) => sum + point[1], 0) / ends.length,
    ];
    seam.forEach(([part, side], which) => {
      const points = shapes[part];
      const dx = (middle[0] - ends[which][0]) * glue;
      const dy = (middle[1] - ends[which][1]) * glue;
      const reach = Math.min(6, Math.floor(points.length / 2));
      for (let k = 0; k < reach; k += 1) {
        const index = side === "first" ? k : points.length - 1 - k;
        const pull = 1 - smoothstep(k / reach);
        points[index] = [points[index][0] + dx * pull, points[index][1] + dy * pull];
      }
    });
  });
}

function morphAmount(part, t) {
  const start = T.morph + MORPH_DELAY[part];
  const x = span(t, start, start + MORPH_TIME);
  // Passa do ponto e assenta: o peso do pouso.
  const settle = span(t, start + MORPH_TIME * 0.8, start + MORPH_TIME * 0.8 + 0.3);
  return morphEase(x) + 0.045 * Math.sin(Math.PI * settle) * (1 - settle);
}

// Contorno preenchido de uma pincelada: "ink" (por ponto, 0 a 1) vai do traco
// fino ate a pincelada da logo.
function ribbon(part, center, ink) {
  const { a, b } = BOOK[part];
  const thin = BOOK_THIN[part];
  const target = BOOK_CENTER[part];
  const left = [];
  const right = [];
  center.forEach((point, i) => {
    const w = ink(i);
    left.push([
      point[0] + lerp(thin[i][0], a[i][0] - target[i][0], w),
      point[1] + lerp(thin[i][1], a[i][1] - target[i][1], w),
    ]);
    right.push([
      point[0] + lerp(-thin[i][0], b[i][0] - target[i][0], w),
      point[1] + lerp(-thin[i][1], b[i][1] - target[i][1], w),
    ]);
  });
  return polyline(left.concat(right.reverse())) + "Z";
}

/* ---------- Fundo: velocidade das linhas de texto ---------- */
// O "vento" das asas: as linhas aceleram a cada batida, freiam na
// antecipacao e disparam na ultima batida. Guardado como distancia acumulada
// (em segundos de velocidade normal), para a posicao ser funcao do tempo.
const WIND_STEP = 1 / 120;
function windAt(t) {
  let speed = 1;
  T.beats.forEach((beat) => {
    speed += 0.35 * Math.sin(Math.PI * span(t, beat, beat + 0.3));
  });
  speed = lerp(speed, 0.3, easeOut(span(t, T.anticipate, T.morph)));
  if (t >= T.morph) speed = 3;
  return speed;
}
const WIND = (() => {
  const table = [0];
  for (let i = 1; i <= Math.round(DURATION / WIND_STEP); i += 1) {
    table.push(table[i - 1] + windAt((i - 0.5) * WIND_STEP) * WIND_STEP);
  }
  return table;
})();

/**
 * O que desenhar no instante "time" (segundos). Aceita qualquer valor: o
 * ciclo se repete sozinho.
 */
export function frameAt(time) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  const cycle = Math.floor(time / DURATION);

  let line = ""; // o traco fino (passaro, e depois as linhas centrais do livro)
  let lineWidth = LINE_WIDTH;
  let lead = ""; // o fio que liga a borda a cauda
  let ink = ""; // as pinceladas preenchidas
  let logo = 0; // a arte oficial do livro
  const nib = { x: ENTRY[0], y: ENTRY[1], opacity: 0 };

  if (t >= T.drawStart && t < T.drawEnd) {
    // A linha desenha o passaro: arranca rapido pelo fio e assenta no fim.
    const u = span(t, T.drawStart, T.drawEnd);
    const at = DRAW.total * lerp(u, easeInOut(u), 0.45);
    line = drawSlice(0, at, 0);
    const [x, y] = drawPoint(at);
    nib.x = n2(x);
    nib.y = n2(y);
    nib.opacity = 1;
  } else if (t >= T.drawEnd && t < T.morph) {
    const pose = birdPose(t);
    line = PARTS.map((part) => smoothPath(pose[part], CORNERS[part])).join("");
    const sink = pose.BELLY[BIRD.BELLY.length - 1][1] - (BIRD_HOME[1] + BIRD.BELLY[BIRD.BELLY.length - 1][1]);
    const pulled = DRAW.lead * easeOut(span(t, T.releaseStart, T.releaseEnd));
    lead = drawSlice(pulled, DRAW.lead, sink);
    const end = pose.TL[BIRD.TL.length - 1];
    nib.x = n2(end[0]);
    nib.y = n2(end[1]);
    nib.opacity = n2(1 - span(t, T.drawEnd, T.drawEnd + 0.12));
  } else if (t >= T.morph && t < T.swapEnd) {
    // Pouso: 2 unidades de afundar e voltar, depois que a forma chega.
    const land = span(t, T.morph + 0.52, T.morph + 0.84);
    const dip = 1.6 * Math.sin(Math.PI * land) * (1 - land);
    const shapes = {};
    PARTS.forEach((part) => {
      shapes[part] = morphPart(part, morphAmount(part, t)).map(([x, y]) => [x, y + dip]);
    });
    // Coladas ate uns 30% do caminho; soltas por volta de 65%.
    const progress = morphEase(span(t, T.morph + 0.07, T.morph + 0.07 + MORPH_TIME));
    joinSeams(shapes, 1 - smoothstep((progress - 0.3) / 0.35));
    const inking = t >= T.inkStart;
    lineWidth = n2(LINE_WIDTH * (1 - easeInOut(span(t, T.inkStart + 0.04, T.inkEnd - 0.06))));
    if (lineWidth > 0.05) {
      line = PARTS.map((part) => smoothPath(shapes[part], CORNERS[part])).join("");
    }
    if (inking) {
      ink = STROKES.map((part) =>
        ribbon(part, shapes[part], (i) => {
          const start = T.inkStart + BOOK_INK_DELAY[part][i];
          return easeOut(span(t, start, start + 0.3));
        }),
      ).join("");
    }
    logo = n2(span(t, T.swapStart, T.swapEnd));
  } else if (t >= T.swapEnd && t < T.bookOut) {
    logo = 1;
  } else if (t >= T.bookOut && t < T.bookGone) {
    // Saida: a tinta afina de volta ao traco, e o traco e puxado para fora
    // pela borda direita, achatando ate virar o fio por onde entrou.
    const thin = smoothstep(span(t, T.bookOut, T.bookOut + 0.24));
    const pull = easeIn(span(t, T.bookOut + 0.18, T.bookGone));
    // So comeca a achatar depois de ja estar deslizando, e chega a borda ja
    // como um fio na mesma altura por onde a linha volta.
    const flat = smoothstep((pull - 0.4) / 0.45);
    const shapes = {};
    PARTS.forEach((part) => {
      shapes[part] = BOOK_CENTER[part].map(([x, y]) => [
        x + 290 * pull,
        lerp(y, ENTRY[1], flat),
      ]);
    });
    if (thin < 1) ink = STROKES.map((part) => ribbon(part, shapes[part], () => 1 - thin)).join("");
    lineWidth = n2(LINE_WIDTH * thin);
    if (lineWidth > 0.05) {
      line = PARTS.map((part) => smoothPath(shapes[part], CORNERS[part])).join("");
    }
  }

  /* ----- A frase "Ler para ..." ----- */
  const phraseOut = easeInQuad(span(t, VERB_OUT[2], VERB_OUT[2] + 0.18));
  const letterIn = (start, index) => easeOut(span(t, start + index * LETTER_GAP, start + index * LETTER_GAP + LETTER_TIME));
  // Cada letra vem de 4 unidades a esquerda. O deslocamento ("dx") de um
  // pedaco de texto empurra tambem as letras seguintes, e por isso cada letra
  // recebe so a diferenca para a anterior.
  const lettersOf = (text, start) => {
    let previous = 0;
    return [...text].map((_, index) => {
      const k = letterIn(start, index);
      const offset = -4 * (1 - k);
      const dx = n2(offset - previous);
      previous = offset;
      return { dx, opacity: n2(k) };
    });
  };
  const phrase = {
    prefix: {
      opacity: n2(t < PREFIX_IN ? 0 : 1 - phraseOut),
      letters: lettersOf(PHRASE.prefix, PREFIX_IN),
    },
    verbs: PHRASE.verbs.map((verb, index) => {
      const leaving = easeInQuad(span(t, VERB_OUT[index], VERB_OUT[index] + (index === 2 ? 0.18 : 0.14)));
      const visible = t >= VERB_IN[index] && leaving < 1;
      return {
        opacity: visible ? n2(1 - leaving) : 0,
        shift: n2(index === 2 ? 0 : 16 * leaving),
        letters: visible ? lettersOf(verb, VERB_IN[index]) : null,
        // Sublinhado dourado: tracado da esquerda para a direita.
        underline: visible ? n2(easeOut(span(t, VERB_IN[index] + 0.16, VERB_IN[index] + 0.38))) : 0,
        underlineOpacity: visible && t > VERB_IN[index] + 0.175 ? n2(1 - leaving) : 0,
      };
    }),
  };

  /* ----- Linhas de fundo ----- */
  const windIndex = t / WIND_STEP;
  const windLow = Math.floor(windIndex);
  const wind =
    cycle * WIND[WIND.length - 1] +
    lerp(WIND[windLow], WIND[Math.min(windLow + 1, WIND.length - 1)], windIndex - windLow);
  const backdrop = {
    // Somem na ultima batida (a asa "limpa a pagina") e voltam no respiro.
    opacity: n2(t < T.morph ? 1 : t < T.backdropIn ? 1 - span(t, T.morph, T.morph + 0.45) : span(t, T.backdropIn, DURATION)),
    travel: BACKDROP.map((row) => row.speed * wind),
  };

  const wordIn = easeOutQuart(span(t, T.wordStart, T.wordStart + 0.45));
  const subIn = easeOut(span(t, T.subStart, T.subStart + 0.5));
  const nameOut = easeInQuad(span(t, T.nameOut, T.nameOut + 0.3));

  return {
    line,
    lineWidth,
    lead,
    ink,
    nib,
    logo,
    phrase,
    backdrop,
    // "ADMP BRASIL" sobe por tras da linha de base; "BIBLIOTECA" entra aberta
    // e fecha ate o espacamento da logo.
    word: { opacity: n2(wordIn * (1 - nameOut)), lift: n2(8 * (1 - wordIn)) },
    sub: { opacity: n2(subIn * (1 - nameOut)), stretch: n2(1 + 0.07 * (1 - subIn)) },
  };
}
