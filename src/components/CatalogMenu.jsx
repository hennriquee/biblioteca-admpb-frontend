import Modal from "./Modal.jsx";
import {
  IconBookPlus,
  IconChat,
  IconExternal,
  // APOIE (desativado por enquanto): descomente junto com o botao mais abaixo.
  // IconHeart,
  IconMessage,
  IconWhatsapp,
} from "./Icons.jsx";
import { LIBRARY_CONTACT_URL, WHATSAPP_GROUP } from "../utils/support.js";

/**
 * Menu "Participe" do acervo publico: o botao ao lado do titulo do /catalogo
 * abre esta janela. Cada opcao abre a sua propria janela POR CIMA desta
 * (fechar volta para o menu), menos as duas do WhatsApp ("Precisa de algo a
 * mais?" e o grupo), que sao links.
 *
 * "Com quem falar?" so aparece se houver equipe cadastrada (hasStaff).
 */
export default function CatalogMenu({
  open,
  onClose,
  hasStaff,
  onStaff,
  onSuggest,
  // APOIE (desativado por enquanto): descomente junto com o botao mais abaixo.
  // onSupport,
}) {
  return (
    <Modal open={open} onClose={onClose} title="Participe" variant="pub" size="sm">
      <p className="muted">
        Fale com a equipe, ajude a escolher os próximos livros e acompanhe as
        novidades da biblioteca.
      </p>

      <nav className="pubmenu" aria-label="Participe">
        {hasStaff ? (
          <button type="button" className="pubmenu__item" onClick={onStaff}>
            <span className="pubmenu__icon">
              <IconChat width={20} height={20} />
            </span>
            <span className="pubmenu__text">
              <strong>Com quem falar?</strong>
              <small>Quem procurar na igreja para pegar, devolver ou doar um livro</small>
            </span>
          </button>
        ) : null}

        <button type="button" className="pubmenu__item" onClick={onSuggest}>
          <span className="pubmenu__icon">
            <IconBookPlus width={20} height={20} />
          </span>
          <span className="pubmenu__text">
            <strong>Sugerir um livro</strong>
            <small>Conte qual livro você gostaria de ver no acervo</small>
          </span>
        </button>

        {/* APOIE O NOSSO PROJETO (desativado por enquanto). Para voltar:
            descomente este botao, o IconHeart e o onSupport la em cima, e o
            que estiver marcado "APOIE" em pages/Catalog.jsx.
        <button type="button" className="pubmenu__item" onClick={onSupport}>
          <span className="pubmenu__icon">
            <IconHeart width={20} height={20} />
          </span>
          <span className="pubmenu__text">
            <strong>Apoie o nosso projeto</strong>
            <small>Contribua com qualquer valor pelo PIX</small>
          </span>
        </button>
        */}

        {/* Conversa direta com a biblioteca (o numero argentino, o mesmo do
            botao verde flutuante do acervo). */}
        <a
          className="pubmenu__item"
          href={LIBRARY_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="pubmenu__icon">
            <IconMessage width={20} height={20} />
          </span>
          <span className="pubmenu__text">
            <strong>Precisa de algo a mais?</strong>
            <small>Fale conosco pelo WhatsApp</small>
          </span>
          <IconExternal
            className="pubmenu__out"
            width={16}
            height={16}
            aria-hidden="true"
          />
        </a>

        <a
          className="pubmenu__item"
          href={WHATSAPP_GROUP}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="pubmenu__icon pubmenu__icon--whatsapp">
            <IconWhatsapp width={20} height={20} />
          </span>
          <span className="pubmenu__text">
            <strong>Entre no nosso grupo do WhatsApp</strong>
            <small>Acompanhe as nossas novidades</small>
          </span>
          <IconExternal
            className="pubmenu__out"
            width={16}
            height={16}
            aria-hidden="true"
          />
        </a>
      </nav>
    </Modal>
  );
}
