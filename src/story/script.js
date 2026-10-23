import * as THREE from "three";
import { clamp, easeOut, keys, lerp, noise1, rng, seg, smooth, spring } from "./kit.js";
import { BOOK } from "./books.js";

/**
 * O roteiro da animacao da sugestao (segundos). Tudo e uma conta do instante:
 * posePile() poe cada livro onde ele deve estar em "t".
 *
 * Numa pagina em branco, livros comecam a ser jogados no chao: os primeiros
 * um a um, de perto (tranco, poeira); depois cada vez mais, uma chuva de
 * livros, e a camera vai se afastando. Eles se espalham pelo chao (a base) e
 * vao se amontoando, uns por cima dos outros, numa montanha de livros que
 * afina ate sobrar um so, la em cima. A camera se afasta devagar, para
 * contemplar a montanha; entao a pagina vira para a esquerda (tudo aquilo
 * estava desenhado numa pagina) e, na pagina seguinte, em branco, os livros
 * comecam a cair de novo.
 */
export const T = {
  // Os cinco primeiros, um a um, de perto.
  first: [0.6, 1.1, 1.52, 1.9, 2.25],
  // O resto da base espalhada pelo chao.
  base: [2.55, 3.95],
  // A montanha, camada por camada.
  pile: [4.05, 10.2],
  // O ultimo, o do topo (sozinho, com uma pausa antes).
  top: 10.7,
  // A pagina vira.
  turn: 16.0,
  turnEnd: 18.3,
  end: 18.55,
};
export const DURATION = T.end;

const GRAVITY = 6.5;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- camera

// [alvo x, y, z, distancia, azimute, elevacao] (angulos em radianos; azimute
// 0 = olhando do +z para a pilha).
const SHOTS = [
  [0, [0.3, 0.05, 0.9, 0.95, 0.33, 0.15]],
  [2.4, [0.24, 0.06, 0.72, 1.2, 0.37, 0.2]],
  [4.2, [0.08, 0.14, 0.32, 1.95, 0.42, 0.24]],
  [7.0, [0.0, 0.26, 0.08, 2.3, 0.5, 0.16]],
  [10.2, [0.0, 0.4, 0.0, 2.35, 0.56, 0.09]],
  [11.0, [0.0, 0.43, 0.0, 2.25, 0.6, 0.06]],
  // A contemplacao: afasta devagar, gira um pouco e fica mais baixa
  // (a montanha parece ainda maior).
  [T.turnEnd, [0.0, 0.4, 0.0, 3.15, 0.84, 0.0]],
];
const FOV = 36;

/** Onde a camera esta em "t" (sem os trancos). */
export function cameraAt(t) {
  const [tx, ty, tz, dist, az, el] = keys(t, SHOTS);
  const target = v3(tx, ty, tz);
  const pos = v3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist).add(target);
  return { pos, target, dist };
}

// ---------------------------------------------------------------- a pilha

/** Gira o ponto (x, z) em volta do eixo y, como rotation.y do three. */
function rotY(x, z, a) {
  return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
}

const TONES = [0.05, 0.05, 0.05, 0.12, 0.12, 0.2, 0.2, 0.3, 0.42, 0.58];

function bookSpec(rand, { w, l, t } = {}) {
  return {
    w: w ?? lerp(0.15, 0.185, rand()),
    l: l ?? lerp(0.215, 0.255, rand()),
    t: t ?? lerp(0.026, 0.05, rand()),
    tone: TONES[Math.floor(rand() * TONES.length)],
  };
}

/**
 * O "chao" que cada livro encontra: a altura do que ja caiu em cada ponto
 * (grade de 1,5 cm). settle() assenta um livro ali (inclinado conforme o
 * que esta embaixo) e o marca na grade.
 */
