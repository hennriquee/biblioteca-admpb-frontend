import * as THREE from "three";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, hash1, keys, lerp, noise1, seg, smooth, spring } from "./kit.js";
import { CITY } from "./city.js";
import { add, applyPose, full, track, walkDelta } from "./pose.js";
import { bendLeaf } from "./books.js";

/**
 * O roteiro da animacao da sugestao (segundos). Tudo e uma conta do instante:
 * poseAct1/poseAct2 colocam cada coisa onde ela deve estar em "t".
 *
 * Cena 1 - a esquina: o menino espera; o caminhao desengoncado chega
 * chacoalhando, freia com tudo perto do poste e solta um estouro de fumaca
 * (o cachorro pula de susto e o passaro sai voando); o entregador desce com a
 * sacola, o menino recebe (o peso o puxa para baixo), confere os livros
 * contando um a um, vibra, abraca a sacola e vai saltitando para casa.
 *
 * Cena 2 - de perto: os livros chegam um a um na pilha (a mesa nao aparece,
 * so a sombra), cada um com tranco, poeira e tremida. O quinto, o da
 * sugestao, e posto com cuidado - e se abre sozinho, folheia e para na
 * ilustracao da esquina. A camera entra nela e tudo recomeca.
 */
export const T = {
  truckStop: 4.75,
  brake: 3.65,
  backfire: 5.0,
  doorOpen: 5.35,
  courierOut: 5.45,
  hop: 5.75,
  land: 6.0,
  cut2: 6.05,
  offer: 6.95,
  take: 7.45,
  heave: 7.8,
  tip: 8.05,
  back: 8.35,
  climb: 9.25,
  cut3: 8.55,
  check: 8.6,
  counts: [8.95, 9.2, 9.45, 9.7, 9.95],
  joy: 10.25,
  hug: 10.6,
  truckGo: 10.6,
  cut4: 10.9,
  home: 10.95,
  steps: 13.2,
  enter: 13.5,
  shut: 13.9,
  erase: 14.05,
  act2: 14.6,
  drops: [15.35, 16.25, 17.05, 17.8],
  hero: 18.5,
  heroDown: 19.25,
  wiggle: 19.6,
  open: 20.0,
  flutter: 20.35,
  dive: 21.45,
  end: 23.9,
};
export const DURATION = T.end;

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmp = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();

// ---------------------------------------------------------------- caminhao

const TRUCK = { zStop: -11.26, xCurb: -2.1, xLane: -1.75, speed: 15, frontAxle: 2.9 };

/** Onde o caminhao esta em "t": x, z, quanto ja andou e a velocidade. */
export function truckAt(t) {
  const { zStop, speed } = TRUCK;
  const braking = T.truckStop - T.brake;
  const brakeDist = (speed * braking) / 2;
  let z;
  let v;
  if (t < T.brake) {
    z = zStop - brakeDist - speed * (T.brake - t);
    v = speed;
  } else if (t < T.truckStop) {
    const tau = T.truckStop - t;
    z = zStop - (speed * tau * tau) / (2 * braking);
    v = (speed * tau) / braking;
  } else if (t < T.truckGo) {
    z = zStop;
    v = 0;
  } else {
    const dt = t - T.truckGo;
    z = zStop + 2.6 * dt * dt;
    v = 5.2 * dt;
  }
  const pull = smooth(seg(t, T.brake - 0.6, T.truckStop)) - smooth(seg(t, T.truckGo + 0.2, T.truckGo + 1.4));
  const x = lerp(TRUCK.xLane, TRUCK.xCurb, pull);
  const dist = z - (zStop - brakeDist - speed * (T.brake + 1));
  return { x, z, v, dist };
}

function poseTruck(w, t) {
  const { truck, truckPivot } = w;
  const s = truckAt(t);
  const fast = clamp(s.v / TRUCK.speed);
  // O pivo fica no eixo da frente (o tranco levanta a traseira).
  truckPivot.position.set(s.x, 0, s.z + TRUCK.frontAxle);
  const ahead = truckAt(t + 0.05);
  truckPivot.rotation.y = Math.atan2(ahead.x - s.x, Math.max(0.001, ahead.z - s.z)) * clamp(s.v * 2);
  const stop = T.truckStop;
  const lift = 0.07 * Math.sin(Math.PI * seg(t, stop - 0.06, stop + 0.36)) + 0.012 * spring(t, stop + 0.36, { freq: 3, damp: 6 });
  const squat = -0.05 * Math.sin(Math.PI * seg(t, T.truckGo, T.truckGo + 0.55));
  truckPivot.rotation.x = lift + squat * 0.4;

  // Carroceria na mola: buracos da rua, mergulho do freio, o estouro.
  const bumps = (0.03 * Math.sin(s.dist * 2.1) + 0.018 * Math.sin(s.dist * 5.3 + 1)) * fast;
  const pop = 0.07 * Math.exp(-7 * Math.max(0, t - T.backfire)) * Math.abs(Math.sin(2 * Math.PI * 2.2 * Math.max(0, t - T.backfire))) * (t > T.backfire ? 1 : 0);
  const relief = 0.025 * spring(t, T.hop + 0.05, { freq: 2.4, damp: 4 }) + 0.02 * spring(t, T.climb + 0.2, { freq: 2.4, damp: 4 });
  truck.body.position.y = 0.72 + bumps + pop + relief;
  const dive = 0.15 * easeIn(seg(t, stop - 0.4, stop)) * (t < stop ? 1 : 0) + (t >= stop ? 0.15 * Math.exp(-3.2 * (t - stop)) * Math.cos(2 * Math.PI * 1.55 * (t - stop)) : 0);
  truck.body.rotation.x = dive + squat - 0.02 * spring(t, T.backfire, { freq: 3, damp: 5 }) + 0.012 * Math.sin(s.dist * 3.1) * fast;
  truck.body.rotation.z = 0.035 * Math.sin(t * 4.1) * fast + 0.03 * spring(t, stop + 0.1, { freq: 1.8, damp: 3 }) + 0.02 * spring(t, T.hop + 0.05, { freq: 2, damp: 3.5 });
  // O bau atrasa em relacao a cabine (cada um balanca do seu jeito).
  truck.cargo.rotation.x = 0.04 * spring(t, stop + 0.08, { freq: 1.7, damp: 2.6 }) + 0.015 * Math.sin(s.dist * 1.7 + 2) * fast;
  truck.cargo.rotation.z = 0.025 * Math.sin(t * 3.3 + 1) * fast + 0.035 * spring(t, stop + 0.15, { freq: 1.4, damp: 2.4 });
  truck.cab.rotation.x = 0.02 * Math.sin(s.dist * 4.4) * fast;
  // Rodas girando e "sambando".
  truck.wheels.forEach((wheel, i) => {
    wheel.spin.rotation.x = s.dist / 0.45;
    wheel.hub.rotation.z = (0.07 * Math.sin(t * 7 + i * 1.7) + 0.03 * Math.sin(t * 13 + i)) * fast + 0.04 * spring(t, stop, { freq: 2.5, damp: 4 }) * (i % 2 ? 1 : -1);
  });
  truck.mirrors.forEach((m, i) => {
    m.rotation.y = (0.18 * Math.sin(t * 12 + i * 2) * fast + 0.4 * spring(t, stop, { freq: 2.2, damp: 3 })) * (i ? -1 : 1);
  });
  truck.boxes.forEach((b, i) => {
    b.position.z = (i ? -0.5 : -0.4) + 0.14 * spring(t, stop + 0.04 * i, { freq: 1.6, damp: 3 }) + 0.06 * easeIn(seg(t, stop - 0.4, stop)) * (t < stop ? 1 : 0);
    b.rotation.x = 0.05 * Math.sin(t * 9 + i) * fast - 0.12 * spring(t, stop + 0.05 * i, { freq: 1.9, damp: 3.2 });
    b.rotation.z = 0.04 * Math.sin(t * 7 + i * 3) * fast + 0.05 * spring(t, T.backfire, { freq: 2.5, damp: 4 });
  });
  // Farois-olhos: piscam no estouro e "sorriem" ao sair.
  truck.lights.forEach((lamp, i) => {
    const blink = Math.exp(-((t - T.backfire - 0.08) ** 2) / 0.004) + Math.exp(-((t - T.truckGo - 0.2) ** 2) / 0.006) * (i === 0 ? 1 : 0.15);
    lamp.scale.set(1 + 0.15 * spring(t, T.backfire, { freq: 3, damp: 5 }), 1 - 0.75 * clamp(blink), 1);
  });
  // Porta do passageiro (lado da calcada).
  const open = keys(t, [[T.doorOpen, 0], [T.doorOpen + 0.25, 1.55, easeOut], [T.doorOpen + 0.45, 1.3], [T.climb + 0.2, 1.3], [T.climb + 0.45, 0, easeIn]]);
  truck.doors[1].rotation.y = -open;
  truck.doors[0].rotation.y = 0;
}

