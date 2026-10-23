import * as THREE from "three";
import { KIND, at, box, cylinder, lathe, limb, merge, newId, part, sphere, tag, tube } from "./kit.js";
import { rng } from "./cast.js";

/**
 * A esquina da cena 1: duas ruas que se cruzam, quatro quarteiroes com
 * calcada, sobrados e lojas, o poste da esquina (onde o caminhao para), a
 * fiacao com passarinhos, arvores, banca de jornal, caixa dos Correios, um
 * fusca estacionado e, no fim da rua, a igreja (onde o sol se poe).
 *
 * Coordenadas (metros): o cruzamento no meio, a "rua do caminhao" (B) ao
 * longo de z, a "rua de casa" (A) ao longo de x. Calcadas de 2,5 m; as
 * fachadas ficam a 6 m do meio da rua.
 *
 * Quase tudo e parado e vira poucas geometrias juntas (merge). O que mexe
 * (folhas, passarinhos, a porta de casa) volta em "live".
 */

export const CITY = {
  curb: 3.5,
  facade: 6,
  walk: 0.15,
  // Poste da esquina, onde o menino espera e o caminhao para.
  lamp: new THREE.Vector3(-3.92, 0.15, -7.55),
  // A porta de casa do menino (fachada da rua A, sobre a padaria).
  door: new THREE.Vector3(-9.6, 0.15, -6),
};

// Matriz de uma fachada: o x local corre ao longo da fachada, o z local
// aponta para a rua. "face": +z, +x, -x ou -z (para onde a fachada olha).
function facadeFrame(face, x0, z0) {
  const m = new THREE.Matrix4();
  const r = { "+z": 0, "+x": Math.PI / 2, "-x": -Math.PI / 2, "-z": Math.PI }[face];
  m.makeRotationY(r);
  m.setPosition(x0, 0, z0);
  return m;
}

function place(frame, local) {
  return frame.clone().multiply(local);
}

/**
 * Detalhes de uma fachada (sem o corpo do predio): janelas por andar, terreo
 * (loja com toldo listrado ou casa com porta e grade), cornija, calha, caixa
 * d'agua e antena no telhado. "o": { width, floors, wall, shop, sign, door,
 * seed, roof, number, bricks, balcony }.
 */
