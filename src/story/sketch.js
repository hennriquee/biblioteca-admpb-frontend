import * as THREE from "three";

/**
 * O "nanquim" da animacao da sugestao: transforma uma cena 3D comum num
 * desenho a pena em papel, no estilo de esboco da referencia (preto e branco,
 * hachura nervosa que acompanha o volume, papel cinza-quente com grao e
 * bordas escurecidas).
 *
 * Como funciona, em tres passadas por quadro:
 *
 * 1. Sombra: a cena vista do sol, so a profundidade (quem tapa quem).
 * 2. "Rascunho": cada superficie calcula a propria luz (sol baixo + sombra) e
 *    risca a hachura nela mesma, presa ao objeto (os tracos acompanham a
 *    forma e andam junto com ele; o espacamento se ajusta a distancia, para
 *    nao virar mancha de longe nem ficar ralo de perto). Sai em duas
 *    imagens: a tinta da hachura + o tom, e a normal + profundidade.
 * 3. Arte-final: acha os contornos (onde muda de objeto, de profundidade ou
 *    de direcao da superficie), passa o contorno a tinta e uma segunda passada
 *    de lapis mais clara, e pinta tudo no papel.
 *
 * As linhas "fervem": o desenho alterna entre 3 versoes (BOIL_FPS por
 * segundo), como no desenho animado feito a mao, em que cada quadro e
 * redesenhado.
 *
 * Os objetos levam tres atributos por vertice (ver kit.js): aTone (o quanto
 * a superficie e escura, 0 a 1), aId (para separar contornos) e aKind (o
 * jeito de riscar: hachura, chapado, sem hachura, imagem ou "sombra so").
 * Pecas repetidas (os livros) vao num InstancedMesh, cada copia com o seu
 * tom e o seu id (aInstTone, aInstId).
 *
 * Os programas da placa de video demoram a montar (segundos, em algumas
 * maquinas): precompile() monta todos de uma vez, sem travar a tela, antes
 * de a animacao comecar.
 */

export const BOIL_FPS = 8;

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
`;

const SCENE_VERT = /* glsl */ `
in float aTone;
in float aId;
in float aKind;
#ifdef USE_INSTANCING
// Muitas copias da mesma peca (os livros): cada uma com o seu tom e o seu id.
in float aInstTone;
in float aInstId;
#endif
out vec3 vWorld;
out vec3 vNormalW;
out vec3 vViewN;
out vec3 vLocal;
out vec3 vLocalN;
out float vTone;
out float vId;
out float vKind;
out vec2 vUv;
void main() {
#ifdef USE_INSTANCING
  mat4 model = modelMatrix * instanceMatrix;
  vTone = clamp(aTone + aInstTone, 0.0, 1.0);
  vId = mod(aId + aInstId - 1.0, 250.0) + 1.0;
#else
  mat4 model = modelMatrix;
  vTone = aTone;
  vId = aId;
#endif
  vec4 world = model * vec4(position, 1.0);
  vWorld = world.xyz;
  mat3 normalWorld = transpose(inverse(mat3(model)));
  vNormalW = normalize(normalWorld * normal);
  vViewN = normalize(mat3(viewMatrix) * vNormalW);
  // Coordenadas do proprio objeto (em metros): a hachura fica presa nele.
  vLocal = position * vec3(length(model[0].xyz), length(model[1].xyz), length(model[2].xyz));
  vLocalN = normal;
  vKind = aKind;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SCENE_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gInk;
layout(location = 1) out vec4 gGeo;

uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform float uShadowBias;
uniform vec3 uSun;
uniform float uBoil;
uniform float uPx;
uniform float uSpacing;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFocus;
// Desenho preso na superficie (uDecal: as linhas das folhas) e a pagina
// que vira (uImage: o desenho pronto). Ligados por uniforme, e nao por
// "#define": todos os materiais da cena usam o mesmo programa.
uniform sampler2D uDecal;
uniform float uDecalOn;
uniform sampler2D uImage;
uniform float uImageOn;

in vec3 vWorld;
in vec3 vNormalW;
in vec3 vViewN;
in vec3 vLocal;
in vec3 vLocalN;
in float vTone;
in float vId;
in float vKind;
in vec2 vUv;

${NOISE}

float shadowAt(vec3 world, vec3 n) {
  vec4 sc = uShadowMatrix * vec4(world + n * uShadowBias, 1.0);
  vec3 p = sc.xyz * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float lit = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float d = textureLod(uShadowMap, p.xy + vec2(float(x), float(y)) * uShadowTexel, 0.0).r;
      lit += (p.z - 0.0012 <= d) ? 1.0 : 0.0;
    }
  }
  return lit / 9.0;
}

