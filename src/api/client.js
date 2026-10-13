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
  const { auth = true, redirectOnExpired = true, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  if (fetchOptions.body && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = "Bearer " + token;

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

// Chamada sem login, so para /api/public/*. Nunca envia o token.
export function publicApi(path, options = {}) {
  return api(path, { ...options, auth: false });
}
