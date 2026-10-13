import Modal from "./Modal.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";

/**
 * "Já existe alguém com esse nome. É a mesma pessoa?"
 *
 * Aparece quando o nome digitado bate com o de quem ja esta no cadastro. Quem
 * e quem no sistema e o REGISTRO da pessoa (o numero #1, #2, #3...), nunca o
 * nome: por isso a escolha e explicita aqui, em vez de o sistema adivinhar.
 *
 * Props:
 *  - warning: { error, people: [{ _id, code, fullName, phone }] } (do servidor)
 *  - onUsePerson(person): e essa pessoa mesmo
 *  - onCreateNew(): e outra pessoa, de nome igual - cadastrar separada
 *  - onCancel(): voltar e corrigir o nome
 */
export default function SamePersonDialog({
  open,
  warning,
  onUsePerson,
  onCreateNew,
  onCancel,
}) {
  const people = warning?.people || [];

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Esse nome já está no cadastro"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Voltar
          </button>
          <button type="button" className="btn btn--primary" onClick={onCreateNew}>
            É outra pessoa
          </button>
        </>
      }
    >
      <p className="confirm__text">
        {people.length === 1
          ? "Confira se é a mesma pessoa. Se for outra pessoa de nome igual, ela entra no cadastro com um número próprio."
          : "Escolha de quem se trata. Se for outra pessoa de nome igual, ela entra no cadastro com um número próprio."}
      </p>

      <ul className="pickperson">
        {people.map((person) => (
          <li key={person._id}>
            <button
              type="button"
              className="combo__item pickperson__item"
              onClick={() => onUsePerson(person)}
            >
              <span>
                <strong>
                  {(person.code ? "#" + person.code + " " : "") +
                    person.fullName}
                </strong>
                <small>
                  {person.phone
                    ? formatStoredPhone(person.phone)
                    : "sem WhatsApp"}
                </small>
              </span>
              <span className="pickperson__pick">é esta</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
