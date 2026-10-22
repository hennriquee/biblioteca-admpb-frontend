import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { publicApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PublicBookModal, { PublicBookRow } from "../components/PublicBook.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import NewBooksModal from "../components/NewBooksModal.jsx";
import StaffModal from "../components/StaffModal.jsx";
import CatalogMenu from "../components/CatalogMenu.jsx";
import SupportModal from "../components/SupportModal.jsx";
import SuggestBookModal from "../components/SuggestBookModal.jsx";
import { IconSearch, IconUsers } from "../components/Icons.jsx";
import { applyCatalogIdentity } from "../utils/catalogIdentity.js";
import { matchesBook } from "../utils/bookFilter.js";
import { useBookList } from "../hooks/useBookList.js";
import { getLastSeenBooksAt, markBooksSeenNow } from "../utils/newBooksSeen.js";

/**
 * Acervo PUBLICO (/catalogo): a unica tela que abre sem login.
 *
 * So le de /api/public/* (via publicApi, que nao envia token). Nao usa o
 * Layout do admin, nao tem nenhum botao de editar/excluir e nunca recebe nome
 * de quem pegou o livro: do emprestimo o servidor manda apenas a contagem de
 * unidades emprestadas e a data combinada de entrega - quando o livro volta
 * para a estante, nunca com quem ele esta. A lista e o "carregar mais" seguem
 * o mesmo molde do Acervo.
 */

// Uma pagina do acervo publico. filters = null traz sem filtro (ver useBookList).
function loadBooks(pageNumber, limit, filters) {
  const params = new URLSearchParams({
    page: String(pageNumber),
    limit: String(limit),
  });
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.status) params.set("status", filters.status);
  return publicApi("/api/public/books?" + params.toString());
}

// Voltando para a aba depois deste tempo, a situacao dos livros e recarregada.
const STALE_AFTER_MS = 60 * 1000;

// As boas-vindas abrem sozinhas uma UNICA vez (a primeira visita deste
// navegador): dali em diante nunca mais aparecem sozinhas, nem reabrindo o
// site, nem em outra aba. A logo no topo reabre quando quiser.
const WELCOME_KEY = "biblioteca_admpb_boas_vindas";

function welcomeAlreadySeen() {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* navegador sem armazenamento: so mostra de novo na proxima vez */
  }
}

// Quantas capas aparecem no aviso de novidade (ver NewBooksModal).
const NEW_BOOKS_PREVIEW_LIMIT = 3;

const STATUS_OPTIONS = [
  { key: "", label: "Todos" },
  { key: "disponivel", label: "Disponíveis" },
  { key: "emprestado", label: "Emprestados" },
];

