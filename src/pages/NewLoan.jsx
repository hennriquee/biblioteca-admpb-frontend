import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import PersonFormModal from "../components/PersonFormModal.jsx";
import BookCover from "../components/BookCover.jsx";
import Avatar from "../components/Avatar.jsx";
import { todayInputValue, addDaysInputValue } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { matchesBook } from "../utils/bookFilter.js";
import { IconSearch, IconClose, IconPlus } from "../components/Icons.jsx";
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
  // Quem e a pessoa, de verdade: o id do cadastro dela. So fica preenchido
  // quando a pessoa e escolhida na lista de sugestoes (ou acabou de ser
  // cadastrada pelo "Cadastrar nova pessoa" abaixo) - digitar o nome nele
  // mesmo NAO basta, e de proposito: sem isso, um nome sem cadastro nenhum
  // levaria um livro sem ficha nenhuma para cobrar a devolucao depois.
  const [personId, setPersonId] = useState(null);
  // A ficha de quem foi escolhido na lista, para a tela mostrar a foto (ou as
  // iniciais) de quem ja esta cadastrado. null = ainda digitando um nome.
  const [pickedPerson, setPickedPerson] = useState(null);
  const [phone, setPhone] = useState("");
  const [personSuggestions, setPersonSuggestions] = useState({
    term: "",
    items: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Abre o MESMO formulario de cadastrar pessoa da tela de Usuarios, aqui
  // dentro - sem navegar para outra tela e sem perder livro, datas etc.
  const [creatingPerson, setCreatingPerson] = useState(false);

  const [startDate, setStartDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(addDaysInputValue(21));
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState(null);

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

  // Enquanto o termo digitado ainda nao tem resposta (o debounce de 250ms ou
  // o pedido ao servidor em andamento): mostra "Buscando…" no lugar da lista,
  // para a pessoa nunca ver (nem poder clicar) o "Cadastrar nova pessoa" ou
  // uma lista de uma busca ANTERIOR enquanto a de agora nao chegou - era
  // esse o risco de cadastrar alguem que, no instante seguinte, apareceria
  // na lista (busca que so nao tinha terminado ainda).
  const personSearching =
    personTerm.length >= 2 && personSuggestions.term !== personTerm;
  // Sugestoes de nome so aparecem quando respondem ao que esta digitado agora
  // (as da busca anterior somem na hora).
  const personItems =
    showSuggestions &&
    personTerm.length >= 2 &&
    personSuggestions.term === personTerm
      ? personSuggestions.items
      : [];
  const showPersonDropdown = showSuggestions && personTerm.length >= 2;

  // extra: { force } (a pessoa confirmou que pode levar outro livro).
  async function submitLoan(extra = {}) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api("/api/loans", {
        method: "POST",
        body: {
          bookId: book._id,
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
    if (!personId) {
      return notify(
        "Selecione a pessoa na lista de sugestões ou cadastre uma nova antes de continuar.",
        "error",
      );
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

  // A pessoa acabou de ser cadastrada pelo formulario embutido: ela passa a
  // ser a escolhida, do mesmo jeito que escolher alguem na lista de
  // sugestoes - sem precisar buscar de novo.
  function handlePersonCreated(created) {
    setCreatingPerson(false);
    setPersonId(created._id);
    setPickedPerson({ ...created, activeLoans: [] });
    setPersonName(created.fullName);
    if (created.phone && !phone) setPhone(created.phone);
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
          {/* Escolhida na lista (ou recem-cadastrada): a ficha dela aparece
              com a foto de perfil (ou as iniciais do nome), do mesmo jeito
              que o livro escolhido. E o sinal de que o emprestimo vai para
              ESTE cadastro, e nao para um nome digitado sem ficha nenhuma. */}
          {pickedPerson ? (
            <div className="picked">
              <Avatar
                src={pickedPerson.photo}
                name={pickedPerson.fullName}
                size={44}
              />
              <div>
                <strong title={pickedPerson.fullName}>
                  {(pickedPerson.code ? "#" + pickedPerson.code + " " : "") +
                    pickedPerson.fullName}
                </strong>
                <small>
                  {pickedPerson.phone
                    ? formatStoredPhone(pickedPerson.phone)
                    : "sem WhatsApp"}
                  {" · "}
                  {pickedPerson.activeLoans?.length > 0
                    ? "está com " + pickedPerson.activeLoans.join(", ")
                    : (pickedPerson.loansCount || 0) + " empréstimo(s) no histórico"}
                </small>
              </div>
              {pickedPerson.isAdmin ? (
                <span className="chip chip--admin">admin</span>
              ) : null}
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setPickedPerson(null);
                  setPersonId(null);
                  setPersonName("");
                  setPhone("");
                }}
                aria-label="Trocar pessoa"
              >
                <IconClose width={18} height={18} />
              </button>
            </div>
          ) : (
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

              {showPersonDropdown && personSearching ? (
                <p className="combo__wait" role="status">
                  Buscando pessoas…
                </p>
              ) : null}

              {showPersonDropdown && !personSearching && personItems.length === 0 ? (
                <p className="combo__wait">Pessoa não encontrada.</p>
              ) : null}

              {/* So aparece com a busca ja respondida (nunca durante o
                  "Buscando…"): clicar em "Cadastrar nova pessoa" antes de a
                  busca terminar poderia cadastrar de novo alguem que, no
                  instante seguinte, apareceria na propria lista. */}
              {showPersonDropdown && !personSearching ? (
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
                          setPickedPerson(person);
                          setPhone(person.phone || "");
                          setShowSuggestions(false);
                        }}
                      >
                        {/* A foto (ou as iniciais) de quem ja esta cadastrado:
                            e o que diferencia duas pessoas de nome parecido na
                            hora de escolher. */}
                        <Avatar
                          src={person.photo}
                          name={person.fullName}
                          size={36}
                        />
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
                              : person.loansCount +
                                " empréstimo(s) no histórico"}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                  {/* Sempre no fim da lista (ja respondida), ache ou nao ache
                      alguem parecido: quem nao esta cadastrado precisa de um
                      caminho para entrar no sistema antes de levar um livro. */}
                  <li>
                    <button
                      type="button"
                      className="combo__item combo__item--create"
                      onMouseDown={() => clearTimeout(personBlurTimer.current)}
                      onClick={() => {
                        setShowSuggestions(false);
                        setCreatingPerson(true);
                      }}
                    >
                      <span className="combo__create-icon" aria-hidden="true">
                        <IconPlus width={18} height={18} />
                      </span>
                      <span>
                        <strong>Cadastrar nova pessoa</strong>
                        <small>{'"' + personTerm + '"'}</small>
                      </span>
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          )}
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

      {/* Mesmo formulario da tela de Usuarios, aberto aqui dentro: livro,
          datas e observacoes continuam preenchidos por baixo (ver
          components/PersonFormModal.jsx). */}
      <PersonFormModal
        open={creatingPerson}
        person={null}
        initialFullName={personTerm}
        onClose={() => setCreatingPerson(false)}
        onSaved={handlePersonCreated}
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
