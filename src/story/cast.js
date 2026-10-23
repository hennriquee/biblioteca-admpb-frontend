import * as THREE from "three";
import { KIND, at, box, cylinder, joint, lathe, limb, merge, newId, part, sphere, tag, tube } from "./kit.js";

/**
 * O elenco da animacao da sugestao: o menino, o entregador, o cachorro, o
 * passaro e o caminhao. Cada um e um conjunto de juntas (grupos) que o
 * roteiro (script.js) gira e move; nenhum guarda estado proprio.
 *
 * Convencao: o personagem olha para +z; a esquerda dele e +x. Girar a junta
 * do quadril/ombro em x NEGATIVO leva a perna/braco para a frente; o joelho
 * dobra em x positivo e o cotovelo em x negativo.
 */

/** Sorteio com semente (o desenho sai sempre igual). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Mecha: um "chifre" que afina ate a ponta, seguindo a curva dada.
 */
function horn(points, r0, radial = 7) {
  const rings = points.length;
  const pos = [];
  const index = [];
  const frame = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i < rings; i += 1) {
    const p = points[i];
    const next = points[Math.min(rings - 1, i + 1)];
    const prev = points[Math.max(0, i - 1)];
    frame.copy(next).sub(prev).normalize();
    side.set(0, 1, 0).cross(frame);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0).cross(frame);
    side.normalize();
    up.copy(frame).cross(side).normalize();
    const u = i / (rings - 1);
    const r = r0 * Math.pow(1 - u, 0.75) + 0.0004;
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const d = Math.sin(a) * r * 0.75;
      pos.push(p.x + side.x * c + up.x * d, p.y + side.y * c + up.y * d, p.z + side.z * c + up.z * d);
    }
  }
  for (let i = 0; i < rings - 1; i += 1) {
    for (let k = 0; k < radial; k += 1) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      index.push(a, a + radial, b, b, a + radial, b + radial);
    }
  }
  // Tampa na raiz.
  const center = pos.length / 3;
  pos.push(points[0].x, points[0].y, points[0].z);
  for (let k = 0; k < radial; k += 1) index.push(center, k, (k + 1) % radial);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Cabelo arrepiado da referencia: um volume com mechas grossas e curvas que
 * escorrem do redemoinho (no alto, um pouco atras) para os lados e para a
 * nuca, as de baixo caindo e espetando para fora, e uma franja em tufos sobre
 * a testa. Fica no espaco da cabeca (origem no centro dela), que e o que a
 * hachura "de cabelo" usa para riscar a partir do topo.
 */