function facade(items, decalItems, frame, o) {
  const rand = rng(o.seed);
  const wallId = o.wallId;
  const add = (geometry, local, tone, extra = {}) => items.push([geometry, place(frame, local), { tone, ...extra }]);
  const W = o.width;
  const ground = 3.4;
  const floorH = 3.0;
  const height = ground + floorH * (o.floors - 1);
  const frameTone = 0.03;

  // Faixas: rodape, entre o terreo e o primeiro andar, e a cornija no topo.
  add(box(W + 0.04, 0.45, 0.08), at(W / 2, 0.22 + 0.15, 0.04), Math.min(0.6, o.wall + 0.2));
  add(box(W + 0.08, 0.22, 0.14), at(W / 2, ground, 0.07), frameTone);
  add(box(W + 0.3, 0.32, 0.42), at(W / 2, height + 0.1, 0.2), frameTone);
  add(box(W + 0.36, 0.1, 0.5), at(W / 2, height + 0.28, 0.24), Math.min(0.5, o.wall + 0.15));
  add(box(W, 0.55, 0.22), at(W / 2, height + 0.6, 0.0), o.wall);
  if (o.floors > 2 && rand() < 0.6) {
    for (let f = 2; f < o.floors; f += 1) add(box(W + 0.04, 0.12, 0.1), at(W / 2, ground + floorH * (f - 1), 0.05), frameTone);
  }

  // Janelas dos andares de cima.
  const count = Math.max(1, Math.floor((W - 0.6) / 2.3));
  const step = W / count;
  const winW = Math.min(1.15, step * 0.5);
  const winH = 1.55;
  const arched = rand() < 0.35;
  for (let f = 1; f < o.floors; f += 1) {
    const y = ground + floorH * (f - 1) + 1.55;
    const balconyFloor = o.balcony && f === 1;
    for (let i = 0; i < count; i += 1) {
      const x = step * (i + 0.5);
      const style = rand();
      // Vao escuro (o interior), moldura, cruz da janela, peitoril e verga.
      add(box(winW, winH, 0.1), at(x, y, 0.0), 0.86, { id: newId() });
      add(box(0.09, winH + 0.1, 0.12), at(x - winW / 2, y, 0.04), frameTone);
      add(box(0.09, winH + 0.1, 0.12), at(x + winW / 2, y, 0.04), frameTone);
      add(box(winW + 0.1, 0.09, 0.12), at(x, y + winH / 2, 0.04), frameTone);
      add(box(winW + 0.1, 0.09, 0.12), at(x, y - winH / 2, 0.04), frameTone);
      add(box(0.04, winH, 0.06), at(x, y, 0.05), frameTone);
      add(box(winW, 0.04, 0.06), at(x, y + winH * 0.18, 0.05), frameTone);
      add(box(winW + 0.32, 0.08, 0.24), at(x, y - winH / 2 - 0.08, 0.1), frameTone);
      if (arched) {
        add(new THREE.TorusGeometry(winW / 2 + 0.08, 0.06, 6, 14, Math.PI), at(x, y + winH / 2 + 0.02, 0.05), frameTone);
      } else {
        add(box(winW + 0.36, 0.14, 0.12), at(x, y + winH / 2 + 0.2, 0.06), frameTone);
      }
      // Cortina (quebra o escuro do vao).
      if (style < 0.45) {
        add(box(winW * 0.42, winH * 0.82, 0.02), at(x - winW * 0.24, y - 0.02, 0.055), 0.12);
      }
      // Venezianas abertas, cada uma num angulo.
      if (style > 0.55) {
        for (const side of [-1, 1]) {
          const open = 1.2 + rand() * 0.9;
          const local = at(x + side * (winW / 2 + 0.04), y, 0.06, { ry: -side * open })
            .multiply(at(side * winW * 0.25, 0, 0));
          add(box(winW * 0.5, winH, 0.05), local, 0.34);
          for (let k = 0; k < 6; k += 1) {
            add(box(winW * 0.48, 0.03, 0.07), local.clone().multiply(at(0, -winH / 2 + 0.15 + k * 0.25, 0)), 0.6);
          }
        }
      }
      // Floreira com plantas.
      if (style > 0.25 && style < 0.6 && !balconyFloor) {
        add(box(winW + 0.1, 0.22, 0.26), at(x, y - winH / 2 - 0.24, 0.16), 0.3);
        for (let k = 0; k < 5; k += 1) {
          add(new THREE.IcosahedronGeometry(0.11 + rand() * 0.06, 0), at(x - winW / 2 + 0.1 + k * (winW / 4), y - winH / 2 - 0.08 + rand() * 0.06, 0.18), 0.5);
        }
      }
      // Sacada com grade.
      if (balconyFloor) {
        add(box(winW + 0.9, 0.12, 0.75), at(x, y - winH / 2 - 0.12, 0.37), frameTone);
        add(box(winW + 0.9, 0.05, 0.05), at(x, y - winH / 2 + 0.85, 0.72), frameTone);
        for (let k = 0; k <= 10; k += 1) {
          add(box(0.025, 0.95, 0.025), at(x - (winW + 0.9) / 2 + k * ((winW + 0.9) / 10), y - winH / 2 + 0.38, 0.72), 0.7);
        }
      }
    }
  }

  // Terreo.
  if (o.shop) {
    const shopW = W - 1.2;
    add(box(shopW, 2.3, 0.1), at(W / 2, 1.5, 0.0), 0.86, { id: newId() });
    add(box(shopW + 0.2, 0.12, 0.14), at(W / 2, 2.7, 0.06), frameTone);
    for (let k = 0; k <= 4; k += 1) add(box(0.08, 2.3, 0.12), at(0.6 + k * (shopW / 4), 1.5, 0.05), frameTone);
    // Mercadoria na vitrine.
    for (let k = 0; k < 7; k += 1) {
      add(box(0.25 + rand() * 0.3, 0.3 + rand() * 0.4, 0.2), at(0.9 + k * (shopW / 7), 0.7 + rand() * 0.2, 0.08), 0.2 + rand() * 0.4);
    }
    // Toldo listrado: tiras alternando claro e escuro, com a barra recortada.
    const stripes = Math.round(shopW / 0.38);
    for (let k = 0; k < stripes; k += 1) {
      const sx = 0.6 + (k + 0.5) * (shopW / stripes);
      const tone = k % 2 ? 0.05 : 0.62;
      add(box(shopW / stripes, 0.05, 1.35), at(sx, 3.05, 0.6, { rx: 0.45 }), tone, { id: o.awningId });
      add(new THREE.CylinderGeometry(shopW / stripes / 2, shopW / stripes / 2, 0.05, 10, 1, false, 0, Math.PI), at(sx, 2.72, 1.22, { rx: Math.PI / 2 + 0.45 }), tone, { id: o.awningId });
    }
    if (o.sign) {
      const plate = new THREE.PlaneGeometry(Math.min(3.6, shopW * 0.7), 0.85);
      decalItems.push([o.sign, plate, place(frame, at(W / 2, 3.72, 0.08)), { tone: 0.04, id: newId() }]);
      add(box(Math.min(3.6, shopW * 0.7) + 0.16, 0.95, 0.08), at(W / 2, 3.72, 0.02), 0.02);
    }
  } else {
    // Casa: porta com degraus e janelas com grade.
    const doorX = o.doorX ?? W * 0.3;
    add(box(1.1, 2.25, 0.1), at(doorX, 1.42, -0.02), 0.82, { id: o.doorId ?? newId() });
    add(box(1.35, 0.14, 0.16), at(doorX, 2.62, 0.06), frameTone);
    add(box(0.12, 2.4, 0.14), at(doorX - 0.62, 1.4, 0.05), frameTone);
    add(box(0.12, 2.4, 0.14), at(doorX + 0.62, 1.4, 0.05), frameTone);
    if (o.steps) {
      add(box(1.6, 0.16, 0.45), at(doorX, 0.08, 0.22), 0.12);
      add(box(1.4, 0.15, 0.25), at(doorX, 0.23, 0.12), 0.12);
    }
    const winX = doorX > W / 2 ? W * 0.28 : W * 0.7;
    add(box(1.4, 1.3, 0.1), at(winX, 1.75, 0.0), 0.86, { id: newId() });
    add(box(1.55, 0.1, 0.2), at(winX, 1.05, 0.08), frameTone);
    for (let k = 0; k < 8; k += 1) add(box(0.025, 1.3, 0.03), at(winX - 0.65 + k * 0.186, 1.75, 0.1), 0.75);
    add(box(1.4, 0.03, 0.03), at(winX, 2.05, 0.1), 0.75);
    if (o.number) {
      decalItems.push([o.number, new THREE.PlaneGeometry(0.32, 0.32), place(frame, at(doorX + 0.95, 2.1, 0.03)), { tone: 0.04, id: newId() }]);
    }
  }

  // Cano da calha descendo no canto.
  if (rand() < 0.7) {
    const x = rand() < 0.5 ? 0.18 : W - 0.18;
    add(cylinder(0.055, 0.055, height + 0.3, 8), at(x, (height + 0.3) / 2, 0.12), 0.25);
  }
  // Tijolo aparecendo onde o reboco caiu.
  if (o.bricks) {
    const bx = 0.8 + rand() * (W - 2.4);
    const by = 1.0 + rand() * (height - 2.5);
    decalItems.push([o.bricks, new THREE.PlaneGeometry(1.5, 1.5), place(frame, at(bx + 0.75, by, 0.012)), { tone: o.wall, id: wallId }]);
  }
  // Telhado: caixa d'agua, antena, chamine.
  const roofZ = -2.5;
  if (o.roof !== false) {
    const r = rand();
    if (r < 0.55) {
      const tx = 1 + rand() * (W - 2);
      add(box(1.4, 0.3, 1.4), at(tx, height + 0.75, roofZ), 0.4);
      add(cylinder(0.62, 0.55, 0.95, 16), at(tx, height + 1.38, roofZ), 0.12);
      add(cylinder(0.66, 0.66, 0.08, 16), at(tx, height + 1.88, roofZ), 0.5);
    }
    if (r > 0.3) {
      const ax = 0.6 + rand() * (W - 1.2);
      add(cylinder(0.025, 0.025, 1.8, 5), at(ax, height + 1.5, roofZ - 1), 0.7);
      for (let k = 0; k < 3; k += 1) add(cylinder(0.015, 0.015, 0.9 - k * 0.2, 4), at(ax, height + 1.9 + k * 0.25, roofZ - 1, { rx: Math.PI / 2 }), 0.7);
    }
    if (rand() < 0.4) {
      const cx = 0.6 + rand() * (W - 1.2);
      add(box(0.5, 1.0, 0.5), at(cx, height + 1.0, roofZ - 2), 0.35);
      add(box(0.62, 0.1, 0.62), at(cx, height + 1.52, roofZ - 2), 0.1);
    }
  }
  return height;
}

