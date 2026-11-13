import { api } from "../api/client.js";
import { pushSupport } from "./returnAlert.js";

/**
 * NOTIFICACOES DO APP para o ADMINISTRADOR (Configurações > Notificações):
 * o lado do navegador.
 *
 * E o mesmo Web Push do "Avise-me quando voltar" do acervo (utils/
 * returnAlert.js): o navegador cria uma inscricao, o painel a liga a conta
 * do administrador (POST /api/notifications/push) e o servidor manda as
 * notificacoes que ele escolheu (backend/src/services/adminPush.js). Quem
 * mostra no aparelho e o service worker (public/push-sw.js), com os botoes
 * ("Registrar solicitação", "Responder"...).
 *
 * A inscricao do navegador e UMA so, dividida com o "Avise-me" do acervo:
 * desligar aqui so tira o aparelho da conta (nunca cancela a inscricao, o que
 * acabaria com os avisos de livro pedidos neste mesmo navegador).
 */

const BASE = "/api/notifications/push";
const WORKER_TIMEOUT_MS = 20 * 1000;
const SUBSCRIBE_TIMEOUT_MS = 30 * 1000;

/** Erro com "kind" para a tela escolher a mensagem. */
export class AdminPushError extends Error {
  constructor(kind, message = kind) {
    super(message);
    this.kind = kind;
  }
}

export { pushSupport };

export function permissionState() {
  return "Notification" in window ? Notification.permission : "denied";
}

function askPermission() {
  return new Promise((resolve) => {
    const result = Notification.requestPermission(resolve);
    if (result && typeof result.then === "function") result.then(resolve);
  });
}

async function withTimeout(promise, ms, kind) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AdminPushError(kind)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
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

async function ensureSubscription(registration, publicKey) {
  try {
    const key = keyBytes(publicKey);
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const current = existing.options?.applicationServerKey;
      if (!current || sameBytes(new Uint8Array(current), key)) return existing;
      // Feita com outra chave (o servidor trocou): nao serve mais.
      await existing.unsubscribe();
    }
    return await withTimeout(
      registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }),
      SUBSCRIBE_TIMEOUT_MS,
      "push",
    );
  } catch (error) {
    if (error instanceof AdminPushError) throw error;
    if (error?.name === "NotAllowedError") throw new AdminPushError("denied");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new AdminPushError("offline");
    }
    throw new AdminPushError("push");
  }
}

/** A inscricao que ja existe neste navegador (sem pedir nada), ou null. */
export async function currentSubscription() {
  if (pushSupport() !== "ready" || permissionState() !== "granted") return null;
  try {
    const registration = await withTimeout(
      navigator.serviceWorker.getRegistration(),
      5000,
      "worker",
    );
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

/**
 * Liga as notificacoes NESTE aparelho para a conta logada. TEM de ser
 * chamada direto do toque no botao (o pedido de permissao vem antes de
 * qualquer espera: o iPhone e o Chrome so mostram a pergunta logo apos um
 * toque). Devolve o que o servidor responde ({ kinds, devices }).
 */
export async function enableAdminPush() {
  if (pushSupport() !== "ready") throw new AdminPushError("unsupported");
  let state = permissionState();
  if (state === "default") state = await askPermission();
  if (state === "denied") throw new AdminPushError("denied");
  if (state !== "granted") throw new AdminPushError("dismissed");

  const [{ publicKey }, registration] = await Promise.all([
    api(BASE + "/key"),
    withTimeout(navigator.serviceWorker.ready, WORKER_TIMEOUT_MS, "worker"),
  ]);
  const subscription = await ensureSubscription(registration, publicKey);
  return api(BASE, { method: "POST", body: { subscription: subscription.toJSON() } });
}

/** Este aparelho recebe as notificacoes desta conta? */
export async function adminPushActive() {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  const data = await api(BASE + "/status", {
    method: "POST",
    body: { endpoint: subscription.endpoint },
  });
  return Boolean(data?.active);
}

/** Tira ESTE aparelho da conta (a inscricao do navegador continua). */
export async function disableAdminPush() {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  return api(BASE + "/cancel", { method: "POST", body: { endpoint: subscription.endpoint } });
}

/** Tira um aparelho da lista (pelo id; pode ser outro aparelho). */
export function removeAdminDevice(deviceId) {
  return api(BASE + "/cancel", { method: "POST", body: { deviceId } });
}

export function sendAdminTest() {
  return api(BASE + "/test", { method: "POST" });
}

/**
 * Ao SAIR da biblioteca: este aparelho deixa de receber as notificacoes da
 * conta (quem entrar depois neste navegador nao recebe as de outra pessoa).
 * Leva no maximo ~2 s e nunca falha: o pedido sai com o token de agora,
 * antes de a sessao ser apagada.
 */
export async function forgetThisDevice() {
  try {
    const subscription = await withTimeout(currentSubscription(), 2000, "worker");
    if (!subscription) return;
    api(BASE + "/cancel", {
      method: "POST",
      body: { endpoint: subscription.endpoint },
      redirectOnExpired: false,
    }).catch(() => {});
  } catch {
    /* sem como saber: segue saindo */
  }
}

/** Texto para a pessoa ler, a partir do erro. */
export function adminPushErrorMessage(error) {
  switch (error?.kind) {
    case "unsupported":
      return "Este navegador não recebe notificações. Use o Chrome, o Edge ou o Firefox (no iPhone, instale o app na tela de início).";
    case "denied":
      return "As notificações deste site estão bloqueadas no navegador. Libere nas configurações do navegador (cadeado ao lado do endereço) e tente de novo.";
    case "dismissed":
      return "Você não respondeu à pergunta do navegador. Toque de novo e escolha “Permitir”.";
    case "worker":
      return "O app ainda está terminando de abrir. Aguarde um instante e tente de novo.";
    case "offline":
      return "Sem internet agora. Tente de novo quando a conexão voltar.";
    case "push":
      return "O navegador não conseguiu preparar as notificações (aba anônima não recebe). Tente de novo ou use outro navegador.";
    default:
      return error?.message || "Não foi possível ativar as notificações.";
  }
}
