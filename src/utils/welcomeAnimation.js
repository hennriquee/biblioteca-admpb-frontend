/**
 * Animacao de boas-vindas do acervo publico: "da pagina ao galho".
 *
 * Uma mini historia: a logo sobe; as pinceladas do livro dela se abrem num
 * livro visto de frente, de paginas brancas; letras surgem no papel e as
 * paginas sao folheadas cada vez mais rapido; seis linhas de texto viram os
 * tracos de uma pomba esbocada a mao, que decola, sobe para longe, faz uma
 * curva inclinada vindo na nossa direcao e pousa de costas num galho, de onde
 * uma folha cai devagar, girando. No ciclo seguinte a logo sobe de novo e
 * empurra a cena do passaro para cima.
 *
 * O filme tem cara de caderno de desenho: os tracos tremem de leve ("fervem"),
 * tem segunda passada de lapis, linhas de construcao e hachura. So a logo e o
 * texto impresso das paginas sao limpos.
 *
 * Este arquivo e so a "partitura": dado um instante (em segundos), devolve o
 * que desenhar. Nao mexe na tela; quem desenha e o WelcomeScene.jsx. Assim da
 * para conferir qualquer quadro isolado.
 *
 * Tudo aqui esta em unidades do palco (SCENE.width x SCENE.height). O passaro
 * (montado em tres dimensoes) esta em welcomeBird.js; o traco de esboco, em
 * welcomeSketch.js; as pinceladas do livro da logo vem de welcomeShapes.js.
 * (As versoes anteriores continuam guardadas: welcomeClassicAnimation.js, a
 * mesma historia com o passaro antigo, e welcomeLineAnimation.js, "uma linha
 * so".)
 */
import { birdStrokes } from "./welcomeBird.js";
import { inkPath, pencilPath, smoothLine, trim, wobble } from "./welcomeSketch.js";
// (BIRD: so a quantidade de pontos de cada pincelada do livro, que e a mesma
// dos trechos do passaro antigo.)
import { BIRD, BOOK } from "./welcomeShapes.js";

export const SCENE = { width: 400, height: 240 };
export const DURATION = 14; // segundos de um ciclo completo

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
  lines: 6.5, // seis linhas do texto (grandes na tela) viram seis riscos retos...
  linesEnd: 6.62,
  bird: 6.58, // ...que se soltam da pagina e se curvam no passaro
  guides: 6.6, // as linhas de construcao sao riscadas em volta
  finish: 6.93, // os tracos de acabamento (penas de fora, segunda linha das asas)
  drawn: 7.1, // o desenho esta pronto
  fly: 7.15, // primeira batida de asa: decola
  guidesGone: 7.6, // as linhas de construcao, que ficaram no papel, se apagam
  spineOut: 6.62, // a lombada some antes (senao cortaria o passaro ao meio)
  bookOut: 6.64, // a pagina se desfaz no papel
  bookGone: 6.88,
  branch: 8.3, // o galho e desenhado da borda para a ponta
  branchEnd: 9.4,
  flare: 9.85, // empina, abre a cauda e vira de costas para pousar
  land: 10.45, // toca o galho
  folded: 11.15, // asas recolhidas, de costas
  look: 11.55, // vira a cabeca para o lado
  lookEnd: 12,
  leaf: 10.75, // a folha se solta, no retorno do galho
};
const LINE_WIDTH = 2; // traco do passaro na logo e na pagina
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
export const SPINE_PATH = polyline(OUTLINE.TL);
// A forma de cada pagina (para o papel branco e para a folha que vira).
export const PAGE_RIGHT_PATH =
  polyline([...OUTLINE.WR, ...OUTLINE.TE, ...OUTLINE.BELLY.slice(15).reverse(), ...OUTLINE.TL.slice().reverse()]) + "Z";
export const PAGE_LEFT_PATH =
  polyline([...OUTLINE.WL, ...OUTLINE.BELLY.slice(0, 15), ...OUTLINE.TL.slice().reverse()]) + "Z";

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

/* ---------- Traco de esboco ----------
   Tudo o que e desenhado a mao no filme (o contorno do livro, o galho, o
   passaro) treme de leve, e a tremida troca algumas vezes por segundo: como
   em desenho animado feito a mao, em que cada quadro e um desenho novo. O
   passaro troca 12 vezes por segundo; o cenario, 6 (mais calmo). A logo e o
   texto impresso das paginas ficam limpos: e o contraste que conta. */
const BIRD_BOIL = 12;
const SCENE_BOIL = 6;
const birdSeed = (time) => 1 + (Math.floor(time * BIRD_BOIL) % 4);
const sceneSeed = (time) => 11 + (Math.floor(time * SCENE_BOIL) % 3);