/** Um predio: o corpo e as fachadas que dao para a rua. */
function building(items, decalItems, spec) {
  const { x, z, w, d, floors, wall = 0.08, faces, seed = 1 } = spec;
  const height = 3.4 + 3.0 * (floors - 1);
  const wallId = newId();
  items.push([box(w, height + 0.5, d), at(x + w / 2, (height + 0.5) / 2, z - d / 2), { tone: wall, id: wallId }]);
  faces.forEach((f, i) => {
    facade(items, decalItems, facadeFrame(f.face, f.x0, f.z0), {
      width: f.width,
      floors,
      wall,
      wallId,
      awningId: newId(),
      seed: seed * 13 + i,
      ...f,
    });
  });
}

/** O poste ornamentado da esquina (com a placa da rua). */
function heroLamp(items, decalItems, decals, p) {
  const id = newId();
  const T = 0.72;
  const base = lathe([[0.2, 0], [0.2, 0.12], [0.14, 0.18], [0.14, 0.45], [0.1, 0.55], [0.12, 0.62], [0.08, 0.72], [0.075, 0.9]], 16);
  items.push([base, at(p.x, p.y, p.z), { tone: T, id }]);
  items.push([cylinder(0.06, 0.075, 3.4, 12), at(p.x, p.y + 2.55, p.z), { tone: T, id }]);
  for (const y of [1.6, 3.1, 4.15]) items.push([new THREE.TorusGeometry(0.075, 0.025, 6, 14), at(p.x, p.y + y, p.z, { rx: Math.PI / 2 }), { tone: T, id }]);
  // Braco em curva com a lanterna pendurada (virado para a rua B).
  items.push([tube([[0, 4.2, 0], [0.1, 4.55, 0], [0.45, 4.7, 0], [0.8, 4.55, 0]], 0.035, 20, 6), at(p.x, p.y, p.z), { tone: T, id }]);
  items.push([tube([[0.45, 4.7, 0], [0.32, 4.4, 0], [0.12, 4.3, 0]], 0.02, 10, 5), at(p.x, p.y, p.z), { tone: T, id }]);
  const lid = newId();
  items.push([new THREE.ConeGeometry(0.24, 0.22, 8), at(p.x + 0.8, p.y + 4.38, p.z), { tone: T, id: lid }]);
  items.push([sphere(0.04, 8, 6), at(p.x + 0.8, p.y + 4.52, p.z), { tone: T, id: lid }]);
  items.push([lathe([[0.08, -0.35], [0.17, -0.12], [0.2, 0.0]], 8), at(p.x + 0.8, p.y + 4.27, p.z), { tone: 0.0, kind: KIND.plain, id: newId() }]);
  items.push([cylinder(0.09, 0.05, 0.08, 8), at(p.x + 0.8, p.y + 3.88, p.z), { tone: T, id: lid }]);
  // Placas da rua: duas laminas em cruz.
  for (const r of [0, Math.PI / 2]) {
    items.push([box(0.9, 0.24, 0.03), at(p.x, p.y + 3.55 + (r ? 0.28 : 0), p.z, { ry: r }), { tone: 0.05, id: newId() }]);
    for (const side of [1, -1]) {
      decalItems.push([decals.street, new THREE.PlaneGeometry(0.84, 0.22), at(p.x + (r ? side * 0.017 : 0), p.y + 3.55 + (r ? 0.28 : 0), p.z + (r ? 0 : side * 0.017), { ry: r + (side < 0 ? Math.PI : 0) }), { tone: 0.04, id: newId() }]);
    }
  }
}

