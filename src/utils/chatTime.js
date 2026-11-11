// Horas e dias das conversas, no fuso do aparelho.

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(later, earlier) {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / 86400000);
}

/** Chave do dia ("2026-11-10"), para separar as mensagens por dia. */
export function dayKey(value) {
  const date = toDate(value);
  if (!date) return "";
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

/** "14:32" */
export function formatClock(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Titulo do dia no meio da conversa: "Hoje", "Ontem", "12 de outubro". */
export function dayLabel(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return "";
  const diff = daysBetween(now, date);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Hora que aparece na lista de conversas: "14:32", "Ontem", "seg.", "12/10/2026". */
export function listTime(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return "";
  const diff = daysBetween(now, date);
  if (diff <= 0) return formatClock(date);
  if (diff === 1) return "Ontem";
  if (diff < 7) return date.toLocaleDateString("pt-BR", { weekday: "short" });
  return date.toLocaleDateString("pt-BR");
}
