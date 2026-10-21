import { api } from "../api/client.js";
import { hasTransparentPixels } from "./photoBackgrounds.js";

/**
 * Abre a imagem QUE JA ESTA SALVA (capa do livro ou foto de perfil) para ela
 * passar de novo pelo recorte, como se fosse uma foto nova.
 *
 * O recorte desenha a imagem num canvas, e o navegador so deixa ler os pontos
 * de uma imagem de outro site se esse site permitir (CORS). Entao:
 *
 * - foto recem-feita, ainda nao enviada (data URI): ja esta aqui, so decodifica;
 * - foto no Cloudinary: ele permite, o navegador baixa direto;
 * - capa que e um link de outro site (Open Library, Google...): quase nenhum
 *   permite. Para essas, `proxy` aponta uma rota do servidor que baixa a
 *   imagem e devolve { image: data URI } (ver backend/services/remoteImage.js).
 *
 * Devolve um Blob, que e o que o CoverEditor recebe de camera e galeria.
 */

function dataUriToBlob(dataUri) {
  const comma = dataUri.indexOf(",");
  const type = /^data:([^;,]+)/i.exec(dataUri.slice(0, comma))?.[1];
  const binary = atob(dataUri.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || "image/jpeg" });
}

// Um site que aceita a conexao e nunca responde deixaria a tela esperando
// minutos: depois disso desiste da leitura direta e deixa o servidor tentar.
const DIRECT_TIMEOUT_MS = 8000;

async function downloadDirect(src, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT_MS);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  try {
    const response = await fetch(src, {
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    // O corpo tambem conta no prazo: por isso o "await" fica aqui dentro.
    return await response.blob();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

// `signal` (opcional) cancela tudo: quem desistiu de editar nao deixa o
// navegador nem o servidor baixando a imagem a toa.
export async function loadSavedImage(src, { proxy, signal } = {}) {
  const cannotOpen = new Error(
    "Não foi possível abrir essa imagem para editar. Escolha uma nova.",
  );
  if (!src) throw cannotOpen;

  if (src.startsWith("data:")) {
    try {
      return dataUriToBlob(src);
    } catch {
      throw cannotOpen;
    }
  }

  try {
    return await downloadDirect(src, signal);
  } catch {
    if (!proxy || signal?.aborted) throw cannotOpen;
  }

  try {
    const { image } = await api(proxy + "?url=" + encodeURIComponent(src), {
      signal,
    });
    return dataUriToBlob(image);
  } catch (error) {
    // Recusas que explicam o problema da imagem (endereco que nao pode ser
    // usado, site que nao entregou, imagem grande demais): a mensagem do
    // servidor ajuda, e o que falta e dizer o que fazer. Qualquer outra
    // coisa (rota ainda nao publicada, sem rede, erro do servidor) vira o
    // aviso padrao: o texto tecnico nao ajuda quem esta no balcao.
    if ([400, 413, 502].includes(error.status) && error.message) {
      throw new Error(error.message + " Escolha uma nova.");
    }
    throw cannotOpen;
  }
}

/**
 * Diz se a imagem tem partes transparentes (foto de perfil recortada do
 * fundo). O recorte precisa saber: sem isso, ele pintaria a transparencia de
 * branco e a foto perderia o recorte.
 */
export async function blobHasTransparency(blob) {
  // JPEG nao guarda transparencia: nem precisa decodificar.
  if (blob.type === "image/jpeg") return false;

  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Não foi possível abrir essa imagem para editar."));
      img.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return hasTransparentPixels(ctx.getImageData(0, 0, width, height).data);
  } finally {
    URL.revokeObjectURL(url);
  }
}