/** Poste simples (os da rua inteira). */
function streetLamp(items, x, z, armSide) {
  const id = newId();
  items.push([cylinder(0.05, 0.08, 5.2, 8), at(x, 2.75, z), { tone: 0.6, id }]);
  items.push([tube([[0, 5.2, 0], [armSide * 0.3, 5.45, 0], [armSide * 0.9, 5.4, 0]], 0.03, 10, 5), at(x, 0.15, z), { tone: 0.6, id }]);
  items.push([lathe([[0.03, -0.18], [0.2, -0.05], [0.22, 0.02], [0.05, 0.1]], 10), at(x + armSide * 0.9, 5.42, z), { tone: 0.4, id: newId() }]);
}

/** Poste de luz (concreto) com cruzeta; devolve onde os fios passam. */
function powerPole(items, x, z) {
  const id = newId();
  items.push([cylinder(0.11, 0.17, 9, 8), at(x, 4.6, z), { tone: 0.15, id }]);
  items.push([box(1.8, 0.12, 0.12), at(x, 8.5, z), { tone: 0.3, id }]);
  const tops = [];
  for (const dx of [-0.75, 0, 0.75]) {
    items.push([cylinder(0.035, 0.05, 0.16, 6), at(x + dx, 8.64, z), { tone: 0.05, id }]);
    tops.push(new THREE.Vector3(x + dx, 8.7, z));
  }
  items.push([cylinder(0.25, 0.25, 0.7, 10), at(x - 0.35, 7.6, z), { tone: 0.35, id: newId() }]);
  return tops;
}

/** Fio caido entre dois pontos (catenaria). */
function wire(items, a, b, sag = 0.45) {
  const points = [];
  for (let i = 0; i <= 10; i += 1) {
    const u = i / 10;
    points.push([a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * sag, a.z + (b.z - a.z) * u]);
  }
  items.push([tube(points, 0.012, 20, 4), null, { tone: 0.8, id: newId(), kind: KIND.solid }]);
}

/** Arvore: tronco torto, galhos e copa de tufos. A copa balanca (live). */
function tree(material, items, x, z, seed, scale = 1) {
  const rand = rng(seed);
  const id = newId();
  const s = scale;
  items.push([limb(0.2 * s, 0.13 * s, 3.2 * s, 10), at(x, 0.15, z, { rx: Math.PI, rz: (rand() - 0.5) * 0.12 }), { tone: 0.45, id }]);
  items.push([lathe([[0.34 * s, 0], [0.2 * s, 0.25 * s], [0.18 * s, 0.4 * s]], 10), at(x, 0.15, z), { tone: 0.45, id }]);
  // Canteiro.
  items.push([box(1.1, 0.06, 1.1), at(x, 0.17, z), { tone: 0.55, id: newId() }]);
  const crown = new THREE.Group();
  crown.position.set(x, 0.15 + 3.0 * s, z);
  const crownItems = [];
  for (let i = 0; i < 4; i += 1) {
    const a = rand() * Math.PI * 2;
    crownItems.push([limb(0.07 * s, 0.035 * s, 1.3 * s, 6), at(0, 0, 0, { rz: Math.cos(a) * 0.9, rx: Math.sin(a) * 0.9 }), { tone: 0.45, id }]);
  }
  const leafId = newId();
  for (let i = 0; i < 16; i += 1) {
    const a = rand() * Math.PI * 2;
    const rr = (0.4 + rand() * 1.1) * s;
    const g = new THREE.IcosahedronGeometry((0.55 + rand() * 0.45) * s, 1);
    // Tufos irregulares (vertices empurrados para dentro e para fora).
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k += 1) {
      const f = 0.85 + rand() * 0.3;
      pos.setXYZ(k, pos.getX(k) * f, pos.getY(k) * f, pos.getZ(k) * f);
    }
    g.computeVertexNormals();
    crownItems.push([g, at(Math.cos(a) * rr, (0.5 + rand() * 1.4) * s, Math.sin(a) * rr), { tone: 0.32, id: i % 3 === 0 ? newId() : leafId }]);
  }
  const mesh = new THREE.Mesh(merge(crownItems), material);
  mesh.frustumCulled = false;
  crown.add(mesh);
  return crown;
}

