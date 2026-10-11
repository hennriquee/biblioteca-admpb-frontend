/**
 * Animacao de boas-vindas do acervo publico: sobre uma estante desenhada a
 * lapis, um passaro chega voando, pousa, se sacode, abre as asas e os proprios
 * tracos viram o livro da logo, que sobe soltando as letras de "LEITURA" e
 * recebe o nome da biblioteca.
 *
 * Este arquivo e so a "partitura": dado um instante (em segundos), devolve o
 * que desenhar. Nao mexe na tela; quem desenha e o WelcomeScene.jsx. Assim da
 * para conferir qualquer quadro isolado.
 *
 * Coordenadas:
 * - "logo": as mesmas do viewBox da logo (2178 x 1668). O passaro e desenhado
 *   nesse espaco para os tracos poderem terminar exatamente em cima do livro.
 * - "cena": o quadro da animacao (SCENE.width x SCENE.height).
 */

export const SCENE = { width: 400, height: 240 };
export const DURATION = 11.9; // segundos de um ciclo completo

// Ponto do passaro que fica preso ao poleiro (os pes), em coordenadas da logo.
const ANCHOR = [1105, 900];
const LAND = [200, 196]; // topo da pilha de livros deitados (cena)
const BIRD_SCALE = 0.15;
const LOGO_SCALE = 0.118;
// Onde os "pes" precisam ficar para a logo terminar centralizada na cena.
const REST = [
  SCENE.width / 2 + (ANCHOR[0] - 1089) * LOGO_SCALE,
  104 + (ANCHOR[1] - 652) * LOGO_SCALE,
];
// Largura do tremido do lapis, em pixels da cena.
const WOBBLE_PX = 1.1;

// Curva do voo de chegada (cena): entra pela esquerda e desce ate o poleiro.
const FLIGHT = [
  [-52, 112],
  [82, 74],
  [188, 68],
  LAND,
];

/* ---------- Roteiro (tempos em segundos) ---------- */
const T = {
  flyStart: 0.5,
  flare: 2.1, // para de bater as asas e "freia" com elas para cima
  land: 2.7,
  hop: 3.12,
  shakeStart: 3.55,
  shakeEnd: 4.3,
  crouchStart: 4.35,
  jump: 4.82, // salta abrindo as asas; daqui em diante so sobe
  openEnd: 5.3,
  morphStart: 5.2, // as asas comecam a virar paginas
  morphEnd: 6.75,
  riseEnd: 6.7,
  inkStart: 6.55, // o traco engrossa ate a espessura da logo...
  inkEnd: 6.9, // ...a logo de verdade aparece junto...
  pencilGone: 7.05, // ...e o lapis sai logo em seguida
  lettersGone: 7.3,
  wordStart: 7.25,
  subStart: 7.7,
  outStart: 10.7,
  outEnd: 11.4,
};

const FLAP_HZ = 3.3;

/* ---------- Poses ----------
   Cada traco e uma lista de pontos; todas as poses tem a MESMA quantidade de
   pontos por traco, e por isso uma pose pode virar a outra. Ponto repetido =
   canto vivo. Os tracos e o que viram no livro:
   - wingA (asa de perto)        -> pagina esquerda
   - wingB (asa de longe)        -> arco de cima da pagina direita
   - back  (costas / asa direita)-> borda de baixo da pagina direita
   - belly (peito e cauda)       -> capa, por baixo do livro */