// Agrupa por letra inicial (sem acento: "Oração" fica no O). Os livros ja
// chegam em ordem alfabetica do servidor; aqui so se separam em secoes.
function groupByLetter(books) {
  const groups = new Map();
  books.forEach((book) => {
    const first = String(book.title || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .charAt(0)
      .toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    groups.set(key, [...(groups.get(key) || []), book]);
  });
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default function Catalog() {
  const { user } = useAuth();

  // overview: undefined = carregando | null = nao carregou | { titles, ... }
  const [overview, setOverview] = useState(undefined);
  // O servidor gratuito dorme quando ninguem usa; a primeira abertura pode
  // demorar. Depois de alguns segundos explicamos isso na tela.
  const [slow, setSlow] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  // O acervo e baixado uma vez e os filtros rodam aqui mesmo, na hora (ver
  // useBookList). So existe espera na primeira abertura.
  const list = useBookList({
    load: loadBooks,
    filters: { search: search.trim(), category, status },
    matches: matchesBook,
  });
  const { items, total, hasMore, waiting, error } = list;

  const [selected, setSelected] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [welcomeOpen, setWelcomeOpen] = useState(() => !welcomeAlreadySeen());
  // Menu "Participe" (botao do topo) e as janelas que ele abre por cima:
  // "Com quem falar?" (cartoes da equipe), "Sugerir um livro" e "Apoie".
  const [menuOpen, setMenuOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // null = nada para avisar | { total, items, since } = ha novidade para mostrar.
  const [newBooks, setNewBooks] = useState(null);

  function closeWelcome() {
    rememberWelcomeSeen();
    setWelcomeOpen(false);
  }

  // Avisa se chegou livro novo desde a ultima vez que esteve aqui. Roda uma
  // vez, ao abrir a pagina - nao fica checando de novo quando a aba volta a
  // ficar visivel.
  useEffect(() => {
    let active = true;
    const lastSeenAt = getLastSeenBooksAt();

    // Sem nada guardado (primeira visita de verdade, ou o navegador foi
    // limpo): comeca a contar JA, nesta mesma visita - nao so na proxima -
    // e nao busca novidade agora, para nao tratar o acervo inteiro como tal.
    if (!lastSeenAt) {
      markBooksSeenNow();
      return undefined;
    }

    publicApi(
      "/api/public/books?since=" +
        encodeURIComponent(lastSeenAt) +
        "&sort=newest&limit=" +
        NEW_BOOKS_PREVIEW_LIMIT,
    )
      .then((data) => {
        if (active && data.total > 0) setNewBooks({ ...data, since: lastSeenAt });
      })
      .catch(() => {
        /* nao e essencial: sem aviso de novidade, o catalogo continua normal */
      });

    return () => {
      active = false;
    };
  }, []);

  // Toque na notificacao do "Avise-me quando voltar": o endereco chega com
  // ?livro=id e o catalogo abre ja com esse livro, na situacao de agora (ver
  // public/push-sw.js). O "?livro=" sai do endereco em seguida, para
  // recarregar a pagina nao reabrir o livro.
  useEffect(() => {
    const bookId = searchParams.get("livro");
    if (!bookId) return undefined;
    let active = true;
    publicApi("/api/public/books/" + encodeURIComponent(bookId))
      .then((data) => {
        if (active && data?.book) setSelected(data.book);
      })
      .catch(() => {
        /* livro excluido ou sem internet: o catalogo abre normalmente */
      });
    // Copia, e nao o proprio "params": ele e o mesmo objeto que searchParams,
    // e altera-lo apagaria o livro da leitura acima antes da hora.
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete("livro");
        return next;
      },
      { replace: true },
    );
    return () => {
      active = false;
    };
    // Roda so ao abrir a pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "Acervo · Biblioteca ADMP Brasil";
    return () => {
      document.title = previous;
    };
  }, []);

  // Icone, manifesto e nome do app: o do acervo (o livro com "Catalogo").
  useEffect(() => applyCatalogIdentity(), []);

  const loadOverview = useCallback(async () => {
    try {
      const data = await publicApi("/api/public/overview");
      setOverview(data);
      // Se a categoria escolhida deixou de existir, volta para "todas".
      setCategory((current) =>
        current && !data.categories.some((item) => item.name === current)
          ? ""
          : current,
      );
    } catch {
      // Nao e essencial: sem o resumo, a lista continua funcionando.
      setOverview(null);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Quem deixa a aba aberta e volta depois nao pode ver "disponivel" velho.
  const revalidateRef = useRef(list.revalidate);
  revalidateRef.current = list.revalidate;
  useEffect(() => {
    let hiddenAt = 0;
    function onVisibilityChange() {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) {
        revalidateRef.current();
        loadOverview();
      }
      hiddenAt = 0;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadOverview]);

  // Sem lista para o filtro atual (so acontece na primeira abertura, ou a
  // cada filtro quando o acervo e grande demais para filtrar aqui): entra o
  // esqueleto no lugar da lista.
  const showSkeleton = waiting;
  useEffect(() => {
    if (!showSkeleton) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [showSkeleton]);

  // Se a lista for recarregada com o modal aberto, ele mostra os dados novos.
  useEffect(() => {
    setSelected((current) =>
      current ? items.find((book) => book.id === current.id) || current : null,
    );
  }, [items]);

  const groups = useMemo(() => groupByLetter(items), [items]);
  const categories = overview?.categories || [];
  const staff = overview?.staff || [];
  const isFiltering = Boolean(search.trim() || category || status);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
  }

  // Os numeros do resumo vao em destaque; o resto fica em tom suave.
  let summary = null;
  if (overview === undefined) {
    summary = "Carregando…";
  } else if (overview) {
    summary =
      overview.titles === 0 ? (
        "Nenhum livro cadastrado ainda"
      ) : (
        <>
          <strong>{overview.titles}</strong>
          {overview.titles === 1 ? " livro" : " livros"} ·{" "}
          <strong>{overview.available}</strong>
          {overview.available === 1 ? " disponível" : " disponíveis"} agora
        </>
      );
  }

  return (
    <div className="pub">
      <div className="pub__inner page">
        {/* Barra do topo: a logo pequena a esquerda (reabre as boas-vindas) e,
            a direita, o menu "Participe" (com quem falar, sugerir um livro,
            apoiar e o grupo do WhatsApp) - e, para quem esta logado no painel,
            tambem o "Voltar ao painel". Todos com a mesma altura. */}
        <div className="pub__bar">
          <button
            type="button"
            className="pub__logobtn"
            onClick={() => setWelcomeOpen(true)}
            title="Sobre a biblioteca"
          >
            <img
              className="pub__logo"
              src="/img/logo-biblioteca.svg"
              alt="Biblioteca ADMP Brasil: sobre a biblioteca"
            />
          </button>
          <div className={"pub__actions" + (user ? " pub__actions--two" : "")}>
            {user ? (
              <Link to="/" className="btn btn--ghost pub__admin" aria-label="Voltar ao painel">
                <span className="pub__panelfull">Voltar ao painel</span>
                <span className="pub__panelshort">Painel</span>
              </Link>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost pub__admin"
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
            >
              <IconUsers width={18} height={18} aria-hidden="true" />
              Participe
            </button>
          </div>
        </div>

        <header className="pub__title">
          <h1>Nossos livros</h1>
          {summary ? <p className="page__sub">{summary}</p> : null}
        </header>

        <div className="pub__filters">
          <div className="searchbar">
            <IconSearch width={18} height={18} />
            <input
              type="search"
              placeholder="Buscar por título, autor ou ISBN"
              aria-label="Buscar livros por título, autor ou ISBN"
              autoComplete="off"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {categories.length > 0 ? (
            <CategoryPicker
              variant="filter"
              value={category}
              onChange={setCategory}
              options={categories}
              emptyLabel="Todas as categorias"
              placeholder="Todas as categorias"
              searchable
              showCounts
            />
          ) : null}
        </div>

        <div
          className="segmented pub__status"
          role="group"
          aria-label="Situação do livro"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.key || "todos"}
              type="button"
              aria-pressed={status === option.key}
              className={
                "segmented__item" + (status === option.key ? " is-active" : "")
              }
              onClick={() => setStatus(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {!waiting && !error && total > 0 ? (
          <p className="pub__count" aria-live="polite">
            {isFiltering
              ? total +
                (total === 1 ? " livro encontrado" : " livros encontrados")
              : "Mostrando " + items.length + " de " + total}
          </p>
        ) : null}

        {showSkeleton ? (
          <ListSkeleton>
            {slow ? "Aguarde um tempo…" : "Carregando o acervo…"}
          </ListSkeleton>
        ) : null}

        {error ? (
          <div className="empty" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={list.reload}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!waiting && !error && items.length === 0 ? (
          <div className="empty">
            <p>
              {isFiltering
                ? "Nenhum livro corresponde a essa busca."
                : "Ainda não há livros no acervo."}
            </p>
            {isFiltering ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div
            className={
              "pub__results" + (list.refreshing ? " is-refreshing" : "")
            }
          >
            {groups.map(([letter, letterItems]) => (
              <section key={letter} className="group">
                <h2 className="group__letter">{letter}</h2>
                <ul className="booklist">
                  {letterItems.map((book) => (
                    <li key={book.id}>
                      <PublicBookRow
                        book={book}
                        onOpen={setSelected}
                        mostLoaned={list.mostLoanedId === book.id}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {list.notice ? (
          <p className="form-error" role="alert">
            {list.notice}
          </p>
        ) : null}

        {hasMore ? (
          <div className="loadmore">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={list.loadMore}
              disabled={list.loadingMore || list.refreshing}
            >
              {list.loadingMore ? "Carregando…" : "Carregar mais livros"}
            </button>
          </div>
        ) : null}

        <footer className="pub__foot">
          <p>
            A situação mostrada é a de agora. Para pegar um livro emprestado,
            procure a equipe da biblioteca.
          </p>
          <p>
            © {new Date().getFullYear()} ADMP Brasil — Todos os direitos
            reservados.
          </p>
        </footer>
      </div>

      <WelcomeModal open={welcomeOpen} onClose={closeWelcome} />

      <NewBooksModal
        open={Boolean(newBooks)}
        onClose={() => setNewBooks(null)}
        total={newBooks?.total ?? 0}
        items={newBooks?.items ?? []}
        since={newBooks?.since ?? null}
      />

      <CatalogMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        hasStaff={staff.length > 0}
        onStaff={() => setStaffOpen(true)}
        onSuggest={() => setSuggestOpen(true)}
        onSupport={() => setSupportOpen(true)}
      />

      <StaffModal
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        staff={staff}
      />

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      <SuggestBookModal
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        onSent={() => {
          // Sugestao recebida: fecha a ficha e o menu, de volta ao acervo.
          setSuggestOpen(false);
          setMenuOpen(false);
        }}
      />

      {/* Detalhes do livro: so leitura (ver components/PublicBook.jsx). */}
      <PublicBookModal
        book={selected}
        onClose={() => setSelected(null)}
        mostLoaned={Boolean(selected) && list.mostLoanedId === selected.id}
        onStale={() => {
          list.revalidate();
          loadOverview();
        }}
      />
    </div>
  );
}
