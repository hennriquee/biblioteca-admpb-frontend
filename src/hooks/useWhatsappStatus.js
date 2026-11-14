import { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken } from "../api/client.js";
import { useRefresh } from "../utils/refresh.js";

/**
 * Situacao do WhatsApp da biblioteca (GET /api/whatsapp/status), atualizada
 * sozinha: de pressa (2 s) enquanto esta conectando ou esperando o QR ser lido,
 * devagar (idleMs) nos demais casos, e so com a aba visivel.
 *
 * status: undefined = carregando | null = nao foi possivel carregar | objeto
 * (com "unread": o total de mensagens nao lidas).
 */
const BUSY = new Set(["connecting", "qr", "reconnecting", "standby"]);
// (dormindo = conexao sob demanda fechada; na tela Conversas ela acorda em
// instantes, entao ali a consulta tambem fica de pressa)
const BUSY_ACTIVE = new Set([...BUSY, "sleeping"]);

/**
 * Aviso de que algo mudou nas conversas (ex.: uma conversa foi lida): quem
 * acompanha a situacao (a tela e a bolinha da aba, cada um com a sua consulta)
 * busca de novo agora, sem esperar o proximo ciclo.
 */
export const WHATSAPP_REFRESH_EVENT = "biblioteca:whatsapp-mudou";

/**
 * active: a tela CONVERSAS (alguem usando o WhatsApp). So ela manda
 * "?active=1", que mantem o WhatsApp conectado no servidor (conexao sob
 * demanda: backend/src/services/whatsapp/service.js). A bolinha das outras
 * telas consulta sem isso e nao acorda a conexao.
 */
export function useWhatsappStatus({ idleMs = 8000, busyMs = 2000, active = false } = {}) {
  const [status, setStatus] = useState(undefined);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    const token = getToken();
    try {
      const data = await api("/api/whatsapp/status" + (active ? "?active=1" : ""));
      // Resposta atrasada, ou de outra conta: nao vale.
      if (requestId !== requestRef.current || token !== getToken()) return null;
      setStatus(data);
      return data;
    } catch {
      if (requestId === requestRef.current) {
        // Fica com o que ja sabia; so marca a falha se nao sabia nada.
        setStatus((current) => (current ? current : null));
      }
      return null;
    }
  }, [active]);

  useRefresh(load);

  useEffect(() => {
    load();
    window.addEventListener(WHATSAPP_REFRESH_EVENT, load);
    return () => window.removeEventListener(WHATSAPP_REFRESH_EVENT, load);
  }, [load]);

  const state = status?.state;
  useEffect(() => {
    const delay = (active ? BUSY_ACTIVE : BUSY).has(state) ? busyMs : idleMs;
    function tick() {
      if (document.visibilityState === "visible") load();
    }
    const timer = setInterval(tick, delay);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load, state, idleMs, busyMs, active]);

  return { status, reload: load, setStatus };
}

/** So o numero de mensagens nao lidas (para a bolinha da aba), sem pressa. */
export function useWhatsappUnread() {
  const { status } = useWhatsappStatus({ idleMs: 20000, busyMs: 20000 });
  return status?.unread || 0;
}