const POSES = {
  flyUp: {
    wingA: [[1145, 628], [1142, 540], [1112, 448], [1060, 366], [1060, 366], [985, 268], [900, 186], [900, 186], [885, 410], [910, 640]],
    wingB: [[1200, 612], [1218, 520], [1212, 430], [1185, 350], [1148, 284], [1105, 232], [1060, 198]],
    back: [[1300, 560], [1180, 556], [1050, 588], [920, 628], [800, 660]],
    belly: [[1390, 620], [1330, 672], [1230, 702], [1120, 712], [1010, 702], [900, 686], [800, 664], [800, 664], [655, 688]],
    head: [1350, 585, 62],
    beak: [[1406, 566], [1478, 596], [1404, 612]],
    eye: [1366, 574],
  },
  // Meio da batida: a asa varre para tras.
  flyMid: {
    wingA: [[1145, 634], [1100, 584], [1030, 546], [946, 528], [946, 528], [852, 530], [762, 556], [762, 556], [836, 622], [910, 648]],
    wingB: [[1200, 626], [1190, 580], [1162, 546], [1122, 526], [1082, 515], [1042, 512], [1004, 516]],
    back: [[1300, 554], [1180, 548], [1050, 579], [920, 620], [800, 655]],
    belly: [[1390, 614], [1330, 666], [1230, 696], [1120, 706], [1010, 697], [900, 681], [800, 659], [800, 659], [652, 676]],
    head: [1350, 579, 62],
    beak: [[1406, 560], [1478, 590], [1404, 606]],
    eye: [1366, 568],
  },
  flyDown: {
    wingA: [[1145, 640], [1162, 726], [1146, 816], [1100, 896], [1100, 896], [1025, 978], [940, 1036], [940, 1036], [900, 850], [905, 655]],
    wingB: [[1200, 640], [1222, 716], [1218, 796], [1194, 866], [1162, 922], [1126, 962], [1090, 984]],
    back: [[1300, 548], [1180, 540], [1050, 570], [920, 612], [800, 650]],
    belly: [[1390, 608], [1330, 660], [1230, 690], [1120, 700], [1010, 692], [900, 676], [800, 654], [800, 654], [650, 664]],
    head: [1350, 573, 62],
    beak: [[1406, 554], [1478, 584], [1404, 600]],
    eye: [1366, 562],
  },
  stand: {
    wingA: [[1196, 572], [1154, 542], [1102, 532], [1052, 542], [1052, 542], [952, 640], [852, 800], [852, 800], [992, 786], [1122, 700]],
    wingB: [[1184, 582], [1152, 562], [1112, 557], [1072, 572], [1002, 652], [932, 742], [882, 786]],
    back: [[1192, 482], [1122, 522], [1032, 622], [952, 722], [892, 786]],
    belly: [[1292, 502], [1302, 582], [1272, 682], [1202, 770], [1112, 816], [1002, 818], [902, 796], [902, 796], [792, 842]],
    head: [1252, 440, 78],
    beak: [[1324, 420], [1402, 450], [1324, 470]],
    eye: [1272, 426],
  },
  // Asas abertas, corpo ainda de perfil. "back" passa a ser a borda de baixo
  // da asa direita (e depois, do lado direito do livro).
  open: {
    wingA: [[1150, 548], [1100, 430], [1016, 342], [932, 290], [862, 284], [600, 300], [300, 372], [300, 372], [622, 502], [1010, 690]],
    wingB: [[1215, 600], [1300, 492], [1430, 404], [1580, 360], [1730, 368], [1860, 406], [1970, 468]],
    back: [[1232, 664], [1352, 574], [1512, 514], [1702, 488], [1932, 510]],
    belly: [[1292, 492], [1302, 572], [1272, 672], [1202, 760], [1112, 806], [1002, 808], [902, 786], [902, 786], [792, 832]],
    head: [1262, 380, 78],
    beak: [[1334, 360], [1412, 390], [1334, 410]],
    eye: [1282, 366],
  },
  book: {
    wingA: [[1215, 500], [1150, 395], [1040, 325], [910, 300], [910, 300], [580, 410], [250, 520], [250, 520], [600, 610], [885, 820]],
    wingB: [[1035, 740], [1150, 625], [1300, 520], [1480, 478], [1640, 500], [1790, 575], [1910, 645]],
    back: [[975, 870], [1100, 795], [1300, 788], [1470, 835], [1635, 895]],
    belly: [[430, 636], [640, 700], [820, 810], [920, 905], [1000, 925], [1350, 965], [1690, 1002], [1690, 1002], [2005, 692]],
  },
};

// Meio do caminho do peito/cauda ate a capa: um arco aberto e comprido. Sem
// esta parada o traco se embolava no meio da troca.
const BELLY_MID = [[600, 640], [740, 716], [870, 796], [970, 856], [1090, 888], [1310, 914], [1550, 930], [1550, 930], [1810, 764]];
// Para onde a cabeca encolhe quando as asas viram paginas: o encontro das asas.
const NECK = [1180, 520];

