import Modal from "./Modal.jsx";
import SuggestScene from "./SuggestScene.jsx";
import { IconCheck, IconHeart } from "./Icons.jsx";
import "../styles/contribute.css";

/**
 * Logo depois de enviar uma sugestao de livro: no meio da tela, a animacao
 * do caminhao trazendo os livros (com o titulo sugerido na capa do quinto) e
 * o convite para contribuir, para a sugestao chegar mais rapido ao acervo.
 *
 * - title: o livro sugerido
 * - duplicate: o livro ja estava entre as sugestoes (a pessoa reforcou)
 * - onContribute(): "Quero contribuir" - quem abriu mostra o PIX
 *
 * Fecha pelo "Agora não", pelo "x", pelo Esc ou tocando fora.
 */

// Titulo muito comprido nao cabe no convite: corta com reticencias.
function short(title) {
  const clean = String(title || "").trim();
  return clean.length > 70 ? clean.slice(0, 67).trimEnd() + "…" : clean;
}

export default function ContributeModal({ open, onClose, onContribute, title, duplicate }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajude sua sugestão a chegar mais rápido"
      variant="hero"
      size="contribute"
      placement="center"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Agora não
          </button>
          <button type="button" className="btn btn--primary contribute__cta" onClick={onContribute}>
            <IconHeart width={19} height={19} aria-hidden="true" />
            Quero contribuir
          </button>
        </>
      }
    >
      <div className="contribute">
        <div className="contribute__stage">
          {open ? <SuggestScene title={title} /> : null}
        </div>
        <div className="contribute__text">
          <p className="contribute__badge">
            <IconCheck width={16} height={16} aria-hidden="true" />
            {duplicate ? "Esse livro já estava na lista: obrigado por reforçar!" : "Sugestão enviada!"}
          </p>
          <h2 className="contribute__title">Ajude sua sugestão a chegar mais rápido</h2>
          <p className="contribute__lead">
            Com uma contribuição de qualquer valor, <strong>“{short(title)}”</strong> pode
            chegar mais rápido ao acervo da biblioteca.
          </p>
          <p className="contribute__note">Toda ajuda vira livro novo na estante.</p>
        </div>
      </div>
    </Modal>
  );
}