// ---------------------------------------------------------------- fumaca

function emitPuff(list, slot, origin, age, life, size, drift) {
  const g = list[slot];
  if (!g) return;
  if (age < 0 || age > life) {
    g.visible = false;
    return;
  }
  const u = age / life;
  const grow = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.7);
  g.visible = grow > 0.02;
  g.scale.setScalar(size * Math.max(0.01, grow) * (0.6 + 0.6 * u));
  g.position.set(origin.x + drift.x * age, origin.y + drift.y * age + 0.4 * age * age, origin.z + drift.z * age);
  g.rotation.set(age * 0.7, age * 1.3 + slot, 0);
}

function pipeTop(t) {
  const s = truckAt(t);
  return v3(s.x + 0.95, 3.45, s.z + 1.5);
}

function posePuffs(w, t) {
  const list = w.puffs.list;
  list.forEach((g) => (g.visible = false));
  // Fumacinha ritmada enquanto anda (some ao parar).
  const every = 0.27;
  const life = 1.2;
  let slot = 0;
  for (let k = 0; k < 6; k += 1) {
    const te = Math.floor(t / every) * every - k * every;
    if (te < 0 || te > T.truckStop - 0.1) continue;
    // (Longe, a fumacinha e menor: de perto, cresce.)
    const near = clamp((truckAt(te).z + 60) / 45);
    emitPuff(list, slot++, pipeTop(te), t - te, life, (0.35 + 0.55 * near) * (0.85 + 0.3 * hash1(te * 7)), v3(0.5, 0.9, -1.2));
  }
  // O estouro: uma nuvem grande de uma vez.
  for (let k = 0; k < 3; k += 1) {
    emitPuff(list, slot++, pipeTop(T.backfire).add(v3(0.1 * k, 0.1 * k, -0.2 * k)), t - T.backfire - k * 0.05, 1.7, 3.2 - k * 0.7, v3(0.9 + k * 0.2, 0.6, -0.4 + k * 0.3));
  }
  // Partida.
  for (let k = 0; k < 4; k += 1) {
    const te = T.truckGo + k * 0.22;
    emitPuff(list, slot++, pipeTop(te), t - te, 1.3, 1.3, v3(0.5, 0.8, -1.5));
  }
}

// ---------------------------------------------------------------- menino

const BOY_SPOT = v3(-4.55, CITY.walk, -5.1);
const BOY_TAKE = v3(-4.65, CITY.walk, -5.05);
const HOME = v3(CITY.door.x, CITY.walk, -5.3);
const COURIER_DOOR = v3(-3.4, 0.62, -8.95);
const COURIER_LAND = v3(-4.3, CITY.walk, -8.75);
const COURIER_GIVE = v3(-4.55, CITY.walk, -6.05);

const HUG = { armL: [-0.45, 0.15, -0.42, -1.6, 0.2], armR: [-0.45, 0.15, -0.42, -1.6, 0.2] };
const HOLD_OUT = { armL: [-0.38, 0, -0.3, -1.3, 0], armR: [-0.38, 0, -0.3, -1.3, 0] };

