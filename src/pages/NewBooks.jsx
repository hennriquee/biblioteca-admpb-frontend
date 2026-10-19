import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "../api/client.js";
import BookCover from "../components/BookCover.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { IconChevronLeft } from "../components/Icons.jsx";
import { applyCatalogIdentity } from "../utils/catalogIdentity.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { getLastSeenBooksAt, markBooksSeenNow } from "../utils/newBooksSeen.js";

// Nao devia existir acervo com mais novidade acumulada que isso, mas o teto
// evita um pedido gigante se alguem ficar anos sem visitar o catalogo.
const LIST_LIMIT = 300;

/**
 * Tela de novidades (/catalogo/novidades): os livros cadastrados desde a
 * ultima vez que esta pessoa esteve no catalogo (ver utils/newBooksSeen.js).
 *
 * So existe link para aqui a partir do NewBooksModal, mas tambem funciona
 * sozinha (favorito salvo, ou a pessoa voltou e apertou "atras"): sem nada
 * guardado no navegador, mostra a lista vazia em vez de travar ou devolver o
 * acervo inteiro como "novidade".
 */
export default function NewBooks() {
  // loading | ready | error
  const [state, setState] = useState("loading");
  const [books, setBooks] = useState([]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Novidades · Biblioteca ADMP Brasil";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => applyCatalogIdentity(), []);

  useEffect(() => {
    let active = true;

    async function load() {
      const lastSeenAt = getLastSeenBooksAt();
      try {
        const data = lastSeenAt
          ? await publicApi(
              "/api/public/books?since=" +
                encodeURIComponent(lastSeenAt) +
                "&sort=newest&limit=" +
                LIST_LIMIT,
            )
          : { items: [] };
        if (!active) return;
        setBooks(data.items);
        setState("ready");
        // So marca como "vista" depois que a lista carregou com sucesso: se
        // a chamada falhar, a pessoa ainda ve a novidade na proxima tentativa.
        markBooksSeenNow();
      } catch {
        if (active) setState("error");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="pub">
      <div className="pub__inner page">
        <Link to="/catalogo" className="backlink">
          <IconChevronLeft width={18} height={18} />
          Acervo
        </Link>

        <header className="pub__title">
          <h1>Novidades no acervo</h1>
          {state === "ready" ? (
            <p className="page__sub">
              {books.length === 0
                ? "Nenhum livro novo desde sua última visita."
                : "Adicionados desde sua última visita."}
            </p>
          ) : null}
        </header>

        {state === "loading" ? (
          <ListSkeleton>Carregando…</ListSkeleton>
        ) : null}

        {state === "error" ? (
          <div className="empty" role="alert">
            <p>Não foi possível carregar as novidades agora. Tente de novo em instantes.</p>
          </div>
        ) : null}

        {state === "ready" && books.length === 0 ? (
          <div className="empty">
            <p>Volte depois para ver os próximos livros que chegarem ao acervo.</p>
          </div>
        ) : null}

        {state === "ready" && books.length > 0 ? (
          <ul className="booklist">
            {books.map((book) => {
              const bookTitle = formatBookTitle(book.title);
              return (
                <li key={book.id}>
                  <div className="bookrow bookrow--static">
                    <BookCover
                      src={book.cover}
                      alt={"Capa de " + bookTitle}
                      className="cover--sm"
                    />
                    <span className="bookrow__text">
                      <strong title={bookTitle}>{bookTitle}</strong>
                      <small className="bookrow__meta">
                        <span className="bookrow__authors">
                          {book.authors.join(", ") || "Autor não informado"}
                        </span>
                      </small>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
