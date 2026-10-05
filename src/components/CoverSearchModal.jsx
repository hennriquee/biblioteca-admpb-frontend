import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import {
  googleImagesSearchUrl,
  searchCoverImages,
} from "../api/imageSearch.js";

// Modal de "buscar foto na internet". A busca roda no proprio backend (sem
// esbarrar em CORS) e mostra uma grade de miniaturas pra pessoa escolher
// com um toque - sem precisar copiar/colar link nenhum. O link externo pro
// Google Imagens continua disponivel como alternativa, para quando a busca
// automatica nao acha a capa certa.
export default function CoverSearchModal({
  open,
  onClose,
  onSelect,
  initialQuery,
}) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = initialQuery || "";
    setQuery(q);
    setResults([]);
    setError("");
    setSearched(false);
    if (q.trim()) runSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  async function runSearch(q) {
    const value = (q ?? query).trim();
    if (!value) return;
    setLoading(true);
    setError("");
    try {
      const found = await searchCoverImages(value);
      setResults(found);
      setSearched(true);
      if (!found.length) {
        setError(
          "Não achamos nenhuma foto para essa busca. Tente outras palavras ou use o link do Google abaixo.",
        );
      }
    } catch {
      setError(
        "A busca falhou. Tente de novo em instantes ou use o link do Google abaixo.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runSearch(query);
  }

  function pick(url) {
    onSelect(url);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar foto na internet">
      <div className="coversearch">
        <form className="coversearch__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>O que buscar</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título do livro, autor…"
              autoFocus
            />
          </label>
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={loading || !query.trim()}
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {error ? <p className="muted coversearch__msg">{error}</p> : null}

        {results.length > 0 ? (
          <div className="coversearch__grid">
            {results.map((item, index) => (
              <button
                type="button"
                key={item.image + index}
                className="coversearch__item"
                onClick={() => pick(item.image)}
                title={item.title}
              >
                <BookCover
                  src={item.thumbnail}
                  alt={item.title || "Capa"}
                  className="cover--sm"
                />
              </button>
            ))}
          </div>
        ) : null}

        {!loading && searched ? (
          <p className="muted coversearch__fallback">
            Não encontrou a capa certa?{" "}
            <a
              className="link-decoration"
              href={googleImagesSearchUrl(query)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buscar no Google Imagens
            </a>
            , clique com o botão direito na foto, escolha "Copiar endereço da
            imagem" e cole no campo "Link da capa".
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
