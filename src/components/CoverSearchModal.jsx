import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { googleImagesSearchUrl } from "../api/imageSearch.js";

// Modal de "buscar foto na internet". E um link de verdade (<a target="_blank">),
// nao window.open() via JavaScript - assim nunca esbarra em bloqueio de
// pop-up (comum em Safari/iOS quando quem abre a aba nova e um script).
export default function CoverSearchModal({ open, onClose, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || "");

  // Toda vez que o modal abre, comeca com a busca sugerida (titulo + autor
  // do livro que esta sendo cadastrado/editado), mas a pessoa pode ajustar.
  useEffect(() => {
    if (open) setQuery(initialQuery || "");
  }, [open, initialQuery]);

  return (
    <Modal open={open} onClose={onClose} title="Buscar foto na internet">
      <div className="coversearch">
        <p className="muted">
          Abre a busca de imagens do Google numa aba nova. Encontre a capa,
          clique com o botao direito nela, escolha "Copiar endereco da imagem" e
          cole no campo "Link da capa" do formulario.
        </p>

        <label className="field">
          <span>O que buscar</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titulo do livro, autor…"
            autoFocus
          />
        </label>

        <a
          className="btn btn--primary btn--block"
          href={googleImagesSearchUrl(query)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir busca de imagens no Google
        </a>
      </div>
    </Modal>
  );
}