function makeGround() {
  const CELL = 0.015;
  const HALF = 1.6;
  const N = Math.ceil((2 * HALF) / CELL);
  const heights = new Float32Array(N * N);
  const index = (x, z) => {
    const i = Math.floor((x + HALF) / CELL);
    const j = Math.floor((z + HALF) / CELL);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  };
  const at = (x, z) => {
    const k = index(x, z);
    return k < 0 ? 0 : heights[k];
  };

  /**
   * Onde o livro fica no ponto (x, z), girado "yaw": apoiado nos pontos mais
   * altos do que esta embaixo (inclina conforme eles); "lean" garante uma
   * inclinacao minima para "out" (a encosta), como livro escorregando monte
   * abaixo. "tilt" = inclinacao maxima. Devolve centro, giro e a base.
   */
  function settle(spec, x, z, yaw, { lean = 0, out = null, tilt = 0.45 } = {}) {
    const { w, l, t } = spec;
    const points = [];
    for (const fu of [-0.45, -0.2, 0, 0.2, 0.45]) {
      for (const fv of [-0.45, -0.22, 0, 0.22, 0.45]) {
        const u = fu * w;
        const v = fv * l;
        const [dx, dz] = rotY(u, v, yaw);
        points.push([u, v, at(x + dx, z + dz)]);
      }
    }
    // Inclinacao: entre o ponto mais alto de cada metade (como um livro que
    // cai e assenta nos calos mais altos).
    const slope = (axis) => {
      let lo = null;
      let hi = null;
      for (const p of points) {
        if (p[axis] <= 0 && (!lo || p[2] > lo[2])) lo = p;
        if (p[axis] >= 0 && (!hi || p[2] > hi[2])) hi = p;
      }
      const d = hi[axis] - lo[axis];
      return Math.abs(d) < 1e-6 ? 0 : (hi[2] - lo[2]) / d;
    };
    let b = slope(0);
    let c = slope(1);
    if (out) {
      // A encosta: desce para fora (sem somar com o que o apoio ja inclina).
      const [ou, ov] = rotY(out[0], out[1], -yaw);
      const down = -(b * ou + c * ov);
      if (down < lean) {
        b -= (lean - down) * ou;
        c -= (lean - down) * ov;
      }
    }
    b = clamp(b, -tilt, tilt);
    c = clamp(c, -tilt, tilt);
    let y0 = 0;
    for (const [u, v, h] of points) y0 = Math.max(y0, h - b * u - c * v);
    // A face de baixo e o plano y0 + b*u + c*v (no giro do livro).
    const normal = v3(-b, 1, -c).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(UP, normal));
    const [nx, nz] = rotY(normal.x, normal.z, yaw);
    const center = v3(x + (nx * t) / 2, y0 + (normal.y * t) / 2, z + (nz * t) / 2);
    // Marca o livro na grade (a face de cima).
    const reach = Math.hypot(w, l) / 2;
    const thick = t / normal.y;
    for (let gz = z - reach; gz <= z + reach; gz += CELL) {
      for (let gx = x - reach; gx <= x + reach; gx += CELL) {
        const [u, v] = rotY(gx - x, gz - z, -yaw);
        if (Math.abs(u) > w / 2 || Math.abs(v) > l / 2) continue;
        const k = index(gx, gz);
        if (k >= 0) heights[k] = Math.max(heights[k], y0 + b * u + c * v + thick);
      }
    }
    return { P: center, Q: q, bottom: y0 };
  }

  return { at, settle };
}

/**
 * Monta a pilha (sempre a mesma: sorteio com semente): onde cada livro fica,
 * em que ordem chega, de onde vem e quando cai.
 */
