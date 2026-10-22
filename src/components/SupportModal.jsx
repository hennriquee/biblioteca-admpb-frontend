import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import PixQr from "./PixQr.jsx";
import { IconCheck, IconCopy, IconExternal } from "./Icons.jsx";
import { useToast } from "./Toast.jsx";
import { PIX_CODE, PIX_LINK, PIX_RECEIVER } from "../utils/support.js";

/**
 * "Apoie o nosso projeto" (menu Participe do acervo publico): PIX com QR code
 * e o codigo "copia e cola". Quem doa escolhe o valor no app do banco.
 */

// Copia o texto. O jeito novo (clipboard) so existe em https e pode ser
// recusado; o antigo (selecionar e copiar) cobre navegadores mais velhos.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export default function SupportModal({ open, onClose }) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!open) setCopied(false);
    return () => clearTimeout(timer.current);
  }, [open]);

  async function copy() {
    if (await copyText(PIX_CODE)) {
      setCopied(true);
      notify("Código PIX copiado. Cole no app do seu banco.", "success");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } else {
      // Sem permissao para copiar: deixa o codigo selecionado para a pessoa
      // copiar na mao.
      codeRef.current?.select();
      notify("Não deu para copiar sozinho. O código ficou selecionado: copie à mão.", "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apoie o nosso projeto" variant="pub" size="sm">
      <div className="support">
        <p className="muted">
          A biblioteca cresce com a ajuda de quem lê. Qualquer valor vira livro
          novo na estante. Obrigado!
        </p>

        <div className="support__qr">
          <PixQr value={PIX_CODE} label="QR code do PIX para apoiar a biblioteca" />
        </div>

        <ol className="support__steps">
          <li>Abra o app do seu banco e escolha pagar com PIX.</li>
          <li>Leia o QR code ou cole o código abaixo.</li>
          <li>Escolha o valor e confirme.</li>
        </ol>

        <label className="field">
          <span>PIX copia e cola</span>
          <textarea
            ref={codeRef}
            className="support__code"
            value={PIX_CODE}
            readOnly
            rows={4}
            spellCheck={false}
            onFocus={(e) => e.target.select()}
          />
        </label>

        <button type="button" className="btn btn--primary btn--block" onClick={copy}>
          {copied ? (
            <IconCheck width={18} height={18} aria-hidden="true" />
          ) : (
            <IconCopy width={18} height={18} aria-hidden="true" />
          )}
          {copied ? "Código copiado" : "Copiar código PIX"}
        </button>

        <p className="support__receiver">
          Recebedor: <strong>{PIX_RECEIVER}</strong>
        </p>

        <a
          className="support__link"
          href={PIX_LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ou pague pelo link de pagamento
          <IconExternal width={15} height={15} aria-hidden="true" />
        </a>
      </div>
    </Modal>
  );
}