// O contorno do livro, tremido, e a segunda passada do lapis (que sobra um
// pouco nos cantos).
function bookSketch(shape, parts, seed) {
  let outline = "";
  let pencil = "";
  parts.forEach((part, index) => {
    const corners = CORNERS[part] || [];
    let start = 0;
    [...corners, shape[part].length - 1].forEach((end) => {
      const piece = shape[part].slice(start, end + 1);
      outline += smoothLine(wobble(piece, { seed, amp: 0.5, wave: 24 }));
      if (part !== "TL" && part !== "HD") pencil += pencilPath(piece, { seed: seed + 20 + index, amp: 1.1, wave: 34, over: 3.5 });
      start = end;
    });
  });
  return { outline, pencil };
}
const BOOK_OPEN = {};
const openBook = (seed) => {
  if (!BOOK_OPEN[seed]) BOOK_OPEN[seed] = bookSketch(OUTLINE, EDGES, seed);
  return BOOK_OPEN[seed];
};

// Grifo de marca-texto feito a mao: vai e volta, um pouco torto, com as
// pontas irregulares. (x de onde ate onde, y do meio da linha de texto.)
export function markPath(from, to, y, index) {
  const tilt = index % 2 ? 0.3 : -0.25;
  const go = straight([from + 0.6, y - 1.25 - tilt], [to + 1.1, y - 1.45 + tilt], 6);
  const back = straight([to + 0.2, y + 1.35 + tilt], [from - 0.9, y + 1.5 - tilt], 6);
  return smoothLine(wobble(go.concat(back), { seed: 40 + index, amp: 0.4, wave: 13 }));
}
// O fio sob o titulo da pagina, riscado a mao (duas passadas).
export function rulePath(left, y, width) {
  const line = straight([left, y], [left + width, y], 9);
  return (
    smoothLine(wobble(line, { seed: 71, amp: 0.3, wave: 17 })) +
    smoothLine(wobble(straight([left + 1.5, y + 0.9], [left + width - 9, y + 0.7], 8), { seed: 72, amp: 0.3, wave: 15 }))
  );
}

/* ---------- O voo ----------
   O passaro (utils/welcomeBird.js) e montado em tres dimensoes, e o voo
   tambem: a rota abaixo vira um caminho no espaco, e e desse caminho que
   saem a direcao do corpo e a inclinacao nas curvas. Por isso a volta e uma
   curva de verdade (ele se inclina, mostra o dorso, vem de frente, mostra o
   ventre), e nao um desenho espelhado.

   Rota: [tempo, x, y, tamanho] no palco. Decola da pagina, sobe para a
   esquerda afastando-se (fica pequeno), faz a curva vindo na nossa direcao
   (cresce), cruza para a direita e pousa no galho, ja de costas. */
const PERCH_SCALE = 0.8;
const DEPTH = 140; // quanto o tamanho "vale" em distancia
const ROUTE = [
  [T.fly, 200, 112, 0.95],
  [7.7, 146, 80, 0.7],
  [8.2, 112, 70, 0.52],
  [8.6, 80, 84, 0.7],
  [8.95, 104, 98, 0.86],
  [9.3, 152, 96, 0.92],
  [9.7, 212, 88, 0.86],
  [10.1, 250, 84, 0.82],
  [T.land, 0, 0, PERCH_SCALE], // (x e y: o ponto de pouso, preenchido adiante)
];
// A rota no espaco: [tempo, X (direita), Y (cima), Z (para longe)].
const toSpace = ([time, x, y, scale]) => [time, (x - SCENE.width / 2) / scale, (SCENE.height / 2 - y) / scale, DEPTH * (1 / scale - 1)];
let SPACE = [];
let SPACE_SPEED = [];
function planRoute() {
  SPACE = ROUTE.map(toSpace);
  SPACE_SPEED = SPACE.map((key, i) => {
    const before = SPACE[Math.max(0, i - 1)];
    const after = SPACE[Math.min(SPACE.length - 1, i + 1)];
    // Sai devagar (decolagem) e chega devagar (pouso).
    const ease = i === 0 ? 0.35 : i === SPACE.length - 1 ? 0.3 : 1;
    return [1, 2, 3].map((axis) => (ease * (after[axis] - before[axis])) / (after[0] - before[0]));
  });
}

function spaceAt(t) {
  const last = SPACE.length - 1;
  const time = Math.min(SPACE[last][0], Math.max(SPACE[0][0], t));
  let i = 0;
  while (i < last - 1 && time > SPACE[i + 1][0]) i += 1;
  const a = SPACE[i];
  const b = SPACE[i + 1];
  const dt = b[0] - a[0];
  const u = (time - a[0]) / dt;
  const u2 = u * u;
  const u3 = u2 * u;
  const h = [2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2];
  return [1, 2, 3].map(
    (axis) => h[0] * a[axis] + h[1] * dt * SPACE_SPEED[i][axis - 1] + h[2] * b[axis] + h[3] * dt * SPACE_SPEED[i + 1][axis - 1],
  );
}
// Onde o passaro esta no palco, e de que tamanho.
function routeAt(t) {
  const [x, y, z] = spaceAt(t);
  const scale = DEPTH / (DEPTH + z);
  return { x: SCENE.width / 2 + x * scale, y: SCENE.height / 2 - y * scale, scale };
}

