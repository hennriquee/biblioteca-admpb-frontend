import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import BookCover from "../components/BookCover.jsx";
import { todayInputValue, addDaysInputValue } from "../utils/dates.js";
import { IconSearch, IconClose } from "../components/Icons.jsx";

export default function NewLoan() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState([]);
  const [book, setBook] = useState(null);

  const [personName, setPersonName] = useState("");
  const [personSuggestions, setPersonSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [startDate, setStartDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(addDaysInputValue(21));
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState(null);

  const personBlurTimer = useRef(null);

  // Busca de livros conforme digita
  useEffect(() => {
    if (book || bookQuery.trim().length < 2) {
      setBookResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api(
          "/api/books?search=" + encodeURIComponent(bookQuery.trim()),
        );
        setBookResults(data.slice(0, 8));
      } catch {
        setBookResults([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [bookQuery, book]);

  // Sugestao de nomes ja cadastrados
  useEffect(() => {
    if (personName.trim().length < 2) {
      setPersonSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api(
          "/api/people?search=" + encodeURIComponent(personName.trim()),
        );
        setPersonSuggestions(data);
      } catch {
        setPersonSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [personName]);

  async function submitLoan(force = false) {
    setSubmitting(true);
    try {
      await api("/api/loans", {
        method: "POST",
        body: {
          bookId: book._id,
          personName: personName.trim(),
          startDate,
          dueDate: dueDate || null,
          notes,
          force,
        },
      });
      notify("Empréstimo registrado.", "success");
      navigate("/emprestimos");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.payload?.code === "PERSON_HAS_ACTIVE_LOAN"
      ) {
        setWarning(error.payload);
      } else {
        notify(error.message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!book) return notify("Escolha o livro que vai sair.", "error");
    if (personName.trim().split(/\s+/).length < 2) {
      return notify("Digite o nome completo da pessoa.", "error");
    }
    if (dueDate && dueDate < startDate) {
      return notify(
        "A data de devolucao nao pode ser antes da retirada.",
        "error",
      );
    }
    return submitLoan(false);
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
                <strong>{book.title}</strong>
                <small>{book.isbn || (book.authors || []).join(", ")}</small>
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

              {bookResults.length > 0 ? (
                <ul className="combo__list">
                  {bookResults.map((item) => (
                    <li key={item._id}>
                      <button
                        type="button"
                        className="combo__item"
                        disabled={Boolean(item.loanedTo)}
                        onClick={() => {
                          setBook(item);
                          setBookResults([]);
                        }}
                      >
                        <BookCover
                          src={item.cover}
                          alt=""
                          className="cover--xs"
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.loanedTo
                              ? "ja esta com " + item.loanedTo
                              : (item.authors || []).join(", ") || item.isbn}
                          </small>
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
              onChange={(e) => {
                setPersonName(e.target.value);
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

            {showSuggestions && personSuggestions.length > 0 ? (
              <ul className="combo__list">
                {personSuggestions.map((person) => (
                  <li key={person._id}>
                    <button
                      type="button"
                      className="combo__item combo__item--person"
                      onMouseDown={() => clearTimeout(personBlurTimer.current)}
                      onClick={() => {
                        setPersonName(person.fullName);
                        setShowSuggestions(false);
                      }}
                    >
                      <span>
                        <strong>{person.fullName}</strong>
                        <small>
                          {person.activeLoans.length > 0
                            ? "esta com " + person.activeLoans.join(", ")
                            : person.loansCount + " empréstimo(s) no historico"}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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

      <Confirm
        open={Boolean(warning)}
        title="Essa pessoa ja tem um livro"
        message={
          (warning?.error || "") + " Tem certeza que quer emprestar outro?"
        }
        confirmLabel="Sim, emprestar"
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          submitLoan(true);
        }}
      />
    </div>
  );
}
