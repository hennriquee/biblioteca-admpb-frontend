import * as THREE from "three";
import { KIND, at, box, joint, limb, merge, newId, part, sphere, tag } from "./kit.js";
import { rng } from "./cast.js";
import { coverTexture, flyingPageTexture, leftPageTexture, rightPageTexture } from "./decals.js";

/**
 * A cena 2 ("chegando mercadoria"): os livros que o menino empilha, a mao
 * dele e o quinto livro - o da sugestao, com o titulo na capa - que se abre
 * sozinho, folheia e para na ilustracao da esquina. A camera entra nessa
 * ilustracao e a historia recomeca.
 *
 * Livro deitado: x = largura (lombada em -x), z = altura da pagina (o alto
 * em -z), y = espessura.
 */

// Linhas finas das folhas (o "miolo" visto de lado).
let pagesTexture = null;
function pageEdges() {
  if (pagesTexture) return pagesTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rand = rng(3);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  for (let y = 4; y < 256; y += 5 + rand() * 4) {
    ctx.lineWidth = 0.8 + rand() * 0.8;
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

/** Um livro de capa dura (fechado). */
export function makeBook(sk, { w, l, t, tone, seed }) {
  const rand = rng(seed);
  const material = sk.material;
  const group = new THREE.Group();
  const c = 0.0045;
  const items = [];
  const coverId = newId();
  items.push([box(w + 0.006, c, l + 0.01, 0.0015), at(0.001, c / 2, 0), { tone, id: coverId }]);
  items.push([box(w + 0.006, c, l + 0.01, 0.0015), at(0.001, t - c / 2, 0), { tone, id: coverId }]);
  items.push([box(0.014, t, l + 0.01, 0.005), at(-w / 2 - 0.002, t / 2, 0), { tone: Math.min(0.9, tone + 0.12), id: newId() }]);
  // Nervuras na lombada.
  for (let k = 0; k < 4; k += 1) {
    items.push([box(0.017, t + 0.001, 0.005, 0.0015), at(-w / 2 - 0.002, t / 2, -l * 0.38 + k * l * 0.13 + (k > 1 ? l * 0.3 : 0)), { tone: 0.88, id: newId() }]);
  }
  // Etiqueta/titulo na capa de cima (uma faixa clara com linhas).
  if (rand() < 0.75) {
    items.push([box(w * 0.55, 0.0008, l * 0.12), at(0.01, t + 0.0003, -l * 0.18), { tone: 0.03, id: newId() }]);
  }
  const cover = new THREE.Mesh(merge(items), material);
  cover.frustumCulled = false;
  group.add(cover);
  const block = new THREE.Mesh(
    tag(new THREE.BoxGeometry(w - 0.006, t - c * 2, l - 0.004), { tone: 0.03, id: newId(), keepUv: true }),
    sk.decalMaterial(pageEdges()),
  );
  block.position.set(0.002, t / 2, 0);
  block.frustumCulled = false;
  group.add(block);
  return group;
}

/**
 * O quinto livro: o da sugestao. A capa abre (dobradica na lombada), as
 * folhas passam voando e a pagina da direita mostra a ilustracao.
 * "picture" = o tamanho da ilustracao (ver layoutPicture).
 */
export function makeHeroBook(sk, { w, l, t, title, aspect }) {
  const material = sk.material;
  const group = new THREE.Group();
  const c = 0.005;
  const left = 0.008;
  const rightT = t - c * 2 - left;
  const coverTone = 0.1;

  // Contracapa (embaixo) e lombada.
  const base = [];
  base.push([box(w + 0.008, c, l + 0.012, 0.0018), at(0.001, c / 2, 0), { tone: coverTone, id: newId() }]);
  base.push([box(0.016, t, l + 0.012, 0.006), at(-w / 2 - 0.003, t / 2, 0), { tone: 0.55, id: newId() }]);
  for (let k = 0; k < 4; k += 1) {
    base.push([box(0.019, t + 0.001, 0.006, 0.002), at(-w / 2 - 0.003, t / 2, -l * 0.4 + k * l * 0.27), { tone: 0.9, id: newId() }]);
  }
  const baseMesh = new THREE.Mesh(merge(base), material);
  baseMesh.frustumCulled = false;
  group.add(baseMesh);

  // Miolo da direita, com a pagina (texto + moldura) por cima.
  const rightBlock = new THREE.Mesh(
    tag(new THREE.BoxGeometry(w - 0.008, rightT, l - 0.004), { tone: 0.03, id: newId(), keepUv: true }),
    sk.decalMaterial(pageEdges()),
  );
  rightBlock.position.set(0.003, c + rightT / 2, 0);
  rightBlock.frustumCulled = false;
  group.add(rightBlock);
  const pageTop = c + rightT;

  const picture = layoutPicture(w, l, aspect);
  const pageMaterial = sk.decalMaterial(rightPageTexture(picture.fraction));
  const rightPage = new THREE.Mesh(
    tag(new THREE.PlaneGeometry(w - 0.008, l - 0.004).rotateX(-Math.PI / 2), { tone: 0.03, id: rightBlock.geometry.attributes.aId.array[0], keepUv: true }),
    pageMaterial,
  );
  rightPage.position.set(0.003, pageTop + 0.0004, 0);
  rightPage.frustumCulled = false;
  group.add(rightPage);

  // A ilustracao (a imagem entra depois, em setPicture).
  const pictureMesh = new THREE.Mesh(
    tag(new THREE.PlaneGeometry(picture.w, picture.h).rotateX(-Math.PI / 2), { tone: 0, id: newId(), kind: KIND.image, keepUv: true }),
    material,
  );
  pictureMesh.position.set(picture.x, pageTop + 0.0008, picture.z);
  pictureMesh.frustumCulled = false;
  group.add(pictureMesh);

  // Capa da frente: gira na lombada. Por dentro dela, o miolo da esquerda
  // (que, aberto, mostra a pagina da esquerda virada para cima).
  const hinge = joint(group, -w / 2, t, 0);
  const coverItems = [];
  coverItems.push([box(w + 0.008, c, l + 0.012, 0.0018), at(w / 2 + 0.001, -c / 2, 0), { tone: coverTone, id: newId() }]);
  const coverMesh = new THREE.Mesh(merge(coverItems), material);
  coverMesh.frustumCulled = false;
  hinge.add(coverMesh);
  const titlePlate = new THREE.Mesh(
    tag(new THREE.PlaneGeometry(w * 0.92, l * 0.92).rotateX(-Math.PI / 2), { tone: coverTone, id: coverMesh.geometry.attributes.aId.array[0], keepUv: true }),
    sk.decalMaterial(coverTexture(title)),
  );
  titlePlate.position.set(w / 2 + 0.001, 0.0004, 0);
  titlePlate.frustumCulled = false;
  hinge.add(titlePlate);
  const leftBlock = new THREE.Mesh(
    tag(new THREE.BoxGeometry(w - 0.008, left, l - 0.004), { tone: 0.03, id: newId(), keepUv: true }),
    sk.decalMaterial(pageEdges()),
  );
  leftBlock.position.set(w / 2 - 0.001, -c - left / 2, 0);
  leftBlock.frustumCulled = false;
  hinge.add(leftBlock);
  const leftPage = new THREE.Mesh(
    tag(new THREE.PlaneGeometry(w - 0.008, l - 0.004).rotateX(Math.PI / 2), { tone: 0.03, id: leftBlock.geometry.attributes.aId.array[0], keepUv: true }),
    sk.decalMaterial(leftPageTexture()),
  );
  // (Virada para baixo enquanto fechado; aberto, fica para cima.)
  leftPage.rotation.y = Math.PI;
  leftPage.position.set(w / 2 - 0.001, -c - left - 0.0004, 0);
  leftPage.frustumCulled = false;
  hinge.add(leftPage);

  // Fita marcadora pendurada para fora.
  const ribbon = part(box(0.007, 0.07, 0.0008), material, { tone: 0.75 }, group);
  ribbon.position.set(-w * 0.12, c + rightT * 0.6 - 0.035, l / 2 + 0.0015);
  ribbon.rotation.z = 0.08;

  // Folhas que passam voando: cada uma com 8 gomos, curvada pela conta.
  const leaves = [];
  for (let i = 0; i < 6; i += 1) {
    const geometry = tag(new THREE.PlaneGeometry(w - 0.01, l - 0.008, 8, 1).rotateX(-Math.PI / 2), { tone: 0.03, id: newId(), keepUv: true });
    const leaf = new THREE.Mesh(geometry, sk.decalMaterial(flyingPageTexture(200 + i)));
    leaf.frustumCulled = false;
    leaf.visible = false;
    group.add(leaf);
    leaves.push({ mesh: leaf, rest: Float32Array.from(geometry.attributes.position.array) });
  }

  return { group, hinge, leaves, pictureMesh, picture, pageTop, w, l, t, rightPage };
}

/**
 * Onde a ilustracao fica na pagina da direita: na proporcao da tela (para
 * encher a tela exatamente quando a camera chega nela), no alto da pagina.
 */
export function layoutPicture(w, l, aspect) {
  const pageW = w - 0.008;
  const pageL = l - 0.004;
  let pw = pageW * 0.84;
  let ph = pw / aspect;
  if (ph > pageL * 0.6) {
    ph = pageL * 0.6;
    pw = ph * aspect;
  }
  const x = 0.003;
  const z = -pageL / 2 + pageL * 0.1 + ph / 2;
  return {
    w: pw,
    h: ph,
    x,
    z,
    fraction: {
      x: (pageW - pw) / 2 / pageW,
      y: 1 - (z + ph / 2 + pageL / 2) / pageL,
      w: pw / pageW,
      h: ph / pageL,
    },
  };
}

/**
 * Curva a folha "i": 0 = deitada sobre a pagina da direita, 1 = deitada a
 * esquerda. A folha gira na lombada e a ponta atrasa (fica curva no ar).
 */
export function bendLeaf(book, leaf, progress, lift) {
  const { w } = book;
  const pos = leaf.mesh.geometry.attributes.position;
  const rest = leaf.rest;
  const hingeX = -w / 2;
  const base = progress * Math.PI;
  const curl = Math.sin(progress * Math.PI) * 0.9;
  for (let k = 0; k < pos.count; k += 1) {
    const rx = rest[k * 3];
    const rz = rest[k * 3 + 2];
    const s = rx - hingeX;
    const u = s / w;
    const angle = base - curl * u * (progress < 0.5 ? 1 : -1) * 0.5;
    pos.setXYZ(k, hingeX + Math.cos(angle) * s, book.pageTop + lift + Math.sin(angle) * s, rz);
  }
  pos.needsUpdate = true;
  leaf.mesh.geometry.computeVertexNormals();
}

/**
 * A mao do menino (de perto): antebraco, palma, quatro dedos e o polegar.
 * Segura o livro pela borda: polegar por cima, dedos por baixo. A origem e o
 * ponto da borda do livro onde ela segura; o antebraco sobe para a direita.
 */
export function makeHand(material) {
  const root = new THREE.Group();
  const wrist = joint(root, 0.05, 0.0, 0);
  const skin = 0.03;
  const id = newId();
  const palm = part(box(0.024, 0.07, 0.085, 0.011), material, { tone: skin, id }, wrist);
  palm.position.set(0.0, 0.0, 0);
  const fingers = [];
  for (let i = 0; i < 4; i += 1) {
    const knuckle = joint(wrist, -0.004, -0.03, -0.03 + i * 0.02);
    const seg1 = part(limb(0.0095, 0.0085, 0.03, 8), material, { tone: skin, id }, knuckle);
    seg1.rotation.z = -Math.PI / 2 - 0.15;
    const mid = joint(knuckle, -0.03, -0.004, 0);
    part(limb(0.0085, 0.0075, 0.024, 8), material, { tone: skin, id }, mid).rotation.z = -Math.PI / 2 - 0.25;
    fingers.push(knuckle);
  }
  const thumbBase = joint(wrist, -0.006, 0.032, 0.012);
  part(limb(0.011, 0.009, 0.036, 8), material, { tone: skin, id }, thumbBase).rotation.z = -Math.PI / 2 + 0.2;
  const forearm = part(limb(0.024, 0.027, 0.34, 12), material, { tone: skin, id: newId() }, wrist);
  forearm.position.set(0.006, 0.02, 0);
  forearm.rotation.z = Math.PI * 0.72;
  const sleeve = part(limb(0.05, 0.055, 0.14, 14), material, { tone: 0.5, id: newId() }, wrist);
  sleeve.position.set(0.006 + Math.sin(Math.PI * 0.72) * 0.3, 0.02 - Math.cos(Math.PI * 0.72) * 0.3, 0);
  sleeve.rotation.z = Math.PI * 0.72;
  return { root, wrist, fingers, thumbBase };
}

/** A "mesa" que nao aparece: so recebe a sombra hachurada. */
export function makeTable(material) {
  const mesh = part(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), material, { tone: 0, id: 0, kind: KIND.shadowOnly });
  return mesh;
}

/** Poeirinha do tranco e os riscos de impacto. */
export function makeImpact(material) {
  const group = new THREE.Group();
  const puffs = [];
  const id = newId();
  for (let i = 0; i < 6; i += 1) {
    const g = new THREE.Group();
    const r = rng(300 + i);
    for (let k = 0; k < 6; k += 1) {
      const ball = part(new THREE.IcosahedronGeometry(0.022 + r() * 0.02, 1), material, { tone: 0.0, kind: KIND.plain, id: k % 3 ? id : newId() }, g);
      ball.position.set((r() - 0.5) * 0.06, r() * 0.03, (r() - 0.5) * 0.06);
    }
    group.add(g);
    puffs.push(g);
  }
  return { group, puffs };
}

export { sphere };
