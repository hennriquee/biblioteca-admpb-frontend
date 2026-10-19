// Geometria do recorte com giro (usada pelo CoverEditor).
//
// A foto gira em torno do CENTRO DO QUADRO e precisa continuar cobrindo o
// quadro inteiro, senao apareceriam cantos vazios. Duas contas resolvem isso:
//
//  1. coverScale: a escala minima que cobre o quadro quando a foto esta girada;
//  2. fitOffset: ate onde a foto pode ser arrastada sem deixar um canto vazio.
//
// Convencao: angulo em graus, positivo = giro para a DIREITA (sentido
// horario), igual ao rotate() do CSS e do canvas. x/y sao o deslocamento do
// centro da foto em relacao ao centro do quadro, em px da tela.

export const MAX_ANGLE = 45;

// A foto cresce 0,4% a mais quando esta girada: a borda da foto girada nunca
// cai em cima da borda do quadro, entao o suavizado do canvas nao deixa um
// fio claro nas pontas (sem giro as bordas coincidem e nao ha o que suavizar).
const EDGE_BLEED = 1.004;

export const rad = (deg) => (deg * Math.PI) / 180;

// Gira o ponto (x, y) em `deg` graus em torno da origem.
export function rotatePoint(x, y, deg) {
  const r = rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

// Tamanho da menor caixa (alinhada a foto) que contem o quadro girado.
function frameInPhoto(box, angle) {
  const r = rad(angle);
  const sin = Math.abs(Math.sin(r));
  const cos = Math.abs(Math.cos(r));
  return { w: box.w * cos + box.h * sin, h: box.w * sin + box.h * cos };
}

// Escala minima para a foto (natural.w x natural.h), girada em `angle`, cobrir
// o quadro (box.w x box.h) inteiro.
export function coverScale(natural, box, angle) {
  if (!natural || !box.w) return 1;
  const need = frameInPhoto(box, angle);
  const scale = Math.max(need.w / natural.w, need.h / natural.h);
  return angle ? scale * EDGE_BLEED : scale;
}

// Traz o deslocamento (x, y) para dentro do permitido. Na escala `scale` e com
// a foto girada em `angle`, o quadro tem de caber dentro dela; os limites sao
// retos no sistema de eixos da FOTO, entao gira-se para la, limita-se e volta.
export function fitOffset(natural, box, scale, angle, x, y) {
  const need = frameInPhoto(box, angle);
  const maxX = Math.max(0, (natural.w * scale - need.w) / 2);
  const maxY = Math.max(0, (natural.h * scale - need.h) / 2);
  const local = rotatePoint(x, y, -angle);
  const kept = rotatePoint(
    Math.min(maxX, Math.max(-maxX, local.x)),
    Math.min(maxY, Math.max(-maxY, local.y)),
    angle,
  );
  return { x: kept.x, y: kept.y };
}
