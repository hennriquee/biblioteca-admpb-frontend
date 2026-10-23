import Modal from "./Modal.jsx";
import {
  IconBookPlus,
  IconChat,
  IconExternal,
  IconHeart,
  IconWhatsapp,
} from "./Icons.jsx";
import { WHATSAPP_GROUP } from "../utils/support.js";

/**
 * Menu "Participe" do acervo publico: o botao do topo do /catalogo abre esta
 * janela. Cada opcao abre a sua propria janela POR CIMA desta (fechar volta
 * para o menu), menos o grupo do WhatsApp, que e um link.
 *
 * "Com quem falar?" so aparece se houver equipe cadastrada (hasStaff).
 */
export default function CatalogMenu({
  open,
  onClose,
  hasStaff,
  onStaff,
  onSuggest,
  onSupport,
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

        <button type="button" className="pubmenu__item" onClick={onSupport}>
          <span className="pubmenu__icon">
            <IconHeart width={20} height={20} />
          </span>
          <span className="pubmenu__text">
            <strong>Apoie o nosso projeto</strong>
            <small>Contribua com qualquer valor pelo PIX</small>
          </span>
        </button>

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
