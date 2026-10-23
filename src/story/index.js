import * as THREE from "three";
import { BOIL_FPS, createSketchRenderer } from "./sketch.js";
import { bendPage, makeBooks, makeDust, makeGround, makePage } from "./books.js";
import { DURATION, PLAN, T, posePile, turnAngle, turnProgress } from "./script.js";

/**
 * A animacao da sugestao, pronta para um <canvas>: monta a pilha de livros,
 * a pagina que vira no fim de cada volta e o relogio. E sempre a mesma (nao
 * depende do livro sugerido). Ver script.js (roteiro) e sketch.js (o
 * nanquim).
 *
 * createSuggestStory(canvas, { paper, ink }) devolve:
 *  - ready: promessa que resolve quando os programas da placa de video
 *    estao montados (desenhar antes disso trava a tela ate montar)
 *  - resize(width, height, px): tamanho em pixels CSS e densidade da tela
 *  - draw(seconds): desenha o instante
 *  - duration: segundos de uma volta
 *  - dispose(): solta a memoria da placa de video
 */

// Sol de lado (pela esquerda, um pouco na frente de quem olha): a pilha
// ganha volume e a sombra cai para tras, a direita.
const SUN_PILE = {
  dir: new THREE.Vector3(-0.62, 0.68, 0.38).normalize(),
  center: new THREE.Vector3(0, 0.45, 0),
  radius: 1.9,
};
// Na pagina que vira, a luz vem do alto, pela esquerda: a dobra joga uma
// faixa de sombra na pagina de baixo.
const SUN_PAGE = {
  dir: new THREE.Vector3(-0.55, 0.8, -0.18).normalize(),
  center: new THREE.Vector3(0, 0, 0),
  radius: 2.6,
};

// Ids de contorno livres (os livros da pilha usam de 1 a 236).
const DUST_IDS = [246, 247, 248];
const PAGE_ID = 249;

function buildPile(sk) {
  const scene = new THREE.Scene();
  const m = sk.material;
  scene.add(makeGround(m));
  const books = makeBooks(sk, PLAN.books);
  scene.add(books.group);
  const dust = makeDust(m, DUST_IDS, 12);
  scene.add(dust.group);
  const camera = new THREE.PerspectiveCamera(36, 1.6, 0.05, 60);
  // (A camada 1 sao os livros no ar: a camera ve, o sol nao.)
  camera.layers.enable(1);
  return { scene, camera, books, dust };
}

// A camera da pagina: de cima, bem de longe (quase sem perspectiva), com a
// folha enchendo a tela.
const PAGE_FOV = 14;

function buildTurn(sk, pageMaterial, aspect) {
  const scene = new THREE.Scene();
  scene.add(makeGround(sk.material));
  const page = makePage(pageMaterial, aspect, PAGE_ID);
  scene.add(page.mesh);
  const camera = new THREE.PerspectiveCamera(PAGE_FOV, aspect, 1, 20);
  const distance = 0.5 / Math.tan(THREE.MathUtils.degToRad(PAGE_FOV / 2));
  camera.position.set(0, distance, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  return { scene, camera, page };
}

export function createSuggestStory(canvas, { paper, ink } = {}) {
  const sk = createSketchRenderer(canvas, { paper, ink });
  const pile = buildPile(sk);
  let aspect = 1.6;
  // O desenho da pilha, para a pagina que vira (so a tinta; do tamanho da
  // tela, entao nao precisa de versoes menores).
  const sheet = new THREE.WebGLRenderTarget(4, 4, {
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  // (Um material so: refazer a folha nao pode jogar fora o programa montado.)
  const pageMaterial = sk.imageMaterial(sheet.texture);
  let turn = buildTurn(sk, pageMaterial, aspect);

  let disposed = false;
  const ready = sk
    .precompile(
      [
        [pile.scene, pile.camera],
        [turn.scene, turn.camera],
      ],
      [sheet],
    )
    .then(() => {
      if (disposed) return;
      // Algumas placas ainda terminam de preparar as coisas no primeiro
      // desenho com elas: desenha uma vez agora (ninguem ve: o primeiro
      // quadro de verdade vem logo depois) a pagina virando, que so aparece
      // la no fim, para nao engasgar ali.
      draw(T.turn + 0.6);
    });

  const lookPile = { fogNear: 5, fogFar: 26, spacing: 5.0, vignette: 0.32 };
  const lookPage = { fogNear: 100, fogFar: 200, spacing: 5.0, vignette: 0.32, focus: 1000 };

  function renderPile(t, boil, target = null) {
    posePile(pile, t);
    sk.render(pile.scene, pile.camera, SUN_PILE, { ...lookPile, focus: pile.camera.userData.focus, boil }, target);
  }

  function resize(width, height, px) {
    const w = Math.max(2, Math.round(width * px));
    const h = Math.max(2, Math.round(height * px));
    // Traco, hachura e grao acompanham o tamanho do desenho: num quadro
    // pequeno (celular) as linhas afinam junto, em vez de virar rabisco.
    sk.setSize(w, h, px * Math.min(1.1, Math.max(0.62, height / 380)));
    sheet.setSize(w, h);
    const next = w / h;
    pile.camera.aspect = next;
    if (Math.abs(next - aspect) > 0.001) {
      // A folha tem a proporcao da tela: refaz.
      aspect = next;
      turn.page.mesh.geometry.dispose();
      turn = buildTurn(sk, pageMaterial, aspect);
    }
  }

  function draw(seconds) {
    const t = ((seconds % DURATION) + DURATION) % DURATION;
    const boil = Math.floor(t * BOIL_FPS) % 3;
    if (t < T.turn) {
      renderPile(t, boil);
    } else if (t < T.turnEnd) {
      // A pilha continua (a camera ainda se afasta), desenhada na folha que
      // vira; embaixo, a pagina seguinte, em branco.
      renderPile(t, boil, sheet);
      bendPage(turn.page, turnAngle(turnProgress(t), aspect));
      sk.render(turn.scene, turn.camera, SUN_PAGE, { ...lookPage, boil });
    } else {
      // Pagina nova: o comeco da volta seguinte.
      renderPile(t - DURATION, boil);
    }
  }

  function dispose() {
    disposed = true;
    sheet.dispose();
    for (const scene of [pile.scene, turn.scene]) {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
      });
    }
    pageMaterial.dispose();
    sk.dispose();
  }

  return { ready, resize, draw, dispose, duration: DURATION, T };
}
