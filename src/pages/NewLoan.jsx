import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import BookPicker from "../components/BookPicker.jsx";
import PersonPicker from "../components/PersonPicker.jsx";
import { todayInputValue, addDaysInputValue } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import PhoneInput from "../components/PhoneInput.jsx";
import { isValidPhoneNumber } from "libphonenumber-js";

// O servidor monta o aviso ("Fulana ja esta com Tal Livro.") com o titulo como
// foi salvo; aqui cada titulo e trocado pela versao no padrao do app.
export function warningText(warning) {
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

  // O livro escolhido. Livro sem exemplar na estante (emprestado ou
  // SOLICITADO) nao pode ser escolhido aqui: o solicitado so sai pela propria
  // solicitacao, em Emprestimos > Solicitados (ver components/BookPicker.jsx).
  const [book, setBook] = useState(null);

  // Quem e a pessoa, de verdade: a ficha escolhida na lista de sugestoes (ou
  // recem-cadastrada pelo "Cadastrar nova pessoa") - digitar o nome NAO basta
  // (ver components/PersonPicker.jsx).
  const [pickedPerson, setPickedPerson] = useState(null);
  const [phone, setPhone] = useState("");

  const [startDate, setStartDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState(addDaysInputValue(21));
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState(null);

  // Trava contra o clique duplo: dois toques rapidos em "Registrar" criariam
  // dois emprestimos do mesmo livro para a mesma pessoa.
  const submittingRef = useRef(false);

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
          personId: pickedPerson._id,
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
    if (!pickedPerson) {
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
          <BookPicker
            picked={book}
            onPick={setBook}
            onClear={() => setBook(null)}
          />
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
          <PersonPicker
            picked={pickedPerson}
            onPick={(person, how) => {
              setPickedPerson(person);
              // Escolhida na lista: vale o WhatsApp da ficha. Recem-cadastrada:
              // o numero do cadastro so entra se nada foi digitado aqui.
              if (how === "list") setPhone(person.phone || "");
              else setPhone((current) => current || person.phone || "");
            }}
            onClear={() => {
              setPickedPerson(null);
              setPhone("");
            }}
          />
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
