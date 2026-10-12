/**
 * O passaro da animacao de boas-vindas: uma pomba de traco fino, montada em
 * tres dimensoes para poder ser vista de qualquer lado (de perfil, de costas,
 * por cima, em tres quartos...). E por isso que ela consegue fazer a curva e
 * virar o corpo de verdade, em vez de ser um desenho plano espelhado.
 *
 * O desenho segue a prancha de referencia do passaro (as doze vistas): corpo
 * esguio em gota, cabeca pequena com bico curto, asas longas e pontudas com
 * uma segunda linha de penas perto da ponta, e a cauda em leque de tracos
 * soltos que terminam em virgula.
 *
 * Como funciona: o corpo e uma fileira de esferas ao longo da espinha (o
 * contorno e a silhueta delas); cada asa e uma folha plana presa ao ombro,
 * que sobe, desce, verga e se recolhe; a cauda e um leque de penas. Dada uma
 * pose, birdStrokes() gira tudo, projeta no palco e devolve os tracos ja sem
 * as partes escondidas (a asa de tras some atras do corpo, e assim por
 * diante).
 *
 * Unidades: as do palco quando scale = 1 (o passaro tem uns 130 de ponta a
 * ponta). Eixos do passaro: x para o bico, y para cima, z para a asa direita.
 */

const RAD = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};