const boyTrack = track([
  [0, { neck: [-0.06, 0, 0], head: [-0.04, 0, 0], armL: [0.12, 0, 0.1, -0.35, 0], armR: [0.1, 0, 0.1, -0.3, 0] }],
  [1.55, { neck: [-0.06, 0, 0], head: [-0.04, 0.05, 0.04], armL: [0.12, 0, 0.1, -0.35, 0], armR: [0.1, 0, 0.1, -0.3, 0] }],
  // Viu! Antecipacao (encolhe) e sobe na ponta do pe.
  [1.75, { bob: -0.05, lean: 0.06, spine: [0.12, 0, 0], neck: [0.05, 0, 0], armL: [0.3, 0, 0.15, -0.5, 0], armR: [0.3, 0, 0.15, -0.5, 0], legL: [-0.15, 0.03, 0.35, 0], legR: [-0.15, 0.03, 0.35, 0] }, easeOut],
  [1.95, { bob: 0.04, lean: -0.08, spine: [-0.12, 0, 0], neck: [-0.15, 0, 0], armL: [-0.6, 0, 0.2, -0.4, 0], armR: [-0.6, 0, 0.2, -0.4, 0] }, easeOut],
  // Pulo de alegria, bracos para cima.
  [2.1, { bob: -0.07, spine: [0.15, 0, 0], armL: [0.4, 0, 0.3, -0.6, 0], armR: [0.4, 0, 0.3, -0.6, 0], legL: [-0.3, 0.05, 0.7, 0], legR: [-0.3, 0.05, 0.7, 0] }, easeIn],
  [2.32, { bob: 0.22, lean: -0.05, spine: [-0.15, 0, 0], neck: [-0.2, 0, 0], armL: [-2.75, 0, 0.45, -0.15, 0], armR: [-2.75, 0, 0.45, -0.15, 0], legL: [-0.5, 0.06, 1.1, 0], legR: [0.1, 0.06, 0.6, 0] }, easeOut],
  [2.55, { bob: -0.06, spine: [0.12, 0, 0], armL: [-1.6, 0, 0.6, -0.4, 0], armR: [-1.6, 0, 0.6, -0.4, 0], legL: [-0.3, 0.05, 0.6, 0], legR: [-0.3, 0.05, 0.6, 0] }, easeIn],
  // Acena com o braco direito (o resto e o aceno por cima, no "wave").
  [2.8, { bob: 0.01, tilt: 0.06, spine: [-0.05, 0, 0.05], neck: [-0.1, 0, 0], armL: [0.1, 0, 0.2, -0.3, 0], armR: [-2.9, 0, 0.5, -0.3, 0] }],
  [3.85, { bob: 0.01, tilt: 0.04, spine: [-0.05, 0, 0.04], neck: [-0.08, 0, 0], armL: [0.1, 0, 0.2, -0.3, 0], armR: [-2.8, 0, 0.5, -0.3, 0] }],
  // O caminhao chega perto demais: recua, maos no peito.
  [4.3, { bob: -0.01, lean: -0.05, spine: [-0.08, 0, 0], neck: [0.0, 0, 0], armL: [-0.85, 0.55, 0.0, -2.0, 0.3], armR: [-0.85, 0.55, 0.0, -2.0, 0.3] }],
  [4.95, { bob: -0.01, lean: -0.06, spine: [-0.08, 0, 0], armL: [-0.85, 0.55, 0.0, -2.0, 0.3], armR: [-0.85, 0.55, 0.0, -2.0, 0.3], face: { eye: 1.15, brow: 0.6 } }],
  // POF! Encolhe tudo.
  [5.07, { bob: -0.07, lean: 0.05, spine: [0.25, 0, 0], neck: [0.3, 0, 0], armL: [-1.7, 0.7, 0.35, -2.3, 0], armR: [-1.7, 0.7, 0.35, -2.3, 0], legL: [-0.2, 0.08, 0.45, 0], legR: [-0.2, 0.08, 0.45, 0], face: { eye: 0.05, worry: 0.8, smile: -0.4 } }, easeOut],
  [5.35, { bob: -0.06, lean: 0.04, spine: [0.22, 0, 0], neck: [0.25, 0, 0], armL: [-1.6, 0.7, 0.35, -2.2, 0], armR: [-1.6, 0.7, 0.35, -2.2, 0], legL: [-0.2, 0.08, 0.4, 0], legR: [-0.2, 0.08, 0.4, 0], face: { eye: 0.1, worry: 0.7, smile: -0.3 } }],
  // Espia: olho arregalado; ve a porta abrindo e se anima de novo.
  [5.65, { bob: 0, spine: [0.02, 0, 0], neck: [-0.05, 0.1, 0], armL: [-0.5, 0.5, 0.1, -1.6, 0], armR: [-0.5, 0.5, 0.1, -1.6, 0], face: { eye: 1.25, brow: 0.9, open: 0.3 } }],
  [6.6, { bob: 0.03, spine: [-0.05, 0, 0], neck: [-0.12, 0, 0], armL: [-0.6, 0.65, 0.05, -1.8, 0.2], armR: [-0.6, 0.65, 0.05, -1.8, 0.2], legL: [0, 0.02, 0, 0.3], legR: [0, 0.02, 0, 0.3], face: { eye: 1.15, brow: 0.8, smile: 0.7 } }],
  // Estica os bracos para receber.
  [7.3, { bob: 0.03, lean: 0.08, spine: [0.1, 0, 0], neck: [-0.15, 0, 0], armL: [-1.3, 0.12, 0.05, -0.3, 0], armR: [-1.3, 0.12, 0.05, -0.3, 0], legL: [-0.15, 0.02, 0.1, 0.2], legR: [0.15, 0.02, 0.1, 0.2], face: { eye: 1.2, brow: 1, smile: 0.9, open: 0.4 } }],
  // Pega... e o peso puxa tudo para baixo.
  [T.take + 0.06, { bob: -0.02, lean: 0.12, spine: [0.15, 0, 0], neck: [0.0, 0, 0], armL: [-1.1, 0.12, 0.05, -0.3, 0], armR: [-1.1, 0.12, 0.05, -0.3, 0], face: { eye: 1.25, brow: 1, smile: 0.5, open: 0.3 } }],
  [T.take + 0.26, { bob: -0.1, lean: 0.25, spine: [0.38, 0, 0], neck: [0.25, 0, 0], armL: [-0.35, 0.15, 0.05, -0.2, 0], armR: [-0.35, 0.15, 0.05, -0.2, 0], legL: [-0.45, 0.1, 0.85, 0], legR: [-0.45, 0.1, 0.85, 0], face: { eye: 1.35, brow: 1.1, worry: 0.6, smile: -0.2, open: 0.9 } }, easeOut],
  // Firma e levanta (decidido).
  [T.heave + 0.05, { bob: -0.03, lean: -0.08, spine: [-0.1, 0, 0], neck: [0.05, 0, 0], ...HUG, legL: [-0.1, 0.06, 0.2, 0], legR: [-0.1, 0.06, 0.2, 0], face: { eye: 0.8, worry: -0.7, smile: 0.2, open: 0 } }],
  // Olha para o entregador: obrigado!
  [T.tip + 0.2, { bob: 0.01, lean: -0.04, spine: [-0.05, 0, 0], neck: [-0.18, 0.05, 0.1], head: [-0.06, 0, 0.08], ...HUG, face: { eye: 0.9, squint: 0.5, brow: 0.6, smile: 1 } }],
  [T.check, { bob: 0, spine: [0.05, 0, 0], neck: [0.1, 0, 0], ...HOLD_OUT, face: { eye: 1, brow: 0.4, smile: 0.4 } }],
  // Confere a sacola (os acenos de cabeca de cada livro vem por cima).
  [T.check + 0.3, { bob: 0, spine: [0.2, 0, 0], neck: [0.42, 0, 0], head: [0.15, 0, 0], ...HOLD_OUT, face: { eye: 1.05, brow: 0.7, smile: 0.35 } }],
  [T.joy - 0.12, { bob: -0.02, spine: [0.24, 0, 0], neck: [0.45, 0, 0], head: [0.15, 0, 0], ...HOLD_OUT, face: { eye: 1.1, brow: 0.9, smile: 0.55, open: 0.2 } }],
  // TODOS! Explode de alegria.
  [T.joy + 0.05, { bob: -0.07, spine: [0.1, 0, 0], neck: [-0.05, 0, 0], ...HOLD_OUT, legL: [-0.25, 0.06, 0.55, 0], legR: [-0.25, 0.06, 0.55, 0], face: { eye: 0.4, squint: 1, brow: 1.1, smile: 1, open: 0.9 } }, easeIn],
  [T.joy + 0.22, { bob: 0.2, lean: -0.08, spine: [-0.2, 0, 0], neck: [-0.3, 0, 0], ...HUG, legL: [-0.6, 0.08, 1.3, 0], legR: [-0.2, 0.08, 1.0, 0], face: { eye: 0.4, squint: 1, brow: 1.2, smile: 1, open: 1 } }, easeOut],
  [T.hug, { bob: -0.05, spine: [0.15, 0, 0], neck: [0.12, 0, 0.12], head: [0, 0, 0.15], ...HUG, legL: [-0.3, 0.06, 0.6, 0], legR: [-0.3, 0.06, 0.6, 0], face: { eye: 0.1, squint: 1, brow: 0.8, smile: 1, open: 0 } }, easeIn],
  [T.home, { bob: 0, spine: [0.05, 0, 0], neck: [0.05, 0, 0.05], head: [0, 0, 0.08], ...HUG, face: { eye: 0.5, squint: 0.8, brow: 0.6, smile: 1 } }],
  [T.steps, { bob: 0, spine: [0.05, 0, 0], neck: [0, 0, 0], ...HUG, face: { eye: 0.6, squint: 0.7, brow: 0.5, smile: 1 } }],
]);

