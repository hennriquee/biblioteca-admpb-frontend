/**
 * Traco de esboco da animacao de boas-vindas: como uma fileira de pontos vira
 * um risco "feito a mao".
 *
 * - wobble(): entorta de leve os pontos, com um ruido suave (pontos vizinhos
 *   se mexem juntos; a linha ondula, nao fica "peluda"). Trocando a semente
 *   algumas vezes por segundo, a linha "ferve" como em desenho animado feito
 *   a mao, em que cada quadro e um desenho novo.
 * - inkPath(): o traco de tinta, grosso no meio e fino nas pontas (um
 *   contorno preenchido, e nao uma linha de espessura fixa).
 * - pencilPath(): a segunda passada do lapis: uma linha fina que nao coincide
 *   com a de tinta e sobra um pouco nas pontas.
 *
 * Nada aqui usa sorteio: para a mesma entrada, o desenho e sempre o mesmo
 * (assim da para conferir qualquer quadro isolado).
 */

const n1 = (v) => Math.round(v * 10) / 10;

// Numero "embaralhado" entre 0 e 1 para um ponto de uma grade.
function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Ruido suave entre -1 e 1.
function noise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0, seed) + (hash(x0 + 1, y0, seed) - hash(x0, y0, seed)) * sx;
  const bottom = hash(x0, y0 + 1, seed) + (hash(x0 + 1, y0 + 1, seed) - hash(x0, y0 + 1, seed)) * sx;
  return 2 * (top + (bottom - top) * sy) - 1;
}

/**
 * Entorta os pontos. "amp" = ate quanto cada ponto sai do lugar; "wave" = de
 * quanto em quanto a linha ondula. O ruido e lido na posicao do ponto em
 * relacao a "origin" (e dividido por "scale"): assim um desenho que anda pelo
 * palco leva a sua tremida junto, em vez de atravessa-la.
 */
export function wobble(points, { seed = 1, amp = 0.5, wave = 16, origin = [0, 0], scale = 1 } = {}) {
  if (!amp) return points;
  const k = 1 / (wave * scale);
  return points.map(([x, y]) => {
    const u = (x - origin[0]) * k;
    const v = (y - origin[1]) * k;
    return [x + amp * noise(u, v, seed), y + amp * noise(u + 31.7, v - 12.3, seed + 57)];
  });
}

function curveTo(p0, p1, p2, p3) {
  return (
    "C" + n1(p1[0] + (p2[0] - p0[0]) / 6) + " " + n1(p1[1] + (p2[1] - p0[1]) / 6) +
    " " + n1(p2[0] - (p3[0] - p1[0]) / 6) + " " + n1(p2[1] - (p3[1] - p1[1]) / 6) +
    " " + n1(p2[0]) + " " + n1(p2[1])
  );
}

// Curva suave pelos pontos (sem o "M" inicial).
function curves(points) {
  let d = "";
  const last = points.length - 1;
  for (let i = 0; i < last; i += 1) {
    d += curveTo(points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(last, i + 2)]);
  }
  return d;
}

/** Linha suave passando pelos pontos. */
export function smoothLine(points) {
  if (points.length < 2) return "";
  return "M" + n1(points[0][0]) + " " + n1(points[0][1]) + curves(points);
}

/**
 * O traco de tinta: contorno preenchido, com "width" de espessura no meio e
 * afinando ate "thin" (fracao de width) nas pontas. taper = 0 deixa a
 * espessura uniforme.
 */
export function inkPath(points, width, { thin = 0.3, taper = 1 } = {}) {
  const count = points.length;
  if (count < 2) return "";
  const left = [];
  const right = [];
  for (let i = 0; i < count; i += 1) {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(count - 1, i + 1)];
    let dx = after[0] - before[0];
    let dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    // Engrossa logo depois da ponta e fica cheio no meio.
    const profile = Math.pow(Math.max(0, Math.sin((Math.PI * i) / (count - 1))), 0.6);
    const half = (width / 2) * (1 - taper * (1 - thin) * (1 - profile));
    left.push([points[i][0] - dy * half, points[i][1] + dx * half]);
    right.push([points[i][0] + dy * half, points[i][1] - dx * half]);
  }
  right.reverse();
  return (
    "M" + n1(left[0][0]) + " " + n1(left[0][1]) + curves(left) +
    "L" + n1(right[0][0]) + " " + n1(right[0][1]) + curves(right) + "Z"
  );
}

/**
 * A segunda passada do lapis: a mesma linha, tremida de outro jeito e
 * sobrando "over" unidades alem de cada ponta.
 */
export function pencilPath(points, { over = 2.5, ...shake } = {}) {
  const count = points.length;
  if (count < 2) return "";
  const stretch = (tip, next) => {
    const length = Math.hypot(tip[0] - next[0], tip[1] - next[1]) || 1;
    return [tip[0] + ((tip[0] - next[0]) / length) * over, tip[1] + ((tip[1] - next[1]) / length) * over];
  };
  const longer = [stretch(points[0], points[1]), ...points, stretch(points[count - 1], points[count - 2])];
  return smoothLine(wobble(longer, shake));
}

/** So o comeco da fileira de pontos: ate a fracao "drawn" (0 a 1) do comprimento. */
export function trim(points, drawn) {
  if (drawn >= 1) return points;
  if (drawn <= 0 || points.length < 2) return [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  let left = total * drawn;
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const step = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (step >= left) {
      const u = step ? left / step : 0;
      out.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * u, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * u]);
      break;
    }
    out.push(points[i]);
    left -= step;
  }
  return out;
}
