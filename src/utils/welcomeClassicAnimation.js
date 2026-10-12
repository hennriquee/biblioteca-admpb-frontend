/**
 * BACKUP (12/10/2026): roteiro da animacao "da pagina ao galho" como estava
 * antes de o passaro ser redesenhado em estilo de esboco. Quem desenha este
 * roteiro e o components/WelcomeSceneClassic.jsx.
 *
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
 * que desenhar. Nao mexe na tela; quem desenha e o WelcomeSceneClassic.jsx. Assim da
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
   Cada item de SPREADS e uma "abertura" do livro (pagina esquerda e direita).
   - page: pagina de texto corrido, vista de perto: titulo no alto, capitular
     (a primeira letra, grande), paragrafo e um trecho grifado com marca-texto.
     O texto passa rapido demais para ser lido; o que fica e o grifo.
   - sprig: uma folhinha desenhada
   A ultima pagina e especial: as seis primeiras linhas dela viram os seis
   tracos do passaro.
*/
const ORANGE = "#f2a35e";
const GREEN = "#c5d86d";
// As paginas abaixo foram compostas medindo a fonte de verdade: quebra de
// linha na largura da pagina, hifen no fim da linha e justificacao so pelo
// espaco entre as palavras. Em cada linha: [texto, espaco extra entre
// palavras]; em cada grifo: [linha, de onde, ate onde], em unidades a partir
// do comeco da linha. Ao mudar um texto, confira no navegador se as linhas
// continuam cabendo e se os grifos cobrem palavras inteiras.
const FIRST = {
  head: "Uma vida de leitura",
  cap: "N",
  color: ORANGE,
  // ocupacao natural das linhas: 78% 93% 92% 92% 89% 96% 88% 94% 92% 92% 98% -
  lines: [
    ["ão deixe que a pressa", 0],
    ["roube o seu tempo de lei-", 1.12],
    ["tura. Quem lê com calma", 1.54],
    ["descobre que cada página guarda", 2.03],
    ["uma conversa antiga, e que uma", 0],
    ["vida de leitura se constrói devagar,", 0.79],
    ["linha por linha, dia após dia. Há", 2.22],
    ["livros que pedem silêncio e outros", 1.19],
    ["que pedem companhia; todos pe-", 2.14],
    ["dem atenção. Volte ao trecho que", 1.78],
    ["marcou, leia outra vez em voz baixa", 0.3],
    ["e deixe que as palavras façam o seu", 0],
  ],
  marks: [[2, 16.2, 82], [4, 81.6, 97], [5, -1, 109]],
};
const EDIFY = {
  head: "Ler para edificar",
  cap: "A",
  color: GREEN,
  // ocupacao natural das linhas: 89% 89% 94% 93% 93% 93% 98% 82% 85% 81% 97% -
  lines: [
    ["té bem pouco tempo, ler", 2.16],
    ["era um gesto raro e pre-", 1.78],
    ["cioso. Os livros passavam", 1.49],
    ["de mão em mão, e cada leitor dei-", 1.09],
    ["xava neles um pouco de si. Lemos", 1.29],
    ["para edificar: para que a mente se", 1.23],
    ["renove e o coração aprenda a ouvir.", 0.3],
    ["Um bom livro não termina na", 0],
    ["última página; ele continua em", 0],
    ["quem o leu, nas escolhas, nas", 0],
    ["conversas e no modo de olhar para", 0.58],
    ["as pessoas ao redor. É assim que a", 0],
  ],
  marks: [[4, 86.9, 109], [5, -1, 109], [6, -1, 21.7]],
};
const REACH = {
  head: "Ler para alcançar",
  cap: "L",
  color: ORANGE,
  // ocupacao natural das linhas: 94% 96% 99% 78% 95% 92% 90% 91% 96% 100% 96% -
  lines: [
    ["er é também um modo de", 0.93],
    ["chegar mais longe. Há pa-", 0.79],
    ["lavras que atravessam ma-", 0.24],
    ["res e séculos para encontrar", 0],
    ["alguém no momento certo. Lemos", 1.44],
    ["para alcançar vidas para Cristo, e", 1.64],
    ["por isso cada livro emprestado é", 2.21],
    ["uma semente lançada. Não sabe-", 0],
    ["mos onde ela vai cair, nem quando", 0.8],
    ["vai brotar; sabemos apenas que vale", 0.08],
    ["a pena semear com alegria, um lei-", 0.64],
    ["tor de cada vez, uma página depois", 0],
  ],
  marks: [[1, -1, 58.7], [4, 86.9, 109], [5, -1, 102.6]],
};
const PRAISE = {
  head: "Ler para louvar",
  cap: "E",
  color: GREEN,
  // ocupacao natural das linhas: 97% 80% 100% 100% 85% 89% 89% 90% 88% 99% 91% -
  lines: [
    ["ntre uma página e outra, o", 0.47],
    ["leitor para, levanta os", 0],
    ["olhos e agradece. Toda boa", 0.08],
    ["leitura termina em gratidão, porque", 0.09],
    ["nos lembra de quem somos e a", 0],
    ["quem pertencemos. Lemos para", 0],
    ["que Deus seja louvado nos cora-", 0],
    ["ções, e não há fim mais alto para", 1.55],
    ["um livro. Quando a última linha", 0],
    ["chega, fica o silêncio de quem ouviu", 0.13],
    ["algo verdadeiro e deseja guardar", 0],
    ["isso por toda a vida, e repartir com", 0],
  ],
  marks: [[1, 33.5, 65.8], [2, -1, 52.8], [5, 59.7, 97], [6, -1, 97.3], [7, -1, 16]],
};
const LAST = {
  head: "Uma vida de leitura",
  cap: "U",
  color: ORANGE,
  // ocupacao natural das linhas: 91% 91% 78% 89% 96% 77% 97% 92% 94% 93% -
  lines: [
    ["ma vida de leitura ganha", 1.81],
    ["asas quando o que se leu", 1.53],
    ["sai da página e vai ao", 0],
    ["encontro de quem precisa ouvir.", 0],
    ["Página por página, linha por linha,", 0.93],
    ["palavra por palavra, o leitor", 0],
    ["aprende a levantar voo. E o que era", 0.49],
    ["tinta sobre o papel passa a morar", 1.45],
    ["em quem leu, e segue adiante com", 1.01],
    ["ele, para onde ele for, como quem", 1.24],
    ["leva consigo uma boa notícia.", 0],
  ],
  marks: [],
};
const TEXTS = [FIRST, EDIFY, REACH, PRAISE];
const LAST_TEXT = LAST;
// De perto so se ve a pagina direita; por isso so ela tem texto.
const FLIPS = 12;
export const SPREADS = Array.from({ length: FLIPS + 1 }, (_, index) => ({
  left: index === 0 ? { sprig: true } : {},
  right: { page: index === FLIPS ? LAST_TEXT : TEXTS[index % TEXTS.length] },
}));
// Quantas linhas e grifos a primeira pagina tem (surgem um a um).
export const FIRST_PAGE = { lines: TEXTS[0].lines.length, marks: TEXTS[0].marks.length };
// Onde o texto fica dentro da pagina (a partir da borda de dentro e do topo).
export const TEXT = { margin: 12, width: 108, indent: 27, first: 42, leading: 10.4, head: 25, size: 6.4 };
// Quantas linhas da ultima pagina viram tracos do passaro.
export const CLOSING_LINES = 6;
/* ---------- Roteiro (tempos em segundos) ---------- */
const T = {
  pushEnd: 1.1, // a logo termina de subir (empurrando a cena anterior)
  settle: 1.35,
  nameOut: 1.8, // o nome some; o livro comeca a se abrir
  thin: 1.82, // a tinta afina ate virar traco...
  open: 2, // ...e so entao as pinceladas viram o contorno do livro aberto
  openEnd: 2.7,
  paper: 2.45, // o branco das paginas entra
  closeIn: 2.5, // o livro vem ate a tela: a pagina cobre tudo
  close: 3.15,
  write: 2.9, // as letras surgem na pagina quando ela ja cobre a tela
  written: 3.85,
  // Cada virada de folha: [inicio, duracao]. Tres lentas, depois acelera.
  flips: [
    [3.95, 0.55],
    [4.62, 0.42],
    [5.16, 0.3],
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
  lines: 6.5, // seis linhas do texto (grandes na tela) viram seis tracos retos...
  linesEnd: 6.62,
  bird: 6.58, // ...que se soltam da pagina e se curvam no passaro
  fly: 7.07, // primeira batida de asa: decola
  spineOut: 6.62, // a lombada some antes (senao cortaria o passaro ao meio)
  bookOut: 6.64, // a pagina se desfaz no papel
  bookGone: 6.88,
  turn: 7.97, // meia-volta, no ponto mais longe
  turnEnd: 8.22,
  branch: 7.82, // o galho e desenhado da borda para a ponta
  branchEnd: 8.82,
  flare: 9.37, // empina para pousar
  land: 9.62, // toca o galho
  perched: 9.86, // pousado de perfil, asas recolhidas
  turn3d: 9.94, // gira o corpo ate dar as costas
  folded: 10.5,
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

/* ---------- A camera ----------
   De longe, o livro inteiro; de perto, a pagina direita cobre o palco todo
   (nenhuma borda do livro aparece), um pouco inclinada, como um livro na
   mao, e a camera desce devagar pelo texto. */
const CLOSE = { zoom: 3.6, x: 266, y: 91, drift: 9, turn: -7 };
function cameraAt(t) {
  const near = easeInOut(span(t, T.closeIn, T.close));
  return {
    zoom: lerp(1, CLOSE.zoom, near),
    x: lerp(PAGE.middle, CLOSE.x, near),
    y: lerp((PAGE.top + PAGE.bottom) / 2, CLOSE.y + CLOSE.drift * span(t, T.close, T.lines), near),
    turn: CLOSE.turn * near,
  };
}
// Onde um ponto do livro aparece no palco, visto por essa camera.
function seenBy(camera, point) {
  const [x, y] = rotate([(point[0] - camera.x) * camera.zoom, (point[1] - camera.y) * camera.zoom], [0, 0], camera.turn);
  return [SCENE.width / 2 + x, SCENE.height / 2 + y];
}

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
   As seis primeiras linhas da ultima pagina (vistas de perto, grandes) viram
   seis tracos retos, e cada traco se curva num trecho do passaro: as de cima
   viram as asas; as do meio, a cabeca e a borda de fuga; as de baixo, a
   barriga e a cauda. */
const LINE_OF = { WL: 0, WR: 1, HD: 2, TE: 3, BELLY: 4, TL: 5 };
const MORPH_DELAY = { BELLY: 0, HD: 0.03, WL: 0.06, WR: 0.08, TE: 0.08, TL: 0.11 };
const MORPH_TIME = 0.38;

const LINES_POSE = (() => {
  const camera = cameraAt(T.lines);
  const row = (part) => {
    const index = LINE_OF[part];
    const left = PAGE.middle + TEXT.margin + (index < 3 ? TEXT.indent : 0);
    // No meio da altura das letras minusculas.
    const y = PAGE.top + TEXT.first + index * TEXT.leading - 2.2;
    return { from: seenBy(camera, [left, y]), to: seenBy(camera, [PAGE.middle + TEXT.margin + TEXT.width, y]) };
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
})();
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

/* ---------- O passaro pousado: de perfil e de costas ----------
   Poses desenhadas a mao, com os mesmos trechos do passaro em voo (por isso
   uma vira a outra). Ele pousa de perfil, recolhendo as asas, e entao gira o
   corpo ate dar as costas: o corpo (uma gota) quase nao muda, e o que conta
   o giro sao os detalhes: o bico encurta ate virar uma pontinha, a cauda vem
   de tras para o centro e as asas deslizam do flanco para o dorso.
   Coordenadas a partir do ponto em que o corpo cruza o galho. */
const PERCH_SCALE = 0.44;
const PERCH_AT = [266, branchY(266) - 0.5];

// --- De perfil (virado para a direita): as curvas do desenho ---
const BEAK_TOP = [19, -84];
const BEAK_TIP = [32, -79];
const BEAK_LOW = [19, -74];
const THROAT = [15, -68];
const NAPE = [-5, -66];
const TAIL_TIP = [-27, 45];
const WING_TOP = [4, -50]; // onde a asa fechada comeca, no ombro
const WING_END = [-9, 5]; // a ponta da asa fechada, sobre a cauda
const SIDE = {
  dome: [NAPE, [-9, -78], [-3, -90], [8, -94], [16, -90], BEAK_TOP], // da nuca, por cima, ate o bico
  front: [THROAT, [24, -52], [26, -30], [18, -8], [4, 10], [-12, 27], TAIL_TIP], // peito, barriga e baixo da cauda
  back: [NAPE, [-15, -50], [-21, -28], [-23, -6], [-25, 18], TAIL_TIP], // dorso
  tailBack: [TAIL_TIP, [-23, 31], [-19, 17]], // volta um pouco pela cauda
  wingUp: [WING_TOP, [-6, -38], [-12, -16], WING_END], // borda de cima da asa fechada
  wingLow: [WING_END, [4, -14], [9, -34], WING_TOP], // borda de baixo
  tailMid: [TAIL_TIP, [-18, 25], WING_END], // o meio da cauda, ate a ponta da asa
};
const dorsal = trace(SIDE.back, 17).concat(trace(SIDE.tailBack, 12).slice(1));
// 1) Com os trechos na ordem do voo (para ele recolher as asas ao pousar): a
// barriga vira o peito, a cabeca vira a cabeca, a asa da frente fecha sobre o
// flanco e a de tras deita no dorso.
const PROFILE_FOLD = {
  BELLY: trace([BEAK_TIP, BEAK_LOW, ...SIDE.front], BIRD.BELLY.length),
  HD: trace([...SIDE.dome, BEAK_TIP], BIRD.HD.length),
  WL: dorsal,
  WR: trace(SIDE.wingUp, BIRD.WR.length),
  TE: trace(SIDE.wingLow, BIRD.TE.length),
  TL: trace([...SIDE.wingLow.slice().reverse(), ...SIDE.tailMid.slice().reverse().slice(1)], BIRD.TL.length),
};
// 2) O MESMO desenho, com os trechos na ordem que serve ao giro (cada trecho
// tem o seu par na pose de costas).
const PROFILE_TURN = {
  BELLY: trace(SIDE.dome, BIRD.BELLY.length),
  HD: straight(BEAK_TOP, BEAK_TIP, 5).concat(straight(BEAK_TIP, BEAK_LOW, 4).slice(1)),
  WL: dorsal,
  WR: trace([BEAK_LOW, ...SIDE.front], BIRD.WR.length),
  TE: trace([...SIDE.tailMid, ...SIDE.wingLow.slice(1)], BIRD.TE.length),
  TL: trace(SIDE.wingUp, BIRD.TL.length),
};

// --- De costas ---
const NECK_R = [12, -63];
const NECK_L = [-12, -63];
const BACK_VIEW = {
  // A cabeca redonda, vista por tras.
  BELLY: trace([NECK_L, [-15, -76], [-9, -89], [0, -93], [9, -89], [15, -76], NECK_R], BIRD.BELLY.length),
  // So a pontinha do bico: a cabeca fica levemente virada, e isso ajuda a ler
  // um passaro (ele continua de costas).
  HD: straight([14.5, -82], [22, -77.5], 5).concat(straight([22, -77.5], [15.5, -73.5], 4).slice(1)),
  // Lado esquerdo: ombro, flanco e a borda esquerda da cauda, ate a ponta.
  WL: trace([NECK_L, [-23, -51], [-27, -28], [-21, -5], [-12, 14], [-6, 32], [0, 47]], 17).concat(
    trace([[0, 47], [-1, 30], [-4, 12]], 12).slice(1),
  ),
  // Lado direito, igual.
  WR: trace([NECK_R, [23, -51], [27, -28], [21, -5], [12, 14], [6, 32], [0, 47]], BIRD.WR.length),
  // Da ponta da cauda sobe pelo meio e desenha a borda da asa direita...
  TE: trace([[0, 47], [1, 22], [5, 4], [9, -16], [6, -36], [0, -47]], BIRD.TE.length),
  // ...e a borda da asa esquerda: as duas juntas fazem o "V" do dorso.
  TL: trace([[0, -47], [-6, -36], [-9, -16], [-5, 4]], BIRD.TL.length),
};
const onBranch = (shape) => {
  const pose = {};
  PARTS.forEach((part) => {
    pose[part] = shape[part].map(([x, y]) => [PERCH_AT[0] + x * PERCH_SCALE, PERCH_AT[1] + y * PERCH_SCALE]);
  });
  return pose;
};
const PROFILE_A = onBranch(PROFILE_FOLD);
const PROFILE_B = onBranch(PROFILE_TURN);
const PERCHED = onBranch(BACK_VIEW);
const LANDING = flightPose(T.land);
const PERCHED_PATH = posePath(PERCHED);
const PERCH_STROKE = 1.7; // o mesmo peso do galho

/**
 * O que desenhar no instante "time" (segundos). Aceita qualquer valor: o
 * ciclo se repete sozinho.
 */
export function frameAt(time) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  const firstRun = time < DURATION;

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
  const leaving = easeInQuad(span(t, T.bookOut, T.bookGone));
  const flipsStarted = T.flips.filter(([start]) => t >= start).length;
  const flipsDone = T.flips.filter(([start, length]) => t >= start + length).length;
  const book = {
    visible: t >= T.thin && t < T.bookGone,
    opacity: n2(1 - leaving),

    ink: "", // as pinceladas da logo, afinando
    outline: OUTLINE_PATH, // o contorno do livro (as pinceladas, ja abertas)
    outlineWidth: 1.5,
    spine: n2(t < T.openEnd ? 0 : 1 - span(t, T.spineOut, T.spineOut + 0.18)),
    paper: n2(span(t, T.paper, T.paper + 0.3)), // o branco das paginas
    left: flipsDone, // qual abertura esta a mostra de cada lado
    right: flipsStarted,
    camera: (({ zoom, x, y, turn }) => ({ zoom: n2(zoom), x: n2(x), y: n2(y), turn: n2(turn) }))(cameraAt(t)),
    // Primeira pagina: quanto do texto ja surgiu, e a folhinha sendo desenhada.
    written: n2(span(t, T.write, T.written)),
    sprig: n2(easeOut(span(t, T.openEnd, T.openEnd + 0.4))),
    // As linhas viram tinta: o texto some e o traco reto assume.
    closing: n2(1 - span(t, T.lines, T.linesEnd - 0.04)),
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
    birdOpacity = n2(span(t, T.lines + 0.03, T.linesEnd));
    bird = posePath(
      mixPose(LINES_POSE, TAKEOFF, (part) => morphEase(span(t, T.bird + MORPH_DELAY[part], T.bird + MORPH_DELAY[part] + MORPH_TIME))),
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
    // Pousa de perfil recolhendo as asas; depois gira o corpo ate dar as costas.
    swing = branchSwing(t);
    const fold = easeOut(span(t, T.land, T.perched));
    const turn = easeInOutSine(span(t, T.turn3d, T.folded));
    birdWidth = PERCH_STROKE;
    if (turn >= 1 && !swing) {
      perch = PERCHED_PATH;
    } else {
      let pose = PROFILE_B;
      if (fold < 1) {
        pose = mixPose(LANDING, PROFILE_A, fold);
      } else if (turn > 0) {
        // No meio do giro o corpo e visto em tres quartos: um pouco mais
        // estreito. E ele da um pequeno impulso para se virar.
        const mid = Math.sin(Math.PI * turn);
        pose = mixPose(PROFILE_B, PERCHED, turn);
        PARTS.forEach((part) => {
          pose[part] = pose[part].map(([x, y]) => [
            PERCH_AT[0] + (x - PERCH_AT[0]) * (1 - 0.1 * mid),
            y - 1.2 * mid * clamp01((PERCH_AT[1] - y) / 30),
          ]);
        });
      }
      // (Pousado, ele balanca junto com o galho.)
      if (swing) {
        const swayed = {};
        PARTS.forEach((part) => { swayed[part] = pose[part].map((point) => rotate(point, BRANCH_PIVOT, swing)); });
        pose = swayed;
      }
      bird = posePath(pose);
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