function boyRoot(t) {
  // Posicao e direcao no chao (sem contar a pose).
  const toTruck = Math.atan2(TRUCK.xLane - BOY_SPOT.x, -60 - BOY_SPOT.z);
  const toCourier = Math.atan2(COURIER_GIVE.x - BOY_TAKE.x, COURIER_GIVE.z - BOY_TAKE.z);
  const toHome = Math.atan2(HOME.x - BOY_TAKE.x, HOME.z - BOY_TAKE.z);
  let pos = BOY_SPOT.clone();
  let heading = toTruck;
  let walk = 0;
  let phase = 0;
  // Recua do caminhao, depois volta para receber.
  pos.lerp(v3(-4.75, CITY.walk, -4.8), smooth(seg(t, 4.1, 4.7)));
  pos.lerp(BOY_TAKE, smooth(seg(t, 6.6, 7.25)));
  heading = lerp(heading, toCourier, smooth(seg(t, 5.9, 6.4)));
  // Para conferir, vira para a rua (para a luz).
  const toStreet = Math.PI / 2 + 0.25;
  heading = lerp(heading, toStreet, smooth(seg(t, T.check - 0.15, T.check + 0.3)));
  walk += 0.6 * Math.sin(Math.PI * seg(t, 4.1, 4.7)) + 0.6 * Math.sin(Math.PI * seg(t, 6.6, 7.25));
  phase = seg(t, 4.1, 4.7) * 0.5 + seg(t, 6.6, 7.25) * 0.5;
  // Abraco a sacola e vou para casa (saltitando).
  if (t > T.hug) {
    const turn = smooth(seg(t, T.hug + 0.1, T.home + 0.35));
    heading = lerp(Math.PI / 2 + 0.25, toHome, turn);
    const u = seg(t, T.home, T.steps);
    const d = easeInOut(u) * 0.08 + u * 0.92;
    pos = BOY_TAKE.clone().lerp(HOME, d);
    walk = clamp(Math.min(seg(t, T.home, T.home + 0.25), 1 - seg(t, T.steps - 0.2, T.steps)));
    phase = (pos.distanceTo(BOY_TAKE) / 1.05);
  }
  if (t > T.steps) {
    heading = lerp(toHome, Math.PI, smooth(seg(t, T.steps, T.steps + 0.25)));
    const up = seg(t, T.steps, T.enter);
    pos = HOME.clone();
    pos.z = lerp(-5.3, -5.92, up);
    pos.y = CITY.walk + 0.31 * easeOut(seg(up, 0, 0.5)) + 0.0 * up;
    pos.y = CITY.walk + (up < 0.5 ? 0.16 * easeOut(up * 2) : 0.16 + 0.15 * easeOut((up - 0.5) * 2));
    walk = Math.sin(Math.PI * up) * 0.8;
    phase = up * 1.0;
  }
  if (t > T.enter) {
    const inside = seg(t, T.enter, T.enter + 0.4);
    pos.z = lerp(-5.92, -6.7, inside);
    walk = 0.6 * (1 - inside);
    phase = 1 + inside * 0.4;
  }
  return { pos, heading, walk, phase };
}

function poseBoy(w, t) {
  const boy = w.boy;
  const r = boyRoot(t);
  boy.root.position.copy(r.pos);
  boy.root.rotation.y = r.heading;
  boy.root.visible = t < T.enter + 0.45;
  let p = boyTrack(t);
  // Esperando: sobe e desce na ponta do pe, inquieto.
  const fidget = 1 - seg(t, 1.5, 1.7);
  if (fidget > 0) {
    const rise = Math.max(0, Math.sin(t * 3.2)) * 0.02 * fidget;
    p = add(p, { bob: rise, legL: [0, 0, 0, -rise * 6], legR: [0, 0, 0, -rise * 6], head: [0, 0.12 * Math.sin(t * 0.9) * fidget, 0] });
  }
  // Acena: o antebraco vai e volta.
  const wave = Math.sin(Math.PI * seg(t, 2.7, 3.95));
  if (wave > 0) p = add(p, { armR: [0, 0, 0.25 * Math.sin(t * 13), -0.5 + 0.45 * Math.sin(t * 13), 0] }, wave);
  // Contando os livros: um aceno de cabeca e sobrancelha por livro.
  for (const tc of T.counts) {
    const k = Math.exp(-((t - tc) ** 2) / 0.006);
    p = add(p, { neck: [0.13, 0, 0], armR: [0.15, 0, 0, -0.35, 0], face: { brow: 0.25 } }, k);
  }
  // Abraco: aperta a sacola balancando de um lado para o outro.
  const squeeze = Math.sin(Math.PI * seg(t, T.hug - 0.1, T.home + 0.2));
  if (squeeze > 0) p = add(p, { spine: [0, 0.18 * Math.sin(t * 9), 0.06 * Math.sin(t * 9)] }, squeeze);
  // Caminhada (saltitante a caminho de casa, com a sacola abracada).
  if (r.walk > 0.001) {
    const home = t > T.home;
    p = add(p, walkDelta(r.phase, r.walk, { stride: home ? 0.55 : 0.35, bounce: home ? 1.9 : 1, arms: home ? 0 : 0.6 }));
  }
  // Piscadas.
  for (const tb of [0.9, 3.4, 6.3, 8.4, 9.6, 12.1]) {
    const k = Math.exp(-((t - tb) ** 2) / 0.0025);
    p.face.eye *= 1 - 0.95 * k;
  }
  applyPose(boy, p);
  poseBag(w, t);
}

// A sacola: na mao do entregador, nas maos do menino, no colo dele.
function poseBag(w, t) {
  const bag = w.boy.bag;
  if (t < T.courierOut) {
    bag.visible = false;
    return;
  }
  bag.visible = t < T.enter + 0.45;
  const courier = w.courier;
  if (t < T.offer) {
    courier.arms[1].wrist.add(bag);
    bag.position.set(0, -0.09, 0);
    bag.rotation.set(0, Math.PI / 2, 0.05 * Math.sin(t * 9));
    bag.scale.setScalar(1);
  } else if (t < T.take) {
    courier.spine.add(bag);
    const u = smooth(seg(t, T.offer, T.offer + 0.35));
    bag.position.set(0, lerp(0.0, 0.32, u), lerp(0.25, 0.62, u));
    bag.rotation.set(0, 0, 0);
  } else if (t < T.heave) {
    // Recem-recebida: pendurada nas maos, puxando para baixo.
    w.boy.spine.add(bag);
    const u = easeOut(seg(t, T.take, T.take + 0.26));
    bag.position.set(0, lerp(0.15, -0.12, u), lerp(0.42, 0.3, u));
    bag.rotation.set(lerp(0, 0.25, u), 0, 0.04 * spring(t, T.take, { freq: 3, damp: 4 }));
  } else if (t < T.check || t > T.hug) {
    w.boy.spine.add(bag);
    const u = easeOutBack(seg(t, T.heave, T.heave + 0.25));
    bag.position.set(0, lerp(-0.12, 0.12, u), lerp(0.3, 0.2, u));
    bag.rotation.set(lerp(0.25, -0.1, u), 0, 0);
  } else {
    // Segurando na frente, aberta, para conferir.
    w.boy.spine.add(bag);
    const u = smooth(seg(t, T.check, T.check + 0.3));
    const v = smooth(seg(t, T.hug - 0.25, T.hug));
    bag.position.set(0, lerp(lerp(0.12, 0.02, u), 0.12, v), lerp(lerp(0.2, 0.3, u), 0.2, v));
    bag.rotation.set(lerp(lerp(-0.1, 0.35, u), -0.1, v), 0, 0);
  }
  // Os livros lá dentro balancam com o tranco.
  bag.spines.forEach((b, i) => {
    b.rotation.x = 0.06 * spring(t, T.take + 0.05 * i, { freq: 2.5, damp: 3 }) + 0.05 * spring(t, T.counts[Math.min(i, 4)], { freq: 4, damp: 8 });
  });
}

