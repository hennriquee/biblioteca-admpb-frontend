import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import BookCover from "../components/BookCover.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import OptionFilter from "../components/OptionFilter.jsx";
import RegisterRequestModal from "../components/RegisterRequestModal.jsx";
import RequestDetailModal, {
  pickupWhen,
} from "../components/RequestDetailModal.jsx";
import { formatDate, formatLongDate, loanProgress } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { normalizeText } from "../utils/bookFilter.js";
import { useRefresh } from "../utils/refresh.js";
import {
  IconPlus,
  IconSearch,
  IconCheck,
  IconTag,
  IconWhatsapp,
} from "../components/Icons.jsx";
import {
  formatStoredPhone,
  reminderKind,
  whatsappLink,
} from "../utils/whatsapp.js";

// Lista baixada ha mais tempo que isso e atualizada (em silencio) na proxima
// troca de filtro.
const STALE_AFTER_MS = 60 * 1000;

// Situacoes do filtro (lista suspensa). "solicitados" sao as solicitacoes de
// emprestimo ja registradas (ver backend/src/models/LoanRequest.js), da
// retirada prevista mais proxima para a mais distante; "todos" junta tudo.
const STATUS_OPTIONS = [
  { key: "ativo", label: "Em andamento" },
  { key: "atrasados", label: "Atrasados" },
  { key: "devolvido", label: "Devolvidos" },
  { key: "solicitados", label: "Solicitados" },
  { key: "todos", label: "Todos" },
];
const STATUS_KEYS = STATUS_OPTIONS.map((option) => option.key);

function isOverdue(loan) {
  return (
    loan.status === "ativo" &&
    Boolean(loan.dueDate) &&
    loanProgress(loan.startDate, loan.dueDate).overdue
  );
}

// Os campos de busca valem tambem para as solicitacoes.
function matchesText(item, book, person) {
  if (
    book &&
    !normalizeText(item.bookTitle).includes(book) &&
    !String(item.bookIsbn || "").toLowerCase().includes(book)
  ) {
    return false;
  }
  return !person || normalizeText(item.personName).includes(person);
}

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

