import Modal from './Modal.jsx';

export default function Confirm({ open, title, message, confirmLabel = 'Confirmar', tone = 'primary', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Voltar
          </button>
          <button type="button" className={'btn btn--' + tone} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm__text">{message}</p>
    </Modal>
  );
}