// Pernas dobradas e pes de tres dedos. "top" e a altura em que saem do corpo:
// no ar o corpo esta mais alto, e as pernas esticam ate o poleiro.
function legsPath(top) {
  const knee = Math.round(lerp(top, 900, 0.52));
  return (
    "M1088 " + top + "L1074 " + knee + "L1090 900M1090 900L1052 903M1090 900L1128 905M1090 900L1097 914" +
    "M1146 " + (top - 4) + "L1134 " + (knee - 2) + "L1150 900M1150 900L1112 903M1150 900L1188 905M1150 900L1157 914"
  );
}

export const STROKES = ["wingA", "wingB", "back", "belly"];

// A estante onde o passaro pousa (coordenadas da cena), traco por traco, na
// ordem em que e desenhada: a tabua, a pilha de livros deitados do meio (o
// poleiro) e os livros em pe dos lados. As medidas sao tortas de proposito.
export const SHELF = [
  "M74 223.5C128 221.6 172 224.8 212 223S282 221.4 322 223.2",
  "M167.5 222.6L168.4 213.8L236.2 214.3L235.6 222.8",
  "M173.2 213.6L173.8 205.2L231.3 205.7L230.7 213.9M179 209.6L226 210",
  "M169.6 205L170.3 196.6L228.4 197L227.8 205.4",
  "M97.6 222.8L98.3 186.2L109.8 185.7L110.3 222.6M99 192.5L109.6 192.2",
  "M111.4 222.7L111.9 192.4L121.6 192.8L121.8 222.9",
  "M122.9 222.6L123.4 179.8L135.9 180.3L136.2 222.8M124 187L135.6 187.3M124 215.5L135.8 215.2",
  "M137.4 222.9L137.6 196.3L145.9 196L146.2 222.7",
  "M240.2 222.8L240.6 190.4L251.3 190L251.6 222.6M241.4 197L251 196.7",
  "M252.9 222.7L253.3 183.2L266.2 183.7L266.4 222.9M254 210.2L266 210.5",
  "M267.6 222.8L267.9 194.3L276.9 194.6L277.2 222.6",
  "M280.4 222.9L290.1 188.6L300.4 191.8L291.6 223.1",
];

// Letras que sobem do livro e formam um arco: "LEITURA".
export const LETTERS = "LEITURA".split("");

