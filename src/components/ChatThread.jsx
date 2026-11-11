import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import Avatar from "./Avatar.jsx";
import { useToast } from "./Toast.jsx";
import { IconChevronLeft, IconSend } from "./Icons.jsx";
import { dayKey, dayLabel, formatClock } from "../utils/chatTime.js";
import { formatStoredPhone } from "../utils/whatsapp.js";

/**
 * A conversa aberta: cabecalho, mensagens e o campo para escrever.
 *
 * - As mensagens chegam por consulta a cada 3 s (so com a aba visivel): a
 *   primeira vez as ultimas 50; depois so o que mudou (mensagem nova, entrega,
 *   leitura, edicao), com a hora do SERVIDOR (nao depende do relogio do
 *   aparelho).
 * - Abrir a conversa (e receber mensagem com ela aberta) marca como lida.
 * - Tudo que chega de fora e mostrado como TEXTO puro (nunca HTML).
 * - Enviar: a mensagem so aparece depois que o servidor confirma que saiu.
 *   Se der erro, o texto fica no campo.
 *
 * Props:
 * - chatId, chat (resumo para o cabecalho), connected (WhatsApp conectado)
 * - draft / onDraftChange(idDaConversa, texto): o rascunho vive na pagina, um
 *   por conversa, para nao se perder ao trocar
 * - charge: { mode: "ready"|"blocked"|"done", title, detail, actions } ou null.
 *   "ready" = o que for enviado agora e a cobranca de atraso
 * - chargeLoanId: id do emprestimo, enviado junto quando e cobranca
 * - onChargeSent(emprestimo) / onChargeRefused(mensagem, emprestimo|null, idDaConversa)
 * - onRead(chatId), onBack()
 * - onChatChange(conversa): o servidor devolveu a conversa atualizada (quem
 *   atende: o robo ou um administrador)
 *
 * ATENDIMENTO: a faixa em cima do campo diz se o atendimento automatico (o
 * robo do menu) esta respondendo nesta conversa. Responder por aqui pausa o
 * robo; "Devolver ao atendimento automatico" o liga de novo.
 */

const KIND_LABEL = {
  image: "Foto",
  video: "Vídeo",
  audio: "Áudio",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contact: "Contato",
  poll: "Enquete",
  other: "Mensagem sem texto",
};

const POLL_MS = 3000;
// A consulta seguinte pede um pouco antes: cobre gravacoes que estavam em curso.
const SINCE_MARGIN_MS = 2500;
const MAX_TEXT = 4096;

function mergeMessages(current, incoming) {
  const byId = new Map((current || []).map((message) => [message._id, message]));
  for (const message of incoming) byId.set(message._id, message);
  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.at) - new Date(b.at) || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0),
  );
}

