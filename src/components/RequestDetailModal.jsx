import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useToast } from "./Toast.jsx";
import Modal from "./Modal.jsx";
import Confirm from "./Confirm.jsx";
import BookCover from "./BookCover.jsx";
import Avatar from "./Avatar.jsx";
import { IconCheck, IconTrash } from "./Icons.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import {
  addDaysToInput,
  dateInputValue,
  daysBetween,
  formatLongDate,
} from "../utils/dates.js";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { warningText } from "../pages/NewLoan.jsx";
import { pokeNotices } from "../utils/adminNotices.js";

// "hoje", "amanhã", "em 3 dias", "passou há 2 dias".
export function pickupWhen(pickupDate) {
  const days = daysBetween(new Date(), pickupDate);
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days > 1) return "em " + days + " dias";
  if (days === -1) return "passou há 1 dia";
  return "passou há " + Math.abs(days) + " dias";
}

/**
 * Uma SOLICITACAO aberta em Emprestimos > Solicitados: e o "Novo empréstimo"
 * dela. A pessoa e o livro vem fixos (sao os da solicitacao e nao mudam
 * aqui); as datas vem preenchidas - a retirada com a retirada prevista e a
 * devolucao 21 dias depois - e podem ser trocadas.
 *
 * Embaixo, as duas saidas: "Emprestar" (a solicitacao vira
 * emprestimo) e "Excluir solicitação" (o exemplar volta para a estante), esta
 * com confirmacao, para um toque errado nao apagar nada.
 *
 * request null = fechado. onChanged() e chamado quando a solicitacao saiu da
 * lista (virou emprestimo ou foi excluida).
 */
export default function RequestDetailModal({ request, onClose, onChanged }) {
  const { notify } = useToast();
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [warning, setWarning] = useState(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!request) return;
    const start = dateInputValue(request.pickupDate);
    setStartDate(start);
    setDueDate(addDaysToInput(start, 21));
    setNotes("");
    setAskDelete(false);
    setWarning(null);
  }, [request?._id]);

  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function makeLoan(extra = {}) {
    if (!startDate) return notify("Informe a data da retirada.", "error");
    if (dueDate && dueDate < startDate) {
      return notify(
        "A data de devolução não pode ser anterior à retirada.",
        "error",
      );
    }
    return run(async () => {
      try {
        await api("/api/requests/" + request._id + "/loan", {
          method: "POST",
          body: { startDate, dueDate: dueDate || null, notes, ...extra },
        });
        notify("Empréstimo registrado.", "success");
        pokeNotices();
        onChanged("loan");
      } catch (error) {
        const code = error instanceof ApiError ? error.payload?.code : null;
        if (code === "PERSON_HAS_ACTIVE_LOAN") {
          setWarning(error.payload);
          return;
        }
        notify(error.message, "error");
        // Sumiu ou mudou (outro administrador ja resolveu): a lista e
        // atualizada.
        if (error.status === 404 || error.status === 409) onChanged("gone");
      }
    });
  }

  function deleteRequest() {
    setAskDelete(false);
    return run(async () => {
      try {
        await api("/api/requests/" + request._id, { method: "DELETE" });
        notify(
          "Solicitação excluída. O livro voltou para a estante.",
          "success",
        );
        pokeNotices();
        onChanged("deleted");
      } catch (error) {
        notify(error.message, "error");
        if (error.status === 404 || error.status === 409) onChanged("gone");
      }
    });
  }

  const title = formatBookTitle(request?.bookTitle);
  const nameDiffers =
    request?.requesterName &&
    request.requesterName.trim().toLowerCase() !==
      String(request.personName || "")
        .trim()
        .toLowerCase();

  return (
    <>
      <Modal
        open={Boolean(request)}
        onClose={onClose}
        title="Solicitação de empréstimo"
        footer={
          <div className="detail__foot">
            <button
              type="button"
              className="btn btn--ghost btn--ghost-danger"
              onClick={() => setAskDelete(true)}
              disabled={busy}
            >
              <IconTrash width={17} height={17} />
              Excluir
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => makeLoan()}
              disabled={busy}
            >
              <IconCheck width={17} height={17} />
              {busy ? "Aguarde…" : "Emprestar"}
            </button>
          </div>
        }
      >
        {request ? (
          <div className="detail reqdetail">
            <BookCover
              src={request.bookCover}
              alt={"Capa de " + title}
              className="cover--lg"
            />
            <h3 className="detail__title">{title}</h3>

            <div className="field reqdetail__fixed">
              <span className="field__label">Quem vai levar</span>
              <div className="picked">
                <Avatar
                  src={request.personPhoto}
                  name={request.personName}
                  size={44}
                />
                <div>
                  <strong title={request.personName}>
                    {(request.personCode
                      ? "#" + request.personCode + " "
                      : "") + request.personName}
                  </strong>
                  <small>
                    {request.personPhone
                      ? formatStoredPhone(request.personPhone)
                      : "sem WhatsApp"}
                  </small>
                </div>
                {request.personIsAdmin ? (
                  <span className="chip chip--admin">admin</span>
                ) : null}
              </div>
            </div>

            <dl className="detail__data">
              <div>
                <dt>Retirada prevista</dt>
                <dd>
                  {formatLongDate(request.pickupDate)}
                  <small className="reqdetail__when">
                    {pickupWhen(request.pickupDate)}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Registrada por</dt>
                <dd>{request.registeredByName || "—"}</dd>
              </div>
              {nameDiffers ? (
                <div className="detail__wide">
                  <dt>Nome que veio na mensagem</dt>
                  <dd>{request.requesterName}</dd>
                </div>
              ) : null}
            </dl>

            <form
              className="form reqdetail__form"
              onSubmit={(event) => {
                event.preventDefault();
                makeLoan();
              }}
            >
              <div className="field-row">
                <label className="field">
                  <span>Data da retirada</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Devolução combinada</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span>Observações (opcional)</span>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </form>
          </div>
        ) : null}
      </Modal>

      <Confirm
        open={askDelete}
        title="Excluir solicitação"
        message={
          "Excluir a solicitação de " +
          (request?.personName || "") +
          ' para "' +
          title +
          '"? O livro volta para a estante e outra pessoa poderá solicitar.'
        }
        confirmLabel="Excluir solicitação"
        tone="danger"
        onCancel={() => setAskDelete(false)}
        onConfirm={deleteRequest}
      />

      <Confirm
        open={Boolean(warning)}
        title="Essa pessoa já tem um livro"
        message={
          warningText(warning) + " Tem certeza que quer emprestar outro?"
        }
        confirmLabel="Sim, emprestar"
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          makeLoan({ force: true });
        }}
      />
    </>
  );
}
