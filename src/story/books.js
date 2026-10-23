import * as THREE from "three";
import { KIND, at, box, merge, part, rng, single, tag } from "./kit.js";

/**
 * As pecas da animacao da sugestao: os livros jogados (todos de uma vez na
 * placa de video), a poeira dos trancos, o chao que so recebe sombra e a
 * pagina que vira no fim de cada volta.
 *
 * Livro deitado: x = largura (lombada em -x), z = altura da pagina (o alto
 * em -z), y = espessura. O centro do livro fica no meio da espessura.
 */

/** O livro "padrao": cada livro da pilha e ele esticado (ver script.js). */
export const BOOK = { w: 0.17, l: 0.24, t: 0.036 };

// Linhas finas das folhas (o "miolo" visto de lado).
let pagesTexture = null;
function pageEdges() {
  if (pagesTexture) return pagesTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rand = rng(3);
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  for (let y = 4; y < 256; y += 6 + rand() * 5) {
    ctx.lineWidth = 0.7 + rand() * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(64, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }
  pagesTexture = new THREE.CanvasTexture(canvas);
  pagesTexture.wrapS = THREE.RepeatWrapping;
  pagesTexture.wrapT = THREE.RepeatWrapping;
  pagesTexture.anisotropy = 4;
  return pagesTexture;
}

/**
 * Todos os livros fechados de uma vez (InstancedMesh): capas + lombada numa
 * malha, o miolo de folhas na outra. Cada livro tem o seu tom de capa e tres
 * ids de contorno seguidos (capa, miolo, etiqueta) a partir de spec.id.
 * Ha dois jogos iguais: o do chao faz sombra; o do ar (camada 1) nao, para a
 * sombra de um livro ainda fora da tela nao virar um risco solto no papel.
 * setBook(i, matriz, noAr) poe o livro "i" no lugar; hideBook(i) some com ele.
 */
export function makeBooks(sk, specs) {
  const grounded = makeBookSet(sk, specs);
  const flying = makeBookSet(sk, specs);
  flying.group.traverse((o) => o.layers.set(1));
  const group = new THREE.Group();
  group.add(grounded.group, flying.group);
  return {
    group,
    setBook(i, matrix, inAir = false) {
      (inAir ? flying : grounded).set(i, matrix);
      (inAir ? grounded : flying).hide(i);
    },
    hideBook(i) {
      grounded.hide(i);
      flying.hide(i);
    },
    commit() {
      grounded.commit();
      flying.commit();
    },
  };
}

function makeBookSet(sk, specs) {
  const { w, l, t } = BOOK;
  const c = 0.0045;
  // aTone aqui e somado ao tom do livro (as faixas da lombada clareiam).
  const items = [
    [box(w + 0.006, c, l + 0.01, 0.0015), at(0.001, -t / 2 + c / 2, 0), { tone: 0, id: 0 }],
    [box(w + 0.006, c, l + 0.01, 0.0015), at(0.001, t / 2 - c / 2, 0), { tone: 0, id: 0 }],
    [box(0.013, t, l + 0.01, 0.004), at(-w / 2 - 0.002, 0, 0), { tone: 0.06, id: 0 }],
    [box(0.0145, t + 0.001, 0.007, 0.0015), at(-w / 2 - 0.002, 0, -l * 0.3), { tone: -0.7, id: 0 }],
    [box(0.0145, t + 0.001, 0.007, 0.0015), at(-w / 2 - 0.002, 0, l * 0.3), { tone: -0.7, id: 0 }],
    // Etiqueta do titulo na capa de cima.
    [box(w * 0.5, 0.0008, l * 0.13), at(0.012, t / 2 + 0.0003, -l * 0.17), { tone: -0.7, id: 2 }],
  ];
  const coverGeometry = merge(items);
  const blockGeometry = tag(new THREE.BoxGeometry(w - 0.006, t - c * 2, l - 0.004), { tone: 0.03, id: 1, keepUv: true });

  const count = specs.length;
  const tones = new Float32Array(count);
  const ids = new Float32Array(count);
  specs.forEach((spec, i) => {
    tones[i] = spec.tone;
    ids[i] = spec.id;
  });
  coverGeometry.setAttribute("aInstTone", new THREE.InstancedBufferAttribute(tones, 1));
  coverGeometry.setAttribute("aInstId", new THREE.InstancedBufferAttribute(ids, 1));
  blockGeometry.setAttribute("aInstTone", new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  blockGeometry.setAttribute("aInstId", new THREE.InstancedBufferAttribute(ids, 1));

  const covers = new THREE.InstancedMesh(coverGeometry, sk.material, count);
  const blocks = new THREE.InstancedMesh(blockGeometry, sk.decalMaterial(pageEdges()), count);
  covers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // As duas malhas andam juntas: a mesma lista de posicoes.
  blocks.instanceMatrix = covers.instanceMatrix;
  covers.frustumCulled = false;
  blocks.frustumCulled = false;
  const group = new THREE.Group();
  group.add(covers, blocks);

  return {
    group,
    set(i, matrix) {
      covers.setMatrixAt(i, matrix);
    },
    hide(i) {
      covers.setMatrixAt(i, HIDDEN);
    },
    commit() {
      covers.instanceMatrix.needsUpdate = true;
    },
  };
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** Poeira dos trancos: nuvenzinhas baixas que se espalham pelo chao. */
export function makeDust(material, ids, count = 10) {
  const group = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i += 1) {
    const g = new THREE.Group();
    const r = rng(300 + i);
    // Bolinhas encavaladas (uma nuvem, nao pedrinhas), mais largas que altas.
    for (let k = 0; k < 5; k += 1) {
      const ball = part(new THREE.IcosahedronGeometry(0.016 + r() * 0.01, 2), material, { tone: 0, kind: KIND.plain, id: ids[i % ids.length] }, g);
      ball.position.set((k - 2) * 0.014 + (r() - 0.5) * 0.008, 0.008 + r() * 0.012 - Math.abs(k - 2) * 0.004, (r() - 0.5) * 0.012);
      ball.scale.set(1.15, 0.8, 1);
    }
    g.visible = false;
    group.add(g);
    puffs.push(g);
  }
  return { group, puffs };
}

/** O chao que nao aparece: so recebe a sombra hachurada. */
export function makeGround(material) {
  return part(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), material, { tone: 0, id: 0, kind: KIND.shadowOnly });
}

/**
 * A pagina que vira: uma folha do tamanho da tela (altura 1, largura =
 * proporcao da tela), deitada no plano y = 0, com a lombada na borda
 * esquerda. "material" = sk.imageMaterial(o desenho). bendPage curva a folha.
 */
export function makePage(material, aspect, id) {
  const geometry = single(tag(new THREE.PlaneGeometry(aspect, 1, 160, 16).rotateX(-Math.PI / 2), { tone: 0, id, kind: KIND.image, keepUv: true }));
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.frustumCulled = false;
  const rest = Float32Array.from(geometry.attributes.position.array);
  return { mesh, rest, aspect, columns: 161, rows: 17 };
}

/**
 * Curva a folha: angle(s, z) diz para onde aponta cada trecho dela (0 =
 * deitada, PI = dobrada por cima, de volta para a esquerda); s = 0 na
 * lombada, 1 na borda. Cada fileira e "desenrolada" a partir da lombada,
 * entao a folha dobra sem esticar.
 */
export function bendPage(page, angle) {
  const pos = page.mesh.geometry.attributes.position;
  const { rest, aspect, columns, rows } = page;
  const ds = aspect / (columns - 1);
  for (let r = 0; r < rows; r += 1) {
    const base = r * columns;
    const z = rest[base * 3 + 2];
    let x = -aspect / 2;
    let y = 0;
    let previous = angle(0, z);
    pos.setXYZ(base, x, 0.002, z);
    for (let c = 1; c < columns; c += 1) {
      const a = angle(c / (columns - 1), z);
      const mid = (a + previous) / 2;
      x += Math.cos(mid) * ds;
      y += Math.sin(mid) * ds;
      previous = a;
      pos.setXYZ(base + c, x, 0.002 + y, z);
    }
  }
  pos.needsUpdate = true;
  page.mesh.geometry.computeVertexNormals();
}