function messyHair(r, seed, { volume = 1.08, tufts = 100 } = {}) {
  const rand = rng(seed);
  const id = newId();
  const items = [];
  const style = { tone: 0.6, id, kind: KIND.hair };
  const tilt = new THREE.Matrix4().makeRotationX(-0.55);
  // A touca com a borda recortada em bicos irregulares (franja, costeletas
  // e nuca), em vez de uma linha reta de "capacete".
  const capMax = Math.PI * 0.56;
  const cap = new THREE.SphereGeometry(r * volume, 72, 18, 0, Math.PI * 2, 0, capMax);
  const cp = cap.attributes.position;
  const spikes = 15;
  const jag = Array.from({ length: spikes }, () => 0.55 + rand() * 0.6);
  for (let k = 0; k < cp.count; k += 1) {
    const x = cp.getX(k);
    const y = cp.getY(k);
    const z = cp.getZ(k);
    const rho = Math.hypot(x, y, z);
    let theta = Math.acos(y / rho);
    const phi = Math.atan2(z, x);
    const edge = Math.max(0, (theta - capMax * 0.62) / (capMax * 0.38));
    const w = ((phi / (Math.PI * 2)) * spikes + spikes) % spikes;
    const i0 = Math.floor(w);
    const tri = 1 - Math.abs((w - i0) * 2 - 1);
    // (Na frente os bicos sao mais curtos: a sobrancelha precisa aparecer.)
    const front = Math.max(0, Math.sin(phi));
    theta += edge * edge * tri * jag[i0] * (0.42 - 0.27 * front);
    cp.setXYZ(k, rho * Math.sin(theta) * Math.cos(phi), rho * Math.cos(theta), rho * Math.sin(theta) * Math.sin(phi));
  }
  cap.computeVertexNormals();
  items.push([cap, at(0, r * 0.03, -r * 0.05, { rx: -0.55 }), style]);
  const crown = new THREE.Vector3(0, 0.9, -0.42).normalize();
  const offset = new THREE.Vector3(0, r * 0.03, -r * 0.05);
  const dir = new THREE.Vector3();
  const flow = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i < tufts; i += 1) {
    // Raiz: espalhada pela touca, mais densa perto da borda.
    const a = rand() * Math.PI * 2;
    const polar = Math.pow(rand(), 0.7) * Math.PI * 0.52;
    dir.set(Math.sin(polar) * Math.cos(a), Math.cos(polar), Math.sin(polar) * Math.sin(a)).applyMatrix4(tilt).normalize();
    const L = r * (0.3 + rand() * 0.38);
    // Perto do redemoinho as mechas deitam (nada de "abacaxi" no alto).
    const nearCrown = Math.max(0, dir.dot(crown) - 0.6) / 0.4;
    const lift = (0.05 + rand() * 0.14) * (1 - 0.8 * nearCrown);
    const twist = (rand() - 0.5) * 0.6;
    const thick = r * (0.1 + rand() * 0.08);
    if ((dir.z > 0.55 && dir.y < 0.55) || dir.dot(crown) > 0.9) continue;
    flow.copy(dir).addScaledVector(crown, -dir.dot(crown));
    if (flow.lengthSq() < 1e-4) flow.set(0.3, 0, -0.5);
    flow.normalize();
    const gravity = 0.3 + 0.65 * Math.max(0, 1 - dir.y * 1.4);
    const start = dir.clone().multiplyScalar(r * (volume - 0.1)).add(offset);
    const points = [];
    for (let k = 0; k <= 6; k += 1) {
      const u = k / 6;
      const p = start.clone()
        .addScaledVector(flow, L * u)
        .addScaledVector(dir, L * lift * Math.sin(Math.PI * u * 0.75) + r * 0.05 * u)
        .addScaledVector(down, L * gravity * u * u)
        .add(new THREE.Vector3(twist * L * u * u, 0, -twist * L * u * u * 0.5));
      points.push(p);
    }
    items.push([horn(points, thick), null, style]);
  }
  // Franja: tufos que descem por FORA da touca, do alto ate a testa (a ponta
  // quebra a borda da touca em bicos), cada um para um lado.
  for (let i = 0; i < 9; i += 1) {
    const phi = ((i / 8) - 0.5) * 1.55 + (rand() - 0.5) * 0.12;
    const sway = phi * 0.35 + (rand() - 0.5) * 0.3;
    const from = 0.32 + rand() * 0.12;
    const to = 1.05 + rand() * 0.12 - Math.abs(phi) * 0.2;
    const points = [];
    for (let k = 0; k <= 7; k += 1) {
      const u = k / 7;
      const polar = from + (to - from) * u;
      const az = phi + sway * u;
      const rho = r * (1.07 + 0.13 * Math.sin(Math.PI * u * 0.85));
      points.push(new THREE.Vector3(Math.sin(polar) * Math.sin(az) * rho, Math.cos(polar) * rho + r * 0.03, Math.sin(polar) * Math.cos(az) * rho - r * 0.05));
    }
    items.push([horn(points, r * (0.15 + rand() * 0.05)), null, style]);
  }
  return merge(items);
}

/**
 * Uma pessoa. spec: medidas e tons (ver BOY e COURIER). Devolve as juntas e
 * as pecas do rosto, para o roteiro animar.
 */
