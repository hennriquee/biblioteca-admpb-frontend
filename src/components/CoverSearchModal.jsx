import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { searchCoverImages, googleImagesSearchUrl } from "../api/imageSearch.js";
import { IconSearch } from "./Icons.jsx";

// Modal de "buscar foto na internet". Duas formas de achar a imagem, as
// duas rodando no navegador de quem esta usando o site (nunca no backend):
//
// 1) Busca automatica (DuckDuckGo): se der certo, mostra uma grade de
//    miniaturas e um clique ja preenche o link da capa. Pode falhar por
//    CORS - ver comentario em api/imageSearch.js.
// 2) Botao "Abrir no Google": sempre funciona, sem excecao. Abre uma aba
//    nova com a busca de imagens do Google; a pessoa copia o link da
//    imagem escolhida e cola no campo "Link da capa" do formulario.
export default function CoverSearchModal({ open, onClose, initialQuery, onSelect }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Toda vez que o modal abre, comeca do zero com a busca sugerida
  // (titulo + autor do livro que esta sendo cadastrado/editado).
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || "");
    setResults([]);
    setError("");
  }, [open, initialQuery]);

  async function runSearch(event) {
    event?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError("");
    try {
      const items = await searchCoverImages(query);
      setResults(items);
      if (!items.length) {
        setError(
          'Nenhuma imagem encontrada por aqui. Tente o botao "Abrir no Google" abaixo.',
        );
      }
    } catch (err) {
      setResults([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function pick(item) {
    onSelect(item.link);
    onClose();
  }

  function openInGoogle() {
    window.open(googleImagesSearchUrl(query), "_blank", "noopener,noreferrer");
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar foto na internet">
      <div className="coversearch">
        <form className="coversearch__bar" onSubmit={runSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titulo do livro, autor…"
            autoFocus
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !query.trim()}
          >
            <IconSearch width={16} height={16} />
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {error ? <p className="form-error">{error}</p> : null}

        {results.length ? (
          <div className="coversearch__grid">
            {results.map((item, index) => (
              <button
                type="button"
                key={item.link + index}
                className="coversearch__item"
                onClick={() => pick(item)}
                title={item.title}
              >
                <img src={item.thumbnail} alt={item.title} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="coversearch__fallback">
          <p className="muted">
            Se a busca acima nao trouxer nada, abra a busca de imagens do
            Google, clique com o botao direito na foto desejada, escolha
            "Copiar endereco da imagem" e cole no campo "Link da capa" do
            formulario.
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={openInGoogle}
            disabled={!query.trim()}
          >
            Abrir busca de imagens no Google
          </button>
        </div>
      </div>
    </Modal>
  );
}
