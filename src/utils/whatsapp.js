import { parsePhoneNumberFromString } from "libphonenumber-js";
import { formatLongDate, loanProgress, parseDate } from "./dates.js";
import { formatBookTitle } from "./bookTitle.js";

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
  const book = '"' + formatBookTitle(loan.bookTitle) + '"';
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

// ---------- Solicitar emprestimo (acervo publico) ----------

// WhatsApp da biblioteca: para onde vai a mensagem de "Solicitar empréstimo".
export const LIBRARY_WHATSAPP = "5534996560351";

// "sexta-feira, 30 de outubro de 2026"
export function formatPickupDay(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// "Fulano", "Fulano e Beltrano", "Fulano, Beltrano e Sicrano".
function joinNames(names) {
  const list = (names || []).map((name) => String(name).trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  return list.slice(0, -1).join(", ") + " e " + list[list.length - 1];
}

// Endereco do link que vai no fim da mensagem (ver pages/RequestLink.jsx e
// frontend/api/solicitacao.js, que monta a previa com a capa do livro).
export function requestLinkUrl(token) {
  return window.location.origin + "/solicitacao/" + encodeURIComponent(token);
}

/**
 * A mensagem que a pessoa manda para a biblioteca. link pode faltar (o
 * servidor nao respondeu): a equipe registra a solicitacao na mao.
 */
export function buildRequestMessage({ book, name, pickupDate, link }) {
  const authors = joinNames(book.authors);
  return (
    "Olá! A paz do Senhor! 🙏\n\n" +
    "Meu nome é " + name + " e gostaria de pegar emprestado o livro \"" +
    formatBookTitle(book.title) + "\"" +
    (authors ? ", de " + authors : "") +
    ", da Biblioteca ADMP Brasil.\n\n" +
    "📅 Dia de preferência para pegar o livro: " +
    formatPickupDay(pickupDate) + ".\n\n" +
    "Podemos combinar a retirada com um dos administradores? Desde já, agradeço! 📚" +
    (link ? "\n\nLink da solicitação (para a equipe da biblioteca):\n" + link : "")
  );
}

export function libraryWhatsappUrl(text) {
  return (
    "https://wa.me/" + LIBRARY_WHATSAPP + "?text=" + encodeURIComponent(text)
  );
}