// Cartao de uma solicitacao (Emprestimos > Solicitados).
function RequestCard({ request, onOpen }) {
  const bookTitle = formatBookTitle(request.bookTitle);
  const when = pickupWhen(request.pickupDate);
  const late = when.startsWith("passou");
  return (
    <li>
      <button
        type="button"
        className={"loancard loancard--request" + (late ? " loancard--late" : "")}
        onClick={() => onOpen(request)}
      >
        <span className="loancard__tag loancard__tag--request">Solicitado</span>

        <BookCover
          src={request.bookCover}
          alt={"Capa de " + bookTitle}
          className="cover--sm"
        />

        <div className="loancard__body">
          <div className="loancard__top">
            <strong title={bookTitle}>{bookTitle}</strong>
          </div>
          <p className="loancard__person">{request.personName}</p>
          {request.registeredByName ? (
            <p className="loancard__approved">
              registrada por {request.registeredByName}
            </p>
          ) : null}
          <div className="loancard__dates">
            <span>retirada prevista</span>
            <span className={late ? "is-late" : ""}>
              {formatDate(request.pickupDate) + " · " + when}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
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

          {/* Quem aprovou: o administrador que registrou o emprestimo.
              Registro antigo (de antes deste campo) nao tem nome guardado. */}
          {loan.approvedByName ? (
            <p className="loancard__approved">
              aprovado por {loan.approvedByName}
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

  // Todos os emprestimos (em andamento + devolvidos dos ultimos dias) e as
  // solicitacoes sao baixados uma vez; o filtro e os dois campos filtram aqui
  // mesmo, na hora. null = ainda baixando (a tela mostra o esqueleto).
  const [loans, setLoans] = useState(null);
  const [requests, setRequests] = useState([]);
  // As solicitacoes nao vieram (a lista de emprestimos veio): a tela avisa,
  // em vez de dizer que nao ha nenhuma.
  const [requestsFailed, setRequestsFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // So a resposta da ultima chamada vale (respostas antigas atrasadas caem fora).
  const requestRef = useRef(0);
  const loadedAt = useRef(0);
  // O filtro vive na URL (?filtro=atrasados): o botao "voltar" funciona e os
  // cartoes da Inicio conseguem abrir esta tela ja filtrada.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawFilter = searchParams.get("filtro");
  const status = STATUS_KEYS.includes(rawFilter) ? rawFilter : "ativo";
  const setStatus = (key) =>
    setSearchParams(key === "ativo" ? {} : { filtro: key }, { replace: true });
  // Link da mensagem do WhatsApp (/solicitacao/<id> traz para ca com
  // ?solicitacao=<id>): abre o "Registrar solicitação" ja preenchido.
  const linkToken = searchParams.get("solicitacao");
  const [link, setLink] = useState(null);
  const [linkProblem, setLinkProblem] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [bookFilter, setBookFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [returning, setReturning] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // O rascunho acompanha o emprestimo aberto; troca de emprestimo (ou fecha o
  // modal) descarta o que nao foi salvo.
  useEffect(() => {
    setNotesDraft(selected?.notes || "");
  }, [selected?._id]);

  // silent: sem esmaecer a lista e sem avisar se falhar (a lista continua).
  const load = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestRef.current;
      if (!silent) {
        setRefreshing(true);
        setError("");
      }
      try {
        // As solicitacoes nao derrubam a lista de emprestimos: se so elas
        // falharem, os emprestimos aparecem e as solicitacoes ficam como estavam.
        const [data, requestList] = await Promise.all([
          api("/api/loans?status=todos"),
          api("/api/requests").catch(() => null),
        ]);
        if (requestId !== requestRef.current) return;
        loadedAt.current = Date.now();
        setLoans(data);
        if (requestList) setRequests(requestList);
        setRequestsFailed(!requestList);
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

  // Puxar para atualizar: a lista vem de novo em silencio, e o emprestimo ou a
  // solicitacao aberta passa a mostrar o que ha de novo (sem fechar; o
  // rascunho da observacao continua).
  useRefresh(() => load({ silent: true }));
  useEffect(() => {
    if (!loans) return;
    setSelected((current) =>
      current ? loans.find((loan) => loan._id === current._id) || current : null,
    );
  }, [loans]);
  useEffect(() => {
    setSelectedRequest((current) =>
      current ? requests.find((item) => item._id === current._id) || current : null,
    );
  }, [requests]);

  // Chegou pelo link do WhatsApp: busca o que o link traz e tira o
  // "?solicitacao=" do endereco (recarregar a pagina nao reabre nada). Link
  // ja usado, excluido ou vencido nao registra nada: so explica.
  // (O pedido nao e cancelado quando o endereco muda - e a propria limpeza do
  // endereco que muda linkToken. So a saida da tela descarta a resposta.)
  const mountedRef = useRef(true);
  const handledToken = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (!linkToken || handledToken.current === linkToken) return;
    handledToken.current = linkToken;
    setLinkProblem("");
    api("/api/requests/link/" + encodeURIComponent(linkToken))
      .then((data) => {
        if (!mountedRef.current) return;
        setLink(data);
        setRegisterOpen(true);
        setSearchParams({ filtro: "solicitados" }, { replace: true });
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        setLinkProblem(error.message);
        // Sem resposta (rede): o link continua no endereco, e recarregar a
        // pagina tenta de novo. Com resposta (ja usado, vencido), sai.
        if (error.status) {
          setSearchParams({ filtro: "solicitados" }, { replace: true });
        }
      });
    // Roda quando chega um link novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken]);

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
      status === "solicitados"
        ? []
        : (loans || []).filter((loan) => matchesLoan(loan, status, book, person)),
    [loans, status, book, person],
  );
  // Ja vem do servidor da retirada prevista mais proxima para a mais distante.
  const shownRequests = useMemo(
    () =>
      status === "solicitados" || status === "todos"
        ? requests.filter((item) => matchesText(item, book, person))
        : [],
    [requests, status, book, person],
  );
  const shownCount = shownLoans.length + shownRequests.length;

  // Quantos ha em cada situacao (sem contar os campos de busca).
  const statusOptions = useMemo(() => {
    if (!loans) return STATUS_OPTIONS;
    const counts = {
      ativo: loans.filter((loan) => loan.status === "ativo").length,
      atrasados: loans.filter(isOverdue).length,
      devolvido: loans.filter((loan) => loan.status === "devolvido").length,
      solicitados: requestsFailed ? undefined : requests.length,
      todos: requestsFailed ? undefined : loans.length + requests.length,
    };
    return STATUS_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.key],
    }));
  }, [loans, requests, requestsFailed]);
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

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const updated = await api("/api/loans/" + selected._id + "/notes", {
        method: "PATCH",
        body: { notes: notesDraft },
      });
      setSelected(updated);
      setLoans((list) =>
        (list || []).map((item) => (item._id === updated._id ? updated : item)),
      );
      notify("Observação salva.", "success");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSavingNotes(false);
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
                : shownCount + " registro(s) nesta lista"}
          </p>
        </div>
        {status === "solicitados" ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setLink(null);
              setRegisterOpen(true);
            }}
          >
            <IconPlus width={18} height={18} />
            Registrar solicitação
          </button>
        ) : (
          <Link to="/emprestimos/novo" className="btn btn--primary">
            <IconPlus width={18} height={18} />
            Novo empréstimo
          </Link>
        )}
      </div>

      {linkProblem ? (
        <div className="linknotice" role="alert">
          <p>{linkProblem}</p>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setLinkProblem("")}
          >
            Entendi
          </button>
        </div>
      ) : null}

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

      <OptionFilter
        label="Situação"
        icon={IconTag}
        value={status}
        onChange={setStatus}
        options={statusOptions}
      />

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

      {requestsFailed && (status === "solicitados" || status === "todos") ? (
        <div className="empty" role="alert">
          <p>Não foi possível carregar as solicitações agora.</p>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => load()}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {loans !== null &&
      shownCount === 0 &&
      !(requestsFailed && status === "solicitados") ? (
        <div className="empty">
          <p>
            {status === "atrasados"
              ? "Nenhum empréstimo atrasado."
              : status === "solicitados"
                ? "Nenhuma solicitação no momento."
                : "Nada por aqui ainda."}
          </p>
          {status === "solicitados" ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setLink(null);
                setRegisterOpen(true);
              }}
            >
              Registrar uma solicitação
            </button>
          ) : (
            <Link to="/emprestimos/novo" className="btn btn--ghost">
              Registrar um empréstimo
            </Link>
          )}
        </div>
      ) : null}

      {/* A lista continua na tela, mas a ultima atualizacao falhou. */}
      {loans !== null && error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {shownCount > 0 ? (
        <ul className={"loanlist" + (refreshing ? " is-refreshing" : "")}>
          {shownRequests.map((item) => (
            <RequestCard
              key={"s" + item._id}
              request={item}
              onOpen={setSelectedRequest}
            />
          ))}
          {shownLoans.map((loan) => (
            <LoanCard key={loan._id} loan={loan} onOpen={setSelected} />
          ))}
        </ul>
      ) : null}

      <RegisterRequestModal
        open={registerOpen}
        link={link}
        onClose={() => {
          setRegisterOpen(false);
          setLink(null);
        }}
        onSaved={() => {
          setRegisterOpen(false);
          setLink(null);
          setStatus("solicitados");
          load();
        }}
      />

      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onChanged={() => {
          setSelectedRequest(null);
          load();
        }}
      />

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
            <div className="detail__cover">
              <BookCover
                src={selected.bookCover}
                alt={"Capa de " + formatBookTitle(selected.bookTitle)}
                className="cover--lg"
              />
              {selected.status === "ativo" && selected.personPhone ? (
                <button
                  type="button"
                  className="detail__whatsapp"
                  onClick={openWhatsapp}
                  aria-label="Avisar no WhatsApp"
                >
                  <IconWhatsapp width={20} height={20} />
                </button>
              ) : null}
            </div>
            <h3 className="detail__title">
              {formatBookTitle(selected.bookTitle)}
            </h3>
            <dl className="detail__data">
              <div>
                <dt>Com quem está</dt>
                <dd>
                  {selected.personName}
                  {selected.personIsAdmin ? (
                    <span className="chip chip--admin">admin</span>
                  ) : null}
                  {selected.personCode ? (
                    <small className="detail__code">
                      {"#" + selected.personCode}
                    </small>
                  ) : null}
                </dd>
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
                <dt>Aprovado por</dt>
                <dd>{selected.approvedByName || "não registrado"}</dd>
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
            </dl>
            {selected.status === "ativo" ? (
              <div className="detail__notes">
                <label className="field">
                  <span>Observações</span>
                  <textarea
                    rows={3}
                    placeholder="Anote algo sobre esse empréstimo…"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm detail__notes-save"
                  onClick={saveNotes}
                  disabled={savingNotes || notesDraft === (selected.notes || "")}
                >
                  {savingNotes ? "Salvando…" : "Salvar observação"}
                </button>
              </div>
            ) : selected.notes ? (
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
