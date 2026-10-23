import * as THREE from "three";
import { BOIL_FPS, createSketchRenderer } from "./sketch.js";
import { makeBird, makeBoy, makeCourier, makeDog, makePuffs, makeTruck } from "./cast.js";
import { CITY, makeCity, makeClouds } from "./city.js";
import { makeDecals } from "./decals.js";
import { makeBook, makeHand, makeHeroBook, makeImpact, makeTable } from "./books.js";
import { DURATION, HERO, STACK, T, look, pose } from "./script.js";
import { box, part } from "./kit.js";

/**
 * A animacao da sugestao, pronta para um <canvas>: monta as duas cenas, a
 * ilustracao do livro (o primeiro quadro da rua, desenhado numa imagem) e o
 * relogio. Ver script.js (roteiro) e sketch.js (o nanquim).
 *
 * createSuggestStory(canvas, { title, paper, ink }) devolve:
 *  - resize(width, height, px): tamanho em pixels CSS e densidade da tela
 *  - draw(seconds, first): desenha o instante (first = primeira volta, em
 *    que o desenho "se faz" no comeco)
 *  - duration: segundos de uma volta
 *  - dispose(): solta a memoria da placa de video
 */

// Sol baixo de fim de tarde, de lado (pela esquerda, um pouco atras de
// quem olha a rua): uma calcada na sombra, a outra no sol, sombras compridas.
const SUN1 = {
  dir: new THREE.Vector3(-0.62, 0.42, 0.66).normalize(),
  center: new THREE.Vector3(-3, 0, -9),
  radius: 24,
};
const SUN2 = {
  dir: new THREE.Vector3(-0.55, 0.72, 0.42).normalize(),
  center: new THREE.Vector3(0, 0.1, 0),
  radius: 0.6,
};

function buildAct1(sk, decals) {
  const scene = new THREE.Scene();
  const m = sk.material;
  const { group: city, live } = makeCity(m, decals);
  scene.add(city);
  scene.add(makeClouds(m));

  const boy = makeBoy(m);
  scene.add(boy.root);
  scene.add(boy.bag);
  const courier = makeCourier(m);
  scene.add(courier.root);
  const truck = makeTruck(m, decals);
  const truckPivot = new THREE.Group();
  truck.root.position.set(0, 0, -2.9);
  truckPivot.add(truck.root);
  scene.add(truckPivot);
  const dog = makeDog(m);
  scene.add(dog.root);
  const bird = makeBird(m);
  scene.add(bird.root);
  const wireBirds = [0.32, 0.4].map((u, i) => {
    const b = makeBird(m, 0.88);
    const a = live.wireStart;
    const e = live.wireEnd;
    b.root.position.set(a.x + (e.x - a.x) * u, a.y + (e.y - a.y) * u - Math.sin(Math.PI * u) * 0.6 + 0.04, a.z + (e.z - a.z) * u);
    b.wings.forEach((w, k) => {
      w.rotation.z = (k ? 1 : -1) * 1.25;
      w.scale.setScalar(0.55);
    });
    b.root.scale.setScalar(1.1 + i * 0.1);
    scene.add(b.root);
    return b;
  });
  const puffs = makePuffs(m, 16);
  scene.add(puffs.group);

  // A porta de casa (abre para dentro). Dobradica na borda esquerda.
  const homeDoor = new THREE.Group();
  homeDoor.position.set(CITY.door.x - 0.54, 0.3, CITY.door.z + 0.02);
  const leaf = part(box(1.06, 2.2, 0.06, 0.02), m, { tone: 0.32 }, homeDoor);
  leaf.position.set(0.53, 1.1, 0);
  for (let k = 0; k < 2; k += 1) {
    const panel = part(box(0.72, 0.8, 0.02, 0.01), m, { tone: 0.42 }, homeDoor);
    panel.position.set(0.53, 0.62 + k * 0.98, 0.035);
  }
  const knob = part(new THREE.SphereGeometry(0.045, 10, 8), m, { tone: 0.05 }, homeDoor);
  knob.position.set(0.92, 1.05, 0.07);
  scene.add(homeDoor);

  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 420);
  camera.layers.enable(1);
  return { scene, camera, boy, courier, truck, truckPivot, dog, bird, wireBirds, puffs, trees: live.trees, homeDoor };
}

function buildAct2(sk, title, aspect) {
  const scene = new THREE.Scene();
  const m = sk.material;
  scene.add(makeTable(m));
  const stack = new THREE.Group();
  scene.add(stack);
  const books = STACK.map((spec) => {
    const b = makeBook(sk, spec);
    stack.add(b);
    return b;
  });
  const hero = makeHeroBook(sk, { ...HERO, title, aspect });
  stack.add(hero.group);
  const hand = makeHand(m);
  scene.add(hand.root);
  const impact = makeImpact(m);
  scene.add(impact.group);
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.01, 50);
  return { scene, camera, stack, books, hero, hand, impact };
}

export function createSuggestStory(canvas, { title = "", paper, ink } = {}) {
  const sk = createSketchRenderer(canvas, { paper, ink });
  const decals = makeDecals(sk);
  let aspect = 1.6;
  const act1 = buildAct1(sk, decals);
  let act2 = buildAct2(sk, title, aspect);
  const world = { act1, act2 };
  let picture = null;
  let pictureMaterial = null;

  const look1 = { sky: 1, fogNear: 14, fogFar: 95, spacing: 4.2, vignette: 0.36 };
  const look2 = { sky: 0, fogNear: 40, fogFar: 90, spacing: 4.6, vignette: 0.5 };

  function renderAct1(t, reveal, target = null) {
    pose(world, t);
    sk.render(act1.scene, act1.camera, SUN1, { ...look1, focus: act1.camera.userData.focus, boil: Math.floor(t * BOIL_FPS) % 3, reveal }, target);
  }

  // A ilustracao do livro: o primeiro quadro da cena 1, so a tinta.
  function paintPicture() {
    const { width, height } = sk.size;
    if (!picture) {
      picture = new THREE.WebGLRenderTarget(width, height, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    } else {
      picture.setSize(width, height);
    }
    renderAct1(0, 1, picture);
    if (!pictureMaterial) pictureMaterial = sk.imageMaterial(picture.texture);
    act2.hero.pictureMesh.material = pictureMaterial;
  }

  function resize(width, height, px) {
    const w = Math.max(2, Math.round(width * px));
    const h = Math.max(2, Math.round(height * px));
    sk.setSize(w, h, px);
    const next = w / h;
    act1.camera.aspect = next;
    if (Math.abs(next - aspect) > 0.01) {
      // A ilustracao precisa ter a proporcao da tela: refaz o livro.
      aspect = next;
      act2.scene.traverse((o) => o.geometry?.dispose?.());
      act2 = buildAct2(sk, title, aspect);
      world.act2 = act2;
    }
    act2.camera.aspect = aspect;
    paintPicture();
  }

  function draw(seconds, first = false) {
    const t = ((seconds % DURATION) + DURATION) % DURATION;
    const { act, reveal } = look(t, first);
    if (act === 1) {
      renderAct1(t, reveal);
    } else {
      pose(world, t);
      sk.render(act2.scene, act2.camera, SUN2, { ...look2, focus: act2.camera.userData.focus, boil: Math.floor(t * BOIL_FPS) % 3, reveal });
    }
  }

  function dispose() {
    picture?.dispose();
    for (const scene of [act1.scene, act2.scene]) {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
      });
    }
    pictureMaterial?.dispose();
    sk.dispose();
  }

  return { resize, draw, dispose, duration: DURATION, T };
}
