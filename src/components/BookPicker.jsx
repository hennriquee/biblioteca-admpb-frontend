import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import BookCover from "./BookCover.jsx";
import { IconClose, IconSearch } from "./Icons.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import { matchesBook, rankBooks } from "../utils/bookFilter.js";
import { useRefresh } from "../utils/refresh.js";

/**
 * Escolha do livro (Novo emprestimo e registro de solicitacao): busca pelo
 * nome, autor ou ISBN. Livro sem exemplar na estante aparece apagado, com o
 * motivo - emprestado ("ja esta com Fulana") ou SOLICITADO ("solicitado por
 * Fulana"): o exemplar solicitado so sai pela propria solicitacao, para quem
 * pediu (Emprestimos > Solicitados).
 *
 * O acervo inteiro e baixado uma vez, ao abrir (a busca responde na hora); se
 * isso falhar, cada busca vai ao servidor.
 *
 * Props: picked (livro escolhido ou null), onPick(livro), onClear(),
 * locked (sem o "x": o livro nao muda aqui).
 */

// Por que o livro nao pode sair agora (null = pode).
export function unavailableReason(book) {
  if (book.available > 0) return null;
  const loaned = book.loanedNames || [];
  const requested = book.requestedNames || [];
  if ((book.copies || 1) > 1) {
    return requested.length
      ? "todas as unidades estão emprestadas ou solicitadas"
      : "todas as unidades estão emprestadas";
  }
  if (requested.length) {
    return "solicitado por " + requested[0] + " (sai só pela solicitação)";
  }
  return "já está com " + (loaned[0] || "alguém");
}

export default function BookPicker({ picked, onPick, onClear, locked = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ term: "", items: [] });
  // null = ainda nao chegou (ou falhou): ai a busca vai ao servidor.
  const [allBooks, setAllBooks] = useState(null);
  const term = query.trim();

  useEffect(() => {
    let active = true;
    api("/api/books")
      .then((data) => {
        if (active) setAllBooks(data);
      })
      .catch(() => {
        /* sem o acervo na memoria, a busca usa o servidor */
      });
    return () => {
      active = false;
    };
  }, []);

  // Puxar para atualizar: a situacao dos livros vem de novo (quem acabou de
  // ser emprestado ou solicitado aparece apagado na busca).
  // O livro ja escolhido tambem passa a mostrar a situacao de agora - mas so
  // se ainda e o mesmo quando a resposta chega (o administrador pode ter
  // trocado ou tirado o livro enquanto ela vinha).
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useRefresh(() =>
    api("/api/books").then((data) => {
      setAllBooks(data);
      const current = pickedRef.current;
      if (current) {
        const fresh = data.find((item) => item._id === current._id);
        if (fresh && pickedRef.current?._id === fresh._id) onPick(fresh);
      }
    }),
  );

  useEffect(() => {
    if (allBooks || picked || term.length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      let items = [];
      try {
        const data = await api("/api/books?search=" + encodeURIComponent(term));
        items = rankBooks(data, term).slice(0, 8);
      } catch {
        items = [];
      }
      if (active) setResults({ term, items });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, picked, allBooks]);

  const searchOn = !picked && term.length >= 2;
  const searching = searchOn && !allBooks && results.term !== term;
  const items = useMemo(() => {
    if (!searchOn) return [];
    if (allBooks) {
      return rankBooks(
        allBooks.filter((item) => matchesBook(item, { search: term })),
        term,
      ).slice(0, 8);
    }
    return results.term === term ? results.items : [];
  }, [searchOn, allBooks, term, results]);

  if (picked) {
    return (
      <div className="picked">
        <BookCover src={picked.cover} alt="" className="cover--sm" />
        <div>
          <strong title={formatBookTitle(picked.title)}>
            {formatBookTitle(picked.title)}
          </strong>
          <small title={(picked.authors || []).join(", ") || undefined}>
            {picked.isbn || (picked.authors || []).join(", ")}
          </small>
        </div>
        {locked ? null : (
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setQuery("");
              onClear();
            }}
            aria-label="Trocar livro"
          >
            <IconClose width={18} height={18} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="combo">
      <div className="searchbar">
        <IconSearch width={18} height={18} />
        <input
          type="search"
          placeholder="Procurar pelo nome ou ISBN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {searching ? (
        <p className="combo__wait" role="status">
          Buscando livros…
        </p>
      ) : null}

      {searchOn && !searching && items.length === 0 ? (
        <p className="combo__wait">Nenhum livro encontrado.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="combo__list">
          {items.map((item) => {
            const reason = unavailableReason(item);
            const requestedOnly =
              reason && (item.requestedNames || []).length > 0;
            return (
              <li key={item._id}>
                <button
                  type="button"
                  className="combo__item"
                  disabled={Boolean(reason)}
                  onClick={() => {
                    onPick(item);
                    setResults({ term: "", items: [] });
                  }}
                >
                  <BookCover src={item.cover} alt="" className="cover--xs" />
                  <span>
                    <strong title={formatBookTitle(item.title)}>
                      {formatBookTitle(item.title)}
                    </strong>
                    <small title={(item.authors || []).join(", ") || undefined}>
                      {(item.authors || []).join(", ") ||
                        item.isbn ||
                        "Autor não informado"}
                    </small>
                    {reason ? (
                      <small
                        className={
                          "combo__status " +
                          (requestedOnly
                            ? "combo__status--req"
                            : "combo__status--out")
                        }
                      >
                        {reason}
                      </small>
                    ) : item.copies > 1 ? (
                      <small className="combo__status">
                        {item.available + " de " + item.copies + " disponíveis"}
                      </small>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