// Batidas de asa: [inicio, duracao, ate onde a asa desce (graus)]. Tres
// fortes na decolagem; plana na curva; duas na saida dela; e duas curtas para
// frear antes do pouso. (Na decolagem ele e visto meio de costas: ali a asa
// so desce ate a horizontal, senao taparia o corpo e a cabeca; perto do
// galho tambem, para nao passar por cima dele.)
const BEATS = [
  [T.fly, 0.42, 4],
  [T.fly + 0.42, 0.4, 4],
  [T.fly + 0.82, 0.38, 0],
  [8.9, 0.4, -20],
  [9.3, 0.36, -6],
  [9.66, 0.32, -4],
  [9.98, 0.25, -6],
  [10.23, 0.22, 4],
];
const wingLow = (t) => {
  for (let i = 0; i < BEATS.length; i += 1) {
    if (t >= BEATS[i][0] && t < BEATS[i][0] + BEATS[i][1]) return BEATS[i][2];
  }
  return 0;
};
// Altura das asas: 1 = no alto, 0 = embaixo.
function wingHeight(t) {
  for (let i = 0; i < BEATS.length; i += 1) {
    const v = (t - BEATS[i][0]) / BEATS[i][1];
    if (v >= 0 && v < 1) return v < 0.38 ? 1 - wingDown(v / 0.38) : wingUp((v - 0.38) / 0.62);
  }
  return 1;
}
// Planeio: 1 enquanto ele plana (na curva), 0 enquanto bate as asas.
const gliding = (t) => smoothstep(span(t, 8.3, 8.5)) * (1 - smoothstep(span(t, 8.78, 8.93)));
// Freada: 0 em voo, 1 ao tocar o galho.
const flaring = (t) => easeInOutSine(span(t, T.flare, T.land));
// Angulo das asas (graus acima da horizontal).
function flapAt(t) {
  const beat = lerp(wingLow(t), 66, wingHeight(t));
  const glide = 19 + 2.5 * Math.sin(t * 8);
  const angle = lerp(beat, glide, gliding(t));
  // Na freada as asas trabalham mais no alto.
  return lerp(angle, 22 + 0.55 * angle, flaring(t));
}

/* ----- Direcao do corpo ao longo do voo -----
   Tirada do proprio caminho, uma vez so (tabela): para onde ele aponta (yaw),
   quanto sobe ou desce (climb) e, da rapidez com que a direcao muda, quanto
   se inclina na curva. */
const STEP = 1 / 120;
const BORN_YAW = 150; // nasce virado para a esquerda, um pouco de costas
const LAND_YAW = 418; // chega ao galho ja meio de costas (360 + 58)
const PERCH_YAW = 428; // pousado: de costas, em tres quartos (360 + 68)
let HEADING = [];
let CLIMB = [];
function planHeading() {
  const count = Math.round((T.land - T.fly) / STEP) + 1;
  const yaw = [];
  const climb = [];
  let previous = BORN_YAW;
  for (let i = 0; i < count; i += 1) {
    const t = T.fly + i * STEP;
    const a = spaceAt(t - 0.02);
    const b = spaceAt(t + 0.02);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    let angle = previous;
    if (Math.hypot(dx, dz) > 0.05) {
      angle = (Math.atan2(dz, dx) * 180) / Math.PI;
      // (Sem saltos de 360: a direcao segue de onde estava.)
      while (angle - previous > 180) angle -= 360;
      while (angle - previous < -180) angle += 360;
    }
    yaw.push(angle);
    climb.push((Math.atan2(dy, Math.hypot(dx, dz) || 1) * 180) / Math.PI);
    previous = angle;
  }
  // Alisa: o corpo nao acompanha cada tremida do caminho.
  const smooth = (list, reach) =>
    list.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = -reach; k <= reach; k += 1) {
        sum += list[Math.min(list.length - 1, Math.max(0, i + k))];
        n += 1;
      }
      return sum / n;
    });
  HEADING = smooth(smooth(yaw, 10), 8);
  CLIMB = smooth(climb, 12);
}
const tableAt = (table, t) => {
  const at = clamp01((t - T.fly) / (T.land - T.fly)) * (table.length - 1);
  const i = Math.min(table.length - 2, Math.floor(at));
  return lerp(table[i], table[i + 1], at - i);
};