/* ---------- Matematica basica ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
// 0 antes de "from", 1 depois de "to", linear no meio.
const span = (t, from, to) => clamp01((t - from) / (to - from));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// Passa um pouco do ponto e volta ("overshoot").
const easeOutBack = (t, c = 1.2) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);

function mixPoints(a, b, t) {
  return a.map((point, i) => [lerp(point[0], b[i][0], t), lerp(point[1], b[i][1], t)]);
}

// a -> mid -> b, conforme t vai de 0 a 1.
function mixPoints3(a, mid, b, t) {
  return t < 0.5 ? mixPoints(a, mid, t * 2) : mixPoints(mid, b, (t - 0.5) * 2);
}

function mixPose(a, b, t) {
  return {
    wingA: mixPoints(a.wingA, b.wingA, t),
    wingB: mixPoints(a.wingB, b.wingB, t),
    back: mixPoints(a.back, b.back, t),
    belly: mixPoints(a.belly, b.belly, t),
    head: a.head.map((v, i) => lerp(v, b.head[i], t)),
    beak: mixPoints(a.beak, b.beak, t),
    eye: [lerp(a.eye[0], b.eye[0], t), lerp(a.eye[1], b.eye[1], t)],
  };
}

// Afasta os pontos de um centro (penas armadas na sacudida).
function puff(points, center, amount) {
  return points.map(([x, y]) => [
    center[0] + (x - center[0]) * (1 + amount),
    center[1] + (y - center[1]) * (1 + amount),
  ]);
}

const BODY_CENTER = [1090, 660];
POSES.fluff = {
  ...POSES.stand,
  wingA: puff(POSES.stand.wingA, BODY_CENTER, 0.07),
  back: puff(POSES.stand.back, BODY_CENTER, 0.1),
  belly: puff(POSES.stand.belly, BODY_CENTER, 0.1),
  head: [POSES.stand.head[0] - 6, POSES.stand.head[1] + 20, 82],
  beak: POSES.stand.beak.map(([x, y]) => [x - 6, y + 20]),
  eye: [POSES.stand.eye[0] - 6, POSES.stand.eye[1] + 20],
};

function bezierPoint(points, u) {
  const [p0, p1, p2, p3] = points;
  const k = 1 - u;
  const a = k * k * k;
  const b = 3 * k * k * u;
  const c = 3 * k * u * u;
  const d = u * u * u;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

// Numero "aleatorio" que e sempre o mesmo para a mesma entrada (0 a 1).
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Tremido de desenho a mao: desloca um pouco cada ponto. Muda a cada "boil"
// (algumas vezes por segundo), como numa animacao desenhada quadro a quadro.
function wobble(points, seed, amount) {
  let last = null;
  let lastOffset = [0, 0];
  return points.map((point, i) => {
    // Ponto repetido (canto vivo) treme junto, para o canto nao abrir.
    if (last && last[0] === point[0] && last[1] === point[1]) {
      return [point[0] + lastOffset[0], point[1] + lastOffset[1]];
    }
    last = point;
    lastOffset = [
      (hash(seed + i * 7.3) - 0.5) * 2 * amount,
      (hash(seed + i * 7.3 + 91.7) - 0.5) * 2 * amount,
    ];
    return [point[0] + lastOffset[0], point[1] + lastOffset[1]];
  });
}

const n1 = (v) => Math.round(v * 10) / 10;

function curveTo(p0, p1, p2, p3) {
  return (
    "C" + n1(p1[0] + (p2[0] - p0[0]) / 6) + " " + n1(p1[1] + (p2[1] - p0[1]) / 6) +
    " " + n1(p2[0] - (p3[0] - p1[0]) / 6) + " " + n1(p2[1] - (p3[1] - p1[1]) / 6) +
    " " + n1(p2[0]) + " " + n1(p2[1])
  );
}

// Liga os pontos com uma curva suave (Catmull-Rom -> curvas de Bezier).
function smoothPath(points) {
  let d = "M" + n1(points[0][0]) + " " + n1(points[0][1]);
  for (let i = 0; i < points.length - 1; i += 1) {
    d += curveTo(points[i - 1] || points[i], points[i], points[i + 1], points[i + 2] || points[i + 1]);
  }
  return d;
}

// Igual, mas fechando a forma (cabeca e rascunho).
function closedPath(points) {
  const n = points.length;
  const at = (i) => points[((i % n) + n) % n];
  let d = "M" + n1(points[0][0]) + " " + n1(points[0][1]);
  for (let i = 0; i < n; i += 1) d += curveTo(at(i - 1), at(i), at(i + 1), at(i + 2));
  return d + "Z";
}

function ellipsePoints(cx, cy, rx, ry, tilt = 0) {
  const points = [];
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    points.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return points;
}

function polyline(points) {
  return points.map((p, i) => (i ? "L" : "M") + n1(p[0]) + " " + n1(p[1])).join("");
}

// Hachura: risquinhos de sombra dentro da asa de perto. No passaro parecem
// penas; quando a asa vira pagina, parecem o sombreado do papel.
function hatchPath(wing, seed, amount) {
  let d = "";
  [0.22, 0.4, 0.58, 0.76].forEach((f, i) => {
    const top = [lerp(wing[4][0], wing[6][0], f), lerp(wing[4][1], wing[6][1], f)];
    const bottom = [lerp(wing[9][0], wing[7][0], f), lerp(wing[9][1], wing[7][1], f)];
    d += polyline(
      wobble(
        [
          [lerp(top[0], bottom[0], 0.3), lerp(top[1], bottom[1], 0.3)],
          [lerp(top[0], bottom[0], 0.72), lerp(top[1], bottom[1], 0.72)],
        ],
        seed + i * 31,
        amount,
      ),
    );
  });
  return d;
}

/* ---------- Pose do passaro em cada instante ---------- */
function flyingPose(t) {
  // Batida desigual: desce rapido (40% do tempo) e sobe mais devagar.
  const phase = (((t - T.flyStart) * FLAP_HZ) % 1 + 1) % 1;
  let down = phase < 0.4 ? easeInOut(phase / 0.4) : 1 - easeInOut((phase - 0.4) / 0.6);
  // Chegando: para de bater e segura as asas no alto, freando.
  down *= 1 - easeInOut(span(t, T.flare, T.flare + 0.3));
  return down < 0.5
    ? mixPose(POSES.flyUp, POSES.flyMid, down * 2)
    : mixPose(POSES.flyMid, POSES.flyDown, (down - 0.5) * 2);
}

