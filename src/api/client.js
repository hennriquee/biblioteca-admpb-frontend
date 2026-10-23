const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

const TOKEN_KEY = "biblioteca_admpb_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado do navegador pode bloquear: seguimos sem salvar */
  }
}

// ---------- Passe do acervo publico (reCAPTCHA) ----------
// Quem marca o "Nao sou um robo" na entrada do /catalogo recebe do servidor
// um passe que vale algumas horas (ver components/CatalogGate.jsx e
// backend/src/services/captcha.js). Toda chamada de /api/public/* leva o
// passe; quando o servidor diz que ele faltou ou venceu, o app avisa a
// entrada do catalogo (CATALOG_PASS_EVENT) para pedir a caixa de novo.
const PASS_KEY = "biblioteca_admpb_passe_acervo";
const PASS_HEADER = "X-Catalogo-Passe";
export const CATALOG_PASS_EVENT = "biblioteca:passe-do-acervo";
// Passe que vence em menos de 1 minuto ja e tratado como vencido: melhor
// marcar a caixa agora do que ver o catalogo falhar no meio.
const PASS_MARGIN_MS = 60 * 1000;

// Copia na memoria: vale mesmo no navegador que nao deixa guardar nada.
let memoryPass = null;

function stillValid(entry) {
  return Boolean(entry?.pass) && entry.until - PASS_MARGIN_MS > Date.now();
}

export function getCatalogPass() {
  if (stillValid(memoryPass)) return memoryPass.pass;
  try {
    const stored = JSON.parse(localStorage.getItem(PASS_KEY) || "null");
    if (stillValid(stored)) {
      memoryPass = stored;
      return stored.pass;
    }
  } catch {
    /* sem armazenamento ou valor estragado: sem passe */
  }
  return null;
}

// expiresIn em segundos, como o servidor manda. O vencimento e contado no
// relogio DESTE aparelho: com o relogio do celular errado, uma data vinda do
// servidor faria o passe parecer vencido logo que chega.
export function setCatalogPass(pass, expiresIn) {
  memoryPass = pass ? { pass, until: Date.now() + expiresIn * 1000 } : null;
  try {
    if (memoryPass) localStorage.setItem(PASS_KEY, JSON.stringify(memoryPass));
    else localStorage.removeItem(PASS_KEY);
  } catch {
    /* modo privado: fica so na memoria, ate fechar a aba */
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload || {};
  }
}

// "Cutucada" no backend: dispara uma chamada leve assim que o site abre,
// so para tirar o Render do modo de descanso o quanto antes. Nao precisa
// de token e nao trava a tela: se falhar ou demorar, simplesmente ignoramos.
export function wakeBackend() {
  fetch(BASE_URL + "/api/health").catch(() => {
    /* tentativa de "acordar" o servidor; se der erro, sem problema */
  });
}

// O servidor responde? (Pedido leve, com prazo curto.) Serve para separar
// "sem internet" de outros problemas quando o aparelho diz que esta on-line
// mas a rede nao sai para a internet (Wi-Fi sem conexao, portal de login).
export async function serverReachable(timeoutMs = 4000) {
  try {
    const response = await fetch(BASE_URL + "/api/health", {
      cache: "no-store",
      // Navegador antigo sem AbortSignal.timeout: pergunta sem prazo.
      signal:
        typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(timeoutMs)
          : undefined,
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Mensagem para quando a API nao devolveu um texto de erro proprio
// (por exemplo, uma pagina de erro do Render quando o servidor cai).
function fallbackMessage(status) {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem permissão para fazer isso.";
  if (status === 404) return "Não encontramos o que você procurou.";
  if (status === 429)
    return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.";
  if (status >= 500) return "Aguarde um tempo e tente novamente.";
  return "Não foi possível concluir a ação.";
}

// Opcoes proprias (nao vao para o fetch):
// - auth: false e para as rotas publicas (/api/public/*): nao envia o token
//   (nao ha motivo para ele sair do navegador) e, se der 401, nao leva ao
//   login. Use publicApi() em vez de passar isso na mao.
// - redirectOnExpired: false deixa quem chamou decidir o que fazer com o 401.
//   Usado ao restaurar a sessao: sem isso, quem tem um token vencido e abre o
//   /catalogo (pagina publica) seria mandado para o login.
export async function api(path, options = {}) {
  const {
    auth = true,
    redirectOnExpired = true,
    catalogPass = false,
    ...fetchOptions
  } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  if (fetchOptions.body && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = "Bearer " + token;
  const pass = catalogPass ? getCatalogPass() : null;
  if (pass) headers[PASS_HEADER] = pass;

  let response;
  try {
    response = await fetch(BASE_URL + path, {
      ...fetchOptions,
      headers,
      body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
    });
  } catch {
    // fetch so lanca erro quando nao chegou a resposta nenhuma: sem internet,
    // servidor fora do ar/acordando ou bloqueio de CORS. O navegador mostraria
    // apenas "Failed to fetch", entao trocamos por algo que o usuario entenda.
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua internet. Aguarde um tempo e tente novamente.",
      0,
      { code: "NETWORK_ERROR" },
    );
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Corpo que nao e JSON (ex.: HTML de erro do proxy): nao exibimos.
      data = null;
    }
  }

  if (!response.ok) {
    // Passe do acervo faltando ou vencido: a entrada do catalogo pede o
    // "Nao sou um robo" de novo (ver components/CatalogGate.jsx). So se o
    // passe recusado ainda e o guardado: a resposta atrasada de um pedido
    // feito com o passe velho nao pode apagar o passe novo, que a pessoa
    // acabou de ganhar marcando a caixa.
    if (
      catalogPass &&
      response.status === 403 &&
      data?.code === "CAPTCHA_REQUIRED" &&
      getCatalogPass() === pass
    ) {
      setCatalogPass(null);
      window.dispatchEvent(new Event(CATALOG_PASS_EVENT));
    }
    if (response.status === 401 && auth && !path.includes("/auth/login")) {
      setToken(null);
      if (redirectOnExpired) window.location.href = "/login";
    }
    throw new ApiError(
      (data && data.error) ||
        (response.status === 401 && path.includes("/auth/login")
          ? "Usuário ou senha incorretos."
          : fallbackMessage(response.status)),
      response.status,
      data,
    );
  }

  return data;
}

// Chamada sem login, so para /api/public/*. Nunca envia o token; envia o
// passe do acervo (reCAPTCHA), quando houver.
export function publicApi(path, options = {}) {
  return api(path, { ...options, auth: false, catalogPass: true });
}