// Uma fileira de tracos paralelos com espacamento "s" (em unidades do
// objeto). Cada linha treme, tem grossura propria e e quebrada em tracos de
// tamanhos variados que afinam nas pontas, como pena na mao.
float strokeLines(float along, float across, float s, float wpp, float weight, float seed) {
  float v = across / s;
  float i = floor(v);
  float r1 = hash12(vec2(i, seed));
  float r2 = hash12(vec2(i, seed + 3.1));
  float wob = (vnoise(vec2(along / (s * 7.0), i * 1.7 + seed)) - 0.5) * 0.45;
  float dpx = abs(v - i - 0.5 - (r1 - 0.5) * 0.3 - wob) * s / wpp;
  float len = s * mix(5.0, 16.0, r2);
  float u = along / len + r1 * 13.0;
  float j = floor(u);
  float fu = fract(u);
  float keep = step(0.2, hash12(vec2(i + j * 17.3, seed + 5.0)));
  float taper = smoothstep(0.0, 0.22, fu) * smoothstep(1.0, 0.7, fu);
  float halfw = 0.5 * uPx * weight * mix(0.75, 1.3, r2) * taper;
  // (Com grossura zero nao sobra nada: nem meio traco.)
  return keep * clamp(halfw + 0.5 - dpx, 0.0, 1.0) * min(1.0, halfw * 2.0);
}

// Os tracos de uma direcao, com o espacamento ajustado a distancia: entre
// dois "niveis" (um o dobro do outro), as linhas extras surgem aos poucos.
float strokeSet(vec2 p, float ang, float weight, float seed) {
  vec2 d = vec2(cos(ang), sin(ang));
  float along = dot(p, d);
  float across = dot(p, vec2(-d.y, d.x));
  float wpp = max(fwidth(across), 1e-6);
  float level = log2(uSpacing * uPx * wpp);
  float l0 = floor(level);
  float f = level - l0;
  float dense = strokeLines(along, across, exp2(l0), wpp, weight, seed + l0 * 7.0);
  float sparse = strokeLines(along, across, exp2(l0 + 1.0), wpp, weight, seed + l0 * 7.0 + 7.0);
  return max(sparse, dense * (1.0 - f));
}

// Hachura por camadas: quanto mais escuro, mais direcoes e tracos mais
// grossos (a pena aperta mais).
float hatch(vec2 p, float dark, float seed) {
  float w1 = smoothstep(0.22, 0.44, dark);
  float w2 = smoothstep(0.52, 0.7, dark);
  float w3 = smoothstep(0.74, 0.88, dark);
  float press = mix(0.55, 1.35, dark);
  float ink = strokeSet(p, 0.82, w1 * press, seed);
  ink = max(ink, strokeSet(p, -0.62, w2 * press, seed + 11.0));
  ink = max(ink, strokeSet(p, 0.18, w3 * press, seed + 23.0));
  ink = max(ink, smoothstep(0.9, 0.99, dark) * 0.92);
  return ink;
}