/** Fusca estacionado. */
function beetle(items, x, z, ry) {
  const id = newId();
  const m = at(x, 0, z, { ry });
  const add = (g, local, tone, extra = {}) => items.push([g, m.clone().multiply(local), { tone, id, ...extra }]);
  const bodyShape = sphere(1, 24, 16);
  add(bodyShape, at(0, 0.72, 0, { sx: 0.82, sy: 0.55, sz: 1.95 }), 0.42);
  add(sphere(1, 20, 14), at(0, 1.08, -0.15, { sx: 0.7, sy: 0.42, sz: 1.0 }), 0.42, { id: newId() });
  add(sphere(1, 16, 10), at(0, 1.15, -0.1, { sx: 0.64, sy: 0.33, sz: 0.85 }), 0.86, { id: newId() });
  for (const [wx, wz] of [[0.72, 1.15], [-0.72, 1.15], [0.72, -1.2], [-0.72, -1.2]]) {
    add(sphere(1, 16, 10), at(wx * 0.98, 0.6, wz, { sx: 0.25, sy: 0.42, sz: 0.55 }), 0.48, { id: newId() });
    add(new THREE.TorusGeometry(0.24, 0.1, 8, 16), at(wx, 0.34, wz, { ry: Math.PI / 2 }), 0.9, { id: newId() });
    add(cylinder(0.15, 0.15, 0.1, 12), at(wx * 1.03, 0.34, wz, { rz: Math.PI / 2 }), 0.08, { id: newId() });
  }
  for (const side of [1, -1]) {
    add(sphere(0.13, 12, 8), at(side * 0.5, 0.82, 1.75, { sz: 0.6 }), 0.0, { id: newId(), kind: KIND.plain });
  }
  add(box(1.6, 0.08, 0.1, 0.03), at(0, 0.42, 1.98), 0.05, { id: newId() });
  add(box(1.6, 0.08, 0.1, 0.03), at(0, 0.42, -1.98), 0.05, { id: newId() });
}

/** Bicicleta encostada. */
function bicycle(items, m) {
  const id = newId();
  const add = (g, local, tone) => items.push([g, local ? m.clone().multiply(local) : m.clone(), { tone, id }]);
  for (const zz of [-0.52, 0.52]) {
    add(new THREE.TorusGeometry(0.33, 0.025, 6, 22), at(0, 0.36, zz, { ry: Math.PI / 2 }), 0.85);
    add(cylinder(0.01, 0.01, 0.62, 4), at(0, 0.36, zz, { rx: Math.PI / 2 }), 0.6);
    add(cylinder(0.01, 0.01, 0.62, 4), at(0, 0.36, zz), 0.6);
  }
  add(tube([[0, 0.36, -0.52], [0, 0.78, -0.12], [0, 0.82, 0.38], [0, 0.36, 0.52]], 0.022, 16, 5), null, 0.7);
  add(tube([[0, 0.78, -0.12], [0, 0.36, 0.0], [0, 0.82, 0.38]], 0.02, 12, 5), null, 0.7);
  add(tube([[0, 0.82, 0.38], [0, 0.98, 0.48], [-0.25, 1.0, 0.48], [0.25, 1.0, 0.48]], 0.016, 12, 5), null, 0.7);
  add(box(0.12, 0.05, 0.25, 0.02), at(0, 0.92, -0.14), 0.8);
}

/** Banca de jornal da esquina. */
function newsstand(items, decalItems, decals, m) {
  const id = newId();
  const add = (g, local, tone, extra = {}) => items.push([g, m.clone().multiply(local), { tone, id, ...extra }]);
  add(box(1.9, 2.3, 1.5, 0.05), at(0, 1.3, 0), 0.08);
  add(box(2.3, 0.12, 1.9, 0.03), at(0, 2.52, 0.1), 0.5, { id: newId() });
  add(box(1.6, 1.4, 0.06), at(0, 1.4, 0.76), 0.86, { id: newId() });
  const rand = rng(77);
  for (let row = 0; row < 3; row += 1) {
    for (let k = 0; k < 5; k += 1) {
      add(box(0.26, 0.34, 0.03), at(-0.62 + k * 0.31, 0.95 + row * 0.42, 0.81, { rz: (rand() - 0.5) * 0.08 }), 0.05 + rand() * 0.5, { id: newId() });
    }
  }
  add(box(0.7, 0.9, 0.5), at(0.95, 0.6, 0.6), 0.2, { id: newId() });
  decalItems.push([decals.banca, new THREE.PlaneGeometry(1.4, 0.4), m.clone().multiply(at(0, 2.3, 0.77)), { tone: 0.04, id: newId() }]);
}

/** Caixa de coleta dos Correios, num pe. */
function mailbox(items, x, z) {
  const id = newId();
  items.push([cylinder(0.04, 0.04, 0.9, 6), at(x, 0.6, z), { tone: 0.6, id }]);
  items.push([box(0.45, 0.6, 0.36, 0.05), at(x, 1.35, z), { tone: 0.2, id: newId() }]);
  items.push([lathe([[0.0, 0], [0.24, 0], [0.22, 0.08], [0.0, 0.16]], 12), at(x, 1.65, z, { sz: 0.8 }), { tone: 0.2, id: newId() }]);
  items.push([box(0.3, 0.04, 0.02), at(x, 1.48, z + 0.19), { tone: 0.9, kind: KIND.solid, id: newId() }]);
}

