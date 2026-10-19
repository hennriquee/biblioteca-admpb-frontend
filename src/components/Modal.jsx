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
  // "pub": titulo maior, para os modais do acervo publico. "hero": sem
  // cabecalho; o titulo fica no conteudo e o "x" flutua sobre o topo.
  variant = "default",
  // "bottom" (padrao): no celular a janela sobe de baixo, como uma folha; "center":
  // abre no meio da tela em qualquer tamanho (para avisos que precisam de atencao).
  placement = "bottom",
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const token = {};
    openModals.push(token);

    function onKeyDown(event) {
      if (openModals[openModals.length - 1] !== token) return;
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Tab fica dando a volta dentro do modal, sem escapar para a tela de tras.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Guarda quem estava com o foco (o botao que abriu o modal) para devolver
    // ao fechar: quem navega pelo teclado continua de onde estava.
    const previousFocus = document.activeElement;
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.indexOf(token);
      if (index !== -1) openModals.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      // (Campo de texto fica de fora: devolver o foco abriria o teclado no
      // celular e reabriria as sugestoes do campo.)
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(previousFocus.tagName)
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={
        "modal-backdrop" + (placement === "center" ? " modal-backdrop--center" : "")
      }
      onMouseDown={(e) =>
        closeOnBackdrop && e.target === e.currentTarget && onClose()
      }
    >
      <div
        className={
          "modal modal--" + size + (variant === "default" ? "" : " modal--" + variant)
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        {variant === "hero" ? (
          // Primeiro filho do painel: continua sendo o primeiro do Tab.
          <button
            type="button"
            className="icon-button modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconClose width={20} height={20} />
          </button>
        ) : (
          <header className="modal__head">
            {/* Titulo longo (nome de livro) ganha um tamanho menor, para nao
                tomar o modal inteiro. */}
            <h2
              className={
                variant === "pub" && String(title).length > 60
                  ? "is-long"
                  : undefined
              }
            >
              {title}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Fechar"
            >
              <IconClose width={20} height={20} />
            </button>
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
