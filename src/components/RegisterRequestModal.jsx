import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useToast } from "./Toast.jsx";
import Modal from "./Modal.jsx";
import BookPicker, { unavailableReason } from "./BookPicker.jsx";
import PersonPicker from "./PersonPicker.jsx";
import Avatar from "./Avatar.jsx";
import { dateInputValue, formatLongDate, todayInputValue } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { pokeNotices } from "../utils/adminNotices.js";

/**
 * REGISTRAR SOLICITACAO (painel): o administrador combinou a retirada pelo
 * WhatsApp e marca o livro como "solicitado" para a pessoa - a partir daqui o
 * exemplar fica segurado para ela (ninguem mais solicita nem leva esse
 * exemplar). Pede so tres coisas: o livro, quem solicitou (do cadastro, ou
 * "Cadastrar nova pessoa", como no Novo emprestimo) e a retirada prevista.
 *
 * Abre de tres jeitos:
 * - pelo LINK da mensagem do WhatsApp (link = { token, requesterName,
 *   requesterPerson, requesterIsNew, pickupDate, book }): o livro vem fixo, a
 *   data com o dia que a pessoa escolheu e a pessoa com a ficha em que ela
 *   tocou no acervo publico (ou a busca ja com o nome que ela digitou).
 *   Registrado, o link para de valer (abrir de novo nao registra nada);
 * - pela ficha do livro no Acervo (initialBook);
 * - por Emprestimos > Solicitados (sem nada preenchido).
 *
 * Antes de gravar, uma CONFIRMACAO SEPARADA mostra o rosto (foto ou
 * iniciais), o nome e o WhatsApp de quem foi escolhido: e a ultima chance de
 * perceber que a ficha e de outra pessoa com nome parecido.
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
  // A pergunta "E essa pessoa?" antes de gravar.
  const [confirming, setConfirming] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setBook(link?.book || initialBook || null);
    // A ficha em que a pessoa tocou no acervo publico ja vem escolhida (o
    // administrador confere - e pode trocar no "x").
    setPerson(link?.requesterPerson || null);
    setConfirming(false);
    setPickupDate(
      (link?.pickupDate && dateInputValue(link.pickupDate)) || todayInputValue(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, link?.token, initialBook?._id]);

  // "Registrar solicitação": confere o formulario e abre a confirmacao da
  // pessoa. So o "Sim, é essa pessoa" grava.
  function handleSubmit(event) {
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
    setConfirming(true);
    return undefined;
  }

  async function save() {
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
      setConfirming(false);
      pokeNotices();
      onSaved(saved);
    } catch (error) {
      notify(error.message, "error");
      setConfirming(false);
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
    <>
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
            {link?.requesterPerson && person?._id === link.requesterPerson._id ? (
              <small className="field__hint">
                A pessoa tocou neste nome do cadastro ao pedir o livro. Confira
                se é ela mesma (o “x” troca).
              </small>
            ) : null}
            <PersonPicker
              key={link?.token || "manual"}
              inputId="request-person"
              picked={person}
              onPick={(picked) => setPerson(picked)}
              onClear={() => setPerson(null)}
              initialQuery={link?.requesterName || ""}
            />
            {link?.requesterIsNew && !person ? (
              <small className="field__hint field__hint--warn">
                A pessoa disse que ainda não está no cadastro: use “Cadastrar
                nova pessoa”.
              </small>
            ) : null}
            {link?.requesterName && !person ? (
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

    {/* Confirmacao separada da pessoa: o rosto e o nome, em destaque. */}
    <Modal
      open={open && confirming && Boolean(person)}
      onClose={() => (saving ? undefined : setConfirming(false))}
      title="Confirme a pessoa"
      size="sm"
      placement="center"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setConfirming(false)}
            disabled={saving}
          >
            Voltar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Registrando…" : "Sim, é essa pessoa"}
          </button>
        </>
      }
    >
      {person ? (
        <div className="whoconfirm">
          <Avatar src={person.photo} name={person.fullName} size={96} />
          <strong className="whoconfirm__name">
            {(person.code ? "#" + person.code + " " : "") + person.fullName}
          </strong>
          <span className="whoconfirm__meta">
            {person.phone ? formatStoredPhone(person.phone) : "sem WhatsApp"}
            {person.isAdmin ? " · admin" : ""}
          </span>
          <p className="whoconfirm__text">
            O livro <strong>{formatBookTitle(book?.title)}</strong> vai ficar
            separado para esta pessoa, com retirada prevista em{" "}
            <strong>{formatLongDate(pickupDate)}</strong>. É ela mesma?
          </p>
          {link ? (
            <p className="whoconfirm__tip">
              Confira se o WhatsApp que mandou a mensagem é o desta pessoa: no
              acervo, qualquer um pode tocar num nome da lista.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
    </>
  );
}
