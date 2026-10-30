import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal, { isAnyModalOpen } from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { pickupWhen } from "./RequestDetailModal.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import { formatDate, todayInputValue } from "../utils/dates.js";

/**
 * LEMBRETE DE RETIRADAS, ao entrar no painel (montado em Layout.jsx).
 *
 * Solicitacao registrada que ainda nao virou emprestimo:
 * - retirada prevista HOJE: janela "Entregas de hoje";
 * - retirada prevista que JA PASSOU: janela "Solicitações em atraso".
 *
 * Cada administrador ve cada aviso de cada solicitacao uma vez so: fechando a
 * janela (pelo "x", Esc, "Fechar" ou "Ver solicitações"), o servidor guarda
 * que ELE ja viu (POST /api/requests/reminders/seen). A janela so volta a
 * abrir se aparecer solicitacao nova no assunto (ou se uma de "hoje" passar
 * para "em atraso", que e outro aviso). Quando abre, mostra todas as do
 * assunto, nao so as novas.
 *
 * Havendo os dois assuntos, abre uma janela e depois a outra. Nenhuma abre
 * por cima de outro modal (ex.: o "Registrar solicitação" do link do
 * WhatsApp), do menu de configuracoes, da tela de abertura do app nem no
 * meio de um campo que a pessoa esta preenchendo: espera a tela ficar livre.
 * (Se outro modal abrir DEPOIS, ele fica por cima - ver Modal.jsx.)
 *
 * Fechou numa aba, fecha tambem nas outras abas abertas deste aparelho.
 *
 * Confere ao abrir o painel e, com o painel aberto, quando o dia muda (app
 * deixado aberto de um dia para o outro).
 */

// Tela de abertura do app (AppSplash: 1,1 s + 0,4 s de fade) mais uma folga.
const SPLASH_MS = 1700;
// De quanto em quanto tempo olha se a tela ja esta livre para abrir a janela.
const WAIT_STEP_MS = 400;
// Pausa entre uma janela e a outra (as duas no mesmo lugar pareceriam uma so
// trocando de texto).
const BETWEEN_MS = 350;
// De quanto em quanto tempo confere se o dia virou com o painel aberto.
const DAY_CHECK_MS = 5 * 60 * 1000;
// Mesmo teto do servidor.
const MAX_IDS = 500;

// "Ja fechei" guardado tambem neste aparelho: se o aviso ao servidor falhar
// (sem internet), a janela nao reabre a cada entrada; na proxima conferida o
// aviso e mandado de novo. Sai daqui quando o servidor ja sabe. Sem
// localStorage (aba privada), fica so na memoria desta aba.
const STORE_KEY = "biblioteca:lembretes-retirada";
let memoryMarks = {};

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return memoryMarks;
  }
}

function readMarks(userId) {
  const mine = readAll()[userId] || {};
  return {
    today: new Set(Array.isArray(mine.today) ? mine.today : []),
    late: new Set(Array.isArray(mine.late) ? mine.late : []),
  };
}

function writeMarks(userId, marks) {
  const all = { ...readAll() };
  if (marks.today.size || marks.late.size) {
    all[userId] = { today: [...marks.today], late: [...marks.late] };
  } else {
    delete all[userId];
  }
  memoryMarks = all;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* fica so na memoria */
  }
}

// Algo na frente agora? Outro modal, o menu de configuracoes ou um campo de
// texto em uso (abrir no meio da digitacao tiraria o foco do campo).
function screenBusy() {
  if (isAnyModalOpen()) return true;
  if (document.querySelector(".drawer-backdrop, [data-modal-escape]")) return true;
  const active = document.activeElement;
  return Boolean(
    active &&
      (active.isContentEditable ||
        (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) &&
          !["button", "checkbox", "radio", "submit", "reset", "range"].includes(
            active.type,
          ))),
  );
}

// Todos os itens da janela ja estao marcados como fechados neste aparelho?
function allMarked(entry, marks) {
  return entry.items.every((item) => marks[entry.kind].has(String(item._id)));
}

function sendSeen(kind, ids) {
  return api("/api/requests/reminders/seen", {
    method: "POST",
    body: { kind, ids: ids.slice(0, MAX_IDS) },
  }).catch(() => {
    /* a marca deste aparelho segura; a proxima conferida manda de novo */
  });
}

const COPY = {
  today: {
    title: "Entregas de hoje",
    lead: (count) =>
      count === 1
        ? "Tem uma solicitação que precisa ser entregue hoje. A pessoa combinou de buscar o livro hoje e ele ainda não foi retirado."
        : "Tem " +
          count +
          " solicitações que precisam ser entregues hoje. As pessoas combinaram de buscar os livros hoje e eles ainda não foram retirados.",
  },
  late: {
    title: "Solicitações em atraso",
    lead: (count) =>
      (count === 1
        ? "Há uma solicitação que não foi retirada e está em atraso: o dia combinado já passou."
        : "Há " +
          count +
          " solicitações que não foram retiradas e estão em atraso: o dia combinado já passou.") +
      " Dê atenção a esses casos: confirme com a pessoa se ela ainda vem buscar ou exclua a solicitação para liberar o livro.",
  },
};