function buildPlan() {
  const rand = rng(2024);
  const ground = makeGround();
  const books = [];
  const place = (spec, x, z, yaw, options, extra = {}) => {
    const rest = ground.settle(spec, x, z, yaw, options);
    const b = { ...spec, ...extra, ...rest, yaw };
    books.push(b);
    return b;
  };

  // 1. A base espalhada pelo chao, em volta de onde a montanha vai subir.
  const spread = [];
  const freeSpot = () => {
    for (let k = 0; k < 400; k += 1) {
      const r = lerp(0.74, 1.22, rand());
      const a = rand() * Math.PI * 2;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (spread.every((g) => Math.hypot(g.P.x - x, g.P.z - z) > 0.3)) return [x, z];
    }
    return [0, 1.2];
  };
  const putGround = (spot = freeSpot(), yaw = rand() * Math.PI * 2) => {
    const b = place(bookSpec(rand), spot[0], spot[1], yaw, {}, { onGround: true });
    spread.push(b);
    return b;
  };
  const putOn = (below) => place(bookSpec(rand), below.P.x + (rand() - 0.5) * 0.06, below.P.z + (rand() - 0.5) * 0.06, below.yaw + (rand() - 0.5) * 1.4);
  // Os cinco primeiros, bem na frente da camera (o quarto cai em cima do
  // primeiro): [x, z], giro.
  const g0 = putGround([0.3, 0.88], 0.25);
  putGround([0.0, 0.74], -0.5);
  putGround([0.62, 1.0], 0.9);
  putOn(g0);
  putGround([0.12, 1.17], -0.15);
  const firstCount = books.length;
  // O resto: no chao, e alguns por cima de outros.
  for (let i = 0; i < 12; i += 1) putGround();
  for (let i = 0; i < 5; i += 1) putOn(spread[5 + Math.floor(rand() * (spread.length - 5))]);
  const baseCount = books.length;

  // 2. A montanha: camadas que vao fechando ate um livro so. O contorno
  // (raio em cada altura) e o de um morro - base larga, encosta que fica
  // mais em pe perto do topo - com a borda irregular. Nas camadas largas, os
  // livros ficam em volta (inclinados para fora, como quem escorrega monte
  // abaixo) e alguns no meio; mais em cima, tres, dois, um.
  const H = 0.95;
  const R0 = 0.7;
  const ridge = (a) => 1 + 0.1 * Math.sin(3 * a + 1.3) + 0.07 * Math.sin(5 * a + 0.4);
  const layers = [];
  let level = 0;
  for (let k = 0; k < 80; k += 1) {
    const R = R0 * Math.pow(Math.max(0, 1 - level / H), 1.35);
    if (R < 0.095) break;
    const t = lerp(0.028, 0.046, rand());
    const phase = rand() * Math.PI * 2;
    const layer = [];
    // (Mais deitados perto do topo.)
    const lean = () => lerp(0.12, 0.42, rand()) * clamp(R / 0.45);
    const ring = (r, n, spin) => {
      for (let j = 0; j < n; j += 1) {
        const a = phase + ((j + (rand() - 0.5) * 0.5) / n) * Math.PI * 2;
        const rr = r * ridge(a) + (rand() - 0.5) * 0.04;
        const yaw = a + Math.PI / 2 + (rand() - 0.5) * spin;
        layer.push(place(bookSpec(rand, { t }), Math.sin(a) * rr, Math.cos(a) * rr, yaw, { lean: lean(), out: [Math.sin(a), Math.cos(a)] }));
      }
    };
    if (R >= 0.3) {
      const r = R - 0.085;
      // Quantos cabem sem as pontas de dentro se encavalarem demais.
      const fit = Math.floor(Math.PI / Math.atan(0.132 / (r - 0.0925)));
      ring(r, clamp(Math.round((2 * Math.PI * r) / 0.26), 3, Math.max(3, fit)), 0.8);
      // E alguns no meio, para nao ficar oco.
      const inner = r - 0.24;
      const middle = inner > 0.12 ? 2 : inner > 0 ? 1 : 0;
      for (let j = 0; j < middle; j += 1) {
        const a = rand() * Math.PI * 2;
        const d = rand() * Math.max(0, inner);
        layer.push(place(bookSpec(rand, { t }), Math.sin(a) * d, Math.cos(a) * d, rand() * Math.PI * 2, {}, { core: true }));
      }
    } else if (R >= 0.19) {
      ring(R - 0.1, 3, 0.9);
    } else if (R >= 0.12) {
      ring(0.07, 2, 0.6);
    } else {
      layer.push(place(bookSpec(rand, { t, w: lerp(0.15, 0.17, rand()), l: lerp(0.21, 0.24, rand()) }), (rand() - 0.5) * 0.03, (rand() - 0.5) * 0.03, phase, { tilt: 0.25 }));
    }
    layers.push(layer);
    // A proxima camada comeca em cima desta.
    level = layer.reduce((sum, b) => sum + b.bottom + b.t, 0) / layer.length;
  }
  // O ultimo, sozinho la em cima.
  const top = place(bookSpec(rand, { w: 0.165, l: 0.235, t: 0.04 }), 0.004, -0.006, 0.5, { tilt: 0.15 }, { top: true });

  // 3. Quando cada um cai. Os cinco primeiros nos tempos de T.first; o resto
  // da base num intervalo que acelera; a montanha camada por camada (cada
  // camada so comeca quando a de baixo terminou); o do topo em T.top.
  for (let i = 0; i < firstCount; i += 1) books[i].tl = T.first[i];
  const rest = books.slice(firstCount, baseCount);
  rest.forEach((b, i) => {
    const u = (i + 0.5) / rest.length;
    b.tl = lerp(T.base[0], T.base[1], Math.pow(u, 0.8));
  });
  const weights = layers.map((layer) => 0.05 + 0.03 * layer.length);
  const total = weights.reduce((a, b) => a + b, 0);
  let clock = T.pile[0];
  layers.forEach((layer, k) => {
    const span = ((T.pile[1] - T.pile[0]) * weights[k]) / total;
    // Ordem embaralhada dentro da camada (os do meio primeiro).
    const order = layer.map((b) => ({ b, key: b.core ? -1 : rand() }));
    order.sort((a, b) => a.key - b.key);
    order.forEach(({ b }, i) => {
      b.tl = clock + span * ((i + 0.6) / layer.length);
    });
    clock += span;
  });
  top.tl = T.top;

  // 4. De onde cada um vem: de fora da tela, num arco, girando.
  books.forEach((b, i) => {
    b.id = 1 + ((3 * i) % 234);
    b.scale = v3(b.w / BOOK.w, b.t / BOOK.t, b.l / BOOK.l);
    const first = i < firstCount;
    // Direcao em que ele chega (e escorrega um pouco depois do tranco).
    let travel;
    if (first) {
      // Os primeiros entram pelos lados da tela, vindos de um pouco mais
      // longe (nao passam rente a camera).
      const side = i % 2 ? 1 : -1;
      travel = v3(-side, 0, 0.3 + (rand() - 0.5) * 0.2).normalize();
    } else {
      const out = Math.atan2(b.P.x, b.P.z) + (rand() - 0.5) * 1.6;
      travel = v3(-Math.sin(out), 0, -Math.cos(out));
    }
    b.travel = travel;
    b.slide = b.onGround ? (first ? 0.04 : 0.025) : 0.012;
    b.impact = b.P.clone().addScaledVector(travel, -b.slide);
    b.spinAxis = v3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    b.spin = (0.5 + rand()) * Math.PI * 2 * (rand() < 0.5 ? -1 : 1);
    b.bounce = first || b.top ? 0.016 : b.onGround ? 0.01 : 0.005;
    b.dust = first || b.top;
    // (Os primeiros vem baixo, de lado, e atravessam a tela; os outros vem
    // do alto; o do topo, bem do alto.)
    let reach = first ? 0.9 : lerp(1.1, 1.7, rand());
    let lift = first ? 0.3 : b.top ? 2.0 : lerp(0.9, 1.5, rand());
    for (let k = 0; k < 12; k += 1) {
      b.S = b.impact.clone().addScaledVector(travel, -reach).add(v3(0, lift, 0));
      b.F = clamp(0.38 + 0.2 * b.S.distanceTo(b.impact), first ? 0.7 : 0.55, first ? 0.8 : 1.15);
      if (!onScreen(b.S, b.tl - b.F)) break;
      reach *= first ? 1.12 : 1.25;
      lift *= first ? 1.04 : 1.2;
    }
    // Velocidade de saida para cair exatamente no lugar (arco com gravidade;
    // os primeiros, num arco mais raso, atravessando a tela).
    b.g = first ? 2.4 : GRAVITY;
    b.v0 = b.impact.clone().sub(b.S).multiplyScalar(1 / b.F).add(v3(0, (b.g * b.F) / 2, 0));
  });

  return { books, firstCount, baseCount, layers: layers.length, peak: top.P.y };
}

