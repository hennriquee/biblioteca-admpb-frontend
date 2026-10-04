import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import BookCover from "../components/BookCover.jsx";
import { formatDate, formatLongDate, loanProgress } from "../utils/dates.js";
import { IconPlus, IconSearch, IconCheck } from "../components/Icons.jsx";
import {
  formatStoredPhone,
  reminderKind,
  whatsappLink,
} from "../utils/whatsapp.js";

function LoanCard({ loan, onOpen }) {
  const isReturned = loan.status === "devolvido";
  const { percent, daysWith, daysLeft, overdue, openEnded } = loanProgress(
    loan.startDate,
    loan.dueDate,
    loan.returnedAt,
  );

  return (
    <li>
      <button
        type="button"
        className={
          "loancard" +
          (overdue ? " loancard--late" : "") +
          (isReturned ? " loancard--returned" : "")
        }
        onClick={() => onOpen(loan)}
      >
        <span
          className={
            "loancard__tag " +
            (isReturned ? "loancard__tag--returned" : "loancard__tag--active")
          }
        >
          {isReturned ? "Devolvido" : "Em andamento"}
        </span>

        <BookCover
          src={loan.bookCover}
          alt={"Capa de " + loan.bookTitle}
          className="cover--sm"
        />

        <div className="loancard__body">
          <div className="loancard__top">
            <strong>{loan.bookTitle}</strong>
          </div>

          <p className="loancard__person">
            {loan.personName}
            <span className="loancard__days">
              {" · "}
              {daysWith === 0
                ? "hoje"
                : daysWith === 1
                  ? "ha 1 dia"
                  : "ha " + daysWith + " dias"}
            </span>
          </p>

          <div className="track" aria-hidden="true">
            <span
              className="track__fill"
              style={{ width: (openEnded ? 8 : percent) + "%" }}
            />
          </div>

          {!isReturned && loan.personPhone && reminderKind(loan) !== "ok" ? (
            <p
              className={
                "loancard__notice" +
                (reminderKind(loan) === "late" ? " is-late" : "")
              }
            >
              {(reminderKind(loan) === "late"
                ? loan.overdueSentAt
                : loan.reminderSentAt)
                ? "WhatsApp aberto para avisar"
                : reminderKind(loan) === "late"
                  ? "Avisar atraso no WhatsApp"
                  : "Avisar devolução no WhatsApp"}
            </p>
          ) : null}

          <div className="loancard__dates">
            <span>{formatDate(loan.startDate)}</span>
            <span className={overdue ? "is-late" : ""}>
              {isReturned
                ? "devolvido em " + formatDate(loan.returnedAt)
                : openEnded
                  ? "sem data combinada"
                  : overdue
                    ? Math.abs(daysLeft) + " dia(s) de atraso"
                    : formatDate(loan.dueDate)}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

export default function Loans() {
  const { notify } = useToast();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ativo");
  const [bookFilter, setBookFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [returning, setReturning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (bookFilter.trim()) params.set("book", bookFilter.trim());
      if (personFilter.trim()) params.set("person", personFilter.trim());
      const data = await api("/api/loans?" + params.toString());
      setLoans(data);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [status, bookFilter, personFilter, notify]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function confirmReturn() {
    setReturning(true);
    try {
      await api("/api/loans/" + selected._id + "/return", { method: "PATCH" });
      notify("Devolução confirmada.", "success");
      setSelected(null);
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setReturning(false);
    }
  }

  async function openWhatsapp() {
    const kind = reminderKind(selected) === "late" ? "overdue" : "reminder";
    // Abre primeiro (o navegador so permite no clique) e registra depois.
    window.open(whatsappLink(selected), "_blank", "noopener");
    try {
      const updated = await api("/api/loans/" + selected._id + "/notified", {
        method: "PATCH",
        body: { kind },
      });
      setSelected(updated);
      setLoans((list) =>
        list.map((item) => (item._id === updated._id ? updated : item)),
      );
    } catch {
      /* o aviso ja foi aberto; falhar em registrar nao atrapalha */
    }
  }

  const details = selected
    ? loanProgress(selected.startDate, selected.dueDate, selected.returnedAt)
    : null;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Empréstimos</h1>
          <p className="page__sub">{loans.length} registro(s) nesta lista</p>
        </div>
        <Link to="/emprestimos/novo" className="btn btn--primary">
          <IconPlus width={18} height={18} />
          Novo empréstimo
        </Link>
      </div>

      <div className="filters">
        <div className="searchbar">
          <IconSearch width={18} height={18} />
          <input
            type="search"
            placeholder="Filtrar por livro ou ISBN"
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value)}
          />
        </div>
        <div className="searchbar">
          <IconSearch width={18} height={18} />
          <input
            type="search"
            placeholder="Filtrar pelo nome da pessoa"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="segmented" role="tablist">
        {[
          { key: "ativo", label: "Em andamento" },
          { key: "devolvido", label: "Devolvidos" },
          { key: "todos", label: "Todos" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={status === option.key}
            className={
              "segmented__item" + (status === option.key ? " is-active" : "")
            }
            onClick={() => setStatus(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? <p className="muted">Carregando…</p> : null}

      {!loading && loans.length === 0 ? (
        <div className="empty">
          <p>Nada por aqui ainda.</p>
          <Link to="/emprestimos/novo" className="btn btn--ghost">
            Registrar um empréstimo
          </Link>
        </div>
      ) : null}

      <ul className="loanlist">
        {loans.map((loan) => (
          <LoanCard key={loan._id} loan={loan} onOpen={setSelected} />
        ))}
      </ul>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalhes do emprestimo"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
            {selected?.status === "ativo" && selected?.personPhone ? (
              <button
                type="button"
                className="btn btn--whatsapp"
                onClick={openWhatsapp}
              >
                Avisar no WhatsApp
              </button>
            ) : null}
            {selected?.status === "ativo" ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirmReturn}
                disabled={returning}
              >
                <IconCheck width={17} height={17} />
                {returning ? "Confirmando…" : "Confirmar devolução"}
              </button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="detail">
            <BookCover
              src={selected.bookCover}
              alt={"Capa de " + selected.bookTitle}
              className="cover--lg"
            />
            <h3 className="detail__title">{selected.bookTitle}</h3>
            <dl className="detail__data">
              <div>
                <dt>Com quem está</dt>
                <dd>{selected.personName}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  {selected.personPhone
                    ? formatStoredPhone(selected.personPhone)
                    : "não informado"}
                </dd>
              </div>
              <div>
                <dt>Retirada</dt>
                <dd>{formatLongDate(selected.startDate)}</dd>
              </div>
              <div>
                <dt>Devolução combinada</dt>
                <dd>
                  {selected.dueDate
                    ? formatLongDate(selected.dueDate)
                    : "nao combinada"}
                </dd>
              </div>
              <div>
                <dt>Tempo com o livro</dt>
                <dd>{details.daysWith} dia(s)</dd>
              </div>
              <div>
                <dt>ISBN</dt>
                <dd>{selected.bookIsbn || "—"}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>
                  {selected.status === "devolvido"
                    ? "Devolvido em " + formatDate(selected.returnedAt)
                    : details.overdue
                      ? Math.abs(details.daysLeft) + " dia(s) de atraso"
                      : "Em dia"}
                </dd>
              </div>
            </dl>
            {selected.notes ? (
              <div className="detail__synopsis">
                <h3>Observações</h3>
                <p>{selected.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
