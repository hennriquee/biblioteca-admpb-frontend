import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { IconWhatsapp } from "./Icons.jsx";
import { publicApi } from "../api/client.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { addDaysInputValue, todayInputValue } from "../utils/dates.js";
import {
  buildRequestMessage,
  libraryWhatsappUrl,
  requestLinkUrl,
} from "../utils/whatsapp.js";

/**
 * "Solicitar empréstimo" do acervo publico (/catalogo): a pessoa digita o nome
 * completo e escolhe o dia em que quer pegar o livro; o app abre o WhatsApp da
 * biblioteca com a mensagem pronta.
 *
 * No fim da mensagem vai um LINK (/solicitacao/<id>) que o servidor cria
 * agora (POST /api/public/requests). Com ele, o administrador abre o painel
 * ja com o livro, o nome e o dia preenchidos - e a previa do link no WhatsApp
 * mostra a capa do livro. O link sozinho nao segura o livro: quem marca o
 * livro como "solicitado" e o administrador, depois de combinar a retirada.
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

// Abre o WhatsApp numa aba nova. Devolve false quando o navegador bloqueou
// (acontece quando a resposta do servidor demora): ai a tela mostra o botao.
function openWhatsapp(url) {
  const opened = window.open(url, "_blank");
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    /* nada a fazer */
  }
  return true;
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
  const sendingRef = useRef(false);

  const today = todayInputValue();
  const lastDay = addDaysInputValue(MAX_DAYS_AHEAD);

  useEffect(() => {
    if (!open) return;
    setName(savedName());
    setPickupDate("");
    setWebsite("");
    setError("");
    setOfferWithoutLink(false);
    setDone(null);
  }, [open, book?.id]);

  const cleanName = name.trim().replace(/\s+/g, " ");

  function validate() {
    if (!cleanName.split(" ")[1]) {
      return "Digite o seu nome completo (nome e sobrenome).";
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
    sendingRef.current = true;
    setSending(true);
    setError("");
    setOfferWithoutLink(false);
    rememberName(cleanName);
    try {
      const data = await publicApi("/api/public/requests", {
        method: "POST",
        body: { bookId: book.id, name: cleanName, pickupDate, website },
      });
      const url = libraryWhatsappUrl(
        buildRequestMessage({
          book,
          name: cleanName,
          pickupDate,
          link: requestLinkUrl(data.token),
        }),
      );
      setDone({ url, withLink: true });
      openWhatsapp(url);
    } catch (err) {
      setError(err.message || "Não foi possível preparar a solicitação.");
      if (err.status === 409) {
        // O livro acabou de sair: a ficha na tela esta velha.
        onStale?.(book.id);
      } else if (err.status === 0 || err.status >= 500) {
        setOfferWithoutLink(true);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  // Sem o link (servidor fora do ar): a mensagem sai do mesmo jeito, e a
  // equipe registra a solicitacao no painel, na mao. Abre direto no toque.
  function sendWithoutLink() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const url = libraryWhatsappUrl(
      buildRequestMessage({ book, name: cleanName, pickupDate, link: "" }),
    );
    setDone({ url, withLink: false });
    setError("");
    openWhatsapp(url);
  }

  const title = formatBookTitle(book?.title);

  return (
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

            <label className="field">
              <span>Seu nome completo</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Maria Eduarda Nogueira"
                autoComplete="name"
                autoCapitalize="words"
                maxLength={80}
                required
              />
            </label>

            <label className="field">
              <span>Dia que você quer pegar o livro</span>
              <input
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
  );
}