export default function PickupReminders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ? String(user.id) : "";

  // Janelas esperando a vez: [{ kind: "today" | "late", items }].
  const [queue, setQueue] = useState([]);
  // A janela aberta agora (ou null).
  const [showing, setShowing] = useState(null);
  const busyRef = useRef(false);
  busyRef.current = Boolean(showing) || queue.length > 0;
  // Dia (do aparelho) da ultima conferida que deu certo; "" = nenhuma ainda.
  const checkedDayRef = useRef("");
  const requestRef = useRef(0);
  const closedAtRef = useRef(-Infinity);

  const check = useCallback(async () => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    const token = getToken();
    let data;
    try {
      data = await api("/api/requests/reminders");
    } catch {
      return; // sem lembrete agora; tenta de novo na proxima conferida
    }
    // Resposta velha (outra conferida saiu depois) ou de outra sessao.
    if (requestId !== requestRef.current || token !== getToken()) return;
    // Uma janela abriu enquanto esta resposta vinha: ela segue; a proxima
    // conferida pega o resto.
    if (busyRef.current) return;
    checkedDayRef.current = todayInputValue();

    const marks = readMarks(userId);
    const next = [];
    for (const kind of ["today", "late"]) {
      const list = kind === "today" ? data?.dueToday : data?.late;
      const items = Array.isArray(list) ? list : [];
      // Fechadas aqui, mas o servidor ainda nao sabe: avisa de novo.
      const pendingHere = items
        .filter((item) => !item.seen && marks[kind].has(String(item._id)))
        .map((item) => String(item._id));
      if (pendingHere.length) sendSeen(kind, pendingHere);
      // A marca local so fica enquanto o servidor nao sabe.
      marks[kind] = new Set(pendingHere);
      const fresh = items.some(
        (item) => !item.seen && !marks[kind].has(String(item._id)),
      );
      if (fresh) next.push({ kind, items });
    }
    writeMarks(userId, marks);
    setQueue(next);
  }, [userId]);

  // Ao abrir o painel (e se outra conta entrar nesta aba).
  useEffect(() => {
    setShowing(null);
    setQueue([]);
    busyRef.current = false;
    checkedDayRef.current = "";
    check();
  }, [check]);

  // Painel aberto de um dia para o outro: confere de novo quando o dia vira
  // (ao voltar para a aba ou, com ela aberta, de tempos em tempos). Se a
  // primeira conferida falhou, tenta de novo nos mesmos momentos.
  useEffect(() => {
    function maybeCheck() {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      if (checkedDayRef.current === todayInputValue()) return;
      check();
    }
    const timer = setInterval(maybeCheck, DAY_CHECK_MS);
    document.addEventListener("visibilitychange", maybeCheck);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", maybeCheck);
    };
  }, [check]);

  // Abre a proxima janela da fila quando a tela estiver livre.
  useEffect(() => {
    if (showing || !queue.length) return undefined;
    function tryOpen() {
      const now = performance.now();
      if (now < SPLASH_MS || now - closedAtRef.current < BETWEEN_MS) return false;
      if (screenBusy()) return false;
      setShowing(queue[0]);
      setQueue(queue.slice(1));
      return true;
    }
    if (tryOpen()) return undefined;
    const timer = setInterval(tryOpen, WAIT_STEP_MS);
    return () => clearInterval(timer);
  }, [queue, showing]);

  // Outra aba deste aparelho fechou a janela: fecha aqui tambem (sem avisar o
  // servidor de novo - a outra aba ja avisou).
  useEffect(() => {
    if (!userId) return undefined;
    function onStorage(event) {
      if (event.key !== STORE_KEY) return;
      const marks = readMarks(userId);
      setShowing((current) => (current && allMarked(current, marks) ? null : current));
      setQueue((current) => current.filter((entry) => !allMarked(entry, marks)));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  function close(goToRequests) {
    if (!showing) return;
    const { kind, items } = showing;
    const ids = items.map((item) => String(item._id));
    const marks = readMarks(userId);
    ids.forEach((id) => marks[kind].add(id));
    writeMarks(userId, marks);
    sendSeen(kind, ids);
    closedAtRef.current = performance.now();
    setShowing(null);
    if (goToRequests) navigate("/emprestimos?filtro=solicitados");
  }

  const kind = showing?.kind || "today";
  const items = showing?.items || [];
  const copy = COPY[kind];
  const leadId = useId();

  return (
    <Modal
      open={Boolean(showing)}
      onClose={() => close(false)}
      title={copy.title}
      size="md"
      placement="center"
      className="modal--reminder"
      describedBy={leadId}
      closeOnBackdrop={false}
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => close(false)}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => close(true)}
          >
            Ver solicitações
          </button>
        </>
      }
    >
      <div className={"reminder reminder--" + kind}>
        <p className="reminder__lead" id={leadId}>{copy.lead(items.length)}</p>
        <ul className="reminder__list">
          {items.map((item) => {
            const title = formatBookTitle(item.bookTitle);
            return (
              <li key={item._id} className="reminder__item">
                <BookCover
                  src={item.bookCover}
                  alt={"Capa de " + title}
                  className="cover--sm"
                />
                <div className="reminder__text">
                  <strong title={title}>{title}</strong>
                  <span>{item.personName}</span>
                  <span className="reminder__when">
                    {kind === "today"
                      ? "retirada prevista para hoje"
                      : "retirada prevista para " +
                        formatDate(item.pickupDate) +
                        " · " +
                        pickupWhen(item.pickupDate)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
