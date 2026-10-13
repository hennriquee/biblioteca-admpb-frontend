import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import BookCover from "../components/BookCover.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { formatDate, formatLongDate, loanProgress } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { normalizeText } from "../utils/bookFilter.js";
import { IconPlus, IconSearch, IconCheck } from "../components/Icons.jsx";
import {
  formatStoredPhone,
  reminderKind,
  whatsappLink,
} from "../utils/whatsapp.js";

// Lista baixada ha mais tempo que isso e atualizada (em silencio) na proxima
// troca de filtro.
const STALE_AFTER_MS = 60 * 1000;

// O filtro roda aqui mesmo, com as mesmas regras do servidor
// (routes/loans.js). "atrasados" = em andamento com o prazo vencido.
function matchesLoan(loan, status, book, person) {
  if (status === "atrasados") {
    if (loan.status !== "ativo" || !loan.dueDate) return false;
    if (!loanProgress(loan.startDate, loan.dueDate).overdue) return false;
  } else if (status !== "todos" && loan.status !== status) {
    return false;
  }
  if (
    book &&
    !normalizeText(loan.bookTitle).includes(book) &&
    !String(loan.bookIsbn || "").toLowerCase().includes(book)
  ) {
    return false;
  }
  return !person || normalizeText(loan.personName).includes(person);
}

function LoanCard({ loan, onOpen }) {
  const isReturned = loan.status === "devolvido";
  const bookTitle = formatBookTitle(loan.bookTitle);
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
          alt={"Capa de " + bookTitle}
          className="cover--sm"
        />

        <div className="loancard__body">
          <div className="loancard__top">
            <strong title={bookTitle}>{bookTitle}</strong>
          </div>

          <p className="loancard__person">
            {loan.personName}
            <span className="loancard__days">
              {" · "}
              {daysWith === 0
                ? "hoje"
                : daysWith === 1
                  ? "há 1 dia"
                  : "há " + daysWith + " dias"}
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

  // Todos os emprestimos (em andamento + devolvidos dos ultimos dias) sao
  // baixados uma vez; as abas e os dois campos filtram aqui mesmo, na hora.
  // null = ainda baixando (a tela mostra o esqueleto).
  const [loans, setLoans] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // So a resposta da ultima chamada vale (respostas antigas atrasadas caem fora).
  const requestRef = useRef(0);
  const loadedAt = useRef(0);
  // O filtro vive na URL (?filtro=atrasados): o botao "voltar" funciona e os
  // cartoes da Inicio conseguem abrir esta tela ja filtrada.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawFilter = searchParams.get("filtro");
  const status = ["atrasados", "devolvido", "todos"].includes(rawFilter)
    ? rawFilter
    : "ativo";
  const setStatus = (key) =>
    setSearchParams(key === "ativo" ? {} : { filtro: key }, { replace: true });
  const [bookFilter, setBookFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [returning, setReturning] = useState(false);

  // silent: sem esmaecer a lista e sem avisar se falhar (a lista continua).
  const load = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestRef.current;
      if (!silent) {
        setRefreshing(true);
        setError("");
      }
      try {
        const data = await api("/api/loans?status=todos");
        if (requestId !== requestRef.current) return;
        loadedAt.current = Date.now();
        setLoans(data);
        // Chegou lista nova: um aviso de falha anterior ja nao vale.
        setError("");
      } catch (err) {
        if (requestId !== requestRef.current) return;
        if (!silent) setError(err.message);
      } finally {
        if (requestId === requestRef.current) setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const book = normalizeText(bookFilter);
  const person = normalizeText(personFilter);

  // Os filtros respondem na hora com o que esta na memoria; se a lista ja
  // esta velha, uma copia nova e buscada em silencio. O mesmo ao voltar para
  // esta aba do navegador depois de um tempo.
  const refreshIfStale = useCallback(() => {
    if (loadedAt.current && Date.now() - loadedAt.current > STALE_AFTER_MS) {
      // Marca ja, para digitar varias letras nao disparar um pedido por letra.
      loadedAt.current = Date.now();
      load({ silent: true });
    }
  }, [load]);

  useEffect(() => {
    refreshIfStale();
  }, [status, book, person, refreshIfStale]);

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) refreshIfStale();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refreshIfStale]);

  const shownLoans = useMemo(
    () =>
      (loans || []).filter((loan) => matchesLoan(loan, status, book, person)),
    [loans, status, book, person],
  );
  // Sem lista ainda (primeira abertura): esqueleto. Com erro e sem lista: aviso.
  const waiting = loans === null && !error;
  const failed = loans === null && Boolean(error);

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
        (list || []).map((item) => (item._id === updated._id ? updated : item)),
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
          <p className="page__sub">
            {waiting
              ? "Carregando…"
              : failed
                ? "Não foi possível carregar"
                : shownLoans.length + " registro(s) nesta lista"}
          </p>
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
          { key: "atrasados", label: "Atrasados" },
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

      {waiting ? <ListSkeleton label="Carregando os empréstimos…" /> : null}

      {failed ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => load()}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {loans !== null && shownLoans.length === 0 ? (
        <div className="empty">
          <p>
            {status === "atrasados"
              ? "Nenhum empréstimo atrasado."
              : "Nada por aqui ainda."}
          </p>
          <Link to="/emprestimos/novo" className="btn btn--ghost">
            Registrar um empréstimo
          </Link>
        </div>
      ) : null}

      {/* A lista continua na tela, mas a ultima atualizacao falhou. */}
      {loans !== null && error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {shownLoans.length > 0 ? (
        <ul className={"loanlist" + (refreshing ? " is-refreshing" : "")}>
          {shownLoans.map((loan) => (
            <LoanCard key={loan._id} loan={loan} onOpen={setSelected} />
          ))}
        </ul>
      ) : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalhes do empréstimo"
        footer={
          <div className="detail__foot">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
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
          </div>
        }
      >
        {selected ? (
          <div className="detail">
            <BookCover
              src={selected.bookCover}
              alt={"Capa de " + formatBookTitle(selected.bookTitle)}
              className="cover--lg"
            />
            <h3 className="detail__title">
              {formatBookTitle(selected.bookTitle)}
            </h3>
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
                    : "não combinada"}
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
              {/* Ocupa a celula que sobra ao lado de "Situacao". */}
              {selected.status === "ativo" && selected.personPhone ? (
                <div className="detail__action">
                  <dt className="sr-only">Aviso</dt>
                  <dd>
                    <button
                      type="button"
                      className="btn btn--whatsapp btn--block"
                      onClick={openWhatsapp}
                    >
                      Avisar no WhatsApp
                    </button>
                  </dd>
                </div>
              ) : null}
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
