// Converte "2026-03-14" ou uma data ISO completa para um objeto Date local,
// evitando o problema classico de fuso horario que troca o dia.
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (onlyDate) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Se vier um datetime ISO completo mas com hora zerada (00:00:00 UTC),
  // trata como "apenas data": usa os componentes UTC para criar uma data local,
  // evitando que o fuso horario do navegador jogue pro dia anterior.
  const isMidnightUTC =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isMidnightUTC) {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
  }

  return date;
}
export function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatLongDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(from, to = new Date()) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  const diff = startOfDay(b) - startOfDay(a);
  return Math.round(diff / 86400000);
}

export function loanProgress(startDate, dueDate, returnedAt = null) {
  const start = parseDate(startDate);
  const due = parseDate(dueDate);
  if (!start)
    return { percent: 0, daysWith: 0, daysLeft: null, overdue: false };

  // Se ja foi devolvido, a "data de hoje" para efeito de calculo passa a ser
  // o momento da devolucao: o card para de contar dias e a barra para de
  // se mexer, mesmo que o usuario deixe a tela aberta por dias.
  const returned = returnedAt ? parseDate(returnedAt) : null;
  const referenceDate = returned || new Date();
  const daysWith = Math.max(0, daysBetween(start, referenceDate));

  if (returned) {
    // Devolvido: barra sempre completa, independente do prazo combinado.
    return {
      percent: 100,
      daysWith,
      daysLeft: null,
      overdue: false,
      returned: true,
    };
  }

  if (!due)
    return {
      percent: 0,
      daysWith,
      daysLeft: null,
      overdue: false,
      openEnded: true,
    };

  const total = Math.max(1, daysBetween(start, due));
  const percent = Math.min(100, Math.round((daysWith / total) * 100));
  const daysLeft = daysBetween(referenceDate, due);

  return { percent, daysWith, daysLeft, overdue: daysLeft < 0, total };
}

export function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

export function addDaysInputValue(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}
