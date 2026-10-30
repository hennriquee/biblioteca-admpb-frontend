import Modal from './Modal.jsx';

// Pergunta "tem certeza?" com dois botoes.
// - cancelLabel: o botao da esquerda (padrao "Voltar", que so fecha).
// - onDismiss: o "x", o Esc e o clique fora. Sem ele, fazem o mesmo que o
//   botao da esquerda. Serve quando o botao da esquerda tambem e uma escolha
//   (ex.: "Manter o número antigo" no Novo emprestimo) e fechar e desistir.
export default function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  tone = 'primary',
  onConfirm,
  onCancel,
  onDismiss,
}) {
  return (
    <Modal
      open={open}
      onClose={onDismiss || onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
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
