import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, getToken } from "../api/client.js";
import Modal from "./Modal.jsx";
import Confirm from "./Confirm.jsx";
import BookCover from "./BookCover.jsx";
import { useToast } from "./Toast.jsx";
import { IconBell, IconBookPlus, IconChat, IconChevronLeft, IconLoans } from "./Icons.jsx";
import { NOTICES_EVENT } from "../utils/adminNotices.js";
import { useRefresh } from "../utils/refresh.js";
import { formatDate } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";

/**
 * SININHO do painel (canto direito do topo, em todas as telas de admin): a
 * AREA DE NOTIFICACOES.
 *
 * Junta (desde 12/11/2026, quando as Conversas sairam das Configuracoes):
 * - CONVERSAS do WhatsApp da biblioteca: as mensagens nao lidas (a contagem
 *   vem do Layout, a mesma da aba "Conversas");
 * - PEDIDOS NOVOS do acervo publico (solicitacao que ninguem registrou
 *   ainda), cada um com os botoes para concluir: "Registrar solicitação"
 *   (o mesmo caminho do link que vem na mensagem: abre o "Registrar
 *   solicitação" ja preenchido), "Abrir conversa" (se a pessoa mandou a
 *   mensagem) e "Descartar";
 * - as solicitacoes que esperam a retirada - contam enquanto existirem (so
 *   saem quando viram emprestimo ou sao excluidas);
 * - os livros sugeridos que ESTA conta ainda nao viu - abrir a tela de
 *   sugestoes zera essa parte (ver pages/Suggestions.jsx).
 *
 * A bolinha vermelha soma tudo isso. Os numeros vem do servidor (GET
 * /api/notifications): ao abrir o painel, a cada troca de tela, quando a aba
 * volta a ficar visivel, no "puxar para atualizar" e a cada minuto.
 *
 * O endereco com ?notificacoes=1 abre a janela (o botao "Ver notificações"
 * da notificacao do aparelho leva para la).
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

function firstNames(name) {
  return String(name || "").trim().split(/\s+/).slice(0, 2).join(" ");
}

export default function NotificationBell({ unreadChats = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  // undefined = carregando | null = nao carregou | { requests, suggestions, pending }
  const [counts, setCounts] = useState(savedCounts);
  // O pedido que esta perguntando "Descartar?" e o que esta sendo descartado.
  const [discarding, setDiscarding] = useState(null);
  const [busyId, setBusyId] = useState("");
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

  // ?notificacoes=1 no endereco: abre a janela e tira o parametro (voltar ou
  // atualizar a pagina nao abre de novo).
  useEffect(() => {
    if (searchParams.get("notificacoes") !== "1") return;
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("notificacoes");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const requests = counts?.requests || 0;
  const suggestionsTotal = counts?.suggestions?.total || 0;
  const unseen = counts?.suggestions?.unseen || 0;
  const pending = Array.isArray(counts?.pending) ? counts.pending : [];
  const chats = unreadChats > 0 ? unreadChats : 0;
  const badge = requests + unseen + pending.length + chats;
  const badgeText = badge > 99 ? "99+" : String(badge);

  const label =
    badge > 0
      ? "Notificações: " + badge + " " + plural(badge, "pendente", "pendentes")
      : "Notificações";

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  async function discard(item) {
    setDiscarding(null);
    setBusyId(item._id);
    try {
      await api("/api/requests/pending/" + item._id, { method: "DELETE" });
      notify("Pedido descartado.", "success");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusyId("");
      load();
    }
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
        <IconBell width={20} height={20} aria-hidden="true" />
        {badge > 0 ? (
          <span className="bell__badge" aria-hidden="true">
            {badgeText}
          </span>
        ) : null}
      </button>

      {/* No corpo da pagina (portal): o sininho fica dentro da barra do topo,
          que tem camada propria (.apptop), e a janela ficaria presa nela, por
          baixo da barra de abas do celular. Abre no MEIO da tela (tambem no
          celular, em vez de subir de baixo) e no tamanho medio. */}
      {createPortal(
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Notificações"
          size="md"
          placement="center"
        >
          <div className="notices">
            {/* As Conversas vem do Layout: aparecem mesmo se o resto falhar. */}
            <button
              type="button"
              className={"notice" + (chats > 0 ? " notice--alert" : "")}
              onClick={() => go("/conversas")}
            >
              <span className="notice__icon" aria-hidden="true">
                <IconChat width={22} height={22} />
              </span>
              <span className="notice__text">
                <strong>Conversas</strong>
                <span>
                  {chats > 0
                    ? chats + " " + plural(chats, "mensagem não lida", "mensagens não lidas") + " no WhatsApp"
                    : "WhatsApp da biblioteca · nada novo"}
                </span>
              </span>
              {chats > 0 ? (
                <span className="notice__count" aria-hidden="true">
                  {chats > 99 ? "99+" : chats}
                </span>
              ) : null}
              <IconChevronLeft className="notice__go" width={18} height={18} aria-hidden="true" />
            </button>

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
                <p>Não foi possível carregar as outras notificações.</p>
                <button type="button" className="btn btn--ghost" onClick={load}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <>
                {pending.length ? (
                  <section className="newreqs" aria-label="Pedidos novos do catálogo">
                    <h3 className="newreqs__title">
                      {pending.length === 1
                        ? "1 pedido novo do catálogo"
                        : pending.length + " pedidos novos do catálogo"}
                    </h3>
                    <ul className="newreqs__list">
                      {pending.map((item) => {
                        const busy = busyId === item._id;
                        const title = formatBookTitle(item.bookTitle);
                        return (
                          <li key={item._id} className="newreq">
                            <div className="newreq__info">
                              <BookCover src={item.bookCover} alt="" className="cover--xs" />
                              <div className="newreq__text">
                                <strong title={title}>{title}</strong>
                                <span>
                                  {firstNames(item.requesterName) || "Alguém"}
                                  {item.requesterIsNew ? " (novo cadastro)" : ""}
                                  {" · retirada em " + formatDate(item.pickupDate)}
                                </span>
                              </div>
                            </div>
                            <div className="newreq__actions">
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                disabled={busy}
                                onClick={() => go("/solicitacao/" + encodeURIComponent(item.token))}
                              >
                                Registrar solicitação
                              </button>
                              {item.waChat ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  disabled={busy}
                                  onClick={() => go("/conversas/" + item.waChat)}
                                >
                                  Abrir conversa
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn btn--ghost-danger btn--sm"
                                disabled={busy}
                                onClick={() => setDiscarding(item)}
                              >
                                {busy ? "Descartando…" : "Descartar"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

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
                        : "Nenhuma solicitação aguardando a retirada"}
                    </span>
                  </span>
                  {requests > 0 ? (
                    <span className="notice__count" aria-hidden="true">
                      {requests > 99 ? "99+" : requests}
                    </span>
                  ) : null}
                  <IconChevronLeft className="notice__go" width={18} height={18} aria-hidden="true" />
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
                            ? " · " + unseen + " " + plural(unseen, "novo", "novos") + " para você ver"
                            : "")
                        : "Nenhum livro sugerido"}
                    </span>
                  </span>
                  {unseen > 0 ? (
                    <span className="notice__count" aria-hidden="true">
                      {unseen > 99 ? "99+" : unseen}
                    </span>
                  ) : null}
                  <IconChevronLeft className="notice__go" width={18} height={18} aria-hidden="true" />
                </button>
              </>
            )}

            <button type="button" className="linkish notices__prefs" onClick={() => go("/configuracoes/notificacoes")}>
              Escolher o que receber no aparelho
            </button>
          </div>
        </Modal>,
        document.body,
      )}

      {/* (no corpo da pagina, pelo mesmo motivo da janela acima) */}
      {createPortal(
      <Confirm
        open={Boolean(discarding)}
        title="Descartar este pedido?"
        message={
          discarding
            ? "O pedido de " +
              (firstNames(discarding.requesterName) || "alguém") +
              " para “" +
              formatBookTitle(discarding.bookTitle) +
              "” sai das notificações e o link dele para de valer. Use quando o pedido não vai ser atendido (repetido, engano)."
            : ""
        }
        confirmLabel="Descartar"
        tone="danger"
        onCancel={() => setDiscarding(null)}
        onConfirm={() => discard(discarding)}
      />,
        document.body,
      )}
    </>
  );
}