// Curva suave por pontos de controle (Catmull-Rom), com qualquer numero de
// coordenadas por ponto; devolve "count" pontos igualmente espacados no
// parametro (nao no comprimento).
function spline(control, count) {
  const out = [];
  const last = control.length - 1;
  for (let n = 0; n < count; n += 1) {
    const at = (last * n) / (count - 1);
    const i = Math.min(last - 1, Math.floor(at));
    const u = at - i;
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(last, i + 2)];
    out.push(
      p1.map(
        (_, k) =>
          0.5 *
          (2 * p1[k] + (p2[k] - p0[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
            (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * u * u * u),
      ),
    );
  }
  return out;
}

/* ---------- O corpo ----------
   Esferas ao longo da espinha, da ponta do bico a raiz da cauda:
   [x, y, raio]. A partir de NECK_AT para a frente e "pescoco e cabeca", que
   podem se erguer (neck) e virar para o lado (headYaw). */
const SPINE = [
  [40, 1.2, 0.25], // ponta do bico
  [36.5, 2.2, 1.5],
  [33, 3.4, 3.6],
  [29, 4.4, 5.6], // cabeca
  [24.5, 4.2, 6],
  [19, 3, 6.6], // pescoco
  [12, 1.2, 8.6],
  [4, -0.6, 11], // peito
  [-5, -1.2, 11.6],
  [-14, -0.6, 10.2],
  [-22, 0.6, 7.6],
  [-29, 1.8, 4.8],
  [-34, 2.6, 2.6], // raiz da cauda
];
const SPHERES = spline(SPINE, 30);
const NECK_AT = [15, 2];
const TAIL_ROOT = [-33, 2.4, 0];
// Quantos pontos em volta de cada esfera entram na busca da silhueta.
const RING = 16;
const RING_DIRS = Array.from({ length: RING }, (_, k) => [Math.cos((2 * Math.PI * k) / RING), Math.sin((2 * Math.PI * k) / RING)]);
const OUTLINE_POINTS = 54;

/* ---------- As asas ----------
   A forma da asa aberta, vista de cima: [u, v], u = do ombro para a ponta,
   v = para tras. Borda da frente, borda de tras (a "barriga" grande da asa)
   e a segunda linha de penas, curta, perto da ponta. */
const WING_SPAN = 108;
const WING_LEAD = spline([[0, 0], [16, -1.5], [33, 1], [58, 8.5], [84, 16], [WING_SPAN, 15]], 15);
const WING_TRAIL = spline([[WING_SPAN, 15], [99, 22.5], [88, 30.5], [70, 40], [45, 46.5], [20, 44.5], [0, 36]], 17);
const WING_INNER = spline([[93, 25], [80, 24], [66, 27], [54, 33.5]], 7);
const SHOULDER = [9, 5, 6];
// A asa fechada, deitada no flanco: [x, y, z] no corpo (z do lado direito),
// com os mesmos pontos da asa aberta (uma vira a outra ao recolher).
const FOLD_LEAD = spline([[8, 6.5, 9.5], [-4, 8.5, 15], [-16, 7.5, 17], [-28, 4, 14], [-39, 0, 8.5], [-48, -4, 4]], 15);
const FOLD_TRAIL = spline([[-48, -4, 4], [-38, -5, 9.5], [-25, -6.5, 15.5], [-12, -7, 18], [0, -5, 17], [8, 0, 13.5], [9, 4, 10]], 17);
// (A segunda linha de penas se deita sobre a borda de baixo e some nela.)
const FOLD_INNER = FOLD_TRAIL.slice(1, 8);

/* ---------- A cauda ----------
   Cinco penas em leque; as de fora sao mais curtas e viram para fora. */
const FEATHERS = [-2, -1, 0, 1, 2];
const FEATHER_POINTS = 8;
const TAIL_LENGTH = 47;

/**
 * Pose "neutra": voando para a direita, de perfil, asas abertas na horizontal.
 * - x, y, scale: onde o passaro esta no palco e o tamanho.
 * - yaw: para onde ele aponta, em graus (0 = direita, 90 = para longe de quem
 *   olha, 180 = esquerda, 270 = vindo de frente).
 * - pitch: nariz para cima (graus). roll: inclinacao lateral (positivo = asa
 *   direita dele para baixo).
 * - flapL, flapR: altura de cada asa (graus acima da horizontal).
 * - sweep: asas jogadas para tras (graus). fold: 0 = abertas, 1 = fechadas
 *   junto ao corpo. bend: quanto a ponta da asa verga alem da raiz (graus).
 * - spread: 0 = cauda fechada, 1 = leque aberto.
 * - neck: cabeca erguida em relacao ao corpo (graus). headYaw: cabeca virada
 *   para a direita dele (graus).
 * - tilt: de quanto acima quem olha esta (graus): 0 = na altura do passaro;
 *   positivo = vendo um pouco por cima (aparece o dorso e as asas abertas).
 */
export const NEUTRAL = {
  x: 0, y: 0, scale: 1, yaw: 0, pitch: 0, roll: 0,
  flapL: 10, flapR: 10, sweep: 0, fold: 0, bend: 0, spread: 0.5, neck: 0, headYaw: 0, tilt: 0,
};

// Os tres eixos do passaro (frente, cima, direita) no mundo: X = direita do
// palco, Y = para cima, Z = para longe de quem olha.
function axes(pose) {
  const yaw = pose.yaw * RAD;
  const pitch = pose.pitch * RAD;
  const roll = pose.roll * RAD;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const forward = [cy * cp, sp, sy * cp];
  const up0 = [-cy * sp, cp, -sy * sp];
  const right0 = [sy, 0, -cy];
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  return {
    forward,
    up: up0.map((v, k) => v * cr + right0[k] * sr),
    right: right0.map((v, k) => v * cr - up0[k] * sr),
  };
}

function inPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/**
 * Os tracos do passaro na pose dada, em coordenadas do palco.
 * Devolve uma lista de { part, id, points }: part diz de onde o traco vem
 * ("body", "wingR", "wingL", "tail") e id, qual trecho e ("wingR.lead",
 * "tail2"...); um mesmo trecho pode sair em mais de um pedaco quando algo
 * passa na frente dele. Com { hidden: false } nada e
 * escondido (cada trecho sai inteiro: serve para um desenho virar o outro).
 */
export function birdStrokes(input, options = {}) {
  const pose = { ...NEUTRAL, ...input };
  const hide = options.hidden !== false;
  const { forward, up, right } = axes(pose);
  // Do passaro para o mundo (ainda sem escala): [X, Y, Z].
  const tilt = pose.tilt * RAD;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const world = (x, y, z) => {
    const wy = x * forward[1] + y * up[1] + z * right[1];
    const wz = x * forward[2] + y * up[2] + z * right[2];
    // (Quem olha de cima ve o que esta longe mais alto no palco.)
    return [x * forward[0] + y * up[0] + z * right[0], wy * ct + wz * st, wz * ct - wy * st];
  };

  /* ----- Corpo: esferas -> silhueta ----- */
  const neck = pose.neck * RAD;
  const headYaw = pose.headYaw * RAD;
  const cn = Math.cos(neck);
  const sn = Math.sin(neck);
  const ch = Math.cos(headYaw);
  const sh = Math.sin(headYaw);
  const spheres = SPHERES.map(([x, y, r]) => {
    let bx = x;
    let by = y;
    let bz = 0;
    const lift = smoothstep((x - NECK_AT[0] + 6) / 12); // 0 no corpo, 1 na cabeca
    if (lift > 0 && (neck || headYaw)) {
      const dx = x - NECK_AT[0];
      const dy = y - NECK_AT[1];
      // Vira para o lado (em torno do eixo de cima) e depois ergue.
      const tx = dx * ch;
      const tz = dx * sh;
      const rx = tx * cn - dy * sn;
      const ry = tx * sn + dy * cn;
      bx = lerp(x, NECK_AT[0] + rx, lift);
      by = lerp(y, NECK_AT[1] + ry, lift);
      bz = tz * lift;
    }
    const w = world(bx, by, bz);
    return [w[0], -w[1], w[2], r]; // x e y ja no sentido do palco (y para baixo)
  });

  // Atras da frente de alguma esfera do corpo?
  const behindBody = (x, y, depth) => {
    for (let i = 0; i < spheres.length; i += 1) {
      const s = spheres[i];
      const dx = x - s[0];
      const dy = y - s[1];
      const d2 = dx * dx + dy * dy;
      const r2 = s[3] * s[3];
      if (d2 < r2 && depth > s[2] - Math.sqrt(r2 - d2)) return true;
    }
    return false;
  };

  // Pontos da borda de cada esfera que nao estao dentro de outra: juntos,
  // sao a silhueta do corpo.
  const lastSphere = spheres.length - 1;
  const along = [0]; // distancia ao longo da espinha, ja projetada
  let widest = 0;
  for (let i = 1; i <= lastSphere; i += 1) {
    along.push(along[i - 1] + Math.hypot(spheres[i][0] - spheres[i - 1][0], spheres[i][1] - spheres[i - 1][1]));
  }
  spheres.forEach((s) => { widest = Math.max(widest, s[3]); });
  const lengthwise = Math.hypot(spheres[lastSphere][0] - spheres[0][0], spheres[lastSphere][1] - spheres[0][1]) > 1.5 * widest;
  let cx = 0;
  let cy = 0;
  let weight = 0;
  spheres.forEach((s) => {
    const w = s[3] * s[3];
    cx += s[0] * w;
    cy += s[1] * w;
    weight += w;
  });
  cx /= weight;
  cy /= weight;
  const tail = spheres[lastSphere];
  const tailAngle = Math.atan2(tail[1] - cy, tail[0] - cx);
  const sideA = [];
  const sideB = [];
  let tx = 1;
  let ty = 0;
  for (let i = 0; i <= lastSphere; i += 1) {
    const s = spheres[i];
    const before = spheres[Math.max(0, i - 2)];
    const after = spheres[Math.min(lastSphere, i + 2)];
    const length = Math.hypot(after[0] - before[0], after[1] - before[1]);
    if (length > 0.5) {
      tx = (after[0] - before[0]) / length;
      ty = (after[1] - before[1]) / length;
    }
    for (let k = 0; k < RING; k += 1) {
      const dx = RING_DIRS[k][0] * s[3];
      const dy = RING_DIRS[k][1] * s[3];
      const x = s[0] + dx;
      const y = s[1] + dy;
      // (A ponta de tras fica aberta: e de onde saem as penas da cauda.)
      if (i === lastSphere && dx * tx + dy * ty > 0.2 * s[3]) continue;
      let covered = false;
      for (let j = 0; j <= lastSphere && !covered; j += 1) {
        if (j === i) continue;
        const o = spheres[j];
        const ox2 = x - o[0];
        const oy2 = y - o[1];
        covered = ox2 * ox2 + oy2 * oy2 < o[3] * o[3] * 0.985;
      }
      if (covered) continue;
      if (lengthwise) {
        // Corpo visto de lado: segue a espinha, indo por um lado e voltando
        // pelo outro.
        const key = along[i] + dx * tx + dy * ty;
        (tx * dy - ty * dx >= 0 ? sideA : sideB).push([x, y, s[2], key]);
      } else {
        // Corpo visto de frente ou de costas: da a volta em torno do meio.
        let a = Math.atan2(y - cy, x - cx) - tailAngle;
        while (a < 0) a += 2 * Math.PI;
        while (a >= 2 * Math.PI) a -= 2 * Math.PI;
        sideA.push([x, y, s[2], -a]);
      }
    }
  }
  sideA.sort((p, q) => q[3] - p[3]);
  sideB.sort((p, q) => p[3] - q[3]);
  const rim = sideA.concat(sideB);
  // Reamostra em pontos igualmente espacados (a silhueta bruta tem pontos
  // demais onde as esferas se amontoam).
  const body = [];
  if (rim.length > 3) {
    const lengths = [0];
    for (let i = 1; i < rim.length; i += 1) {
      lengths.push(lengths[i - 1] + Math.hypot(rim[i][0] - rim[i - 1][0], rim[i][1] - rim[i - 1][1]));
    }
    const total = lengths[lengths.length - 1];
    let j = 1;
    for (let n = 0; n < OUTLINE_POINTS; n += 1) {
      const at = (total * n) / (OUTLINE_POINTS - 1);
      while (j < lengths.length - 1 && lengths[j] < at) j += 1;
      const u = clamp01((at - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1));
      body.push([lerp(rim[j - 1][0], rim[j][0], u), lerp(rim[j - 1][1], rim[j][1], u), lerp(rim[j - 1][2], rim[j][2], u)]);
    }
  }

  /* ----- Asas ----- */
  const fold = clamp01(pose.fold);
  const wing = (side) => {
    const flap = side > 0 ? pose.flapR : pose.flapL;
    const sweep = pose.sweep * RAD;
    const cs = Math.cos(sweep);
    const ss = Math.sin(sweep);
    const place = (folded) => ([u, v], index) => {
      const reach = u / WING_SPAN;
      // A ponta verga alem da raiz.
      const angle = (flap + pose.bend * reach * reach) * RAD;
      // Gira a forma dentro do plano da asa (asa jogada para tras).
      const a = u * cs - v * ss; // ao longo da envergadura
      const b = u * ss + v * cs; // para tras
      let x = SHOULDER[0] - b;
      let y = SHOULDER[1] + a * Math.sin(angle);
      let z = SHOULDER[2] + a * Math.cos(angle);
      if (fold > 0) {
        const f = folded[index];
        x = lerp(x, f[0], fold);
        y = lerp(y, f[1], fold);
        z = lerp(z, f[2], fold);
      }
      const w = world(x, y, side * z);
      return [w[0], -w[1], w[2]];
    };
    const lead = WING_LEAD.map(place(FOLD_LEAD));
    const trail = WING_TRAIL.map(place(FOLD_TRAIL));
    const inner = fold < 0.85 ? WING_INNER.map(place(FOLD_INNER)) : [];
    // Um plano pela asa, para saber a que distancia ela esta em cada ponto.
    const a = lead[0];
    const b = lead[lead.length - 1];
    const c = trail[9];
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const det = ux * vy - uy * vx;
    const depthAt = (x, y) => {
      if (Math.abs(det) < 1e-3) return Infinity;
      const s = ((x - a[0]) * vy - (y - a[1]) * vx) / det;
      const t = ((y - a[1]) * ux - (x - a[0]) * uy) / det;
      return a[2] + s * uz + t * vz;
    };
    return { lead, trail, inner, polygon: lead.concat(trail), depthAt, area: Math.abs(det) };
  };
  const wingR = wing(1);
  const wingL = wing(-1);

  /* ----- Cauda ----- */
  const spread = lerp(0.42, 1, clamp01(pose.spread));
  const feathers = FEATHERS.map((k) => {
    const points = [];
    const length = TAIL_LENGTH * (1 - 0.1 * Math.abs(k));
    for (let n = 0; n < FEATHER_POINTS; n += 1) {
      const w = 0.16 + (0.84 * n) / (FEATHER_POINTS - 1);
      // Abre aos poucos e, no fim, vira para fora (a "virgula").
      const angle = k * spread * (5 + 8 * w + 6 * w * w * w) * RAD;
      // O leque e um pouco torcido e cai para a ponta: de perfil as penas nao
      // ficam umas sobre as outras.
      const p = world(
        TAIL_ROOT[0] - length * w * Math.cos(angle) + 2,
        TAIL_ROOT[1] - (3.3 * k + 1.2 * Math.abs(k)) * w - 5 * w * w + 3 * w * w * w,
        TAIL_ROOT[2] + length * w * Math.sin(angle) + k * 1.3,
      );
      points.push([p[0], -p[1], p[2]]);
    }
    return points;
  });

  /* ----- O que fica escondido ----- */
  const behindWing = (w, x, y, depth) => w.area > 40 && w.depthAt(x, y) < depth - 1.2 && inPolygon(x, y, w.polygon);
  const visibleFor = (own) => (p) => {
    if (!hide) return true;
    if (own !== "body" && behindBody(p[0], p[1], p[2] + 0.4)) return false;
    if (own !== "wingR" && behindWing(wingR, p[0], p[1], p[2])) return false;
    if (own !== "wingL" && behindWing(wingL, p[0], p[1], p[2])) return false;
    return true;
  };

  const { x: ox, y: oy, scale } = pose;
  const out = [];
  const toStage = (p) => [ox + p[0] * scale, oy + p[1] * scale];
  // Corta o trecho nos pontos em que ele some atras de algo (achando o ponto
  // exato do corte, para a ponta do traco nao andar aos saltos).
  function emit(part, id, points) {
    const visible = visibleFor(part);
    let run = [];
    // (Sobras muito curtas entre duas coisas que tapam o traco nao entram:
    // viram ciscos piscando.)
    const keep = () => {
      let length = 0;
      for (let i = 1; i < run.length; i += 1) length += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
      if (run.length > 1 && length > 6 * scale) out.push({ part, id, points: run });
    };
    const cut = (seen, unseen) => {
      let a = seen;
      let b = unseen;
      for (let i = 0; i < 5; i += 1) {
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        if (visible(mid)) a = mid;
        else b = mid;
      }
      return a;
    };
    let previous = null;
    let previousSeen = false;
    points.forEach((p) => {
      const seen = visible(p);
      if (seen) {
        if (previous && !previousSeen) run.push(toStage(cut(p, previous)));
        run.push(toStage(p));
      } else if (previousSeen) {
        run.push(toStage(cut(previous, p)));
        keep();
        run = [];
      }
      previous = p;
      previousSeen = seen;
    });
    keep();
  }

  // Do fundo para a frente (a asa mais longe primeiro).
  const farFirst = wingR.lead[8][2] > wingL.lead[8][2] ? [["wingR", wingR], ["wingL", wingL]] : [["wingL", wingL], ["wingR", wingR]];
  const drawWing = ([part, w]) => {
    emit(part, part + ".lead", w.lead);
    emit(part, part + ".trail", w.trail);
    if (w.inner.length) emit(part, part + ".inner", w.inner);
  };
  drawWing(farFirst[0]);
  feathers.forEach((points, index) => emit("tail", "tail" + index, points));
  if (body.length) emit("body", "body", body);
  drawWing(farFirst[1]);
  // A silhueta inteira do corpo (para tapar o que estiver atras dele) e alguns
  // pontos de apoio do desenho (para as linhas de construcao do esboco).
  out.silhouette = body.map(toStage);
  const mark = (x, y, z) => {
    const w = world(x, y, z);
    return [ox + w[0] * scale, oy - w[1] * scale];
  };
  out.guides = {
    beak: toStage(spheres[0]),
    head: toStage(spheres[7]),
    chest: mark(-3, -0.5, 0),
    tail: mark(TAIL_ROOT[0], TAIL_ROOT[1], 0),
    tipR: toStage(wingR.lead[wingR.lead.length - 1]),
    tipL: toStage(wingL.lead[wingL.lead.length - 1]),
    near: farFirst[1][0],
  };
  return out;
}
