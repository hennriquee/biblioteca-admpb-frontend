import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { publicApi } from "../api/client.js";
import ListSkeleton from "../components/ListSkeleton.jsx";
import PublicBookModal, { PublicBookRow } from "../components/PublicBook.jsx";
import { IconChevronLeft } from "../components/Icons.jsx";
import { applyCatalogIdentity } from "../utils/catalogIdentity.js";
import { getLastSeenBooksAt, markBooksSeenNow } from "../utils/newBooksSeen.js";

// Nao devia existir acervo com mais novidade acumulada que isso, mas o teto
// evita um pedido gigante se alguem ficar anos sem visitar o catalogo.
const LIST_LIMIT = 300;

/**
 * Tela de novidades (/catalogo/novidades): os livros cadastrados desde a
 * ultima vez que esta pessoa esteve no catalogo (ver utils/newBooksSeen.js).
 *
 * O link do aviso (NewBooksModal) traz esse "desde quando" no state da
 * navegacao, e ele fica gravado nesta entrada do historico. Importa porque a
 * tela marca a novidade como vista assim que carrega: sem isso, quem voltasse
 * aqui (de outra tela, ou recarregando) cairia numa lista vazia. Sem o state
 * (favorito salvo, endereco digitado), vale o que esta no localStorage; sem
 * nada guardado, mostra a lista vazia em vez de travar ou devolver o acervo
 * inteiro como "novidade".
 *
 * Tocar num livro abre os mesmos detalhes do acervo, mas como uma NOVA entrada
 * do historico (state.bookId): fechar a janela, o "x", o Esc, o botao "voltar"
 * do navegador e o gesto de voltar do celular fazem a mesma coisa - voltam
 * para esta lista, e nao para o catalogo.
 */
export default function NewBooks() {
  const location = useLocation();
  const navigate = useNavigate();

  // loading | ready | error
  const [state, setState] = useState("loading");
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [mostLoanedId, setMostLoanedId] = useState(null);
  const [since] = useState(() => location.state?.since || getLastSeenBooksAt());

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
      try {
        const data = since
          ? await publicApi(
              "/api/public/books?since=" +
                encodeURIComponent(since) +
                "&sort=newest&limit=" +
                LIST_LIMIT,
            )
          : { items: [], total: 0 };
        if (!active) return;
        setBooks(data.items);
        setTotal(data.total ?? data.items.length);
        setMostLoanedId(data.mostLoanedId ?? null);
        setState("ready");
        // So marca como "vista" depois que a lista carregou com sucesso: se
        // a chamada falhar, a pessoa ainda ve a novidade na proxima tentativa.
        markBooksSeenNow();
        // Veio sem o "desde quando" (favorito, endereco digitado): grava-o
        // nesta entrada para que recarregar mostre a mesma lista.
        if (since && !location.state?.since) {
          navigate(location.pathname, { replace: true, state: { since } });
        }
      } catch {
        if (active) setState("error");
      }
    }

    load();
    return () => {
      active = false;
    };
    // Roda uma vez por visita: "since" nao muda e a tela nao recarrega a lista
    // ao abrir e fechar um livro.
  }, []);

  const selectedId = location.state?.bookId;
  const selected =
    state === "ready" && selectedId
      ? books.find((book) => book.id === selectedId) || null
      : null;

  function openBook(book) {
    navigate(location.pathname, { state: { since, bookId: book.id } });
  }

  // Abrir sempre empurra uma entrada no historico, entao voltar uma entrada e
  // exatamente "fechar". Dois pedidos de fechar no mesmo instante (duplo
  // toque, Esc repetindo) voltariam duas entradas e sairiam da lista: o
  // segundo e ignorado ate o detalhe realmente fechar (selectedId mudar).
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [selectedId]);

  function closeBook() {
    if (closing.current) return;
    closing.current = true;
    navigate(-1);
  }

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
                ? "Nenhuma novidade por enquanto."
                : total === 1
                  ? "1 novo título que você ainda não tinha visto."
                  : total + " novos títulos que você ainda não tinha visto."}
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
            {books.map((book) => (
              <li key={book.id}>
                <PublicBookRow
                  book={book}
                  onOpen={openBook}
                  mostLoaned={mostLoanedId === book.id}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <PublicBookModal
        book={selected}
        onClose={closeBook}
        mostLoaned={Boolean(selected) && mostLoanedId === selected.id}
      />
    </div>
  );
}