void main() {
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float kind = floor(vKind + 0.5);
  float seed = uBoil * 41.0 + 3.0;

  float ndl = dot(n, uSun);
  float diffuse = clamp((ndl + 0.18) / 1.18, 0.0, 1.0);
  float shadow = shadowAt(vWorld, n);
  float lit = diffuse * shadow;
  float albedo = 1.0 - vTone;
  float sky = 0.9 + 0.1 * n.y;
  // A sombra nao "apaga" a cor: um branco na sombra ganha so uma camada leve
  // de tracos; o que e escuro de verdade e que fecha. Perto da camera entra
  // uma luz de rebatimento.
  float dist = length(cameraPosition - vWorld);
  float fill = 0.28 * max(dot(n, viewDir), 0.0) * (1.0 - smoothstep(3.0, 16.0, dist));
  float bright = albedo * (0.69 * sky + 0.31 * smoothstep(0.0, 0.5, lit) + fill);
  // Contraluz: a borda do que esta de costas para o sol brilha.
  float facing = 1.0 - max(dot(n, viewDir), 0.0);
  float rim = pow(facing, 3.0) * max(dot(-viewDir, uSun), 0.0) * 0.6;
  bright = clamp(bright + rim * albedo, 0.0, 1.0);
  float dark = 1.0 - bright;

  // Longe, tudo fica mais claro (o ar entre a gente e o fundo).
  float fog = smoothstep(uFogNear, uFogFar, dist);
  // E o que fica atras do assunto do plano sai mais solto e claro (como o
  // desenhista faz com o fundo): o assunto salta.
  float behind = smoothstep(uFocus * 1.35, uFocus * 3.2, dist) * 0.5;
  dark *= (1.0 - fog * 0.75) * (1.0 - behind);

  // Uma hachura so por ponto (o shader fica pequeno e monta rapido): riscada
  // na face do objeto que mais encara aquele lado, presa nele.
  vec3 a = abs(normalize(vLocalN));
  vec2 p = a.x > a.y && a.x > a.z ? vLocal.zy : (a.y > a.z ? vLocal.xz : vLocal.xy);
  float face = a.x > a.y && a.x > a.z ? 0.0 : (a.y > a.z ? 101.0 : 211.0);
  float amount = dark;
  if (kind == 5.0) {
    // So a sombra (o chao que nao aparece): hachura onde a sombra cai.
    p = vWorld.xz;
    face = 0.0;
    amount = (1.0 - shadow) * 0.54;
  }
  if (uImageOn > 0.5) {
    p = vUv * vec2(1.6, 1.0);
    face = 307.0;
    if (!gl_FrontFacing) amount = 0.0;
  }
  float ink = hatch(p, amount, seed + face);
  // Chapado (so tinta) e "sem hachura" (so contorno: papel, poeira).
  if (kind == 1.0) ink = 0.97;
  if (kind == 3.0) ink = 0.0;

  // Desenhos presos na superficie (as linhas das folhas): a tinta por cima.
  vec4 decal = texture(uDecal, vUv);
  ink = max(ink, decal.a * (1.0 - fog * 0.6) * uDecalOn);
  // A pagina que vira: o desenho ja vem pronto (tinta). Inclinada contra a
  // luz, ganha uma hachura leve presa na folha. O verso: papel um pouco mais
  // escuro (grafite), com o desenho de tras aparecendo de leve.
  float picture = texture(uImage, vUv).r;
  if (uImageOn > 0.5) {
    if (gl_FrontFacing) {
      ink = max(picture, ink);
    } else {
      ink = picture * 0.16;
      dark = max(dark, 0.42);
    }
  }

  float background = kind == 5.0 ? 0.0 : 1.0;
  // Dobras viram linha so nas pecas comuns: a poeira (sem hachura) fica so
  // com o contorno de fora, como nuvem; a pagina que vira marca 0.25 (ver
  // isImage na arte-final).
  float crease = kind == 4.0 ? 0.25 : (kind == 3.0 ? 0.0 : 1.0);
  gInk = vec4(ink, dark, vId / 255.0, background);
  gGeo = vec4(normalize(vViewN) * 0.5 + 0.5, crease);
}
`;

const POST_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 outColor;

uniform sampler2D tInk;
uniform sampler2D tGeo;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uPx;
uniform float uBoil;
uniform float uNear;
uniform float uFar;
uniform float uLine;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFocus;
uniform vec3 uPaper;
uniform vec3 uInkColor;
uniform float uMode;
uniform float uVignette;

in vec2 vUv;

${NOISE}

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}

struct Sample { float id; float fg; vec3 n; float z; float crease; };

Sample fetch(vec2 uv) {
  Sample s;
  vec4 a = texture(tInk, uv);
  vec4 g = texture(tGeo, uv);
  s.id = a.b;
  s.fg = a.a;
  s.n = g.xyz * 2.0 - 1.0;
  s.crease = g.a;
  s.z = linearDepth(texture(tDepth, uv).r);
  return s;
}

float edgeBetween(Sample c, Sample o) {
  if (c.fg < 0.5 && o.fg < 0.5) return 0.0;
  if ((c.fg < 0.5) != (o.fg < 0.5)) return 1.0;
  float e = abs(c.id - o.id) > 0.5 / 255.0 ? 1.0 : 0.0;
  float zMin = min(c.z, o.z);
  e = max(e, smoothstep(0.035, 0.07, abs(c.z - o.z) / zMin));
  float bend = 1.0 - dot(c.n, o.n);
  e = max(e, smoothstep(0.22, 0.42, bend) * min(c.crease, o.crease));
  return e;
}

const vec2 RING[8] = vec2[8](
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
  vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071), vec2(0.7071, -0.7071), vec2(-0.7071, -0.7071)
);

float edgeAt(vec2 uv, float radius) {
  Sample c = fetch(uv);
  float e = 0.0;
  for (int k = 0; k < 8; k++) {
    Sample o = fetch(uv + RING[k] * radius / uRes);
    e = max(e, edgeBetween(c, o));
  }
  return e;
}

vec2 boilOffset(vec2 px, float amp, float seed) {
  vec2 q = px / (34.0 * uPx) + seed * 17.13;
  return (vec2(vnoise(q), vnoise(q + 41.7)) - 0.5) * 2.0 * amp * uPx;
}

void main() {
  vec2 px = vUv * uRes;
  float seed = uBoil + 1.0;
  // A pagina que vira ja traz o desenho pronto: nao treme de novo.
  float isImage = step(abs(texture(tGeo, vUv).a - 0.25), 0.05);

  // O contorno a tinta: a linha treme (posicao muda a cada desenho do ciclo)
  // e muda de grossura ao longo do caminho, como a pressao da pena.
  vec2 uvA = vUv + boilOffset(px, 1.1, seed) / uRes;
  vec4 inkA = texture(tInk, uvA);
  float zA = linearDepth(texture(tDepth, uvA).r);
  float near = (1.0 - smoothstep(uFogNear, uFogFar, zA) * 0.72) * (1.0 - 0.45 * smoothstep(uFocus * 1.35, uFocus * 3.2, zA));
  float press = 0.6 + 0.8 * vnoise(px / (48.0 * uPx) + seed * 5.3);
  float line = edgeAt(uvA, uLine * uPx * press * mix(0.55, 1.0, near));
  // Falhas de pena: aqui e ali a linha some um pouquinho.
  line *= smoothstep(0.08, 0.22, vnoise(px / (9.0 * uPx) + seed * 3.7)) * 0.25 + 0.75;
  line *= near;

  // Segunda passada, de lapis: mais clara, mais fina e fora do lugar.
  vec2 uvB = vUv + boilOffset(px, 2.0, seed + 7.0) / uRes;
  float pencil = edgeAt(uvB, uLine * uPx * 0.5) * 0.2 * near;

  float hatchInk = mix(inkA.r * 0.9, texture(tInk, vUv).r, isImage);
  float tone = inkA.g * inkA.a;

  float ink = hatchInk;
  ink = 1.0 - (1.0 - ink) * (1.0 - line);
  ink = 1.0 - (1.0 - ink) * (1.0 - pencil);

  // Papel com grao (o grafite "pega" no grao).
  float grain = vnoise(px / (1.1 * uPx)) * 0.5 + vnoise(px / (3.4 * uPx)) * 0.3 + vnoise(px / (14.0 * uPx)) * 0.2;
  float graphite = tone * 0.22 * smoothstep(0.2, 0.8, grain + tone * 0.3);
  ink = 1.0 - (1.0 - ink) * (1.0 - graphite);

  if (uMode > 0.5) {
    // So a tinta (para a pagina que vira: o papel entra depois).
    outColor = vec4(ink, ink, ink, 1.0);
    return;
  }

  vec2 c = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vign = smoothstep(0.32, 1.05, length(c)) * uVignette;
  float film = hash12(px + seed * 91.0) - 0.5;
  vec3 paper = uPaper * (1.0 - 0.07 * grain - vign + film * 0.035);
  float wet = ink * (0.9 + 0.1 * grain);
  outColor = vec4(mix(paper, uInkColor, wet), 1.0);
}
`;