function person(material, spec) {
  const s = spec;
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0);
  const hips = joint(body, 0, s.hipY, 0);
  part(sphere(1, 16, 12), material, { tone: s.pants }, hips).scale.set(s.pelvis[0], s.pelvis[1], s.pelvis[2]);

  const legs = [1, -1].map((side) => {
    const hip = joint(hips, side * s.legX, 0, 0);
    part(limb(s.thigh[0], s.thigh[1], s.thigh[2]), material, { tone: s.pants }, hip);
    if (s.shorts) {
      const shorts = part(limb(s.shorts[0], s.shorts[1], s.shorts[2]), material, { tone: s.pants }, hip);
      shorts.position.y = 0.02;
    }
    const knee = joint(hip, 0, -s.thigh[2], 0);
    part(limb(s.shin[0], s.shin[1], s.shin[2]), material, { tone: s.shinTone }, knee);
    if (s.sock) {
      const sock = part(limb(s.shin[1] * 1.12, s.shin[1] * 1.08, 0.07), material, { tone: 0.06 }, knee);
      sock.position.y = -s.shin[2] + 0.07;
    }
    const ankle = joint(knee, 0, -s.shin[2], 0);
    const foot = joint(ankle, 0, 0, 0);
    const shoe = part(box(s.foot[0], s.foot[1], s.foot[2], s.foot[1] * 0.45), material, { tone: s.shoe }, foot);
    shoe.position.set(0, -s.foot[1] * 0.5, s.foot[2] * 0.26);
    const sole = part(box(s.foot[0] * 1.04, s.foot[1] * 0.28, s.foot[2] * 1.02, 0.01), material, { tone: 0.05 }, foot);
    sole.position.set(0, -s.foot[1] * 0.95, s.foot[2] * 0.26);
    return { hip, knee, ankle: foot, side };
  });

  const spine = joint(hips, 0, s.spineY, 0);
  const torso = part(lathe(s.torso, 22), material, { tone: s.shirt }, spine);
  torso.scale.z = s.torsoDepth;
  if (s.belly) {
    const belly = part(sphere(s.belly[0], 20, 16), material, { tone: s.shirt }, spine);
    belly.position.set(0, s.belly[1], s.belly[2]);
    belly.scale.set(1, 0.92, 0.95);
  }
  if (s.overalls) {
    const bib = part(box(s.overalls[0], s.overalls[1], 0.05, 0.02), material, { tone: s.pants }, spine);
    bib.position.set(0, s.overalls[2], s.overalls[3]);
    bib.rotation.x = -0.12;
    for (const side of [1, -1]) {
      const strap = part(box(0.04, 0.32, 0.03, 0.01), material, { tone: s.pants }, spine);
      strap.position.set(side * s.overalls[0] * 0.33, s.overalls[2] + 0.2, s.overalls[3] - 0.03);
      strap.rotation.x = -0.35;
      const button = part(cylinder(0.018, 0.018, 0.012, 10), material, { tone: 0.05 }, spine);
      button.position.set(side * s.overalls[0] * 0.33, s.overalls[2] + 0.06, s.overalls[3] + 0.03);
      button.rotation.x = Math.PI / 2;
    }
  }
  if (s.belt) {
    // Cinto, alca atravessada no peito e a bolsa de entregador no quadril.
    const belt = part(new THREE.TorusGeometry(0.235, 0.028, 6, 24), material, { tone: 0.8 }, spine);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, s.torsoDepth, 1);
    belt.position.y = 0.03;
    const buckle = part(box(0.06, 0.05, 0.02, 0.008), material, { tone: 0.05 }, spine);
    buckle.position.set(0, 0.03, 0.235 * s.torsoDepth + 0.13);
    const strap = part(tube([[0.17, 0.5, 0.02], [0.05, 0.38, 0.33], [-0.16, 0.13, 0.33], [-0.27, 0.0, 0.05]], 0.022, 20, 6), material, { tone: 0.75 }, spine);
    strap.scale.z = 1;
    const satchel = part(box(0.08, 0.2, 0.26, 0.03), material, { tone: 0.55 }, spine);
    satchel.position.set(-0.29, -0.06, 0.02);
    const flap = part(box(0.085, 0.09, 0.265, 0.02), material, { tone: 0.7 }, spine);
    flap.position.set(-0.295, 0.02, 0.02);
  }
  // Gola da camiseta.
  const collar = part(new THREE.TorusGeometry(s.neck[0] * 1.55, s.neck[0] * 0.32, 6, 18), material, { tone: s.shirt }, spine);
  collar.position.y = s.neckY - 0.005;
  collar.rotation.x = Math.PI / 2 + 0.12;

  const arms = [1, -1].map((side) => {
    const shoulder = joint(spine, side * s.shoulderX, s.shoulderY, 0);
    const sleeve = part(limb(s.sleeve[0], s.sleeve[1], s.sleeve[2]), material, { tone: s.shirt }, shoulder);
    sleeve.scale.z = 0.92;
    part(limb(s.upper[0], s.upper[1], s.upper[2]), material, { tone: s.armTone }, shoulder);
    const elbow = joint(shoulder, 0, -s.upper[2], 0);
    part(limb(s.fore[0], s.fore[1], s.fore[2]), material, { tone: s.armTone }, elbow);
    const wrist = joint(elbow, 0, -s.fore[2], 0);
    const hand = joint(wrist, 0, 0, 0);
    const handId = newId();
    const palm = part(sphere(1, 14, 10), material, { tone: s.handTone, id: handId }, hand);
    palm.scale.set(s.hand * 0.82, s.hand, s.hand * 0.48);
    palm.position.y = -s.hand * 0.85;
    const thumb = part(limb(s.hand * 0.3, s.hand * 0.24, s.hand * 0.75), material, { tone: s.handTone, id: handId }, hand);
    thumb.position.set(side * s.hand * 0.55, -s.hand * 0.5, s.hand * 0.25);
    thumb.rotation.set(-0.5, 0, side * 0.6);
    return { shoulder, elbow, wrist: hand, side };
  });

  const neck = joint(spine, 0, s.neckY, 0);
  part(limb(s.neck[0], s.neck[1], s.neck[2]), material, { tone: s.skin }, neck).position.y = s.neck[2];
  const head = joint(neck, 0, s.neck[2], 0);
  const R = s.headR;
  const skull = joint(head, 0, R * 0.92, 0);
  const headMesh = part(sphere(R, 28, 20), material, { tone: s.skin }, skull);
  headMesh.scale.set(1, s.headStretch, 0.98);
  if (s.jaw) {
    // Bochechas/queixo: o rosto mais cheio embaixo.
    const jaw = part(sphere(R * 0.82, 22, 16), material, { tone: s.skin, id: headMesh.geometry.attributes.aId.array[0] }, skull);
    jaw.position.set(0, -R * 0.36, R * 0.12);
    jaw.scale.set(1.06, 0.74, 0.92);
  }
  for (const side of [1, -1]) {
    const ear = part(sphere(R * 0.24, 12, 10), material, { tone: s.skin }, skull);
    ear.position.set(side * R * 0.97, -R * 0.06, -R * 0.02);
    ear.scale.set(0.45, 1, 0.75);
  }
  const nose = part(sphere(R * s.nose, 14, 10), material, { tone: s.skin }, skull);
  nose.position.set(0, -R * 0.22, R * 0.99);
  nose.scale.set(1, 0.9, 1.05);

  // Olhos: o branco com a pupila (que olha para os lados) e o brilho; a
  // palpebra fecha achatando o olho. A sobrancelha e um arco grosso.
  const eyes = [1, -1].map((side) => {
    const socket = joint(skull, side * R * s.eyeX, R * (s.eyeY ?? 0.1), R * 0.86);
    socket.rotation.y = side * 0.3;
    const eye = joint(socket, 0, 0, 0);
    const white = part(sphere(1, 16, 12), material, { tone: 0.0, kind: KIND.plain }, eye);
    white.scale.set(R * s.eyeSize[0], R * s.eyeSize[1], R * 0.09);
    const look = joint(eye, 0, 0, R * 0.065);
    const pupil = part(sphere(1, 12, 10), material, { kind: KIND.solid }, look);
    pupil.scale.set(R * s.eyeSize[0] * 0.55, R * s.eyeSize[1] * 0.6, R * 0.04);
    const shine = part(sphere(R * 0.035, 8, 6), material, { tone: 0, kind: KIND.plain }, look);
    shine.position.set(-side * R * s.eyeSize[0] * 0.2, R * s.eyeSize[1] * 0.25, R * 0.035);
    const brow = joint(skull, side * R * s.eyeX, R * ((s.eyeY ?? 0.1) + 0.34), R * 0.92);
    brow.rotation.y = side * 0.3;
    const arch = part(new THREE.TorusGeometry(R * 0.17, R * s.brow * 0.55, 6, 12, Math.PI * 0.62), material, { tone: s.browTone, kind: KIND.solid }, brow);
    arch.rotation.z = Math.PI * 0.19;
    arch.position.y = -R * 0.13;
    return { socket, eye, look, shine, brow, side };
  });

  const mouth = joint(skull, 0, -R * 0.5, R * 0.9);
  mouth.rotation.x = -0.3;
  const smile = part(new THREE.TorusGeometry(R * 0.2, R * 0.04, 6, 16, Math.PI), material, { kind: KIND.solid }, mouth);
  smile.rotation.z = Math.PI;
  const open = part(sphere(1, 14, 10), material, { kind: KIND.solid }, mouth);
  open.scale.set(R * 0.2, R * 0.16, R * 0.06);
  open.position.y = -R * 0.04;
  // Sorriso aberto (um "D" deitado): a metade de baixo de uma bola.
  const grin = part(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), material, { kind: KIND.solid }, mouth);
  grin.scale.set(R * 0.27, R * 0.22, R * 0.07);
  grin.position.y = R * 0.02;
  // Olho feliz, fechado em arco ("^").
  for (const e of eyes) {
    const arc = part(new THREE.TorusGeometry(R * 0.12, R * 0.03, 6, 12, Math.PI), material, { kind: KIND.solid }, e.socket);
    arc.position.y = -R * 0.04;
    e.happy = arc;
  }

  if (s.hair === "messy") {
    const hair = new THREE.Mesh(messyHair(R, 7), material);
    hair.frustumCulled = false;
    skull.add(hair);
  }
  if (s.cap) {
    const capId = newId();
    const crown = part(new THREE.SphereGeometry(R * 1.06, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), material, { tone: s.cap, id: capId }, skull);
    crown.position.y = R * 0.32;
    crown.scale.set(1, 0.85, 1);
    const band = part(cylinder(R * 1.07, R * 1.07, R * 0.22, 22, true), material, { tone: s.cap * 0.7, id: capId }, skull);
    band.position.y = R * 0.36;
    const visor = part(new THREE.CylinderGeometry(R * 0.95, R * 0.95, R * 0.06, 20, 1, false, -Math.PI * 0.5, Math.PI), material, { tone: s.cap }, skull);
    visor.position.set(0, R * 0.3, R * 0.52);
    visor.scale.set(1, 1, 0.72);
    visor.rotation.x = 0.18;
    visor.rotation.y = Math.PI;
    const button = part(sphere(R * 0.1, 8, 6), material, { tone: s.cap }, skull);
    button.position.y = R * 1.2;
    // Um tufo de cabelo saindo por tras do bone.
    const tuft = part(sphere(R * 0.55, 14, 10), material, { tone: 0.75, kind: KIND.hair }, skull);
    tuft.position.set(0, -R * 0.12, -R * 0.72);
    tuft.scale.set(1.6, 0.8, 0.6);
  }
  if (s.mustache) {
    for (const side of [1, -1]) {
      const m = part(limb(R * 0.13, R * 0.06, R * 0.42), material, { tone: 0.85, kind: KIND.hair }, skull);
      m.position.set(side * R * 0.05, -R * 0.3, R * 0.97);
      m.rotation.set(0.2, 0, side * 1.2);
    }
  }

  return { root, body, hips, spine, neck, head, skull, legs, arms, eyes, smile, open, grin, mouth, spec };
}