function poseAt(t) {
  // So fecha as asas depois de tocar o poleiro.
  if (t < T.land + 0.36) {
    const landing = span(t, T.land, T.land + 0.36);
    return landing > 0 ? mixPose(flyingPose(t), POSES.stand, easeInOut(landing)) : flyingPose(t);
  }

  const shake = span(t, T.shakeStart, T.shakeEnd);
  if (t < T.jump) {
    return shake > 0 && shake < 1
      ? mixPose(POSES.stand, POSES.fluff, Math.sin(shake * Math.PI))
      : POSES.stand;
  }

  // Abre as asas (com um pouco de "passou do ponto e voltou")...
  const opened = mixPose(POSES.stand, POSES.open, easeOutBack(easeInOut(span(t, T.jump, T.openEnd)), 0.9));
  if (t < T.morphStart) return opened;

  // ...e vira livro: as asas vao na frente, o corpo segue logo atras.
  const wings = easeInOut(span(t, T.morphStart, T.morphEnd - 0.15));
  const body = easeInOut(span(t, T.morphStart + 0.2, T.morphEnd));
  // A cabeca encolhe rapido para o encontro das asas, em vez de so sumir.
  const tuck = easeInOut(span(t, T.morphStart, T.morphStart + 0.22));
  const toSpine = ([x, y]) => [lerp(x, NECK[0], tuck), lerp(y, NECK[1], tuck)];
  return {
    wingA: mixPoints(opened.wingA, POSES.book.wingA, wings),
    wingB: mixPoints(opened.wingB, POSES.book.wingB, wings),
    back: mixPoints(opened.back, POSES.book.back, body),
    belly: mixPoints3(opened.belly, BELLY_MID, POSES.book.belly, body),
    head: [...toSpine(opened.head), opened.head[2] * (1 - tuck)],
    beak: opened.beak.map(toSpine),
    eye: toSpine(opened.eye),
  };
}

/* ---------- Posicao, giro e tamanho do passaro (cena) ---------- */
function rigAt(t) {
  const rig = { x: LAND[0], y: LAND[1], rot: 0, sx: BIRD_SCALE, sy: BIRD_SCALE };

  if (t < T.land) {
    // Quase constante no comeco, desacelerando para pousar.
    const u = 1 - Math.pow(1 - span(t, T.flyStart, T.land), 1.6);
    const [x, y] = bezierPoint(FLIGHT, u);
    const [x2, y2] = bezierPoint(FLIGHT, Math.min(1, u + 0.02));
    const scale = lerp(0.09, BIRD_SCALE, u);
    // Inclina acompanhando o voo e empina (freia) antes de pousar.
    const heading = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    const flare = easeInOut(span(t, T.flare, T.flare + 0.3));
    const beat = Math.sin((t - T.flyStart) * FLAP_HZ * Math.PI * 2);
    rig.x = x;
    rig.y = y + beat * 2 * (1 - flare);
    rig.rot = lerp(Math.max(-24, Math.min(20, heading * 0.45)), -24, flare);
    rig.sx = scale;
    rig.sy = scale;
    return rig;
  }

  // Pouso: chega empinado, endireita, amassa e volta como uma mola (a mola
  // comeca do zero, para nao dar um tranco no instante do toque).
  const sinceLanding = t - T.land;
  rig.rot = -24 * (1 - easeOut(span(t, T.land, T.land + 0.22)));
  if (sinceLanding < 0.8) {
    const spring = Math.exp(-sinceLanding * 6) * Math.sin(sinceLanding * 17);
    rig.sy *= 1 - 0.22 * spring;
    rig.sx *= 1 + 0.11 * spring;
  }

  // Um pulinho antes de se sacudir.
  const hop = span(t, T.hop, T.hop + 0.26);
  if (hop > 0 && hop < 1) rig.y -= Math.sin(hop * Math.PI) * 6;

  // Sacudida: o corpo gira rapido para um lado e para o outro.
  const shake = span(t, T.shakeStart, T.shakeEnd);
  if (shake > 0 && shake < 1) {
    const strength = Math.sin(shake * Math.PI);
    rig.rot += Math.sin((t - T.shakeStart) * 7 * Math.PI * 2) * 11 * strength;
    rig.sx *= 1 + 0.05 * strength;
  }

  // Abaixa, segura um instante...
  const crouch = easeInOut(span(t, T.crouchStart, T.crouchStart + 0.26)) * (1 - easeOut(span(t, T.jump, T.jump + 0.16)));
  rig.sy *= 1 - 0.25 * crouch;
  rig.sx *= 1 + 0.1 * crouch;

  // ...e salta: estica no impulso e sobe sem parar ate o lugar da logo.
  const stretch = span(t, T.jump, T.jump + 0.42);
  if (stretch > 0 && stretch < 1) rig.sy *= 1 + 0.09 * Math.sin(stretch * Math.PI);
  const rise = easeInOut(span(t, T.jump, T.riseEnd));
  rig.x = lerp(rig.x, REST[0], rise);
  rig.y = lerp(rig.y, REST[1], rise);
  const scale = lerp(1, LOGO_SCALE / BIRD_SCALE, rise);
  rig.sx *= scale;
  rig.sy *= scale;

  // Parado no fim: flutua de leve.
  if (t > T.riseEnd) {
    const float = easeInOut(span(t, T.riseEnd, T.riseEnd + 0.8));
    rig.y += Math.sin((t - T.riseEnd) * 1.7) * 1.6 * float;
  }
  return rig;
}

