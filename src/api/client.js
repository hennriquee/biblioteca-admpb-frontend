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

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  const response = await fetch(BASE_URL + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login")) {
      setToken(null);
      window.location.href = "/login";
    }
    throw new ApiError(
      (data && data.error) || "Nao foi possivel completar a ação.",
      response.status,
      data,
    );
  }

  return data;
}
