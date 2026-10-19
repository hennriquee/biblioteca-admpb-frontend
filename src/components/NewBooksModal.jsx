import { Link } from "react-router-dom";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";

/**
 * Aviso de novidade do acervo publico: "chegaram livros novos desde sua
 * ultima visita", com a capa dos mais recentes e um botao que leva para a
 * lista completa (/catalogo/novidades).
 *
 * So fecha pelo botao, pelo "x" ou pelo Esc. Fechar sem clicar no botao NAO
 * marca como visto (isso so acontece ao abrir a lista) - entao o aviso volta
 * a aparecer na proxima visita, como esperado.
 */
export default function NewBooksModal({ open, onClose, total, items }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novidades no acervo"
      variant="pub"
      footer={
        <Link
          to="/catalogo/novidades"
          className="btn btn--primary btn--block"
          onClick={onClose}
        >
          Conferir
        </Link>
      }
    >
      <div className="newbooks">
        <div className="newbooks__covers">
          {items.map((book) => (
            <BookCover
              key={book.id}
              src={book.cover}
              alt={"Capa de " + formatBookTitle(book.title)}
              className="cover--sm"
            />
          ))}
        </div>
        <p className="newbooks__lead">
          <strong>{total}</strong>{" "}
          {total === 1 ? "livro novo foi" : "livros novos foram"} adicionado
          {total === 1 ? "" : "s"} ao acervo desde sua última visita.
        </p>
      </div>
    </Modal>
  );
}
