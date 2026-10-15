import { api, ApiError } from "./client.js";

/**
 * Pede ao backend a foto de perfil SEM O FUNDO (PNG transparente).
 *
 * A chave do servico de recorte nunca sai do servidor (ver
 * backend/src/services/background.js); o navegador so manda a foto recortada
 * em quadrado e recebe o PNG de volta.
 *
 * dev = true e para a tela de manutencao, cuja sessao nao passa pelas rotas
 * de administrador: o mesmo recorte mora em /api/dev/photo.
 *
 * NADA AQUI PODE IMPEDIR UMA FOTO DE SER SALVA. Quando o recorte nao da, esta
 * funcao lanca erro com uma mensagem pronta e quem chamou (PhotoPicker) avisa
 * e segue com a foto de fundo original.
 */

// Problemas que NAO melhoram tentando de novo: cota do mes no fim, chave
// ausente ou recusada. Depois de um desses, a sessao para de chamar o
// servico - cada chamada gastaria tempo (e, se fosse a cota, nem credito ha)
// para receber a mesma resposta. Recarregar a pagina zera a trava, porque
// uma cota nova ou uma chave arrumada no servidor merecem nova tentativa.
const PERMANENT_CODES = new Set([
  "BACKGROUND_NOT_CONFIGURED",
  "BACKGROUND_NO_CREDITS",
  "BACKGROUND_BAD_KEY",
]);

let blockedReason = "";

/** Motivo pelo qual o recorte esta desligado nesta sessao ("" = esta ligado). */
export function photoCutoutBlockedReason() {
  return blockedReason;
}

export async function fetchPhotoCutout(dataUri, { dev = false } = {}) {
  if (blockedReason) throw new Error(blockedReason);

  const base = dev ? "/api/dev/photo" : "/api/photo";
  let data;
  try {
    data = await api(base + "/remove-background", {
      method: "POST",
      body: { photo: dataUri },
    });
  } catch (error) {
    const code = error instanceof ApiError ? error.payload?.code : null;
    if (code && PERMANENT_CODES.has(code)) {
      blockedReason = error.message;
    }
    throw error;
  }

  if (!data || typeof data.photo !== "string" || !data.photo) {
    throw new Error("O servidor não devolveu a foto recortada.");
  }
  return data.photo;
}
