import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import BookCover from "../components/BookCover.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { IconTrash } from "../components/Icons.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import { parseDate } from "../utils/dates.js";

/**
 * Livros sugeridos (Configuracoes > Livros sugeridos): os livros que quem
 * visita o acervo publico pediu pelo "Sugerir um livro" do menu Participe.
 *
 * Na ordem em que chegaram - a sugestao mais antiga primeiro. Cada uma pode
 * ser excluida (a foto dela sai do Cloudinary junto), ou todas de uma vez -
 * para depois de uma enxurrada de sugestoes falsas. Nao ha dado de quem
 * sugeriu: o servidor nem guarda.
 */

function sentAt(value) {
  const date = parseDate(value);
  if (!date) return "";
  return (
    date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " +
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function Suggestions() {
  const { notify } = useToast();
  // null = ainda carregando (a tela mostra o esqueleto).
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const data = await api("/api/suggestions");
      if (requestId !== requestRef.current) return;
      setItems(data);
      setError("");
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Livros sugeridos · Biblioteca ADMP Brasil";
    return () => {
      document.title = previous;
    };
  }, []);

  async function handleDelete() {
    const target = confirmDelete;
    if (!target || deleting) return;
    setDeleting(true);
    try {
      await api("/api/suggestions/" + target.id, { method: "DELETE" });
      setItems((current) => (current || []).filter((item) => item.id !== target.id));
      notify("Sugestão excluída.", "success");
    } catch (err) {
      notify(err.message, "error");
      // Ja excluida por outra pessoa: a lista e recarregada.
      if (err.status === 404) load();
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  async function handleDeleteAll() {
    if (deleting) return;
    setDeleting(true);
    try {
      // So as que estao na tela: uma que chegou depois aparece na recarga,
      // em vez de sumir sem ninguem ver.
      const data = await api("/api/suggestions", {
        method: "DELETE",
        body: { ids: (items || []).map((item) => item.id) },
      });
      load();
      notify(
        data?.deleted === 1 ? "1 sugestão excluída." : (data?.deleted ?? 0) + " sugestões excluídas.",
        "success",
      );
    } catch (err) {
      notify(err.message, "error");
      load();
    } finally {
      setDeleting(false);
      setConfirmAll(false);
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Livros sugeridos</h1>
          <p className="page__sub">
            {items === null
              ? error
                ? "Não foi possível carregar"
                : "Carregando…"
              : items.length === 0
                ? "Nenhuma sugestão ainda"
                : items.length === 1
                  ? "1 sugestão"
                  : items.length + " sugestões"}
          </p>
        </div>
        {items && items.length > 1 ? (
          <button type="button" className="btn btn--ghost suggest__clear" onClick={() => setConfirmAll(true)}>
            <IconTrash width={18} height={18} aria-hidden="true" />
            Excluir todas
          </button>
        ) : null}
      </div>

      <p className="muted">
        Livros que quem visita o catálogo gostaria de ver no acervo, pelo botão
        “Participe”. A lista segue a ordem em que chegaram: a mais antiga
        primeiro.
      </p>

      {items === null && !error ? <ListSkeleton label="Carregando as sugestões…" /> : null}

      {error && items === null ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div className="empty">
          <p>
            Nenhuma sugestão por enquanto. Elas chegam pelo “Sugerir um livro”
            do menu Participe, no catálogo público.
          </p>
        </div>
      ) : null}

      {items !== null && items.length > 0 ? (
        <ol className="suggestlist">
          {items.map((item, index) => {
            const title = formatBookTitle(item.title);
            return (
              <li key={item.id} className="suggestrow">
                <span className="suggestrow__pos" aria-label={"Sugestão " + (index + 1)}>
                  {index + 1}º
                </span>
                {item.photo ? (
                  <a
                    href={item.photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="suggestrow__cover"
                    title="Abrir a foto"
                  >
                    <BookCover src={item.photo} alt={"Foto de " + title} className="cover--sm" />
                  </a>
                ) : (
                  <span className="suggestrow__cover">
                    <BookCover src="" alt="" className="cover--sm" />
                  </span>
                )}
                <span className="suggestrow__text">
                  <strong title={title}>{title}</strong>
                  {/* Mesmo padrao de escrita do titulo ("john bunyan" vira
                      "John Bunyan", "Machado de Assis" fica igual). */}
                  <small>{formatBookTitle(item.author)}</small>
                  <small className="suggestrow__date">Sugerido em {sentAt(item.createdAt)}</small>
                </span>
                <button
                  type="button"
                  className="icon-button suggestrow__delete"
                  title={"Excluir a sugestão de " + title}
                  onClick={() => setConfirmDelete(item)}
                >
                  <IconTrash width={18} height={18} />
                  <span className="sr-only">Excluir a sugestão de {title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}

      <Confirm
        open={Boolean(confirmDelete)}
        title="Excluir sugestão"
        message={
          "Excluir a sugestão de “" +
          formatBookTitle(confirmDelete?.title || "") +
          "”, de " +
          (confirmDelete?.author || "") +
          "?" +
          (confirmDelete?.photo ? " A foto também será apagada." : "")
        }
        confirmLabel={deleting ? "Excluindo…" : "Excluir"}
        tone="danger"
        onCancel={() => !deleting && setConfirmDelete(null)}
        onConfirm={handleDelete}
      />

      <Confirm
        open={confirmAll}
        title="Excluir todas as sugestões"
        message={
          "Excluir as " +
          (items?.length || 0) +
          " sugestões da lista, com as fotos? Não dá para desfazer."
        }
        confirmLabel={deleting ? "Excluindo…" : "Excluir todas"}
        tone="danger"
        onCancel={() => !deleting && setConfirmAll(false)}
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