const projected = new THREE.Vector3();
const probe = new THREE.PerspectiveCamera(FOV, 1.6, 0.05, 60);
/** O ponto aparece na tela em "t"? (com folga; tela larga ou alta) */
function onScreen(point, t) {
  const { pos, target } = cameraAt(t);
  probe.position.copy(pos);
  probe.lookAt(target);
  probe.updateMatrixWorld();
  for (const aspect of [0.9, 1.9]) {
    probe.aspect = aspect;
    probe.updateProjectionMatrix();
    projected.copy(point).project(probe);
    if (projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15) return true;
  }
  return false;
}

export const PLAN = buildPlan();

// ---------------------------------------------------------------- poses

const tmpQ = new THREE.Quaternion();
const spinQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();

function poseBooks(w, t) {
  const { books } = w;
  PLAN.books.forEach((b, i) => {
    const age = t - b.tl;
    if (age < -b.F) {
      books.hideBook(i);
      return;
    }
    let inAir = false;
    if (age < 0) {
      // No ar: arco com gravidade, girando ate chegar certinho. (So faz
      // sombra quando ja esta perto do chao.)
      const tau = age + b.F;
      tmpP.copy(b.S).addScaledVector(b.v0, tau);
      tmpP.y -= (b.g * tau * tau) / 2;
      const u = tau / b.F;
      spinQ.setFromAxisAngle(b.spinAxis, b.spin * Math.pow(1 - u, 1.6));
      tmpQ.copy(spinQ).multiply(b.Q);
      inAir = tmpP.y - b.impact.y > 0.35 || age < -0.25;
    } else {
      // No chao: escorrega um pouco, quica e balanca.
      tmpP.copy(b.impact).addScaledVector(b.travel, b.slide * easeOut(seg(age, 0, 0.2)));
      tmpP.y += b.bounce * Math.max(0, Math.sin(Math.PI * seg(age, 0, 0.14)));
      tmpAxis.crossVectors(UP, b.travel).normalize();
      spinQ.setFromAxisAngle(tmpAxis, 0.06 * spring(age, 0.02, { freq: 7, damp: 13 }));
      tmpQ.copy(spinQ).multiply(b.Q);
    }
    tmpM.compose(tmpP, tmpQ, b.scale);
    books.setBook(i, tmpM, inAir);
  });
  books.commit();
}