// ---------------------------------------------------------------- entregador

const courierTrack = track([
  [T.courierOut, { bob: 0, spine: [0.1, 0, 0], armL: [-0.2, 0, 0.2, -0.5, 0], armR: [0.05, 0, 0.25, -0.2, 0], face: { smile: 0.6, brow: 0.3 } }],
  [T.hop - 0.08, { bob: -0.1, spine: [0.3, 0, 0], neck: [0.1, 0, 0], armL: [0.3, 0, 0.3, -0.6, 0], armR: [0.3, 0, 0.3, -0.4, 0], legL: [-0.4, 0.1, 0.8, 0], legR: [-0.4, 0.1, 0.8, 0], face: { smile: 0.4, brow: 0.6 } }, easeOut],
  [T.hop + 0.12, { bob: 0.05, spine: [-0.15, 0, 0], armL: [-1.3, 0, 0.6, -0.3, 0], armR: [-0.4, 0, 0.6, -0.3, 0], legL: [-0.3, 0.1, 0.4, 0], legR: [0.2, 0.1, 0.5, 0], face: { eye: 1.2, brow: 0.9, smile: 0.5, open: 0.5 } }],
  // Pousa: tudo afunda (barriga incluida).
  [T.land + 0.06, { bob: -0.16, spine: [0.32, 0, 0], neck: [0.15, 0, 0], armL: [-0.3, 0, 0.7, -0.5, 0], armR: [0.1, 0, 0.5, -0.3, 0], legL: [-0.55, 0.12, 1.0, 0], legR: [-0.55, 0.12, 1.0, 0], face: { eye: 0.4, smile: 0.3 } }, easeOut],
  [T.land + 0.3, { bob: 0, spine: [0.02, 0, 0], armL: [0.05, 0, 0.2, -0.3, 0], armR: [0.05, 0, 0.2, -0.25, 0], face: { eye: 1, smile: 0.8, brow: 0.4 } }],
  [T.offer - 0.1, { bob: 0, spine: [0.02, 0, 0], armL: [0.05, 0, 0.2, -0.3, 0], armR: [0.05, 0, 0.2, -0.25, 0], face: { smile: 0.8, brow: 0.4 } }],
  // Entrega com as duas maos, se curvando um pouco.
  [T.offer + 0.35, { bob: -0.02, spine: [0.28, 0, 0], neck: [0.15, 0, 0], armL: [-1.15, 0.25, 0.05, -0.4, 0], armR: [-1.15, 0.25, 0.05, -0.4, 0], legL: [-0.1, 0.1, 0.15, 0], legR: [-0.1, 0.1, 0.15, 0], face: { smile: 0.9, brow: 0.5, squint: 0.3 } }],
  [T.take + 0.1, { bob: -0.01, spine: [0.22, 0, 0], neck: [0.1, 0, 0], armL: [-1.0, 0.25, 0.05, -0.4, 0], armR: [-1.0, 0.25, 0.05, -0.4, 0], face: { smile: 0.9, brow: 0.5, squint: 0.3 } }],
  [T.tip - 0.05, { bob: 0, spine: [0.0, 0, 0], armL: [0.05, 0, 0.2, -0.3, 0], armR: [0.05, 0, 0.2, -0.3, 0], face: { smile: 0.9, brow: 0.5 } }],
  // Toca na aba do bone.
  [T.tip + 0.2, { bob: 0, spine: [-0.03, 0, 0], neck: [-0.05, 0, 0], head: [0.12, 0, -0.1], armL: [0.05, 0, 0.2, -0.3, 0], armR: [-2.25, -0.2, 0.55, -2.05, 0], face: { smile: 1, squint: 0.7, brow: 0.6 } }],
  [T.back, { bob: 0, armL: [0.05, 0, 0.2, -0.3, 0], armR: [0.05, 0, 0.2, -0.3, 0], face: { smile: 0.9, brow: 0.4 } }],
  [T.climb, { bob: 0, armL: [0.05, 0, 0.2, -0.3, 0], armR: [0.05, 0, 0.2, -0.3, 0], face: { smile: 0.8 } }],
  [T.climb + 0.15, { bob: -0.08, spine: [0.3, 0, 0], armL: [-1.5, 0, 0.3, -0.4, 0], armR: [-0.5, 0, 0.3, -0.3, 0], legL: [-0.9, 0.1, 1.3, 0], legR: [-0.2, 0.1, 0.4, 0] }],
]);

function poseCourier(w, t) {
  const c = w.courier;
  c.root.visible = t >= T.courierOut && t < T.climb + 0.3;
  if (!c.root.visible) return;
  const toSidewalk = -Math.PI / 2;
  const toBoy = Math.atan2(BOY_TAKE.x - COURIER_GIVE.x, BOY_TAKE.z - COURIER_GIVE.z);
  const toTruck = Math.atan2(COURIER_LAND.x - COURIER_GIVE.x, COURIER_LAND.z - COURIER_GIVE.z);
  let pos;
  let heading = toSidewalk;
  let walk = 0;
  let phase = 0;
  if (t < T.hop) {
    pos = COURIER_DOOR.clone();
    pos.x += 0.25 * (1 - easeOut(seg(t, T.courierOut, T.courierOut + 0.25)));
  } else if (t < T.land) {
    const u = seg(t, T.hop, T.land);
    pos = COURIER_DOOR.clone().lerp(COURIER_LAND, u);
    pos.y = lerp(COURIER_DOOR.y, COURIER_LAND.y, u) + 0.35 * Math.sin(Math.PI * u);
  } else if (t < T.offer) {
    const u = seg(t, T.land + 0.25, T.offer - 0.05);
    pos = COURIER_LAND.clone().lerp(COURIER_GIVE, smooth(u));
    heading = lerp(toSidewalk, toBoy, smooth(seg(t, T.land + 0.1, T.land + 0.45)));
    walk = Math.sin(Math.PI * u);
    phase = pos.distanceTo(COURIER_LAND) / 1.3;
  } else if (t < T.back) {
    pos = COURIER_GIVE.clone();
    heading = toBoy;
  } else if (t < T.climb) {
    const u = seg(t, T.back + 0.15, T.climb - 0.05);
    pos = COURIER_GIVE.clone().lerp(COURIER_LAND, smooth(u));
    heading = lerp(toBoy + Math.PI * 2 * (toTruck < toBoy ? 0 : 0), toTruck, smooth(seg(t, T.back, T.back + 0.3)));
    walk = Math.sin(Math.PI * u);
    phase = pos.distanceTo(COURIER_GIVE) / 1.3;
  } else {
    const u = seg(t, T.climb, T.climb + 0.3);
    pos = COURIER_LAND.clone().lerp(COURIER_DOOR, u);
    pos.y += 0.25 * Math.sin(Math.PI * u);
    heading = lerp(toTruck, Math.PI / 2, smooth(u));
  }
  c.root.position.copy(pos);
  c.root.rotation.y = heading;
  let p = courierTrack(t);
  if (walk > 0.001) p = add(p, walkDelta(phase, walk, { stride: 0.42, waddle: 1, arms: 0.8 }));
  // Barriga e bigode: balancam depois do pouso e na risada.
  p = add(p, { spine: [0, 0, 0.06 * spring(t, T.land, { freq: 3, damp: 5 })], head: [0.08 * spring(t, T.land + 0.05, { freq: 3.5, damp: 6 }), 0, 0] });
  for (const tb of [6.5, 8.6]) p.face.eye *= 1 - 0.95 * Math.exp(-((t - tb) ** 2) / 0.0025);
  applyPose(c, p);
}

