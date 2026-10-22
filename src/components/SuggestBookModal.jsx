import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import CoverPicker from "./CoverPicker.jsx";
import { useToast } from "./Toast.jsx";
import { publicApi } from "../api/client.js";

/**
 * "Sugerir um livro" (menu Participe do acervo publico): uma fichinha com
 * titulo e autor (obrigatorios) e, se a pessoa quiser, a foto da capa -
 * tirada na hora ou da galeria, com o mesmo recorte das capas do painel.
 *
 * Antes de enviar, uma confirmacao mostra o que vai ser sugerido. Fechar a
 * confirmacao ("Voltar") devolve a ficha como estava, para corrigir.
 *
 * O servidor tem limites contra abuso (ver backend/src/routes/suggestions.js);
 * quando um deles barra, a mensagem dele aparece na confirmacao. O envio tem
 * prazo (SEND_TIMEOUT_MS) e pode ser cancelado no "Voltar", no "x" ou no Esc:
 * a pessoa nunca fica presa esperando um servidor que nao responde.
 *
 * onSent(): sugestao recebida - quem abriu fecha o menu e agradece.
 */

const EMPTY = { title: "", author: "", photo: "", website: "" };

// Sem os caracteres invisiveis (o servidor tambem os tira) e sem espacos
// sobrando.
const clean = (text) => text.replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim();

// Prazo do envio. O servidor gratuito pode levar quase um minuto para acordar.
const SEND_TIMEOUT_MS = 60 * 1000;

export default function SuggestBookModal({ open, onClose, onSent }) {
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // Envio em andamento: { controller, timedOut } (para cancelar ou estourar o prazo).
  const sendRef = useRef(null);
  useEffect(() => () => sendRef.current?.controller.abort(), []);

  // A ficha e limpa ao FECHAR, para a proxima abertura ja comecar em branco
  // (limpando ao abrir, o rascunho anterior aparecia por um instante).
  useEffect(() => {
    if (open) return;
    sendRef.current?.controller.abort();
    setForm(EMPTY);
    setFormError("");
    setConfirming(false);
    setSending(false);
    setSendError("");
  }, [open]);

  function review() {
    const title = clean(form.title);
    const author = clean(form.author);
    if (title.length < 2) {
      setFormError("Informe o título do livro.");
      return;
    }
    if (author.length < 2) {
      setFormError("Informe o autor do livro.");
      return;
    }
    setFormError("");
    setSendError("");
    setForm((f) => ({ ...f, title, author }));
    setConfirming(true);
  }

  async function send() {
    if (sending) return;
    setSending(true);
    setSendError("");
    const attempt = { controller: new AbortController(), timedOut: false };
    sendRef.current = attempt;
    const timer = setTimeout(() => {
      attempt.timedOut = true;
      attempt.controller.abort();
    }, SEND_TIMEOUT_MS);
    try {
      const result = await publicApi("/api/public/suggestions", {
        method: "POST",
        signal: attempt.controller.signal,
        body: {
          title: form.title,
          author: form.author,
          photo: form.photo || undefined,
          website: form.website,
        },
      });
      notify(
        result?.duplicate
          ? "Esse livro já estava entre as sugestões. Obrigado por reforçar!"
          : "Sugestão enviada. Obrigado!",
        "success",
      );
      setConfirming(false);
      onSent();
    } catch (error) {
      if (attempt.timedOut) {
        setSendError(
          "O servidor demorou demais para responder, e a sugestão pode ter chegado mesmo assim. Se tentar de novo e ela já estiver na lista, está tudo certo.",
        );
      } else if (!attempt.controller.signal.aborted) {
        setSendError(error.message);
      }
      // Cancelado pela pessoa (Voltar, x, Esc): nada a dizer.
    } finally {
      clearTimeout(timer);
      if (sendRef.current === attempt) sendRef.current = null;
      setSending(false);
    }
  }

  // Fechar a confirmacao tambem cancela o envio que estiver em andamento.
  function closeConfirm() {
    sendRef.current?.controller.abort();
    setConfirming(false);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Sugerir um livro"
        variant="pub"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" form="suggest-form" className="btn btn--primary">
              Continuar
            </button>
          </>
        }
      >
        <form
          id="suggest-form"
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            review();
          }}
        >
          <p className="muted">
            Qual livro você gostaria de encontrar na biblioteca? A equipe olha
            todas as sugestões antes das próximas compras.
          </p>

          <div className="suggest__photo">
            <CoverPicker
              src={form.photo}
              onPhoto={(dataUri) => setForm((f) => ({ ...f, photo: dataUri }))}
              onRemove={() => setForm((f) => ({ ...f, photo: "" }))}
              notify={notify}
            />
            <small className="field__hint">
              Foto da capa (opcional): toque na câmera para tirar uma foto ou
              escolher da galeria.
            </small>
          </div>

          <label className="field">
            <span>Título do livro</span>
            <input
              value={form.title}
              placeholder="Ex.: O Peregrino"
              maxLength={150}
              required
              aria-required="true"
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                setFormError("");
              }}
            />
          </label>

          <label className="field">
            <span>Autor</span>
            <input
              value={form.author}
              placeholder="Ex.: John Bunyan"
              maxLength={100}
              required
              aria-required="true"
              onChange={(e) => {
                setForm((f) => ({ ...f, author: e.target.value }));
                setFormError("");
              }}
            />
          </label>

          {/* Campo-isca: invisivel e fora do Tab. Gente nao preenche; robo
              que preenche tudo e reconhecido pelo servidor. */}
          <div className="suggest__trap" aria-hidden="true">
            <label>
              Site
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </label>
          </div>

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={confirming}
        onClose={closeConfirm}
        closeOnBackdrop={!sending}
        title="Confirmar sugestão"
        variant="pub"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeConfirm}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              aria-disabled={sending || undefined}
              onClick={send}
            >
              {sending ? (
                <span>
                  {form.photo ? "Enviando foto" : "Enviando"}
                  <span className="loadingdots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              ) : (
                "Sugerir livro"
              )}
            </button>
          </>
        }
      >
        <div className="suggest__confirm">
          <p>Tem certeza de que quer sugerir este livro para o acervo?</p>
          <div className="suggest__card">
            <BookCover src={form.photo} alt="" className="cover--sm" />
            <dl className="suggest__data">
              <div>
                <dt>Título</dt>
                <dd>{form.title}</dd>
              </div>
              <div>
                <dt>Autor</dt>
                <dd>{form.author}</dd>
              </div>
              <div>
                <dt>Foto</dt>
                <dd>{form.photo ? "Com foto da capa" : "Sem foto"}</dd>
              </div>
            </dl>
          </div>
          <p className="muted">Sua sugestão será levada em conta nas próximas compras.</p>
          {sendError ? (
            <p className="form-error" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
