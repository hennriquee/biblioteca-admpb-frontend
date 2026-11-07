import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api, ApiError } from "../api/client.js";
import {
  addDaysToInput,
  dateInputValue,
  formatLongDate,
  loanProgress,
  todayInputValue,
} from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";

/**
 * "Estender prazo" de um emprestimo em andamento (em dia ou atrasado). A data
 * nova vem depois da combinada e nao antes de hoje (o servidor confere o
 * mesmo: PATCH /api/loans/:id/due). Os atalhos somam a partir da data
 * combinada ou, se ela ja passou, de hoje.
 *
 * - onSaved(emprestimo): prazo estendido (o emprestimo atualizado)
 * - onChanged(emprestimo): recusado porque o emprestimo mudou (vem o de agora)
 */
const SHORTCUTS = [7, 15, 30];

export default function ExtendDueModal({
  loan,
  onClose,
  onSaved,
  onChanged,
  notify,
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const today = todayInputValue();
  const current = loan ? dateInputValue(loan.dueDate) : "";
  // Primeiro dia que vale: o dia seguinte ao combinado, ou hoje se ele ja passou.
  const dayAfter = current ? addDaysToInput(current, 1) : today;
  const minDay = dayAfter > today ? dayAfter : today;
  // Base dos atalhos: a data combinada, ou hoje se ela ja passou.
  const base = current && current > today ? current : today;
  const late = loan
    ? loanProgress(loan.startDate, loan.dueDate).overdue
    : false;

  // Abre com o primeiro atalho ja escolhido. Recomeca a cada emprestimo
  // aberto e quando o prazo dele muda (outro administrador estendeu).
  useEffect(() => {
    if (loan) setValue(addDaysToInput(base, SHORTCUTS[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?._id, loan?.dueDate]);

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !loan) return;
    if (!value) return notify("Escolha a nova data de devolução.", "error");
    if (value < minDay) {
      return notify(
        current && minDay === dayAfter
          ? "Para estender, a nova data precisa ser depois de " +
              formatLongDate(current) +
              "."
          : "A nova data de devolução não pode ser antes de hoje.",
        "error",
      );
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await api("/api/loans/" + loan._id + "/due", {
        method: "PATCH",
        body: { dueDate: value },
      });
      notify(
        "Prazo estendido até " + formatLongDate(updated.dueDate) + ".",
        "success",
      );
      onSaved(updated);
    } catch (error) {
      notify(error.message, "error");
      // Recusa com o emprestimo de agora (outro administrador mudou o prazo).
      if (error instanceof ApiError && error.payload?.loan) {
        onChanged?.(error.payload.loan);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    return undefined;
  }

  return (
    <Modal
      open={Boolean(loan)}
      onClose={onClose}
      title="Estender prazo"
      size="sm"
      placement="center"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Voltar
          </button>
          <button
            type="submit"
            form="extend-form"
            className="btn btn--primary"
            disabled={saving}
          >
            {saving ? "Salvando…" : "Estender prazo"}
          </button>
        </>
      }
    >
      {loan ? (
        <form id="extend-form" className="extend" onSubmit={save}>
          <p className="extend__lead">
            <strong>“{formatBookTitle(loan.bookTitle)}”</strong> com{" "}
            {loan.personName}.{" "}
            {current ? (
              <>
                Devolução combinada para{" "}
                <span className={"nowrap" + (late ? " is-late" : "")}>
                  {formatLongDate(current)}
                </span>
                {late ? " (já passou)" : ""}.
              </>
            ) : (
              "Sem data de devolução combinada."
            )}
          </p>

          <div className="extend__shortcuts" role="group" aria-label="Atalhos">
            {SHORTCUTS.map((days) => {
              const day = addDaysToInput(base, days);
              return (
                <button
                  key={days}
                  type="button"
                  className={"extend__chip" + (value === day ? " is-active" : "")}
                  aria-pressed={value === day}
                  onClick={() => setValue(day)}
                >
                  {"+" + days + " dias"}
                </button>
              );
            })}
          </div>

          <label className="field">
            <span>Nova data de devolução</span>
            <input
              type="date"
              min={minDay}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
          <small className="field__hint">
            {late
              ? "Os atalhos contam a partir de hoje, porque o prazo já venceu."
              : current
                ? "Os atalhos contam a partir da devolução combinada."
                : "Os atalhos contam a partir de hoje."}{" "}
            O card do empréstimo passa a mostrar que o prazo foi estendido e por
            quem.
          </small>
        </form>
      ) : null}
    </Modal>
  );
}