// Material de profundidade para a sombra (so escreve profundidade).
function shadowMaterial() {
  return new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
}

export function createSketchRenderer(canvas, { paper = "#efe7da", ink = "#1b1510" } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.autoClear = true;
  renderer.setPixelRatio(1);
  // (A arte-final ja escreve a cor pronta. Com a saida "linear", desenhar na
  // tela ou na folha que vira usa o mesmo programa.)
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const shadowSize = 2048;
  const shadowTarget = new THREE.WebGLRenderTarget(shadowSize, shadowSize, {
    depthBuffer: true,
  });
  shadowTarget.depthTexture = new THREE.DepthTexture(shadowSize, shadowSize, THREE.FloatType);
  const sunCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  sunCamera.layers.set(0);
  const castOnly = shadowMaterial();

  const gbuffer = new THREE.WebGLRenderTarget(4, 4, {
    count: 2,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  gbuffer.depthTexture = new THREE.DepthTexture(4, 4, THREE.FloatType);

  const shared = {
    uShadowMap: { value: shadowTarget.depthTexture },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowTexel: { value: 1 / shadowSize },
    uShadowBias: { value: 0.02 },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uBoil: { value: 0 },
    uPx: { value: 1 },
    uSpacing: { value: 4.2 },
    uFogNear: { value: 30 },
    uFogFar: { value: 140 },
    uFocus: { value: 1000 },
  };

  // Textura vazia para quem nao usa desenho preso nem imagem.
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  blank.needsUpdate = true;

  function sceneMaterial(extra = {}) {
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SCENE_VERT,
      fragmentShader: SCENE_FRAG,
      uniforms: {
        ...shared,
        uDecal: { value: blank },
        uDecalOn: { value: 0 },
        uImage: { value: blank },
        uImageOn: { value: 0 },
        ...extra,
      },
      side: THREE.DoubleSide,
    });
  }

  const material = sceneMaterial();
  const decalCache = new Map();
  function decalMaterial(texture) {
    if (!decalCache.has(texture)) {
      decalCache.set(texture, sceneMaterial({ uDecal: { value: texture }, uDecalOn: { value: 1 } }));
    }
    return decalCache.get(texture);
  }
  function imageMaterial(texture) {
    return sceneMaterial({ uImage: { value: texture }, uImageOn: { value: 1 } });
  }

  const post = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tInk: { value: gbuffer.textures[0] },
      tGeo: { value: gbuffer.textures[1] },
      tDepth: { value: gbuffer.depthTexture },
      uRes: { value: new THREE.Vector2(4, 4) },
      uPx: shared.uPx,
      uBoil: shared.uBoil,
      uNear: { value: 0.1 },
      uFar: { value: 400 },
      uLine: { value: 1.25 },
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uFocus: shared.uFocus,
      uPaper: { value: new THREE.Color(paper) },
      uInkColor: { value: new THREE.Color(ink) },
      uMode: { value: 0 },
      uVignette: { value: 0.34 },
    },
  });
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

  const size = { width: 4, height: 4, px: 1 };
  function setSize(width, height, px) {
    size.width = width;
    size.height = height;
    size.px = px;
    renderer.setSize(width, height, false);
    gbuffer.setSize(width, height);
    post.uniforms.uRes.value.set(width, height);
    shared.uPx.value = px;
  }

  const sunTarget = new THREE.Vector3();

  /**
   * Desenha um quadro. "sun": { dir (para o sol), center (o meio da area de
   * sombra), radius }. "look": { boil, spacing (das linhas da hachura),
   * fogNear, fogFar, focus, vignette }.
   * "target": null = tela; um WebGLRenderTarget = so a tinta, para a pagina
   * que vira.
   */
  function render(scene, camera, sun, look, target = null) {
    shared.uBoil.value = look.boil;
    shared.uFogNear.value = look.fogNear ?? 30;
    shared.uFogFar.value = look.fogFar ?? 140;
    shared.uSpacing.value = look.spacing ?? 4.2;
    shared.uFocus.value = look.focus ?? 1000;

    // 1. Sombra.
    const dir = sun.dir;
    sunTarget.copy(sun.center);
    sunCamera.position.copy(sun.center).addScaledVector(dir, sun.radius * 2.5);
    sunCamera.lookAt(sunTarget);
    sunCamera.left = -sun.radius;
    sunCamera.right = sun.radius;
    sunCamera.top = sun.radius;
    sunCamera.bottom = -sun.radius;
    sunCamera.near = 0.1;
    sunCamera.far = sun.radius * 5;
    sunCamera.updateProjectionMatrix();
    sunCamera.updateMatrixWorld();
    shared.uShadowMatrix.value.multiplyMatrices(sunCamera.projectionMatrix, sunCamera.matrixWorldInverse);
    shared.uSun.value.copy(dir).normalize();
    shared.uShadowBias.value = sun.radius * 0.001;

    scene.overrideMaterial = castOnly;
    renderer.setRenderTarget(shadowTarget);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(scene, sunCamera);
    scene.overrideMaterial = null;

    // 2. Rascunho.
    renderer.setRenderTarget(gbuffer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);

    // 3. Arte-final.
    post.uniforms.uNear.value = camera.near;
    post.uniforms.uFar.value = camera.far;
    post.uniforms.uMode.value = target ? 1 : 0;
    post.uniforms.uVignette.value = look.vignette ?? 0.34;
    renderer.setRenderTarget(target);
    renderer.render(postScene, postCamera);
    renderer.setRenderTarget(null);
  }

  /**
   * Monta de uma vez os programas que as cenas vao usar (cada um no destino
   * em que vai desenhar: o nome do programa muda com ele), para nenhum
   * travar a tela no meio da animacao. Com KHR_parallel_shader_compile, a
   * montagem corre em paralelo e a pagina continua respondendo.
   * scenes: [[cena, camera], ...]; targets: outros destinos da arte-final.
   */
  function precompile(scenes, targets = []) {
    const jobs = [];
    const at = (target, scene, camera) => {
      renderer.setRenderTarget(target);
      jobs.push(renderer.compileAsync(scene, camera));
    };
    for (const [scene, camera] of scenes) at(gbuffer, scene, camera);
    // A sombra (todas as pecas sao InstancedMesh, ver kit.js).
    const probe = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(1, 1);
    probe.add(new THREE.InstancedMesh(geometry, castOnly, 1));
    at(shadowTarget, probe, sunCamera);
    at(null, postScene, postCamera);
    for (const target of targets) at(target, postScene, postCamera);
    renderer.setRenderTarget(null);
    return Promise.all(jobs).finally(() => geometry.dispose());
  }

  function dispose() {
    shadowTarget.dispose();
    gbuffer.dispose();
    material.dispose();
    castOnly.dispose();
    blank.dispose();
    decalCache.forEach((m) => {
      m.uniforms.uDecal?.value?.dispose?.();
      m.dispose();
    });
    post.dispose();
    renderer.dispose();
  }

  return { renderer, material, decalMaterial, imageMaterial, setSize, render, precompile, size, dispose };
}
