import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import Confirm from "../components/Confirm.jsx";
import ExtendDueModal from "../components/ExtendDueModal.jsx";
import { formatDate, formatLongDate, loanProgress } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { hasAllWords, normalizeText } from "../utils/bookFilter.js";
import { useRefresh } from "../utils/refresh.js";
import {
  IconPlus,
  IconSearch,
  IconCheck,
  IconTag,
  IconWhatsapp,
  IconBook,
  IconEdit,
} from "../components/Icons.jsx";
import {
  canCharge,
  formatStoredPhone,
  isLoanOverdue,
  nextChargeAt,
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
    !hasAllWords(item.bookTitle, book) &&
    !String(item.bookIsbn || "").toLowerCase().includes(book)
  ) {
    return false;
  }
  return !person || hasAllWords(item.personName, person);
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
    !hasAllWords(loan.bookTitle, book) &&
    !String(loan.bookIsbn || "").toLowerCase().includes(book)
  ) {
    return false;
  }
  return !person || hasAllWords(loan.personName, person);
}

// Ficha do livro no Acervo (pages/Books.jsx abre a ficha pelo ?livro=).
function bookPath(bookId) {
  return "/livros?livro=" + encodeURIComponent(String(bookId));
}

// O ultimo prazo estendido (ou null).
function lastExtension(loan) {
  const list = loan.dueExtensions || [];
  return list.length ? list[list.length - 1] : null;
}

// A capa do card leva a ficha do livro. O link fica FORA do botao do card
// (link dentro de botao nao vale no HTML) e cobre so a capa: o <li> e a
// referencia de posicao (ver .loancard__coverlink).
function CoverLink({ bookId, title }) {
  if (!bookId) return null;
  return (
    <Link
      to={bookPath(bookId)}
      className="loancard__coverlink"
      aria-label={"Ver “" + title + "” no acervo"}
      title="Ver o livro no acervo"
    />
  );
}

