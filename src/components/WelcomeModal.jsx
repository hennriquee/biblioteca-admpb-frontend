import Modal from "./Modal.jsx";
import WelcomeScene from "./WelcomeScene.jsx";

/**
 * Boas-vindas do acervo publico: a animacao da logo e, embaixo, o proposito
 * da biblioteca. A animacao so roda com o modal aberto (ao fechar, o
 * WelcomeScene sai da tela e para de desenhar).
 *
 * Nao fecha com toque fora: e a primeira coisa que a pessoa ve, e um toque
 * sem querer a faria sumir. Fecha pelo botao, pelo "x" ou pelo Esc.
 */
export default function WelcomeModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Boas-vindas!"
      closeOnBackdrop={false}
      variant="hero"
      footer={
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={onClose}
        >
          Ver o acervo
        </button>
      }
    >
      <div className="welcome">
        <div className="welcome__stage">
          <WelcomeScene />
        </div>
        <div className="welcome__text">
          <h2 className="welcome__title">Boas-vindas!</h2>
          <p className="welcome__lead">Esta é a biblioteca da ADMP Brasil.</p>
          <p>
            Nosso propósito é que cada membro cultive uma vida de leitura:
            para edificação, para alcançar vidas para Cristo e para que Deus
            seja louvado nos corações.
          </p>
          <p>
            Aqui você encontra os livros do nosso acervo e vê quais estão
            disponíveis.
          </p>
        </div>
      </div>
    </Modal>
  );
}