// A pose do passaro em voo (ver NEUTRAL em welcomeBird.js).
function flightPose(t) {
  const { x, y, scale } = routeAt(t);
  const start = smoothstep(span(t, T.fly + 0.05, T.fly + 0.5));
  const flare = flaring(t);
  const glide = gliding(t);
  const height = wingHeight(t - 0.04);
  const flap = flapAt(t);
  // Curva: inclina para dentro, conforme a rapidez do giro (graus por segundo).
  const turning = (tableAt(HEADING, t + 0.08) - tableAt(HEADING, t - 0.08)) / 0.16;
  const roll = Math.max(-42, Math.min(42, -0.26 * turning)) * start * (1 - flare);
  // Na curva ele tambem mergulha um pouco na nossa direcao: quando vem de
  // frente, vemos o dorso e as asas abertas (e nao um risco).
  const dive = Math.min(34, 0.12 * Math.abs(turning));
  const pitch = lerp(lerp(22, 8 + 0.55 * tableAt(CLIMB, t) - dive, start), 58, flare);
  const yaw = lerp(lerp(BORN_YAW, tableAt(HEADING, t), start), LAND_YAW, flare);
  // De perfil as duas asas ficariam uma atras da outra: a de tras vai um
  // pouco mais alta, como nos desenhos de passaro em voo.
  const far = Math.max(-1, Math.min(1, -1.6 * Math.cos((yaw * Math.PI) / 180))) * (1 - flare); // > 0: a direita esta atras
  // A ponta da asa chega atrasada: verga contra o movimento.
  const speed = (flapAt(t + 0.012) - flapAt(t - 0.012)) / 0.024;
  return {
    x,
    y: y - 2.2 * (1 - height) * (1 - glide) * scale, // o corpo sobe quando a asa desce
    scale,
    yaw,
    pitch,
    roll,
    // Na curva, a asa de dentro fica mais baixa.
    flapL: flap + 0.14 * roll - 5 * far,
    flapR: flap - 0.14 * roll + 5 * far,
    // Desce com a asa esticada para a frente e sobe com ela jogada para tras.
    sweep: lerp(lerp(lerp(2, 18, height), 6, glide), -24, flare),
    bend: Math.max(-12, Math.min(14, -0.03 * speed)),
    fold: 0,
    spread: lerp(lerp(0.3, 0.8, glide), 1, flare),
    neck: -pitch * lerp(0.45, 0.82, flare), // a cabeca fica quase nivelada
    headYaw: 0,
    // Em voo ele e visto um pouco de cima: aparecem o dorso e as asas abertas
    // (de frente ou de perfil exato, elas seriam so um risco).
    tilt: 22 * start * (1 - flare),
  };
}

/* ---------- O galho ---------- */
// Vem da borda direita ate a ponta. Cada pedaco e desenhado quando o traco
// principal chega ate ele ("at" = em que ponto do desenho, 0 a 1).
const BRANCH = trace([[424, 154], [402, 150], [340, 141], [290, 138], [240, 131.5], [200, 133.5], [186, 132], [176, 126]], 50);
const BRANCH_PIVOT = [402, 150];
const BRANCH_REACH = BRANCH[0][0] - BRANCH[BRANCH.length - 1][0];
const branchY = (x) => {
  let i = 1;
  while (i < BRANCH.length - 1 && BRANCH[i][0] > x) i += 1;
  const a = BRANCH[i - 1];
  const b = BRANCH[i];
  return lerp(a[1], b[1], clamp01((a[0] - x) / (a[0] - b[0] || 1)));
};

// Folha em forma de amendoa (contorno fechado + a nervura do meio): sai de
// "base" na direcao "degrees".
function leafShape(base, degrees, length = 14, width = 3.4) {
  const rad = (degrees * Math.PI) / 180;
  const along = [Math.cos(rad), Math.sin(rad)];
  const side = [-along[1], along[0]];
  const at = (f, w) => [base[0] + along[0] * length * f + side[0] * width * w, base[1] + along[1] * length * f + side[1] * width * w];
  return {
    outline: trace([at(0, 0), at(0.22, 0.72), at(0.5, 0.95), at(0.8, 0.55), at(1.04, 0)], 9).concat(
      trace([at(1.04, 0), at(0.8, -0.6), at(0.5, -0.95), at(0.22, -0.7), at(0, 0)], 9).slice(1),
    ),
    vein: [at(0.08, 0.05), at(0.45, -0.08), at(0.84, 0.04)],
  };
}
const drawnAt = (x) => (BRANCH[0][0] - x) / BRANCH_REACH;
const TWIG_UP = [[346, branchY(346)], [338, 124], [326, 108]];
const TWIG_DOWN = [[214, branchY(214)], [206, 146], [196, 156]];
const BRANCH_INK = [
  { points: BRANCH, at: 0, take: 1, width: 2.1 },
  { points: trace(TWIG_UP, 8), at: drawnAt(346), take: 0.2, width: 1.5 },
  { points: trace(TWIG_DOWN, 8), at: drawnAt(214), take: 0.08, width: 1.4 },
];
const BRANCH_LEAVES = [
  { ...leafShape(TWIG_UP[1], -18), at: drawnAt(346) + 0.1, take: 0.16 },
  { ...leafShape(TWIG_UP[2], -112), at: drawnAt(346) + 0.2, take: 0.16 },
  { ...leafShape(TWIG_DOWN[2], 128), at: drawnAt(214) + 0.07, take: 0.09 },
  // (So depois de o traco chegar a ponta.)
  { ...leafShape(BRANCH[BRANCH.length - 1], -128), at: 0.93, take: 0.07 },
];
// Rabiscos de lapis: a sombra de baixo do galho (hachura) e uns nos da casca.
const BRANCH_HATCH = [372, 364, 357, 349, 318, 311, 304, 258, 251].map((x, index) => {
  const y = branchY(x) + 2.6;
  const long = 5.5 + (index % 3) * 1.6;
  return { points: [[x, y], [x - long * 0.62, y + long]], at: drawnAt(x) + 0.03, take: 0.05 };
}).concat([
  { points: trace([[300, branchY(300) - 2.2], [293, branchY(293) - 3.4], [286, branchY(286) - 2.4]], 5), at: drawnAt(286), take: 0.05 },
  { points: trace([[236, branchY(236) + 2.2], [230, branchY(230) + 3.2], [225, branchY(225) + 2.2]], 5), at: drawnAt(225), take: 0.05 },
]);
// A folha dourada (a unica cor do filme): pende do galho, e e ela que cai.
const GOLD_BASE = [304, branchY(304) + 0.8];
const GOLD_SHAPE = leafShape(GOLD_BASE, 98, 15, 3.8);
export const GOLD_LEAF = {
  d: smoothLine(wobble(GOLD_SHAPE.outline, { seed: 5, amp: 0.35, wave: 9 })) + smoothLine(GOLD_SHAPE.vein),
  base: GOLD_BASE,
  at: drawnAt(304),
  take: 0.16,
};
export const BRANCH_PIVOT_POINT = BRANCH_PIVOT;