// ---------------------------------------------------------------- bichos

function poseDog(w, t) {
  const d = w.dog;
  const start = v3(-11.5, CITY.walk, -4.7);
  const sniff = v3(-5.6, CITY.walk, -4.55);
  const away = v3(-17, CITY.walk, -4.2);
  let pos;
  let heading = Math.PI / 2;
  let gait = 0;
  let speed = 0;
  let jump = 0;
  if (t < 2.5) {
    const u = seg(t, 0, 2.5);
    pos = start.clone().lerp(sniff, u * 0.9 + smooth(u) * 0.1);
    gait = 1 - seg(t, 2.25, 2.5);
    speed = 2.4;
  } else if (t < T.backfire) {
    pos = sniff.clone();
    heading = Math.PI / 2 + 0.25 * Math.sin(t * 1.3);
  } else {
    const u = seg(t, T.backfire, T.backfire + 0.45);
    jump = Math.sin(Math.PI * u);
    pos = sniff.clone();
    pos.y += 0.42 * jump;
    // Gira no ar e dispara de volta.
    heading = lerp(Math.PI / 2, -Math.PI / 2, easeInOut(seg(t, T.backfire + 0.08, T.backfire + 0.4)));
    const run = seg(t, T.backfire + 0.45, T.backfire + 2.0);
    pos.lerp(away, easeIn(run) * 0.6 + run * 0.4);
    gait = run > 0 && run < 1 ? 1 : 0;
    speed = 7;
  }
  d.root.position.copy(pos);
  d.root.rotation.y = heading;
  d.root.visible = t < T.backfire + 2.0;
  const phase = t * (speed > 3 ? 3.4 : 2.6) * Math.PI * 2;
  const stride = speed > 3 ? 0.75 : 0.45;
  d.legs.forEach((leg, i) => {
    const diag = i === 0 || i === 3 ? 0 : Math.PI;
    leg.rotation.x = stride * Math.sin(phase + diag) * gait - jump * (i < 2 ? 0.9 : -0.9);
  });
  d.body.position.y = 0.32 + 0.02 * Math.abs(Math.sin(phase)) * gait;
  d.body.rotation.x = 0.04 * Math.sin(phase * 2) * gait;
  // Fareja: cabeca baixa, focinho tremendo.
  const sniffing = seg(t, 2.4, 2.7) * (1 - seg(t, T.backfire - 0.05, T.backfire));
  d.neck.rotation.x = 0.75 * sniffing + 0.05 * Math.sin(t * 25) * sniffing - 0.5 * jump;
  d.head.rotation.y = 0.2 * Math.sin(t * 2.1) * sniffing;
  const happy = t < T.backfire ? 1 : 0.3;
  d.tail.rotation.y = 0.6 * Math.sin(t * (t < T.backfire ? 14 : 6)) * happy;
  d.tail.rotation.x = t < T.backfire ? -0.2 : 0.6 * (1 - jump) + 0.4;
  d.ears.forEach((ear, i) => {
    const side = i ? -1 : 1;
    ear.rotation.z = side * (0.35 - 1.6 * jump) + side * 0.1 * Math.sin(phase) * gait;
  });
}

const LAMP_TOP = v3(CITY.lamp.x + 0.8, CITY.lamp.y + 4.58, CITY.lamp.z);

function poseBird(w, t) {
  const b = w.bird;
  const land = 2.7;
  let pos;
  let flap = 0;
  let heading = 0;
  let pitch = 0;
  let fold = 0;
  if (t < land) {
    // Chega planando de longe, bate asa e pousa na lanterna do poste.
    const u = seg(t, 0, land);
    const a = v3(14, 10.5, -22);
    const m = v3(2, 7.5, -9);
    const p0 = a.clone().lerp(m, u);
    const p1 = m.clone().lerp(LAMP_TOP, u);
    pos = p0.lerp(p1, easeOut(u) * 0.6 + u * 0.4);
    const ahead = a.clone().lerp(m, Math.min(1, u + 0.02)).lerp(m.clone().lerp(LAMP_TOP, Math.min(1, u + 0.02)), easeOut(Math.min(1, u + 0.02)) * 0.6 + Math.min(1, u + 0.02) * 0.4);
    tmp.copy(ahead).sub(pos);
    heading = Math.atan2(tmp.x, tmp.z);
    flap = u < 0.35 || u > 0.75 ? 1 : 0.15;
    pitch = -0.3 * seg(t, land - 0.35, land);
  } else if (t < T.backfire) {
    pos = LAMP_TOP.clone();
    heading = -2.4 + 0.5 * Math.round(Math.sin(t * 1.7));
    fold = smooth(seg(t, land, land + 0.25));
    pos.y += 0.02 * Math.abs(Math.sin(t * 2));
  } else {
    const u = seg(t, T.backfire, T.backfire + 2.6);
    pos = LAMP_TOP.clone().lerp(v3(-16, 13, -22), easeIn(u) * 0.7 + u * 0.3);
    pos.y += 1.2 * Math.sin(Math.PI * u);
    heading = Math.atan2(-16 - LAMP_TOP.x, -22 - LAMP_TOP.z);
    flap = 1.3;
    pitch = -0.4;
  }
  b.root.position.copy(pos);
  b.root.rotation.set(0, heading, 0);
  b.body.rotation.x = pitch;
  b.root.visible = t < T.backfire + 2.6;
  const beat = Math.sin(t * 24) * flap;
  b.wings.forEach((wing, i) => {
    const side = i ? -1 : 1;
    wing.rotation.z = side * (0.9 * beat + (flap ? 0.2 : 0)) - side * fold * 1.25;
    wing.rotation.y = side * fold * 0.6;
    wing.scale.setScalar(1 - fold * 0.45);
  });
  b.tail.rotation.x = 0.3 * fold - 0.2 * flap * Math.sin(t * 12);
  // Passarinhos no fio: mexem a cabeca de vez em quando.
  w.wireBirds.forEach((wb, i) => {
    wb.root.rotation.y = -1.1 + 0.35 * Math.round(Math.sin(t * 0.8 + i * 2));
    wb.body.rotation.x = 0.05 * Math.sin(t * 3 + i);
  });
}

// ---------------------------------------------------------------- cena 1

function poseAct1(w, t) {
  poseTruck(w, t);
  posePuffs(w, t);
  poseBoy(w, t);
  poseCourier(w, t);
  poseDog(w, t);
  poseBird(w, t);
  w.trees.forEach((tree, i) => {
    tree.rotation.z = 0.025 * Math.sin(t * 0.9 + i * 1.3) + 0.01 * Math.sin(t * 2.3 + i);
    tree.rotation.x = 0.015 * Math.sin(t * 0.7 + i * 2.1);
  });
  // A porta de casa: abre para dentro e bate.
  const open = keys(t, [[T.enter - 0.1, 0], [T.enter + 0.15, 1.6, easeOut], [T.enter + 0.45, 1.6], [T.shut, 0, easeIn]]);
  w.homeDoor.rotation.y = open + 0.04 * spring(t, T.shut, { freq: 5, damp: 9 });
}