/** Hidrante baixinho. */
function hydrant(items, x, z) {
  const id = newId();
  items.push([lathe([[0.14, 0], [0.14, 0.05], [0.1, 0.08], [0.1, 0.45], [0.12, 0.5], [0.12, 0.56], [0.06, 0.66], [0.02, 0.7]], 12), at(x, 0.15, z), { tone: 0.35, id }]);
  for (const r of [0, Math.PI]) items.push([cylinder(0.04, 0.04, 0.12, 8), at(x, 0.48, z, { rz: Math.PI / 2, ry: r }).multiply(at(0.12, 0, 0)), { tone: 0.35, id }]);
}

/** Banco de praca. */
function bench(items, m) {
  const id = newId();
  const add = (g, local, tone) => items.push([g, m.clone().multiply(local), { tone, id }]);
  for (let k = 0; k < 3; k += 1) add(box(1.6, 0.04, 0.11), at(0, 0.46, -0.13 + k * 0.13), 0.35);
  for (let k = 0; k < 2; k += 1) add(box(1.6, 0.1, 0.03), at(0, 0.66 + k * 0.16, -0.24, { rx: -0.15 }), 0.35);
  for (const x of [-0.7, 0.7]) {
    add(box(0.05, 0.46, 0.4), at(x, 0.23, 0), 0.8);
    add(box(0.05, 0.4, 0.05), at(x, 0.66, -0.25), 0.8);
  }
}

/** A igreja no fim da rua (de longe, quase silhueta). */
function church(items, x, z) {
  const id = newId();
  items.push([box(16, 11, 10), at(x, 5.5, z - 5), { tone: 0.08, id }]);
  // Frontao triangular.
  const tri = new THREE.Shape();
  tri.moveTo(-8.4, 0);
  tri.lineTo(8.4, 0);
  tri.lineTo(0, 4.2);
  tri.lineTo(-8.4, 0);
  items.push([new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }), at(x, 11, z - 0.3), { tone: 0.06, id: newId() }]);
  items.push([box(4.5, 22, 4.5), at(x, 11, z + 0.6), { tone: 0.1, id: newId() }]);
  items.push([new THREE.ConeGeometry(3.4, 7, 4), at(x, 25.5, z + 0.6, { ry: Math.PI / 4 }), { tone: 0.5, id: newId() }]);
  items.push([box(0.25, 2.4, 0.25), at(x, 30, z + 0.6), { tone: 0.7, id: newId() }]);
  items.push([box(1.4, 0.25, 0.25), at(x, 30.4, z + 0.6), { tone: 0.7, id: newId() }]);
  // Sino e janelas da torre, porta em arco.
  items.push([box(1.8, 2.6, 0.2), at(x, 17.5, z + 2.9), { tone: 0.9, id: newId(), kind: KIND.solid }]);
  items.push([sphere(1.6, 16, 10), at(x, 2.2, z + 2.86, { sz: 0.1 }), { tone: 0.88, id: newId() }]);
  items.push([box(3.2, 2.2, 0.2), at(x, 1.1, z + 2.86), { tone: 0.88, id: newId() }]);
  for (const side of [-1, 1]) {
    items.push([box(1.4, 3, 0.2), at(x + side * 5.2, 6, z + 0.05), { tone: 0.85, id: newId() }]);
  }
  for (let k = 0; k < 4; k += 1) items.push([box(10 + k * 1.2, 0.18, 0.6), at(x, 0.09 + k * 0.18, z + 3.6 + (3 - k) * 0.5), { tone: 0.1, id }]);
}

