import { useEffect, useRef } from "react";
import { IconClose } from "./Icons.jsx";

// Pilha de modais abertos. Quando ha um modal sobre outro (ex.: o recorte da
// capa sobre o formulario do livro), o Esc fecha so o de cima.
const openModals = [];

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const token = {};
    openModals.push(token);

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (openModals[openModals.length - 1] !== token) return;
      onCloseRef.current();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.indexOf(token);
      if (index !== -1) openModals.splice(index, 1);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) =>
        closeOnBackdrop && e.target === e.currentTarget && onClose()
      }
    >
      <div
        className={"modal modal--" + size}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconClose width={20} height={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
