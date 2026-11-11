import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import Avatar from "../components/Avatar.jsx";
import ChargeModal from "../components/ChargeModal.jsx";
import ChatThread from "../components/ChatThread.jsx";
import Modal from "../components/Modal.jsx";
import PersonPicker from "../components/PersonPicker.jsx";
import WhatsappConnect from "../components/WhatsappConnect.jsx";
import { useToast } from "../components/Toast.jsx";
import { IconChat, IconPlus, IconSearch } from "../components/Icons.jsx";
import { useWhatsappStatus, WHATSAPP_REFRESH_EVENT } from "../hooks/useWhatsappStatus.js";
import { listTime } from "../utils/chatTime.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { formatDate, loanProgress } from "../utils/dates.js";
import { useRefresh } from "../utils/refresh.js";
import {
  buildMessage,
  canCharge,
  chargeBlockReason,
  formatStoredPhone,
  nextChargeAt,
  samePhone,
} from "../utils/whatsapp.js";

/**
 * CONVERSAS: o WhatsApp da biblioteca dentro do painel. E aqui que abre o
 * "Cobrar no WhatsApp" dos emprestimos atrasados (/conversas?cobrar=<id>):
 * a conversa da pessoa abre com a mensagem de cobranca pronta no campo; ao
 * enviar, a cobranca fica registrada no nome de quem enviou (regra de uma a
 * cada 30 dias, conferida no servidor) e so conta se a mensagem sair.
 *
 * No celular a tela mostra a lista OU a conversa; no computador, as duas lado
 * a lado.
 */

const LIST_POLL_MS = 6000;

function chatTitle(chat) {
  return (
    chat.person?.fullName ||
    chat.pushName ||
    (chat.phone ? formatStoredPhone(chat.phone) : "") ||
    "Número oculto"
  );
}

