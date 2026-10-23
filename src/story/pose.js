import { clamp, keys, lerp } from "./kit.js";

/**
 * Poses dos personagens: um objeto com os angulos de cada junta, que da para
 * misturar (mix) e aplicar no boneco (applyPose). Os braços e as pernas usam
 * "abrir para fora" positivo dos dois lados (o lado direito e espelhado aqui).
 *
 * arm: [frente/tras (x; negativo = para a frente), giro (y), abrir (z),
 *       cotovelo (negativo dobra), punho]
 * leg: [frente/tras (x; negativo = para a frente), abrir (z), joelho
 *       (positivo dobra), tornozelo]
 * face: brow (sobe), worry (meio da sobrancelha sobe = preocupado/pedindo;
 *       negativo = bravo/decidido), eye (1 aberto, 0 fechado; >1 arregalado),
 *       smile (-1 a 1), open (boca aberta 0 a 1), squint (olho feliz).
 */
export const REST = {
  bob: 0,
  lean: 0,
  tilt: 0,
  twist: 0,
  spine: [0, 0, 0],
  neck: [0, 0, 0],
  head: [0, 0, 0],
  armL: [0.05, 0, 0.12, -0.15, 0],
  armR: [0.05, 0, 0.12, -0.15, 0],
  legL: [0, 0.02, 0, 0],
  legR: [0, 0.02, 0, 0],
  face: { brow: 0, worry: 0, eye: 1, smile: 0.25, open: 0, squint: 0, lookX: 0, lookY: 0 },
};

function mixValue(a, b, u) {
  if (typeof a === "number") return lerp(a, b ?? a, u);
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, (b ?? a)[i] ?? v, u));
  const out = {};
  for (const k of Object.keys(a)) out[k] = mixValue(a[k], b?.[k], u);
  return out;
}

/** Completa uma pose parcial com o descanso. */
export function full(pose) {
  const out = mixValue(REST, REST, 0);
  for (const k of Object.keys(pose || {})) {
    if (k === "face") out.face = { ...out.face, ...pose.face };
    else out[k] = pose[k];
  }
  return out;
}

export function mix(a, b, u) {
  return mixValue(a, b, clamp(u));
}

/**
 * Sequencia de poses: [[instante, pose parcial, curva?], ...]. Cada pose e
 * completada com o descanso antes de misturar.
 */
export function track(list) {
  const full_ = list.map(([t, p, curve]) => [t, full(p), curve]);
  return (t) => {
    if (t <= full_[0][0]) return full_[0][1];
    for (let i = 1; i < full_.length; i += 1) {
      const [t1, p1, curve] = full_[i];
      if (t <= t1) {
        const [t0, p0] = full_[i - 1];
        const u = keys(t, [[t0, 0], [t1, 1, curve]]);
        return mixValue(p0, p1, u);
      }
    }
    return full_[full_.length - 1][1];
  };
}

/** Soma (camadas): base + delta * peso, so nos campos de "delta". */
export function add(base, delta, weight = 1) {
  const out = mixValue(base, base, 0);
  for (const k of Object.keys(delta)) {
    const d = delta[k];
    if (k === "face") {
      for (const f of Object.keys(d)) out.face[f] += d[f] * weight;
    } else if (typeof d === "number") {
      out[k] += d * weight;
    } else {
      out[k] = out[k].map((v, i) => v + (d[i] || 0) * weight);
    }
  }
  return out;
}

/**
 * Ciclo de caminhada. phase em ciclos (2 passos); amount 0 a 1; bounce > 1
 * deixa o passo saltitante (menino feliz); waddle bambeia (entregador).
 */