/** Calcada de um quarteirao com a quina arredondada no cruzamento. */
function sidewalk(items, sx, sz) {
  const c = CITY.curb;
  const L = 130;
  const R = 1.4;
  const shape = new THREE.Shape();
  // Desenhado no quadrante +x +z e espelhado.
  shape.moveTo(c, L);
  shape.lineTo(c, c + R);
  shape.quadraticCurveTo(c, c, c + R, c);
  shape.lineTo(L, c);
  shape.lineTo(L, L);
  shape.lineTo(c, L);
  const g = new THREE.ExtrudeGeometry(shape, { depth: CITY.walk, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(Math.PI / 2);
  g.translate(0, CITY.walk, 0);
  g.scale(sx, 1, sz);
  if (sx * sz < 0) {
    // (Espelhar so um eixo vira a face do avesso.)
    const index = g.index ? g.index.array : null;
    if (!index) {
      const pos = g.attributes.position.array;
      for (let i = 0; i < pos.length; i += 9) {
        for (let k = 0; k < 3; k += 1) {
          const t = pos[i + 3 + k];
          pos[i + 3 + k] = pos[i + 6 + k];
          pos[i + 6 + k] = t;
        }
      }
    }
    g.computeVertexNormals();
  }
  items.push([g, null, { tone: 0.05, id: newId() }]);
  // Guia (meio-fio) em pedra mais escura.
}

export function makeCity(material, decals) {
  const items = [];
  const decalItems = [];
  const F = CITY.facade;
  const live = {};

  // Chao: asfalto e as faixas.
  items.push([new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), null, { tone: 0.2, id: newId() }]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) sidewalk(items, sx, sz);
  const zebra = newId();
  for (let k = 0; k < 6; k += 1) {
    const off = -2.75 + k * 1.1;
    items.push([box(0.55, 0.012, 2.4), at(off, 0.006, -5.0), { tone: 0.0, id: zebra }]);
    items.push([box(0.55, 0.012, 2.4), at(off, 0.006, 5.0), { tone: 0.0, id: zebra }]);
    items.push([box(2.4, 0.012, 0.55), at(-5.0, 0.006, off), { tone: 0.0, id: zebra }]);
    items.push([box(2.4, 0.012, 0.55), at(5.0, 0.006, off), { tone: 0.0, id: zebra }]);
  }
  const dash = newId();
  for (let z = -8; z > -120; z -= 4) items.push([box(0.14, 0.01, 2), at(0, 0.005, z), { tone: 0.0, id: dash }]);
  for (let x = -8; x > -80; x -= 4) items.push([box(2, 0.01, 0.14), at(x, 0.005, 0), { tone: 0.0, id: dash }]);
  for (let x = 8; x < 80; x += 4) items.push([box(2, 0.01, 0.14), at(x, 0.005, 0), { tone: 0.0, id: dash }]);
  // Bueiro e tampa de esgoto.
  items.push([cylinder(0.42, 0.42, 0.02, 18), at(1.2, 0.01, -12), { tone: 0.55, id: newId() }]);
  items.push([new THREE.TorusGeometry(0.34, 0.025, 4, 18), at(1.2, 0.02, -12, { rx: Math.PI / 2 }), { tone: 0.7, id: newId() }]);
  items.push([box(0.9, 0.04, 0.28), at(-3.35, 0.02, -15), { tone: 0.9, id: newId(), kind: KIND.solid }]);

  // ----- Quarteirao Q (o do menino): x < -6, z < -6 -----
  // Predio da esquina: padaria na rua B, a porta de casa na rua A.
  building(items, decalItems, {
    x: -14.5, z: -F, w: 8.5, d: 9, floors: 3, wall: 0.06, seed: 1,
    faces: [
      { face: "+z", x0: -14.5, z0: -F, width: 8.5, doorX: 4.9, steps: true, number: decals.numbers, doorId: live.doorId = newId(), bricks: decals.bricks, balcony: true },
      { face: "+x", x0: -F, z0: -F, width: 9, shop: true, sign: decals.padaria },
    ],
  });
  building(items, decalItems, { x: -21, z: -F, w: 6.5, d: 9, floors: 2, wall: 0.18, seed: 2, faces: [{ face: "+z", x0: -21, z0: -F, width: 6.5, steps: true }] });
  building(items, decalItems, { x: -29, z: -F, w: 8, d: 9, floors: 4, wall: 0.1, seed: 3, faces: [{ face: "+z", x0: -29, z0: -F, width: 8, shop: true, sign: decals.sapataria }] });
  building(items, decalItems, { x: -38, z: -F, w: 9, d: 9, floors: 3, wall: 0.3, seed: 4, faces: [{ face: "+z", x0: -38, z0: -F, width: 9, balcony: true }] });
  let zq = -15;
  const qSpecs = [[8, 2, 0.12, true, decals.farmacia], [10, 4, 0.05, false], [8, 3, 0.22, true], [11, 5, 0.08, false], [9, 3, 0.15, false], [12, 6, 0.06, false], [8, 2, 0.25, true], [10, 4, 0.1, false]];
  qSpecs.forEach(([w, floors, wall, shop, sign], i) => {
    building(items, decalItems, {
      x: -F - 9, z: zq, w: 9, d: w, floors, wall, seed: 20 + i,
      faces: [{ face: "+x", x0: -F, z0: zq, width: w, shop, sign, balcony: i % 2 === 1, bricks: i === 2 ? decals.bricks2 : undefined }],
    });
    zq -= w;
  });

  // ----- Quarteirao R: x > 6, z < -6 -----
  let zr = -6;
  const rSpecs = [[9, 3, 0.1, true], [7, 2, 0.2, false], [10, 4, 0.06, false], [8, 3, 0.16, true], [11, 5, 0.09, false], [9, 2, 0.3, false], [12, 4, 0.05, false], [10, 3, 0.12, false]];
  rSpecs.forEach(([w, floors, wall, shop], i) => {
    const faces = [{ face: "-x", x0: F, z0: zr - w, width: w, shop, balcony: i % 3 === 1, bricks: i === 1 ? decals.bricks : undefined }];
    if (i === 0) faces.push({ face: "+z", x0: F, z0: -F, width: 9, shop: true, sign: decals.sapataria });
    building(items, decalItems, { x: F, z: zr, w: 9, d: w, floors, wall, seed: 40 + i, faces });
    zr -= w;
  });
  building(items, decalItems, { x: 15, z: -F, w: 8, d: 9, floors: 3, wall: 0.2, seed: 60, faces: [{ face: "+z", x0: 15, z0: -F, width: 8, balcony: true }] });
  building(items, decalItems, { x: 23, z: -F, w: 9, d: 9, floors: 2, wall: 0.08, seed: 61, faces: [{ face: "+z", x0: 23, z0: -F, width: 9, shop: true }] });

  // ----- Quarteiroes de tras (Q' e R'), mais simples -----
  for (const sx of [-1, 1]) {
    let x0 = sx > 0 ? F : -F;
    for (let i = 0; i < 5; i += 1) {
      const w = 8 + (i % 3) * 1.5;
      const bx = sx > 0 ? x0 : x0 - w;
      building(items, decalItems, {
        x: bx, z: F + 9, w, d: 9, floors: 2 + ((i * 7) % 3), wall: 0.06 + (i % 4) * 0.06, seed: 80 + i + (sx > 0 ? 10 : 0),
        faces: [{ face: "-z", x0: bx + w, z0: F, width: w, shop: i === 0 }],
      });
      x0 += sx * w;
    }
    // Lado da rua B (fachadas olhando para dentro da rua).
    let z0 = F;
    for (let i = 0; i < 3; i += 1) {
      const w = 9;
      building(items, decalItems, {
        x: sx > 0 ? F : -F - 9, z: z0 + w, w: 9, d: w, floors: 3, wall: 0.1, seed: 100 + i + (sx > 0 ? 10 : 0),
        faces: [{ face: sx > 0 ? "-x" : "+x", x0: sx > 0 ? F : -F, z0: sx > 0 ? z0 : z0 + w, width: w }],
      });
      z0 += w;
    }
  }

  // Fundo: a igreja no fim da rua B e o casario de longe.
  church(items, 0, -128);
  const far = rng(5);
  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 ? 1 : -1;
    const x = side * (16 + far() * 50);
    const z = -40 - far() * 90;
    const h = 8 + far() * 22;
    items.push([box(6 + far() * 8, h, 6 + far() * 8), at(x, h / 2, z), { tone: 0.06 + far() * 0.1, id: newId() }]);
  }
  for (let i = 0; i < 5; i += 1) {
    items.push([sphere(1, 20, 10), at(-120 + i * 60, -8, -230 - (i % 2) * 30, { sx: 55, sy: 28, sz: 30 }), { tone: 0.04, id: newId() }]);
  }

  // Esquina: poste, hidrante, caixa dos Correios, lixeira, banca, arvores.
  heroLamp(items, decalItems, decals, CITY.lamp);
  hydrant(items, -5.65, -8.1);
  mailbox(items, -5.55, -6.75);
  newsstand(items, decalItems, decals, at(4.85, 0.15, -9.5, { ry: -Math.PI / 2 }));
  bench(items, at(5.3, 0.15, -15.5, { ry: -Math.PI / 2 }));
  bicycle(items, at(-5.82, 0.15, -12.4, { rz: -0.12 }));
  beetle(items, 2.25, -21.5, Math.PI);
  for (let z = -18; z > -110; z -= 18) {
    streetLamp(items, -3.85, z, 1);
    streetLamp(items, 3.85, z - 9, -1);
  }

  // Fiacao: postes no lado R da rua B, fios ao longo e um atravessando.
  const poles = [];
  for (let z = -7.5; z > -110; z -= 21) poles.push(powerPole(items, 4.35, z));
  for (let i = 0; i < poles.length - 1; i += 1) {
    for (let k = 0; k < 3; k += 1) wire(items, poles[i][k], poles[i + 1][k], 0.5);
  }
  wire(items, poles[0][0], new THREE.Vector3(-6, 8.2, -7.5), 0.6);
  wire(items, poles[0][1], new THREE.Vector3(-6, 7.7, -9.5), 0.7);
  wire(items, poles[0][2], new THREE.Vector3(14, 7.6, -6), 0.5);
  live.wireStart = poles[0][0].clone();
  live.wireEnd = new THREE.Vector3(-6, 8.2, -7.5);

  const group = new THREE.Group();
  const mesh = new THREE.Mesh(merge(items), material);
  mesh.frustumCulled = false;
  group.add(mesh);

  // Letreiros: uma geometria por desenho.
  const byDecal = new Map();
  for (const [mat, geometry, matrix, options] of decalItems) {
    if (!byDecal.has(mat)) byDecal.set(mat, []);
    byDecal.get(mat).push([geometry, matrix, { ...options, keepUv: true }]);
  }
  byDecal.forEach((list, mat) => {
    const m = new THREE.Mesh(merge(list), mat);
    m.frustumCulled = false;
    group.add(m);
  });

  // Arvores (a copa e um objeto proprio, para balancar).
  const treeItems = [];
  live.trees = [
    tree(material, treeItems, 4.95, -13, 1, 1.0),
    tree(material, treeItems, -4.95, -27, 2, 1.15),
    tree(material, treeItems, 4.95, -36, 3, 0.95),
    tree(material, treeItems, -4.95, -50, 4, 1.1),
  ];
  const trunks = new THREE.Mesh(merge(treeItems), material);
  trunks.frustumCulled = false;
  group.add(trunks);
  live.trees.forEach((t) => group.add(t));

  return { group, live };
}

/** Nuvens de fim de tarde perto do sol (contorno so, bem claras). */
export function makeClouds(material) {
  const group = new THREE.Group();
  const rand = rng(9);
  for (let c = 0; c < 4; c += 1) {
    const items = [];
    const id = newId();
    const n = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i += 1) {
      items.push([new THREE.IcosahedronGeometry(4 + rand() * 5, 2), at(i * 5 - n * 2.5, rand() * 3, rand() * 3, { sy: 0.6 }), { tone: 0.0, id, kind: KIND.plain }]);
    }
    const mesh = new THREE.Mesh(merge(items), material);
    mesh.frustumCulled = false;
    mesh.position.set(-70 + c * 52 + rand() * 20, 34 + rand() * 16, -210 - rand() * 40);
    mesh.layers.set(1);
    group.add(mesh);
  }
  return group;
}
