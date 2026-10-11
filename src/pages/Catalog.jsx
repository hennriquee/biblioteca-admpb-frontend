import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import BookCover from "../components/BookCover.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import { IconCheck, IconLoans, IconSearch } from "../components/Icons.jsx";

/**
 * Acervo PUBLICO (/catalogo): a unica tela que abre sem login.
 *
 * So le de /api/public/* (via publicApi, que nao envia token). Nao usa o
 * Layout do admin, nao tem nenhum botao de editar/excluir e nunca recebe nome
 * de quem pegou o livro: o servidor so manda a contagem de unidades
 * emprestadas. A lista e o "carregar mais" seguem o mesmo molde do Acervo.
 */

const PAGE_SIZE = 10;
// Voltando para a aba depois deste tempo, a situacao dos livros e recarregada.
const STALE_AFTER_MS = 60 * 1000;

// As boas-vindas abrem sozinhas uma vez por visita (por aba do navegador):
// recarregar a pagina nao mostra de novo. A logo no topo reabre quando quiser.
const WELCOME_KEY = "biblioteca_admpb_boas_vindas";

function welcomeAlreadySeen() {
  try {
    return sessionStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberWelcomeSeen() {
  try {
    sessionStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* navegador sem armazenamento: so mostra de novo na proxima vez */
  }
}

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

// "in" = tem pelo menos uma unidade na estante; "out" = todas emprestadas.
function availabilityOf(book) {
  const { copies, available } = book;
  if (copies <= 1) {
    return available > 0
      ? { tone: "in", label: "Disponível" }
      : { tone: "out", label: "Emprestado" };
  }
  return available > 0
    ? { tone: "in", label: available + " de " + copies + " disponíveis" }
    : { tone: "out", label: "Todos emprestados", note: copies + " exemplares" };
}

function situationText(book) {
  const { copies, available } = book;
  if (copies <= 1) {
    return available > 0
      ? "O exemplar está na estante."
      : "O exemplar está emprestado no momento.";
  }
  if (available === 0) {
    return "Os " + copies + " exemplares estão emprestados no momento.";
  }
  return (
    available +
    " de " +
    copies +
    " exemplares " +
    (available === 1 ? "está" : "estão") +
    " na estante agora."
  );
}

function Availability({ book }) {
  const info = availabilityOf(book);
  const Icon = info.tone === "in" ? IconCheck : IconLoans;
  return (
    <span className={"avail avail--" + info.tone}>
      <Icon width={14} height={14} aria-hidden="true" />
      {info.label}
    </span>
  );
}

function SkeletonList() {
  return (
    <ul className="booklist" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <li key={index} className="bookrow pub__skelrow">
          <span className="pubskel pubskel__cover" />
          <span className="bookrow__text">
            <span className="pubskel pubskel__line pubskel__line--lg" />
            <span className="pubskel pubskel__line" />
            <span className="pubskel pubskel__line pubskel__line--sm" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Catalog() {
  const { user } = useAuth();

  // overview: undefined = carregando | null = nao carregou | { titles, ... }
  const [overview, setOverview] = useState(undefined);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // O servidor gratuito dorme quando ninguem usa; a primeira abertura pode
  // demorar. Depois de alguns segundos explicamos isso na tela.
  const [slow, setSlow] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !welcomeAlreadySeen());

  function closeWelcome() {
    rememberWelcomeSeen();
    setWelcomeOpen(false);
  }

  // So a resposta da ultima busca vale: se a pessoa continua digitando, as
  // respostas antigas que chegam atrasadas sao descartadas.
  const requestRef = useRef(0);

  useEffect(() => {
    const previous = document.title;
    document.title = "Acervo · Biblioteca ADMP Brasil";
    return () => {
      document.title = previous;
    };
  }, []);

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

  // Filtros da lista que esta na tela. "Carregar mais" usa estes, e nao o que
  // esta digitado agora (a busca espera um instante antes de ser aplicada).
  const appliedRef = useRef({ term: "", categoryName: "", statusKey: "" });

  // background: recarga silenciosa (voltou para a aba): a lista continua
  // clicavel e, se falhar, a lista antiga fica no lugar.
  const loadPage = useCallback(
    async (
      pageToLoad,
      term,
      categoryName,
      statusKey,
      { background = false } = {},
    ) => {
      const requestId = ++requestRef.current;
      const isFirstPage = pageToLoad === 1;
      setError("");
      if (isFirstPage) {
        appliedRef.current = { term, categoryName, statusKey };
        if (!background) setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(PAGE_SIZE),
        });
        if (term.trim()) params.set("search", term.trim());
        if (categoryName) params.set("category", categoryName);
        if (statusKey) params.set("status", statusKey);

        const data = await publicApi("/api/public/books?" + params.toString());
        if (requestId !== requestRef.current) return;

        setItems((prev) =>
          isFirstPage ? data.items : [...prev, ...data.items],
        );
        setTotal(data.total);
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (err) {
        if (requestId !== requestRef.current) return;
        if (background) return;
        setError(err.message);
        if (isFirstPage) {
          setItems([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Recarrega do comeco quando a busca, a categoria ou a situacao muda. So a
  // digitacao espera um instante (para nao chamar o servidor a cada letra).
  useEffect(() => {
    const delay = search.trim() ? 300 : 0;
    const timer = setTimeout(
      () => loadPage(1, search, category, status),
      delay,
    );
    return () => clearTimeout(timer);
  }, [search, category, status, loadPage]);

  // Quem deixa a aba aberta e volta depois nao pode ver "disponivel" velho.
  const latestFilters = useRef({});
  latestFilters.current = {
    search,
    category,
    status,
    hasItems: items.length > 0,
  };
  useEffect(() => {
    let hiddenAt = 0;
    function onVisibilityChange() {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) {
        const filters = latestFilters.current;
        loadPage(1, filters.search, filters.category, filters.status, {
          background: filters.hasItems,
        });
        loadOverview();
      }
      hiddenAt = 0;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadPage, loadOverview]);

  const showSkeleton = loading && items.length === 0;
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
  const isFiltering = Boolean(search.trim() || category || status);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
  }

  let summary = "";
  if (overview === undefined) {
    summary = "Carregando…";
  } else if (overview) {
    summary =
      overview.titles === 0
        ? "Nenhum livro cadastrado ainda"
        : overview.titles +
          (overview.titles === 1 ? " livro" : " livros") +
          " · " +
          overview.available +
          (overview.available === 1 ? " disponível" : " disponíveis") +
          " agora";
  }

  return (
    <div className="pub">
      <div className="pub__inner page">
        <header className="pub__top">
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
          {user ? (
            <Link to="/" className="btn btn--ghost pub__admin">
              Voltar ao painel
            </Link>
          ) : null}
        </header>

        <div className="page__head">
          <div>
            <h1>Acervo da biblioteca</h1>
            {summary ? <p className="page__sub">{summary}</p> : null}
          </div>
        </div>

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

        {!loading && !error && total > 0 ? (
          <p className="pub__count" aria-live="polite">
            {isFiltering
              ? total +
                (total === 1 ? " livro encontrado" : " livros encontrados")
              : "Mostrando " + items.length + " de " + total}
          </p>
        ) : null}

        {showSkeleton ? (
          <>
            <SkeletonList />
            <p className="muted pub__wait" role="status">
              {slow
                ? "O servidor estava em repouso e está acordando. Na primeira abertura isso pode levar até 1 minuto."
                : "Carregando o acervo…"}
            </p>
          </>
        ) : null}

        {!loading && error && items.length === 0 ? (
          <div className="empty" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => loadPage(1, search, category, status)}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
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
          <div className={"pub__results" + (loading ? " is-refreshing" : "")}>
            {groups.map(([letter, letterItems]) => (
              <section key={letter} className="group">
                <h2 className="group__letter">{letter}</h2>
                <ul className="booklist">
                  {letterItems.map((book) => {
                    const info = availabilityOf(book);
                    const authors = book.authors.join(", ");
                    return (
                      <li key={book.id}>
                        <button
                          type="button"
                          className="bookrow"
                          onClick={() => setSelected(book)}
                        >
                          <BookCover
                            src={book.cover}
                            alt={"Capa de " + book.title}
                            className="cover--sm"
                          />
                          <span className="bookrow__text">
                            <strong title={book.title}>{book.title}</strong>
                            <small className="bookrow__meta">
                              <span
                                className="bookrow__authors"
                                title={authors || undefined}
                              >
                                {authors || "Autor não informado"}
                              </span>
                            </small>
                            <span className="pub__avail">
                              <Availability book={book} />
                              {info.note ? (
                                <small className="pub__note">{info.note}</small>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {error && items.length > 0 ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {items.length > 0 && hasMore ? (
          <div className="loadmore">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                const applied = appliedRef.current;
                loadPage(
                  page + 1,
                  applied.term,
                  applied.categoryName,
                  applied.statusKey,
                );
              }}
              disabled={loadingMore || loading}
            >
              {loadingMore ? "Carregando…" : "Carregar mais " + PAGE_SIZE}
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

      {/* Detalhes do livro: so leitura. Sem botoes de editar/excluir e sem
          nada sobre quem esta com o livro (o servidor nem envia). */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title || ""}
      >
        {selected ? (
          <div className="detail">
            <BookCover
              src={selected.cover}
              alt={"Capa de " + selected.title}
              className="cover--lg"
            />
            <dl className="detail__data">
              <div className="detail__wide">
                <dt>Situação</dt>
                <dd>
                  <Availability book={selected} />
                  <span className="pub__situation">
                    {situationText(selected)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Autor</dt>
                <dd>{selected.authors.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>{selected.categories.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Editora</dt>
                <dd>{selected.publisher || "—"}</dd>
              </div>
              <div>
                <dt>Ano</dt>
                <dd>{selected.year || "—"}</dd>
              </div>
              <div>
                <dt>Páginas</dt>
                <dd>{selected.pages || "—"}</dd>
              </div>
              <div>
                <dt>ISBN</dt>
                <dd>{selected.isbn || "—"}</dd>
              </div>
              <div>
                <dt>Quantidade</dt>
                <dd>{selected.copies}</dd>
              </div>
            </dl>
            {selected.synopsis ? (
              <div className="detail__synopsis">
                <h3>Sinopse</h3>
                <p>{selected.synopsis}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
