import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import BookCover from "../components/BookCover.jsx";
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
} from "../components/Icons.jsx";

const emptyForm = {
  isbn: "",
  title: "",
  authors: "",
  publisher: "",
  year: "",
  pages: "",
  cover: "",
  synopsis: "",
  copies: 1,
};

function groupByLetter(books) {
  const groups = new Map();
  books.forEach((book) => {
    const letter = (book.titleSort || book.title || "?")
      .charAt(0)
      .toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(key, [...(groups.get(key) || []), book]);
  });
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const PAGE_SIZE = 10;

export default function Books() {
  const { notify } = useToast();

  // "items" e so o que ja foi carregado na tela (10, 20, 30… conforme o
  // usuario clica em "carregar mais"). "total" vem do servidor e reflete o
  // acervo inteiro (ou o total de resultados da busca), entao a busca
  // sempre encontra qualquer livro, mesmo um que nunca tenha sido carregado.
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [creating, setCreating] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [lookupState, setLookupState] = useState("idle"); // idle | loading | found | manual
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPage = useCallback(
    async (pageToLoad, term) => {
      const isFirstPage = pageToLoad === 1;
      if (isFirstPage) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(PAGE_SIZE),
        });
        if (term.trim()) params.set("search", term.trim());

        const data = await api("/api/books?" + params.toString());

        setItems((prev) =>
          isFirstPage ? data.items : [...prev, ...data.items],
        );
        setTotal(data.total);
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (error) {
        notify(error.message, "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [notify],
  );

  // Recarrega do zero (pagina 1) sempre que a busca muda, com um pequeno
  // debounce pra nao disparar uma chamada a cada tecla digitada.
  useEffect(() => {
    const timer = setTimeout(() => loadPage(1, search), 250);
    return () => clearTimeout(timer);
  }, [search, loadPage]);

  function loadMore() {
    loadPage(page + 1, search);
  }

  function reloadFromStart() {
    loadPage(1, search);
  }

  const groups = useMemo(() => groupByLetter(items), [items]);

  function openCreate() {
    setForm(emptyForm);
    setIsbnInput("");
    setLookupState("idle");
    setEditingId(null);
    setCreating(true);
  }

  async function handleLookup(event) {
    event.preventDefault();
    const isbn = isbnInput.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) {
      notify("O ISBN precisa ter 10 ou 13 digitos.", "error");
      return;
    }

    setLookupState("loading");
    try {
      const data = await api("/api/books/lookup/" + isbn);
      if (data.alreadyRegistered) {
        notify("Esse livro ja esta no acervo.", "error");
        setLookupState("idle");
        return;
      }
      setForm({
        isbn: data.isbn || isbn,
        title: data.title || "",
        authors: (data.authors || []).join(", "),
        publisher: data.publisher || "",
        year: data.year || "",
        pages: data.pages || "",
        cover: data.cover || "",
        synopsis: data.synopsis || "",
        copies: 1,
      });
      setLookupState("found");
    } catch (error) {
      notify(error.message, "error");
      setForm({ ...emptyForm, isbn });
      setLookupState("manual");
    }
  }

  function startEdit(book) {
    setForm({
      isbn: book.isbn || "",
      title: book.title || "",
      authors: (book.authors || []).join(", "),
      publisher: book.publisher || "",
      year: book.year || "",
      pages: book.pages || "",
      cover: book.cover || "",
      synopsis: book.synopsis || "",
      copies: book.copies || 1,
    });
    setEditingId(book._id);
    setLookupState("found");
    setSelected(null);
    setCreating(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      notify("Preencha o titulo do livro.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        pages: form.pages ? Number(form.pages) : null,
        copies: Number(form.copies) || 1,
      };

      if (editingId) {
        await api("/api/books/" + editingId, { method: "PUT", body: payload });
        notify("Livro atualizado.", "success");
      } else {
        await api("/api/books", { method: "POST", body: payload });
        notify("Livro cadastrado.", "success");
      }

      setCreating(false);
      setEditingId(null);
      await reloadFromStart();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const book = confirmDelete;
    setConfirmDelete(null);
    try {
      await api("/api/books/" + book._id, { method: "DELETE" });
      notify("Livro excluido.", "success");
      setSelected(null);
      await reloadFromStart();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Acervo</h1>
          <p className="page__sub">
            {loading
              ? "Carregando…"
              : total === 0
                ? "Nenhum livro cadastrado"
                : items.length +
                  " de " +
                  total +
                  " livro(s)" +
                  (search.trim() ? " encontrados" : " cadastrados")}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <IconPlus width={18} height={18} />
          Cadastrar livro
        </button>
      </div>

      <div className="searchbar">
        <IconSearch width={18} height={18} />
        <input
          type="search"
          placeholder="Buscar por titulo, autor ou ISBN"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <p className="muted">Carregando o acervo…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="empty">
          <p>
            {search.trim()
              ? "Nenhum livro corresponde a essa busca."
              : "A estante esta vazia."}
          </p>
          {!search.trim() ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={openCreate}
            >
              Cadastrar o primeiro livro
            </button>
          ) : null}
        </div>
      ) : null}

      {groups.map(([letter, letterItems]) => (
        <section key={letter} className="group">
          <h2 className="group__letter">{letter}</h2>
          <ul className="booklist">
            {letterItems.map((book) => (
              <li key={book._id}>
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
                    <strong>{book.title}</strong>
                    <small>
                      {(book.authors || []).join(", ") || "Autor nao informado"}
                    </small>
                  </span>
                  {book.loanedTo ? (
                    <span className="chip chip--out">emprestado</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!loading && hasMore ? (
        <div className="loadmore">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando…" : "Carregar mais 10"}
          </button>
        </div>
      ) : null}

      {/* Modal de detalhes do livro */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title || ""}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirmDelete(selected)}
            >
              <IconTrash width={17} height={17} />
              Excluir
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => startEdit(selected)}
            >
              <IconEdit width={17} height={17} />
              Editar
            </button>
          </>
        }
      >
        {selected ? (
          <div className="detail">
            <BookCover
              src={selected.cover}
              alt={"Capa de " + selected.title}
              className="cover--lg"
            />
            <dl className="detail__data">
              <div>
                <dt>Autor</dt>
                <dd>{(selected.authors || []).join(", ") || "—"}</dd>
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
                <dt>Paginas</dt>
                <dd>{selected.pages || "—"}</dd>
              </div>
              <div>
                <dt>ISBN</dt>
                <dd>{selected.isbn || "—"}</dd>
              </div>
              <div>
                <dt>Situacao</dt>
                <dd>
                  {selected.loanedTo
                    ? "Com " + selected.loanedTo
                    : "Na estante"}
                </dd>
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

      {/* Modal de cadastro / edicao */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={editingId ? "Editar livro" : "Cadastrar livro"}
        footer={
          lookupState === "found" || lookupState === "manual" ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="book-form"
                className="btn btn--primary"
                disabled={saving}
              >
                {saving ? "Salvando…" : "Salvar livro"}
              </button>
            </>
          ) : null
        }
      >
        {lookupState === "idle" || lookupState === "loading" ? (
          <form className="isbn-step" onSubmit={handleLookup}>
            <p className="muted">
              Digite o ISBN e a ficha do livro vem preenchida automaticamente.
            </p>
            <label className="field">
              <span>ISBN</span>
              <input
                type="text"
                inputMode="numeric"
                value={isbnInput}
                onChange={(e) => setIsbnInput(e.target.value)}
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={lookupState === "loading"}
            >
              {lookupState === "loading"
                ? "Procurando…"
                : "Buscar dados do livro"}
            </button>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setForm({ ...emptyForm, isbn: isbnInput });
                setLookupState("manual");
              }}
            >
              Nao tenho o ISBN, quero preencher na mão
            </button>
          </form>
        ) : (
          <form id="book-form" className="bookform" onSubmit={handleSave}>
            <div className="bookform__preview">
              <BookCover src={form.cover} alt="" className="cover--md" />
            </div>

            <label className="field">
              <span>Titulo</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Autores (separados por virgula)</span>
              <input
                value={form.authors}
                onChange={(e) => setForm({ ...form, authors: e.target.value })}
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Editora</span>
                <input
                  value={form.publisher}
                  onChange={(e) =>
                    setForm({ ...form, publisher: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Ano</span>
                <input
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>ISBN</span>
                <input
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Paginas</span>
                <input
                  type="number"
                  min="0"
                  value={form.pages || ""}
                  onChange={(e) => setForm({ ...form, pages: e.target.value })}
                />
              </label>
            </div>

            <label className="field">
              <span>Link da capa</span>
              <input
                value={form.cover}
                onChange={(e) => setForm({ ...form, cover: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Sinopse</span>
              <textarea
                rows="5"
                value={form.synopsis}
                onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              />
            </label>
          </form>
        )}
      </Modal>

      <Confirm
        open={Boolean(confirmDelete)}
        title="Excluir livro"
        message={
          'Excluir "' +
          (confirmDelete?.title || "") +
          '" do acervo? Essa acao nao tem volta.'
        }
        confirmLabel="Excluir"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