function ChatRow({ chat, active }) {
  const title = chatTitle(chat);
  const unread = chat.unread || 0;
  // (sem os asteriscos do *negrito* do WhatsApp)
  const preview = chat.lastMessageText
    ? (chat.lastMessageFromMe ? "Você: " : "") +
      chat.lastMessageText.replace(/\*([^\s*](?:[^*\n]*[^\s*])?)\*/g, "$1")
    : "";
  return (
    <li>
      <Link
        to={"/conversas/" + chat._id}
        data-chat-id={chat._id}
        className={"chatrow" + (active ? " is-active" : "") + (unread ? " is-unread" : "")}
        aria-current={active ? "page" : undefined}
      >
        <Avatar src={chat.person?.photo} name={title} size={46} decorative />
        <span className="chatrow__body">
          <span className="chatrow__top">
            <strong>{title}</strong>
            <time dateTime={chat.lastMessageAt || undefined}>
              {chat.lastMessageAt ? listTime(chat.lastMessageAt) : ""}
            </time>
          </span>
          <span className="chatrow__bottom">
            <span className="chatrow__preview">{preview || "Sem mensagens"}</span>
            {chat.attendance?.waiting ? (
              <span className="chatrow__waiting">Aguardando administrador</span>
            ) : chat.attendance?.muted ? (
              <span className="chatrow__waiting">Robô silenciado</span>
            ) : null}
            {unread ? (
              <span className="chatrow__badge">
                <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
                <span className="sr-only">
                  {unread === 1 ? "1 mensagem não lida" : unread + " mensagens não lidas"}
                </span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function Conversations() {
  const { chatId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { status, reload, setStatus } = useWhatsappStatus();
  const connected = status?.state === "open";

  // ---------- lista ----------
  // null = carregando
  const [chats, setChats] = useState(null);
  const [listError, setListError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const listRequest = useRef(0);
  const chatsRef = useRef(null);
  chatsRef.current = chats;
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const termRef = useRef("");
  termRef.current = term;

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadList = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++listRequest.current;
      try {
        const data = await api(
          "/api/whatsapp/chats?limit=60" + (term ? "&search=" + encodeURIComponent(term) : ""),
        );
        if (requestId !== listRequest.current) return;
        const current = chatsRef.current;
        if (silent && current) {
          // Atualizacao em segundo plano: renova a primeira pagina e MANTEM as
          // conversas mais antigas que "Carregar mais" ja trouxe (antes, a lista
          // encolhia sozinha para 100 a cada 6 s).
          const fresh = new Set(data.chats.map((c) => c._id));
          const tail = current.filter((c) => !fresh.has(c._id));
          setChats([...data.chats, ...tail]);
          setHasMore(tail.length ? hasMoreRef.current : data.hasMore);
        } else {
          setChats(data.chats);
          setHasMore(data.hasMore);
        }
        setListError("");
      } catch (error) {
        if (requestId !== listRequest.current) return;
        // Atualizacao em segundo plano que falha: a lista continua na tela.
        if (!silent || chatsRef.current === null) setListError(error.message);
      }
    },
    [term],
  );

  useEffect(() => {
    setChats((current) => (term ? null : current));
    loadList();
  }, [loadList, term]);

  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible") loadList({ silent: true });
    }
    const timer = setInterval(tick, LIST_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadList]);

  useRefresh(() => Promise.all([loadList({ silent: true }), reload()]));

  async function loadMore() {
    const last = chats?.[chats.length - 1];
    if (!last?.lastMessageAt || loadingMore) return;
    setLoadingMore(true);
    const startedTerm = term;
    try {
      const data = await api(
        "/api/whatsapp/chats?limit=60&before=" +
          encodeURIComponent(last.lastMessageAt) +
          (term ? "&search=" + encodeURIComponent(term) : ""),
      );
      // A busca mudou no meio: essa resposta e de outra lista.
      if (termRef.current !== startedTerm) return;
      setChats((current) => {
        const known = new Set((current || []).map((c) => c._id));
        return [...(current || []), ...data.chats.filter((c) => !known.has(c._id))];
      });
      setHasMore(data.hasMore);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoadingMore(false);
    }
  }

  // ---------- conversa aberta ----------
  const [fetchedChat, setFetchedChat] = useState(null);
  const [chatError, setChatError] = useState("");
  useEffect(() => {
    setFetchedChat(null);
    setChatError("");
    if (!chatId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/whatsapp/chats/" + chatId);
        if (!cancelled) setFetchedChat(data.chat);
      } catch (error) {
        if (!cancelled) setChatError(error.status === 404 ? "Essa conversa não existe." : error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);
  const selected = useMemo(
    () => chats?.find((c) => c._id === chatId) || (fetchedChat?._id === chatId ? fetchedChat : null),
    [chats, chatId, fetchedChat],
  );

  // Rascunhos: um por conversa, para nao perder o que foi escrito ao trocar.
  const draftsRef = useRef({});
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft(chatId ? draftsRef.current[chatId] ?? "" : "");
  }, [chatId]);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  // O rascunho e guardado POR conversa: uma resposta atrasada (um envio lento
  // da conversa A) nao apaga o que ja esta sendo escrito na B.
  const changeDraft = useCallback((id, text) => {
    if (!id) return;
    draftsRef.current[id] = text;
    if (chatIdRef.current === id) setDraft(text);
  }, []);

  // A conversa foi lida: zera a bolinha dela na lista e a total.
  const handleRead = useCallback(
    (id) => {
      setChats((current) =>
        current ? current.map((c) => (c._id === id ? { ...c, unread: 0 } : c)) : current,
      );
      setFetchedChat((current) => (current?._id === id ? { ...current, unread: 0 } : current));
      // O total de nao lidas vem do servidor: este aviso faz a tela e a bolinha
      // da aba (que tem a propria consulta) o buscarem agora.
      window.dispatchEvent(new Event(WHATSAPP_REFRESH_EVENT));
    },
    [],
  );

  // O servidor devolveu a conversa atualizada (ex.: quem atende agora).
  const handleChatChange = useCallback((updated) => {
    if (!updated?._id) return;
    setChats((current) =>
      current ? current.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)) : current,
    );
    setFetchedChat((current) => (current?._id === updated._id ? { ...current, ...updated } : current));
  }, []);

  // ---------- cobranca (vem de Emprestimos > Cobrar no WhatsApp) ----------
  const cobrarId = params.get("cobrar") || "";
  // { data } | { error } | null
  const [loan, setLoan] = useState(null);
  const [chargeOn, setChargeOn] = useState(true);
  const [chargeDone, setChargeDone] = useState(null);
  const [openError, setOpenError] = useState("");
  const [phoneCharge, setPhoneCharge] = useState(null);

  useEffect(() => {
    setLoan(null);
    setChargeOn(true);
    setChargeDone(null);
    setOpenError("");
    if (!cobrarId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/loans/" + cobrarId);
        if (!cancelled) setLoan({ data });
      } catch (error) {
        if (!cancelled) {
          setLoan({ error: error.status === 404 ? "Esse empréstimo não existe mais." : error.message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cobrarId]);

  // /conversas?cobrar=<id>: abre (ou cria) a conversa da pessoa do emprestimo.
  useEffect(() => {
    if (!cobrarId || chatId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/whatsapp/chats", {
          method: "POST",
          body: { loanId: cobrarId },
        });
        if (!cancelled) {
          navigate("/conversas/" + data.chat._id + "?cobrar=" + encodeURIComponent(cobrarId), {
            replace: true,
          });
        }
      } catch (error) {
        if (!cancelled) setOpenError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cobrarId, chatId, navigate]);

  // A mensagem de cobranca ja vem escrita (uma vez, e so se nao ha rascunho).
  const prefilled = useRef("");
  // A cobranca e de OUTRA pessoa (endereco editado a mao)? Nao e esta conversa.
  const otherPerson = Boolean(
    loan?.data && selected && !samePhone(loan.data.personPhone, selected.phone),
  );
  useEffect(() => {
    if (!loan?.data || !chatId || !cobrarId || !selected) return;
    const key = chatId + ":" + cobrarId;
    if (prefilled.current === key) return;
    prefilled.current = key;
    if (!otherPerson && canCharge(loan.data) && !draftsRef.current[chatId]) {
      const text = buildMessage(loan.data);
      draftsRef.current[chatId] = text;
      setDraft(text);
    }
  }, [loan, chatId, cobrarId, selected, otherPerson]);

  const chargeReady = Boolean(
    loan?.data && chargeOn && !chargeDone && !otherPerson && canCharge(loan.data),
  );

  // Se o texto da conversa ainda e a mensagem de cobranca pronta, ele sai (para
  // nao ser enviado como mensagem comum, repetindo a cobranca); se foi editado, fica.
  function clearReadyText(id, data) {
    if (data && id && draftsRef.current[id] === buildMessage(data)) changeDraft(id, "");
  }

  function dropCharge() {
    setChargeOn(false);
    clearReadyText(chatId, loan?.data);
  }

  const charge = useMemo(() => {
    if (!cobrarId) return null;
    if (chargeDone) {
      const next = nextChargeAt(chargeDone);
      return {
        mode: "done",
        title: "Cobrança registrada",
        detail:
          "Ficou no nome de " +
          (chargeDone.overdueSentByName || "quem enviou") +
          (next ? ". Uma nova cobrança só pode sair a partir de " + formatDate(next) + "." : "."),
      };
    }
    if (!loan) return null;
    if (loan.error) return { mode: "blocked", title: "Não foi possível abrir a cobrança", detail: loan.error };
    if (!chargeOn) return null;
    const data = loan.data;
    if (otherPerson) {
      return {
        mode: "blocked",
        title: "Essa cobrança é de outra pessoa",
        detail:
          "O empréstimo de “" +
          formatBookTitle(data.bookTitle) +
          "” é de " +
          data.personName +
          ". Abra a conversa dela para cobrar.",
      };
    }
    const book = "“" + formatBookTitle(data.bookTitle) + "”";
    if (canCharge(data)) {
      const days = Math.abs(loanProgress(data.startDate, data.dueDate).daysLeft || 0);
      const next = new Date();
      next.setDate(next.getDate() + 30);
      return {
        mode: "ready",
        title: "Cobrança de atraso · " + book,
        detail:
          days +
          (days === 1 ? " dia" : " dias") +
          " de atraso. Ao enviar, a cobrança fica registrada no seu nome e a próxima só poderá sair a partir de " +
          formatDate(next) +
          ".",
        actions: [
          ...(connected
            ? []
            : [{ label: "Cobrar pelo WhatsApp do celular", onClick: () => setPhoneCharge(data) }]),
          { label: "Só conversar, sem cobrança", onClick: dropCharge },
        ],
      };
    }
    return {
      mode: "blocked",
      title: "Cobrança de " + book + " não disponível",
      detail: chargeBlockReason(data),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrarId, loan, chargeOn, chargeDone, connected, chatId, otherPerson]);

  // Celular (uma coluna): ao voltar para a lista, o foco volta para a conversa
  // que estava aberta (senao fica no nada e o leitor de tela se perde).
  const lastOpenRef = useRef("");
  useEffect(() => {
    if (chatId) {
      lastOpenRef.current = chatId;
      return;
    }
    const id = lastOpenRef.current;
    lastOpenRef.current = "";
    if (id && window.matchMedia("(max-width: 859px)").matches) {
      requestAnimationFrame(() => document.querySelector('[data-chat-id="' + id + '"]')?.focus());
    }
  }, [chatId]);

  // ---------- nova conversa ----------
  const [newOpen, setNewOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  async function startWith(person) {
    if (opening) return;
    setOpening(true);
    try {
      const data = await api("/api/whatsapp/chats", {
        method: "POST",
        body: { personId: person._id },
      });
      setNewOpen(false);
      navigate("/conversas/" + data.chat._id);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setOpening(false);
    }
  }

  const showThread = Boolean(chatId);
  // Com o QR (ou o aviso de desconectado) na tela o cartao e alto: a pagina
  // rola normalmente em vez de caber numa altura fixa.
  const tallCard = ["qr", "idle", "logged-out", "wrong-number", "unreadable", "error"].includes(
    status?.state,
  );
  const empty = chats && chats.length === 0 && !term;

  return (
    <div
      className={
        "chatpage" + (showThread ? " is-thread" : "") + (tallCard ? " is-free" : "")
      }
    >
      <WhatsappConnect
        status={status}
        autoConnect
        onRetry={reload}
        onChange={(next) => setStatus((current) => ({ ...(current || {}), ...next }))}
      />

      <div className="chatpage__body">
        <aside className="chatlist" aria-label="Conversas">
          <div className="chatlist__head">
            <h1>Conversas</h1>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setNewOpen(true)}
            >
              <IconPlus width={16} height={16} aria-hidden="true" />
              Nova
            </button>
          </div>

          <div className="searchbar">
            <IconSearch width={18} height={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nome ou número"
              aria-label="Buscar conversa"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={80}
            />
          </div>

          <div className="chatlist__scroll">
            {chats === null && !listError ? (
              <p className="muted chatlist__state" role="status">
                Carregando as conversas
                <span className="loadingdots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </p>
            ) : null}

            {listError ? (
              <div className="chatlist__state" role="alert">
                <p>{listError}</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => loadList()}>
                  Tentar de novo
                </button>
              </div>
            ) : null}

            {empty ? (
              <div className="chatlist__state chatlist__empty">
                <IconChat width={30} height={30} aria-hidden="true" />
                <p>Nenhuma conversa ainda.</p>
                <p className="muted">
                  As mensagens que chegarem no WhatsApp da biblioteca aparecem aqui. Para
                  escrever primeiro, toque em “Nova”.
                </p>
              </div>
            ) : null}

            {chats && chats.length === 0 && term ? (
              <p className="muted chatlist__state">Nenhuma conversa com “{term}”.</p>
            ) : null}

            {chats && chats.length ? (
              <ul className="chatlist__items">
                {chats.map((chat) => (
                  <ChatRow key={chat._id} chat={chat} active={chat._id === chatId} />
                ))}
              </ul>
            ) : null}

            {hasMore && chats?.length ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm chatlist__more"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            ) : null}
          </div>
        </aside>

        <section className="chatmain" aria-label="Conversa aberta">
          {chatId && selected ? (
            <ChatThread
              key={chatId}
              chatId={chatId}
              chat={selected}
              connected={connected}
              draft={draft}
              onDraftChange={changeDraft}
              charge={charge}
              chargeLoanId={chargeReady ? loan.data._id : ""}
              onChargeSent={(updated) => {
                setChargeDone(updated);
                setLoan({ data: updated });
              }}
              onChargeRefused={(message, fresh, id) => {
                // A cobranca nao valeu (alguem cobrou antes, foi devolvido, ou o
                // envio ficou sem resposta): o texto pronto sai do campo, senao
                // um segundo toque o enviaria como mensagem comum e repetiria a cobranca.
                clearReadyText(id, loan?.data);
                if (fresh) setLoan({ data: fresh });
              }}
              onRead={handleRead}
              onChatChange={handleChatChange}
              onBack={() => {
                // Voltar de verdade (o botao Voltar do navegador nao reabre a
                // conversa); sem historico (endereco aberto direto), vai para a lista.
                if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
                else navigate("/conversas", { replace: true });
              }}
            />
          ) : chatId && chatError ? (
            <div className="chatmain__empty" role="alert">
              <p>{chatError}</p>
              <Link to="/conversas" className="btn btn--ghost">
                Voltar às conversas
              </Link>
            </div>
          ) : chatId ? (
            <div className="chatmain__empty" role="status">
              <p className="muted">
                Abrindo a conversa
                <span className="loadingdots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </p>
            </div>
          ) : cobrarId ? (
            <div className="chatmain__empty" role={openError ? "alert" : "status"}>
              {openError ? (
                <>
                  <p>{openError}</p>
                  <Link to="/emprestimos" className="btn btn--ghost">
                    Voltar aos empréstimos
                  </Link>
                </>
              ) : (
                <p className="muted">
                  Abrindo a conversa da cobrança
                  <span className="loadingdots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="chatmain__empty">
              <IconChat width={38} height={38} aria-hidden="true" />
              <p>Escolha uma conversa ao lado</p>
              <p className="muted">ou toque em “Nova” para escrever para alguém do cadastro.</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={newOpen}
        onClose={() => (opening ? undefined : setNewOpen(false))}
        title="Nova conversa"
        size="sm"
        placement="center"
        footer={
          <button type="button" className="btn btn--ghost" onClick={() => setNewOpen(false)} disabled={opening}>
            Cancelar
          </button>
        }
      >
        <p className="muted newchat__hint">
          Escolha alguém do cadastro que tenha WhatsApp. Só dá para escrever para quem está
          cadastrado.
        </p>
        <PersonPicker picked={null} onPick={startWith} onClear={() => {}} inputId="newchat-person" />
      </Modal>

      <ChargeModal
        loan={phoneCharge}
        onClose={() => setPhoneCharge(null)}
        onCharged={(updated, options) => {
          if (!options?.keepOpen) setPhoneCharge(null);
          setChargeDone(updated);
          setLoan({ data: updated });
        }}
        onRefused={(message, fresh) => {
          setPhoneCharge(null);
          notify(message, "error");
          if (fresh) setLoan({ data: fresh });
        }}
      />
    </div>
  );
}
