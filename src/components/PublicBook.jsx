import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { IconCheck, IconCrown, IconLoans } from "./Icons.jsx";
import { formatDate } from "../utils/dates.js";
import { formatBookTitle } from "../utils/bookTitle.js";

/**
 * O livro como o acervo publico o mostra: a linha da lista e a janela de
 * detalhes. Fica aqui porque duas telas usam o mesmo desenho - o Catalogo
 * (/catalogo) e as Novidades (/catalogo/novidades) - e abrir um livro numa
 * delas precisa ser igual a abrir na outra.
 *
 * So leitura: sem botoes de editar/excluir e sem nada sobre quem esta com o
 * livro (o servidor nem envia).
 */

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

/**
 * PREVISAO DE ENTREGA: a data combinada para o exemplar emprestado voltar
 * para a estante. Com mais de um exemplar fora, o servidor manda a data mais
 * proxima entre elas (o que nao garante que sera o primeiro a voltar: um
 * exemplar emprestado sem prazo pode chegar antes).
 *
 * Devolve null quando nada esta emprestado: ai a linha nem aparece na tela.
 */
function deliveryInfo(book) {
  const loaned = book.loaned || 0;
  if (loaned < 1) return null;

  return {
    label: loaned > 1 ? "Próxima entrega combinada" : "Previsão de entrega",
    value: book.dueDate ? formatDate(book.dueDate) : "Sem data combinada",
  };
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

/**
 * Linha do livro na lista: capa, titulo, autor e situacao. E um botao que
 * chama onOpen(book). A coroinha do livro mais emprestado fica em cima da capa
 * (ninguem a recebe se houver empate no primeiro lugar).
 */
export function PublicBookRow({ book, onOpen, mostLoaned = false }) {
  const info = availabilityOf(book);
  const authors = book.authors.join(", ");
  const bookTitle = formatBookTitle(book.title);
  return (
    <button type="button" className="bookrow" onClick={() => onOpen(book)}>
      <span className="crowned">
        <BookCover
          src={book.cover}
          alt={"Capa de " + bookTitle}
          className="cover--sm"
        />
        {mostLoaned ? (
          <span
            className="crowned__crown"
            title="O livro mais emprestado do acervo"
          >
            <IconCrown width={15} height={15} />
            <span className="sr-only">O livro mais emprestado do acervo</span>
          </span>
        ) : null}
      </span>
      <span className="bookrow__text">
        <strong title={bookTitle}>{bookTitle}</strong>
        <small className="bookrow__meta">
          <span className="bookrow__authors" title={authors || undefined}>
            {authors || "Autor não informado"}
          </span>
        </small>
        <span className="pub__avail">
          <Availability book={book} />
          {info.note ? <small className="pub__note">{info.note}</small> : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Janela de detalhes do livro. `book` null = fechada. mostLoaned acende a
 * coroinha de "mais emprestado" ao lado da situacao.
 */
export default function PublicBookModal({ book, onClose, mostLoaned = false }) {
  const delivery = book ? deliveryInfo(book) : null;

  return (
    <Modal
      open={Boolean(book)}
      onClose={onClose}
      title={formatBookTitle(book?.title)}
      variant="pub"
    >
      {book ? (
        <div className="detail">
          <BookCover
            src={book.cover}
            alt={"Capa de " + formatBookTitle(book.title)}
            className="cover--lg"
          />
          <dl className="detail__data">
            <div className="detail__wide">
              <dt>Situação</dt>
              <dd>
                {/* A coroinha do mais emprestado fica aqui, ao lado da
                    situacao: ela diz que o livro e o mais procurado do
                    acervo, sem dizer quantas vezes ele saiu. */}
                <span className="pub__avail">
                  <Availability book={book} />
                  {mostLoaned ? (
                    <span className="detail__crown">
                      <IconCrown width={15} height={15} />
                      mais emprestado
                    </span>
                  ) : null}
                </span>
                <span className="pub__situation">{situationText(book)}</span>
              </dd>
            </div>
            <div>
              <dt>Autor</dt>
              <dd>{book.authors.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{book.categories.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Editora</dt>
              <dd>{book.publisher || "—"}</dd>
            </div>
            <div>
              <dt>Ano</dt>
              <dd>{book.year || "—"}</dd>
            </div>
            <div>
              <dt>Páginas</dt>
              <dd>{book.pages || "—"}</dd>
            </div>
            <div>
              <dt>ISBN</dt>
              <dd>{book.isbn || "—"}</dd>
            </div>
            <div>
              <dt>Quantidade</dt>
              <dd>{book.copies}</dd>
            </div>
            {/* Ultimo item da lista, do lado da Quantidade. So aparece com
                exemplar emprestado. */}
            {delivery ? (
              <div>
                <dt>{delivery.label}</dt>
                <dd>{delivery.value}</dd>
              </div>
            ) : null}
          </dl>
          {book.synopsis ? (
            <div className="detail__synopsis">
              <h3>Sinopse</h3>
              <p>{book.synopsis}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
