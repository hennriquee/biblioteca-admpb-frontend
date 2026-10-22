import { useEffect, useRef } from "react";
import { IconClose } from "./Icons.jsx";

// Pilha de modais abertos. Quando ha um modal sobre outro (ex.: o recorte da
// capa sobre o formulario do livro), o Esc fecha so o de cima.
const openModals = [];
// Como a pagina rolava antes do PRIMEIRO modal abrir. So volta quando o
// ultimo fecha: com dois modais fechando juntos (ex.: a ficha e o menu
// depois de enviar), cada um devolver o "seu" valor deixaria a pagina presa.
let pageOverflow = "";

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
  // Direcao do ultimo Tab (para o guarda de foco e as sentinelas).
  const tabBackRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const token = {};
    if (!openModals.length) pageOverflow = document.body.style.overflow;
    openModals.push(token);

    function focusableNodes() {
      return [
        ...panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (node) =>
          !node.disabled &&
          node.tabIndex !== -1 &&
          node.offsetParent !== null &&
          !node.classList.contains("modal__sentinel"),
      );
    }

    function onKeyDown(event) {
      if (openModals[openModals.length - 1] !== token) return;
      if (event.key === "Tab") tabBackRef.current = event.shiftKey;
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Tab fica dando a volta dentro do modal, sem escapar para a tela de tras.
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = focusableNodes();
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

    // Guarda de foco: se mesmo assim o foco sair do modal de cima (no Safari
    // os links nao recebem Tab, e o ultimo item ser um link deixava o Tab
    // escapar para a tela de tras), ele volta para dentro, para a ponta do
    // lado de onde a pessoa vinha.
    function onFocusIn(event) {
      if (openModals[openModals.length - 1] !== token || !panelRef.current) return;
      if (panelRef.current.contains(event.target)) return;
      const focusable = focusableNodes();
      const target = focusable.length
        ? tabBackRef.current
          ? focusable[focusable.length - 1]
          : focusable[0]
        : panelRef.current;
      target.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    document.body.style.overflow = "hidden";
    // Guarda quem estava com o foco (o botao que abriu o modal) para devolver
    // ao fechar: quem navega pelo teclado continua de onde estava.
    const previousFocus = document.activeElement;
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const index = openModals.indexOf(token);
      if (index !== -1) openModals.splice(index, 1);
      if (!openModals.length) document.body.style.overflow = pageOverflow;
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

  // Sentinelas: dois pontos invisiveis nas pontas do painel que recebem o Tab
  // em qualquer navegador. No Safari os links ficam fora do Tab, entao o
  // "ultimo" que o codigo acima enxerga (um link) nunca e alcancado e o Tab
  // sairia da pagina; caindo numa sentinela, o foco volta para a outra ponta.
  function focusEdge(toLast) {
    const nodes = panelRef.current
      ? [
          ...panelRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (node) =>
            !node.disabled &&
            node.tabIndex !== -1 &&
            node.offsetParent !== null &&
            !node.classList.contains("modal__sentinel"),
        )
      : [];
    const target = toLast ? nodes[nodes.length - 1] : nodes[0];
    (target || panelRef.current)?.focus();
  }

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
        <span
          className="modal__sentinel"
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => focusEdge(tabBackRef.current)}
        />
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
        <span
          className="modal__sentinel"
          tabIndex={0}
          aria-hidden="true"
          onFocus={() => focusEdge(false)}
        />
      </div>
    </div>
  );
}
