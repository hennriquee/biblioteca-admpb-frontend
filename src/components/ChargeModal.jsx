import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api, ApiError } from "../api/client.js";
import { IconWhatsapp } from "./Icons.jsx";
import { formatDate } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { CHARGE_INTERVAL_DAYS, whatsappLink } from "../utils/whatsapp.js";

/**
 * "Cobrar no WhatsApp" (emprestimo atrasado): no meio da tela, com o simbolo
 * do WhatsApp grande em cima, explica que a proxima cobranca so fica liberada
 * daqui a 30 dias - e so se o livro ainda estiver atrasado.
 *
 * O servidor registra a cobranca ANTES de o WhatsApp abrir (ver
 * PATCH /api/loans/:id/notified): e ele quem decide se ela pode sair. Como o
 * navegador so deixa abrir aba nova no proprio clique, a aba abre em branco
 * na hora e recebe o endereco do WhatsApp quando o servidor responde; se ele
 * recusar (outro administrador acabou de cobrar), a aba fecha. Se o navegador
 * nao deixou abrir a aba, a janela fica aberta com o botao "Abrir o WhatsApp"
 * (um link de verdade, que abre no toque).
 *
 * - onCharged(emprestimo): cobranca registrada (o emprestimo atualizado)
 * - onRefused(mensagem, emprestimo|null, semResposta): o servidor nao deixou,
 *   ou a resposta nao chegou (semResposta: a tela confere de novo)
 */
export default function ChargeModal({ loan, onClose, onCharged, onRefused }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Cobranca registrada, mas a aba nao abriu: o endereco do WhatsApp.
  const [pendingUrl, setPendingUrl] = useState("");

  useEffect(() => {
    setPendingUrl("");
  }, [loan?._id]);

  const today = new Date();
  const nextDay = formatDate(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + CHARGE_INTERVAL_DAYS,
    ),
  );
  const first = String(loan?.personName || "").split(" ")[0];

  async function charge() {
    if (busyRef.current || !loan) return;
    busyRef.current = true;
    setBusy(true);
    // Aba aberta ja, ainda no clique.
    let tab = null;
    try {
      tab = window.open("", "_blank");
      if (tab) {
        tab.opener = null;
        tab.document.title = "Abrindo o WhatsApp…";
        tab.document.body.style.cssText =
          "font:16px system-ui,sans-serif;color:#555;display:grid;place-items:center;height:100vh;margin:0";
        tab.document.body.textContent = "Abrindo o WhatsApp…";
      }
    } catch {
      /* sem aba previa: a janela oferece o link depois */
    }
    try {
      const updated = await api("/api/loans/" + loan._id + "/notified", {
        method: "PATCH",
      });
      const url = whatsappLink(updated);
      if (tab && !tab.closed) {
        tab.location.href = url;
        onCharged(updated);
      } else {
        // Bloqueador de janelas: a cobranca ja esta registrada; o link abre
        // no proximo toque.
        setPendingUrl(url);
        onCharged(updated, { keepOpen: true });
      }
    } catch (error) {
      try {
        tab?.close();
      } catch {
        /* ja fechada */
      }
      const payload = error instanceof ApiError ? error.payload : null;
      const noAnswer = !(error instanceof ApiError) || !error.status;
      onRefused(
        noAnswer
          ? "Não deu para confirmar a cobrança (sem resposta do servidor). Confira nos detalhes se ela foi registrada antes de tentar de novo."
          : error.message,
        payload?.loan || null,
        noAnswer,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(loan)}
      onClose={busy ? () => {} : onClose}
      title="Cobrar no WhatsApp"
      variant="hero"
      size="sm"
      placement="center"
      className="modal--charge"
      describedBy="charge-text"
      footer={
        pendingUrl ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Fechar
            </button>
            <a
              href={pendingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--whatsapp"
              onClick={onClose}
            >
              <IconWhatsapp width={19} height={19} aria-hidden="true" />
              Abrir o WhatsApp
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn btn--whatsapp"
              onClick={charge}
              disabled={busy}
            >
              <IconWhatsapp width={19} height={19} aria-hidden="true" />
              {busy ? "Abrindo…" : "Abrir o WhatsApp"}
            </button>
          </>
        )
      }
    >
      {loan ? (
        <div className="charge">
          <span className="charge__icon" aria-hidden="true">
            <IconWhatsapp width={54} height={54} />
          </span>
          {pendingUrl ? (
            <>
              <h2 className="charge__title">Cobrança registrada</h2>
              <div id="charge-text" className="charge__text">
                <p>
                  O navegador não deixou o WhatsApp abrir sozinho. Toque em{" "}
                  <strong>Abrir o WhatsApp</strong> para enviar a mensagem a{" "}
                  <strong>{first || "a pessoa"}</strong>.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="charge__title">Cobrar a devolução?</h2>
              <div id="charge-text" className="charge__text">
                <p>
                  Vai abrir o WhatsApp com a mensagem pronta para{" "}
                  <strong>{first || "a pessoa"}</strong> devolver{" "}
                  <strong>“{formatBookTitle(loan.bookTitle)}”</strong>, que
                  está atrasado.
                </p>
                <p className="charge__rule">
                  Depois desta cobrança, o botão só poderá ser usado de novo
                  daqui a <strong>{CHARGE_INTERVAL_DAYS} dias</strong>, a partir
                  de <strong className="nowrap">{nextDay}</strong>, e só se o
                  livro ainda estiver atrasado.
                </p>
                <p className="charge__who">
                  A cobrança fica registrada no seu nome.
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