export const BOY = {
  hipY: 0.55,
  pelvis: [0.11, 0.075, 0.08],
  legX: 0.06,
  thigh: [0.046, 0.04, 0.22],
  shorts: [0.078, 0.076, 0.18],
  shin: [0.035, 0.03, 0.25],
  sock: true,
  foot: [0.1, 0.085, 0.23],
  spineY: 0.0,
  // Camiseta larga, caida dos ombros (como na referencia).
  torso: [[0.0, -0.08], [0.15, -0.08], [0.158, -0.04], [0.152, 0.06], [0.155, 0.18], [0.16, 0.27], [0.15, 0.31], [0.1, 0.345], [0.0, 0.352]],
  torsoDepth: 0.64,
  shoulderX: 0.15,
  shoulderY: 0.285,
  sleeve: [0.062, 0.074, 0.17],
  upper: [0.027, 0.025, 0.2],
  fore: [0.025, 0.023, 0.17],
  hand: 0.044,
  neck: [0.03, 0.028, 0.07],
  neckY: 0.335,
  headR: 0.15,
  headStretch: 1.04,
  jaw: true,
  nose: 0.1,
  eyeX: 0.32,
  eyeY: 0.0,
  eyeSize: [0.17, 0.23],
  brow: 0.055,
  browTone: 0.9,
  hair: "messy",
  skin: 0.03,
  armTone: 0.03,
  handTone: 0.03,
  shinTone: 0.03,
  shirt: 0.5,
  pants: 0.7,
  shoe: 0.25,
};

