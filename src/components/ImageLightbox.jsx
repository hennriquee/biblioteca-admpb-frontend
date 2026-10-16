import { createPortal } from "react-dom";
import Modal from "./Modal.jsx";

/**
 * Foto/capa em tamanho grande, sobre o resto da tela - o que abre ao clicar
 * numa foto "zoomable" (ver Avatar.jsx e BookCover.jsx). So AUMENTA: sem
 * botao de baixar, sem menu de "salvar imagem" (botao direito) e sem
 * arrastar a foto para fora da janela - do jeito que o WhatsApp mostra uma
 * foto em tela cheia, sem oferecer salvar.
 *
 * Isso NAO impede um print da tela (nenhum site consegue impedir isso); e so
 * para a foto nao sair do app com um clique ou toque longo.
 *
 * Vai para o <body> (como os sub-modais do PhotoPicker): as capas "zoomable"
 * ficam dentro do modal de DETALHE do livro (Books.jsx, Catalog.jsx), e um
 * modal aninhado direto na arvore, sem portal, nao garante ficar por cima
 * nem fica de fora do la-e-volta de foco do modal de fora.
 */
export default function ImageLightbox({ open, onClose, src, alt = "" }) {
  if (!src) return null;

  return createPortal(
    <Modal open={open} onClose={onClose} variant="hero" size="lg" closeOnBackdrop>
      <div className="lightbox">
        <img
          className="lightbox__img no-save"
          src={src}
          alt={alt}
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </Modal>,
    document.body,
  );
}
