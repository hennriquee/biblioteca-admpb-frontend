import { formatLongDate, loanProgress } from "./dates.js";

// Mascara enquanto digita: (83) 99999-8888
export function maskPhone(value) {
  const d = String(value || "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "")
    .slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  if (d.length <= 10)
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
}

// Mostra um numero salvo (5583999998888) como (83) 99999-8888
export function formatStoredPhone(phone) {
  return maskPhone(phone);
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