export const COURIER = {
  hipY: 0.74,
  pelvis: [0.2, 0.13, 0.16],
  legX: 0.11,
  thigh: [0.085, 0.075, 0.34],
  shin: [0.07, 0.06, 0.32],
  foot: [0.13, 0.1, 0.29],
  spineY: 0.02,
  torso: [[0.0, -0.06], [0.21, -0.06], [0.25, 0.06], [0.26, 0.2], [0.24, 0.36], [0.2, 0.47], [0.12, 0.53], [0.0, 0.54]],
  torsoDepth: 0.85,
  belly: [0.23, 0.17, 0.09],
  belt: 0.16,
  shoulderX: 0.23,
  shoulderY: 0.44,
  sleeve: [0.075, 0.072, 0.17],
  upper: [0.06, 0.052, 0.3],
  fore: [0.054, 0.046, 0.27],
  hand: 0.062,
  neck: [0.065, 0.065, 0.06],
  neckY: 0.51,
  headR: 0.185,
  headStretch: 1.02,
  jaw: true,
  nose: 0.28,
  eyeX: 0.33,
  eyeY: 0.06,
  eyeSize: [0.12, 0.16],
  brow: 0.085,
  browTone: 0.9,
  cap: 0.62,
  mustache: true,
  skin: 0.05,
  armTone: 0.08,
  handTone: 0.05,
  shinTone: 0.55,
  shirt: 0.15,
  pants: 0.55,
  shoe: 0.75,
};

export function makeBoy(material) {
  const boy = person(material, BOY);
  // A sacola dos livros: fica na mao (ou nos bracos) conforme o roteiro.
  boy.bag = makeBag(material);
  return boy;
}

export function makeCourier(material) {
  return person(material, COURIER);
}

/**
 * Sacola de pano cheia de livros: o corpo da sacola, as alcas e as lombadas
 * aparecendo por cima. Origem nas alcas (onde a mao segura).
 */
export function makeBag(material) {
  const bag = new THREE.Group();
  const body = joint(bag, 0, -0.17, 0);
  const sack = part(lathe([[0.0, -0.17], [0.17, -0.17], [0.19, -0.1], [0.19, 0.08], [0.175, 0.15], [0.16, 0.155]], 20), material, { tone: 0.18 }, body);
  sack.scale.z = 0.5;
  // Costura e uma faixa estampada (a sacola tem "cara" de feira).
  const band = part(cylinder(0.192, 0.192, 0.045, 20, true), material, { tone: 0.55 }, body);
  band.scale.z = 0.52;
  band.position.y = -0.02;
  const rand = rng(31);
  const spines = [];
  for (let i = 0; i < 5; i += 1) {
    const w = 0.04 + rand() * 0.02;
    const h = 0.2 + rand() * 0.05;
    const b = part(box(0.13, h, w, 0.008), material, { tone: [0.6, 0.25, 0.75, 0.4, 0.15][i] }, body);
    b.position.set(-0.11 + i * 0.055, 0.06 + rand() * 0.03, (rand() - 0.5) * 0.03);
    b.rotation.set(0, Math.PI / 2, (rand() - 0.5) * 0.25);
    spines.push(b);
  }
  for (const side of [1, -1]) {
    const handle = part(tube([[side * 0.1, -0.02, 0], [side * 0.08, 0.1, 0], [0, 0.17, 0], [-side * 0.02, 0.1, 0]], 0.012, 16, 6), material, { tone: 0.18 }, body);
    handle.position.set(side * 0.02, 0.12, side * 0.02);
  }
  return Object.assign(bag, { body, spines });
}