function shake(t, t0, amp, freq = 22) {
  const dt = t - t0;
  if (dt < 0 || dt > 0.8) return [0, 0];
  const k = amp * Math.exp(-7 * dt);
  return [k * noise1(dt * freq, 3), k * noise1(dt * freq, 9)];
}

/**
 * A camera da cena 1: quatro planos com cortes, cada um com movimento
 * proprio. camera.userData.focus = a distancia do assunto (o fundo atras
 * dele sai mais claro).
 */
function cameraAct1(camera, t) {
  let pos;
  let target;
  let fov = 40;
  let focus;
  if (t < T.cut2) {
    // Por tras do menino, de baixo (como na referencia): a rua inteira na
    // frente dele, e o caminhao vindo la do fim.
    pos = keys(t, [[0, [-3.85, 1.08, -2.15]], [4.4, [-3.95, 1.1, -2.6]], [T.cut2, [-4.05, 1.12, -2.75]]]);
    target = keys(t, [[0, [-3.0, 1.62, -15]], [3.6, [-3.0, 1.55, -13]], [4.8, [-3.25, 1.35, -9.5]], [T.cut2, [-3.6, 1.25, -8.8]]]);
    const s = truckAt(t);
    focus = lerp(2.9, Math.max(3, -2.6 - (s.z + 4.3)), smooth(seg(t, 2.8, 4.6)));
  } else if (t < T.cut3) {
    // Os dois, do lado da rua: o pulo do entregador e a entrega.
    pos = keys(t, [[T.cut2, [-1.6, 1.15, -3.2]], [T.cut3, [-1.85, 1.1, -3.5]]]);
    target = keys(t, [[T.cut2, [-4.1, 1.0, -5.9]], [7.0, [-4.5, 0.95, -5.75]], [T.cut3, [-4.6, 0.95, -5.6]]]);
    fov = 38;
    focus = 3.6;
  } else if (t < T.cut4) {
    // De frente, de perto e de baixo: o rosto conferindo a sacola.
    pos = keys(t, [[T.cut3, [-2.95, 1.02, -5.45]], [T.joy, [-3.12, 1.0, -5.4]], [T.joy + 0.35, [-2.9, 1.06, -5.48]], [T.cut4, [-2.85, 1.08, -5.5]]]);
    target = keys(t, [[T.cut3, [-4.65, 0.92, -5.05]], [T.joy, [-4.65, 0.95, -5.05]], [T.joy + 0.35, [-4.62, 1.05, -5.05]]]);
    fov = 38;
    focus = 1.8;
  } else {
    // A caminho de casa: a camera vai na frente dele, de lado.
    pos = keys(t, [[T.cut4, [-6.1, 1.0, -2.3]], [T.steps, [-8.2, 1.1, -2.35]], [T.erase, [-8.5, 1.22, -2.2]]]);
    target = keys(t, [[T.cut4, [-4.85, 1.05, -5.0]], [T.steps, [-9.45, 1.15, -5.5]], [T.erase, [-9.6, 1.45, -6.0]]]);
    focus = 3.2;
  }
  // Mao de cinegrafista: um tremido lento sempre, e trancos nos impactos.
  const drift = [noise1(t * 0.35, 1) * 0.03, noise1(t * 0.3, 2) * 0.022];
  const s1 = shake(t, T.truckStop, 0.05);
  const s2 = shake(t, T.backfire, 0.08);
  const s3 = shake(t, T.shut, 0.03);
  camera.fov = fov;
  camera.userData.focus = focus;
  camera.position.set(pos[0] + drift[0], pos[1] + drift[1] + s1[1] + s2[1] + s3[1], pos[2]);
  camera.lookAt(target[0] + s1[0] + s2[0] + s3[0], target[1] + s2[1], target[2]);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- cena 2

const STACK = [
  { w: 0.18, l: 0.25, t: 0.042, tone: 0.55, seed: 1, x: 0.0, z: 0.0, r: 0.06 },
  { w: 0.155, l: 0.225, t: 0.03, tone: 0.22, seed: 2, x: 0.012, z: -0.006, r: -0.13 },
  { w: 0.19, l: 0.26, t: 0.05, tone: 0.72, seed: 3, x: -0.01, z: 0.006, r: 0.1 },
  { w: 0.165, l: 0.235, t: 0.036, tone: 0.4, seed: 4, x: 0.006, z: 0.004, r: -0.05 },
];
export const HERO = { w: 0.165, l: 0.24, t: 0.042, x: 0.0, z: 0.0, r: 0.02 };
export { STACK };

function stackHeight(n) {
  let h = 0;
  for (let i = 0; i < n; i += 1) h += STACK[i].t;
  return h;
}

/** Tranco acumulado na pilha (cada impacto soma uma mola). */
function impacts(t) {
  let squash = 0;
  for (const td of T.drops) squash += spring(t, td, { freq: 6, damp: 9, amp: 1 });
  squash += 0.35 * spring(t, T.heroDown, { freq: 6, damp: 9 });
  return squash;
}

function poseAct2(w2, t) {
  const squash = impacts(t);
  w2.stack.scale.set(1 + 0.03 * squash, 1 - 0.06 * squash, 1 + 0.03 * squash);
  let top = 0;
  STACK.forEach((spec, i) => {
    const book = w2.books[i];
    const td = T.drops[i];
    const landY = top;
    top += spec.t;
    const fallFrom = 0.42;
    let y;
    let tilt = 0;
    if (t < td - 0.55) {
      book.visible = false;
      return;
    }
    book.visible = true;
    if (t < td - 0.1) {
      // A mao traz o livro de cima, rapido, e segura um instante.
      const u = seg(t, td - 0.55, td - 0.12);
      y = landY + lerp(fallFrom, 0.075, easeOut(u));
      tilt = 0.12 * (1 - u);
    } else if (t < td) {
      // Solta: cai seco.
      const u = seg(t, td - 0.1, td);
      y = landY + lerp(0.075, 0, easeIn(u));
      tilt = 0.04 * (1 - u);
    } else {
      y = landY + Math.max(0, 0.012 * spring(t, td + 0.02, { freq: 5, damp: 8 }));
      tilt = 0.03 * spring(t, td, { freq: 5, damp: 7 });
    }
    // Depois dos tremeliques de cada tranco seguinte, a pilha se ajeita.
    let jiggle = 0;
    for (let k = i + 1; k < T.drops.length; k += 1) jiggle += spring(t, T.drops[k], { freq: 7, damp: 10 }) * 0.02;
    book.position.set(spec.x + jiggle * 0.3, y, spec.z);
    book.rotation.set(tilt * 0.4, spec.r + jiggle, tilt);
  });

  // O quinto livro, com o titulo da sugestao.
  const hero = w2.hero;
  const heroY = stackHeight(STACK.length);
  if (t < T.hero) {
    hero.group.visible = false;
  } else {
    hero.group.visible = true;
    let y;
    if (t < T.heroDown) {
      const u = seg(t, T.hero, T.heroDown);
      y = heroY + lerp(0.4, 0, easeInOut(u));
    } else {
      y = heroY + Math.max(0, 0.004 * spring(t, T.heroDown, { freq: 5, damp: 8 }));
    }
    // Vivo: treme, da pulinhos... e abre.
    const alive = seg(t, T.wiggle, T.open);
    const buzz = alive * (Math.sin(t * 70) * 0.012 + Math.sin(t * 43) * 0.008) * (t < T.open + 0.1 ? 1 : 0);
    const hopUp = Math.max(0, Math.sin(Math.PI * seg(t, T.open - 0.18, T.open + 0.05))) * 0.025;
    hero.group.position.set(HERO.x, y + hopUp, HERO.z);
    hero.group.rotation.set(buzz, HERO.r + buzz * 0.5, buzz * 0.6);
  }
  const opening = keys(t, [[T.open, 0], [T.open + 0.32, Math.PI + 0.12, easeOut], [T.open + 0.5, Math.PI - 0.06], [T.open + 0.7, Math.PI, easeInOut]]);
  hero.hinge.rotation.z = opening;
  // As folhas voando, uma atras da outra, cada vez mais rapido.
  hero.leaves.forEach((leaf, i) => {
    const t0 = T.flutter + i * 0.12 - i * i * 0.006;
    const u = seg(t, t0, t0 + 0.3 - i * 0.015);
    leaf.mesh.visible = u > 0 && u < 1;
    if (leaf.mesh.visible) bendLeaf(hero, leaf, easeInOut(u), 0.0015 * (6 - i));
  });

  // A mao do menino: traz cada livro e solta (e o quinto, com cuidado).
  const hand = w2.hand;
  let handOn = false;
  for (let i = 0; i < T.drops.length; i += 1) {
    const td = T.drops[i];
    if (t >= td - 0.55 && t < td + 0.45) {
      const spec = STACK[i];
      const book = w2.books[i];
      handOn = true;
      const away = easeIn(seg(t, td - 0.08, td + 0.4));
      const grip = t < td - 0.1 ? book.position.y : stackHeight(i) + 0.075;
      hand.root.position.set(spec.x + spec.w / 2 + 0.002 + away * 0.12, grip + spec.t / 2 + away * 0.3, spec.z + 0.02);
      hand.root.rotation.set(0, 0, -0.15 * away);
      hand.fingers.forEach((f, k) => (f.rotation.z = -0.5 * seg(t, td - 0.1, td + 0.05) - 0.05 * k));
    }
  }
  if (t >= T.hero && t < T.heroDown + 0.45) {
    handOn = true;
    const away = easeInOut(seg(t, T.heroDown + 0.05, T.heroDown + 0.45));
    hand.root.position.set(HERO.x + HERO.w / 2 + 0.002 + away * 0.12, hero.group.position.y + HERO.t / 2 + away * 0.3, HERO.z + 0.02);
    hand.root.rotation.set(0, 0, -0.1 * away);
    hand.fingers.forEach((f, k) => (f.rotation.z = -0.4 * seg(t, T.heroDown, T.heroDown + 0.15) - 0.05 * k));
  }
  hand.root.visible = handOn;

  // Poeira e riscos de impacto em cada tranco (e no estalo da capa).
  const fx = w2.impact;
  fx.puffs.forEach((p) => (p.visible = false));
  const events = T.drops.map((td, i) => ({ td, y: stackHeight(i), w: STACK[i].w, l: STACK[i].l, big: 1 }));
  events.push({ td: T.open + 0.3, y: heroY + HERO.t, w: HERO.w * 2, l: HERO.l, big: 0.7, left: true });
  for (const ev of events) {
    const age = t - ev.td;
    if (age >= 0 && age < 0.6) {
      fx.puffs.forEach((p, k) => {
        const side = k % 2 ? 1 : -1;
        const along = (Math.floor(k / 2) - 1) * ev.l * 0.38;
        const u = age / 0.6;
        p.visible = true;
        const out = easeOut(u);
        p.position.set((ev.left ? -ev.w * 0.5 : 0) + side * (ev.w * 0.5 + 0.015 + out * 0.09), ev.y + 0.01 + out * 0.035, along * (1 + out * 0.4));
        p.scale.setScalar(ev.big * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.6) * (0.7 + 0.9 * out));
      });
    }
  }
}

