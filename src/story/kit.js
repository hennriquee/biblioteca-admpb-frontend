import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Pecas e contas da animacao da sugestao.
 *
 * Geometria: toda peca leva, por vertice, o "jeito de desenhar" que o
 * nanquim (sketch.js) le: tone (0 = branco do papel, 1 = preto), id (separa
 * os contornos de um objeto e outro) e kind (KIND abaixo).
 *
 * Tempo: tudo na animacao e uma conta do instante (nada guarda estado), entao
 * qualquer quadro pode ser desenhado sozinho - os testes conferem quadros
 * isolados.
 */

export const KIND = { hatch: 0, solid: 1, plain: 3, image: 4, shadowOnly: 5 };

let nextId = 1;
/** Um id novo para contornos (1 a 250, dando a volta). */
export function newId() {
  const id = nextId;
  nextId = nextId >= 250 ? 1 : nextId + 1;
  return id;
}

/** Marca a geometria com o jeito de desenhar (ver KIND). */
export function tag(geometry, { tone = 0.15, id = newId(), kind = KIND.hatch, keepUv = false } = {}) {
  let g = geometry;
  if (!g.index) {
    const count = g.attributes.position.count;
    const index = new Array(count);
    for (let i = 0; i < count; i += 1) index[i] = i;
    g.setIndex(index);
  }
  if (!keepUv) g.deleteAttribute("uv");
  if (!g.attributes.uv && keepUv) {
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  for (const name of ["uv1", "uv2", "tangent", "color"]) {
    if (g.attributes[name]) g.deleteAttribute(name);
  }
  const count = g.attributes.position.count;
  g.setAttribute("aTone", new THREE.Float32BufferAttribute(new Float32Array(count).fill(tone), 1));
  g.setAttribute("aId", new THREE.Float32BufferAttribute(new Float32Array(count).fill(id), 1));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(new Float32Array(count).fill(kind), 1));
  g.groups = [];
  return g;
}

/**
 * Junta varias pecas paradas numa geometria so (bem menos trabalho para a
 * placa de video). Cada item: [geometria, matriz ou null, opcoes de tag].
 */
export function merge(items) {
  const list = items.map(([geometry, matrix, options]) => {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    return tag(g, options);
  });
  return mergeGeometries(list, false);
}

const tmpObject = new THREE.Object3D();
/** Matriz de posicao/giro/escala, para montar pecas paradas. */
export function at(x, y, z, { rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s } = {}) {
  tmpObject.position.set(x, y, z);
  tmpObject.rotation.set(rx, ry, rz);
  tmpObject.scale.set(sx, sy, sz);
  tmpObject.updateMatrix();
  return tmpObject.matrix.clone();
}

export function box(w, h, d, r = 0) {
  if (r > 0) return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
  return new THREE.BoxGeometry(w, h, d);
}

/**
 * Prepara uma geometria para ser uma peca sozinha: o nanquim desenha tudo
 * como InstancedMesh (assim a cena inteira usa um programa so da placa de
 * video, que demora a montar); aqui, uma copia de tom e id do proprio desenho.
 */
export function single(geometry) {
  geometry.setAttribute("aInstTone", new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute("aInstId", new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

/** Uma peca com o material do nanquim (InstancedMesh de uma copia so). */
export function part(geometry, material, options, parent) {
  const mesh = new THREE.InstancedMesh(single(tag(geometry, options)), material, 1);
  mesh.frustumCulled = false;
  if (parent) parent.add(mesh);
  return mesh;
}

// ---------- Tempo ----------

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progresso de 0 a 1 entre os instantes a e b. */
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Chaves de animacao: [[instante, valor, curva?], ...]. A curva de cada chave
 * vale para o trecho que CHEGA nela (padrao: easeInOut). Valores podem ser
 * numeros ou listas de numeros.
 */
export function keys(t, list) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i += 1) {
    const [t1, v1, curve = easeInOut] = list[i];
    if (t <= t1) {
      const [t0, v0] = list[i - 1];
      const u = curve(t1 === t0 ? 1 : (t - t0) / (t1 - t0));
      if (Array.isArray(v0)) return v0.map((a, k) => a + (v1[k] - a) * u);
      return v0 + (v1 - v0) * u;
    }
  }
  return list[list.length - 1][1];
}

/** Mola amortecida depois de um tranco no instante t0 (0 antes dele). */
export function spring(t, t0, { freq = 3, damp = 5, amp = 1 } = {}) {
  const dt = t - t0;
  if (dt < 0) return 0;
  return amp * Math.exp(-damp * dt) * Math.sin(2 * Math.PI * freq * dt);
}

/** Sorteio com semente (o mesmo a cada volta). */
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

function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
/** Ruido suave de 1 dimensao, entre -1 e 1. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i + seed * 57) * (1 - u) + hash1(i + 1 + seed * 57) * u) * 2 - 1;
}
