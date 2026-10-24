/**
 * Sininho do painel (components/NotificationBell.jsx): as telas que mudam o
 * que ele conta (abrir os livros sugeridos, registrar ou concluir uma
 * solicitacao) chamam pokeNotices() para a bolinha vermelha se atualizar na
 * hora, sem esperar a proxima conferida.
 */
export const NOTICES_EVENT = "biblioteca:notificacoes";

export function pokeNotices() {
  window.dispatchEvent(new Event(NOTICES_EVENT));
}