// O galho ate onde ja foi desenhado ("grown" de 0 a 1): tinta, linhas finas
// (folhas) e lapis. Guarda o ultimo desenho de cada semente: depois de
// crescido, ele so muda quando a tremida troca.
const BRANCH_MEMO = {};
function branchSketch(grown, seed) {
  const key = Math.round(grown * 400);
  const memo = BRANCH_MEMO[seed];
  if (memo && memo.key === key) return memo;
  const shake = { seed, amp: 0.42, wave: 22 };
  let ink = "";
  let lines = "";
  let pencil = "";
  BRANCH_INK.forEach((part, index) => {
    const drawn = span(grown, part.at, part.at + part.take);
    if (drawn <= 0) return;
    const points = trim(part.points, drawn);
    ink += inkPath(wobble(points, shake), part.width, { thin: 0.32 });
    if (index === 0) pencil += pencilPath(points.filter((_, i) => i % 2 === 0), { seed: seed + 30, amp: 1.25, wave: 40, over: 0 });
  });
  BRANCH_LEAVES.forEach((leaf) => {
    const drawn = span(grown, leaf.at, leaf.at + leaf.take);
    if (drawn <= 0) return;
    lines += smoothLine(wobble(trim(leaf.outline, drawn), shake));
    if (drawn >= 1) lines += smoothLine(wobble(leaf.vein, shake));
  });
  BRANCH_HATCH.forEach((mark) => {
    const drawn = span(grown, mark.at, mark.at + mark.take);
    if (drawn > 0) pencil += smoothLine(wobble(trim(mark.points, drawn), { seed: seed + 30, amp: 0.3, wave: 12 }));
  });
  BRANCH_MEMO[seed] = { key, ink, lines, pencil };
  return BRANCH_MEMO[seed];
}

