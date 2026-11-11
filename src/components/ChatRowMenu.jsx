import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconLink, IconTrash } from "./Icons.jsx";

/**
 * Menu de uma conversa da lista (Conversas): abre ao SEGURAR a conversa no
 * celular, com o botao direito no computador ou com a tecla de menu
 * (Shift+F10) no teclado - no lugar do menu do navegador ("abrir em nova
 * aba", "copiar endereco"...).
 *
 * Props:
 * - menu: { chat, title, x, y } (onde abrir, em pixels da janela) ou null
 * - anchor: a linha que abriu o menu (rolar o que a contem fecha o menu)
 * - onClose(devolverFoco): fechou sem escolher
 * - onCopy(chat), onDelete(chat)
 *
 * Fecha com Esc, Tab, toque/clique fora, rolagem ou mudanca de tamanho da
 * janela. Setas sobem e descem entre as opcoes.
 */
export default function ChatRowMenu({ menu, anchor, onClose, onCopy, onDelete }) {
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const ref = useRef(null);
  const [place, setPlace] = useState(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Cabe na tela: abre junto do dedo/ponteiro e encosta na borda se precisar.
  useLayoutEffect(() => {
    if (!menu || !ref.current) {
      setPlace(null);
      return;
    }
    const box = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = menu.x;
    let top = menu.y + 6;
    if (left + box.width > window.innerWidth - margin) left = window.innerWidth - margin - box.width;
    if (top + box.height > window.innerHeight - margin) top = menu.y - 6 - box.height;
    setPlace({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [menu]);

  // O foco entra no menu (teclado e leitor de tela).
  useEffect(() => {
    if (menu && place) ref.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [menu, place]);

  useEffect(() => {
    if (!menu) return undefined;
    // Toque/clique fora fecha. (pointerdown, nao click: o dedo que segurou a
    // conversa e solta logo depois gera um "click" que fecharia o menu na hora.)
    function onPointerDown(event) {
      if (!ref.current?.contains(event.target)) onCloseRef.current(false);
    }
    // So a rolagem que MOVE a linha (a lista ou a pagina) fecha. A conversa
    // aberta ao lado rolando sozinha (mensagem nova) nao.
    function onScroll(event) {
      const target = event.target;
      const row = anchorRef.current;
      if (ref.current?.contains(target)) return;
      if (target === document || !row || (target instanceof Node && target.contains(row))) {
        onCloseRef.current(false);
      }
    }
    function onResize() {
      onCloseRef.current(false);
    }
    // Espera o gesto que abriu terminar antes de ouvir.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [menu]);

  if (!menu) return null;

  function onKeyDown(event) {
    const items = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "Tab") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }

  return createPortal(
    <div
      ref={ref}
      className="rowmenu"
      role="menu"
      aria-label={"Conversa com " + menu.title}
      style={place ? { left: place.left, top: place.top } : { left: -9999, top: 0, visibility: "hidden" }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="rowmenu__title" aria-hidden="true">
        {menu.title}
      </p>
      <button type="button" role="menuitem" className="rowmenu__item" onClick={() => onCopy(menu.chat)}>
        <IconLink width={18} height={18} aria-hidden="true" />
        Copiar link da conversa
      </button>
      <button
        type="button"
        role="menuitem"
        className="rowmenu__item rowmenu__item--danger"
        onClick={() => onDelete(menu.chat)}
      >
        <IconTrash width={18} height={18} aria-hidden="true" />
        Apagar conversa
      </button>
    </div>,
    document.body,
  );
}
