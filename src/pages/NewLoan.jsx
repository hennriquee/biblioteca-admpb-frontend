import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import SamePersonDialog from "../components/SamePersonDialog.jsx";
import BookCover from "../components/BookCover.jsx";
import { todayInputValue, addDaysInputValue } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { matchesBook } from "../utils/bookFilter.js";
import { IconSearch, IconClose } from "../components/Icons.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { isValidPhoneNumber } from "libphonenumber-js";

// O servidor monta o aviso ("Fulana ja esta com Tal Livro.") com o titulo como
// foi salvo; aqui cada titulo e trocado pela versao no padrao do app.
function warningText(warning) {
  let text = warning?.error || "";
  (warning?.activeLoans || []).forEach((loan) => {
    if (loan.bookTitle) {
      text = text.replace(loan.bookTitle, () => formatBookTitle(loan.bookTitle));
    }
  });
  return text;
}

export default function NewLoan() {
  const navigate = useNavigate();
  const { notify } = useToast();

  // Resultados guardam o texto a que respondem ("term"): so aparecem quando
  // batem com o que esta digitado agora. Assim, ao digitar mais uma letra, as
  // sugestoes da busca anterior somem na hora (entra "Buscando…").
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState({ term: "", items: [] });
  const [book, setBook] = useState(null);
  // O acervo inteiro, baixado ao abrir a tela: com ele a busca de livro
  // responde na hora, sem ir ao servidor a cada letra. null = ainda nao chegou
  // (ou falhou): ai a busca continua sendo feita no servidor.
  const [allBooks, setAllBooks] = useState(null);

  const [personName, setPersonName] = useState("");
  // Quem e a pessoa, de verdade: o id do cadastro dela. Fica preenchido quando
  // a pessoa e escolhida na lista de sugestoes; digitar o nome nele mesmo
  // limpa (um nome igual pode ser de outra pessoa - ver models/Person.js).
  const [personId, setPersonId] = useState(null);
  const [phone, setPhone] = useState("");
  const [personSuggestions, setPersonSuggestions] = useState({
    term: "",
    items: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [startDate, setStartDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(addDaysInputValue(21));
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState(null);
  // "Esse nome ja esta no cadastro. E a mesma pessoa?"
  const [samePerson, setSamePerson] = useState(null);

  const personBlurTimer = useRef(null);
  // Trava contra o clique duplo: dois toques rapidos em "Registrar" criariam
  // dois emprestimos do mesmo livro para a mesma pessoa.
  const submittingRef = useRef(false);

  const bookTerm = bookQuery.trim();
  const personTerm = personName.trim();

  useEffect(() => {
    let active = true;
    api("/api/books")
      .then((data) => {
        if (active) setAllBooks(data);
      })
      .catch(() => {
        /* sem o acervo na memoria, a busca abaixo usa o servidor */
      });
    return () => {
      active = false;
    };
  }, []);

  // Busca de livros conforme digita (so enquanto o acervo nao esta na memoria)
  useEffect(() => {
    if (allBooks || book || bookTerm.length < 2) return undefined;

    let active = true;
    const timer = setTimeout(async () => {
      let items = [];
      try {
        const data = await api(
          "/api/books?search=" + encodeURIComponent(bookTerm),
        );
        items = data.slice(0, 8);
      } catch {
        items = [];
      }
      if (active) setBookResults({ term: bookTerm, items });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bookTerm, book, allBooks]);

  // Sugestao de nomes ja cadastrados
  useEffect(() => {
    if (personTerm.length < 2) return undefined;

    let active = true;
    const timer = setTimeout(async () => {
      let items = [];
      try {
        items = await api(
          "/api/people?search=" + encodeURIComponent(personTerm),
        );
      } catch {
        items = [];
      }
      if (active) setPersonSuggestions({ term: personTerm, items });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [personTerm]);

  const bookSearchOn = !book && bookTerm.length >= 2;
  const bookSearching =
    bookSearchOn && !allBooks && bookResults.term !== bookTerm;
  const bookItems = useMemo(() => {
    if (!bookSearchOn) return [];
    if (allBooks) {
      return allBooks
        .filter((item) => matchesBook(item, { search: bookTerm }))
        .slice(0, 8);
    }
    return bookResults.term === bookTerm ? bookResults.items : [];
  }, [bookSearchOn, allBooks, bookTerm, bookResults]);

  // Sugestoes de nome so aparecem quando respondem ao que esta digitado agora
  // (as da busca anterior somem na hora). Sem aviso de "buscando": nome novo,
  // sem cadastro, e o caso comum, e o aviso ficaria empurrando o formulario.
  const personItems =
    showSuggestions &&
    personTerm.length >= 2 &&
    personSuggestions.term === personTerm
      ? personSuggestions.items
      : [];

  // extra: { force } (a pessoa confirmou que pode levar outro livro),
  // { personId } (e esta pessoa do cadastro) ou { newPerson } (e outra pessoa,
  // de nome igual).
  async function submitLoan(extra = {}) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api("/api/loans", {
        method: "POST",
        body: {
          bookId: book._id,
          personName: personName.trim(),
          personId,
          phone,
          startDate,
          dueDate: dueDate || null,
          notes,
          ...extra,
        },
      });
      notify("Empréstimo registrado.", "success");
      navigate("/emprestimos");
    } catch (error) {
      const code = error instanceof ApiError ? error.payload?.code : null;
      if (code === "PERSON_HAS_ACTIVE_LOAN") {
        setWarning(error.payload);
      } else if (code === "PERSON_NAME_EXISTS") {
        setSamePerson(error.payload);
      } else {
        notify(error.message, "error");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!book) return notify("Escolha o livro que vai sair.", "error");
    if (personName.trim().split(/\s+/).length < 2) {
      return notify("Digite o nome completo da pessoa.", "error");
    }
    if (phone && !isValidPhoneNumber("+" + phone)) {
      return notify(
        "WhatsApp inválido. Confira o país, o DDD e o número.",
        "error",
      );
    }
    if (dueDate && dueDate < startDate) {
      return notify(
        "A data de devolução não pode ser anterior à retirada.",
        "error",
      );
    }
    return submitLoan();
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Novo empréstimo</h1>
          <p className="page__sub">Registre quem levou e até quando</p>
        </div>
      </div>

      <form className="card form" onSubmit={handleSubmit}>
        {/* Livro */}
        <div className="field">
          <span className="field__label">Livro</span>

          {book ? (
            <div className="picked">
              <BookCover src={book.cover} alt="" className="cover--sm" />
              <div>
                <strong title={formatBookTitle(book.title)}>
                  {formatBookTitle(book.title)}
                </strong>
                <small title={(book.authors || []).join(", ") || undefined}>
                  {book.isbn || (book.authors || []).join(", ")}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setBook(null);
                  setBookQuery("");
                }}
                aria-label="Trocar livro"
              >
                <IconClose width={18} height={18} />
              </button>
            </div>
          ) : (
            <div className="combo">
              <div className="searchbar">
                <IconSearch width={18} height={18} />
                <input
                  type="search"
                  placeholder="Procurar pelo nome ou ISBN"
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                />
              </div>

              {bookSearching ? (
                <p className="combo__wait" role="status">
                  Buscando livros…
                </p>
              ) : null}

              {bookSearchOn && !bookSearching && bookItems.length === 0 ? (
                <p className="combo__wait">Nenhum livro encontrado.</p>
              ) : null}

              {bookItems.length > 0 ? (
                <ul className="combo__list">
                  {bookItems.map((item) => (
                    <li key={item._id}>
                      <button
                        type="button"
                        className="combo__item"
                        disabled={item.available <= 0}
                        onClick={() => {
                          setBook(item);
                          setBookResults({ term: "", items: [] });
                        }}
                      >
                        <BookCover
                          src={item.cover}
                          alt=""
                          className="cover--xs"
                        />
                        <span>
                          <strong title={formatBookTitle(item.title)}>
                            {formatBookTitle(item.title)}
                          </strong>
                          <small title={(item.authors || []).join(", ") || undefined}>
                            {(item.authors || []).join(", ") ||
                              item.isbn ||
                              "Autor não informado"}
                          </small>
                          {item.available <= 0 ? (
                            <small className="combo__status combo__status--out">
                              {item.copies > 1
                                ? "todas as unidades estão emprestadas"
                                : "já está com " +
                                  ((item.loanedNames || [])[0] || "alguém")}
                            </small>
                          ) : item.copies > 1 ? (
                            <small className="combo__status">
                              {item.available + " de " + item.copies + " disponíveis"}
                            </small>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>

        {/* Pessoa */}
        <div className="field">
          <span className="field__label">
            Nome completo de quem está levando
          </span>
          <div className="combo">
            <input
              type="text"
              value={personName}
              placeholder="Ex.: Maria Eduarda Nogueira"
              maxLength={80}
              onChange={(e) => {
                setPersonName(e.target.value);
                setPersonId(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                personBlurTimer.current = setTimeout(
                  () => setShowSuggestions(false),
                  150,
                );
              }}
              autoComplete="off"
              required
            />

            {personItems.length > 0 ? (
              <ul className="combo__list">
                {personItems.map((person) => (
                  <li key={person._id}>
                    <button
                      type="button"
                      className="combo__item combo__item--person"
                      onMouseDown={() => clearTimeout(personBlurTimer.current)}
                      onClick={() => {
                        setPersonName(person.fullName);
                        setPersonId(person._id);
                        setPhone(person.phone || "");
                        setShowSuggestions(false);
                      }}
                    >
                      <span>
                        <strong>
                          {(person.code ? "#" + person.code + " " : "") +
                            person.fullName}
                          {person.isAdmin ? (
                            <span className="chip chip--admin">admin</span>
                          ) : null}
                        </strong>
                        <small>
                          {person.phone
                            ? formatStoredPhone(person.phone)
                            : "sem WhatsApp"}
                        </small>
                        <small>
                          {person.activeLoans.length > 0
                            ? "está com " + person.activeLoans.join(", ")
                            : person.loansCount + " empréstimo(s) no histórico"}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="loan-phone">
            WhatsApp (opcional)
          </label>
          <PhoneInput id="loan-phone" value={phone} onChange={setPhone} />
          <small className="field__hint">
            Usado só para lembrar a pessoa da devolução do livro.
          </small>
        </div>

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
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="form__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate("/emprestimos")}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? "Registrando…" : "Registrar empréstimo"}
          </button>
        </div>
      </form>

      <SamePersonDialog
        open={Boolean(samePerson)}
        warning={samePerson}
        onCancel={() => setSamePerson(null)}
        onUsePerson={(person) => {
          setSamePerson(null);
          setPersonId(person._id);
          setPersonName(person.fullName);
          if (person.phone && !phone) setPhone(person.phone);
          submitLoan({ personId: person._id });
        }}
        onCreateNew={() => {
          setSamePerson(null);
          submitLoan({ newPerson: true });
        }}
      />

      <Confirm
        open={Boolean(warning)}
        title="Essa pessoa já tem um livro"
        message={warningText(warning) + " Tem certeza que quer emprestar outro?"}
        confirmLabel="Sim, emprestar"
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          submitLoan({ force: true });
        }}
      />
    </div>
  );
}
