import Modal from "./Modal.jsx";
import Avatar from "./Avatar.jsx";

/**
 * "Com quem falar?" do acervo publico: os cartoes da equipe da biblioteca,
 * com a foto e os dois primeiros nomes, para a pessoa saber quem procurar na
 * igreja. Nao mostra telefone nem nome completo - quem quer um livro fala
 * pessoalmente com a equipe.
 */
export default function StaffModal({ open, onClose, staff = [] }) {
  return (
    <Modal open={open} onClose={onClose} title="Com quem falar?" variant="pub">
      <p className="muted">
        Para pegar um livro emprestado ou devolver, procure uma destas pessoas
        na igreja:
      </p>

      <ul className="staff">
        {staff.map((person) => (
          <li key={person.id} className="staffcard">
            <Avatar src={person.photo} name={person.name} size={80} zoomable />
            <strong>{person.name}</strong>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
