import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { IconClose, IconUser, IconWhatsapp } from "./Icons.jsx";
import { publicApi } from "../api/client.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { addDaysInputValue, todayInputValue } from "../utils/dates.js";
import {
  buildRequestMessage,
  libraryWhatsappAppUrl,
  libraryWhatsappUrl,
  requestLinkUrl,
} from "../utils/whatsapp.js";

/**
 * "Solicitar empréstimo" do acervo publico (/catalogo): a pessoa digita o nome
 * completo e escolhe o dia em que quer pegar o livro; o app abre o WhatsApp da
 * biblioteca com a mensagem pronta.
 *
 * "E VOCE?": enquanto digita o nome, aparecem as pessoas do cadastro com esse
 * nome (busca apertada: ver GET /api/public/requests/people). A pessoa toca no
 * proprio nome ou em "Não sou nenhuma dessas pessoas" - ai a mensagem leva
 * "(novo cadastro)" depois do nome, para a equipe ja saber. Nome que a busca
 * nao acha NAO vira novo cadastro sozinho (a busca pode errar: a pessoa pode
 * ter digitado o nome de outro jeito); a tela oferece marcar, se for o caso.
 * Se a busca falhar ou demorar, a mensagem sai so com o nome digitado.
 *
 * No fim da mensagem vai um LINK (/solicitacao/<id>) que o servidor cria
 * agora (POST /api/public/requests). Com ele, o administrador abre o painel
 * ja com o livro, a pessoa (ou o nome) e o dia preenchidos - e a previa do
 * link no WhatsApp mostra a capa do livro. O link sozinho nao segura o livro:
 * quem marca o livro como "solicitado" e o administrador, depois de combinar
 * a retirada.
 *
 * Se o servidor nao responder, da para mandar a mensagem mesmo assim, sem o
 * link: a equipe registra a solicitacao na mao.
 */

// O dia de preferencia vai de hoje ate 60 dias (o servidor confere o mesmo).
const MAX_DAYS_AHEAD = 60;
// O nome fica guardado neste aparelho, para a proxima solicitacao.
const NAME_KEY = "biblioteca_admpb_nome_solicitacao";

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function rememberName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* sem armazenamento: so nao lembra da proxima vez */
  }
}

// Navegador de verdade no Android (nao o navegador embutido de outro app,
// que nao sabe abrir o endereco "whatsapp://").
function isAndroidBrowser() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return /Android/i.test(ua) && !/; wv\)/.test(ua);
}

// Abre o WhatsApp. Devolve false quando o navegador bloqueou (acontece quando
// a resposta do servidor demora): ai a tela mostra o botao.
//
// No Android, o endereco do proprio aplicativo (whatsapp://) abre o WhatsApp
// direto, sem passar por uma aba nova em branco (o "relance de tela branca"
// do wa.me). Sem o WhatsApp instalado nada acontece, e a tela de "Mensagem
// pronta" continua com o botao, que abre pelo wa.me. No computador e no
// iPhone continua a aba nova do wa.me.
function openWhatsapp(url, appUrl) {
  if (appUrl && isAndroidBrowser()) {
    try {
      window.location.href = appUrl;
      return true;
    } catch {
      /* segue pelo wa.me */
    }
  }
  const opened = window.open(url, "_blank");
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    /* nada a fazer */
  }
  return true;
}

// O nome ja da para procurar no cadastro? A mesma regra do servidor: nome
// com 3 letras ou mais e o comeco do sobrenome (2 letras ou mais), sem
// contar acento e pontuacao.
function searchable(name) {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return (
    words.length >= 2 &&
    words[0].length >= 3 &&
    words.slice(1).some((word) => word.length >= 2)
  );
}

const WAIT_MESSAGE =
  "Aguarde um instante: estamos procurando o seu nome no cadastro.";

// A busca do nome tem prazo: sem resposta, a pessoa segue so com o nome.
const SEARCH_TIMEOUT_MS = 6000;

function searchSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(SEARCH_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  return controller.signal;
}

const NO_RESULTS = { term: "", items: [], failed: false };

// Depois de mandar abrir o WhatsApp, a tela de espera fica no maximo isto
// (ou ate a pagina sair da frente, quando o WhatsApp abriu).
const HANDOFF_MAX_MS = 2500;

// Sem resposta do servidor em tanto tempo, desiste (o servidor gratuito pode
// levar perto de 1 minuto para acordar; a pessoa pode cancelar antes).
const SEND_TIMEOUT_MS = 75000;
// Depois disto esperando, a tela explica a demora.
const SLOW_AFTER_MS = 7000;

// Tela de espera por cima de tudo, com o fundo desfocado: do "Confirmar" ate
// o WhatsApp abrir. Cobre a troca de telas, para nada piscar. Enquanto o
// servidor nao responde, tem "Cancelar" (o foco vai para ele; Esc tambem
// fecha); depois de alguns segundos explica a demora.
function HandoffOverlay({ waiting, onCancel }) {
  const cancelRef = useRef(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting) return undefined;
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  useEffect(() => {
    if (waiting) cancelRef.current?.focus();
  }, [waiting]);

  function keepFocus(event) {
    // So um botao aqui: o Tab nao vai para a janela escondida atras.
    if (event.key === "Tab") {
      event.preventDefault();
      cancelRef.current?.focus();
    }
  }

  return createPortal(
    <div
      className="handoff"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="handoff-title"
      aria-describedby="handoff-text"
      data-modal-escape=""
      onKeyDown={keepFocus}
    >
      <div className="handoff__card">
        <span className="handoff__spin" aria-hidden="true" />
        <p id="handoff-title">
          <strong>Preparando a sua mensagem</strong>
          <span className="loadingdots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
        <p className="muted" id="handoff-text" role="status" aria-live="polite">
          {slow && waiting
            ? "O servidor está demorando para responder (pode levar até um minuto quando ninguém usou o site há um tempo)."
            : "O WhatsApp vai abrir em instantes."}
        </p>
        {waiting ? (
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--ghost handoff__cancel"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default function RequestLoanModal({ book, open, onClose, onStale }) {
  const [name, setName] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  // Campo-isca escondido (robo preenche, pessoa nao ve).
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Servidor fora do ar: oferece mandar sem o link.
  const [offerWithoutLink, setOfferWithoutLink] = useState(false);
  // Mensagem pronta: { url, withLink }.
  const [done, setDone] = useState(null);
  // Tela de espera (fundo desfocado) ligada: do "Confirmar" ao WhatsApp abrir.
  const [handoff, setHandoff] = useState(false);
  const handoffTimer = useRef(0);
  const sendingRef = useRef(false);
  // Cada "Confirmar" e uma tentativa. Fechar a janela, trocar de livro ou
  // tocar em "Cancelar" encerra a tentativa: a resposta que chegar depois
  // nao abre o WhatsApp nem mexe na tela.
  const attemptRef = useRef(0);
  const controllerRef = useRef(null);
  // Depois de escolher o nome, o foco vai para o dia (quem usa teclado segue
  // dali, em vez de voltar para o topo da janela).
  const dateRef = useRef(null);
  // Busca do nome no cadastro. results.term = o nome a que a busca responde.
  const [results, setResults] = useState(NO_RESULTS);
  // null = ainda nao escolheu | { type: "person", person } | { type: "new" }
  const [choice, setChoice] = useState(null);

  const today = todayInputValue();
  const lastDay = addDaysInputValue(MAX_DAYS_AHEAD);

  useEffect(() => {
    attemptRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    sendingRef.current = false;
    setSending(false);
    clearTimeout(handoffTimer.current);
    setHandoff(false);
    if (!open) return;
    setName(savedName());
    setPickupDate("");
    setWebsite("");
    setError("");
    setOfferWithoutLink(false);
    setDone(null);
    setResults(NO_RESULTS);
    setChoice(null);
    setHandoff(false);
  }, [open, book?.id]);

  // A tela de espera sai quando a pagina deixa a frente (o WhatsApp abriu),
  // ou no tempo maximo, ou se a janela fechar.
  useEffect(() => {
    if (!handoff) return undefined;
    function onHidden() {
      // Ainda esperando o servidor: a espera (com o "Cancelar") continua para
      // quando a pessoa voltar. So sai quando o WhatsApp ja foi chamado.
      if (document.visibilityState === "hidden" && !sendingRef.current) setHandoff(false);
    }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, [handoff]);

  useEffect(() => () => clearTimeout(handoffTimer.current), []);

  // Mandou abrir o WhatsApp: a espera continua so mais um pouco.
  function endHandoffSoon() {
    clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => setHandoff(false), HANDOFF_MAX_MS);
  }

  const cleanName = name.trim().replace(/\s+/g, " ");
  const canSearch = searchable(cleanName);
  const answered = canSearch && results.term === cleanName;
  const searching = canSearch && !answered && !choice;
  const matches = answered && !results.failed ? results.items : [];
  // Nome que a busca respondeu e nao achou no cadastro.
  const notFound = answered && !results.failed && results.items.length === 0;

  // Procura enquanto digita (com uma pausa, para nao buscar a cada letra).
  useEffect(() => {
    if (!open || done || choice || !canSearch) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await publicApi(
          "/api/public/requests/people?name=" + encodeURIComponent(cleanName),
          { signal: searchSignal() },
        );
        if (active) {
          setResults({ term: cleanName, items: data.people || [], failed: false });
          setError((current) => (current === WAIT_MESSAGE ? "" : current));
        }
      } catch {
        // Sem a busca, a mensagem sai so com o nome digitado.
        if (active) {
          setResults({ term: cleanName, items: [], failed: true });
          setError((current) => (current === WAIT_MESSAGE ? "" : current));
        }
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, done, choice, canSearch, cleanName]);

  // "(novo cadastro)" so quando a pessoa diz que nao esta no cadastro.
  const isNew = choice?.type === "new";
  const finalName = choice?.type === "person" ? choice.person.name : cleanName;

  function validate() {
    if (!choice && !cleanName.split(" ")[1]) {
      return "Digite o seu nome completo (nome e sobrenome).";
    }
    if (searching) return WAIT_MESSAGE;
    if (!choice && matches.length > 0) {
      return "Toque no seu nome na lista ou em “Não sou nenhuma dessas pessoas”.";
    }
    if (!pickupDate) return "Escolha o dia em que quer pegar o livro.";
    if (pickupDate < today || pickupDate > lastDay) {
      return (
        "Escolha um dia entre hoje e " +
        lastDay.split("-").reverse().join("/") +
        "."
      );
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (sendingRef.current) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const attempt = ++attemptRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    sendingRef.current = true;
    setSending(true);
    clearTimeout(handoffTimer.current);
    setHandoff(true);
    setError("");
    setOfferWithoutLink(false);
    rememberName(finalName);
    try {
      const data = await publicApi("/api/public/requests", {
        method: "POST",
        signal: controller.signal,
        body: {
          bookId: book.id,
          name: finalName,
          pickupDate,
          website,
          personRef: choice?.type === "person" ? choice.person.ref : undefined,
          newPerson: isNew,
        },
      });
      // A pessoa cancelou ou fechou a janela enquanto esperava.
      if (attempt !== attemptRef.current) return;
      const text = buildRequestMessage({
        book,
        name: data.name || finalName,
        isNew,
        pickupDate,
        link: requestLinkUrl(data.token),
      });
      const url = libraryWhatsappUrl(text);
      setDone({ url, withLink: true });
      // A pessoa saiu do site enquanto esperava: nao abre nada sozinho (ela
      // volta para a "Mensagem pronta", com o botao).
      if (document.visibilityState === "hidden") setHandoff(false);
      else if (openWhatsapp(url, libraryWhatsappAppUrl(text))) endHandoffSoon();
      else setHandoff(false);
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      setHandoff(false);
      setError(
        controller.signal.aborted
          ? "O servidor não respondeu a tempo. Tente de novo em instantes."
          : err.message || "Não foi possível preparar a solicitação.",
      );
      if (err.payload?.code === "PERSON_GONE") {
        // O nome escolhido saiu do cadastro: escolhe de novo.
        setChoice(null);
        setResults(NO_RESULTS);
      } else if (err.status === 409) {
        // O livro acabou de sair: a ficha na tela esta velha.
        onStale?.(book.id);
      } else if (err.status === 0 || err.status >= 500) {
        setOfferWithoutLink(true);
      }
    } finally {
      clearTimeout(timeout);
      if (attempt === attemptRef.current) {
        controllerRef.current = null;
        sendingRef.current = false;
        setSending(false);
      }
    }
  }

  // "Cancelar" na tela de espera: desiste deste envio e volta para a janela,
  // com tudo preenchido, para tentar de novo.
  function cancelSending() {
    attemptRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    sendingRef.current = false;
    setSending(false);
    clearTimeout(handoffTimer.current);
    setHandoff(false);
    // O foco volta para o "Confirmar" (estava na espera, que saiu).
    setTimeout(() => {
      document.querySelector('button[form="request-loan-form"]')?.focus();
    }, 0);
  }

  // Sem o link (servidor fora do ar): a mensagem sai do mesmo jeito, e a
  // equipe registra a solicitacao no painel, na mao. Abre direto no toque.
  function sendWithoutLink() {
    if (!finalName.split(" ")[1]) {
      setError("Digite o seu nome completo (nome e sobrenome).");
      return;
    }
    if (!pickupDate || pickupDate < today || pickupDate > lastDay) {
      setError("Escolha o dia em que quer pegar o livro.");
      return;
    }
    const text = buildRequestMessage({ book, name: finalName, isNew, pickupDate, link: "" });
    const url = libraryWhatsappUrl(text);
    setDone({ url, withLink: false });
    setError("");
    if (openWhatsapp(url, libraryWhatsappAppUrl(text))) {
      setHandoff(true);
      endHandoffSoon();
    }
  }

  function typeName(value) {
    setName(value);
    setChoice(null);
    setError("");
  }

  const title = formatBookTitle(book?.title);

  return (
    <>
    <Modal
      open={open && Boolean(book)}
      onClose={onClose}
      title={done ? "Mensagem pronta" : "Solicitar empréstimo"}
      size="sm"
      footer={
        done ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Fechar
            </button>
            <a
              className="btn btn--primary"
              href={done.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconWhatsapp width={18} height={18} />
              Abrir o WhatsApp
            </a>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Voltar
            </button>
            <button
              type="submit"
              form="request-loan-form"
              className="btn btn--primary"
              disabled={sending}
            >
              <IconWhatsapp width={18} height={18} />
              {sending ? "Preparando…" : "Confirmar"}
            </button>
          </>
        )
      }
    >
      {book ? (
        done ? (
          <div className="reqdone" role="status">
            <p>
              Sua mensagem para a biblioteca está pronta no WhatsApp. É só
              enviar para combinar a retirada de <strong>{title}</strong> com
              um dos nossos administradores.
            </p>
            <p className="muted">
              {done.withLink
                ? "Se o WhatsApp não abriu sozinho, toque em “Abrir o WhatsApp”. Não apague o link do fim da mensagem: ele ajuda a equipe a registrar o seu pedido."
                : "Se o WhatsApp não abriu sozinho, toque em “Abrir o WhatsApp”."}
            </p>
          </div>
        ) : (
          <form
            id="request-loan-form"
            className="reqform"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="picked reqform__book">
              <BookCover src={book.cover} alt="" className="cover--xs" />
              <div>
                <strong title={title}>{title}</strong>
                <small>
                  {(book.authors || []).join(", ") || "Autor não informado"}
                </small>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="request-name">
                Seu nome completo
              </label>
              {choice?.type === "person" ? (
                // Tocou no proprio nome: ele fica marcado (o "x" volta a
                // digitar).
                <div className="picked reqform__me">
                  <span className="reqform__meicon" aria-hidden="true">
                    <IconUser width={18} height={18} />
                  </span>
                  <div>
                    <strong title={choice.person.name}>{choice.person.name}</strong>
                    <small>
                      {choice.person.hint
                        ? "Você no cadastro · " + choice.person.hint
                        : "Você no cadastro da biblioteca"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Não sou eu: digitar de novo"
                    onClick={() => {
                      setName(choice.person.name);
                      setChoice(null);
                    }}
                  >
                    <IconClose width={18} height={18} />
                  </button>
                </div>
              ) : (
                <div className="combo">
                  <input
                    id="request-name"
                    type="text"
                    value={name}
                    onChange={(e) => typeName(e.target.value)}
                    placeholder="Ex.: Maria Eduarda Nogueira"
                    autoComplete="name"
                    autoCapitalize="words"
                    maxLength={80}
                    required
                  />

                  {searching ? (
                    <p className="combo__wait" role="status">
                      Procurando o seu nome no cadastro…
                    </p>
                  ) : null}

                  {!choice && matches.length > 0 ? (
                    <div className="reqform__who">
                      <p className="reqform__ask">É você? Toque no seu nome:</p>
                      <ul className="combo__list">
                        {matches.map((person) => (
                          <li key={person.ref}>
                            <button
                              type="button"
                              className="combo__item"
                              onClick={() => {
                                setChoice({ type: "person", person });
                                setError("");
                                setTimeout(() => dateRef.current?.focus(), 0);
                              }}
                            >
                              <span className="reqform__meicon" aria-hidden="true">
                                <IconUser width={16} height={16} />
                              </span>
                              <span>
                                <strong>{person.name}</strong>
                                {person.hint ? <small>{person.hint}</small> : null}
                              </span>
                            </button>
                          </li>
                        ))}
                        <li>
                          <button
                            type="button"
                            className="combo__item combo__item--create"
                            onClick={() => {
                              setChoice({ type: "new" });
                              setError("");
                              setTimeout(() => dateRef.current?.focus(), 0);
                            }}
                          >
                            <span>
                              <strong>Não sou nenhuma dessas pessoas</strong>
                              <small>A equipe faz o seu cadastro</small>
                            </span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  ) : null}

                  {choice?.type === "new" ? (
                    <p className="reqform__note">
                      Combinado: a equipe faz o seu cadastro.{" "}
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setChoice(null)}
                      >
                        Ver a lista de novo
                      </button>
                    </p>
                  ) : null}

                  {!choice && notFound ? (
                    <p className="reqform__note">
                      Não achamos esse nome no cadastro. Se você ainda não tem
                      cadastro na biblioteca,{" "}
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => {
                          setChoice({ type: "new" });
                          setError("");
                          setTimeout(() => dateRef.current?.focus(), 0);
                        }}
                      >
                        marque como novo cadastro
                      </button>
                      .
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <label className="field">
              <span>Dia que você quer pegar o livro</span>
              <input
                ref={dateRef}
                type="date"
                value={pickupDate}
                min={today}
                max={lastDay}
                onChange={(e) => setPickupDate(e.target.value)}
                required
              />
              <small className="field__hint">
                Você combina a retirada com um dos nossos administradores pelo
                WhatsApp.
              </small>
            </label>

            {/* Campo-isca: fora da tela e fora do Tab. */}
            <input
              className="reqform__trap"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            {offerWithoutLink ? (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={sendWithoutLink}
              >
                <IconWhatsapp width={18} height={18} />
                Mandar a mensagem mesmo assim
              </button>
            ) : null}
          </form>
        )
      ) : null}
    </Modal>
    {handoff && open ? (
      <HandoffOverlay waiting={sending} onCancel={cancelSending} />
    ) : null}
    </>
  );
}
