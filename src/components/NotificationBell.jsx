import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, getToken } from "../api/client.js";
import Modal from "./Modal.jsx";
import { IconBell, IconBookPlus, IconChevronLeft, IconLoans } from "./Icons.jsx";
import { NOTICES_EVENT } from "../utils/adminNotices.js";
import { useRefresh } from "../utils/refresh.js";

/**
 * SININHO do painel (canto direito do topo, em todas as telas de admin).
 *
 * A bolinha vermelha embaixo dele soma:
 * - as solicitacoes de emprestimo que esperam a retirada - contam enquanto
 *   existirem (so saem quando viram emprestimo ou sao excluidas);
 * - os livros sugeridos que ESTA conta ainda nao viu - abrir a tela de
 *   sugestoes zera essa parte (ver pages/Suggestions.jsx).
 *
 * Tocando no sininho abre a janela com os dois assuntos, sempre (o "visto" so
 * muda a bolinha). Cada cartao leva para a tela do assunto.
 *
 * Os numeros vem do servidor (GET /api/notifications): ao abrir o painel, a
 * cada troca de tela, quando a aba volta a ficar visivel, no "puxar para
 * atualizar" e a cada minuto com a aba aberta.
 */
const POLL_MS = 60 * 1000;

// Ultima contagem que chegou, fora do componente: o sininho e montado de novo
// a cada troca de tela, e assim a bolinha nao some ate a resposta nova chegar.
// Vale so para a mesma sessao (outra conta entrando nesta aba comeca do zero).
let lastCounts = { token: null, counts: undefined };

function savedCounts() {
  return lastCounts.token && lastCounts.token === getToken() ? lastCounts.counts : undefined;
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // undefined = carregando | null = nao carregou | { requests, suggestions }
  const [counts, setCounts] = useState(savedCounts);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    // A conta que pediu (a resposta fica guardada so para ela).
    const token = getToken();
    try {
      const data = await api("/api/notifications");
      if (requestId !== requestRef.current) return;
      if (token !== getToken()) return;
      lastCounts = { token, counts: data };
      setCounts(data);
    } catch {
      if (requestId !== requestRef.current) return;
      // Falhou: fica com o que ja sabia (so marca a falha se nao sabia nada).
      setCounts((current) => (current ? current : null));
    }
  }, []);

  useRefresh(load);

  // Ao abrir o painel e a cada troca de tela.
  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    window.addEventListener(NOTICES_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTICES_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Abrindo a janela, confere de novo (o numero pode ter mudado agora).
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const requests = counts?.requests || 0;
  const suggestionsTotal = counts?.suggestions?.total || 0;
  const unseen = counts?.suggestions?.unseen || 0;
  const badge = requests + unseen;
  const badgeText = badge > 99 ? "99+" : String(badge);

  const label =
    badge > 0
      ? "Notificações: " +
        badge +
        " " +
        plural(badge, "pendente", "pendentes")
      : "Notificações";

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      <button
        type="button"
        className="icon-button bell"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
      >
        <IconBell width={21} height={21} aria-hidden="true" />
        {badge > 0 ? (
          <span className="bell__badge" aria-hidden="true">
            {badgeText}
          </span>
        ) : null}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notificações"
        size="sm"
      >
        {counts === undefined ? (
          <p className="muted" role="status">
            Carregando
            <span className="loadingdots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : counts === null ? (
          <div className="notices__error" role="alert">
            <p>Não foi possível carregar as notificações.</p>
            <button type="button" className="btn btn--ghost" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className="notices">
            <button
              type="button"
              className={"notice" + (requests > 0 ? " notice--alert" : "")}
              onClick={() => go("/emprestimos?filtro=solicitados")}
            >
              <span className="notice__icon" aria-hidden="true">
                <IconLoans width={22} height={22} />
              </span>
              <span className="notice__text">
                <strong>Livros solicitados</strong>
                <span>
                  {requests > 0
                    ? requests +
                      " " +
                      plural(
                        requests,
                        "solicitação aguardando a retirada",
                        "solicitações aguardando a retirada",
                      )
                    : "Nenhuma solicitação pendente"}
                </span>
              </span>
              {requests > 0 ? (
                <span className="notice__count" aria-hidden="true">
                  {requests > 99 ? "99+" : requests}
                </span>
              ) : null}
              <IconChevronLeft
                className="notice__go"
                width={18}
                height={18}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className={"notice" + (unseen > 0 ? " notice--alert" : "")}
              onClick={() => go("/configuracoes/sugestoes")}
            >
              <span className="notice__icon" aria-hidden="true">
                <IconBookPlus width={22} height={22} />
              </span>
              <span className="notice__text">
                <strong>Livros sugeridos</strong>
                <span>
                  {suggestionsTotal > 0
                    ? suggestionsTotal +
                      " " +
                      plural(suggestionsTotal, "livro sugerido", "livros sugeridos") +
                      (unseen > 0
                        ? " · " +
                          unseen +
                          " " +
                          plural(unseen, "novo", "novos") +
                          " para você ver"
                        : "")
                    : "Nenhum livro sugerido"}
                </span>
              </span>
              {unseen > 0 ? (
                <span className="notice__count" aria-hidden="true">
                  {unseen > 99 ? "99+" : unseen}
                </span>
              ) : null}
              <IconChevronLeft
                className="notice__go"
                width={18}
                height={18}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
