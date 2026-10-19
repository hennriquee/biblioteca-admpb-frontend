import { Link } from "react-router-dom";
import Modal from "./Modal.jsx";
import BookCover from "./BookCover.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";

// Quantas capas aparecem no leque.
const SHOWN = 3;

// Como as capas se abrem, conforme quantas ha. A primeira (a mais nova) e a do
// meio e fica por cima das outras; as seguintes se abrem para os lados, por
// baixo dela, como as cartas na mao de alguem. rot = giro em graus (positivo
// = para a direita); delay = quando cada carta sai do monte (em segundos).
const FANS = {
  1: [{ rot: 0, z: 3, delay: 0.1 }],
  // Duas capas: a nova por cima, na direita, com a outra aparecendo atras.
  2: [
    { rot: 8, z: 3, delay: 0.1 },
    { rot: -8, z: 2, delay: 0.3 },
  ],
  3: [
    { rot: 0, z: 3, delay: 0.1 },
    { rot: -15, z: 2, delay: 0.3 },
    { rot: 15, z: 2, delay: 0.4 },
  ],
};

// Brilhinho de quatro pontas ao redor do leque.
function Spark({ x, y, size, delay }) {
  return (
    <svg
      className="newbooks__spark"
      viewBox="-10 -10 20 20"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        "--delay": delay + "s",
      }}
      aria-hidden="true"
    >
      <path d="M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9 Z" />
    </svg>
  );
}

/**
 * Aviso de novidade do acervo publico: as capas dos livros mais novos abertas
 * em leque, como cartas abertas na mao, uma bolinha "+N" quando ha mais
 * livros do que capas, e um convite para ver a lista completa
 * (/catalogo/novidades).
 *
 * Props:
 *  - total: quantos livros novos existem (todos, nao so os que tem capa aqui)
 *  - items: os mais novos primeiro; so os 3 primeiros aparecem
 *  - since: o "desde quando" desta contagem (texto ISO). Vai junto no link
 *    para a lista mostrar exatamente estes livros, mesmo depois de a
 *    novidade ser marcada como vista (ver pages/NewBooks.jsx).
 *
 * Fecha pelo botao, pelo "x", pelo Esc ou tocando fora. Fechar sem clicar no
 * botao NAO marca como visto (isso so acontece ao abrir a lista) - entao o
 * aviso volta a aparecer na proxima visita, como esperado.
 */
export default function NewBooksModal({ open, onClose, total, items, since }) {
  const shown = items.slice(0, SHOWN);
  const fan = FANS[shown.length] || [];
  const more = Math.max(0, total - shown.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chegaram novidades!"
      variant="hero"
      size="sm"
      placement="center"
      footer={
        <Link
          to="/catalogo/novidades"
          state={{ since }}
          className="btn btn--primary btn--block"
          onClick={onClose}
        >
          Conferir
        </Link>
      }
    >
      <div className="welcome newbooks">
        <div className="welcome__stage newbooks__stage">
          <div className="newbooks__fan">
            {shown.map((book, index) => (
              <div
                key={book.id}
                className={
                  "newbooks__card" + (index > 0 ? " newbooks__card--side" : "")
                }
                style={{
                  "--rot": fan[index].rot + "deg",
                  "--z": fan[index].z,
                  "--delay": fan[index].delay + "s",
                }}
              >
                <BookCover
                  src={book.cover}
                  alt={"Capa de " + formatBookTitle(book.title)}
                  title={formatBookTitle(book.title)}
                  className="cover--fan"
                />
              </div>
            ))}
            {more > 0 ? (
              <span className="newbooks__more" aria-hidden="true">
                +{more}
              </span>
            ) : null}
          </div>
          <Spark x="14%" y="22%" size={18} delay={0.8} />
          <Spark x="86%" y="80%" size={14} delay={1} />
          <Spark x="9%" y="56%" size={11} delay={1.15} />
        </div>
        <div className="welcome__text">
          <h2 className="welcome__title">Chegaram novidades!</h2>
          <p className="welcome__lead">
            Temos <strong>{total}</strong>{" "}
            {total === 1 ? "novo título" : "novos títulos"} que você ainda não
            tinha visto. Venha conferir!
          </p>
        </div>
      </div>
    </Modal>
  );
}