// O galho cede quando o passaro toca e volta amortecido (graus; negativo = a
// ponta desce).
function branchSwing(t) {
  const since = t - T.land;
  if (since <= 0 || since > 1.3) return 0;
  return -2.2 * Math.exp(-4.3 * since) * Math.sin(2 * Math.PI * 1.9 * since) * (1 - smoothstep((since - 1) / 0.3));
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

/* ---------- O pouso ----------
   Ele chega ao galho freando, ja quase de costas; ao tocar, recolhe as asas,
   termina de se ajeitar e, um pouco depois, vira a cabeca para o lado. */
const PERCH_AT = [262, branchY(262) - 10.5];
ROUTE[ROUTE.length - 1][1] = PERCH_AT[0];
ROUTE[ROUTE.length - 1][2] = PERCH_AT[1];
planRoute();
planHeading();
const LANDED = flightPose(T.land);
const PERCHED = {
  ...LANDED,
  x: PERCH_AT[0],
  y: PERCH_AT[1],
  scale: PERCH_SCALE,
  yaw: PERCH_YAW,
  pitch: 61,
  roll: 0,
  fold: 1,
  spread: 0.12,
  neck: -50,
};
function perchPose(t) {
  const settle = easeInOutSine(span(t, T.land, T.folded));
  const pose = {};
  Object.keys(PERCHED).forEach((key) => {
    pose[key] = lerp(LANDED[key], PERCHED[key], settle);
  });
  pose.fold = easeInOutSine(span(t, T.land + 0.03, T.folded - 0.04));
  // Ao tocar, o corpo afunda um pouco nas pernas e volta.
  const dip = span(t, T.land, T.land + 0.42);
  pose.y += 1.6 * Math.sin(Math.PI * dip) * (1 - dip);
  pose.pitch -= 5 * Math.sin(Math.PI * dip) * (1 - dip);
  // Olha para o lado (a cabeca de perfil).
  const look = easeInOutSine(span(t, T.look, T.lookEnd));
  pose.headYaw = 48 * look;
  pose.neck = lerp(pose.neck, -46, look);
  return pose;
}

/* ---------- O passaro desenhado ---------- */
const inkWidth = (scale) => Math.max(1.05, 1.7 * Math.sqrt(scale));
// Quais trechos ganham a segunda passada do lapis (nem todos: senao vira ruido).
const DOUBLED = { "wingL.lead": true, "wingR.lead": true, body: true };
let BIRD_MEMO = { key: "" };
function birdSketch(pose, seed) {
  const key = seed + "|" + Object.keys(pose).map((name) => n2(pose[name])).join(",");
  if (BIRD_MEMO.key === key) return BIRD_MEMO;
  const strokes = birdStrokes(pose);
  const width = inkWidth(pose.scale);
  const origin = [pose.x, pose.y];
  const shake = { seed, amp: Math.max(0.38, 0.75 * pose.scale), wave: 19, origin, scale: pose.scale };
  let ink = "";
  let pencil = "";
  strokes.forEach((stroke) => {
    const fine = stroke.part === "tail" || stroke.id.endsWith(".inner");
    // (As asas fechadas sao linhas muito juntas: mais finas, para nao pesar.)
    const slim = stroke.part.startsWith("wing") ? 1 - 0.3 * pose.fold : 1;
    ink += inkPath(wobble(stroke.points, shake), width * slim * (fine ? 0.82 : 1), { thin: fine ? 0.22 : 0.34 });
    if (DOUBLED[stroke.id] && stroke.points.length > 5) {
      pencil += pencilPath(stroke.points.filter((_, i) => i % 2 === 0), {
        seed: seed + 9, amp: 2.1 * shake.amp, wave: 30, origin, scale: pose.scale, over: 3.2 * pose.scale,
      });
    }
  });
  BIRD_MEMO = { key, ink, pencil, cover: polyline(strokes.silhouette) + "Z" };
  return BIRD_MEMO;
}

/* ---------- As linhas de texto que viram o passaro ----------
   As seis primeiras linhas da ultima pagina (vistas de perto, grandes) viram
   seis riscos retos, e cada risco se curva num dos tracos principais do
   passaro: as duas de cima viram as asas; a do meio, o corpo; as tres de
   baixo, as penas do meio da cauda. Os tracos que faltam (as outras penas e a
   segunda linha de cada asa) sao riscados em seguida, como acabamento. Em
   volta, as linhas de construcao do desenhista (eixo, oval do corpo, circulo
   da cabeca, direcao das asas), que ficam no papel e se apagam. */
const BORN = flightPose(T.fly);
const BORN_STROKES = birdStrokes(BORN, { hidden: false });
const bornStroke = (id) => BORN_STROKES.find((stroke) => stroke.id === id).points;
const NEAR_WING = BORN_STROKES.guides.near;
const FAR_WING = NEAR_WING === "wingR" ? "wingL" : "wingR";
const wingLoop = (wing) => bornStroke(wing + ".lead").concat(bornStroke(wing + ".trail").slice(1));
const MORPH_TIME = 0.34;
const MORPH = (() => {
  const camera = cameraAt(T.lines);
  const row = (index) => {
    const left = PAGE.middle + TEXT.margin + (index < 3 ? TEXT.indent : 0);
    // No meio da altura das letras minusculas.
    const y = PAGE.top + TEXT.first + index * TEXT.leading - 2.2;
    return [seenBy(camera, [left, y]), seenBy(camera, [PAGE.middle + TEXT.margin + TEXT.width, y])];
  };
  const travel = (a, b) => a.reduce((sum, point, i) => sum + distance(point, b[i]), 0);
  return [
    { to: wingLoop(FAR_WING), delay: 0.05, wing: bornStroke(FAR_WING + ".lead").length },
    { to: wingLoop(NEAR_WING), delay: 0.08, wing: bornStroke(NEAR_WING + ".lead").length },
    { to: bornStroke("body"), delay: 0 },
    { to: bornStroke("tail1"), delay: 0.03 },
    { to: bornStroke("tail2"), delay: 0.05 },
    { to: bornStroke("tail3"), delay: 0.08 },
  ].map((part, index) => {
    const [a, b] = row(index);
    const count = part.to.length;
    let from;
    if (part.wing) {
      // A asa vai ate a ponta e volta: dobrada sobre a mesma reta.
      from = straight(b, a, part.wing).concat(straight(a, b, count - part.wing + 1).slice(1));
    } else {
      // (No sentido em que os pontos viajam menos.)
      const one = straight(a, b, count);
      const other = straight(b, a, count);
      from = travel(one, part.to) < travel(other, part.to) ? one : other;
    }
    return { ...part, from, fine: index > 2 };
  });
})();
// Acabamento: [traco, quando comeca a ser riscado (depois de T.finish)].
const FINISH = [
  [bornStroke("tail0"), 0],
  [bornStroke("tail4"), 0.03],
  [bornStroke(NEAR_WING + ".inner"), 0.06],
  [bornStroke(FAR_WING + ".inner"), 0.09],
];
const BORN_SHAKE = { amp: 0.7, wave: 19, origin: [BORN.x, BORN.y], scale: BORN.scale };

function bornSketch(t, seed) {
  const shake = { ...BORN_SHAKE, seed };
  const width = inkWidth(BORN.scale);
  let ink = "";
  MORPH.forEach((part) => {
    const amount = morphEase(span(t, T.bird + part.delay, T.bird + part.delay + MORPH_TIME));
    const points = part.from.map((point, i) => mix(point, part.to[i], amount));
    ink += inkPath(wobble(points, shake), lerp(LINE_WIDTH, width * (part.fine ? 0.82 : 1), amount), { thin: 0.3, taper: amount });
  });
  FINISH.forEach(([points, delay]) => {
    const drawn = easeOut(span(t, T.finish + delay, T.finish + delay + 0.09));
    if (drawn > 0) ink += inkPath(wobble(trim(points, drawn), shake), width * 0.82, { thin: 0.22 });
  });
  return ink;
}

// Linhas de construcao: [pontos, quando comeca (depois de T.guides), duracao].
const GUIDES = (() => {
  const { beak, head, chest, tail, tipR, tipL } = BORN_STROKES.guides;
  const scale = BORN.scale;
  const axis = Math.atan2(beak[1] - tail[1], beak[0] - tail[0]);
  const beyond = (from, to, extra) => {
    const length = distance(from, to) || 1;
    return [to[0] + ((to[0] - from[0]) / length) * extra, to[1] + ((to[1] - from[1]) / length) * extra];
  };
  // Oval riscada em mais de uma volta, como quem procura a forma.
  const oval = (center, rx, ry, turns, startAngle) =>
    Array.from({ length: Math.round(22 * turns) }, (_, i) => {
      const angle = startAngle + (i / 22) * 2 * Math.PI;
      const grow = 1 + 0.07 * (i / 22);
      const x = Math.cos(angle) * rx * grow;
      const y = Math.sin(angle) * ry * grow;
      return [center[0] + x * Math.cos(axis) - y * Math.sin(axis), center[1] + x * Math.sin(axis) + y * Math.cos(axis)];
    });
  const shake = { seed: 3, amp: 0.8, wave: 15 };
  return [
    [straight(beyond(beak, tail, 16 * scale), beyond(tail, beak, 12 * scale), 8), 0, 0.1],
    [oval(chest, 27 * scale, 15 * scale, 1.3, 2.4), 0.05, 0.16],
    [oval(head, 8.5 * scale, 8 * scale, 1.25, 0.6), 0.12, 0.1],
    [straight(chest, beyond(chest, tipR, 9 * scale), 7), 0.16, 0.08],
    [straight(chest, beyond(chest, tipL, 9 * scale), 7), 0.19, 0.08],
  ].map(([points, at, take]) => [wobble(points, shake), at, take]);
})();
function guidesSketch(t) {
  let d = "";
  GUIDES.forEach(([points, at, take]) => {
    const drawn = span(t, T.guides + at, T.guides + at + take);
    if (drawn > 0) d += smoothLine(trim(points, drawn));
  });
  return d;
}

/* ---------- Riscos de movimento ---------- */
// Na decolagem: tres riscos curtos atras dele, na direcao em que sai.
const WHOOSH = (() => {
  const a = routeAt(T.fly + 0.02);
  const b = routeAt(T.fly + 0.3);
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const along = [(b.x - a.x) / length, (b.y - a.y) / length];
  const side = [-along[1], along[0]];
  return [[-16, 26, 15], [3, 34, 21], [21, 27, 13]].map(([off, back, long], index) => {
    const start = [BORN.x - along[0] * back + side[0] * off, BORN.y - along[1] * back + side[1] * off];
    return wobble(straight(start, [start[0] - along[0] * long, start[1] - along[1] * long], 4), { seed: 80 + index, amp: 0.6, wave: 10 });
  });
})();
// No pouso: tiques em leque, de cada lado dos pes.
const TOUCH = [[-13, -1, -20, -5], [-11, 4, -18, 6], [12, 0, 19, -5], [11, 5, 18, 7]].map(([x1, y1, x2, y2]) => {
  const foot = [PERCH_AT[0], branchY(PERCH_AT[0])];
  return [[foot[0] + x1, foot[1] + y1], [foot[0] + x2, foot[1] + y2]];
});
// Pousado: a sombra dele no galho, em hachura.
const PERCH_SHADE = [-9, -3, 4, 10, 16].map((off, index) => {
  const x = PERCH_AT[0] + off;
  const y = branchY(x) + 2.8;
  const long = 5 + (index % 2) * 2.2;
  return smoothLine(wobble([[x, y], [x - long * 0.3, y + long * 0.5], [x - long * 0.62, y + long]], { seed: 90 + index, amp: 0.35, wave: 8 }));
}).join("");
// Rastro: o caminho que ele acabou de fazer, em tracejado.
function trailSketch(t) {
  const points = [];
  for (let k = 7; k <= 19; k += 1) {
    const at = t - k * 0.03;
    if (at < T.fly) break;
    const { x, y } = routeAt(at);
    points.push([x, y]);
  }
  return points.length > 2 ? smoothLine(points) : "";
}

/**
 * O que desenhar no instante "time" (segundos). Aceita qualquer valor: o
 * ciclo se repete sozinho.
 */
export function frameAt(time) {
  const t = ((time % DURATION) + DURATION) % DURATION;
  const firstRun = time < DURATION;
  const boil = sceneSeed(time);

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
    outline: "", // o contorno do livro (as pinceladas, ja abertas)
    pencil: "", // a segunda passada do lapis no contorno
    pencilOpacity: 0,
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
  if (book.visible && t < T.openEnd) {
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
    // Saindo da logo o traco ainda e limpo; a mao aparece conforme ele abre.
    const drawn = bookSketch(shape, STROKES, boil);
    book.outline = open > 0.15 ? drawn.outline : posePath(shape, STROKES);
    book.pencil = drawn.pencil;
    book.pencilOpacity = n2(0.42 * smoothstep((open - 0.45) / 0.5));
    book.outlineWidth = n2(ink > 0 ? LINE_WIDTH * (1 - ink) : lerp(LINE_WIDTH, 1.5, open));
  } else if (book.visible) {
    const drawn = openBook(boil);
    book.outline = drawn.outline;
    book.pencil = drawn.pencil;
    book.pencilOpacity = 0.42;
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
  const bird = { ink: "", pencil: "", pencilOpacity: 0.4, cover: "", coverOpacity: 0, opacity: 1, swing: 0 };
  const sketch = { guides: "", guidesOpacity: 0, marks: "", marksOpacity: 0, trail: "", trailOpacity: 0 };
  const again = t < T.pushEnd + 0.06 && !firstRun; // o passaro do ciclo anterior, ainda pousado
  if (again) {
    const drawn = birdSketch(perchPose(DURATION + t), birdSeed(time));
    bird.ink = drawn.ink;
    bird.pencil = drawn.pencil;
    bird.cover = drawn.cover;
    bird.coverOpacity = 1;
  } else if (t >= T.lines && t < T.drawn) {
    bird.opacity = n2(span(t, T.lines + 0.03, T.linesEnd));
    bird.ink = bornSketch(t, birdSeed(time));
  } else if (t >= T.drawn) {
    const pose = t < T.fly ? BORN : t < T.land ? flightPose(t) : perchPose(t);
    bird.swing = n2(branchSwing(t));
    const drawn = birdSketch(pose, birdSeed(time));
    bird.ink = drawn.ink;
    bird.pencil = drawn.pencil;
    // Perto do galho, o corpo tapa o que esta atras dele.
    bird.cover = drawn.cover;
    bird.coverOpacity = n2(span(t, 9.15, 9.3));
    // (O lapis some um pouco quando ele esta longe e pequeno.)
    // (E quando ele fecha as asas: ali ja ha linhas demais juntas.)
    bird.pencilOpacity = n2(0.58 * smoothstep((pose.scale - 0.3) / 0.25) * (1 - 0.8 * pose.fold));
  }
  if (!again && t >= T.guides && t < T.guidesGone) {
    sketch.guides = guidesSketch(t);
    sketch.guidesOpacity = n2(0.36 * (1 - smoothstep(span(t, T.fly + 0.12, T.guidesGone))));
  }
  if (!again && t >= T.fly && t < T.fly + 0.42) {
    // Riscos da decolagem: aparecem um a um e somem logo.
    sketch.marks = WHOOSH.map((points, index) => smoothLine(trim(points, span(t, T.fly + 0.03 + index * 0.03, T.fly + 0.12 + index * 0.03)))).join("");
    sketch.marksOpacity = n2(0.55 * (1 - span(t, T.fly + 0.24, T.fly + 0.42)));
  } else if (!again && t >= T.land && t < T.land + 0.5) {
    sketch.marks = TOUCH.map((points) => smoothLine(trim(points, span(t, T.land, T.land + 0.08)))).join("");
    sketch.marksOpacity = n2(0.5 * (1 - span(t, T.land + 0.22, T.land + 0.5)));
  } else if (again || t >= T.folded) {
    sketch.marks = PERCH_SHADE;
    sketch.marksOpacity = again ? 0.5 : n2(0.5 * span(t, T.folded, T.folded + 0.45));
  }
  if (!again && t > T.fly + 0.2 && t < T.land) {
    // (Anda aos passos, junto com a tremida do passaro.)
    sketch.trail = trailSketch(Math.floor(t * BIRD_BOIL) / BIRD_BOIL);
    sketch.trailOpacity = n2(0.3 * span(t, T.fly + 0.2, T.fly + 0.5) * (1 - span(t, T.flare, T.land - 0.1)));
  }

  /* ----- O galho e a folha que cai ----- */
  const grown = easeInOutSine(span(t, T.branch, T.branchEnd));
  const branch = branchSketch(again ? 1 : grown, boil);
  const nature = {
    visible: t >= T.branch,
    lift: 0,
    swing: bird.swing,
    ink: branch.ink,
    lines: branch.lines,
    pencil: branch.pencil,
    gold: { drawn: n2(span(grown, GOLD_LEAF.at, GOLD_LEAF.at + GOLD_LEAF.take)), opacity: 1, ...leafFall(t - T.leaf) },
  };
  // Ciclo seguinte: a logo sobe e empurra para cima a cena do passaro pousado
  // (que sai um instante depois, como algo empurrado). A folha continua
  // caindo e some enquanto a cena sobe.
  if (again) {
    nature.visible = true;
    nature.lift = n2(-SCENE.height * pushEase(span(t, 0.06, T.pushEnd + 0.06)));
    nature.gold = { drawn: 1, opacity: n2(1 - smoothstep(span(t, 0.1, 0.75))), ...leafFall(DURATION - T.leaf + t) };
  }

  return { logo, book, bird, sketch, nature };
}
