import { parsePhoneNumberFromString } from "libphonenumber-js";
import { formatDate, formatLongDate, loanProgress, parseDate } from "./dates.js";
import { formatBookTitle } from "./bookTitle.js";

// Mostra o numero salvo (so digitos com DDI) de forma legivel:
// 5534997885466 -> +55 34 99788 5466
// O WhatsApp guarda alguns celulares brasileiros SEM o 9 (553496560351):
// para mostrar, poe o 9 de volta (+55 34 99656-0351), como a pessoa conhece.
export function formatStoredPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (/^55\d{2}[6-9]\d{7}$/.test(digits)) digits = digits.slice(0, 4) + "9" + digits.slice(4);
  const parsed = digits ? parsePhoneNumberFromString("+" + digits) : null;
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

// ---------- Cobranca de atraso ----------
// No maximo uma cobranca a cada 30 dias por emprestimo (a regra vale no
// servidor: routes/loans.js). O botao so aparece com o livro atrasado.
export const CHARGE_INTERVAL_DAYS = 30;

// O mesmo numero com e sem o 9 de celular (Brasil e Argentina), como o servidor
// (backend/src/services/whatsapp/phone.js): so os digitos, sem o 9 que o
// WhatsApp as vezes tira.
export function canonicalPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{2}9\d{8}$/.test(digits)) return digits.slice(0, 4) + digits.slice(5);
  if (/^549\d{10}$/.test(digits)) return "54" + digits.slice(3);
  return digits;
}

export function samePhone(a, b) {
  const first = canonicalPhone(a);
  return Boolean(first) && first === canonicalPhone(b);
}

export function isLoanOverdue(loan) {
  return reminderKind(loan) === "late";
}

// O dia (inicio do dia) em que a proxima cobranca fica liberada, ou null se
// ja pode. Conta por DIA, como o servidor: cobrado no dia 7, libera no dia 7
// do mes seguinte, a qualquer hora.
export function nextChargeAt(loan) {
  if (!loan.overdueSentAt) return null;
  const sent = new Date(loan.overdueSentAt);
  if (Number.isNaN(sent.getTime())) return null;
  const next = new Date(
    sent.getFullYear(),
    sent.getMonth(),
    sent.getDate() + CHARGE_INTERVAL_DAYS,
  );
  return next > new Date() ? next : null;
}

// Pode cobrar agora: em atraso, com WhatsApp e sem cobranca nos ultimos 30 dias.
export function canCharge(loan) {
  return isLoanOverdue(loan) && Boolean(loan.personPhone) && !nextChargeAt(loan);
}

// Por que a cobranca nao pode sair agora (texto para a tela), ou "" se pode.
export function chargeBlockReason(loan) {
  if (loan.status !== "ativo") return "Esse empréstimo já foi devolvido.";
  if (!loan.personPhone) return "Esse empréstimo não tem WhatsApp cadastrado.";
  if (!isLoanOverdue(loan)) {
    return "O prazo desse empréstimo ainda não venceu: a cobrança só vale para livro atrasado.";
  }
  const next = nextChargeAt(loan);
  if (next) {
    return (
      (loan.overdueSentByName || "Alguém") +
      " já cobrou em " +
      formatDate(loan.overdueSentAt) +
      ". Nova cobrança liberada em " +
      formatDate(next) +
      "."
    );
  }
  return "";
}

// Gerador repetivel a partir de um texto (o mesmo de
// backend/src/services/whatsapp/humanize.js): o MESMO emprestimo da sempre o
// mesmo texto (a tela compara o rascunho com ele), emprestimos diferentes dao
// textos diferentes - o WhatsApp desconfia do mesmo texto copiado para muita
// gente.
function seededRng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWith(rng, list) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

const MESSAGE_OPENINGS = [
  "Olá, {first}! A paz do Senhor! 🙏",
  "Oi, {first}! A paz do Senhor! 🙏",
  "Olá, {first}, tudo bem? A paz! 🙏",
  "{first}, a paz do Senhor! Tudo bem? 🙏",
  "Oi, {first}, tudo bem?",
];
const LATE_BODIES = [
  "Aqui é da Biblioteca ADMP Brasil. O livro {book} estava combinado para ser devolvido em {date}.",
  "Aqui é da Biblioteca ADMP Brasil. A devolução do livro {book} estava marcada para {date}.",
  "Quem fala é a Biblioteca ADMP Brasil. O prazo do livro {book} terminou em {date}.",
  "Aqui é da Biblioteca ADMP Brasil. Vimos que o livro {book} era para ter voltado em {date}.",
];
const LATE_ASKS = [
  "Sabemos que a rotina é corrida, mas você consegue devolvê-lo assim que possível?",
  "Você consegue trazê-lo de volta nos próximos dias?",
  "Quando puder, consegue fazer a devolução?",
  "Sabemos que o dia a dia é corrido. Consegue devolver assim que possível?",
];
const LATE_REASONS = [
  "Outras pessoas também gostariam de ler.",
  "Tem mais gente querendo ler.",
  "Outros leitores estão esperando por ele.",
  "",
];
const SOON_BODIES = [
  "Aqui é da Biblioteca ADMP Brasil. Passando para lembrar com carinho que o livro {book} deve ser devolvido em {date}.",
  "Aqui é da Biblioteca ADMP Brasil. Só um lembrete: a devolução do livro {book} é em {date}.",
  "Quem fala é a Biblioteca ADMP Brasil. Lembrando que o livro {book} deve voltar em {date}.",
];
const MESSAGE_CLOSINGS = [
  "Se precisar de mais tempo, é só nos avisar. Muito obrigado! 📚",
  "Se precisar de mais alguns dias, é só falar. Obrigado! 📚",
  "Qualquer coisa, é só responder por aqui. Muito obrigado! 📚",
  "Se precisar de mais prazo, nos avise. Deus abençoe! 📚",
];