/** Cachorro vira-lata: corpo, cabeca com focinho, orelhas caidas, rabo. */
export function makeDog(material) {
  const root = new THREE.Group();
  const body = joint(root, 0, 0.32, 0);
  const torso = part(limb(0.12, 0.1, 0.36), material, { tone: 0.3 }, body);
  torso.rotation.x = Math.PI / 2;
  torso.position.z = 0.2;
  const spot = part(sphere(0.085, 12, 10), material, { tone: 0.75 }, body);
  spot.position.set(0.06, 0.07, 0.02);
  spot.scale.set(0.7, 0.6, 1.1);
  const neck = joint(body, 0, 0.06, 0.2);
  const head = joint(neck, 0, 0.1, 0.05);
  const skull = part(sphere(0.1, 16, 12), material, { tone: 0.28 }, head);
  skull.scale.set(1, 0.92, 1.05);
  const snout = part(limb(0.05, 0.045, 0.1), material, { tone: 0.2 }, head);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.03, 0.06);
  const noseTip = part(sphere(0.026, 10, 8), material, { kind: KIND.solid }, head);
  noseTip.position.set(0, -0.015, 0.2);
  const ears = [1, -1].map((side) => {
    const ear = joint(head, side * 0.075, 0.06, -0.01);
    const flap = part(limb(0.035, 0.045, 0.1), material, { tone: 0.7 }, ear);
    flap.scale.z = 0.4;
    ear.rotation.z = side * 0.35;
    return ear;
  });
  for (const side of [1, -1]) {
    const eye = part(sphere(0.018, 10, 8), material, { kind: KIND.solid }, head);
    eye.position.set(side * 0.042, 0.03, 0.085);
  }
  const tail = joint(body, 0, 0.06, -0.15);
  part(limb(0.025, 0.012, 0.18), material, { tone: 0.32 }, tail).rotation.x = Math.PI * 0.75;
  const legs = [
    [0.07, 0.17],
    [-0.07, 0.17],
    [0.07, -0.13],
    [-0.07, -0.13],
  ].map(([x, z]) => {
    const hip = joint(body, x, -0.02, z);
    part(limb(0.034, 0.026, 0.27), material, { tone: 0.3 }, hip);
    const paw = part(sphere(0.032, 10, 8), material, { tone: 0.15 }, hip);
    paw.position.set(0, -0.29, 0.015);
    paw.scale.set(1, 0.7, 1.3);
    return hip;
  });
  return { root, body, neck, head, ears, tail, legs };
}

/** Passaro (andorinha escura, como o da referencia), com asas que batem. */
export function makeBird(material, tone = 0.85) {
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0);
  const torso = part(sphere(1, 12, 10), material, { tone }, body);
  torso.scale.set(0.05, 0.045, 0.11);
  const head = part(sphere(0.038, 12, 10), material, { tone }, body);
  head.position.set(0, 0.025, 0.1);
  const beak = part(new THREE.ConeGeometry(0.012, 0.04, 6), material, { tone: 0.6 }, body);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.02, 0.145);
  const tail = joint(body, 0, 0, -0.09);
  const fork = new THREE.Shape();
  fork.moveTo(-0.01, 0);
  fork.lineTo(-0.05, -0.13);
  fork.lineTo(0, -0.07);
  fork.lineTo(0.05, -0.13);
  fork.lineTo(0.01, 0);
  const tailMesh = part(new THREE.ShapeGeometry(fork), material, { tone }, tail);
  tailMesh.rotation.x = -Math.PI / 2;
  const wing = new THREE.Shape();
  wing.moveTo(0, 0.04);
  wing.quadraticCurveTo(0.12, 0.07, 0.26, -0.02);
  wing.quadraticCurveTo(0.14, -0.01, 0, -0.05);
  wing.lineTo(0, 0.04);
  const wings = [1, -1].map((side) => {
    const shoulder = joint(body, side * 0.035, 0.015, 0.01);
    const w = part(new THREE.ShapeGeometry(wing), material, { tone }, shoulder);
    w.rotation.x = -Math.PI / 2;
    if (side < 0) w.scale.x = -1;
    return shoulder;
  });
  return { root, body, wings, tail };
}

/**
 * O caminhao "desengoncado": cabine alta de bico redondo, farois grandes
 * como olhos, bau mais alto que a cabine, escapamento de pe atras da cabine e
 * um rack com caixas amarradas no teto. Cabine e bau balancam cada um do seu
 * jeito (o bau atrasa), e as rodas sambam.
 *
 * Origem no chao, no meio do eixo de tras; frente para +z.
 */
