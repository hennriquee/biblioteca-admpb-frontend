import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import BookCover from "../components/BookCover.jsx";
import CoverSearchModal from "../components/CoverSearchModal.jsx";
import CoverPicker from "../components/CoverPicker.jsx";
import CategoryPicker from "../components/CategoryPicker.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { findCategory } from "../utils/categories.js";
import { matchesBook } from "../utils/bookFilter.js";
import { useBookList } from "../hooks/useBookList.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { parseCoverInput } from "../api/imageSearch.js";
import {
  IconCrown,
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
  // Foto tirada/escolhida e recortada no app (data URI). So existe ate salvar:
  // o servidor envia para o Cloudinary e guarda o link em "cover".
  coverImage: "",
  // Uma categoria por livro (tema, ex.: "Oração"); o servidor guarda em "categories".
  category: "",
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

const MAX_COPIES = 999;

// Uma pagina do acervo. filters = null traz sem filtro (ver useBookList).
function loadBooks(pageNumber, limit, filters) {
  const params = new URLSearchParams({
    page: String(pageNumber),
    limit: String(limit),
  });
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  return api("/api/books?" + params.toString());
}

// Texto da situação do livro, considerando todas as unidades.
function loanStatusText(book) {
  const names = book.loanedNames || [];
  if ((book.copies || 1) > 1) {
    const base = book.available + " de " + book.copies + " na estante";
    return names.length ? base + " · com " + names.join(", ") : base;
  }
  return names.length ? "Com " + names[0] : "Na estante";
}

// Selo da lista: só aparece quando há unidade emprestada.
function loanChip(book) {
  if (!book.loanedCount) return null;
  if ((book.copies || 1) === 1) return { label: "emprestado", full: true };
  if (book.available === 0) return { label: "todos emprestados", full: true };
  return {
    label: book.loanedCount + " de " + book.copies + " emprestados",
    full: false,
  };
}

export default function Books() {
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  // Categorias que ja existem no acervo ([{ name, count }]) e a escolhida no filtro.
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");

  // O acervo e baixado uma vez e os filtros rodam aqui mesmo, na hora (ver
  // useBookList). "items" e o que esta na tela (10, 20, 30… conforme o
  // "carregar mais"); "total" e quantos livros o filtro atual encontra.
  const list = useBookList({
    load: loadBooks,
    filters: { search: search.trim(), category: categoryFilter },
    matches: matchesBook,
  });
  const { items, total, hasMore, waiting, error } = list;

  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [creating, setCreating] = useState(false);
  const [isbnInput, setIsbnInput] = useState("");
  const [lookupState, setLookupState] = useState("idle"); // idle | loading | found | manual
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  // Trava contra o clique duplo: dois toques rapidos em "Salvar livro"
  // cadastrariam o livro duas vezes.
  const savingRef = useRef(false);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const [coverSearchQuery, setCoverSearchQuery] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  // Unidades emprestadas agora do livro em edição: a quantidade não pode ficar
  // abaixo disso. E o livro já cadastrado quando o ISBN digitado se repete.
  const [loanedNow, setLoanedNow] = useState(0);
  const [duplicateBook, setDuplicateBook] = useState(null);
  const minCopies = Math.max(1, loanedNow);

  // Lista de categorias do acervo (alimenta o filtro e o campo do cadastro).
  // Se a categoria filtrada deixou de existir (ex.: o ultimo livro dela foi
  // editado ou excluido), o filtro volta para "todas".
  const loadCategories = useCallback(async () => {
    try {
      const data = await api("/api/books/categories");
      setCategories(data);
      setCategoryFilter((current) =>
        current && !data.some((item) => item.name === current) ? "" : current,
      );
    } catch {
      // Nao e essencial: sem a lista, o filtro some e o cadastro ainda
      // permite escrever a categoria.
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function reloadFromStart() {
    loadCategories();
    return list.reload();
  }

  const groups = useMemo(() => groupByLetter(items), [items]);
  const isFiltering = Boolean(search.trim() || categoryFilter);

  function openCreate() {
    setForm(emptyForm);
    setIsbnInput("");
    setLookupState("idle");
    setEditingId(null);
    setLoanedNow(0);
    setLinkOpen(false);
    setCreating(true);
  }

  // Le o que a pessoa colou/digitou no campo "Link da capa". Se for um link
  // de foto de verdade (direto ou de dentro de um link de resultado do
  // Google), usa como capa. Se for um link de PAGINA DE BUSCA do Google sem
  // nenhuma foto embutida nele (comum no celular, formato .../search?q=...),
  // nao da pra usar como imagem - entao abrimos a busca por texto dentro do
  // proprio app com essa mesma pesquisa, pra pessoa escolher a foto certa
  // numa grade em vez de precisar copiar link nenhum.
  function handleCoverInputChange(rawValue) {
    const parsed = parseCoverInput(rawValue);
    if (parsed.type === "query") {
      setForm((f) => ({ ...f, cover: "", coverImage: "" }));
      setCoverSearchQuery(parsed.value);
      setCoverSearchOpen(true);
      return;
    }
    // Um link colado substitui qualquer foto que estivesse pendente.
    setForm((f) => ({ ...f, cover: parsed.value, coverImage: "" }));
  }

  async function handleLookup(event) {
    event.preventDefault();
    const isbn = isbnInput.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) {
      notify("O ISBN precisa ter 10 ou 13 dígitos.", "error");
      return;
    }

    setLookupState("loading");
    try {
      const data = await api("/api/books/lookup/" + isbn);
      if (data.alreadyRegistered) {
        setLookupState("idle");
        // Em vez de só barrar, oferece alterar a quantidade do livro que já existe.
        try {
          setDuplicateBook(await api("/api/books/" + data.existingId));
        } catch {
          notify("Esse livro já está no acervo.", "error");
        }
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
        coverImage: "",
        // Sugestao das APIs; se ja existe no acervo, usa a grafia de la.
        category: findCategory(categories, (data.categories || [])[0]),
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
      coverImage: "",
      category: (book.categories || [])[0] || "",
      synopsis: book.synopsis || "",
      copies: book.copies || 1,
    });
    setLoanedNow(book.loanedCount || 0);
    setLinkOpen(false);
    setEditingId(book._id);
    setLookupState("found");
    setSelected(null);
    setCreating(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      notify("Preencha o título do livro.", "error");
      return;
    }

    const copies = Number(form.copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) {
      notify("Informe a quantidade (de 1 a " + MAX_COPIES + ").", "error");
      return;
    }
    if (editingId && copies < loanedNow) {
      notify(
        "Há " +
          loanedNow +
          (loanedNow === 1 ? " emprestado" : " emprestados") +
          " agora, então a quantidade não pode ser menor que " +
          loanedNow +
          ".",
        "error",
      );
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { category, ...fields } = form;
      const payload = {
        ...fields,
        categories: category.trim() ? [category.trim()] : [],
        pages: form.pages ? Number(form.pages) : null,
        copies,
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
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete() {
    const book = confirmDelete;
    setConfirmDelete(null);
    try {
      await api("/api/books/" + book._id, { method: "DELETE" });
      notify("Livro excluído.", "success");
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
            {waiting
              ? "Carregando…"
              : error
                ? "Não foi possível carregar"
                : total === 0
                  ? isFiltering
                    ? "Nenhum livro encontrado"
                    : "Nenhum livro cadastrado"
                  : items.length +
                    " de " +
                    total +
                    " livro(s)" +
                    (isFiltering ? " encontrados" : " cadastrados")}
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
          placeholder="Buscar por título, autor ou ISBN"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categories.length > 0 ? (
        <CategoryPicker
          variant="filter"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categories}
          emptyLabel="Todas as categorias"
          placeholder="Todas as categorias"
          searchable
          showCounts
        />
      ) : null}

      {waiting ? <ListSkeleton label="Carregando o acervo…" /> : null}

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
              : "A estante está vazia."}
          </p>
          {!isFiltering ? (
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

      {groups.length > 0 ? (
        <div className={"results" + (list.refreshing ? " is-refreshing" : "")}>
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
                      {/* A coroinha do livro mais emprestado fica em cima
                          da capa. Sai de "mostLoanedId", que olha o acervo
                          inteiro: com empate no primeiro lugar, ninguem a
                          recebe. */}
                      <span className="crowned">
                        <BookCover
                          src={book.cover}
                          alt={"Capa de " + formatBookTitle(book.title)}
                          className="cover--sm"
                        />
                        {list.mostLoanedId === book._id ? (
                          <span
                            className="crowned__crown"
                            title="O livro mais emprestado do acervo"
                          >
                            <IconCrown width={15} height={15} />
                            <span className="sr-only">
                              O livro mais emprestado do acervo
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="bookrow__text">
                        <strong title={formatBookTitle(book.title)}>
                          {formatBookTitle(book.title)}
                        </strong>
                        <small className="bookrow__meta">
                          <span
                            className="bookrow__authors"
                            title={(book.authors || []).join(", ") || undefined}
                          >
                            {(book.authors || []).join(", ") ||
                              "Autor não informado"}
                          </span>
                          {book.copies > 1 ? (
                            <span className="bookrow__copies">
                              {"· " + book.copies + " unidades"}
                            </span>
                          ) : null}
                        </small>
                      </span>
                      {loanChip(book) ? (
                        <span
                          className={
                            "chip " +
                            (loanChip(book).full ? "chip--out" : "chip--part")
                          }
                        >
                          {loanChip(book).label}
                        </span>
                      ) : null}
                    </button>
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

      {/* Modal de detalhes do livro */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={formatBookTitle(selected?.title)}
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
              alt={"Capa de " + formatBookTitle(selected.title)}
              className="cover--lg"
            />
            <dl className="detail__data">
              <div>
                <dt>Autor</dt>
                <dd>{(selected.authors || []).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Categoria</dt>
                <dd>{(selected.categories || []).join(", ") || "—"}</dd>
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
                <dd>{selected.copies || 1}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>{loanStatusText(selected)}</dd>
              </div>
              <div>
                <dt>Vezes emprestado</dt>
                <dd>
                  {selected.loansTotal || 0}
                  {list.mostLoanedId === selected._id ? (
                    <span className="detail__crown">
                      <IconCrown width={15} height={15} />
                      mais emprestado
                    </span>
                  ) : null}
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
                {saving
                  ? form.coverImage
                    ? "Enviando capa…"
                    : "Salvando…"
                  : "Salvar livro"}
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
              Não tenho o ISBN, quero preencher na mão
            </button>
          </form>
        ) : (
          <form id="book-form" className="bookform" onSubmit={handleSave}>
            <CoverPicker
              src={form.coverImage || form.cover}
              linkOpen={linkOpen}
              notify={notify}
              onPhoto={(dataUri) =>
                setForm((f) => ({ ...f, coverImage: dataUri, cover: "" }))
              }
              onSearch={() => {
                setCoverSearchQuery(null);
                setCoverSearchOpen(true);
              }}
              onToggleLink={() => setLinkOpen((open) => !open)}
              onRemove={() =>
                setForm((f) => ({ ...f, cover: "", coverImage: "" }))
              }
            />

            {linkOpen ? (
              <label className="field">
                <span>Link da imagem da capa</span>
                <input
                  value={form.cover}
                  placeholder="Cole aqui o endereço da imagem"
                  onChange={(e) => handleCoverInputChange(e.target.value)}
                  autoFocus
                />
              </label>
            ) : null}

            <label className="field">
              <span>Título</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Autores (separados por vírgula)</span>
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
                <span>Páginas</span>
                <input
                  type="number"
                  min="0"
                  value={form.pages || ""}
                  onChange={(e) => setForm({ ...form, pages: e.target.value })}
                />
              </label>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="book-copies">
                Quantidade
              </label>
              <div className="stepper">
                <button
                  type="button"
                  className="stepper__btn"
                  aria-label="Diminuir quantidade"
                  disabled={(Number(form.copies) || 0) <= minCopies}
                  onClick={() =>
                    setForm({
                      ...form,
                      copies: Math.max(
                        minCopies,
                        (Number(form.copies) || 1) - 1,
                      ),
                    })
                  }
                >
                  –
                </button>
                <input
                  id="book-copies"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={form.copies}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      copies: e.target.value.replace(/\D/g, "").slice(0, 3),
                    })
                  }
                  onBlur={() =>
                    setForm((f) => ({
                      ...f,
                      copies: Math.min(
                        MAX_COPIES,
                        Math.max(minCopies, Number(f.copies) || 1),
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="stepper__btn"
                  aria-label="Aumentar quantidade"
                  disabled={(Number(form.copies) || 0) >= MAX_COPIES}
                  onClick={() =>
                    setForm({
                      ...form,
                      copies: Math.min(
                        MAX_COPIES,
                        (Number(form.copies) || 0) + 1,
                      ),
                    })
                  }
                >
                  +
                </button>
              </div>
              <small className="field__hint">
                {loanedNow > 0
                  ? loanedNow +
                    (loanedNow === 1
                      ? " está emprestado agora; a quantidade não pode ser menor que isso."
                      : " estão emprestados agora; a quantidade não pode ser menor que isso.")
                  : "Quantas cópias deste livro a biblioteca tem."}
              </small>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="book-category">
                Categoria
              </label>
              <CategoryPicker
                id="book-category"
                value={form.category}
                onChange={(category) => setForm((f) => ({ ...f, category }))}
                options={categories}
                emptyLabel="Sem categoria"
                placeholder="Selecione a categoria"
                allowCreate
              />
              <small className="field__hint">
                Escolha uma categoria do acervo ou escreva uma nova no fim da
                lista.
              </small>
            </div>

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

      <CoverSearchModal
        open={coverSearchOpen}
        onClose={() => setCoverSearchOpen(false)}
        onSelect={(url) =>
          setForm((f) => ({ ...f, cover: url, coverImage: "" }))
        }
        initialQuery={
          coverSearchQuery ??
          [form.title, form.authors.split(",")[0]]
            .filter(Boolean)
            .join(" ")
            .trim()
        }
      />

      <Confirm
        open={Boolean(duplicateBook)}
        title="Esse livro já está no acervo"
        message={
          '"' +
          formatBookTitle(duplicateBook?.title) +
          '" já está cadastrado (quantidade: ' +
          (duplicateBook?.copies || 1) +
          "). Quer alterar a quantidade?"
        }
        confirmLabel="Alterar quantidade"
        onCancel={() => setDuplicateBook(null)}
        onConfirm={() => {
          const book = duplicateBook;
          setDuplicateBook(null);
          startEdit(book);
        }}
      />

      <Confirm
        open={Boolean(confirmDelete)}
        title="Excluir livro"
        message={
          'Excluir "' +
          formatBookTitle(confirmDelete?.title) +
          '" do acervo? Essa ação não tem volta.'
        }
        confirmLabel="Excluir"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