// Poeira: um tranco de cada vez (os cinco primeiros e o do topo).
const DUST = PLAN.books.filter((b) => b.dust).map((b) => ({ te: b.tl, at: v3(b.P.x, b.bottom, b.P.z), w: b.w, l: b.l, yaw: b.yaw }));

function poseDust(w, t) {
  const { puffs } = w.dust;
  puffs.forEach((p) => (p.visible = false));
  const half = puffs.length / 2;
  DUST.forEach((ev, e) => {
    const age = t - ev.te;
    if (age < 0 || age > 0.5) return;
    const u = age / 0.5;
    const out = easeOut(u);
    for (let k = 0; k < half; k += 1) {
      const p = puffs[(e % 2) * half + k];
      const a = (k / half) * Math.PI * 2 + 0.5;
      const [x, z] = rotY(Math.cos(a) * (ev.w / 2 + out * 0.06), Math.sin(a) * (ev.l / 2 + out * 0.06), ev.yaw);
      p.visible = true;
      p.position.set(ev.at.x + x, ev.at.y + out * 0.01, ev.at.z + z);
      // Deitada ao longo da borda do livro.
      p.rotation.y = ev.yaw - a + Math.PI / 2;
      p.scale.setScalar(Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.6) * (0.55 + 0.5 * out));
    }
  });
}

function shake(t, t0, amp, freq = 24) {
  const dt = t - t0;
  if (dt < 0 || dt > 0.6) return [0, 0];
  const k = amp * Math.exp(-9 * dt);
  return [k * noise1(dt * freq, 3), k * noise1(dt * freq, 9)];
}

function poseCamera(camera, t) {
  const { pos, target, dist } = cameraAt(t);
  // Mao de cinegrafista: um tremido lento sempre, e trancos nos primeiros e
  // no do topo.
  let sx = noise1(t * 0.35, 1) * 0.006 * dist;
  let sy = noise1(t * 0.3, 2) * 0.004 * dist;
  [...T.first, T.top].forEach((tf, i) => {
    const [a, b] = shake(t, tf, i === 0 ? 0.014 : 0.009);
    sx += a;
    sy += b;
  });
  camera.fov = FOV;
  camera.position.set(pos.x + sx, pos.y + sy, pos.z);
  camera.lookAt(target.x, target.y + sy * 0.5, target.z);
  camera.updateProjectionMatrix();
  camera.userData.focus = dist;
}

/**
 * Poe a pilha no instante "t" (pode ser negativo: o comeco da volta
 * seguinte, depois que a pagina virou).
 */
export function posePile(world, t) {
  poseBooks(world, t);
  poseDust(world, t);
  poseCamera(world.camera, t);
}

// ---------------------------------------------------------------- a pagina

/** Quanto a pagina ja virou (0 a 1), no instante "t". */
export function turnProgress(t) {
  return seg(t, T.turn, T.turnEnd);
}

// O raio da "dobra" da folha (a pagina tem altura 1) e o quanto a dobra
// vem inclinada (o canto de baixo vai na frente, como quem pega a folha por
// ali).
const CURL = 0.1;
const SLANT = 0.32;

/**
 * Para onde aponta cada trecho da folha (ver bendPage) com a pagina "u"
 * virada: a borda da direita levanta, enrola por cima e a dobra corre para
 * a esquerda ate a folha inteira sair, mostrando a pagina de baixo.
 * s = 0 na lombada, 1 na borda; z = -0.5 no alto, 0.5 no pe.
 */
export function turnAngle(u, aspect) {
  const arc = Math.PI * CURL;
  const fold = lerp(aspect + SLANT / 2 + 0.01, -arc - SLANT / 2 - 0.01, smooth(u));
  return (s, z) => {
    const at = fold + SLANT * (0.5 - (z + 0.5));
    return Math.PI * clamp((s * aspect - at) / arc);
  };
}