/**
 * A camera da cena 2: bem perto da pilha, na altura da mesa; sobe quando o
 * quinto livro chega e, aberto, mergulha na ilustracao ate ela encher a
 * tela (a imagem e o primeiro quadro da cena 1, entao o recomeco nao tem
 * emenda).
 */
function cameraAct2(camera, t, w2) {
  const squash = impacts(t);
  let pos = keys(t, [[T.act2, [0.6, 0.16, 0.72]], [T.drops[3] + 0.4, [0.56, 0.2, 0.66]], [T.heroDown, [0.5, 0.33, 0.6]], [T.open + 0.2, [0.36, 0.5, 0.5]], [T.dive, [0.26, 0.62, 0.36]]]);
  let target = keys(t, [[T.act2, [0, 0.09, 0]], [T.drops[3] + 0.4, [0, 0.12, 0]], [T.heroDown, [0, 0.2, 0]], [T.dive, [0.0, 0.2, -0.02]]]);
  const k = shake(t, T.drops[0], 0.012, 30);
  const k2 = [0, 0];
  for (const td of T.drops.slice(1)) {
    const s = shake(t, td, 0.012, 30);
    k2[0] += s[0];
    k2[1] += s[1];
  }
  const fov = 30;
  camera.fov = fov;
  camera.userData.focus = 1.2;
  camera.up.set(0, 1, 0);
  camera.position.set(pos[0] + k[0] + k2[0], pos[1] + k[1] + k2[1] - 0.004 * squash, pos[2]);
  camera.lookAt(target[0], target[1], target[2]);
  if (t > T.dive) {
    // Mergulho: da posicao acima ate a camera "colada" na ilustracao.
    const u = easeInOut(seg(t, T.dive, T.end));
    const startQ = camera.quaternion.clone();
    const startP = camera.position.clone();
    const end = diveEnd(camera, w2);
    camera.position.copy(startP.lerp(end.position, u));
    camera.quaternion.copy(startQ.slerp(end.quaternion, u));
  }
  camera.updateProjectionMatrix();
}

/** Onde a camera precisa estar para a ilustracao encher a tela. */
export function diveEnd(camera, w2) {
  const pic = w2.hero.pictureMesh;
  pic.updateWorldMatrix(true, false);
  const center = new THREE.Vector3().setFromMatrixPosition(pic.matrixWorld);
  const normal = new THREE.Vector3(0, 1, 0).transformDirection(pic.matrixWorld);
  const up = new THREE.Vector3(0, 0, -1).transformDirection(pic.matrixWorld);
  const height = w2.hero.picture.h;
  const distance = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const position = center.clone().addScaledVector(normal, distance);
  tmpM.lookAt(position, center, up);
  tmpQ.setFromRotationMatrix(tmpM);
  return { position, quaternion: tmpQ.clone() };
}

// ---------------------------------------------------------------- quadro

/**
 * O que desenhar em "t": a cena, o "lapis" (quanto ja esta desenhado) e o
 * ciclo de fervura. first = primeira volta (o desenho se faz no comeco).
 */
export function look(t, first) {
  const act = t < T.act2 ? 1 : 2;
  let reveal = 1;
  if (first && t < 1.0) reveal = smooth(seg(t, 0, 1.0));
  if (t > T.erase && t < T.act2) reveal = 1 - smooth(seg(t, T.erase, T.act2 - 0.05));
  if (t >= T.act2) reveal = smooth(seg(t, T.act2, T.act2 + 0.55));
  return { act, reveal };
}

export function pose(world, t) {
  if (t < T.act2) {
    poseAct1(world.act1, t);
    cameraAct1(world.act1.camera, t);
  } else {
    poseAct2(world.act2, t);
    cameraAct2(world.act2.camera, t, world.act2);
  }
}

export { full };
