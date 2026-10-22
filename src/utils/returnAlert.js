import { ApiError, publicApi } from "../api/client.js";

/**
 * "Avise-me quando voltar" do acervo publico: o lado do navegador.
 *
 * Usa o Web Push, a notificacao padrao dos navegadores: sem login, sem
 * e-mail e sem custo. O navegador cria uma "inscricao" (um endereco no
 * servico de notificacao do fabricante), o catalogo manda essa inscricao para
 * o servidor junto com o livro, e o servidor manda a notificacao quando a
 * devolucao e confirmada no painel (ver backend/src/services/returnAlerts.js).
 * Quem mostra a notificacao no celular e o service worker (public/push-sw.js).
 *
 * Onde funciona:
 * - Android (Chrome, Samsung Internet, Firefox...) e computador: direto no
 *   navegador.
 * - iPhone/iPad (iOS 16.4 ou mais novo): SO com o catalogo adicionado a tela
 *   de inicio e aberto por la - regra da Apple. Numa aba do Safari o recurso
 *   nem existe; a tela explica como instalar.
 */

const ALERTS = "/api/public/alerts";

// Tempo maximo esperando o service worker ficar pronto. Na primeira visita
// ele ainda esta baixando os arquivos do app; em seguida fica instantaneo.
const WORKER_TIMEOUT_MS = 20 * 1000;
// Tempo maximo para o navegador criar a inscricao no servico do fabricante
// (normalmente 1 a 2 segundos). Sem ele, um navegador que nunca responde
// deixaria o botao em "Ativando..." para sempre.
const SUBSCRIBE_TIMEOUT_MS = 30 * 1000;

/** Erro com um "kind" que a tela usa para escolher a mensagem. */
export class ReturnAlertError extends Error {
  constructor(kind, message = kind) {
    super(message);
    this.kind = kind;
  }
}

/** iPhone ou iPad (em qualquer navegador: no iOS todos usam o motor do Safari). */
export function isAppleMobile() {
  const ua = navigator.userAgent || "";
  // iPad com iPadOS 13+ se apresenta como Mac; o toque denuncia.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function isInstalledApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

/**
 * O que este navegador consegue fazer:
 * - "ready": pode receber notificacoes;
 * - "ios-install": iPhone/iPad numa aba do navegador (precisa instalar);
 * - "ios-old": iPhone/iPad ja instalado, mas com iOS antigo (antes do 16.4);
 * - "unsupported": navegador sem notificacoes (navegador embutido de app,
 *   modo privado de alguns navegadores, site sem https).
 */
export function pushSupport() {
  const ready =
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (ready) return "ready";
  if (isAppleMobile()) return isInstalledApp() ? "ios-old" : "ios-install";
  return "unsupported";
}

function permission() {
  return "Notification" in window ? Notification.permission : "denied";
}

// O Safari antigo so aceita a forma com callback; os outros devolvem promessa.
function askPermission() {
  return new Promise((resolve) => {
    const result = Notification.requestPermission(resolve);
    if (result && typeof result.then === "function") result.then(resolve);
  });
}

let keyPromise = null;

/**
 * Chave publica do servidor (precisa dela para criar a inscricao). Fica
 * guardada depois da primeira vez; a tela ja pede ao abrir um livro
 * emprestado, para o toque no botao ser rapido.
 */
export function loadPushKey() {
  if (!keyPromise) {
    keyPromise = publicApi(ALERTS + "/key")
      .then((data) => data.publicKey)
      .catch((error) => {
        keyPromise = null;
        throw error;
      });
  }
  return keyPromise;
}

function keyBytes(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function sameBytes(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// A promessa, ou ReturnAlertError(kind) se ela passar de ms.
async function withTimeout(promise, ms, kind) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ReturnAlertError(kind)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function workerReady() {
  return withTimeout(navigator.serviceWorker.ready, WORKER_TIMEOUT_MS, "worker");
}

// A inscricao deste navegador, criando se ainda nao existir. Uma so serve
// para todos os livros. Qualquer falha do navegador aqui vira um
// ReturnAlertError: a mensagem crua dele vem em ingles ("Error retrieving
// push subscription") e nao ajuda ninguem.
async function ensureSubscription(registration, publicKey) {
  try {
    const key = keyBytes(publicKey);
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const current = existing.options?.applicationServerKey;
      if (!current || sameBytes(new Uint8Array(current), key)) return existing;
      // Inscricao feita com outra chave (o servidor trocou de chave): nao
      // serve mais. Sai e entra de novo com a chave atual.
      await existing.unsubscribe();
    }
    return await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }),
      SUBSCRIBE_TIMEOUT_MS,
      "push",
    );
  } catch (error) {
    if (error?.name === "NotAllowedError") throw new ReturnAlertError("denied");
    // Ex.: aba anonima do Chrome (nao tem push, e de proposito nao ha como
    // saber antes), Brave com as notificacoes do Google desligadas, navegador
    // que nunca respondeu (SUBSCRIBE_TIMEOUT_MS).
    throw new ReturnAlertError("push");
  }
}

// Inscricao que ja existe, sem pedir permissao nem criar nada. null quando
// este navegador nunca pediu aviso (ou a permissao foi retirada).
async function existingSubscription() {
  if (pushSupport() !== "ready" || permission() !== "granted") return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    throw new ReturnAlertError("push");
  }
}

/**
 * Pede o aviso deste aparelho para o livro. TEM de ser chamada direto do
 * toque no botao: o pedido de permissao vem primeiro, antes de qualquer
 * espera, porque o iPhone (e o Chrome, depois de alguns segundos) so mostra a
 * pergunta "Permitir notificacoes?" logo apos um toque.
 *
 * Lanca ReturnAlertError ("denied", "dismissed", "worker", "push") ou o
 * ApiError do servidor (ex.: 409 com code BOOK_AVAILABLE).
 */
export async function enableReturnAlert(book, title) {
  if (pushSupport() !== "ready") throw new ReturnAlertError("unsupported");

  let state = permission();
  if (state === "default") state = await askPermission();
  if (state === "denied") throw new ReturnAlertError("denied");
  if (state !== "granted") throw new ReturnAlertError("dismissed");

  const [publicKey, registration] = await Promise.all([
    loadPushKey(),
    workerReady(),
  ]);
  const subscription = await ensureSubscription(registration, publicKey);

  await publicApi(ALERTS, {
    method: "POST",
    body: { bookId: book.id, title, subscription: subscription.toJSON() },
  });
}

/** Este aparelho ja pediu aviso deste livro? */
export async function returnAlertActive(bookId) {
  const subscription = await existingSubscription();
  if (!subscription) return false;
  const data = await publicApi(ALERTS + "/status", {
    method: "POST",
    body: { bookId, endpoint: subscription.endpoint },
  });
  return Boolean(data?.active);
}

/** Cancela o aviso deste aparelho para o livro. */
export async function disableReturnAlert(bookId) {
  const subscription = await existingSubscription();
  // Sem inscricao (permissao retirada, dados apagados): nenhum aviso pode
  // chegar a este aparelho, que e o que cancelar quer dizer.
  if (!subscription) return;
  await publicApi(ALERTS + "/cancel", {
    method: "POST",
    body: { bookId, endpoint: subscription.endpoint },
  });
}

/** Erro com mensagem do servidor ou do app, ja escrita para a pessoa ler. */
export function isReadableError(error) {
  return error instanceof ApiError;
}

/** O servidor recusou porque o livro ja voltou para a estante. */
export function isBookAvailableError(error) {
  return error instanceof ApiError && error.payload?.code === "BOOK_AVAILABLE";
}