function rigTransform(rig, rot) {
  return (
    "translate(" + n1(rig.x) + " " + n1(rig.y) + ") rotate(" + n1(rot) + ") scale(" +
    rig.sx.toFixed(4) + " " + rig.sy.toFixed(4) + ") translate(" + -ANCHOR[0] + " " + -ANCHOR[1] + ")"
  );
}

/**
 * O que desenhar no instante "time" (segundos). Aceita qualquer valor: o
 * ciclo se repete sozinho.
 */
export function frameAt(time) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  // "Boil": o tremido troca ~8 vezes por segundo.
  const boil = Math.floor(time * 8);
  const rig = rigAt(t);

  const pencil = 1 - easeInOut(span(t, T.inkStart + 0.2, T.pencilGone));
  const shake = span(t, T.shakeStart, T.shakeEnd);
  const shakeOn = shake > 0 && shake < 1 ? Math.sin(shake * Math.PI) : 0;
  const morph = span(t, T.morphStart, T.morphEnd);

  // O passaro so e calculado enquanto o lapis aparece (depois e so a logo).
  let bird = null;
  if (pencil > 0) {
    const pose = poseAt(t);
    // Tremido em pixels: mais forte na sacudida (as penas arrepiam), mais
    // calmo quando ja e livro.
    const amount = (WOBBLE_PX * (1 + 1.5 * shakeOn) * lerp(1, 0.55, morph)) / rig.sx;
    const strokes = {};
    const sketch = {};
    STROKES.forEach((name, index) => {
      strokes[name] = smoothPath(wobble(pose[name], boil * 13.1 + index * 101, amount));
      // Segunda passada do lapis, mais clara e um pouco fora do lugar.
      sketch[name] = smoothPath(wobble(pose[name], boil * 17.7 + index * 53 + 400, amount * 2.1));
    });
    bird = {
      strokes,
      sketch,
      head: closedPath(
        wobble(ellipsePoints(pose.head[0], pose.head[1], pose.head[2], pose.head[2]), boil * 3.7 + 700, amount * 0.55),
      ),
      hatch: hatchPath(pose.wingA, boil * 9.1 + 1200, amount * 0.8),
      beak: polyline(wobble(pose.beak, boil * 5.3 + 900, amount * 0.6)),
      eye: { cx: n1(pose.eye[0]), cy: n1(pose.eye[1]) },
    };
  }

  // As pernas aparecem ja na freada, esticadas para o poleiro, e somem no
  // instante do salto (senao ficavam soltas no ar).
  const perched = span(t, T.flare + 0.2, T.flare + 0.42) * (1 - span(t, T.jump - 0.06, T.jump + 0.03));
  const legTop = Math.round(lerp(716, 814, easeInOut(span(t, T.land, T.land + 0.3))));
  const draftOpacity = 0.2 * span(t, T.land + 0.25, T.land + 0.6) * (1 - span(t, T.crouchStart, T.jump));
  const wordIn = easeOut(span(t, T.wordStart, T.wordStart + 0.6));
  const subIn = easeOut(span(t, T.subStart, T.subStart + 0.55));

  // Rascunho: as formas simples (ovo e bola) com que se comeca a desenhar um
  // passaro, bem claras, enquanto ele esta pousado.
  const draftAmount = (WOBBLE_PX * 1.6) / rig.sx;
  const draft =
    draftOpacity > 0
      ? closedPath(wobble(ellipsePoints(1070, 668, 250, 150, -0.7), boil * 2.3 + 1500, draftAmount)) +
        closedPath(wobble(ellipsePoints(1254, 442, 104, 100), boil * 2.9 + 1600, draftAmount))
      : "";

  return {
    bird,
    draft,
    rig: rigTransform(rig, rig.rot),
    // As pernas ficam plantadas na sacudida: acompanham o corpo, mas nao giram
    // com ele. No pouso giram junto (o passaro chega empinado).
    legsRig: rigTransform(rig, t < T.shakeStart ? rig.rot : 0),
    legs: legsPath(legTop),
    // O traco engrossa antes de dar lugar a logo, como passar tinta no lapis.
    pencilWidth: n1(lerp(2, 2.6, easeInOut(span(t, T.inkStart, T.inkEnd)))),
    opacity: {
      all: 1 - easeInOut(span(t, T.outStart, T.outEnd)),
      pencil,
      bits: 1 - span(t, T.morphStart + 0.04, T.morphStart + 0.22),
      // A hachura some antes de a logo aparecer (ela nao existe na logo).
      hatch: 1 - span(t, T.morphEnd - 0.65, T.morphEnd - 0.35),
      legs: perched,
      draft: draftOpacity,
      // A logo de verdade entra enquanto o lapis sai (as duas trocas se cruzam).
      logo: easeInOut(span(t, T.inkStart + 0.05, T.inkEnd)),
      word: wordIn,
      sub: subIn,
      // A estante some (como apagada) quando o livro sobe, para dar lugar ao nome.
      shelf: 0.6 * (1 - easeInOut(span(t, T.jump + 0.35, T.jump + 1.15))),
    },
    wordLift: n1((1 - wordIn) * 46),
    subLift: n1((1 - subIn) * 40),
    // Estante: quanto de cada traco ja foi desenhado (0 a 1), um apos o outro.
    shelf: SHELF.map((_, index) => n1(easeOut(span(t, 0.05 + index * 0.075, 0.48 + index * 0.075)) * 100) / 100),
    // A estante tambem "treme", mais devagar e bem pouco.
    shelfJitter: Math.floor(time * 4) % 2 ? "translate(0.35 -0.25)" : "translate(-0.3 0.25)",
    // Letras de "LEITURA": nascem pequenas no meio do livro, sobem e abrem num
    // arco acima dele. Somem juntas, antes de o nome da biblioteca entrar.
    letters: LETTERS.map((_, index) => {
      const born = T.morphStart + 0.85 + index * 0.05;
      const up = easeOut(span(t, born, born + 0.75));
      const side = index - (LETTERS.length - 1) / 2;
      const visible = span(t, born, born + 0.2) * (1 - easeInOut(span(t, T.lettersGone - 0.35, T.lettersGone)));
      return {
        x: n1(lerp(SCENE.width / 2 + side * 15, SCENE.width / 2 + side * 22, up)),
        y: n1(lerp(92, 36 + side * side * 2.3, up)),
        rot: n1(side * 5.5 * up),
        scale: n1(lerp(0.4, 1, up) * 100) / 100,
        opacity: n1(visible * 0.8 * 100) / 100,
      };
    }),
  };
}
