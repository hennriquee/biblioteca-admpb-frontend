import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import BookPicker from "../components/BookPicker.jsx";
import PersonPicker from "../components/PersonPicker.jsx";
import { todayInputValue } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import PhoneInput from "../components/PhoneInput.jsx";
import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { formatStoredPhone } from "../utils/whatsapp.js";

// O mesmo numero, mesmo escrito de outro jeito (ex.: com o 0 do DDD).
// Os dois lados sao so digitos com DDI, como o PhoneInput e o cadastro guardam.
export function samePhone(a, b) {
  const canonical = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return parsePhoneNumberFromString("+" + digits)?.number || "+" + digits;
  };
  return canonical(a) === canonical(b);
}

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
  // A devolucao comeca VAZIA de proposito: o administrador precisa combinar a
  // data com a pessoa e preencher, em vez de aceitar um prazo automatico.
  const [dueDate, setDueDate] = useState("");
  const dueDateRef = useRef(null);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState(null);

  // A pessoa ja tinha WhatsApp no cadastro e foi digitado outro: antes de
  // registrar, o "Tem certeza?" pergunta se o numero dela muda mesmo
  // ({ person, oldPhone, newPhone }). Quem respondeu "Alterar o número" nao e
  // perguntado de novo pelo mesmo numero (ex.: depois do aviso de que a pessoa
  // ja tem um livro): changeApprovedRef guarda { personId, phone }.
  const [phoneCheck, setPhoneCheck] = useState(null);
  const changeApprovedRef = useRef(null);
  // O que esta na tela agora: a releitura da ficha (abaixo) confere se a
  // pessoa e o numero ainda sao os mesmos quando a resposta chega.
  const currentRef = useRef({});
  currentRef.current = { person: pickedPerson, phone };
  // Saiu da tela (Cancelar, menu) durante a releitura: nada e registrado.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Trava contra o clique duplo: dois toques rapidos em "Registrar" criariam
  // dois emprestimos do mesmo livro para a mesma pessoa.
  const submittingRef = useRef(false);

  // extra: { force } (a pessoa confirmou que pode levar outro livro).
  // phoneValue: o numero a enviar (a resposta do "Tem certeza?" chega antes de
  // o estado "phone" ser atualizado).
  async function submitLoan(extra = {}, phoneValue = phone) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api("/api/loans", {
        method: "POST",
        body: {
          bookId: book._id,
          personId: pickedPerson._id,
          // O mesmo numero do cadastro vai vazio, que para o servidor e
          // "manter o da ficha" (routes/loans.js): se outro administrador
          // tiver acabado de corrigir o numero, a correcao dele fica.
          phone: samePhone(phoneValue, pickedPerson.phone) ? "" : phoneValue,
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
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
    if (!dueDate) {
      dueDateRef.current?.focus();
      return notify("Preencha a data de devolução combinada com a pessoa.", "error");
    }
    if (dueDate < startDate) {
      return notify(
        "A data de devolução não pode ser anterior à retirada.",
        "error",
      );
    }
    const person = pickedPerson;
    const typed = phone;
    let oldPhone = person.phone || "";
    // Numero diferente do que a tela conhece: rele a ficha antes de perguntar.
    // Outro administrador pode ter corrigido (ou cadastrado) o numero depois
    // que a pessoa foi escolhida - o "Tem certeza?" precisa mostrar o que
    // esta no cadastro AGORA. Sem resposta em 5 s, vale o que a tela sabia.
    if (typed && !samePhone(typed, oldPhone)) {
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const fresh = await api("/api/people/" + person._id, {
          signal:
            typeof AbortSignal.timeout === "function"
              ? AbortSignal.timeout(5000)
              : undefined,
        });
        oldPhone = fresh.phone || "";
        setPickedPerson((current) =>
          current && current._id === person._id
            ? { ...current, phone: oldPhone }
            : current,
        );
      } catch {
        /* sem resposta: segue com o numero que a tela ja conhecia */
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      if (!mountedRef.current) return undefined;
      // Trocou a pessoa ou o numero enquanto esperava: nada sai; o
      // administrador confere e toca em "Registrar" de novo.
      if (
        currentRef.current.person?._id !== person._id ||
        currentRef.current.phone !== typed
      ) {
        return notify(
          "A pessoa ou o WhatsApp mudou enquanto o cadastro era conferido. Confira e toque em Registrar de novo.",
          "error",
        );
      }
    }
    const approved = changeApprovedRef.current;
    if (
      typed &&
      oldPhone &&
      !samePhone(typed, oldPhone) &&
      !(
        approved &&
        approved.personId === person._id &&
        samePhone(approved.phone, typed)
      )
    ) {
      setPhoneCheck({ person, oldPhone, newPhone: typed });
      return undefined;
    }
    return submitLoan({}, typed);
  }

  // "Manter o número antigo": o campo volta para o numero do cadastro e o
  // emprestimo sai com ele.
  function keepOldPhone() {
    const { oldPhone } = phoneCheck;
    setPhoneCheck(null);
    setPhone(oldPhone);
    submitLoan({}, oldPhone);
  }

  // "Alterar o número": o numero novo passa a valer no cadastro da pessoa
  // (e nos emprestimos que ela tem em andamento - ver services/loans.js).
  function changePhone() {
    const { person, newPhone } = phoneCheck;
    changeApprovedRef.current = { personId: person._id, phone: newPhone };
    setPhoneCheck(null);
    submitLoan({}, newPhone);
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
              ref={dueDateRef}
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
        open={Boolean(phoneCheck)}
        title="Alterar o WhatsApp?"
        message={
          phoneCheck ? (
            <>
              Tem certeza que quer alterar o número de WhatsApp de{" "}
              <strong>{phoneCheck.person.fullName}</strong>? No cadastro está{" "}
              <strong className="nowrap">
                {formatStoredPhone(phoneCheck.oldPhone)}
              </strong>{" "}
              e foi digitado{" "}
              <strong className="nowrap">
                {formatStoredPhone(phoneCheck.newPhone)}
              </strong>
              . O número novo fica no cadastro e vale também para os
              empréstimos que essa pessoa já tem em andamento.
            </>
          ) : null
        }
        cancelLabel="Manter o número antigo"
        confirmLabel="Alterar o número"
        onCancel={keepOldPhone}
        onConfirm={changePhone}
        onDismiss={() => setPhoneCheck(null)}
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
