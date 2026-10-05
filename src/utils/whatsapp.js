import { parsePhoneNumberFromString } from "libphonenumber-js";
import { formatLongDate, loanProgress } from "./dates.js";

// Mostra o numero salvo (so digitos com DDI) de forma legivel:
// 5534997885466 -> +55 34 99788-5466
export function formatStoredPhone(phone) {
  const parsed = phone ? parsePhoneNumberFromString("+" + phone) : null;
  return parsed ? parsed.formatInternational() : phone || "";
}

// Diz em qual situacao o emprestimo esta, para escolher a mensagem:
// "late" (prazo vencido), "soon" (faltam 3 dias ou menos) ou "ok".
export function reminderKind(loan) {
  if (loan.status !== "ativo" || !loan.dueDate) return "ok";
  const { daysLeft } = loanProgress(loan.startDate, loan.dueDate);
  if (daysLeft < 0) return "late";
  if (daysLeft <= 3) return "soon";
  return "ok";
}

export function buildMessage(loan) {
  const first = String(loan.personName || "").split(" ")[0];
  const book = '"' + loan.bookTitle + '"';
  const kind = reminderKind(loan);

  if (kind === "late") {
    return (
      "Olá, " + first + "! A paz do Senhor! 🙏\n\n" +
      "Aqui é da Biblioteca ADMP Brasil. O livro " + book +
      " estava combinado para ser devolvido em " +
      formatLongDate(loan.dueDate) + ".\n\n" +
      "Sabemos que a rotina é corrida, mas você consegue devolvê-lo assim que possível? " +
      "Outras pessoas também gostariam de ler. Se precisar de mais tempo, é só nos avisar. " +
      "Muito obrigado! 📚"
    );
  }

  return (
    "Olá, " + first + "! A paz do Senhor! 🙏\n\n" +
    "Aqui é da Biblioteca ADMP Brasil. Passando para lembrar com carinho que o livro " +
    book + " deve ser devolvido em " + formatLongDate(loan.dueDate) + ".\n\n" +
    "Se precisar de mais tempo, é só nos avisar. Muito obrigado! 📚"
  );
}

export function whatsappLink(loan) {
  return (
    "https://wa.me/" +
    loan.personPhone +
    "?text=" +
    encodeURIComponent(buildMessage(loan))
  );
}
