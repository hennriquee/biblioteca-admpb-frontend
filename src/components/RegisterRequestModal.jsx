import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useToast } from "./Toast.jsx";
import Modal from "./Modal.jsx";
import BookPicker, { unavailableReason } from "./BookPicker.jsx";
import PersonPicker from "./PersonPicker.jsx";
import { dateInputValue, todayInputValue } from "../utils/dates.js";

/**
 * REGISTRAR SOLICITACAO (painel): o administrador combinou a retirada pelo
 * WhatsApp e marca o livro como "solicitado" para a pessoa - a partir daqui o
 * exemplar fica segurado para ela (ninguem mais solicita nem leva esse
 * exemplar). Pede so tres coisas: o livro, quem solicitou (do cadastro, ou
 * "Cadastrar nova pessoa", como no Novo emprestimo) e a retirada prevista.
 *
 * Abre de tres jeitos:
 * - pelo LINK da mensagem do WhatsApp (link = { token, requesterName,
 *   pickupDate, book }): o livro vem fixo, a busca de pessoa ja vem com o nome
 *   que a pessoa digitou e a data com o dia que ela escolheu. Registrado, o
 *   link para de valer (abrir de novo nao registra nada);
 * - pela ficha do livro no Acervo (initialBook);
 * - por Emprestimos > Solicitados (sem nada preenchido).
 *
 * onSaved(solicitacao) recebe o que o servidor gravou.
 */
export default function RegisterRequestModal({
  open,
  onClose,
  onSaved,
  initialBook = null,
  link = null,
}) {
  const { notify } = useToast();
  const [book, setBook] = useState(null);
  const [person, setPerson] = useState(null);
  const [pickupDate, setPickupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setBook(link?.book || initialBook || null);
    setPerson(null);
    setPickupDate(
      (link?.pickupDate && dateInputValue(link.pickupDate)) || todayInputValue(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, link?.token, initialBook?._id]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!book) return notify("Escolha o livro solicitado.", "error");
    const reason = unavailableReason(book);
    if (reason) return notify("Esse livro não está livre agora: " + reason + ".", "error");
    if (!person) {
      return notify(
        "Selecione quem solicitou na lista de sugestões ou cadastre uma nova pessoa.",
        "error",
      );
    }
    if (!pickupDate) return notify("Informe a retirada prevista.", "error");

    if (savingRef.current) return undefined;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await api("/api/requests", {
        method: "POST",
        body: {
          personId: person._id,
          pickupDate,
          ...(link ? { token: link.token } : { bookId: book._id }),
        },
      });
      notify("Solicitação registrada. O livro está separado para " + saved.personName + ".", "success");
      onSaved(saved);
    } catch (error) {
      notify(error.message, "error");
      const code = error instanceof ApiError ? error.payload?.code : null;
      // Link que deixou de valer no meio do caminho: nao ha o que registrar.
      if (code === "LINK_USED" || code === "LINK_GONE") onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    return undefined;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar solicitação"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="register-request-form"
            className="btn btn--primary"
            disabled={saving}
          >
            {saving ? "Registrando…" : "Registrar solicitação"}
          </button>
        </>
      }
    >
      {open ? (
        <form
          id="register-request-form"
          className="form reqregister"
          onSubmit={handleSubmit}
        >
          <p className="muted reqregister__intro">
            Depois de combinar a retirada pelo WhatsApp, marque o livro como
            solicitado: o exemplar fica separado para essa pessoa.
          </p>

          <div className="field">
            <span className="field__label">Livro</span>
            <BookPicker
              picked={book}
              onPick={setBook}
              onClear={() => setBook(null)}
              locked={Boolean(link)}
            />
            {book && unavailableReason(book) ? (
              <small className="field__hint field__hint--warn">
                Esse livro não está livre agora: {unavailableReason(book)}.
              </small>
            ) : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="request-person">
              Quem solicitou
            </label>
            <PersonPicker
              key={link?.token || "manual"}
              inputId="request-person"
              picked={person}
              onPick={(picked) => setPerson(picked)}
              onClear={() => setPerson(null)}
              initialQuery={link?.requesterName || ""}
            />
            {link?.requesterName ? (
              <small className="field__hint">
                {"Nome que veio na mensagem: “" + link.requesterName + "”. "}
                Escolha a ficha certa ou cadastre a pessoa.
              </small>
            ) : null}
          </div>

          <label className="field">
            <span>Retirada prevista</span>
            <input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              required
            />
            <small className="field__hint">
              O dia combinado pelo WhatsApp para a pessoa pegar o livro.
            </small>
          </label>
        </form>
      ) : null}
    </Modal>
  );
}
