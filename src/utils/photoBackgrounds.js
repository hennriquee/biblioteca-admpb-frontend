/**
 * Cores de fundo da foto de perfil.
 *
 * Depois que o fundo original e recortado (PNG transparente, ver
 * api/photoCutout.js), a propria pessoa escolhe nas bolinhas a cor que fica
 * atras dela. BRANCO VEM PRIMEIRO E JA SELECIONADO de proposito: uma foto de
 * perfil nao pode ir para o Cloudinary com fundo transparente - ela apareceria
 * "furada", mostrando o fundo de cada tela por onde passa.
 *
 * As cores conversam com a paleta do app (styles/tokens.css): o marrom e o
 * --clay e o amarelo e o --gold, os dois iguaizinhos aos do tema; as outras
 * cinco sao tons do mesmo calor, nem berrantes nem pastel, para o rosto
 * aparecer na frente.
 */
export const PHOTO_BACKGROUNDS = [
  { id: "branco", label: "Branco", color: "#ffffff" },
  { id: "marrom", label: "Marrom", color: "#3d1e09" },
  { id: "rosa", label: "Rosa", color: "#d98fa6" },
  { id: "azul", label: "Azul", color: "#0663aa" },
  { id: "laranja", label: "Laranja", color: "#d97a35" },
  { id: "amarelo", label: "Amarelo", color: "#e3a520" },
  { id: "verde", label: "Verde", color: "#5d8a63" },
];

export const DEFAULT_PHOTO_BACKGROUND = PHOTO_BACKGROUNDS[0];

export function findPhotoBackground(id) {
  return (
    PHOTO_BACKGROUNDS.find((option) => option.id === id) ||
    DEFAULT_PHOTO_BACKGROUND
  );
}

// Carrega a foto para dentro de um canvas. A foto que esta salva mora no
// Cloudinary (outro dominio), e sem "crossOrigin" o navegador marcaria o
// canvas como sujo: ler os pontos dela passaria a ser proibido. O Cloudinary
// libera essa leitura; se algum dia nao liberar, quem chamou avisa a pessoa.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!String(src).startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Não foi possível abrir a foto que está salva."));
    image.src = src;
  });
}

function toCanvas(image) {
  const width = image.naturalWidth || 400;
  const height = image.naturalHeight || 400;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu preparar a foto.");
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx, width, height };
}

/**
 * Le a foto QUE JA ESTA SALVA (endereco do Cloudinary) e diz se ela ja esta
 * sem fundo. E o que permite a quem virou administrador trocar a cor do fundo
 * da foto que ela ja tinha, sem tirar outra:
 *
 * - transparent = true: a foto foi salva sem fundo (foi tirada quando a
 *   pessoa era usuaria). Da para escolher a cor na hora, SEM gastar nada da
 *   cota do mes - nao ha o que recortar de novo.
 * - transparent = false: a foto tem fundo (cor ja escolhida antes, ou foto
 *   antiga). Para trocar a cor e preciso recortar de novo, o que gasta uma
 *   foto da cota.
 *
 * Devolve tambem a foto como data URI, que e o formato que o resto do caminho
 * (recorte e envio) entende.
 */
export async function readSavedPhoto(src) {
  const image = await loadImage(src);
  const { canvas, ctx, width, height } = toCanvas(image);
  ctx.drawImage(image, 0, 0, width, height);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, width, height).data;
  } catch {
    throw new Error(
      "Não foi possível ler a foto que está salva. Tire uma foto nova para escolher o fundo.",
    );
  }

  // Olha a transparencia (o 4o valor de cada ponto) de 1 ponto a cada 4 -
  // numa foto recortada o fundo vazio e enorme, nao escapa da amostra.
  let transparent = false;
  for (let i = 3; i < pixels.length; i += 16) {
    if (pixels[i] < 250) {
      transparent = true;
      break;
    }
  }

  return {
    transparent,
    // PNG guarda a transparencia; na foto opaca o JPEG pesa bem menos.
    dataUri: transparent
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.92),
  };
}

/**
 * Cola o PNG sem fundo sobre a cor escolhida e devolve uma foto JPEG (data
 * URI) - sem transparencia nenhuma, exatamente o que a bolinha mostrou.
 *
 * Fica no navegador, em canvas: a cor e aplicada na hora, sem gastar outra
 * chamada da cota do recorte a cada troca de bolinha.
 */
export async function flattenPhotoBackground(dataUri, color) {
  const image = await loadImage(dataUri);
  const { canvas, ctx, width, height } = toCanvas(image);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