export function makeTruck(material, decals) {
  const root = new THREE.Group();
  const wheels = [];
  const wheelId = newId();
  const wheelAt = (x, z) => {
    const hub = joint(root, x, 0.42, z);
    const spin = joint(hub, 0, 0, 0);
    const tire = part(new THREE.TorusGeometry(0.33, 0.12, 10, 22), material, { tone: 0.88, id: wheelId }, spin);
    tire.rotation.y = Math.PI / 2;
    const rim = part(cylinder(0.25, 0.25, 0.16, 18), material, { tone: 0.12 }, spin);
    rim.rotation.z = Math.PI / 2;
    const cap = part(sphere(0.12, 12, 8), material, { tone: 0.05 }, spin);
    cap.scale.set(0.5, 1, 1);
    cap.position.x = Math.sign(x) * 0.08;
    for (let i = 0; i < 5; i += 1) {
      const bolt = part(sphere(0.022, 6, 5), material, { kind: KIND.solid }, spin);
      const a = (i / 5) * Math.PI * 2;
      bolt.position.set(Math.sign(x) * 0.085, Math.cos(a) * 0.17, Math.sin(a) * 0.17);
    }
    wheels.push({ hub, spin });
  };
  wheelAt(1.0, 0);
  wheelAt(-1.0, 0);
  wheelAt(1.0, 2.9);
  wheelAt(-1.0, 2.9);

  // Chassi (fica no lugar) e a carroceria na "mola".
  part(box(1.5, 0.22, 4.4, 0.05), material, { tone: 0.8 }, root).position.set(0, 0.62, 1.4);
  const body = joint(root, 0, 0.72, 1.6);
  const cab = joint(body, 0, 0, 0.6);
  const cargo = joint(body, 0, 0, -0.35);

  // Bico: capo arredondado, grade e para-choque.
  const hood = part(box(1.7, 0.85, 1.25, 0.32), material, { tone: 0.32 }, cab);
  hood.position.set(0, 0.42, 1.25);
  const grille = part(box(1.0, 0.6, 0.1, 0.06), material, { tone: 0.75 }, cab);
  grille.position.set(0, 0.42, 1.86);
  for (let i = 0; i < 7; i += 1) {
    const bar = part(box(0.035, 0.56, 0.05), material, { tone: 0.05 }, cab);
    bar.position.set(-0.42 + i * 0.14, 0.42, 1.91);
  }
  const bumper = part(box(2.1, 0.2, 0.22, 0.09), material, { tone: 0.08 }, cab);
  bumper.position.set(0, 0.0, 1.95);
  const plate = part(box(0.42, 0.16, 0.03, 0.01), material, { tone: 0.0 }, cab);
  plate.position.set(0, 0.0, 2.07);
  // Para-lamas redondos e os farois, grandes como olhos, um pouco tortos.
  const lights = [];
  for (const side of [1, -1]) {
    const fender = part(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 20, 1, true, 0, Math.PI), material, { tone: 0.35 }, cab);
    fender.rotation.set(0, 0, Math.PI / 2);
    fender.rotation.order = "ZYX";
    fender.position.set(side * 0.9, -0.3, 1.3);
    const lamp = joint(cab, side * 0.66, 0.72, 1.72);
    const shell = part(cylinder(0.2, 0.22, 0.2, 18), material, { tone: 0.15 }, lamp);
    shell.rotation.x = Math.PI / 2;
    const lens = part(sphere(0.18, 16, 10), material, { tone: 0.0, kind: KIND.plain }, lamp);
    lens.position.z = 0.1;
    lens.scale.z = 0.45;
    const lid = part(new THREE.SphereGeometry(0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.38), material, { tone: 0.45 }, lamp);
    lid.rotation.x = 0.9;
    lid.position.z = 0.02;
    lights.push(lamp);
  }
  // Cabine alta, de cantos bem redondos.
  const cabin = part(box(1.85, 1.45, 1.35, 0.34), material, { tone: 0.32 }, cab);
  cabin.position.set(0, 1.18, 0.05);
  const roof = part(box(1.95, 0.12, 1.5, 0.06), material, { tone: 0.5 }, cab);
  roof.position.set(0, 1.93, 0.05);
  const glass = part(box(1.45, 0.62, 0.08, 0.08), material, { tone: 0.78 }, cab);
  glass.position.set(0, 1.42, 0.72);
  glass.rotation.x = -0.1;
  const glint = part(box(0.05, 0.36, 0.02), material, { tone: 0, kind: KIND.plain }, cab);
  glint.position.set(0.42, 1.46, 0.77);
  glint.rotation.set(-0.1, 0, 0.55);
  // Portas: a do lado da calcada abre (dobradica na frente).
  const doors = [1, -1].map((side) => {
    const hinge = joint(cab, side * 0.94, 0.95, 0.62);
    const door = part(box(0.06, 1.05, 1.02, 0.04), material, { tone: 0.3 }, hinge);
    door.position.set(0, 0.0, -0.52);
    const win = part(box(0.07, 0.46, 0.68, 0.06), material, { tone: 0.78 }, hinge);
    win.position.set(side * 0.005, 0.3, -0.5);
    const handle = part(box(0.05, 0.04, 0.14, 0.015), material, { tone: 0.05 }, hinge);
    handle.position.set(side * 0.05, -0.06, -0.85);
    return hinge;
  });
  // Retrovisores em hastes compridas (balancam).
  const mirrors = [1, -1].map((side) => {
    const arm = joint(cab, side * 0.98, 1.5, 0.62);
    part(tube([[0, 0, 0], [side * 0.18, 0.08, 0.05], [side * 0.3, 0.12, 0.05]], 0.015, 8, 5), material, { tone: 0.1 }, arm);
    const glassM = part(box(0.06, 0.22, 0.14, 0.03), material, { tone: 0.6 }, arm);
    glassM.position.set(side * 0.32, 0.12, 0.05);
    return arm;
  });
  // Escapamento de pe, atras da cabine, com a boca virada.
  const pipe = joint(cab, 0.75, 0.9, -0.72);
  part(cylinder(0.07, 0.07, 1.5, 12), material, { tone: 0.7 }, pipe).position.y = 0.75;
  const pipeTop = part(limb(0.075, 0.07, 0.25), material, { tone: 0.7 }, pipe);
  pipeTop.position.y = 1.5;
  pipeTop.rotation.z = -1.9;

  // O bau.
  const crate = part(box(2.2, 2.05, 2.95, 0.12), material, { tone: 0.06 }, cargo);
  crate.position.set(0, 1.42, -0.55);
  const trim = part(box(2.26, 0.14, 3.0, 0.04), material, { tone: 0.55 }, cargo);
  trim.position.set(0, 0.45, -0.55);
  const trimTop = part(box(2.26, 0.1, 3.0, 0.04), material, { tone: 0.55 }, cargo);
  trimTop.position.set(0, 2.42, -0.55);
  // Letreiro dos dois lados do bau.
  if (decals?.truck) {
    for (const side of [1, -1]) {
      const sign = new THREE.Mesh(tag(new THREE.PlaneGeometry(2.6, 1.3), { tone: 0.06, kind: KIND.plain, keepUv: true }), decals.truck);
      sign.frustumCulled = false;
      sign.position.set(side * 1.106, 1.45, -0.55);
      sign.rotation.y = side * Math.PI / 2;
      cargo.add(sign);
    }
  }
  // Porta lateral do bau (lado da calcada, -x), que corre para tras.
  const slide = joint(cargo, -1.12, 1.25, 0.25);
  const slideDoor = part(box(0.06, 1.55, 1.0, 0.04), material, { tone: 0.12 }, slide);
  slideDoor.position.z = 0;
  const slideHandle = part(box(0.06, 0.2, 0.05, 0.015), material, { tone: 0.8 }, slide);
  slideHandle.position.set(-0.04, 0, 0.38);
  const dark = part(box(0.04, 1.5, 0.96), material, { tone: 0.92, kind: KIND.solid }, cargo);
  dark.position.set(-1.08, 1.25, 0.25);

  // Rack no teto com duas caixas amarradas.
  const rack = joint(cargo, 0, 2.48, -0.55);
  for (const x of [-0.95, 0.95]) {
    part(box(0.05, 0.22, 2.8, 0.02), material, { tone: 0.6 }, rack).position.set(x, 0.11, 0);
  }
  const boxes = [
    [0.1, 0.0, -0.4, 0.9, 0.5, 0.75, 0.12],
    [-0.1, 0.5, -0.5, 0.75, 0.4, 0.6, -0.18],
  ].map(([x, y, z, w, h, d, r]) => {
    const pivot = joint(rack, x, 0.05 + y, z);
    const carton = part(box(w, h, d, 0.03), material, { tone: 0.24 }, pivot);
    carton.position.y = h / 2;
    pivot.rotation.y = r;
    part(box(w * 1.02, 0.03, 0.05), material, { tone: 0.8 }, pivot).position.y = h + 0.012;
    return pivot;
  });

  return { root, body, cab, cargo, wheels, doors, slide, mirrors, pipe, lights, rack, boxes };
}

/** Fumacinha do escapamento (e do tranco): bolas que crescem e somem. */
export function makePuffs(material, count) {
  const group = new THREE.Group();
  const id = newId();
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const g = new THREE.Group();
    const r = rng(100 + i);
    for (let k = 0; k < 7; k += 1) {
      const ball = part(new THREE.IcosahedronGeometry(0.08 + r() * 0.09, 1), material, { tone: 0.02, id: k % 2 ? id : newId() }, g);
      const a = (k / 7) * Math.PI * 2;
      ball.position.set(Math.cos(a) * 0.15 * (0.6 + r()), (r() - 0.5) * 0.16, Math.sin(a) * 0.15 * (0.6 + r()));
    }
    g.visible = false;
    group.add(g);
    list.push(g);
  }
  return { group, list };
}