// Cartao de uma solicitacao (Emprestimos > Solicitados).
function RequestCard({ request, onOpen }) {
  const bookTitle = formatBookTitle(request.bookTitle);
  const when = pickupWhen(request.pickupDate);
  const late = when.startsWith("passou");
  return (
    <li className="loanitem">
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
      <CoverLink bookId={request.book} title={bookTitle} />
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
  const extension = lastExtension(loan);
  const late = !isReturned && isLoanOverdue(loan);
  const charged = late && Boolean(loan.overdueSentAt);
  const chargeLocked = charged && Boolean(nextChargeAt(loan));

  return (
    <li className="loanitem">
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

          {/* Cobranca no WhatsApp: so com o livro atrasado. Cobrado nos
              ultimos 30 dias: quem cobrou e quando. */}
          {late && loan.personPhone ? (
            <p
              className={"loancard__notice" + (chargeLocked ? "" : " is-late")}
            >
              <IconWhatsapp width={14} height={14} aria-hidden="true" />
              {chargeLocked
                ? "Cobrado" +
                  (loan.overdueSentByName
                    ? " por " + loan.overdueSentByName
                    : "") +
                  " em " +
                  formatDate(loan.overdueSentAt)
                : charged
                  ? "Cobrar de novo no WhatsApp"
                  : "Cobrar atraso no WhatsApp"}
            </p>
          ) : null}

          {extension ? (
            <p className="loancard__extended">
              {"Prazo estendido" +
                (extension.byName ? " por " + extension.byName : "") +
                (extension.from ? " · era " + formatDate(extension.from) : "")}
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
      <CoverLink bookId={loan.book} title={bookTitle} />
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
  const navigate = useNavigate();
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
  // Janelas sobre os detalhes: "Estender prazo" e a observacao (guardam o
  // emprestimo aberto). (A cobranca abre a secao Conversas.)
  const [extendLoan, setExtendLoan] = useState(null);
  const [noteLoan, setNoteLoan] = useState(null);
  // "Descartar a observação?" (fechou a janela com texto nao salvo).
  const [askDiscard, setAskDiscard] = useState(false);

  // A observacao e escrita numa janela no meio da tela, com o resto
  // desfocado. Abre com o texto salvo; "Cancelar" descarta o rascunho.
  function openNote(loan) {
    setNotesDraft(loan.notes || "");
    setNoteLoan(loan);
  }
  // O cursor ja entra no campo, no fim do texto. (Roda depois de o Modal
  // levar o foco para a propria janela.)
  const noteFieldRef = useRef(null);
  const noteOpenId = noteLoan?._id;
  useEffect(() => {
    const field = noteFieldRef.current;
    if (!noteOpenId || !field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [noteOpenId]);

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

  // O emprestimo mudou (cobranca, prazo, observacao): a ficha aberta e a
  // lista passam a mostrar a versao nova.
  function replaceLoan(updated) {
    // Uma atualizacao da lista que ja estava a caminho traz a versao de
    // ANTES desta mudanca: a resposta dela passa a ser ignorada.
    requestRef.current += 1;
    setRefreshing(false);
    setSelected((current) =>
      current && current._id === updated._id ? updated : current,
    );
    setLoans((list) =>
      (list || []).map((item) => (item._id === updated._id ? updated : item)),
    );
  }

  async function saveNotes(event) {
    event?.preventDefault();
    if (!noteLoan || savingNotes) return;
    setSavingNotes(true);
    try {
      const updated = await api("/api/loans/" + noteLoan._id + "/notes", {
        method: "PATCH",
        body: { notes: notesDraft },
      });
      replaceLoan(updated);
      setNoteLoan(null);
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
  const selectedActive = selected?.status === "ativo";
  const selectedLate = Boolean(selected) && isLoanOverdue(selected);
  const selectedExtension = selected ? lastExtension(selected) : null;
  const selectedNextCharge = selected ? nextChargeAt(selected) : null;

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
            {/* A capa leva a ficha do livro no Acervo. A bolinha no canto e
                so o sinal de que da para tocar. */}
            {selected.book ? (
              <Link
                to={bookPath(selected.book)}
                className="detail__cover detail__coverlink"
                aria-label={
                  "Ver “" + formatBookTitle(selected.bookTitle) + "” no acervo"
                }
                title="Ver o livro no acervo"
              >
                <BookCover
                  src={selected.bookCover}
                  alt=""
                  className="cover--lg"
                />
                <span className="detail__coverbadge" aria-hidden="true">
                  <IconBook width={19} height={19} />
                </span>
              </Link>
            ) : (
              <div className="detail__cover">
                <BookCover
                  src={selected.bookCover}
                  alt={"Capa de " + formatBookTitle(selected.bookTitle)}
                  className="cover--lg"
                />
              </div>
            )}
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
                  {selectedExtension ? (
                    <small className="detail__extended">
                      {"estendida" +
                        (selectedExtension.byName
                          ? " por " + selectedExtension.byName
                          : "") +
                        " em " +
                        formatDate(selectedExtension.at) +
                        (selectedExtension.from
                          ? " · era " + formatDate(selectedExtension.from)
                          : "")}
                    </small>
                  ) : null}
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

            {selectedActive ? (
              <div className="detail__row">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setExtendLoan(selected)}
                >
                  <IconPlus width={16} height={16} aria-hidden="true" />
                  Estender prazo
                </button>
              </div>
            ) : null}

            {/* Cobranca: so com o livro atrasado. Uma a cada 30 dias, com
                quem cobrou por ultimo. O botao abre a conversa da pessoa na
                secao Conversas (pages/Conversations.jsx), com a mensagem pronta. */}
            {selectedLate ? (
              <div className="charge-box">
                <div className="charge-box__text">
                  <strong>
                    {Math.abs(details.daysLeft) +
                      (Math.abs(details.daysLeft) === 1
                        ? " dia de atraso"
                        : " dias de atraso")}
                  </strong>
                  <span>
                    {selected.overdueSentAt
                      ? "Cobrado no WhatsApp" +
                        (selected.overdueSentByName
                          ? " por " + selected.overdueSentByName
                          : "") +
                        " em " +
                        formatDate(selected.overdueSentAt) +
                        "."
                      : "Ninguém cobrou ainda."}
                    {selectedNextCharge
                      ? " Nova cobrança liberada em " +
                        formatDate(selectedNextCharge) +
                        "."
                      : ""}
                    {!selected.personPhone
                      ? " Sem WhatsApp no cadastro para cobrar."
                      : ""}
                  </span>
                </div>
                {selected.personPhone ? (
                  <button
                    type="button"
                    className="btn btn--whatsapp btn--sm charge-box__btn"
                    onClick={() => navigate("/conversas?cobrar=" + selected._id)}
                    disabled={!canCharge(selected)}
                  >
                    <IconWhatsapp width={17} height={17} aria-hidden="true" />
                    Cobrar no WhatsApp
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Em andamento: a observacao aparece aqui e e escrita na janela
                do meio da tela (ver "Observação do empréstimo", abaixo). */}
            {selectedActive ? (
              <div className="detail__notes">
                <div className="detail__notes-head">
                  <h3>Observações</h3>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => openNote(selected)}
                  >
                    {selected.notes ? (
                      <IconEdit width={15} height={15} aria-hidden="true" />
                    ) : (
                      <IconPlus width={15} height={15} aria-hidden="true" />
                    )}
                    {selected.notes ? "Editar" : "Adicionar"}
                  </button>
                </div>
                {selected.notes ? (
                  <p className="detail__notes-text">{selected.notes}</p>
                ) : (
                  <p className="detail__notes-empty">
                    Nenhuma observação sobre esse empréstimo.
                  </p>
                )}
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

      {/* Observacao: no meio da tela, com tudo atras desfocado. */}
      <Modal
        open={Boolean(noteLoan)}
        onClose={() => {
          if (savingNotes) return;
          // O "x" e o Esc perguntam antes de jogar fora o que foi escrito.
          if (notesDraft !== (noteLoan?.notes || "")) setAskDiscard(true);
          else setNoteLoan(null);
        }}
        // Tocar sem querer no fundo desfocado nao apaga o texto.
        closeOnBackdrop={false}
        title="Observação do empréstimo"
        size="sm"
        placement="center"
        className="modal--note"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setNoteLoan(null)}
              disabled={savingNotes}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="note-form"
              className="btn btn--primary"
              disabled={
                savingNotes || notesDraft === (noteLoan?.notes || "")
              }
            >
              <IconCheck width={17} height={17} aria-hidden="true" />
              {savingNotes ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {noteLoan ? (
          <form id="note-form" className="note" onSubmit={saveNotes}>
            <p className="note__about">
              <strong>“{formatBookTitle(noteLoan.bookTitle)}”</strong> com{" "}
              {noteLoan.personName}
            </p>
            <textarea
              className="note__field"
              rows={6}
              maxLength={2000}
              placeholder="Escreva aqui a observação sobre esse empréstimo…"
              aria-label="Observação"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              ref={noteFieldRef}
            />
            <small className="note__count" aria-hidden="true">
              {notesDraft.length + " / 2000"}
            </small>
          </form>
        ) : null}
      </Modal>

      <Confirm
        open={askDiscard}
        title="Descartar a observação?"
        message="O que você escreveu ainda não foi salvo e vai se perder."
        cancelLabel="Continuar escrevendo"
        confirmLabel="Descartar"
        tone="danger"
        onCancel={() => {
          setAskDiscard(false);
          // Volta a escrever: o cursor retorna ao campo (o Modal nao devolve
          // o foco a campo de texto).
          requestAnimationFrame(() => noteFieldRef.current?.focus());
        }}
        onConfirm={() => {
          setAskDiscard(false);
          setNoteLoan(null);
        }}
      />

      <ExtendDueModal
        loan={extendLoan}
        notify={notify}
        onClose={() => setExtendLoan(null)}
        onSaved={(updated) => {
          setExtendLoan(null);
          replaceLoan(updated);
        }}
        onChanged={(fresh) => {
          // Outro administrador mudou o prazo (ou devolveu): a janela passa
          // a mostrar o de agora; devolvido, ela fecha.
          replaceLoan(fresh);
          setExtendLoan(fresh.status === "ativo" ? fresh : null);
        }}
      />
    </div>
  );
}