export function walkDelta(phase, amount, { stride = 0.5, bounce = 1, waddle = 0, arms = 1 } = {}) {
  const p = phase * Math.PI * 2;
  const s = Math.sin(p);
  const leg = (q) => {
    const sq = Math.sin(q);
    const cq = Math.cos(q);
    return [-stride * sq, 0, 1.05 * Math.max(0, cq) * (0.6 + 0.4 * bounce), 0.35 * Math.max(0, -sq) - 0.25 * Math.max(0, cq)];
  };
  const L = leg(p);
  const R = leg(p + Math.PI);
  const a = 0.45 * arms;
  return {
    bob: (0.025 * Math.cos(2 * p) + (bounce > 1 ? 0.035 * (bounce - 1) * Math.abs(Math.cos(p)) : 0)) * amount,
    tilt: waddle * 0.09 * s * amount,
    twist: 0.12 * s * amount,
    spine: [0.04 * amount, -0.16 * s * amount, -waddle * 0.06 * s * amount],
    head: [0, 0.04 * s * amount, waddle * 0.05 * s * amount],
    armL: [a * s * amount, 0, 0.04 * Math.abs(s) * amount, -0.25 * amount * (1 + 0.5 * Math.max(0, -s)), 0],
    armR: [-a * s * amount, 0, 0.04 * Math.abs(s) * amount, -0.25 * amount * (1 + 0.5 * Math.max(0, s)), 0],
    legL: L.map((v) => v * amount),
    legR: R.map((v) => v * amount),
  };
}

/** Aplica a pose nas juntas do boneco (ver person em cast.js). */
export function applyPose(rig, pose) {
  rig.body.position.y = pose.bob;
  rig.body.rotation.set(pose.lean, 0, pose.tilt);
  rig.hips.rotation.y = pose.twist;
  rig.spine.rotation.set(pose.spine[0], pose.spine[1], pose.spine[2]);
  rig.neck.rotation.set(pose.neck[0], pose.neck[1], pose.neck[2]);
  rig.head.rotation.set(pose.head[0], pose.head[1], pose.head[2]);
  for (const arm of rig.arms) {
    const a = arm.side > 0 ? pose.armL : pose.armR;
    arm.shoulder.rotation.set(a[0], a[1] * arm.side, a[2] * arm.side);
    arm.elbow.rotation.set(a[3], 0, 0);
    arm.wrist.rotation.set(a[4], 0, 0);
  }
  for (const leg of rig.legs) {
    const l = leg.side > 0 ? pose.legL : pose.legR;
    leg.hip.rotation.set(l[0], 0, l[1] * leg.side);
    leg.knee.rotation.set(l[2], 0, 0);
    leg.ankle.rotation.set(l[3] - l[0] * 0.2 - l[2] * 0.35, 0, 0);
  }
  const f = pose.face;
  const R = rig.spec.headR;
  const eye = clamp(f.eye, 0.04, 1.4);
  for (const e of rig.eyes) {
    const base = rig.spec.eyeSize;
    const happy = clamp(f.squint);
    // Bem feliz: o olho vira um arco fechado.
    const closedHappy = happy > 0.6;
    e.happy.visible = closedHappy;
    e.eye.visible = !closedHappy;
    e.eye.scale.set(1 + 0.06 * (eye - 1), eye * (1 - happy * 0.7), 1);
    e.eye.position.y = R * base[1] * happy * 0.3;
    e.look.position.set(R * base[0] * 0.35 * (f.lookX ?? 0) * e.side, R * base[1] * 0.3 * (f.lookY ?? 0), R * 0.065);
    e.shine.visible = eye > 0.45 && happy < 0.5;
    e.brow.position.y = R * ((rig.spec.eyeY ?? 0.1) + 0.34 + f.brow * 0.14 - happy * 0.04);
    e.brow.rotation.z = -e.side * f.worry * 0.38;
  }
  const smile = clamp(f.smile, -1, 1);
  const grinning = smile > 0.55 && f.open > 0.3;
  rig.grin.visible = grinning;
  rig.grin.scale.y = R * 0.22 * clamp(0.6 + f.open * 0.5, 0.6, 1.2);
  rig.smile.visible = f.open < 0.35;
  rig.smile.scale.set(1 + Math.abs(smile) * 0.25, Math.sign(smile || 1) * Math.max(0.15, Math.abs(smile)), 1);
  rig.open.visible = f.open >= 0.05 && !grinning;
  rig.open.scale.set(R * (0.17 + 0.06 * Math.max(0, smile)), R * 0.2 * clamp(f.open, 0.05, 1.3), R * 0.06);
}