export function buildMessage(loan) {
  const first = String(loan.personName || "").split(" ")[0];
  const book = '"' + formatBookTitle(loan.bookTitle) + '"';
  const kind = reminderKind(loan);
  const rng = seededRng(
    String(loan._id || loan.personName || "") + "|" + String(loan.dueDate || "") + "|" + kind,
  );
  const fill = (text) =>
    text
      .replace("{first}", first)
      .replace("{book}", book)
      .replace("{date}", formatLongDate(loan.dueDate));
  const opening = first ? fill(pickWith(rng, MESSAGE_OPENINGS)) : "Olá! A paz do Senhor! 🙏";

  if (kind === "late") {
    const reason = pickWith(rng, LATE_REASONS);
    return (
      opening +
      "\n\n" +
      fill(pickWith(rng, LATE_BODIES)) +
      "\n\n" +
      pickWith(rng, LATE_ASKS) +
      (reason ? " " + reason : "") +
      " " +
      pickWith(rng, MESSAGE_CLOSINGS)
    );
  }

  return (
    opening +
    "\n\n" +
    fill(pickWith(rng, SOON_BODIES)) +
    "\n\n" +
    pickWith(rng, MESSAGE_CLOSINGS)
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

// WhatsApp BRASILEIRO da biblioteca: o MODELO ANTIGO do "Solicitar
// empréstimo", guardado como reserva. Hoje quem escolhe o numero e o servidor
// (resposta de POST /api/public/requests: "whatsapp" e "via"): normalmente o
// numero da biblioteca conectado ao painel (+54), onde o robo confirma o
// pedido e avisa o administrador; este brasileiro quando o servidor manda
// (REQUESTS_WHATSAPP=brasil no Render, ou o WhatsApp do painel fora do ar) e
// quando o servidor nem responde (mensagem sem o link).
export const LIBRARY_WHATSAPP = "5534984241556";

// O numero que o servidor mandou usar, ou o brasileiro de reserva.
export function requestWhatsapp(data) {
  const number = String(data?.whatsapp || "");
  if (/^\d{10,15}$/.test(number)) {
    return { number, via: data.via === "robo" ? "robo" : "brasil" };
  }
  return { number: LIBRARY_WHATSAPP, via: "brasil" };
}

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
 * servidor nao respondeu): a equipe registra a solicitacao na mao. isNew: a
 * pessoa nao esta no cadastro (tocou em "Nao sou nenhuma dessas pessoas", ou
 * o nome nao foi achado) - vai "(novo cadastro)" logo depois do nome, em
 * NEGRITO no WhatsApp (os asteriscos em volta), para a equipe ver de cara.
 */
export function buildRequestMessage({
  book,
  name,
  isNew = false,
  pickupDate,
  link,
}) {
  const authors = joinNames(book.authors);
  return (
    "Olá, meu nome é " +
    name +
    (isNew ? " *(novo cadastro)*" : "") +
    ' e gostaria de pegar emprestado o livro "' +
    formatBookTitle(book.title) +
    '"' +
    (authors ? ", de " + authors : "") +
    ", da Biblioteca ADMP Brasil.\n\n" +
    "📅 Dia de preferência para pegar o livro: " +
    formatPickupDay(pickupDate) +
    ".\n\n" +
    "Podemos combinar a retirada com um dos administradores? Desde já, agradeço! 📚" +
    (link
      ? "\n\nLink da solicitação (para a equipe da biblioteca):\n" + link
      : "")
  );
}

export function libraryWhatsappUrl(text, number = LIBRARY_WHATSAPP) {
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
}

// O mesmo, pelo endereco do proprio aplicativo: no Android abre o WhatsApp
// direto, sem a aba em branco do wa.me (ver components/RequestLoanModal.jsx).
export function libraryWhatsappAppUrl(text, number = LIBRARY_WHATSAPP) {
  return (
    "whatsapp://send?phone=" + number + "&text=" + encodeURIComponent(text)
  );
}
