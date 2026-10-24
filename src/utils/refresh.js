import { useEffect, useRef } from "react";

/**
 * "PUXAR PARA ATUALIZAR" (ver components/PullToRefresh.jsx).
 *
 * O gesto nao recarrega o site: ele avisa as telas abertas (o evento
 * REFRESH_EVENT) e cada uma busca de novo os SEUS dados, em silencio - a
 * lista continua na tela, os filtros e a busca continuam, e as janelas
 * abertas continuam abertas, so que com a informacao de agora.
 *
 * Quem tem dados para atualizar chama useRefresh(funcao) - a funcao pode
 * devolver uma Promise; a bolinha gira ate todas terminarem.
 */
const REFRESH_EVENT = "biblioteca:atualizar";

export function useRefresh(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    function onRefresh(event) {
      let result;
      try {
        result = handlerRef.current();
      } catch {
        result = null;
      }
      // Falha de rede numa atualizacao nao quebra nada: a tela fica com o
      // que ja mostrava.
      event.detail?.push(Promise.resolve(result).catch(() => {}));
    }
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);
}

/** Pede a todas as telas abertas que atualizem. Resolve quando terminarem. */
export function refreshAll() {
  const waiting = [];
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: waiting }));
  return Promise.all(waiting).then(() => waiting.length);
}
