import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import Avatar from "./Avatar.jsx";
import { IconClose, IconWhatsapp } from "./Icons.jsx";
import { getToken, publicApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import { shortName } from "../utils/names.js";
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
 *
 * A lista do "E voce?" mostra so o PRIMEIRO E O SEGUNDO NOME, a foto e o
 * telefone mascarado ("+55 *******51") - o servidor nem manda o resto.
 *
 * ADMINISTRADOR: quem toca num nome da equipe (admin: true na busca) nao
 * passa pelo WhatsApp. A janela pede o login do painel (usuario e senha; se
 * este aparelho ja tem a sessao de um administrador, nem isso), o botao vira
 * "Confirmar" e, com o login certo, o app cria o link da solicitacao e vai
 * direto para o "Registrar solicitação" do painel, ja preenchido (o mesmo
 * caminho do link da mensagem: /solicitacao/<id>).
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

// Telefone mascarado do cartao ("+55 *******51"). (O hint e o texto do
// servidor ainda nao atualizado: "WhatsApp terminado em 51".)
function phoneLabel(person) {
  if (person.phone) return "Telefone: " + person.phone;
  return person.hint || "";
}

// O mesmo, para o leitor de tela (que leria "asterisco" sete vezes).
function PhoneText({ person }) {
  const label = phoneLabel(person);
  const last = String(person.phone || "").slice(-2);
  if (!person.phone || !/^\d\d$/.test(last)) return label;
  return (
    <>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{"Telefone terminado em " + last}</span>
    </>
  );
}

export default function RequestLoanModal({ book, open, onClose, onStale }) {
  const navigate = useNavigate();
  const { user, login, logout, refreshUser, switchToken } = useAuth();
  const [name, setName] = useState("");
  // Login do painel, quando a pessoa escolhida e da equipe.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameRef = useRef(null);
  // Entrando no painel ha um tempo: a tela explica a demora.
  const [slow, setSlow] = useState(false);
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
    // Fechou a janela (ou trocou de livro) sem chegar ao painel: a sessao que
    // o login daqui abriu termina junto (ver dropModalSession).
    dropModalSession();
    if (!open) return;
    setName(savedName());
    setPickupDate("");
    setWebsite("");
    setError("");
    setOfferWithoutLink(false);
    setDone(null);
    setResults(NO_RESULTS);
    setChoice(null);
    setUsername("");
    setPassword("");
    setHandoff(false);
  }, [open, book?.id]);

  // A sessao de administrador aberta pelo login DESTA janela so vale para ir
  // ao painel agora. Se a pessoa desiste (fecha, toca no "x", sai da tela)
  // ou o caminho para no meio, ela termina: o admin nao fica logado sem
  // saber num celular emprestado.
  // So mexe na sessao que e DELA: guarda o token que o login daqui recebeu.
  // Se o token guardado no aparelho ja e outro (alguem entrou no painel em
  // outra aba no meio do caminho), nao apaga nada - so confere quem esta
  // logado agora. E se o aparelho ja tinha um token antes deste login (o
  // painel ainda nao tinha confirmado a sessao, ex.: servidor acordando),
  // esse token antigo volta no lugar.
  // modalSessionRef = { mine, prior } | null
  const modalSessionRef = useRef(null);
  function dropModalSession() {
    const session = modalSessionRef.current;
    if (!session) return;
    modalSessionRef.current = null;
    if (getToken() !== session.mine) refreshUser();
    else if (session.prior) switchToken(session.prior);
    else logout();
  }
  useEffect(
    () => () => dropModalSession(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!sending) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [sending]);

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
  const finalName =
    choice?.type === "person" ? shortName(choice.person.name) : cleanName;
  // Tocou num nome da equipe: vai para o painel, sem WhatsApp.
  const asAdmin = choice?.type === "person" && choice.person.admin === true;
  // Este aparelho ja tem a sessao de um administrador: nao pede o login.
  const signedIn = user?.role === "admin";
  const needsLogin = asAdmin && !signedIn;

  function validate() {
    if (!choice && !cleanName.split(" ")[1]) {
      return "Digite o seu nome completo (nome e sobrenome).";
    }
    if (searching) return WAIT_MESSAGE;
    if (!choice && matches.length > 0) {
      return "Toque no seu nome na lista ou em “Não sou nenhuma dessas pessoas”.";
    }
    if (needsLogin && (!username.trim() || !password)) {
      return "Digite o seu usuário e a senha do painel.";
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
    // Ja havia sessao guardada no aparelho antes deste login?
    const priorToken = getToken();
    // Fixo para esta tentativa (a escolha pode mudar enquanto espera).
    const admin = asAdmin;
    const loginFirst = needsLogin;
    sendingRef.current = true;
    setSending(true);
    // A espera do WhatsApp (tela cheia) e so para quem vai pelo WhatsApp.
    clearTimeout(handoffTimer.current);
    setHandoff(!admin);
    setError("");
    setOfferWithoutLink(false);
    rememberName(finalName);
    try {
      if (loginFirst) {
        const signed = await login(username.trim(), password, {
          signal: controller.signal,
        });
        // A conta de manutencao nao registra solicitacao: sai dela.
        if (signed?.role !== "admin") {
          logout();
          throw new Error("Essa conta não é de administrador da biblioteca.");
        }
        modalSessionRef.current = { mine: getToken(), prior: priorToken };
        // Desistiu enquanto entrava: nao fica logado.
        if (attempt !== attemptRef.current) {
          dropModalSession();
          return;
        }
        setPassword("");
      }
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
      if (admin) {
        // Direto para o "Registrar solicitação" do painel, ja preenchido.
        // (Daqui em diante a sessao e do painel: nao termina com a janela.)
        modalSessionRef.current = null;
        navigate("/solicitacao/" + encodeURIComponent(data.token));
        return;
      }
      const text = buildRequestMessage({
        book,
        // Quem tocou num nome do cadastro: o primeiro e o segundo nome (o
        // servidor antigo ainda devolve o nome completo).
        name: choice?.type === "person" ? finalName : data.name || finalName,
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
      } else if (!admin && (err.status === 0 || err.status >= 500)) {
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
    dropModalSession();
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
            {/* Da equipe: "Confirmar" (vai para o painel). Os outros:
                "Combinar", com o simbolo do WhatsApp. */}
            <button
              type="submit"
              form="request-loan-form"
              className="btn btn--primary"
              disabled={sending}
            >
              {asAdmin ? (
                sending ? "Entrando…" : "Confirmar"
              ) : (
                <>
                  <IconWhatsapp width={18} height={18} />
                  {sending ? "Preparando…" : "Combinar"}
                </>
              )}
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
                  <Avatar src={choice.person.photo} name={finalName} size={40} decorative />
                  <div>
                    <strong title={finalName}>{finalName}</strong>
                    {/* (So o telefone: com "Você no cadastro ·" antes, ele
                        era cortado no celular.) */}
                    <small>
                      {phoneLabel(choice.person) ? (
                        <PhoneText person={choice.person} />
                      ) : (
                        "Você no cadastro da biblioteca"
                      )}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Não sou eu: digitar de novo"
                    onClick={() => {
                      // No meio do envio: desiste dele (senao a resposta
                      // ainda levaria ao painel com a escolha antiga).
                      // O foco vai para o campo do nome, que volta.
                      if (sendingRef.current) {
                        cancelSending();
                        setTimeout(() => document.getElementById("request-name")?.focus(), 0);
                      }
                      setName(finalName);
                      setChoice(null);
                      setPassword("");
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
                                // Da equipe sem sessao: o proximo campo e o
                                // usuario do painel.
                                const next =
                                  person.admin === true && !signedIn
                                    ? usernameRef
                                    : dateRef;
                                setTimeout(() => next.current?.focus(), 0);
                              }}
                            >
                              <Avatar
                                src={person.photo}
                                name={shortName(person.name)}
                                size={36}
                                decorative
                              />
                              <span>
                                <strong>{shortName(person.name)}</strong>
                                {phoneLabel(person) ? (
                                  <small>
                                    <PhoneText person={person} />
                                  </small>
                                ) : null}
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

            {asAdmin ? (
              signedIn ? (
                <p className="reqform__note">
                  Você já entrou no painel como{" "}
                  <strong>{shortName(user.name)}</strong>. Escolha o dia e toque
                  em “Confirmar” para registrar a solicitação.
                </p>
              ) : (
                <div
                  className="reqform__login"
                  role="group"
                  aria-labelledby="request-login-title"
                >
                  <p className="reqform__ask" id="request-login-title">
                    Você é da equipe da biblioteca: entre com o seu login do
                    painel para registrar a solicitação direto, sem WhatsApp.
                  </p>
                  <label className="field">
                    <span>Usuário</span>
                    <input
                      ref={usernameRef}
                      type="text"
                      name="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      autoComplete="username"
                      readOnly={sending}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={60}
                    />
                  </label>
                  <label className="field">
                    <span>Senha</span>
                    <input
                      type="password"
                      name="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      autoComplete="current-password"
                      readOnly={sending}
                      maxLength={200}
                    />
                  </label>
                </div>
              )
            ) : null}

            <label className="field">
              <span>Dia que você quer pegar o livro</span>
              <input
                ref={dateRef}
                type="date"
                value={pickupDate}
                min={today}
                max={lastDay}
                readOnly={sending}
                onChange={(e) => setPickupDate(e.target.value)}
                required
              />
              <small className="field__hint">
                {asAdmin
                  ? "Depois de entrar, você confere e registra a solicitação no painel."
                  : "Você combina a retirada com um dos nossos administradores pelo WhatsApp."}
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

            {asAdmin && sending ? (
              <p className="reqform__note" role="status">
                {slow
                  ? "O servidor está demorando para responder (pode levar até um minuto quando ninguém usou o site há um tempo). Para desistir, toque em “Voltar”."
                  : needsLogin
                    ? "Entrando no painel…"
                    : "Abrindo o painel…"}
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