function sinceFrom(serverNow) {
  const time = Date.parse(serverNow);
  return Number.isNaN(time) ? "" : new Date(time - SINCE_MARGIN_MS).toISOString();
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

// Quem mandou as mensagens do proprio sistema.
const AUTO_LABEL = {
  bot: "Atendimento automático",
  overdue: "Aviso de atraso",
  handoff: "Aviso ao administrador",
};

// *negrito* do WhatsApp, como no celular. So vira <strong> (elemento do
// React, nunca HTML): o resto do texto continua texto puro.
function RichText({ text }) {
  // Como no WhatsApp: o asterisco de abrir e o de fechar ficam colados no
  // texto ("*1*", "*Dom Casmurro*"); "2 * 3" continua texto comum.
  const parts = String(text).split(/(\*[^\s*](?:[^*\n]*[^\s*])?\*)/g);
  return parts.map((part, index) =>
    /^\*[^\s*](?:[^*\n]*[^\s*])?\*$/.test(part) ? (
      <strong key={index}>{part.slice(1, -1)}</strong>
    ) : (
      part
    ),
  );
}

function Ticks({ status, errorCode }) {
  if (status === 0) {
    return (
      <span
        className="msg__ticks msg__ticks--err"
        role="img"
        aria-label="Não entregue: o WhatsApp recusou a mensagem"
        title={"O WhatsApp recusou esta mensagem" + (errorCode ? " (código " + errorCode + ")" : "") + ". Ela não chegou à pessoa."}
      >
        ! não entregue
      </span>
    );
  }
  if (status >= 4) {
    return (
      <span className="msg__ticks msg__ticks--read" role="img" aria-label="Lida">
        ✓✓
      </span>
    );
  }
  if (status === 3) {
    return (
      <span className="msg__ticks" role="img" aria-label="Entregue">
        ✓✓
      </span>
    );
  }
  return (
    <span className="msg__ticks" role="img" aria-label="Enviada">
      ✓
    </span>
  );
}

function Message({ message }) {
  const mine = message.fromMe;
  const label = KIND_LABEL[message.kind];
  return (
    <div className={"msg " + (mine ? "msg--me" : "msg--them")}>
      <div
        className={
          "msg__bubble" +
          (message.charge ? " msg__bubble--charge" : "") +
          (message.auto ? " msg__bubble--auto" : "")
        }
      >
        {message.deleted ? (
          <em className="msg__deleted">Mensagem apagada</em>
        ) : (
          <>
            {label ? <span className="msg__kind">{label}</span> : null}
            {message.text ? (
              <span className="msg__text">
                <RichText text={message.text} />
              </span>
            ) : null}
            {label ? (
              <small className="msg__hint">Abra no celular para ver.</small>
            ) : null}
          </>
        )}
        <span className="msg__meta">
          {message.charge ? <b>Cobrança · </b> : null}
          {mine
            ? (AUTO_LABEL[message.auto] ||
                (message.sentByName ? firstName(message.sentByName) : "pelo celular")) + " · "
            : ""}
          {formatClock(message.at)}
          {message.edited && !message.deleted ? " · editada" : ""}
          {mine && !message.deleted ? (
            <Ticks status={message.status} errorCode={message.errorCode} />
          ) : null}
        </span>
      </div>
    </div>
  );
}

export default function ChatThread({
  chatId,
  chat,
  connected,
  draft,
  onDraftChange,
  charge,
  chargeLoanId,
  onChargeSent,
  onChargeRefused,
  onRead,
  onBack,
  onChatChange,
}) {
  const { notify } = useToast();
  const [switching, setSwitching] = useState(false);
  // null = carregando
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [newBelow, setNewBelow] = useState(0);

  const sinceRef = useRef("");
  const scrollerRef = useRef(null);
  const fieldRef = useRef(null);
  const stickRef = useRef(true);
  const scrolledFor = useRef(null);
  const lastIdRef = useRef(null);
  const prependRef = useRef(null);
  const sendingRef = useRef(false);
  const sectionRef = useRef(null);
  const readingRef = useRef(false);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const messagesRef = useRef(null);

  const loaded = messages !== null;
  messagesRef.current = messages;

  // Celular (uma coluna): a lista some ao abrir a conversa e o foco do teclado
  // ficaria no nada; vai para a conversa (o leitor de tela a anuncia).
  useEffect(() => {
    if (window.matchMedia("(max-width: 859px)").matches) {
      sectionRef.current?.focus({ preventScroll: true });
    }
  }, [chatId]);

  // ---------- carregar ----------
  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    setHasMore(false);
    setLoadError("");
    setNewBelow(0);
    stickRef.current = true;
    scrolledFor.current = null;
    lastIdRef.current = null;
    sinceRef.current = "";
    (async () => {
      try {
        const data = await api("/api/whatsapp/chats/" + chatId + "/messages?limit=50");
        if (cancelled) return;
        sinceRef.current = sinceFrom(data.now);
        setHasMore(data.hasMore);
        setMessages(data.messages);
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, reloadKey]);

  const markRead = useCallback(async () => {
    if (readingRef.current) return;
    readingRef.current = true;
    const id = chatIdRef.current;
    try {
      await api("/api/whatsapp/chats/" + id + "/read", { method: "POST" });
      if (chatIdRef.current === id) onReadRef.current?.(id);
    } catch {
      /* tenta de novo na proxima mensagem */
    } finally {
      readingRef.current = false;
    }
  }, []);

  // Abriu a conversa com mensagens nao lidas (ou elas chegaram com ela aberta).
  const unread = chat?.unread || 0;
  useEffect(() => {
    if (loaded && unread > 0 && document.visibilityState === "visible") markRead();
  }, [loaded, unread, markRead, chatId]);

  // ---------- novidades ----------
  useEffect(() => {
    if (!loaded) return undefined;
    let cancelled = false;
    let busy = false;
    async function poll() {
      if (busy || document.visibilityState !== "visible" || !sinceRef.current) return;
      busy = true;
      try {
        const data = await api(
          "/api/whatsapp/chats/" + chatId + "/messages?since=" + encodeURIComponent(sinceRef.current),
        );
        if (cancelled) return;
        sinceRef.current = sinceFrom(data.now) || sinceRef.current;
        if (data.messages.length) {
          const known = new Set((messagesRef.current || []).map((m) => m._id));
          const arrived = data.messages.some((m) => !m.fromMe && !known.has(m._id));
          setMessages((current) => mergeMessages(current, data.messages));
          if (arrived) markRead();
        }
      } catch {
        /* sem rede por um instante: a proxima tentativa resolve */
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [chatId, loaded, markRead]);

  // ---------- rolagem ----------
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !messages) return;
    const last = messages[messages.length - 1];
    if (scrolledFor.current !== chatId) {
      scrolledFor.current = chatId;
      lastIdRef.current = last?._id || null;
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    if (prependRef.current) {
      // Mensagens antigas entraram em cima: a tela fica onde estava.
      const { height, top } = prependRef.current;
      prependRef.current = null;
      scroller.scrollTop = scroller.scrollHeight - height + top;
      return;
    }
    if (last && last._id !== lastIdRef.current) {
      lastIdRef.current = last._id;
      if (stickRef.current || last.fromMe) {
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        setNewBelow((count) => count + 1);
      }
    }
  }, [messages, chatId]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const near = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    stickRef.current = near;
    if (near) setNewBelow(0);
  }

  function goToEnd() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    stickRef.current = true;
    setNewBelow(0);
  }

  async function loadOlder() {
    const first = messages?.[0];
    const scroller = scrollerRef.current;
    if (!first || !scroller || loadingOlder) return;
    setLoadingOlder(true);
    prependRef.current = { height: scroller.scrollHeight, top: scroller.scrollTop };
    try {
      const data = await api(
        "/api/whatsapp/chats/" +
          chatId +
          "/messages?limit=50&before=" +
          encodeURIComponent(first.at),
      );
      if (chatIdRef.current !== chatId) return;
      setHasMore(data.hasMore);
      setMessages((current) => mergeMessages(current, data.messages));
    } catch (error) {
      prependRef.current = null;
      notify(error.message, "error");
    } finally {
      setLoadingOlder(false);
    }
  }

  // ---------- escrever ----------
  // O campo cresce com o texto (ate uns 6 linhas) e depois rola.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 150) + "px";
  }, [draft, chatId]);

  async function send() {
    const text = draft.trim();
    if (!text || sendingRef.current || !connected) return;
    sendingRef.current = true;
    setSending(true);
    const id = chatId;
    try {
      const result = await api("/api/whatsapp/chats/" + id + "/messages", {
        method: "POST",
        body: { text, ...(chargeLoanId ? { chargeLoanId } : {}) },
      });
      // (Se a pessoa trocou de conversa no meio, esta tela ja foi desmontada: a
      // mensagem saiu mesmo assim, e o rascunho e limpo SO da conversa que enviou.)
      setMessages((current) => mergeMessages(current, [result.message]));
      onDraftChange(id, "");
      if (result.chat) onChatChange?.(result.chat);
      if (result.loan) onChargeSent?.(result.loan);
      requestAnimationFrame(() => fieldRef.current?.focus());
    } catch (error) {
      notify(error.message, "error");
      // Cobranca que nao valeu (ou que ficou sem resposta): a pagina atualiza o
      // emprestimo e tira o texto pronto do campo.
      if (error.payload?.loan) onChargeRefused?.(error.message, error.payload.loan, id);
      else if (error.status === 409 && chargeLoanId) onChargeRefused?.(error.message, null, id);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  // Quem atende: "human" (o administrador assume) ou "bot" (devolve ao robo).
  async function setAttendance(mode) {
    if (switching) return;
    setSwitching(true);
    const id = chatId;
    try {
      const result = await api("/api/whatsapp/chats/" + id + "/attendance", {
        method: "POST",
        body: { mode },
      });
      onChatChange?.(result.chat);
      notify(
        mode === "bot"
          ? "O atendimento automático voltou a responder nesta conversa."
          : "Atendimento assumido: o robô não responde nesta conversa.",
        "success",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSwitching(false);
    }
  }

  function onKeyDown(event) {
    // No computador, Enter envia e Shift+Enter quebra a linha. No celular o
    // Enter sempre quebra a linha (o botao envia).
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      window.matchMedia("(pointer: fine)").matches
    ) {
      event.preventDefault();
      send();
    }
  }

  const name = chat?.person?.fullName || chat?.pushName || "";
  const phone = chat?.phone ? formatStoredPhone(chat.phone) : "";
  const title = name || phone || "Número oculto";
  const attendance = chat?.attendance || null;

  let lastDay = "";
  return (
    <section className="chat" aria-label={"Conversa com " + title} ref={sectionRef} tabIndex={-1}>
      <header className="chathead">
        <button type="button" className="icon-button chathead__back" onClick={onBack}>
          <IconChevronLeft width={20} height={20} />
          <span className="sr-only">Voltar</span>
        </button>
        <Avatar src={chat?.person?.photo} name={title} size={40} decorative />
        <div className="chathead__who">
          <strong>{title}</strong>
          <small>
            {name && phone ? <span className="nowrap">{phone}</span> : null}
            {chat?.person?.code ? " · cadastro #" + chat.person.code : chat ? " · fora do cadastro" : ""}
            {chat?.shared ? " · número de mais " + chat.shared + " pessoa(s)" : ""}
          </small>
        </div>
      </header>

      <div className="chat__viewport">
      <div
        className="chat__scroller"
        ref={scrollerRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Histórico da conversa (use as setas para rolar)"
      >
        {!loaded && !loadError ? (
          <p className="muted chat__state" role="status">
            Carregando a conversa
            <span className="loadingdots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : null}

        {loadError ? (
          <div className="chat__state" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setReloadKey((n) => n + 1)}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {loaded && hasMore ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm chat__older"
            onClick={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Carregando…" : "Ver mensagens anteriores"}
          </button>
        ) : null}

        {loaded && messages.length === 0 ? (
          <p className="muted chat__state">
            Ainda não há mensagens nesta conversa. Escreva abaixo para começar.
          </p>
        ) : null}

        {loaded && messages.length ? (
          <ol className="chat__list" role="log" aria-live="polite" aria-label="Mensagens">
            {messages.map((message) => {
              const key = dayKey(message.at);
              const showDay = key !== lastDay;
              lastDay = key;
              return (
                <li key={message._id} className="chat__item">
                  {showDay ? (
                    <div className="chat__day">
                      <span>{dayLabel(message.at)}</span>
                    </div>
                  ) : null}
                  <Message message={message} />
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>

      {newBelow > 0 ? (
        <button type="button" className="chat__newbelow" onClick={goToEnd}>
          {newBelow === 1 ? "1 mensagem nova" : newBelow + " mensagens novas"} ↓
        </button>
      ) : null}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        {attendance ? (
          <div
            className={
              "attbar" +
              (attendance.waiting || attendance.muted
                ? " attbar--waiting"
                : attendance.mode === "human"
                  ? " attbar--human"
                  : "")
            }
            role="status"
          >
            <span className="attbar__text">
              {attendance.waiting ? (
                <>
                  <strong>Pediu para falar com um administrador</strong>
                  <span>O robô está pausado. Responda por aqui.</span>
                </>
              ) : attendance.mode === "human" ? (
                <>
                  <strong>Atendimento por administrador</strong>
                  <span>O robô está pausado nesta conversa.</span>
                </>
              ) : attendance.muted ? (
                <>
                  <strong>Atendimento automático silenciado</strong>
                  <span>Muitas mensagens seguidas nesta conversa. Responda por aqui ou devolva ao robô.</span>
                </>
              ) : (
                <>
                  <strong>Atendimento automático ativo</strong>
                  <span>O robô responde com o menu. Ao responder por aqui, ele pausa.</span>
                </>
              )}
            </span>
            <button
              type="button"
              className="linkish attbar__action"
              onClick={() =>
                setAttendance(attendance.mode === "human" || attendance.muted ? "bot" : "human")
              }
              disabled={switching}
            >
              {attendance.mode === "human" || attendance.muted
                ? "Devolver ao atendimento automático"
                : "Assumir atendimento"}
            </button>
          </div>
        ) : null}

        {charge ? (
          <div
            className={"chargebar chargebar--" + charge.mode}
            role={charge.mode === "blocked" ? "status" : "region"}
            aria-label="Cobrança de atraso"
          >
            <div className="chargebar__text">
              <strong>{charge.title}</strong>
              {charge.detail ? <span>{charge.detail}</span> : null}
            </div>
            {charge.actions?.length ? (
              <div className="chargebar__actions">
                {charge.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="linkish"
                    onClick={action.onClick}
                    disabled={sending}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!connected ? (
          <p className="composer__off" role="status">
            O WhatsApp da biblioteca não está conectado agora: não dá para enviar.
          </p>
        ) : null}

        <div className="composer__row">
          <textarea
            ref={fieldRef}
            className="composer__field"
            rows={1}
            maxLength={MAX_TEXT}
            value={draft}
            onChange={(event) => onDraftChange(chatId, event.target.value)}
            onKeyDown={onKeyDown}
            // "readOnly" e nao "disabled": um campo desligado perde o foco do
            // teclado quando o WhatsApp reconecta e ele volta a ligar.
            readOnly={sending || !connected}
            aria-disabled={!connected}
            placeholder={connected ? "Escreva uma mensagem" : "WhatsApp desconectado"}
            aria-label={"Mensagem para " + title}
            enterKeyHint="enter"
          />
          <button
            type="submit"
            className="btn btn--whatsapp composer__send"
            disabled={!draft.trim() || !connected || sending}
          >
            <IconSend width={19} height={19} aria-hidden="true" />
            <span className="sr-only">{sending ? "Enviando" : "Enviar"}</span>
          </button>
        </div>
        {draft.length > MAX_TEXT - 500 ? (
          <small className="composer__count" aria-live="polite">
            {draft.length} / {MAX_TEXT}
          </small>
        ) : null}
      </form>
    </section>
  );
}
